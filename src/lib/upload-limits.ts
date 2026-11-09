/** Max original file size accepted for upload (before compression). */
export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

export const MAX_UPLOAD_LABEL = "5 МБ";

export const formatUploadLimitError = (actualBytes?: number): string => {
  const sizeHint =
    typeof actualBytes === "number" && actualBytes > 0
      ? ` Сейчас ~${formatBytesShort(actualBytes)}.`
      : "";
  return `Файл слишком большой (максимум ${MAX_UPLOAD_LABEL}).${sizeHint} Выберите другое фото.`;
};

export const formatBytesShort = (bytes: number): string => {
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} МБ`;
  }
  if (bytes >= 1024) {
    return `${Math.round(bytes / 1024)} КБ`;
  }
  return `${bytes} Б`;
};
