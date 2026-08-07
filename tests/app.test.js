import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { createApp } from "../src/app.js";
import { loadConfig } from "../src/config.js";
import { createWishRepository, openDatabase } from "../src/database.js";
import { validEnv } from "./helpers.js";

let database;
let app;

beforeEach(() => {
  database = openDatabase(":memory:");
  app = createApp({
    config: loadConfig(validEnv).public,
    wishes: createWishRepository(database)
  });
});

afterEach(() => database.close());

describe("API", () => {
  test("health dan config dapat dibaca", async () => {
    const health = await app.handle(new Request("http://localhost/api/health"));
    expect(health.status).toBe(200);
    expect(await health.json()).toEqual({ status: "ok" });

    const response = await app.handle(new Request("http://localhost/api/config"));
    const config = await response.json();
    expect(config.couple.bride.name).toBe("Widia Hasmiati");
    expect(config.databasePath).toBeUndefined();
  });

  test("membuat lalu membaca RSVP", async () => {
    const createResponse = await app.handle(new Request("http://localhost/api/wishes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Andi", attendance: "HADIR", message: "Selamat!" })
    }));
    expect(createResponse.status).toBe(201);
    expect((await createResponse.json()).wish.name).toBe("Andi");

    const listResponse = await app.handle(new Request("http://localhost/api/wishes"));
    expect((await listResponse.json()).wishes).toHaveLength(1);
  });

  test("menolak input RSVP tidak valid", async () => {
    const response = await app.handle(new Request("http://localhost/api/wishes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "A", attendance: "MUNGKIN", message: "" })
    }));
    expect(response.status).toBe(422);
    expect((await response.json()).error).toContain("Nama");
  });
});
