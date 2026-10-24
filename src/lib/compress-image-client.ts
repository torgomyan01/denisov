/** Client-side crop + resize + compress before Server Action upload. */

/** Product photos: no need for >1000px on the site. */
export const PRODUCT_MAX_EDGE = 1000;
const DEFAULT_MAX_EDGE = PRODUCT_MAX_EDGE;
/** Keep multipart body under the Server Action limit. */
const TARGET_MAX_BYTES = 550_000;
const MIN_QUALITY = 0.48;
const START_QUALITY = 0.76;

const SKIP_TYPES = new Set(["image/svg+xml", "application/pdf"]);

export type CompressImageOptions = {
  /** Longest side after processing (default 1000). Aspect ratio is kept — no crop. */
  maxEdge?: number;
  targetMaxBytes?: number;
};

type SourceImage = {
  width: number;
  height: number;
  draw: (
    ctx: CanvasRenderingContext2D,
    sx: number,
    sy: number,
    sw: number,
    sh: number,
    dw: number,
    dh: number,
  ) => void;
  close?: () => void;
};

const loadSourceImage = async (file: File): Promise<SourceImage> => {
  if (typeof createImageBitmap === "function") {
    const bitmap = await createImageBitmap(file);
    return {
      width: bitmap.width,
      height: bitmap.height,
      draw: (ctx, sx, sy, sw, sh, dw, dh) =>
        ctx.drawImage(bitmap, sx, sy, sw, sh, 0, 0, dw, dh),
      close: () => bitmap.close(),
    };
  }

  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("Не удалось прочитать изображение"));
      el.src = url;
    });
    return {
      width: img.naturalWidth || img.width,
      height: img.naturalHeight || img.height,
      draw: (ctx, sx, sy, sw, sh, dw, dh) =>
        ctx.drawImage(img, sx, sy, sw, sh, 0, 0, dw, dh),
    };
  } finally {
    URL.revokeObjectURL(url);
  }
};

const canvasToBlob = (
  canvas: HTMLCanvasElement,
  type: string,
  quality: number,
): Promise<Blob | null> =>
  new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), type, quality);
  });

const fitContain = (
  width: number,
  height: number,
  maxEdge: number,
): { width: number; height: number } => {
  if (width <= maxEdge && height <= maxEdge) {
    return { width, height };
  }
  const scale = maxEdge / Math.max(width, height);
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
};

const baseName = (filename: string): string => {
  const trimmed = filename.trim() || "image";
  const dot = trimmed.lastIndexOf(".");
  return dot > 0 ? trimmed.slice(0, dot) : trimmed;
};

const supportsWebp = (canvas: HTMLCanvasElement): boolean => {
  try {
    return canvas.toDataURL("image/webp").startsWith("data:image/webp");
  } catch {
    return false;
  }
};

type Frame = {
  sx: number;
  sy: number;
  sw: number;
  sh: number;
  dw: number;
  dh: number;
};

/** Scale down proportionally — never crop. e.g. 2000×100 → 1000×50. */
const buildFrame = (source: SourceImage, maxEdge: number): Frame => {
  const fitted = fitContain(source.width, source.height, maxEdge);
  return {
    sx: 0,
    sy: 0,
    sw: source.width,
    sh: source.height,
    dw: fitted.width,
    dh: fitted.height,
  };
};

/**
 * Resize (keep aspect ratio) + compress raster images in the browser.
 * Does not crop. SVG / PDF are returned unchanged.
 */
export const compressImageForUpload = async (
  file: File,
  options: CompressImageOptions = {},
): Promise<File> => {
  if (typeof window === "undefined") return file;
  if (SKIP_TYPES.has(file.type)) return file;
  if (!file.type.startsWith("image/")) return file;

  const maxEdge = options.maxEdge ?? DEFAULT_MAX_EDGE;
  const targetMaxBytes = options.targetMaxBytes ?? TARGET_MAX_BYTES;

  let source: SourceImage;
  try {
    source = await loadSourceImage(file);
  } catch {
    return file;
  }

  try {
    const oversized = source.width > maxEdge || source.height > maxEdge;
    const tooHeavy = file.size > targetMaxBytes;

    if (!oversized && !tooHeavy) {
      return file;
    }

    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;

    const paint = (frame: Frame) => {
      canvas.width = frame.dw;
      canvas.height = frame.dh;
      ctx.fillStyle = "#FBF8F1";
      ctx.fillRect(0, 0, frame.dw, frame.dh);
      source.draw(
        ctx,
        frame.sx,
        frame.sy,
        frame.sw,
        frame.sh,
        frame.dw,
        frame.dh,
      );
    };

    let frame = buildFrame(source, maxEdge);
    paint(frame);

    const preferWebp = file.type === "image/webp" || supportsWebp(canvas);
    const mime = preferWebp ? "image/webp" : "image/jpeg";
    const ext = preferWebp ? ".webp" : ".jpg";

    let quality = START_QUALITY;
    let blob = await canvasToBlob(canvas, mime, quality);
    if (!blob) return file;

    while (blob.size > targetMaxBytes && quality > MIN_QUALITY) {
      quality = Math.max(MIN_QUALITY, quality - 0.08);
      const next = await canvasToBlob(canvas, mime, quality);
      if (!next) break;
      blob = next;
    }

    if (blob.size > targetMaxBytes) {
      let edge = Math.round(maxEdge * 0.8);
      while (blob.size > targetMaxBytes && edge >= 640) {
        frame = buildFrame(source, edge);
        paint(frame);
        const next = await canvasToBlob(canvas, mime, MIN_QUALITY);
        if (!next) break;
        blob = next;
        edge = Math.round(edge * 0.8);
      }
    }

    const changed =
      oversized ||
      blob.size < file.size ||
      frame.dw !== source.width ||
      frame.dh !== source.height;

    if (!changed) return file;

    return new File([blob], `${baseName(file.name)}${ext}`, {
      type: mime,
      lastModified: Date.now(),
    });
  } finally {
    source.close?.();
  }
};

/** Preset for menu / dish product photos: scale ≤1000px (no crop) + compress. */
export const compressProductImageForUpload = (file: File): Promise<File> =>
  compressImageForUpload(file, {
    maxEdge: PRODUCT_MAX_EDGE,
    targetMaxBytes: TARGET_MAX_BYTES,
  });
