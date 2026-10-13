/** Client-only ids; replaced with durable ids on first successful save. */
export const createClientId = (prefix = "id"): string =>
  `tmp_${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;

export const isTempId = (id: string): boolean => id.startsWith("tmp_");
