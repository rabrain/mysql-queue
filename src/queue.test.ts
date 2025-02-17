import { describe, expect, test } from "vitest";

import {
  LiteQueue
} from "./index.js";
import { db } from "./test.js";

interface Work {
  increment: number;
  succeedAfter?: number;
  blockForSec?: number;
}

describe("LiteQueue", () => {
  test("idempotency keys", async (context) => {
    const queue = new LiteQueue<Work>(
      context.task.id,
      db,
      {
        defaultJobArgs: {
          numRetries: 0,
        },
        keepFailedJobs: false,
      },
    );

    await queue.enqueue({ increment: 1 });
    await queue.enqueue({ increment: 2 }, { idempotencyKey: "2" });
    await queue.enqueue({ increment: 2 }, { idempotencyKey: "2" });
    await queue.enqueue({ increment: 2 }, { idempotencyKey: "2" });
    await queue.enqueue({ increment: 3 }, { idempotencyKey: "3" });

    expect(await queue.stats()).toEqual({
      pending: 3,
      running: 0,
      pending_retry: 0,
      failed: 0,
    });

  });

  test("keep failed jobs", async (context) => {
    const id = context.task.id
    const queueKeep = new LiteQueue<Work>(
      id + "queue1",
      db,
      {
        defaultJobArgs: {
          numRetries: 0,
        },
        keepFailedJobs: true,
      },
    );

    const queueDontKeep = new LiteQueue<Work>(
      id + "queue2",
      db,
      {
        defaultJobArgs: {
          numRetries: 0,
        },
        keepFailedJobs: false,
      },
    );

    const job1 = await queueKeep.enqueue({ increment: 1 });
    const job2 = await queueDontKeep.enqueue({ increment: 1 });

    expect(await queueKeep.stats()).toEqual({
      pending: 1,
      running: 0,
      pending_retry: 0,
      failed: 0,
    });
    expect(await queueDontKeep.stats()).toEqual({
      pending: 1,
      running: 0,
      pending_retry: 0,
      failed: 0,
    });

    queueKeep.finalize(job1!.id, job1!.allocationId, "failed");
    queueDontKeep.finalize(job2!.id, job2!.allocationId, "failed");

    expect(await queueKeep.stats()).toEqual({
      pending: 0,
      running: 0,
      pending_retry: 0,
      failed: 1,
    });
    expect(await queueDontKeep.stats()).toEqual({
      pending: 0,
      running: 0,
      pending_retry: 0,
      failed: 0,
    });
  });
});
