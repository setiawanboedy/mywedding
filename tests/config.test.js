import { describe, expect, test } from "bun:test";
import { loadRuntimeConfig, validateSettings } from "../src/config.js";
import { validRuntimeEnv, validSettings } from "./helpers.js";

describe("runtime config", () => {
  test("hanya membaca konfigurasi infrastruktur dan key", () => {
    const config = loadRuntimeConfig(validRuntimeEnv);
    expect(config).toEqual({ port: 3000, databasePath: ":memory:", adminKey: "test-admin-key-123456", storageEnabled: true });
  });

  test("menolak key admin yang lemah", () => {
    expect(() => loadRuntimeConfig({ ...validRuntimeEnv, ADMIN_KEY: "pendek" })).toThrow("minimal 12 karakter");
  });

  test("membaca flag penyimpanan secara ketat", () => {
    expect(loadRuntimeConfig({ ...validRuntimeEnv, STORAGE_ENABLED: "false" }).storageEnabled).toBe(false);
    expect(() => loadRuntimeConfig({ ...validRuntimeEnv, STORAGE_ENABLED: "off" })).toThrow("true atau false");
  });
});

describe("settings validation", () => {
  test("membentuk konfigurasi publik yang bersih", () => {
    const settings = validateSettings(validSettings());
    expect(settings.couple.groom.shortName).toBe("Budi");
    expect(settings.couple.groom.fatherName).toBe("Montague");
    expect(settings.events).toHaveLength(2);
    expect(settings.accounts[1].number).toBe("0987654321");
  });

  test("mempertahankan nilai bawaan orang tua untuk data lama", () => {
    const settings = validSettings();
    delete settings.couple.groom.childDescription;
    delete settings.couple.groom.fatherName;
    delete settings.couple.groom.motherName;
    const validated = validateSettings(settings);
    expect(validated.couple.groom.childDescription).toBe("Putra Pertama");
    expect(validated.couple.groom.fatherName).toBe("Montague");
    expect(validated.couple.groom.motherName).toBe("Lady Montague");
  });

  test("menolak countdown tanpa zona waktu", () => {
    const settings = validSettings();
    settings.wedding.countdownTarget = "2026-12-31T09:00:00";
    expect(() => validateSettings(settings)).toThrow("Countdown harus berupa ISO 8601 dengan zona waktu");
  });

  test("menolak tanggal dan URL tidak valid", () => {
    const settings = validSettings();
    settings.events[1].date = "31-12-2026";
    expect(() => validateSettings(settings)).toThrow("Tanggal resepsi");
    settings.events[1].date = "2026-12-31";
    settings.events[1].mapUrl = "javascript:alert(1)";
    expect(() => validateSettings(settings)).toThrow("URL http/https");
  });
});
