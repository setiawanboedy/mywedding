import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { createApp } from "../src/app.js";
import { createSessionAuth } from "../src/auth.js";
import { createSettingsRepository, createWishRepository, openDatabase } from "../src/database.js";
import { validSettings } from "./helpers.js";

let database;
let app;

beforeEach(() => {
  database = openDatabase(":memory:");
  app = createApp({
    settings: createSettingsRepository(database, validSettings()),
    wishes: createWishRepository(database),
    auth: createSessionAuth("test-admin-key-123456")
  });
});

afterEach(() => database.close());

describe("public API", () => {
  test("halaman utama menyediakan metadata preview sosial absolut", async () => {
    const response = await app.handle(new Request("https://undangan.example/?to=Andi"));
    const html = await response.text();
    expect(response.headers.get("content-type")).toContain("text/html");
    expect(html).toContain('property="og:url" content="https://undangan.example/?to=Andi"');
    expect(html).toContain('property="og:image" content="https://undangan.example/assets/img/wedding-share.jpg"');
    expect(html).not.toContain("{{SOCIAL_");
  });

  test("favicon publik dapat dilayani dari aset yang dilacak", async () => {
    const svg = await app.handle(new Request("http://localhost/assets/img/favicon.svg?v=2"));
    const png = await app.handle(new Request("http://localhost/assets/img/favicon-32.png?v=2"));
    expect(svg.status).toBe(200);
    expect(svg.headers.get("content-type")).toContain("image/svg+xml");
    expect(png.status).toBe(200);
    expect(png.headers.get("content-type")).toContain("image/png");
  });

  test("health dan config dapat dibaca", async () => {
    const health = await app.handle(new Request("http://localhost/api/health"));
    expect(health.status).toBe(200);
    expect(await health.json()).toEqual({ status: "ok" });
    const response = await app.handle(new Request("http://localhost/api/config"));
    expect((await response.json()).couple.bride.name).toBe("Widia Hasmiati");
  });

  test("membuat lalu membaca RSVP", async () => {
    const createResponse = await app.handle(new Request("http://localhost/api/wishes", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Andi", attendance: "HADIR", message: "Selamat!" })
    }));
    expect(createResponse.status).toBe(201);
    const listResponse = await app.handle(new Request("http://localhost/api/wishes?limit=5"));
    expect((await listResponse.json()).wishes).toHaveLength(1);
  });

  test("menolak RSVP dan pagination tidak valid", async () => {
    const invalidWish = await app.handle(new Request("http://localhost/api/wishes", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "", attendance: "MUNGKIN", message: "" })
    }));
    expect(invalidWish.status).toBe(422);
    const invalidPage = await app.handle(new Request("http://localhost/api/wishes?limit=100"));
    expect(invalidPage.status).toBe(422);
  });
});

describe("admin API", () => {
  test("menolak settings tanpa sesi", async () => {
    const response = await app.handle(new Request("http://localhost/api/admin/settings"));
    expect(response.status).toBe(401);
  });

  test("login, membaca, dan memperbarui settings", async () => {
    const wrong = await app.handle(new Request("http://localhost/api/admin/login", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key: "salah" })
    }));
    expect(wrong.status).toBe(401);
    const login = await app.handle(new Request("http://localhost/api/admin/login", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key: "test-admin-key-123456" })
    }));
    expect(login.status).toBe(200);
    const cookie = login.headers.get("set-cookie").split(";")[0];
    const settingsResponse = await app.handle(new Request("http://localhost/api/admin/settings", { headers: { Cookie: cookie } }));
    const data = await settingsResponse.json();
    expect(data.settings.couple.groom.shortName).toBe("Budi");
    data.settings.couple.groom.shortName = "Bud";
    data.settings.couple.groom.childDescription = "Putra Kedua";
    data.settings.couple.groom.fatherName = "Ayah Baru";
    data.settings.couple.groom.motherName = "Ibu Baru";
    const update = await app.handle(new Request("http://localhost/api/admin/settings", {
      method: "PUT", headers: { "Content-Type": "application/json", Cookie: cookie }, body: JSON.stringify(data.settings)
    }));
    expect(update.status).toBe(200);
    const publicConfig = await app.handle(new Request("http://localhost/api/config"));
    const updatedConfig = await publicConfig.json();
    expect(updatedConfig.couple.groom.shortName).toBe("Bud");
    expect(updatedConfig.couple.groom.childDescription).toBe("Putra Kedua");
    expect(updatedConfig.couple.groom.fatherName).toBe("Ayah Baru");
    expect(updatedConfig.couple.groom.motherName).toBe("Ibu Baru");
  });
});
