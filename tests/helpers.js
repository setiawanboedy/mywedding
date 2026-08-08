import { DEFAULT_SETTINGS } from "../src/config.js";

export const validRuntimeEnv = {
  APP_PORT: "3000",
  DATABASE_PATH: ":memory:",
  ADMIN_KEY: "test-admin-key-123456"
};

export function validSettings() {
  return structuredClone(DEFAULT_SETTINGS);
}
