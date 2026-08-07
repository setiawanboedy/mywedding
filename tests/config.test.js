import { describe, expect, test } from "bun:test";
import { loadConfig } from "../src/config.js";
import { validEnv } from "./helpers.js";

describe("loadConfig", () => {
  test("membentuk konfigurasi publik tanpa data internal", () => {
    const config = loadConfig(validEnv);
    expect(config.port).toBe(3000);
    expect(config.public.couple.groom.name).toBe("Budi Setiawan");
    expect(config.public.couple.groom.shortName).toBe("Budi");
    expect(config.public.events).toHaveLength(2);
    expect(config.public.events[0].date).toBe("2026-12-31");
    expect(config.public.events[1].date).toBe("2027-01-01");
    expect(config.public.accounts[1].number).toBe("654321");
    expect(config.public.databasePath).toBeUndefined();
  });

  test("menolak countdown tanpa zona waktu", () => {
    expect(() => loadConfig({ ...validEnv, COUNTDOWN_TARGET: "2026-12-31T09:00:00" }))
      .toThrow("COUNTDOWN_TARGET harus berupa ISO 8601 dengan zona waktu");
  });

  test("menolak tanggal acara yang tidak valid", () => {
    expect(() => loadConfig({ ...validEnv, RECEPTION_DATE: "01-01-2027" }))
      .toThrow("RECEPTION_DATE harus memakai format YYYY-MM-DD");
  });

  test("menolak variabel wajib yang kosong", () => {
    expect(() => loadConfig({ ...validEnv, GROOM_NAME: "" }))
      .toThrow("GROOM_NAME wajib diisi");
  });
});
