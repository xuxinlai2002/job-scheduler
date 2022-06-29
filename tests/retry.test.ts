import { expect } from 'chai';
import * as IORedis from 'ioredis';
import { describe, beforeEach, it } from 'mocha';
import * as sinon from 'sinon';
import { v4 } from 'uuid';
import { Queue, QueueEvents, QueueScheduler, Worker } from '../src/classes';
import { removeAllQueueData } from '../src/utils';

describe('retry', function () {
  let queue: Queue;
  let queueEvents: QueueEvents;
  let queueName: string;
  const connection = { host: 'localhost' };

  beforeEach(async function () {
    queueName = `test-${v4()}`;
    queue = new Queue(queueName, { connection });
    queueEvents = new QueueEvents(queueName, { connection });
    await queueEvents.waitUntilReady();
  });

  afterEach(async function () {
    await queue.close();
    await queueEvents.close();
    await removeAllQueueData(new IORedis(), queueName);
  });

  it('should retry a job after a delay if a fixed backoff is given', async function () {
    this.timeout(10000);

    const queueScheduler = new QueueScheduler(queueName, { connection });
    await queueScheduler.waitUntilReady();

    let retryTimes = 0;
    const worker = new Worker(
      queueName,
      async job => {
        console.log('retry times :', job.attemptsMade);
        retryTimes++;
        if (job.attemptsMade < 3) {
          throw new Error('Not yet!');
        }
      },
      { connection },
    );

    await worker.waitUntilReady();
    await queue.add(
      'test',
      { foo: 'bar' },
      {
        attempts: 3,
      },
    );

    await new Promise<void>(resolve => {
      worker.on('completed', () => {
        expect(retryTimes).to.be.equal(3);
        resolve();
      });
    });

    await worker.close();
    await queueScheduler.close();
  });
});
