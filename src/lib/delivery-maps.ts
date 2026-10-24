/** Links and helpers for opening a delivery point in Yandex Maps / Navi. */

export const formatCoordsLabel = (lat: number, lng: number): string =>
  `${lat.toFixed(6)}, ${lng.toFixed(6)}`;

/** Show point on Yandex Maps (web / app). */
export const yandexMapsPointUrl = (lat: number, lng: number): string =>
  `https://yandex.ru/maps/?pt=${lng},${lat}&z=17&l=map`;

/**
 * Build a route TO the point (empty start → «откуда вы» / current location).
 * Opens in Yandex Maps; on phone often hands off to the app.
 */
export const yandexMapsRouteUrl = (lat: number, lng: number): string =>
  `https://yandex.ru/maps/?rtext=~${lat},${lng}&rtt=auto`;

/** Yandex Navigator «what's here» deep link. */
export const yandexNaviPointUrl = (lat: number, lng: number): string =>
  `https://yandex.ru/navi/?whatshere[point]=${lng},${lat}&whatshere[zoom]=17`;
