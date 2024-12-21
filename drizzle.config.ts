import type { Config } from "drizzle-kit";

export default {
  schema: "./src/db/schema.ts",
  out: "./src/drizzle",
  dialect: "mysql",
  dbCredentials: {
    host: "localhost",
    database: "queue",
  },
} satisfies Config;
