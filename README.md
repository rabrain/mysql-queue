# MySQL Lite Queue

![GitHub Actions Workflow Status](https://img.shields.io/github/actions/workflow/status/rabrain/mysql-queue/ci.yml) ![NPM Version](https://img.shields.io/npm/v/mysql-queue)


A simple typesafe mysql-based job queue for Node.js.

## Installation

```bash
$ npm install mysql-queue
```

## Usage

```ts
import { connect, Runner, LiteQueue } from "mysql-queue";
import { z } from "zod";

const db = await connect("mysql://root:root@localhost:3306/queue");

const requestSchema = z.object({
    message: z.string(),
});
const ZRequest = z.infer<typeof requestSchema>;

// Init the queue
const queue = new LiteQueue<ZRequest>("requests", db, {
    defaultJobArgs: {
        numRetries: 2,
    },
    keepFailedJobs: false,
});

// Enqueue a job
await queue.enqueue({
    message: "Hello world",
});

// Start the runner
const worker = new Runner<ZRequest>(
  queue,
  {
    run: async (job) => {
      logger.info(`[${job.id}] ${job.data.message}`);
    },
    onComplete: async (job) => {
      console.log(`[${job.id}] Completed successfully`);
    },
    onError: async (job) => {
      logger.error(
        `[${job.id}] job failed: ${job.error}\n${job.error.stack}`,
      );
    },
  },
  {
    concurrency: 1,
    pollIntervalMs: 1000,
    timeoutSecs: 60,
    validator: requestSchema,
  },
);

```

## Development

```base
$ pnpm install

# And before submitting a PR

$ pnpm typecheck
$ pnpm test
```
