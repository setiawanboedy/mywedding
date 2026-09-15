import { DEFAULT_SETTINGS, loadRuntimeConfig, validateSettings } from "./src/config.js";
import { openDatabase, createGalleryRepository, createGuestLinkRepository, createSettingsRepository, createWishRepository } from "./src/database.js";
import { createApp } from "./src/app.js";
import { createSessionAuth } from "./src/auth.js";
import { createGalleryService } from "./src/gallery.js";
import { dirname, join } from "node:path";

const config = loadRuntimeConfig();
const database = openDatabase(config.databasePath);
const settings = createSettingsRepository(database, validateSettings(DEFAULT_SETTINGS));
const gallery = createGalleryService(createGalleryRepository(database), join(dirname(config.databasePath), "uploads", "gallery"));
const app = createApp({
  settings,
  wishes: createWishRepository(database),
  auth: createSessionAuth(config.adminKey),
  gallery,
  guestLinks: createGuestLinkRepository(database)
});

app.listen({ hostname: "0.0.0.0", port: config.port });
console.log(`Undangan berjalan di http://0.0.0.0:${config.port}`);

function shutdown() {
  app.stop();
  database.close();
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
