/** Client-side Yandex Maps JS API 2.1 loader. */

export type YMapsCoords = [number, number]; // [lat, lng]

export type YMapsPlacemark = {
  geometry: {
    getCoordinates: () => YMapsCoords;
    setCoordinates: (coords: YMapsCoords) => void;
  };
  events: {
    add: (name: string, handler: () => void) => void;
  };
};

export type YMapsMap = {
  destroy: () => void;
  setCenter: (coords: YMapsCoords, zoom?: number, opts?: { duration?: number }) => void;
  geoObjects: {
    add: (obj: YMapsPlacemark) => void;
    removeAll: () => void;
  };
  events: {
    add: (
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
  ) => YMapsMap;
  Placemark: new (
    coords: YMapsCoords,
    properties?: Record<string, unknown>,
    options?: { draggable?: boolean; preset?: string },
  ) => YMapsPlacemark;
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

