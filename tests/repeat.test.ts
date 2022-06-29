import { expect } from 'chai';
import * as IORedis from 'ioredis';
import { beforeEach, describe, it } from 'mocha';
import * as sinon from 'sinon';
import { v4 } from 'uuid';
import { Job, Queue, QueueScheduler, Worker } from '../src/classes';
import { removeAllQueueData } from '../src/utils';

describe('repeat', () => {
  let queue: Queue;
  let queueName: string;
  const connection = { host: 'localhost' };
  const ONE_SECOND = 1000;

  beforeEach(async function () {
    this.clock = sinon.useFakeTimers();
    queueName = `test-${v4()}`;
    queue = new Queue(queueName, { connection });
  });

  afterEach(async function () {
    await queue.close();
    await removeAllQueueData(new IORedis(), queueName);
  });

  it('should repeat every 10 seconds and start immediately', async function () {
    const queueScheduler = new QueueScheduler(queueName, { connection });
    await queueScheduler.waitUntilReady();

    const date = new Date('2017-02-07 9:24:00');
    this.clock.setSystemTime(date);
    const nextTick = 10 * ONE_SECOND;

    const worker = new Worker(
      queueName,
      async () => {
        this.clock.tick(nextTick);
      },
      { connection },
    );
    const delayStub = sinon.stub(worker, 'delay').callsFake(async () => {});

    await queue.add(
      'repeat',
      { foo: 'bar' },
      {
        repeat: {
          every: nextTick,
          immediately: true,
        },
      },
    );

    this.clock.tick(100);

    let prev: Job;
    let counter = 0;

    const completing = new Promise<void>(resolve => {
      worker.on('completed', async job => {
        if (prev && counter === 1) {
          expect(prev.timestamp).to.be.lt(job.timestamp);
          expect(job.timestamp - prev.timestamp).to.be.gte(100);
        } else if (prev) {
          expect(prev.timestamp).to.be.lt(job.timestamp);
          expect(job.timestamp - prev.timestamp).to.be.gte(nextTick);
        }
        prev = job;
        counter++;
        if (counter === 5) {
          resolve();
        }
      });
    });

    await completing;
    await queueScheduler.close();
    await worker.close();
    delayStub.restore();
  });
});
