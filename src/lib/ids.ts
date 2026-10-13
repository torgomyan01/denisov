export const createClientId = (prefix = "tmp"): string =>
  `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;

export const isTempId = (id: string): boolean => id.startsWith("tmp_");
