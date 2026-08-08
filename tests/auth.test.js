import { describe, expect, test } from "bun:test";
import { createSessionAuth } from "../src/auth.js";

describe("admin session", () => {
  test("memvalidasi key dan token aktif", () => {
    const auth = createSessionAuth("test-admin-key-123456", () => 1_000_000);
    expect(auth.login("test-admin-key-123456")).toBe(true);
    expect(auth.login("salah")).toBe(false);
    const token = auth.createToken();
    const request = new Request("http://localhost", { headers: { Cookie: `undangan_admin_session=${token}` } });
    expect(auth.isAuthenticated(request)).toBe(true);
  });

  test("menolak token rusak dan kedaluwarsa", () => {
    const active = createSessionAuth("test-admin-key-123456", () => 1_000_000);
    const token = active.createToken();
    const expired = createSessionAuth("test-admin-key-123456", () => 1_000_000 + 13 * 60 * 60 * 1000);
    expect(expired.isAuthenticated(new Request("http://localhost", { headers: { Cookie: `undangan_admin_session=${token}` } }))).toBe(false);
    expect(active.isAuthenticated(new Request("http://localhost", { headers: { Cookie: "undangan_admin_session=broken" } }))).toBe(false);
  });
});
