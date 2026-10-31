import { readdir, stat, writeFile, rename, unlink } from "fs/promises";
import { join, extname, basename } from "path";
import sharp from "sharp";

const UPLOADS = join(process.cwd(), "storage", "uploads");
const LEGACY_UPLOADS = join(process.cwd(), "public", "uploads");
const MAX_EDGE = 1600;
const JPEG_QUALITY = 78;
const WEBP_QUALITY = 76;
const PNG_QUALITY = 80;

const IMAGE_EXT = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif"]);

const formatFor = (ext) => {
  if (ext === ".png") return "png";
  if (ext === ".webp") return "webp";
  if (ext === ".gif") return "jpeg"; // flatten animated/static gif to jpeg for size
  return "jpeg";
};

async function compressFile(filePath) {
  const ext = extname(filePath).toLowerCase();
  if (!IMAGE_EXT.has(ext)) return null;
  if (ext === ".svg") return null;

  const before = (await stat(filePath)).size;
  if (before < 120_000) {
    return { file: basename(filePath), before, after: before, skipped: true };
  }

  const img = sharp(filePath, { failOn: "none", animated: false }).rotate();
  const meta = await img.metadata();
  const width = meta.width ?? 0;
  const height = meta.height ?? 0;
  const needsResize = width > MAX_EDGE || height > MAX_EDGE;

  let pipeline = img;
  if (needsResize) {
    pipeline = pipeline.resize({
      width: MAX_EDGE,
      height: MAX_EDGE,
      fit: "inside",
      withoutEnlargement: true,
    });
  }

  const format = formatFor(ext);
  let outExt = ext;
  let buffer;

  if (format === "png") {
    buffer = await pipeline.png({ compressionLevel: 9, quality: PNG_QUALITY, palette: true }).toBuffer();
  } else if (format === "webp") {
    buffer = await pipeline.webp({ quality: WEBP_QUALITY }).toBuffer();
  } else {
    // Prefer jpeg output even for .gif
    outExt = ext === ".gif" ? ".jpg" : ext === ".jpeg" ? ".jpeg" : ext === ".jpg" ? ".jpg" : ".jpg";
    buffer = await pipeline
      .jpeg({ quality: JPEG_QUALITY, mozjpeg: true, chromaSubsampling: "4:2:0" })
      .toBuffer();
  }

  if (buffer.length >= before * 0.98 && !needsResize) {
    return { file: basename(filePath), before, after: before, skipped: true };
  }

  const tmp = `${filePath}.tmp`;
  await writeFile(tmp, buffer);

  if (outExt !== ext) {
    const nextPath = filePath.slice(0, -ext.length) + outExt;
    await rename(tmp, nextPath);
    await unlink(filePath);
    return {
      file: basename(nextPath),
      before,
      after: buffer.length,
      renamedFrom: basename(filePath),
    };
  }

  await rename(tmp, filePath);
  return { file: basename(filePath), before, after: buffer.length };
}

async function compressDir(dir) {
  let files = [];
  try {
    files = await readdir(dir);
  } catch {
    return { changed: 0, totalBefore: 0, totalAfter: 0 };
  }

  let totalBefore = 0;
  let totalAfter = 0;
  let changed = 0;

  for (const name of files) {
    const full = join(dir, name);
    const info = await stat(full);
    if (!info.isFile()) continue;

    try {
      const result = await compressFile(full);
      if (!result) continue;
      totalBefore += result.before;
      totalAfter += result.after;
      if (!result.skipped) {
        changed += 1;
        const pct = Math.round((1 - result.after / result.before) * 100);
        console.log(
          `✓ ${result.file}: ${(result.before / 1024 / 1024).toFixed(2)}MB → ${(result.after / 1024).toFixed(0)}KB (−${pct}%)`,
        );
      } else {
        console.log(`· ${result.file}: already small, skip`);
      }
    } catch (err) {
      console.error(`✗ ${name}:`, err instanceof Error ? err.message : err);
    }
  }

  return { changed, totalBefore, totalAfter };
}

async function main() {
  const a = await compressDir(UPLOADS);
  const b = await compressDir(LEGACY_UPLOADS);
  const changed = a.changed + b.changed;
  const totalBefore = a.totalBefore + b.totalBefore;
  const totalAfter = a.totalAfter + b.totalAfter;

  console.log("\nDone.");
  console.log(
    `Files optimized: ${changed}. Total ${(totalBefore / 1024 / 1024).toFixed(1)}MB → ${(totalAfter / 1024 / 1024).toFixed(1)}MB`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
