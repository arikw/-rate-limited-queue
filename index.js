function createQueue(slidingWindowInterval, maxTasksInSlidingWindow, maxConcurrent = Infinity) {

  const q = [];

  let runningTasks = 0;

  function enqueue(taskHandlers) {

    if (([].concat(taskHandlers)).length === 0) {
      return Promise.resolve([]);
    }

    taskHandlers = Array.isArray(taskHandlers) ? taskHandlers : [ taskHandlers ];
    const newTasks = [];
    for (const handler of taskHandlers) {
      if (typeof handler !== 'function') {
        throw 'Task must be a function';
      }
      const newTask = {
        handler: handler,
        startedAt: -1,
        promise: undefined
      };
      q.push(newTask);
      newTasks.push(newTask);
    }

    runNextTaskIfPossible();

    const promise = promiseAll(newTasks);
    promise.finally(() => {
      if ((runningTasks === 0) && (pendingTasks().length === 0)) {
        q.splice(0, q.length);
      }
    });
    return promise;
  }

  function pendingTasks() {
    return q.filter(task => (task.startedAt === -1));
  }

  function runNextTaskIfPossible() {
    if (runningTasks >= maxConcurrent) {
      return;
    }

    const tasksInSlidingWindow = q.filter(task =>
      (task.startedAt >= 0) &&
      (task.startedAt > (Date.now() - slidingWindowInterval))
    );

    const availableSlotsInSlidingWindow = maxTasksInSlidingWindow - tasksInSlidingWindow.length;

    const nextTask = pendingTasks()[0];
    if (!nextTask) {
      return;
    }

    function runNextTask() {
      ++runningTasks;
      nextTask.startedAt = Date.now();

      nextTask.promise = Promise.resolve(nextTask.handler())
        .catch(e => e)
        .finally(() => {
          --runningTasks;
          runNextTaskIfPossible();
        });
    }

    if (availableSlotsInSlidingWindow > 0) {
      runNextTask();
      runNextTaskIfPossible();
    } else if (runningTasks === 0) {
      setTimeout(runNextTaskIfPossible, slidingWindowInterval - (Date.now() - tasksInSlidingWindow[0].startedAt) + 1);
    }
  }

  if (process.env.NODE_ENV === 'TEST') {
    enqueue.internals = () => ({
      q,
      runningTasks
    });
  }

  return enqueue;
}

function promiseAll(newTasks) {

  const startedTasks = newTasks.filter(t => !!t.promise);
  let pendingTasks = newTasks.filter(t => !t.promise);

  return new Promise((resolve, reject) => {

    const onSetteled = () => {
      const startedTasks = pendingTasks.filter(t => !!t.promise);
      pendingTasks = pendingTasks.filter(t => !t.promise);

      if (pendingTasks.length === 0) {
        return Promise.all(newTasks.map(t => t.promise)).then(resolve).catch(reject);
      }

      for (const task of startedTasks) {
        task.includedInQueuePromise = true;
        task.promise.finally(onSetteled);
      }
    };

    if (startedTasks.length === 0) {
      const firstTaskInBatch = newTasks[0];
      const originalHandler = firstTaskInBatch.handler;
      firstTaskInBatch.handler = () => new Promise((resolve, reject) => {
        firstTaskInBatch.includedInQueuePromise = true;
        Promise.resolve(originalHandler()).then(resolve).catch(reject).finally(onSetteled);
      });
      return;
    }

    const startedTasksWithoutFinalHandler = startedTasks.filter(task => !task.includedInQueuePromise);
    for (const task of startedTasksWithoutFinalHandler) {
      task.includedInQueuePromise = true;
      task.promise.finally(onSetteled);
    }
  });
}

module.exports = createQueue;
