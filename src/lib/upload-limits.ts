/** Max original file size accepted for upload (before compression). */
export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

export const MAX_UPLOAD_LABEL = "5 МБ";

export const formatUploadLimitError = (): string =>
  `Файл слишком большой. Максимум ${MAX_UPLOAD_LABEL}.`;
