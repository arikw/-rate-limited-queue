const
  expect = require('chai').expect,
  createQueue = require('../index');

function getTasks(numOfItems, timeout) {
  return [...Array(numOfItems).keys()].map(i => ({ taskName: `t${i + 1}` }))
    .map(task => () => new Promise(resolve => {
      task.started = true;
      setTimeout(() => {
        resolve(task.tasks);
      }, timeout);
    }));
}

describe('rate-limited-queue', () => {

  it('should run all tasks when sliding window is large enough', () => {
    const queue = createQueue(Infinity, Infinity);

    const tasks = getTasks(10, 100);
    queue(tasks);

    process.nextTick(() => {
      expect(queue.stats().runningTasks).to.equal(tasks.length);
    });

  });

  it('should run the desired amount of tasks in the sliding window', (done) => {

    const queue1 = createQueue(10, 3);
    queue1(getTasks(10, 55));
    process.nextTick(() => {
      expect(queue1.stats().runningTasks).to.equal(3);
    });

    const queue2 = createQueue(10/*ms*/, 1);
    queue2([
      ...getTasks(3, 10/*ms*/), // some tasks
      () => new Promise(resolve => { // an extra task
        setTimeout(() => {
          expect(queue2.stats().runningTasks).to.equal(1);
          done();
          resolve();
        }, 10/*ms*/);
      })
    ]);

  });

  it('should not pass the maximum alowed concurrent tasks', (done) => {

    const queue1 = createQueue(10, Infinity, 3);
    queue1(getTasks(10, 55/*ms*/));
    process.nextTick(() => {
      expect(queue1.stats().runningTasks).to.equal(3);
    });

    const queue2 = createQueue(10/*ms*/, Infinity, 1);
    queue2([
      ...getTasks(3, 10/*ms*/), // some tasks
      () => new Promise(resolve => { // an extra task
        setTimeout(() => {
          expect(queue2.stats().runningTasks).to.equal(1);
          done();
          resolve();
        }, 10/*ms*/);
      })
    ]);

  });

  it('rejects non-functions in the queue', () => {
    const queue = createQueue(Infinity, Infinity);
    expect(() => queue(['123'])).to.throw('Task must be a function');
    expect(() => queue('123')).to.throw('Task must be a function');
  });

  it('should except array passed to the queue function', (done) => {
    const queue = createQueue(Infinity, Infinity);
    expect(() => queue([() => {
      expect(true).to.be.true;
      done();
    }])).to.not.throw();
  });

  it('should except a single task passed to the queue function', (done) => {
    const queue = createQueue(Infinity, Infinity);
    expect(() => queue(() => {
      expect(true).to.be.true;
      done();
    })).to.not.throw();
  });

  it('should run tasks queued subsequently', (done) => {
    const queue = createQueue(Infinity, Infinity);
    queue(() => {});

    queue(() => {
      done();
    });
  });
});

