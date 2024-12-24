import { MySql2Database, type MySqlRawQueryResult, drizzle } from "drizzle-orm/mysql2";
import { migrate } from "drizzle-orm/mysql2/migrator";
import mysql from "mysql2/promise";
import path from "node:path";
import * as schema from "./schema";

export type Database = MySql2Database<Record<string, unknown>>;

export const affectedRows = (rawResult: MySqlRawQueryResult) => {
    return rawResult[0].affectedRows
};

export function connect(url: string) {
    const connection = mysql.createPool(url);
    const db = drizzle(connection, { schema, mode: 'default' });
    return db;
}

export function migrateDB(db: Database) {
    return migrate(db, {
        migrationsFolder: path.join(import.meta.dirname, '../drizzle')
    });
}
