const
  expect = require('chai').expect,
  createQueue = require('../index');

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
    const queue = createQueue(Infinity, Infinity);
    expect(typeof queue).to.equal('function');
  });

});

describe('queue()', () => {

  it('should return a promise', () => {
    const queue = createQueue(Infinity, Infinity);
    const value = queue(() => {});
    expect(typeof value.then).to.equal('function');
    expect(typeof value.catch).to.equal('function');
  });

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

  it('should reject non-functions in the queue', () => {
    const queue = createQueue(Infinity, Infinity);
    expect(() => queue(['123'])).to.throw('Task must be a function');
    expect(() => queue('123')).to.throw('Task must be a function');
  });

  it('should accept array passed to the queue function', (done) => {
    const queue = createQueue(Infinity, Infinity);
    expect(() => queue([() => {
      expect(true).to.be.true;
      done();
    }])).to.not.throw();
  });

  it('should accept a single task passed to the queue function', (done) => {
    const queue = createQueue(Infinity, Infinity);
    expect(() => queue(() => {
      expect(true).to.be.true;
      done();
    })).to.not.throw();
  });

  it('should run tasks queued using multiple queue() calls', async () => {
    const queue = createQueue(Infinity, Infinity);
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

