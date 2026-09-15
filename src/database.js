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
  database.run(`
    CREATE TABLE IF NOT EXISTS gallery_images (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      filename TEXT NOT NULL UNIQUE,
      mime_type TEXT NOT NULL,
      position INTEGER NOT NULL,
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    )
  `);
  database.run(`
    CREATE TABLE IF NOT EXISTS guest_links (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL COLLATE NOCASE UNIQUE,
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
      updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    )
  `);
  return database;
}

export function createGuestLinkRepository(database) {
  const listStatement = database.query(`
    SELECT id, name, created_at AS createdAt, updated_at AS updatedAt
    FROM guest_links ORDER BY updated_at DESC, id DESC
  `);
  const saveStatement = database.query(`
    INSERT INTO guest_links (name) VALUES ($name)
    ON CONFLICT(name) DO UPDATE SET
      name = excluded.name,
      updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
    RETURNING id, name, created_at AS createdAt, updated_at AS updatedAt
  `);
  const deleteStatement = database.query("DELETE FROM guest_links WHERE id = $id RETURNING id");

  return {
    list: () => listStatement.all(),
    save: (name) => saveStatement.get({ name }),
    delete: (id) => Boolean(deleteStatement.get({ id }))
  };
}

export function createGalleryRepository(database) {
  const listStatement = database.query(`
    SELECT id, filename, mime_type AS mimeType, position, created_at AS createdAt
    FROM gallery_images ORDER BY position, id
  `);
  const findByIdStatement = database.query("SELECT id, filename, mime_type AS mimeType, position FROM gallery_images WHERE id = $id");
  const findByFilenameStatement = database.query("SELECT id, filename, mime_type AS mimeType, position FROM gallery_images WHERE filename = $filename");
  const insertStatement = database.query("INSERT INTO gallery_images (filename, mime_type, position) VALUES ($filename, $mimeType, $position)");
  const deleteStatement = database.query("DELETE FROM gallery_images WHERE id = $id");
  const updatePositionStatement = database.query("UPDATE gallery_images SET position = $position WHERE id = $id");
  const insertMany = database.transaction((images) => {
    let position = listStatement.all().length;
    for (const image of images) insertStatement.run({ ...image, position: position++ });
  });
  const reorderMany = database.transaction((ids) => {
    ids.forEach((id, position) => updatePositionStatement.run({ id, position }));
  });
  const removeAndCompact = database.transaction((id) => {
    deleteStatement.run({ id });
    listStatement.all().forEach((image, position) => updatePositionStatement.run({ id: image.id, position }));
  });
  return {
    list: () => listStatement.all(),
    findById: (id) => findByIdStatement.get({ id }),
    findByFilename: (filename) => findByFilenameStatement.get({ filename }),
    insertMany,
    reorder: reorderMany,
    delete: removeAndCompact
  };
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
