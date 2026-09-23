import { Elysia } from "elysia";
import { join, resolve, sep } from "node:path";
import { validateSettings } from "./config.js";
import { GalleryValidationError } from "./gallery.js";

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

export function validateGuestName(body) {
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  if (name.length < 1 || name.length > 100) throw new Error("Nama tamu harus terdiri dari 1-100 karakter");
  return name;
}

export function createApp({ settings, wishes, auth, gallery, guestLinks, storageEnabled = true, staticRoot = process.cwd() }) {
  const assetsRoot = resolve(staticRoot, "assets");

  function requireAdmin(request, set) {
    if (auth.isAuthenticated(request)) return true;
    set.status = 401;
    return false;
  }

  function requireStorage(set) {
    if (storageEnabled) return true;
    set.status = 503;
    return false;
  }

  return new Elysia()
    .get("/api/health", () => ({ status: "ok" }))
    .get("/api/config", async () => (await settings.get()).settings)
    .get("/api/gallery", async () => ({ images: await gallery.list() }))
    .get("/api/wishes", async ({ query, set }) => {
      try {
        return await wishes.list(parsePagination(query));
      } catch (error) {
        set.status = 422;
        return { error: error.message };
      }
    })
    .post("/api/wishes", async ({ body, set }) => {
      if (!requireStorage(set)) return { error: "Penyimpanan dinonaktifkan" };
      try {
        const wish = await wishes.create(validateWish(body));
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
    .get("/api/admin/settings", async ({ request, set }) => {
      if (!requireAdmin(request, set)) return { error: "Akses ditolak" };
      return settings.get();
    })
    .put("/api/admin/settings", async ({ body, request, set }) => {
      if (!requireAdmin(request, set)) return { error: "Akses ditolak" };
      if (!requireStorage(set)) return { error: "Penyimpanan dinonaktifkan" };
      try {
        return await settings.update(validateSettings(body));
      } catch (error) {
        set.status = 422;
        return { error: error.message };
      }
    })
    .get("/api/admin/guest-links", async ({ request, set }) => {
      if (!requireAdmin(request, set)) return { error: "Akses ditolak" };
      return { links: await guestLinks.list() };
    })
    .post("/api/admin/guest-links", async ({ body, request, set }) => {
      if (!requireAdmin(request, set)) return { error: "Akses ditolak" };
      if (!requireStorage(set)) return { error: "Penyimpanan dinonaktifkan" };
      try {
        const link = await guestLinks.save(validateGuestName(body));
        set.status = 201;
        return { link, links: await guestLinks.list() };
      } catch (error) {
        set.status = 422;
        return { error: error.message };
      }
    })
    .delete("/api/admin/guest-links/:id", async ({ params, request, set }) => {
      if (!requireAdmin(request, set)) return { error: "Akses ditolak" };
      if (!requireStorage(set)) return { error: "Penyimpanan dinonaktifkan" };
      const id = Number(params.id);
      if (!Number.isInteger(id) || id < 1 || !(await guestLinks.delete(id))) {
        set.status = 404;
        return { error: "Link tamu tidak ditemukan" };
      }
      return { links: await guestLinks.list() };
    })
    .get("/api/admin/gallery", async ({ request, set }) => {
      if (!requireAdmin(request, set)) return { error: "Akses ditolak" };
      return { images: await gallery.list() };
    })
    .post("/api/admin/gallery", async ({ request, set }) => {
      if (!requireAdmin(request, set)) return { error: "Akses ditolak" };
      if (!requireStorage(set)) return { error: "Penyimpanan dinonaktifkan" };
      try {
        const formData = await request.formData();
        const files = formData.getAll("images").filter((value) => value instanceof File);
        const images = await gallery.upload(files);
        set.status = 201;
        return { images };
      } catch (error) {
        if (error instanceof GalleryValidationError) {
          set.status = 422;
          return { error: error.message };
        }
        console.error("Gallery upload failed", error);
        set.status = 500;
        return { error: "Upload gagal diproses oleh server. Silakan coba lagi atau periksa log server." };
      }
    })
    .put("/api/admin/gallery/order", async ({ body, request, set }) => {
      if (!requireAdmin(request, set)) return { error: "Akses ditolak" };
      if (!requireStorage(set)) return { error: "Penyimpanan dinonaktifkan" };
      try {
        const ids = Array.isArray(body?.ids) ? body.ids.map(Number) : [];
        return { images: await gallery.reorder(ids) };
      } catch (error) {
        if (error instanceof GalleryValidationError) {
          set.status = 422;
          return { error: error.message };
        }
        throw error;
      }
    })
    .delete("/api/admin/gallery/:id", async ({ params, request, set }) => {
      if (!requireAdmin(request, set)) return { error: "Akses ditolak" };
      if (!requireStorage(set)) return { error: "Penyimpanan dinonaktifkan" };
      const id = Number(params.id);
      if (!Number.isInteger(id) || id < 1 || !(await gallery.delete(id))) {
        set.status = 404;
        return { error: "Gambar tidak ditemukan" };
      }
      return { images: await gallery.list() };
    })
    .get("/uploads/gallery/:filename", async ({ params, set }) => {
      const image = await gallery.getFile(params.filename);
      if (!image) {
        set.status = 404;
        return "Not Found";
      }
      const file = Bun.file(image.path);
      if (!file.size) {
        set.status = 404;
        return "Not Found";
      }
      set.headers["content-type"] = image.mimeType;
      set.headers["cache-control"] = "public, max-age=31536000, immutable";
      return file;
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
      if (/\.(js|css)$/.test(requestedPath)) {
        set.headers["cache-control"] = "no-store";
      } else if (/\.(webp|png|jpe?g|svg|opus|ico|woff2?|ttf)$/i.test(requestedPath)) {
        set.headers["cache-control"] = "public, max-age=2592000, immutable";
      }
      return file;
    })
    .get("/admin", ({ set }) => {
      set.headers["cache-control"] = "no-store";
      return Bun.file(join(staticRoot, "admin.html"));
    })
    .get("/", async ({ request, set }) => {
      const pageUrl = new URL(request.url);
      const origin = pageUrl.origin;
      const html = await Bun.file(join(staticRoot, "index.html")).text();
      set.headers["content-type"] = "text/html; charset=utf-8";
      set.headers["cache-control"] = "no-store";
      return html
        .replaceAll("{{SOCIAL_PAGE_URL}}", pageUrl.href)
        .replaceAll("{{SOCIAL_IMAGE_URL}}", `${origin}/assets/img/wedding-share.jpg`);
    })
    .onError(({ code, error, set }) => {
      if (code === "NOT_FOUND") {
        set.status = 404;
        return { error: "Not Found" };
      }
      console.error(`Unhandled server error (${code})`, error);
      set.status = 500;
      return { error: "Terjadi kesalahan pada server" };
    });
}
