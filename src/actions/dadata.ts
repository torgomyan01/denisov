"use server";

import { z } from "zod";
import {
  suggestAddresses,
  suggestHouses,
  suggestStreets,
  type DadataAddressSuggestion,
} from "@/lib/dadata";
import type { ActionResult } from "@/types/site";

export const suggestAddressAction = async (
  query: string,
): Promise<ActionResult<DadataAddressSuggestion[]>> => {
  try {
    const data = await suggestAddresses(query, 7);
    return { success: true, data };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Не удалось получить подсказки";
    return { success: false, error: message };
  }
};

const streetQuerySchema = z.string().trim().min(2).max(200);

export const suggestStreetAction = async (
  query: string,
): Promise<ActionResult<DadataAddressSuggestion[]>> => {
  try {
    const parsed = streetQuerySchema.safeParse(query);
    if (!parsed.success) return { success: true, data: [] };
    const data = await suggestStreets(parsed.data, 7);
    return { success: true, data };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Не удалось найти улицу";
    return { success: false, error: message };
  }
};

const houseQuerySchema = z.object({
  streetFiasId: z.string().trim().max(64).nullable().optional(),
  street: z.string().trim().max(200),
  query: z.string().trim().min(1).max(64),
});

export const suggestHouseAction = async (
  input: unknown,
): Promise<ActionResult<DadataAddressSuggestion[]>> => {
  try {
    const parsed = houseQuerySchema.safeParse(input);
    if (!parsed.success) return { success: true, data: [] };
    const data = await suggestHouses({
      streetFiasId: parsed.data.streetFiasId,
      street: parsed.data.street,
      query: parsed.data.query,
      count: 10,
    });
    return { success: true, data };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Не удалось найти дом";
    return { success: false, error: message };
  }
};
