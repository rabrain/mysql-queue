import assert from "node:assert";
import { Semaphore } from "async-mutex";

import { RunnerFuncs, RunnerOptions } from "./options.js";
import { LiteQueue } from "./queue.js";
import { Job } from "./db/schema.js";
import { DequeuedJob } from "./types.js";

export class Runner<T> {
  queue: LiteQueue<T>;
  funcs: RunnerFuncs<T>;
  opts: RunnerOptions<T>;
  stopping = false;

  constructor(
    queue: LiteQueue<T>,
    funcs: RunnerFuncs<T>,
    opts: RunnerOptions<T>,
  ) {
    this.queue = queue;
    this.funcs = funcs;
    this.opts = opts;
  }

  async run() {
    return this.runImpl(false);
  }

  stop() {
    this.stopping = true;
  }

  async runUntilEmpty() {
    return this.runImpl(true);
  }

  async runImpl(breakOnEmpty: boolean) {
    const semaphore = new Semaphore(this.opts.concurrency);
    const inFlight = new Map<number, Promise<void>>();
    while (!this.stopping) {
      await semaphore.waitForUnlock();
      const job = await this.queue.attemptDequeue({
        timeoutSecs: this.opts.timeoutSecs,
      });
      if (!job && breakOnEmpty && inFlight.size == 0) {
        // No more jobs to process, and no ongoing jobs.
        break;
      }
      if (!job) {
        await new Promise((resolve) =>
          setTimeout(resolve, this.opts.pollIntervalMs),
        );
        continue;
      }
      const [, release] = await semaphore.acquire();
      inFlight.set(
        job.id,
        this.runOnce(job).finally(() => {
          inFlight.delete(job.id);
          release();
        }),
      );
    }
    await Promise.allSettled(inFlight.values());
  }

  async runOnce(job: Job) {
    assert(job.allocationId);
    const runNumber = job.maxNumRuns - job.numRunsLeft - 1;
    let parsed: T;
    try {
      parsed = JSON.parse(job.payload) as T;
      if (this.opts.validator) {
        parsed = this.opts.validator.parse(parsed);
      }
    } catch (e) {
      await this.funcs.onError?.({
        id: job.id.toString(),
        error: e as Error,
        runNumber,
        numRetriesLeft: job.numRunsLeft,
      }).catch(() => {});
      await this.queue.finalize(
        job.id,
        job.allocationId,
        job.numRunsLeft <= 0 ? "failed" : "pending_retry",
      );
      return;
    }

    const dequeuedJob: DequeuedJob<T> = {
      id: job.id.toString(),
      data: parsed,
      runNumber,
    };
    try {
      await Promise.race([
        this.funcs.run(dequeuedJob),
        new Promise((_, reject) =>
          setTimeout(
            () => reject(new Error("Timeout")),
            this.opts.timeoutSecs * 1000,
          ),
        ),
      ]);
      await this.funcs.onComplete?.(dequeuedJob);
      await this.queue.finalize(job.id, job.allocationId, "completed");
    } catch (e) {
      await this.funcs.onError?.({
        ...dequeuedJob,
        error: e as Error,
        runNumber,
        numRetriesLeft: job.numRunsLeft,
      }).catch(() => {});
      await this.queue.finalize(
        job.id,
        job.allocationId,
        job.numRunsLeft <= 0 ? "failed" : "pending_retry",
      );
    }
  }
}
