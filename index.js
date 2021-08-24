function createQueue(slidingWindowInterval, maxTasksInSlidingWindow, maxConcurrent = Infinity) {

  const q = [];

  let runningTasks = 0;

  function enqueue(tasks) {
    tasks = Array.isArray(tasks) ? tasks : [ tasks ];
    for (const task of tasks) {
      if (typeof task !== 'function') {
        throw 'Task must be a function';
      }
      q.push({
        handler: async () => task(),
        queuedAt: Date.now(),
        startedAt: -1
      });
    }

    runNextTaskIfPossible();
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
        nextTask.startedAt = Date.now();
        ++runningTasks;
        const promise = nextTask.handler();
        promise.finally(() => {
          q.splice(q.indexOf(nextTask), 1);
          --runningTasks;
          runNextTaskIfPossible();
        });
        runNextTaskIfPossible();
      }
    }
  }
  return enqueue;
}

module.exports = createQueue;
