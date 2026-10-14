"use server";

import { mkdir, writeFile } from "fs/promises";
import { join, extname } from "path";
import { revalidatePath } from "next/cache";
import { requireAuth } from "@/lib/auth";
import { createClientId } from "@/lib/ids";
import { optimizeImageUpload } from "@/lib/image";
import { getSite, normalizeSite, saveSite } from "@/lib/site";
import { siteDataSchema, uploadFieldSchema } from "@/lib/site-schema";
import {
  formatUploadLimitError,
  MAX_UPLOAD_BYTES,
} from "@/lib/upload-limits";
import type { ActionResult, SiteData } from "@/types/site";



const ALLOWED_EXT = new Set([
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
  ".gif",
  ".svg",
  ".pdf",
]);

export const getSiteAction = async (): Promise<ActionResult<SiteData>> => {
  try {
    const data = await getSite();
    return { success: true, data };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Ошибка загрузки";
    return { success: false, error: message };
  }
};

const toActionError = (error: unknown, fallback: string): string => {
  if (error instanceof Error && error.message === "Unauthorized") {
    return "Требуется авторизация";
  }
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }
  return fallback;
};

export const updateSiteAction = async (
  input: unknown,
): Promise<ActionResult<SiteData>> => {
  try {
    await requireAuth();
    const parsed = siteDataSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message ?? "Некорректные данные",
      };
    }

    const data = await saveSite(parsed.data);
    revalidatePath("/");
    revalidatePath("/menu");
    revalidatePath("/admin");
    revalidatePath("/sitemap.xml");
    return { success: true, data };
  } catch (error) {
    return { success: false, error: toActionError(error, "Ошибка сохранения") };
  }
};

const applyUploadToSite = (
  site: SiteData,
  field: string,
  publicPath: string,
): SiteData => {
  const next = normalizeSite(site);

  if (field === "featured") {
    next.hero.featuredImage = publicPath;
    next.meta.ogImage = publicPath;
    return next;
  }
  if (field === "contacts") {
    next.contacts.image = publicPath;
    return next;
  }
  if (field === "logo") {
    next.brand.logo = publicPath;
    next.brand.headerLogoMode = "image";
    return next;
  }
  if (field === "menu") {
    next.menuPdf = publicPath;
    return next;
  }

  const dishMatch = /^dish-(\d+)$/.exec(field);
  if (dishMatch) {
    const index = Number(dishMatch[1]);
    while (next.dishes.length <= index) {
      next.dishes.push({ id: createClientId("dish"), image: "", caption: "" });
    }
    const current = next.dishes[index];
    next.dishes[index] = {
      id: current?.id ?? createClientId("dish"),
      image: publicPath,
      caption: current?.caption ?? "",
    };
    return next;
  }

  throw new Error("Неизвестное поле загрузки");
};

export const uploadFileAction = async (
  formData: FormData,
): Promise<ActionResult<{ url: string; site: SiteData }>> => {
  try {
    await requireAuth();

    const fieldRaw = String(formData.get("field") ?? "");
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return { success: false, error: "Файл не найден" };
    }
    if (file.size <= 0) {
      return { success: false, error: "Файл пустой" };
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      return { success: false, error: formatUploadLimitError() };
    }

    const dishMatch = /^dish-(\d+)$/.exec(fieldRaw);
    const known = uploadFieldSchema.safeParse(fieldRaw);
    if (!known.success && !dishMatch) {
      return { success: false, error: "Неизвестное поле загрузки" };
    }

    const ext = extname(file.name).toLowerCase() || guessExt(file.type);
    if (!ALLOWED_EXT.has(ext)) {
      return { success: false, error: "Допустимы изображения и PDF" };
    }

    if (fieldRaw === "menu" && ext !== ".pdf") {
      return { success: false, error: "Меню PDF: нужен PDF файл" };
    }
    if (fieldRaw !== "menu" && ext === ".pdf") {
      return { success: false, error: "Для этого поля нужен файл изображения" };
    }

    const rawBytes = Buffer.from(await file.arrayBuffer());
    const uploadsDir = join(process.cwd(), "public", "uploads");
    await mkdir(uploadsDir, { recursive: true });

    let outExt = ext;
    let bytes: Uint8Array = rawBytes;

    if (ext !== ".pdf" && ext !== ".svg") {
      const optimized = await optimizeImageUpload(rawBytes, ext);
      bytes = optimized.buffer;
      outExt = optimized.ext;
    }

    const filename = `${fieldRaw}-${Date.now()}${outExt}`;
    await writeFile(join(uploadsDir, filename), bytes);
    const publicPath = `/uploads/${filename}`;


    const current = await getSite();
    const updated = applyUploadToSite(current, fieldRaw, publicPath);
    const saved = await saveSite(updated);

    revalidatePath("/");
    revalidatePath("/menu");
    revalidatePath("/admin");

    return { success: true, data: { url: publicPath, site: saved } };
  } catch (error) {
    return { success: false, error: toActionError(error, "Ошибка загрузки") };
  }
};

const guessExt = (mime: string): string => {
  if (mime === "image/jpeg") return ".jpg";
  if (mime === "image/png") return ".png";
  if (mime === "image/webp") return ".webp";
  if (mime === "image/gif") return ".gif";
  if (mime === "image/svg+xml") return ".svg";
  if (mime === "application/pdf") return ".pdf";
  return "";
};
