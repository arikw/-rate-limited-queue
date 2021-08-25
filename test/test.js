const
  expect = require('chai').expect,
  createQueue = require('../index');

process.env.NODE_ENV = 'TEST';

function getTasks(numOfItems, timeout) {
  return [...Array(numOfItems).keys()].map(i => ({ taskName: `t${i + 1}` }))
    .map(task => () => new Promise(resolve => {
      task.started = true;
      setTimeout(() => {
        resolve(task.taskName);
      }, timeout);
    }));
}

describe('createQueue()', () => {

  it('should create a queue', () => {
    const queue = createQueue(1000, Infinity);
    expect(typeof queue).to.equal('function');
  });

});

describe('queue()', () => {

  it('should return a promise', () => {
    const queue = createQueue(1000, Infinity);
    const value = queue(() => {});
    expect(typeof value.then).to.equal('function');
    expect(typeof value.catch).to.equal('function');
  });

  it('should resolve the promise upon of queue() after a queue() with an immediate task completion', async () => {
    const queue = createQueue(120, 1);
    queue(() => new Promise(resolve => setTimeout(() => resolve('completed1'), 100)));
    const value = await queue(() => 'completed2');
    expect(value[0]).to.equal('completed2');
  });

  it('should resolve the promise upon of queue() after a queue() with a delayed task completion', async () => {
    const queue = createQueue(120, 1);
    queue(() => new Promise(resolve => setTimeout(() => resolve('completed1'), 100)));
    const value = await queue(() => 'completed2');
    expect(value[0]).to.equal('completed2');
  });

  it('should resolve the promise if not all tasks queued fit the sliding window', async () => {
    const queue = createQueue(50, 1);
    const value = await queue([
      () => new Promise(resolve => setTimeout(() => resolve('completed1'), 10)),
      () => 'completed2'
    ]);
    expect(value[1]).to.equal('completed2');
  });

  it('should clear the queue when all tasks are done', async () => {
    const queue = createQueue(120, 1);
    queue(() => new Promise(resolve => setTimeout(() => resolve('completed1'), 100)));
    await queue(() => 'completed2');
    expect(queue.internals().q.length).to.equal(0);
  });

  it('should run all tasks when sliding window is large enough', () => {
    const queue = createQueue(1000, Infinity);

    const tasks = getTasks(10, 100);
    queue(tasks);

    process.nextTick(() => {
      expect(queue.internals().runningTasks).to.equal(tasks.length);
    });

  });

  it('should run the desired amount of tasks in the sliding window', (done) => {

    const queue1 = createQueue(10, 3);
    queue1(getTasks(10, 55));
    process.nextTick(() => {
      expect(queue1.internals().runningTasks).to.equal(3);
    });

    const queue2 = createQueue(10/*ms*/, 1);
    queue2([
      ...getTasks(3, 10/*ms*/), // some tasks
      () => new Promise(resolve => { // an extra task
        setTimeout(() => {
          expect(queue2.internals().runningTasks).to.equal(1);
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
      expect(queue1.internals().runningTasks).to.equal(3);
    });

    const queue2 = createQueue(10/*ms*/, Infinity, 1);
    queue2([
      ...getTasks(3, 10/*ms*/), // some tasks
      () => new Promise(resolve => { // an extra task
        setTimeout(() => {
          expect(queue2.internals().runningTasks).to.equal(1);
          done();
          resolve();
        }, 10/*ms*/);
      })
    ]);

  });

  it('should reject non-functions in the queue', () => {
    const queue = createQueue(1000, Infinity);
    expect(() => queue(['123'])).to.throw('Task must be a function');
    expect(() => queue('123')).to.throw('Task must be a function');
  });

  it('should accept array passed to the queue function', (done) => {
    const queue = createQueue(1000, Infinity);
    expect(() => queue([() => {
      expect(true).to.be.true;
      done();
    }])).to.not.throw();
  });

  it('should accept a single task passed to the queue function', (done) => {
    const queue = createQueue(1000, Infinity);
    expect(() => queue(() => {
      expect(true).to.be.true;
      done();
    })).to.not.throw();
  });

  it('should run tasks queued using multiple queue() calls', async () => {
    const queue = createQueue(1000, Infinity);
    const results = [];
    queue(() => results.push('a'));
    queue(() => results.push('b'));
    await queue(() => results.push('c'));
    expect(JSON.stringify(results)).to.equal('["a","b","c"]');
  });

  it('should resolve a promise when all tasks have finished', async () => {
    const queue = createQueue(50, 2);

    const singleResolvedTask = await queue(() => new Promise(resolve => setTimeout(() => resolve('a'), 80)));
    expect(JSON.stringify(singleResolvedTask)).to.equal('["a"]');

    const multipleResolved = await queue(getTasks(2, 40));

    expect(JSON.stringify(multipleResolved)).to.equal('["t1","t2"]');
  });

  it('should reject a promise when a task has been rejected', async () => {
    const queue = createQueue(50, 2);

    const singleResolvedTask = await queue(() => new Promise((_, reject) => setTimeout(() => reject('rejection a'), 80))).catch(() => 'rejected');
    expect(singleResolvedTask[0]).to.equal('rejection a');

    const multipleResolved = await queue([
      () => new Promise((_, reject) => setTimeout(() => reject('rejection b'), 40)),
      () => new Promise((_, reject) => setTimeout(() => reject('rejection c'), 40))
    ]).catch(() => 'rejected');

    expect(multipleResolved[0]).to.equal('rejection b');
    expect(multipleResolved[1]).to.equal('rejection c');
  });
});

