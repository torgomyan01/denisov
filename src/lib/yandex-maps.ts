/** Client-side Yandex Maps JS API 2.1 loader. */

export type YMapsCoords = [number, number]; // [lat, lng]

export type YMapsEventTarget = {
  events: {
    add: (name: string, handler: (...args: unknown[]) => void) => void;
    remove?: (name: string, handler: (...args: unknown[]) => void) => void;
  };
};

export type YMapsPlacemark = YMapsEventTarget & {
  geometry: {
    getCoordinates: () => YMapsCoords;
    setCoordinates: (coords: YMapsCoords) => void;
  };
};

export type YMapsPolygon = YMapsEventTarget & {
  geometry: {
    getCoordinates: () => YMapsCoords[][];
    setCoordinates: (coords: YMapsCoords[][]) => void;
  };
  options: {
    set: (key: string, value: unknown) => void;
  };
  editor: {
    startDrawing: () => void;
    stopDrawing: () => void;
    startEditing: () => void;
    stopEditing: () => void;
    events: {
      add: (name: string, handler: () => void) => void;
    };
  };
};

export type YMapsMap = {
  destroy: () => void;
  setCenter: (coords: YMapsCoords, zoom?: number, opts?: { duration?: number }) => void;
  setBounds: (
    bounds: [YMapsCoords, YMapsCoords],
    opts?: { checkZoomRange?: boolean; zoomMargin?: number | number[] },
  ) => void;
  geoObjects: {
    add: (obj: YMapsPlacemark | YMapsPolygon) => void;
    remove: (obj: YMapsPlacemark | YMapsPolygon) => void;
    removeAll: () => void;
  };
  events: {
    add: (
      name: string,
      handler: (e: { get: (key: string) => YMapsCoords }) => void,
    ) => void;
    remove: (
      name: string,
      handler: (e: { get: (key: string) => YMapsCoords }) => void,
    ) => void;
  };
};

export type YMapsApi = {
  ready: (cb: () => void) => void;
  Map: new (
    element: HTMLElement,
    state: { center: YMapsCoords; zoom: number; controls?: string[] },
    options?: Record<string, unknown>,
  ) => YMapsMap;
  Placemark: new (
    coords: YMapsCoords,
    properties?: Record<string, unknown>,
    options?: { draggable?: boolean; preset?: string },
  ) => YMapsPlacemark;
  Polygon: new (
    coordinates: YMapsCoords[][],
    properties?: Record<string, unknown>,
    options?: Record<string, unknown>,
  ) => YMapsPolygon;
};

declare global {
  interface Window {
    ymaps?: YMapsApi;
  }
}

const SCRIPT_ID = "yandex-maps-jsapi-2.1";

export const getYandexMapsApiKey = (): string =>
  (process.env.NEXT_PUBLIC_YANDEX_MAPS_API_KEY || "").trim();

export const loadYandexMaps = (): Promise<YMapsApi> => {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Yandex Maps only works in the browser"));
  }

  if (window.ymaps) {
    return new Promise((resolve) => {
      window.ymaps!.ready(() => resolve(window.ymaps!));
    });
  }

  const key = getYandexMapsApiKey();
  if (!key) {
    return Promise.reject(
      new Error("NEXT_PUBLIC_YANDEX_MAPS_API_KEY не задан в .env"),
    );
  }

  const existing = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null;
  if (existing) {
    return new Promise((resolve, reject) => {
      const started = Date.now();
      const tick = () => {
        if (window.ymaps) {
          window.ymaps.ready(() => resolve(window.ymaps!));
          return;
        }
        if (Date.now() - started > 15_000) {
          reject(new Error("Таймаут загрузки Яндекс.Карт"));
          return;
        }
        window.setTimeout(tick, 50);
      };
      tick();
    });
  }

  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.id = SCRIPT_ID;
    script.async = true;
    script.src = `https://api-maps.yandex.ru/2.1/?apikey=${encodeURIComponent(key)}&lang=ru_RU`;
    script.onload = () => {
      if (!window.ymaps) {
        reject(new Error("Яндекс.Карты не загрузились"));
        return;
      }
      window.ymaps.ready(() => resolve(window.ymaps!));
    };
    script.onerror = () =>
      reject(new Error("Не удалось загрузить скрипт Яндекс.Карт"));
    document.head.appendChild(script);
  });
};

/** Bounds from one or more polygons; null if empty. */
export const boundsFromPolygons = (
  polygons: Array<Array<[number, number]>>,
): [YMapsCoords, YMapsCoords] | null => {
  let minLat = Infinity;
  let maxLat = -Infinity;
  let minLng = Infinity;
  let maxLng = -Infinity;
  let any = false;
  for (const poly of polygons) {
    for (const point of poly) {
      const lat = point[0];
      const lng = point[1];
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
      any = true;
      minLat = Math.min(minLat, lat);
      maxLat = Math.max(maxLat, lat);
      minLng = Math.min(minLng, lng);
      maxLng = Math.max(maxLng, lng);
    }
  }
  if (!any) return null;
  return [
    [minLat, minLng],
    [maxLat, maxLng],
  ];
};

export const withAlpha = (hex: string, alphaByte: string): string => {
  const clean = hex.replace("#", "").slice(0, 6);
  if (clean.length !== 6) return `#9C6B4A${alphaByte}`;
  return `#${clean}${alphaByte}`;
};
