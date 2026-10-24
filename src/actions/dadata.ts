"use server";

import {
  suggestAddresses,
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
