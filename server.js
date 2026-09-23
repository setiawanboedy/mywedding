import { DEFAULT_SETTINGS, loadRuntimeConfig, validateSettings } from "./src/config.js";
import { openDatabase, createGalleryRepository, createGuestLinkRepository, createSettingsRepository, createWishRepository } from "./src/database.js";
import { createApp } from "./src/app.js";
import { createSessionAuth } from "./src/auth.js";
import { createGalleryService } from "./src/gallery.js";
import { createDisabledStorage } from "./src/storage-disabled.js";
import { dirname, join } from "node:path";

const config = loadRuntimeConfig();
const defaults = validateSettings(DEFAULT_SETTINGS);
const database = config.storageEnabled ? openDatabase(config.databasePath) : null;
const disabled = config.storageEnabled ? null : createDisabledStorage(defaults);
const settings = database ? createSettingsRepository(database, defaults) : disabled.settings;
const gallery = database ? createGalleryService(createGalleryRepository(database), join(dirname(config.databasePath), "uploads", "gallery")) : disabled.gallery;
const app = createApp({
  settings,
  wishes: database ? createWishRepository(database) : disabled.wishes,
  auth: createSessionAuth(config.adminKey),
  gallery,
  guestLinks: database ? createGuestLinkRepository(database) : disabled.guestLinks,
  storageEnabled: config.storageEnabled
});

app.listen({ hostname: "0.0.0.0", port: config.port });
console.log(`Undangan berjalan di http://0.0.0.0:${config.port}`);

function shutdown() {
  app.stop();
  database?.close();
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
