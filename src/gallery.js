import { mkdir, rm } from "node:fs/promises";
import { resolve, sep } from "node:path";
import { randomUUID } from "node:crypto";
import { del, put } from "@vercel/blob";

const MAX_IMAGES = 12;
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const formats = {
  "image/jpeg": { extension: "jpg", matches: (bytes) => bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff },
  "image/png": { extension: "png", matches: (bytes) => [0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a].every((value, index) => bytes[index] === value) },
  "image/webp": { extension: "webp", matches: (bytes) => String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP" }
};

export class GalleryValidationError extends Error {}

async function prepareImages(files) {
  if (!files.length) throw new GalleryValidationError("Pilih minimal satu gambar");
  const prepared = [];
  for (const file of files) {
    if (!(file instanceof File)) throw new GalleryValidationError("File upload tidak valid");
    if (file.size < 1 || file.size > MAX_FILE_SIZE) throw new GalleryValidationError("Ukuran setiap gambar maksimal 10 MB");
    const format = formats[file.type];
    if (!format) throw new GalleryValidationError("Format gambar harus JPEG, PNG, atau WebP");
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (!format.matches(bytes)) throw new GalleryValidationError("Isi file tidak sesuai dengan format gambar");
    prepared.push({ filename: `${randomUUID()}.${format.extension}`, mimeType: file.type, bytes });
  }
  return prepared;
}

export function createGalleryService(repository, uploadDirectory) {
  const uploadRoot = resolve(uploadDirectory);
  const publicImages = async () => (await repository.list()).map((image) => ({
    id: image.id,
    url: image.url || `/uploads/gallery/${image.filename}`,
    position: image.position,
    createdAt: image.createdAt
  }));

  return {
    list: publicImages,
    upload: async (files) => {
      const existingCount = (await repository.list()).length;
      if (existingCount + files.length > MAX_IMAGES) throw new GalleryValidationError(`Galeri maksimal ${MAX_IMAGES} gambar`);
      const prepared = await prepareImages(files);
      await mkdir(uploadRoot, { recursive: true });
      const writtenPaths = [];
      try {
        for (const image of prepared) {
          const path = resolve(uploadRoot, image.filename);
          await Bun.write(path, image.bytes);
          writtenPaths.push(path);
        }
        await repository.insertMany(prepared.map(({ filename, mimeType }) => ({ filename, mimeType })));
      } catch (error) {
        await Promise.all(writtenPaths.map((path) => rm(path, { force: true })));
        throw error;
      }
      return await publicImages();
    },
    delete: async (id) => {
      const image = await repository.findById(id);
      if (!image) return false;
      const path = resolve(uploadRoot, image.filename);
      if (!path.startsWith(`${uploadRoot}${sep}`)) throw new Error("Path galeri tidak valid");
      await rm(path, { force: true });
      await repository.delete(id);
      return true;
    },
    reorder: async (ids) => {
      const currentIds = (await repository.list()).map(({ id }) => id);
      if (ids.length !== currentIds.length || new Set(ids).size !== ids.length || ids.some((id) => !currentIds.includes(id))) {
        throw new GalleryValidationError("Urutan galeri tidak valid");
      }
      await repository.reorder(ids);
      return await publicImages();
    },
    getFile: async (filename) => {
      if (!/^[0-9a-f-]{36}\.(jpg|png|webp)$/.test(filename)) return null;
      const image = await repository.findByFilename(filename);
      if (!image) return null;
      const path = resolve(uploadRoot, filename);
      if (!path.startsWith(`${uploadRoot}${sep}`)) return null;
      return { path, mimeType: image.mimeType };
    }
  };
}

export function createVercelGalleryService(repository) {
  const publicImages = async () => (await repository.list()).map((image) => ({
    id: image.id,
    url: image.url,
    position: image.position,
    createdAt: image.createdAt
  }));

  return {
    list: publicImages,
    upload: async (files) => {
      const existingCount = (await repository.list()).length;
      if (existingCount + files.length > MAX_IMAGES) throw new GalleryValidationError(`Galeri maksimal ${MAX_IMAGES} gambar`);
      const prepared = await prepareImages(files);
      const uploaded = [];
      try {
        for (const image of prepared) {
          const blob = await put(`gallery/${image.filename}`, image.bytes, {
            access: "public",
            addRandomSuffix: false,
            contentType: image.mimeType
          });
          uploaded.push({ ...image, url: blob.url });
        }
        await repository.insertMany(uploaded.map(({ filename, mimeType, url }) => ({ filename, mimeType, url })));
      } catch (error) {
        await Promise.allSettled(uploaded.map((image) => del(image.url)));
        throw error;
      }
      return publicImages();
    },
    delete: async (id) => {
      const image = await repository.findById(id);
      if (!image) return false;
      await del(image.url);
      await repository.delete(id);
      return true;
    },
    reorder: async (ids) => {
      const currentIds = (await repository.list()).map(({ id }) => id);
      if (ids.length !== currentIds.length || new Set(ids).size !== ids.length || ids.some((id) => !currentIds.includes(id))) {
        throw new GalleryValidationError("Urutan galeri tidak valid");
      }
      await repository.reorder(ids);
      return publicImages();
    },
    getFile: async () => null
  };
}
