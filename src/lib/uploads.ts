import { createWriteStream, existsSync } from "fs";
import { access, mkdir, rename, stat } from "fs/promises";
import { extname, join, resolve, sep } from "path";
import { Readable } from "stream";
import { pipeline } from "stream/promises";

const CONTENT_TYPES: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".pdf": "application/pdf",
};

/** Project root: walk up from cwd until package.json + public/ exist. */
export const resolveProjectRoot = (): string => {
  let dir = resolve(process.cwd());
  for (let i = 0; i < 8; i++) {
    if (existsSync(join(dir, "package.json")) && existsSync(join(dir, "public"))) {
      return dir;
    }
    const parent = resolve(dir, "..");
    if (parent === dir) break;
    dir = parent;
  }
  return resolve(process.cwd());
};

/** Durable upload directory (outside public/ — Next does not snapshot it). */
export const getStorageUploadsDir = (): string =>
  join(resolveProjectRoot(), "storage", "uploads");

/** Legacy images committed under public/uploads. */
export const getPublicUploadsDir = (): string =>
  join(resolveProjectRoot(), "public", "uploads");

export const contentTypeForExt = (ext: string): string =>
  CONTENT_TYPES[ext.toLowerCase()] ?? "application/octet-stream";

export const isSafeUploadName = (name: string): boolean => {
  if (!name || name !== name.trim()) return false;
  if (name.includes("\0") || name.includes("/") || name.includes("\\")) {
    return false;
  }
  if (name === "." || name === ".." || name.includes("..")) return false;
  return /^[A-Za-z0-9._-]+$/.test(name);
};

const isInsideRoot = (filePath: string, root: string): boolean => {
  const resolved = resolve(filePath);
  const resolvedRoot = resolve(root);
  return resolved === resolvedRoot || resolved.startsWith(resolvedRoot + sep);
};

/**
 * Resolve a stored upload on disk.
 * Prefer storage/uploads (runtime writes), then public/uploads (legacy).
 */
export const resolveUploadAbsolutePath = async (
  filename: string,
): Promise<string | null> => {
  if (!isSafeUploadName(filename)) return null;

  const candidates: Array<{ root: string; file: string }> = [
    { root: getStorageUploadsDir(), file: join(getStorageUploadsDir(), filename) },
    { root: getPublicUploadsDir(), file: join(getPublicUploadsDir(), filename) },
  ];

  for (const { root, file } of candidates) {
    if (!isInsideRoot(file, root)) continue;
    try {
      const st = await stat(file);
      if (st.isFile()) return file;
    } catch {
      /* miss */
    }
  }
  return null;
};

/** Persist bytes to storage/uploads and verify the file is readable. */
export const saveUploadBytes = async (
  filename: string,
  bytes: Uint8Array,
): Promise<{ absolutePath: string; publicPath: string }> => {
  if (!isSafeUploadName(filename)) {
    throw new Error("Некорректное имя файла");
  }

  const dir = getStorageUploadsDir();
  await mkdir(dir, { recursive: true });

  const absolutePath = join(dir, filename);
  const tempPath = `${absolutePath}.${process.pid}.tmp`;

  await pipeline(
    Readable.from(Buffer.from(bytes)),
    createWriteStream(tempPath, { flags: "w" }),
  );

  await rename(tempPath, absolutePath);

  await access(absolutePath);
  const st = await stat(absolutePath);
  if (!st.isFile() || st.size <= 0) {
    throw new Error("Файл не сохранился на диск");
  }
  if (st.size !== bytes.length) {
    throw new Error("Размер файла после записи не совпал");
  }

  return {
    absolutePath,
    publicPath: `/uploads/${filename}`,
  };
};

export const extContentType = (filename: string): string =>
  contentTypeForExt(extname(filename));
