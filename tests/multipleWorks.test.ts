import { expect } from 'chai';
import * as IORedis from 'ioredis';
import { beforeEach, describe, it } from 'mocha';
import { v4 } from 'uuid';
import { Queue, Worker, Job } from '../src/classes';
import { removeAllQueueData } from '../src/utils';

describe('multiple workers', () => {
  let queue1: Queue;
  let queue2: Queue;
  let queueName: string;
  const connection = { host: 'localhost' };

  beforeEach(async function () {
    queueName = `test-${v4()}`;
    queue1 = new Queue(queueName, { connection });
    queue2 = new Queue(queueName, { connection });
  });

  afterEach(async function () {
    await queue1.close();
    await queue2.close();
    await removeAllQueueData(new IORedis(), queueName);
  });

  it('should process jobs', async () => {
    let processor1;
    const processing1 = new Promise<void>(
      resolve =>
        (processor1 = async (job: Job) => {
          expect(job.data.foo).to.be.equal('bar');
          resolve();
        }),
    );

    let processor2;
    const processing2 = new Promise<void>(
      resolve =>
        (processor2 = async (job: Job) => {
          expect(job.data.foo).to.be.equal('bar');
          resolve();
        }),
    );

    const worker1 = new Worker(queueName, processor1, { connection });
    await worker1.waitUntilReady();

    const worker2 = new Worker(queueName, processor2, { connection });
    await worker2.waitUntilReady();

    const job1 = await queue1.add('repeat', { foo: 'bar' }, {});
    expect(job1.id).to.be.ok;
    expect(job1.data.foo).to.be.eql('bar');

    const job2 = await queue1.add('repeat', { foo: 'bar' }, {});
    expect(job2.id).to.be.ok;
    expect(job2.data.foo).to.be.eql('bar');

    await processing1;
    await processing2;

    await worker1.close();
    await worker2.close();
  });
});
