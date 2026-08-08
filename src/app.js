import { Elysia } from "elysia";
import { join, resolve, sep } from "node:path";
import { validateSettings } from "./config.js";

const attendanceValues = new Set(["HADIR", "TIDAK_HADIR"]);

export function validateWish(body) {
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const attendance = typeof body?.attendance === "string" ? body.attendance.trim() : "";
  const message = typeof body?.message === "string" ? body.message.trim() : "";
  if (name.length < 1 || name.length > 100) throw new Error("Nama harus terdiri dari 1-100 karakter");
  if (!attendanceValues.has(attendance)) throw new Error("Status kehadiran tidak valid");
  if (message.length < 1 || message.length > 1000) throw new Error("Ucapan harus terdiri dari 1-1000 karakter");
  return { name, attendance, message };
}

export function parsePagination(query = {}) {
  const limit = query.limit === undefined ? 5 : Number(query.limit);
  const before = query.before === undefined ? null : Number(query.before);
  if (!Number.isInteger(limit) || limit < 1 || limit > 20) {
    throw new Error("Limit harus berupa angka 1-20");
  }
  if (before !== null && (!Number.isInteger(before) || before < 1)) {
    throw new Error("Cursor before tidak valid");
  }
  return { limit, before };
}

export function createApp({ settings, wishes, auth, staticRoot = process.cwd() }) {
  const assetsRoot = resolve(staticRoot, "assets");

  function requireAdmin(request, set) {
    if (auth.isAuthenticated(request)) return true;
    set.status = 401;
    return false;
  }

  return new Elysia()
    .get("/api/health", () => ({ status: "ok" }))
    .get("/api/config", () => settings.get().settings)
    .get("/api/wishes", ({ query, set }) => {
      try {
        return wishes.list(parsePagination(query));
      } catch (error) {
        set.status = 422;
        return { error: error.message };
      }
    })
    .post("/api/wishes", ({ body, set }) => {
      try {
        const wish = wishes.create(validateWish(body));
        set.status = 201;
        return { wish };
      } catch (error) {
        if (error instanceof Error && [
          "Nama harus terdiri dari 1-100 karakter",
          "Status kehadiran tidak valid",
          "Ucapan harus terdiri dari 1-1000 karakter"
        ].includes(error.message)) {
          set.status = 422;
          return { error: error.message };
        }
        throw error;
      }
    })
    .post("/api/admin/login", ({ body, request, set }) => {
      if (!auth.login(body?.key)) {
        set.status = 401;
        return { error: "Key akses tidak valid" };
      }
      set.headers["set-cookie"] = auth.cookie(auth.createToken(), request);
      return { authenticated: true };
    })
    .get("/api/admin/session", ({ request }) => ({ authenticated: auth.isAuthenticated(request) }))
    .post("/api/admin/logout", ({ request, set }) => {
      set.headers["set-cookie"] = auth.clearCookie(request);
      return { authenticated: false };
    })
    .get("/api/admin/settings", ({ request, set }) => {
      if (!requireAdmin(request, set)) return { error: "Akses ditolak" };
      return settings.get();
    })
    .put("/api/admin/settings", ({ body, request, set }) => {
      if (!requireAdmin(request, set)) return { error: "Akses ditolak" };
      try {
        return settings.update(validateSettings(body));
      } catch (error) {
        set.status = 422;
        return { error: error.message };
      }
    })
    .get("/assets/*", ({ params, set }) => {
      const requestedPath = resolve(assetsRoot, params["*"] || "");
      if (!requestedPath.startsWith(`${assetsRoot}${sep}`)) {
        set.status = 404;
        return "Not Found";
      }
      const file = Bun.file(requestedPath);
      if (!file.size) {
        set.status = 404;
        return "Not Found";
      }
      return file;
    })
    .get("/admin", () => Bun.file(join(staticRoot, "admin.html")))
    .get("/", () => Bun.file(join(staticRoot, "index.html")))
    .onError(({ code, set }) => {
      if (code === "NOT_FOUND") {
        set.status = 404;
        return { error: "Not Found" };
      }
      set.status = 500;
      return { error: "Terjadi kesalahan pada server" };
    });
}
