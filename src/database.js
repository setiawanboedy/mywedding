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
  database.run(`
    CREATE TABLE IF NOT EXISTS invitation_settings (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      config_json TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    )
  `);
  return database;
}

export function createSettingsRepository(database, initialSettings) {
  const getStatement = database.query("SELECT config_json AS configJson, updated_at AS updatedAt FROM invitation_settings WHERE id = 1");
  const insertStatement = database.query("INSERT OR IGNORE INTO invitation_settings (id, config_json) VALUES (1, $configJson)");
  const updateStatement = database.query(`
    UPDATE invitation_settings
    SET config_json = $configJson, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
    WHERE id = 1
    RETURNING updated_at AS updatedAt
  `);
  insertStatement.run({ configJson: JSON.stringify(initialSettings) });
  return {
    get: () => {
      const row = getStatement.get();
      return { settings: JSON.parse(row.configJson), updatedAt: row.updatedAt };
    },
    update: (settings) => {
      const row = updateStatement.get({ configJson: JSON.stringify(settings) });
      return { settings, updatedAt: row.updatedAt };
    }
  };
}

export function createWishRepository(database) {
  const listFirstPageStatement = database.query(`
    SELECT id, name, attendance, message, created_at AS createdAt
    FROM wishes ORDER BY id DESC LIMIT $fetchLimit
  `);
  const listBeforeStatement = database.query(`
    SELECT id, name, attendance, message, created_at AS createdAt
    FROM wishes WHERE id < $before ORDER BY id DESC LIMIT $fetchLimit
  `);
  const insertStatement = database.query(`
    INSERT INTO wishes (name, attendance, message) VALUES ($name, $attendance, $message)
    RETURNING id, name, attendance, message, created_at AS createdAt
  `);

  return {
    list: ({ limit = 5, before = null } = {}) => {
      const fetchLimit = limit + 1;
      const rows = before === null
        ? listFirstPageStatement.all({ fetchLimit })
        : listBeforeStatement.all({ before, fetchLimit });
      const page = rows.slice(0, limit);
      const hasMore = rows.length > limit;
      return {
        wishes: page,
        hasMore,
        nextCursor: hasMore ? page.at(-1).id : null
      };
    },
    create: (wish) => insertStatement.get({
      name: wish.name,
      attendance: wish.attendance,
      message: wish.message
    })
  };
}
