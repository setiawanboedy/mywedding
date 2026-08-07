import { Database } from "bun:sqlite";
import { dirname } from "node:path";
import { mkdirSync } from "node:fs";

export function openDatabase(path) {
  if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
  const database = new Database(path, { create: true, strict: true });
  database.run("PRAGMA journal_mode = WAL");
  database.run("PRAGMA foreign_keys = ON");
  database.run(`
    CREATE TABLE IF NOT EXISTS wishes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      attendance TEXT NOT NULL CHECK (attendance IN ('HADIR', 'TIDAK_HADIR')),
      message TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    )
  `);
  return database;
}

export function createWishRepository(database) {
  const listStatement = database.query(`
    SELECT id, name, attendance, message, created_at AS createdAt
    FROM wishes ORDER BY created_at DESC, id DESC LIMIT 100
  `);
  const insertStatement = database.query(`
    INSERT INTO wishes (name, attendance, message) VALUES ($name, $attendance, $message)
    RETURNING id, name, attendance, message, created_at AS createdAt
  `);

  return {
    list: () => listStatement.all(),
    create: (wish) => insertStatement.get({
      name: wish.name,
      attendance: wish.attendance,
      message: wish.message
    })
  };
}
