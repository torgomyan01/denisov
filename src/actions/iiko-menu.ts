"use server";

import { randomBytes } from "crypto";
import { extname } from "path";
import { revalidatePath } from "next/cache";
import { requireAuth } from "@/lib/auth";
import {
  getIikoCatalog,
  getIikoCatalogCacheMeta,
  type IikoCatalogCacheMeta,
} from "@/lib/iiko/catalog-cache";
import { iikoMenuOverrideSchema } from "@/lib/iiko-override-schema";
import { optimizeImageUpload } from "@/lib/image";
import { prisma } from "@/lib/prisma";
import { getSite } from "@/lib/site";
import {
  formatUploadLimitError,
  MAX_UPLOAD_BYTES,
} from "@/lib/upload-limits";
import { saveUploadBytes } from "@/lib/uploads";
import type { ActionResult, SiteData } from "@/types/site";
import { z } from "zod";

const IMAGE_EXT = new Set([
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
  ".gif",
  ".heic",
  ".heif",
]);

const revalidateMenuPaths = () => {
  revalidatePath("/");
  revalidatePath("/menu");
  revalidatePath("/admin");
};

const categoryIdSchema = z.string().trim().min(1).max(64);

export const patchIikoCategoryFlagsAction = async (
  input: unknown,
): Promise<ActionResult<SiteData>> => {
  try {
    await requireAuth();
    const parsed = z
      .object({
        iikoCategoryId: categoryIdSchema,
        showOnSite: z.boolean(),
        /** Current list index — used only when creating the override row */
        sortHint: z.number().int().min(0).max(9999).optional(),
      })
      .safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message ?? "Некорректные данные",
      };
    }

    const { iikoCategoryId, showOnSite, sortHint } = parsed.data;
    const existing = await prisma.iikoCategoryOverride.findUnique({
      where: { iikoCategoryId },
    });

    await prisma.iikoCategoryOverride.upsert({
      where: { iikoCategoryId },
      create: {
        iikoCategoryId,
        showOnSite,
        sortOrder: existing?.sortOrder ?? sortHint ?? 0,
      },
      update: { showOnSite },
    });

    revalidateMenuPaths();
    const site = await getSite();
    return { success: true, data: site };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Не удалось обновить категорию";
    return { success: false, error: message };
  }
};

export const reorderIikoCategoriesAction = async (
  input: unknown,
): Promise<ActionResult<SiteData>> => {
  try {
    await requireAuth();
    const parsed = z
      .object({
        orderedIds: z.array(categoryIdSchema).min(1).max(200),
      })
      .safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message ?? "Некорректный порядок",
      };
    }

    const { orderedIds } = parsed.data;
    const existing = await prisma.iikoCategoryOverride.findMany({
      where: { iikoCategoryId: { in: orderedIds } },
    });
    const byId = new Map(existing.map((row) => [row.iikoCategoryId, row]));

    await prisma.$transaction(
      orderedIds.map((iikoCategoryId, index) => {
        const prev = byId.get(iikoCategoryId);
        return prisma.iikoCategoryOverride.upsert({
          where: { iikoCategoryId },
          create: {
            iikoCategoryId,
            sortOrder: index,
            showOnSite: prev?.showOnSite ?? true,
          },
          update: { sortOrder: index },
        });
      }),
    );

    revalidateMenuPaths();
    const site = await getSite();
    return { success: true, data: site };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Не удалось сохранить порядок";
    return { success: false, error: message };
  }
};

export const patchIikoMenuFlagsAction = async (
  input: unknown,
): Promise<ActionResult<SiteData>> => {
  try {
    await requireAuth();
    const parsed = z
      .object({
        iikoProductId: z.string().uuid(),
        showInDelivery: z.boolean().optional(),
        inStock: z.boolean().optional(),
        showInUpsell: z.boolean().optional(),
        upsellSortOrder: z.number().int().min(0).max(9999).optional(),
      })
      .safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message ?? "Некорректные данные",
      };
    }

    const { iikoProductId, ...flags } = parsed.data;
    const existing = await prisma.iikoMenuOverride.findUnique({
      where: { iikoProductId },
    });

    await prisma.iikoMenuOverride.upsert({
      where: { iikoProductId },
      create: {
        iikoProductId,
        showInDelivery: flags.showInDelivery ?? true,
        inStock: flags.inStock ?? true,
        showInUpsell: flags.showInUpsell ?? false,
        upsellSortOrder: flags.upsellSortOrder ?? 0,
      },
      update: {
        ...(flags.showInDelivery !== undefined
          ? { showInDelivery: flags.showInDelivery }
          : {}),
        ...(flags.inStock !== undefined ? { inStock: flags.inStock } : {}),
        ...(flags.showInUpsell !== undefined
          ? { showInUpsell: flags.showInUpsell }
          : {}),
        ...(flags.upsellSortOrder !== undefined
          ? { upsellSortOrder: flags.upsellSortOrder }
          : {}),
      },
    });

    void existing;
    revalidateMenuPaths();
    const site = await getSite();
    return { success: true, data: site };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Не удалось обновить";
    return { success: false, error: message };
  }
};

export type IikoMenuItemEditPayload = {
  iiko: {
    name: string;
    description: string;
    price: string;
    weight: string;
    image: string;
    kcal: number | null;
    protein: number | null;
    fat: number | null;
    carbs: number | null;
  };
  override: {
    name: string;
    description: string;
    price: string;
    weight: string;
    image: string;
    kcal: number | null;
    protein: number | null;
    fat: number | null;
    carbs: number | null;
    showInDelivery: boolean;
    inStock: boolean;
    showInUpsell: boolean;
    upsellSortOrder: number;
  };
};

export const getIikoMenuItemEditAction = async (
  iikoProductId: string,
): Promise<ActionResult<IikoMenuItemEditPayload>> => {
  try {
    await requireAuth();
    const id = z.string().uuid().safeParse(iikoProductId);
    if (!id.success) {
      return { success: false, error: "Некорректный productId" };
    }

    const [catalogRes, row] = await Promise.all([
      getIikoCatalog(),
      prisma.iikoMenuOverride.findUnique({
        where: { iikoProductId: id.data },
      }),
    ]);

    let catalogItem:
      | {
          name: string;
          description: string;
          price: number | null;
          weight: number | null;
          imageUrl: string;
          kcal: number | null;
          protein: number | null;
          fat: number | null;
          carbs: number | null;
        }
      | undefined;

    if (catalogRes.ok) {
      for (const cat of catalogRes.catalog.categories) {
        const found = cat.items.find((item) => item.productId === id.data);
        if (found) {
          catalogItem = found;
          break;
        }
      }
    }

    return {
      success: true,
      data: {
        iiko: {
          name: catalogItem?.name ?? "",
          description: catalogItem?.description ?? "",
          price:
            catalogItem?.price != null && Number.isFinite(catalogItem.price)
              ? String(catalogItem.price)
              : "",
          weight:
            catalogItem?.weight != null &&
            Number.isFinite(catalogItem.weight) &&
            catalogItem.weight > 0
              ? `${Math.round(catalogItem.weight)} г`
              : "",
          image: catalogItem?.imageUrl ?? "",
          kcal: catalogItem?.kcal ?? null,
          protein: catalogItem?.protein ?? null,
          fat: catalogItem?.fat ?? null,
          carbs: catalogItem?.carbs ?? null,
        },
        override: {
          name: row?.name ?? "",
          description: row?.description ?? "",
          price: row?.price ?? "",
          weight: row?.weight ?? "",
          image: row?.image ?? "",
          kcal: row?.kcal ?? null,
          protein: row?.protein ?? null,
          fat: row?.fat ?? null,
          carbs: row?.carbs ?? null,
          showInDelivery: row ? row.showInDelivery : true,
          inStock: row ? row.inStock : true,
          showInUpsell: row ? row.showInUpsell : false,
          upsellSortOrder: row ? row.upsellSortOrder : 0,
        },
      },
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Не удалось загрузить позицию";
    return { success: false, error: message };
  }
};

export const upsertIikoMenuOverrideAction = async (
  input: unknown,
): Promise<ActionResult<SiteData>> => {
  try {
    await requireAuth();
    const parsed = iikoMenuOverrideSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message ?? "Некорректные данные",
      };
    }

    const data = parsed.data;
    const existing = await prisma.iikoMenuOverride.findUnique({
      where: { iikoProductId: data.iikoProductId },
    });

    let image = existing?.image ?? "";
    if (data.clearImage) {
      image = "";
    } else if (typeof data.image === "string" && data.image.trim()) {
      image = data.image.trim().slice(0, 500);
    }

    await prisma.iikoMenuOverride.upsert({
      where: { iikoProductId: data.iikoProductId },
      create: {
        iikoProductId: data.iikoProductId,
        name: data.name.trim(),
        description: data.description.trim(),
        price: data.price.trim(),
        weight: data.weight.trim(),
        image,
        kcal: data.kcal,
        protein: data.protein,
        fat: data.fat,
        carbs: data.carbs,
        showInDelivery: data.showInDelivery,
        inStock: data.inStock,
        showInUpsell: data.showInUpsell,
        upsellSortOrder: data.upsellSortOrder,
      },
      update: {
        name: data.name.trim(),
        description: data.description.trim(),
        price: data.price.trim(),
        weight: data.weight.trim(),
        image,
        kcal: data.kcal,
        protein: data.protein,
        fat: data.fat,
        carbs: data.carbs,
        showInDelivery: data.showInDelivery,
        inStock: data.inStock,
        showInUpsell: data.showInUpsell,
        upsellSortOrder: data.upsellSortOrder,
      },
    });

    revalidateMenuPaths();
    const site = await getSite();
    return { success: true, data: site };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Не удалось сохранить";
    return { success: false, error: message };
  }
};

export const uploadIikoMenuImageAction = async (
  formData: FormData,
): Promise<ActionResult<{ url: string; site: SiteData }>> => {
  try {
    await requireAuth();
    const productId = String(formData.get("iikoProductId") ?? "").trim();
    if (!/^[0-9a-f-]{36}$/i.test(productId)) {
      return { success: false, error: "Некорректный productId" };
    }

    const file = formData.get("file");
    if (!(file instanceof File) || file.size <= 0) {
      return { success: false, error: "Файл не выбран" };
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      return { success: false, error: formatUploadLimitError() };
    }

    const ext = extname(file.name || "").toLowerCase() || ".jpg";
    if (!IMAGE_EXT.has(ext)) {
      return { success: false, error: "Нужен файл изображения" };
    }

    const rawBytes = Buffer.from(await file.arrayBuffer());
    const optimized = await optimizeImageUpload(rawBytes, ext);
    const filename = `upload-${Date.now()}-${randomBytes(4).toString("hex")}${optimized.ext}`;
    const saved = await saveUploadBytes(filename, optimized.buffer);
    const publicPath = saved.publicPath;

    await prisma.iikoMenuOverride.upsert({
      where: { iikoProductId: productId },
      create: {
        iikoProductId: productId,
        image: publicPath,
      },
      update: {
        image: publicPath,
      },
    });

    revalidateMenuPaths();
    const site = await getSite();
    return { success: true, data: { url: publicPath, site } };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Не удалось загрузить фото";
    return { success: false, error: message };
  }
};

export const getIikoMenuCacheMetaAction = async (): Promise<
  ActionResult<IikoCatalogCacheMeta>
> => {
  try {
    await requireAuth();
    const meta = await getIikoCatalogCacheMeta();
    return { success: true, data: meta };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Не удалось прочитать кэш меню";
    return { success: false, error: message };
  }
};

/** Force pull from iiko and rewrite the daily DB cache. */
export const refreshIikoMenuCacheAction = async (): Promise<
  ActionResult<{ site: SiteData; fetchedAt: string }>
> => {
  try {
    await requireAuth();
    const result = await getIikoCatalog({ force: true });
    if (!result.ok) {
      return { success: false, error: result.error };
    }
    revalidateMenuPaths();
    const site = await getSite();
    return {
      success: true,
      data: { site, fetchedAt: result.fetchedAt },
    };
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Не удалось обновить меню из iiko";
    return { success: false, error: message };
  }
};
