import Database from 'better-sqlite3';

export type AppDatabase = Database.Database;

export function createDatabase(path: string): AppDatabase {
  const database = new Database(path);
  database.pragma('foreign_keys = ON');
  return database;
}
