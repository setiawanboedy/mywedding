import { DEFAULT_SETTINGS, loadRuntimeConfig, validateSettings } from "./src/config.js";
import { openDatabase, createSettingsRepository, createWishRepository } from "./src/database.js";
import { createApp } from "./src/app.js";
import { createSessionAuth } from "./src/auth.js";

const config = loadRuntimeConfig();
const database = openDatabase(config.databasePath);
const settings = createSettingsRepository(database, validateSettings(DEFAULT_SETTINGS));
const app = createApp({
  settings,
  wishes: createWishRepository(database),
  auth: createSessionAuth(config.adminKey)
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
