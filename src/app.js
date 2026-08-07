import { Elysia } from "elysia";
import { join, resolve, sep } from "node:path";

const attendanceValues = new Set(["HADIR", "TIDAK_HADIR"]);

export function validateWish(body) {
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const attendance = typeof body?.attendance === "string" ? body.attendance.trim() : "";
  const message = typeof body?.message === "string" ? body.message.trim() : "";
  if (name.length < 2 || name.length > 100) throw new Error("Nama harus terdiri dari 2-100 karakter");
  if (!attendanceValues.has(attendance)) throw new Error("Status kehadiran tidak valid");
  if (message.length < 1 || message.length > 1000) throw new Error("Ucapan harus terdiri dari 1-1000 karakter");
  return { name, attendance, message };
}

export function createApp({ config, wishes, staticRoot = process.cwd() }) {
  const assetsRoot = resolve(staticRoot, "assets");

  return new Elysia()
    .get("/api/health", () => ({ status: "ok" }))
    .get("/api/config", () => config)
    .get("/api/wishes", () => ({ wishes: wishes.list() }))
    .post("/api/wishes", ({ body, set }) => {
      try {
        const wish = wishes.create(validateWish(body));
        set.status = 201;
        return { wish };
      } catch (error) {
        if (error instanceof Error && [
          "Nama harus terdiri dari 2-100 karakter",
          "Status kehadiran tidak valid",
          "Ucapan harus terdiri dari 1-1000 karakter"
        ].includes(error.message)) {
          set.status = 422;
          return { error: error.message };
        }
        throw error;
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
