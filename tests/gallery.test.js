import { afterEach, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createGalleryRepository, openDatabase } from "../src/database.js";
import { createGalleryService, GalleryValidationError } from "../src/gallery.js";

let database;
let temporaryDirectory;

function setup() {
  temporaryDirectory = mkdtempSync(join(tmpdir(), "undangan-gallery-"));
  database = openDatabase(join(temporaryDirectory, "gallery.sqlite"));
  return createGalleryService(createGalleryRepository(database), join(temporaryDirectory, "uploads"));
}

function jpeg(name = "photo.jpg") {
  return new File([new Uint8Array([0xff, 0xd8, 0xff, 0xd9])], name, { type: "image/jpeg" });
}

afterEach(() => {
  database?.close();
  if (temporaryDirectory) rmSync(temporaryDirectory, { recursive: true, force: true });
});

describe("gallery service", () => {
  test("upload, reorder, dan hapus gambar", async () => {
    const gallery = setup();
    expect(gallery.list()).toEqual([]);
    await gallery.upload([jpeg("one.jpg"), jpeg("two.jpg")]);
    const uploaded = gallery.list();
    expect(uploaded).toHaveLength(2);
    expect(gallery.getFile(uploaded[0].url.split("/").at(-1))).not.toBeNull();
    gallery.reorder([uploaded[1].id, uploaded[0].id]);
    expect(gallery.list().map(({ id }) => id)).toEqual([uploaded[1].id, uploaded[0].id]);
    expect(await gallery.delete(uploaded[1].id)).toBe(true);
    expect(gallery.list()).toHaveLength(1);
  });

  test("menolak format palsu dan gambar ke-13", async () => {
    const gallery = setup();
    const fake = new File([new Uint8Array([1, 2, 3, 4])], "fake.jpg", { type: "image/jpeg" });
    await expect(gallery.upload([fake])).rejects.toBeInstanceOf(GalleryValidationError);
    await gallery.upload(Array.from({ length: 12 }, (_, index) => jpeg(`${index}.jpg`)));
    await expect(gallery.upload([jpeg("extra.jpg")])).rejects.toThrow("maksimal 12 gambar");
  });

  test("metadata dan file bertahan setelah database dibuka ulang", async () => {
    let gallery = setup();
    await gallery.upload([jpeg()]);
    database.close();
    database = openDatabase(join(temporaryDirectory, "gallery.sqlite"));
    gallery = createGalleryService(createGalleryRepository(database), join(temporaryDirectory, "uploads"));
    const images = gallery.list();
    expect(images).toHaveLength(1);
    expect(gallery.getFile(images[0].url.split("/").at(-1))).not.toBeNull();
    expect(gallery.getFile("../../secret.jpg")).toBeNull();
  });
});
