import { expect } from 'chai';
import * as IORedis from 'ioredis';
import { beforeEach, describe, it } from 'mocha';
import { v4 } from 'uuid';
import { Queue, Worker, Job } from '../src/classes';
import { removeAllQueueData } from '../src/utils';

describe('bulk', () => {
  let queue: Queue;
  let queueName: string;
  const connection = { host: 'localhost' };

  beforeEach(async function () {
    queueName = `test-${v4()}`;
    queue = new Queue(queueName, { connection });
  });

  afterEach(async function () {
    await queue.close();
    await removeAllQueueData(new IORedis(), queueName);
  });

  it('should process jobs', async () => {
    const name = 'test';
    let processor;
    const processing = new Promise<void>(
      resolve =>
        (processor = async (job: Job) => {
          if (job.data.idx === 0) {
            expect(job.data.foo).to.be.equal('bar');
          } else {
            expect(job.data.idx).to.be.equal(1);
            expect(job.data.foo).to.be.equal('baz');
            resolve();
          }
        }),
    );

    const worker = new Worker(queueName, processor, { connection });
    await worker.waitUntilReady();

    const jobs = await queue.addBulk([
      { name, data: { idx: 0, foo: 'bar' } },
      { name, data: { idx: 1, foo: 'baz' } },
    ]);

    expect(jobs).to.have.length(2);
    expect(jobs[0].id).to.be.ok;
    expect(jobs[0].data.foo).to.be.eql('bar');
    expect(jobs[1].id).to.be.ok;
    expect(jobs[1].data.foo).to.be.eql('baz');

    await processing;
    await worker.close();
  });
});
