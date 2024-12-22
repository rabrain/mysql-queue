import {
  index,
  int as integer,
  text,
  timestamp,
  mysqlTable,
  unique,
  varchar,
} from "drizzle-orm/mysql-core";

export const createTable = mysqlTable;

function createdAtField() {
  return timestamp("createdAt", { mode: "date" })
    .notNull()
    .$defaultFn(() => new Date());
}

export const tasksTable = createTable(
  "tasks",
  {
    id: integer("id").notNull().primaryKey().autoincrement(),
    queue: varchar("queue", { length: 255 }).notNull(),
    payload: text("payload").notNull(),
    createdAt: createdAtField(),
    status: varchar("status", {
      length: 50,
      enum: ["pending", "running", "pending_retry", "failed"],
    })
      .notNull()
      .default("pending"),
    expireAt: timestamp("expireAt", { mode: "date" }),
    allocationId: varchar("allocationId", { length: 50 }).notNull(),
    numRunsLeft: integer("numRunsLeft").notNull(),
    maxNumRuns: integer("maxNumRuns").notNull(),
    idempotencyKey: varchar("idempotencyKey", { length: 255 }),
  },
  (tasks) => ({
    queueIdx: index("tasks_queue_idx").on(tasks.queue),
    statusIdx: index("tasks_status_idx").on(tasks.status),
    expireAtIdx: index("tasks_expire_at_idx").on(tasks.expireAt),
    numRunsLeftIdx: index("tasks_num_runs_left_idx").on(tasks.numRunsLeft),
    maxNumRunsIdx: index("tasks_max_num_runs_idx").on(tasks.maxNumRuns),
    allocationIdIdx: index("tasks_allocation_id_idx").on(tasks.allocationId),
    idempotencyKeyIdx: unique().on(tasks.queue, tasks.idempotencyKey),
  }),
);

export type Job = typeof tasksTable.$inferSelect;
