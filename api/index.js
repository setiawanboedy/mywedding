import { createApp } from "../src/app.js";
import { createSessionAuth } from "../src/auth.js";
import { DEFAULT_SETTINGS, isStorageEnabled, validateSettings } from "../src/config.js";
import {
  createVercelGalleryRepository,
  createVercelGuestLinkRepository,
  createVercelSettingsRepository,
  createVercelWishRepository,
  openVercelDatabase
} from "../src/database-vercel.js";
import { createVercelGalleryService } from "../src/gallery.js";
import { createDisabledStorage } from "../src/storage-disabled.js";

let appPromise;

async function initialize() {
  const adminKey = process.env.ADMIN_KEY?.trim() || "";
  if (adminKey.length < 12) throw new Error("ADMIN_KEY wajib diisi minimal 12 karakter");
  const storageEnabled = isStorageEnabled();
  const defaults = validateSettings(DEFAULT_SETTINGS);
  if (!storageEnabled) {
    const disabled = createDisabledStorage(defaults);
    return createApp({
      ...disabled,
      auth: createSessionAuth(adminKey),
      storageEnabled: false,
      staticRoot: process.cwd()
    });
  }
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    throw new Error("BLOB_READ_WRITE_TOKEN wajib diisi pada Environment Variables Vercel");
  }

  const database = await openVercelDatabase({
    url: process.env.TURSO_DATABASE_URL,
    authToken: process.env.TURSO_AUTH_TOKEN
  });

  return createApp({
    settings: createVercelSettingsRepository(database, defaults),
    wishes: createVercelWishRepository(database),
    auth: createSessionAuth(adminKey),
    gallery: createVercelGalleryService(createVercelGalleryRepository(database)),
    guestLinks: createVercelGuestLinkRepository(database),
    staticRoot: process.cwd()
  });
}

export default {
  async fetch(request) {
    appPromise ||= initialize();
    const app = await appPromise;
    return app.handle(request);
  }
};
