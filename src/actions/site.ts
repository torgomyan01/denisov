"use server";

import { randomBytes } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import { join, extname } from "path";
import { revalidatePath } from "next/cache";
import { requireAuth } from "@/lib/auth";
import { createClientId } from "@/lib/ids";
import { optimizeImageUpload } from "@/lib/image";
import {
  createDefaultMenuCategory,
  createDefaultMenuItem,
} from "@/lib/delivery-defaults";
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
  ".heic",
  ".heif",
]);

const IMAGE_EXT = new Set([
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
  ".gif",
  ".heic",
  ".heif",
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

type UploadTarget =
  | { kind: "field"; field: string }
  | { kind: "menuItem"; categoryId: string; itemId: string }
  | { kind: "menuItemIndex"; catIndex: number; itemIndex: number }
  | { kind: "dishIndex"; index: number };

const parseUploadTarget = (formData: FormData): UploadTarget | null => {
  const fieldRaw = String(formData.get("field") ?? "").trim();
  const categoryId = String(formData.get("categoryId") ?? "").trim();
  const itemId = String(formData.get("itemId") ?? "").trim();

  if (fieldRaw === "menuItem" && categoryId && itemId) {
    return { kind: "menuItem", categoryId, itemId };
  }

  const known = uploadFieldSchema.safeParse(fieldRaw);
  if (known.success) {
    return { kind: "field", field: known.data };
  }

  const menuItemMatch = /^menu-item-(\d+)-(\d+)$/.exec(fieldRaw);
  if (menuItemMatch) {
    return {
      kind: "menuItemIndex",
      catIndex: Number(menuItemMatch[1]),
      itemIndex: Number(menuItemMatch[2]),
    };
  }

  const dishMatch = /^dish-(\d+)$/.exec(fieldRaw);
  if (dishMatch) {
    return { kind: "dishIndex", index: Number(dishMatch[1]) };
  }

  return null;
};

const applyUploadToSite = (
  site: SiteData,
  target: UploadTarget,
  publicPath: string,
): SiteData => {
  const next = normalizeSite(site);

  if (target.kind === "field") {
    const field = target.field;
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
    if (field === "deliveryBannerDesktop") {
      next.delivery.bannerDesktop = publicPath;
      return next;
    }
    if (field === "deliveryBannerMobile") {
      next.delivery.bannerMobile = publicPath;
      return next;
    }
    throw new Error("Неизвестное поле загрузки");
  }

  if (target.kind === "dishIndex") {
    const index = target.index;
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

  if (target.kind === "menuItem") {
    const category = next.menu.categories.find((c) => c.id === target.categoryId);
    if (!category) {
      throw new Error("Категория не найдена — сохраните меню и попробуйте снова");
    }
    const itemIndex = category.items.findIndex((item) => item.id === target.itemId);
    if (itemIndex < 0) {
      throw new Error("Позиция не найдена — сохраните меню и попробуйте снова");
    }
    const current = category.items[itemIndex];
    category.items[itemIndex] = createDefaultMenuItem({
      ...current,
      id: current?.id ?? target.itemId,
      image: publicPath,
    });
    return next;
  }

  // Legacy index-based menu item (kept for older clients)
  const { catIndex, itemIndex } = target;
  while (next.menu.categories.length <= catIndex) {
    next.menu.categories.push(
      createDefaultMenuCategory({ id: createClientId("cat") }),
    );
  }
  const category = next.menu.categories[catIndex];
  while (category.items.length <= itemIndex) {
    category.items.push(createDefaultMenuItem({ id: createClientId("item") }));
  }
  const current = category.items[itemIndex];
  category.items[itemIndex] = createDefaultMenuItem({
    ...current,
    id: current?.id ?? createClientId("item"),
    image: publicPath,
  });
  return next;
};

export const uploadFileAction = async (
  formData: FormData,
): Promise<ActionResult<{ url: string; site: SiteData }>> => {
  try {
    await requireAuth();

    const file = formData.get("file");
    const target = parseUploadTarget(formData);

    if (!(file instanceof File)) {
      return { success: false, error: "Файл не найден" };
    }
    if (file.size <= 0) {
      return { success: false, error: "Файл пустой" };
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      return { success: false, error: formatUploadLimitError() };
    }
    if (!target) {
      return { success: false, error: "Неизвестное поле загрузки" };
    }

    const fieldRaw = String(formData.get("field") ?? "").trim();
    const ext = extname(file.name).toLowerCase() || guessExt(file.type);
    if (!ALLOWED_EXT.has(ext)) {
      return {
        success: false,
        error:
          "Допустимы JPG, PNG, WebP, GIF, SVG или PDF. HEIC с iPhone лучше сохранить как JPG.",
      };
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
      try {
        const optimized = await optimizeImageUpload(rawBytes, ext);
        bytes = optimized.buffer;
        outExt = optimized.ext;
      } catch {
        if (ext === ".heic" || ext === ".heif") {
          return {
            success: false,
            error:
              "Не удалось обработать HEIC. Откройте фото и сохраните как JPG, затем загрузите снова.",
          };
        }
        if (!IMAGE_EXT.has(ext)) {
          return { success: false, error: "Не удалось обработать изображение" };
        }
        // Keep original bytes for rare formats sharp cannot rewrite.
      }
    }

    const filename = `upload-${Date.now()}-${randomBytes(4).toString("hex")}${outExt}`;
    await writeFile(join(uploadsDir, filename), bytes);
    const publicPath = `/uploads/${filename}`;

    const current = await getSite();
    const updated = applyUploadToSite(current, target, publicPath);
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
  if (mime === "image/heic") return ".heic";
  if (mime === "image/heif") return ".heif";
  if (mime === "application/pdf") return ".pdf";
  return "";
};
