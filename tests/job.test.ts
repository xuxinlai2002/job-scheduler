/*eslint-env node */
'use strict';

import { expect } from 'chai';
import * as IORedis from 'ioredis';
import { afterEach, beforeEach, describe, it } from 'mocha';
import { v4 } from 'uuid';
import { Job, Queue } from '../src/classes';
import { JobsOptions } from '../src/interfaces';
import { removeAllQueueData } from '../src/utils';

describe('Job', function () {
  let queue: Queue;
  let queueName: string;
  const connection = { host: 'localhost' };

  const timestamp = 1234567890;
  let job: Job;
  let data: any;
  let opts: JobsOptions;

  beforeEach(async function () {
    queueName = `test-${v4()}`;
    queue = new Queue(queueName, { connection });

    //create job
    data = { foo: 'bar' };
    opts = { timestamp };
    const createdJob = await Job.create(queue, 'test', data, opts);
    job = createdJob;
  });

  afterEach(async function () {
    await queue.close();
    await removeAllQueueData(new IORedis(), queueName);
  });

  it('read', async function () {
    const readJob = await Job.fromId(queue, job.id);

    expect(readJob).to.have.property('id');
    expect(readJob).to.have.property('data');
    expect(readJob.data.foo).to.be.equal('bar');
    expect(readJob.opts).to.be.an('object');
    expect(readJob.opts.timestamp).to.be.equal(timestamp);
  });

  it('update', async function () {
    await job.update({ foo: 'qux' });
    const updatedJob = await Job.fromId(queue, job.id);

    expect(updatedJob.data).to.be.eql({ foo: 'qux' });
  });

  it('remove', async function () {
    await job.remove();
    const storedJob = await Job.fromId(queue, job.id);

    expect(storedJob).to.be.equal(undefined);
  });
});
