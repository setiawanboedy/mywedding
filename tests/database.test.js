import { afterEach, describe, expect, test } from "bun:test";
import { createSettingsRepository, createWishRepository, openDatabase } from "../src/database.js";
import { validSettings } from "./helpers.js";

let database;
afterEach(() => database?.close());

describe("wish repository", () => {
  test("menyimpan dan mengurutkan ucapan terbaru", () => {
    database = openDatabase(":memory:");
    const repository = createWishRepository(database);
    repository.create({ name: "Tamu Pertama", attendance: "HADIR", message: "Selamat" });
    repository.create({ name: "Tamu Kedua", attendance: "TIDAK_HADIR", message: "Maaf belum hadir" });
    const page = repository.list();
    expect(page.wishes).toHaveLength(2);
    expect(page.wishes[0].name).toBe("Tamu Kedua");
    expect(page.hasMore).toBe(false);
    expect(page.nextCursor).toBeNull();
  });

  test("memuat halaman berikutnya tanpa duplikasi", () => {
    database = openDatabase(":memory:");
    const repository = createWishRepository(database);
    for (let index = 1; index <= 7; index += 1) {
      repository.create({ name: `Tamu ${index}`, attendance: "HADIR", message: "Selamat" });
    }
    const firstPage = repository.list({ limit: 5 });
    const secondPage = repository.list({ limit: 5, before: firstPage.nextCursor });
    expect(firstPage.wishes.map(({ id }) => id)).toEqual([7, 6, 5, 4, 3]);
    expect(firstPage.hasMore).toBe(true);
    expect(secondPage.wishes.map(({ id }) => id)).toEqual([2, 1]);
    expect(secondPage.hasMore).toBe(false);
  });
});

describe("settings repository", () => {
  test("seed hanya sekali dan menyimpan perubahan", () => {
    database = openDatabase(":memory:");
    const repository = createSettingsRepository(database, validSettings());
    const changed = repository.get().settings;
    changed.couple.groom.shortName = "Bud";
    repository.update(changed);
    createSettingsRepository(database, validSettings());
    expect(repository.get().settings.couple.groom.shortName).toBe("Bud");
  });
});
