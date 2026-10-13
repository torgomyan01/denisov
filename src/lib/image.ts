import sharp, { type Sharp } from "sharp";

const MAX_EDGE = 1600;
const JPEG_QUALITY = 72;
const WEBP_QUALITY = 70;
const TARGET_MAX_BYTES = 450_000;

export type OptimizedImage = {
  buffer: Uint8Array;
  ext: string;
  contentType: string;
};

const toJpeg = async (pipeline: Sharp, quality: number): Promise<Uint8Array> =>
  new Uint8Array(
    await pipeline
      .clone()
      .jpeg({ quality, mozjpeg: true, chromaSubsampling: "4:2:0" })
      .toBuffer(),
  );

/** Resize + compress uploaded images for fast public delivery. */
export const optimizeImageUpload = async (
  input: Buffer,
  originalExt: string,
): Promise<OptimizedImage> => {
  const ext = originalExt.toLowerCase();

  if (ext === ".svg") {
    return {
      buffer: input,
      ext: ".svg",
      contentType: "image/svg+xml",
    };
  }

  const base = sharp(input, { failOn: "none", animated: false }).rotate();
  const meta = await base.metadata();
  const width = meta.width ?? 0;
  const height = meta.height ?? 0;

  let pipeline = base;
  if (width > MAX_EDGE || height > MAX_EDGE) {
    pipeline = pipeline.resize({
      width: MAX_EDGE,
      height: MAX_EDGE,
      fit: "inside",
      withoutEnlargement: true,
    });
  }

  // Keep transparent PNG as PNG, but still compress hard.
  if (ext === ".png" && meta.hasAlpha) {
    let buffer: Uint8Array = new Uint8Array(
      await pipeline
        .clone()
        .png({ compressionLevel: 9, quality: 70, palette: true })
        .toBuffer(),
    );

    if (buffer.length > TARGET_MAX_BYTES) {
      buffer = await toJpeg(
        pipeline.clone().flatten({ background: { r: 251, g: 248, b: 241 } }),
        JPEG_QUALITY,
      );
      return { buffer, ext: ".jpg", contentType: "image/jpeg" };
    }

    return { buffer, ext: ".png", contentType: "image/png" };
  }

  if (ext === ".webp") {
    let quality = WEBP_QUALITY;
    let buffer: Uint8Array = new Uint8Array(
      await pipeline.clone().webp({ quality }).toBuffer(),
    );
    while (buffer.length > TARGET_MAX_BYTES && quality > 48) {
      quality -= 8;
      buffer = new Uint8Array(await pipeline.clone().webp({ quality }).toBuffer());
    }
    return { buffer, ext: ".webp", contentType: "image/webp" };
  }

  // Default path: JPEG with adaptive quality.
  let quality = JPEG_QUALITY;
  let buffer = await toJpeg(pipeline, quality);
  while (buffer.length > TARGET_MAX_BYTES && quality > 48) {
    quality -= 8;
    buffer = await toJpeg(pipeline, quality);
  }

  return {
    buffer,
    ext: ".jpg",
    contentType: "image/jpeg",
  };
};
