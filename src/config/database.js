import 'dotenv/config';
import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const configuredPath = process.env.DB_PATH?.trim();

if (!configuredPath) {
    throw new Error('DB_PATH environment variable is required.');
}

const dbPath =
    configuredPath === ':memory:' ? configuredPath : resolve(configuredPath);
let database;

try {
    if (dbPath !== ':memory:') {
        mkdirSync(dirname(dbPath), { recursive: true });
    }

    database = new Database(dbPath);
    database.pragma('foreign_keys = ON');
    database.pragma('journal_mode = WAL');
} catch (error) {
    if (database?.open) {
        database.close();
    }

    throw new Error(`Failed to initialize SQLite database at "${dbPath}".`, {
        cause: error,
    });
}

export default database;
