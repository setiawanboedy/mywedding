import { createClient } from "@libsql/client";

function row(result) {
  return result.rows[0] || null;
}

export async function openVercelDatabase({ url, authToken }) {
  if (!url) throw new Error("TURSO_DATABASE_URL wajib diisi pada Environment Variables Vercel");
  if (!authToken) throw new Error("TURSO_AUTH_TOKEN wajib diisi pada Environment Variables Vercel");
  const database = createClient({ url, authToken });
  await database.batch([
    `CREATE TABLE IF NOT EXISTS wishes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      attendance TEXT NOT NULL CHECK (attendance IN ('HADIR', 'TIDAK_HADIR')),
      message TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    )`,
    `CREATE TABLE IF NOT EXISTS invitation_settings (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      config_json TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    )`,
    `CREATE TABLE IF NOT EXISTS gallery_images (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      filename TEXT NOT NULL UNIQUE,
      mime_type TEXT NOT NULL,
      position INTEGER NOT NULL,
      url TEXT,
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    )`,
    `CREATE TABLE IF NOT EXISTS guest_links (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL COLLATE NOCASE UNIQUE,
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
      updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    )`
  ], "write");
  const galleryColumns = await database.execute("PRAGMA table_info(gallery_images)");
  if (!galleryColumns.rows.some((column) => column.name === "url")) {
    await database.execute("ALTER TABLE gallery_images ADD COLUMN url TEXT");
  }
  return database;
}

export function createVercelGuestLinkRepository(database) {
  return {
    list: async () => (await database.execute(`
      SELECT id, name, created_at AS createdAt, updated_at AS updatedAt
      FROM guest_links ORDER BY updated_at DESC, id DESC
    `)).rows,
    save: async (name) => row(await database.execute({
      sql: `INSERT INTO guest_links (name) VALUES (?)
        ON CONFLICT(name) DO UPDATE SET name = excluded.name,
          updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
        RETURNING id, name, created_at AS createdAt, updated_at AS updatedAt`,
      args: [name]
    })),
    delete: async (id) => (await database.execute({ sql: "DELETE FROM guest_links WHERE id = ?", args: [id] })).rowsAffected > 0
  };
}

export function createVercelSettingsRepository(database, initialSettings) {
  let ready;
  const initialize = () => ready ||= database.execute({
    sql: "INSERT OR IGNORE INTO invitation_settings (id, config_json) VALUES (1, ?)",
    args: [JSON.stringify(initialSettings)]
  });
  return {
    get: async () => {
      await initialize();
      const value = row(await database.execute("SELECT config_json AS configJson, updated_at AS updatedAt FROM invitation_settings WHERE id = 1"));
      return { settings: JSON.parse(value.configJson), updatedAt: value.updatedAt };
    },
    update: async (settings) => {
      await initialize();
      const value = row(await database.execute({
        sql: `UPDATE invitation_settings SET config_json = ?,
          updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = 1
          RETURNING updated_at AS updatedAt`,
        args: [JSON.stringify(settings)]
      }));
      return { settings, updatedAt: value.updatedAt };
    }
  };
}

export function createVercelWishRepository(database) {
  return {
    list: async ({ limit = 5, before = null } = {}) => {
      const fetchLimit = limit + 1;
      const result = before === null
        ? await database.execute({
            sql: `SELECT id, name, attendance, message, created_at AS createdAt
              FROM wishes ORDER BY id DESC LIMIT ?`, args: [fetchLimit]
          })
        : await database.execute({
            sql: `SELECT id, name, attendance, message, created_at AS createdAt
              FROM wishes WHERE id < ? ORDER BY id DESC LIMIT ?`, args: [before, fetchLimit]
          });
      const page = result.rows.slice(0, limit);
      const hasMore = result.rows.length > limit;
      return { wishes: page, hasMore, nextCursor: hasMore ? page.at(-1).id : null };
    },
    create: async (wish) => row(await database.execute({
      sql: `INSERT INTO wishes (name, attendance, message) VALUES (?, ?, ?)
        RETURNING id, name, attendance, message, created_at AS createdAt`,
      args: [wish.name, wish.attendance, wish.message]
    }))
  };
}

export function createVercelGalleryRepository(database) {
  const list = async () => (await database.execute(`
    SELECT id, filename, mime_type AS mimeType, position, url, created_at AS createdAt
    FROM gallery_images ORDER BY position, id
  `)).rows;
  return {
    list,
    findById: async (id) => row(await database.execute({
      sql: "SELECT id, filename, mime_type AS mimeType, position, url FROM gallery_images WHERE id = ?", args: [id]
    })),
    insertMany: async (images) => {
      const current = await list();
      await database.batch(images.map((image, index) => ({
        sql: "INSERT INTO gallery_images (filename, mime_type, position, url) VALUES (?, ?, ?, ?)",
        args: [image.filename, image.mimeType, current.length + index, image.url]
      })), "write");
    },
    reorder: async (ids) => database.batch(ids.map((id, position) => ({
      sql: "UPDATE gallery_images SET position = ? WHERE id = ?", args: [position, id]
    })), "write"),
    delete: async (id) => {
      await database.execute({ sql: "DELETE FROM gallery_images WHERE id = ?", args: [id] });
      const remaining = await list();
      await database.batch(remaining.map((image, position) => ({
        sql: "UPDATE gallery_images SET position = ? WHERE id = ?", args: [position, image.id]
      })), "write");
    }
  };
}
