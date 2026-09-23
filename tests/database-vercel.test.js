import { afterEach, describe, expect, test } from "bun:test";
import {
  createVercelGalleryRepository,
  createVercelGuestLinkRepository,
  createVercelSettingsRepository,
  createVercelWishRepository,
  openVercelDatabase
} from "../src/database-vercel.js";
import { validSettings } from "./helpers.js";

let database;
afterEach(() => database?.close());

async function setup() {
  database = await openVercelDatabase({ url: ":memory:", authToken: "test-token" });
  return database;
}

describe("Vercel database repositories", () => {
  test("menyimpan settings, RSVP, dan link tamu", async () => {
    const client = await setup();
    const settings = createVercelSettingsRepository(client, validSettings());
    const wishes = createVercelWishRepository(client);
    const guestLinks = createVercelGuestLinkRepository(client);

    expect((await settings.get()).settings.couple.groom.shortName).toBe("Budi");
    const changed = (await settings.get()).settings;
    changed.couple.groom.shortName = "Bud";
    await settings.update(changed);
    expect((await settings.get()).settings.couple.groom.shortName).toBe("Bud");

    await wishes.create({ name: "Andi", attendance: "HADIR", message: "Selamat" });
    expect((await wishes.list()).wishes[0].name).toBe("Andi");

    const first = await guestLinks.save("Bapak Andi");
    const updated = await guestLinks.save("bapak andi");
    expect(updated.id).toBe(first.id);
    expect(await guestLinks.delete(first.id)).toBe(true);
  });

  test("menyimpan metadata dan urutan galeri Blob", async () => {
    const repository = createVercelGalleryRepository(await setup());
    await repository.insertMany([
      { filename: "one.jpg", mimeType: "image/jpeg", url: "https://blob.test/one.jpg" },
      { filename: "two.webp", mimeType: "image/webp", url: "https://blob.test/two.webp" }
    ]);
    const images = await repository.list();
    await repository.reorder([images[1].id, images[0].id]);
    expect((await repository.list()).map(({ filename }) => filename)).toEqual(["two.webp", "one.jpg"]);
    expect((await repository.findById(images[0].id)).url).toBe("https://blob.test/one.jpg");
    await repository.delete(images[1].id);
    expect(await repository.list()).toHaveLength(1);
  });
});
