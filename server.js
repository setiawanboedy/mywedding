import { loadConfig } from "./src/config.js";
import { openDatabase, createWishRepository } from "./src/database.js";
import { createApp } from "./src/app.js";

const config = loadConfig();
const database = openDatabase(config.databasePath);
const app = createApp({ config: config.public, wishes: createWishRepository(database) });

app.listen({ hostname: "0.0.0.0", port: config.port });
console.log(`Undangan berjalan di http://0.0.0.0:${config.port}`);

function shutdown() {
  app.stop();
  database.close();
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
