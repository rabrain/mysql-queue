import assert from "node:assert";
import { and, asc, count, eq, gt, lt, or, sql } from "drizzle-orm";

import { affectedRows, type Database } from "./db/index.js";
import { EnqueueOptions, QueueOptions } from "./options.js";
import { Job, tasksTable } from "./db/schema.js";

// generate random id
function generateAllocationId() {
  return Math.random().toString(36).substring(2, 15);
}

export class LiteQueue<T> {
  queueName: string;
  db: Database;
  options: QueueOptions;

  constructor(
    name: string,
    db: Database,
    options: QueueOptions,
  ) {
    this.queueName = name;
    this.options = options;
    this.db = db;
  }

  name() {
    return this.queueName;
  }

  /**
   * Enqueue a job into the queue.
   * If a job with the same idempotency key is already enqueued, it will be ignored and undefined will be returned.
   */
  async enqueue(payload: T, options?: EnqueueOptions): Promise<Job | undefined> {
    const opts = options ?? {};
    const numRetries = opts.numRetries ?? this.options.defaultJobArgs.numRetries;
    const jobData = {
      queue: this.queueName,
      payload: JSON.stringify(payload),
      numRunsLeft: numRetries + 1,
      maxNumRuns: numRetries + 1,
      allocationId: generateAllocationId(),
      idempotencyKey: opts.idempotencyKey,
    };

    const result = await this.db
      .insert(tasksTable)
      .values(jobData)
      .onDuplicateKeyUpdate({
        set: { id: sql`id` },
      }).$returningId();

    // Fetch the inserted job
    const insertedId = result[0].id;
    const [job] = await this.db
      .select()
      .from(tasksTable)
      .where(eq(tasksTable.id, insertedId))
      .limit(1);

    return job;
  }

  async stats() {
    const res = await this.db
      .select({ status: tasksTable.status, count: count() })
      .from(tasksTable)
      .where(eq(tasksTable.queue, this.queueName))
      .groupBy(tasksTable.status);

    return res.reduce(
      (acc, r) => {
        acc[r.status] += r.count;
        return acc;
      },
      {
        pending: 0,
        pending_retry: 0,
        running: 0,
        failed: 0,
      },
    );
  }

  async attemptDequeue(options: { timeoutSecs: number }): Promise<Job | null> {
    return await this.db.transaction(async (txn) => {
      const jobs = await txn
        .select()
        .from(tasksTable)
        .where(
          and(
            eq(tasksTable.queue, this.queueName),
            gt(tasksTable.numRunsLeft, 0),
            or(
              // Not picked by a worker yet
              eq(tasksTable.status, "pending"),

              // Failed but still has attempts left
              eq(tasksTable.status, "pending_retry"),

              // Expired and still has attempts left
              and(
                eq(tasksTable.status, "running"),
                lt(tasksTable.expireAt, new Date()),
              ),
            ),
          ),
        )
        .orderBy(asc(tasksTable.createdAt))
        .limit(1);

      if (jobs.length == 0) {
        return null;
      }
      assert(jobs.length == 1);
      const job = jobs[0];

      const change = {
        status: "running" as Job["status"],
        numRunsLeft: job.numRunsLeft - 1,
        allocationId: generateAllocationId(),
        expireAt: new Date(new Date().getTime() + options.timeoutSecs * 1000),
      };
      const result = await txn
        .update(tasksTable)
        .set(change)
        .where(
          and(
            eq(tasksTable.id, job.id),

            // The compare and swap is necessary to avoid race conditions
            eq(tasksTable.allocationId, job.allocationId),
          ),
        );
      const rows = affectedRows(result);
      if (rows == 0) {
        return null;
      }
      assert(rows == 1);
      return Object.assign(job, change);
    });
  }

  async finalize(
    id: number,
    alloctionId: string,
    status: "completed" | "pending_retry" | "failed",
  ) {
    if (status == "completed" || (status == "failed" && !this.options.keepFailedJobs)) {
      await this.db
        .delete(tasksTable)
        .where(
          and(eq(tasksTable.id, id), eq(tasksTable.allocationId, alloctionId)),
        );
    } else {
      await this.db
        .update(tasksTable)
        .set({ status: status, expireAt: null })
        .where(
          and(eq(tasksTable.id, id), eq(tasksTable.allocationId, alloctionId)),
        );
    }
  }
}
