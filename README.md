<div align="center">
    <a href="https://github.com/hoarder-app/liteque/actions/workflows/ci.yml">
        <img alt="GitHub Actions Workflow Status" src="https://img.shields.io/github/actions/workflow/status/hoarder-app/liteque/ci.yml" />
    </a>
    <a href="https://github.com/hoarder-app/liteque/releases">
        <img alt="GitHub Release" src="https://img.shields.io/github/v/release/hoarder-app/liteque" />
    </a>
</div>

# Liteque

A simple typesafe sqlite-based job queue for Node.js.

## Installation

```bash
$ npm install liteque
```

## Usage

```ts
import { buildDBClient, SqliteQueue } from "liteque";
import { z } from "zod";

const db = buildDBClient(":memory:", true);

const requestSchema = z.object({
    message: z.string(),
});
const ZRequest = z.infer<typeof requestSchema>;

// Init the queue
const queue = new SqliteQueue<ZRequest>("requests", db, {
    defaultJobArgs: {
        numRetries: 2,
    },
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
