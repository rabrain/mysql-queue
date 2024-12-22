import { MySql2Database, type MySqlRawQueryResult, drizzle } from "drizzle-orm/mysql2";
import { migrate } from "drizzle-orm/mysql2/migrator";
import mysql from "mysql2/promise";
import path from "node:path";
import { env } from 'node:process';
import * as schema from "./schema";

export const affectedRows = (rawResult: MySqlRawQueryResult) => {
    return rawResult[0].affectedRows
};

const defaultURL = env['DATABASE_URL'] ?? 'mysql://root:root@localhost:3306/queue'

export function buildDBClient(url?: string, runMigrations = false) {
    const connection = mysql.createPool(url ?? defaultURL);
    const db = drizzle(connection, { schema, mode: 'planetscale' });

    if (runMigrations) {
        migrateDB(db);
    }
    return db;
}

export function migrateDB(db: MySql2Database<any>) {
    migrate(db, {
        migrationsFolder: path.join(__dirname, '../drizzle')
    });
}
