import { expect } from 'chai';
import * as IORedis from 'ioredis';
import { describe, beforeEach, it } from 'mocha';
import * as sinon from 'sinon';
import { v4 } from 'uuid';
import { Queue, QueueEvents, QueueScheduler, Worker } from '../src/classes';
import { removeAllQueueData } from '../src/utils';

describe('monitor', function () {
  const sandbox = sinon.createSandbox();

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
    sandbox.restore();
    await queue.close();
    await queueEvents.close();
    await removeAllQueueData(new IORedis(), queueName);
  });

  it('should process a delayed job only after delayed time', async function () {
    const delay = 1000;
    const queueScheduler = new QueueScheduler(queueName, { connection });
    await queueScheduler.waitUntilReady();
    const queueEvents = new QueueEvents(queueName, { connection });
    await queueEvents.waitUntilReady();

    const worker = new Worker(queueName, async () => {}, { connection });
    await worker.waitUntilReady();

    const timestamp = Date.now();
    let publishHappened = false;

    const delayed = new Promise<void>(resolve => {
      queueEvents.on('delayed', () => {
        publishHappened = true;
        resolve();
      });
    });

    const completed = new Promise<void>((resolve, reject) => {
      queueEvents.on('completed', async function () {
        try {
          expect(Date.now() > timestamp + delay);
          const jobs = await queue.getWaiting();
          expect(jobs.length).to.be.equal(0);

          const delayedJobs = await queue.getDelayed();
          expect(delayedJobs.length).to.be.equal(0);
          expect(publishHappened).to.be.eql(true);
          await worker.close();
          resolve();
        } catch (err) {
          reject(err);
        }
      });
    });

    const job = await queue.add('test', { delayed: 'foobar' }, { delay });

    expect(job.id).to.be.ok;
    expect(job.data.delayed).to.be.eql('foobar');
    expect(job.opts.delay).to.be.eql(delay);

    await delayed;
    await completed;
    await queueScheduler.close();
    await queueEvents.close();
    await worker.close();
  });
});
