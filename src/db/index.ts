import { MySql2Database, type MySqlRawQueryResult, drizzle } from "drizzle-orm/mysql2";
import { migrate } from "drizzle-orm/mysql2/migrator";
import mysql from "mysql2/promise";
import path from "node:path";
import * as schema from "./schema";

export type Database = MySql2Database<typeof schema>;

export const affectedRows = (rawResult: MySqlRawQueryResult) => {
    return rawResult[0].affectedRows
};

export async function connect(url: string) {
    const connection = await mysql.createConnection(url);
    const db = drizzle(connection, { schema, mode: 'default' });
    return db;
}

export function migrateDB(db: MySql2Database<Record<string, unknown>>) {
    return migrate(db, {
        migrationsFolder: path.join(import.meta.dirname, '../drizzle')
    });
}
