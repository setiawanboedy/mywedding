import { afterEach, describe, expect, test } from "bun:test";
import { createWishRepository, openDatabase } from "../src/database.js";

let database;
afterEach(() => database?.close());

describe("wish repository", () => {
  test("menyimpan dan mengurutkan ucapan terbaru", () => {
    database = openDatabase(":memory:");
    const repository = createWishRepository(database);
    repository.create({ name: "Tamu Pertama", attendance: "HADIR", message: "Selamat" });
    repository.create({ name: "Tamu Kedua", attendance: "TIDAK_HADIR", message: "Maaf belum hadir" });
    const wishes = repository.list();
    expect(wishes).toHaveLength(2);
    expect(wishes[0].name).toBe("Tamu Kedua");
  });
});
