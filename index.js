function createQueue(slidingWindowInterval, maxTasksInSlidingWindow, maxConcurrent = Infinity) {

  const q = [];

  let runningTasks = 0;

  function enqueue(taskHandlers) {
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

    return promiseAll(newTasks, q);
  }

  enqueue.stats = () => ({
    runningTasks
  });

  function runNextTaskIfPossible() {
    if (runningTasks >= maxConcurrent) {
      return;
    }

    const tasksInSlidingWindow = q.filter(task =>
      (task.startedAt >= 0) &&
      (task.startedAt > (Date.now() - slidingWindowInterval))
    );

    const availableSlotsInSlidingWindow = maxTasksInSlidingWindow - tasksInSlidingWindow.length;
    if (availableSlotsInSlidingWindow > 0) {

      const nextTask = q.find(task => (task.startedAt === -1));

      if (nextTask) {

        ++runningTasks;
        nextTask.startedAt = Date.now();

        const promise = Promise.resolve(nextTask.handler()).catch(e => e);
        promise.finally(() => {
          --runningTasks;
          q.splice(q.indexOf(nextTask), 1); // remove the task
          runNextTaskIfPossible();
        });
        nextTask.promise = promise;
        runNextTaskIfPossible();
      }
    }
  }

  return enqueue;
}

function promiseAll(newTasks, q) {

  const startedTasks = q.filter(t => !!t.promise);
  let pendingTasks = q.filter(t => !t.promise);

  return new Promise((resolve, reject) => {

    const onSetteled = () => {
      const startedTasks = pendingTasks.filter(t => !!t.promise);
      pendingTasks = pendingTasks.filter(t => !t.promise);

      if (pendingTasks.length === 0) {
        return Promise.all(newTasks.map(t => t.promise)).then(resolve).catch(reject);
      }

      for (const task of startedTasks) {
        task.promise.finally(onSetteled);
      }
    };

    for (const task of startedTasks) {
      task.promise.finally(onSetteled);
    }
  });
}

module.exports = createQueue;
