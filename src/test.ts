import { connect, migrateDB } from "./db/index.js";
import { env } from 'node:process';

const defaultUrl = env['DATABASE_URL'] ?? 'mysql://root:root@localhost:3306/queue'


async function prepareDB(url?: string) {
  const db = connect(url ?? defaultUrl);
  await migrateDB(db);
  return db;
}

export const db = await prepareDB();
