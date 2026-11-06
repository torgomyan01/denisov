"use client";

import { useEffect, useRef, useState } from "react";
import { MapPickerLoading } from "@/components/maps/MapPickerLoading";
import type { DeliveryZoneAdmin } from "@/lib/delivery-zones";
import { DEFAULT_MAP_CENTER } from "@/lib/pickup-points";
import {
  boundsFromPolygons,
  getYandexMapsApiKey,
  loadYandexMaps,
  withAlpha,
  type YMapsApi,
  type YMapsCoords,
  type YMapsMap,
  type YMapsPlacemark,
  type YMapsPolygon,
} from "@/lib/yandex-maps";

type DeliveryZoneMapProps = {
  zones: DeliveryZoneAdmin[];
  selectedId: string | null;
  /** Empty polygon draft — drawing mode */
  drawing: boolean;
  draftColor: string;
  onPolygonChange: (polygon: Array<[number, number]>) => void;
  onDrawingFinished: (polygon: Array<[number, number]>) => void;
  heightClassName?: string;
};

const round6 = (n: number): number => Number(n.toFixed(6));

const normalizePair = (pair: unknown): [number, number] | null => {
  if (!Array.isArray(pair) || pair.length < 2) return null;
  const lat = round6(Number(pair[0]));
  const lng = round6(Number(pair[1]));
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return [lat, lng];
};

/** Yandex may nest rings differently during edit — flatten first contour. */
const readRing = (polygon: YMapsPolygon): Array<[number, number]> => {
  const raw = polygon.geometry.getCoordinates() as unknown;
  let ring: unknown[] = [];
  if (Array.isArray(raw) && Array.isArray(raw[0])) {
    const first = raw[0] as unknown[];
    // [[[lat,lng],...]] or [[lat,lng],...]
    if (Array.isArray(first[0])) {
      ring = first;
    } else if (typeof first[0] === "number") {
      ring = raw as unknown[];
    } else {
      ring = first;
    }
  }

  const points: Array<[number, number]> = [];
  for (const pair of ring) {
    const point = normalizePair(pair);
    if (point) points.push(point);
  }
  if (points.length >= 2) {
    const first = points[0]!;
    const last = points[points.length - 1]!;
    if (first[0] === last[0] && first[1] === last[1]) points.pop();
  }
  return points;
};

const makePolygon = (
  ymaps: YMapsApi,
  ring: Array<[number, number]>,
  color: string,
  interactive: boolean,
): YMapsPolygon =>
  new ymaps.Polygon(
    [ring.map(([lat, lng]) => [lat, lng] as YMapsCoords)],
    {},
    {
      fillColor: withAlpha(color, interactive ? "55" : "33"),
      strokeColor: color,
      strokeWidth: interactive ? 3 : 2,
      opacity: 1,
      editorDrawingCursor: "crosshair",
      editorMaxPoints: 64,
      interactivityModel: interactive ? "default#opaque" : "default#silent",
    },
  );

export const DeliveryZoneMap = ({
  zones,
  selectedId,
  drawing,
  draftColor,
  onPolygonChange,
  onDrawingFinished,
  heightClassName = "h-[min(62vh,560px)]",
}: DeliveryZoneMapProps) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<YMapsMap | null>(null);
  const ymapsRef = useRef<YMapsApi | null>(null);
  const layerRef = useRef<YMapsPolygon[]>([]);
  const draftPolyRef = useRef<YMapsPolygon | null>(null);
  const draftDotsRef = useRef<YMapsPlacemark[]>([]);
  const draftPointsRef = useRef<Array<[number, number]>>([]);
  const selectedRef = useRef<YMapsPolygon | null>(null);
  const clickHandlerRef = useRef<((e: { get: (key: string) => YMapsCoords }) => void) | null>(
    null,
  );
  const onPolygonChangeRef = useRef(onPolygonChange);
  const onDrawingFinishedRef = useRef(onDrawingFinished);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draftCount, setDraftCount] = useState(0);

  onPolygonChangeRef.current = onPolygonChange;
  onDrawingFinishedRef.current = onDrawingFinished;

  const clearDraftGraphics = (map: YMapsMap) => {
    if (draftPolyRef.current) {
      map.geoObjects.remove(draftPolyRef.current);
      draftPolyRef.current = null;
    }
    for (const dot of draftDotsRef.current) {
      map.geoObjects.remove(dot);
    }
    draftDotsRef.current = [];
  };

  const paintDraft = (ymaps: YMapsApi, map: YMapsMap, color: string) => {
    clearDraftGraphics(map);
    const points = draftPointsRef.current;

    for (const [lat, lng] of points) {
      const dot = new ymaps.Placemark(
        [lat, lng],
        {},
        { preset: "islands#circleIcon", iconColor: color },
      );
      map.geoObjects.add(dot);
      draftDotsRef.current.push(dot);
    }

    if (points.length >= 2) {
      const poly = makePolygon(ymaps, points, color, false);
      map.geoObjects.add(poly);
      draftPolyRef.current = poly;
    }
  };

  const finishDraft = () => {
    const ring = draftPointsRef.current.slice();
    if (ring.length < 3) return false;
    onPolygonChangeRef.current(ring);
    onDrawingFinishedRef.current(ring);
    return true;
  };

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    if (!getYandexMapsApiKey()) {
      setError(
        "Добавьте NEXT_PUBLIC_YANDEX_MAPS_API_KEY в .env (JavaScript API).",
      );
      return;
    }

    let cancelled = false;
    void loadYandexMaps()
      .then((ymaps) => {
        if (cancelled || !containerRef.current) return;
        ymapsRef.current = ymaps;
        const map = new ymaps.Map(
          containerRef.current,
          {
            center: [DEFAULT_MAP_CENTER.lat, DEFAULT_MAP_CENTER.lng],
            zoom: 12,
            controls: ["zoomControl", "geolocationControl", "typeSelector"],
          },
          { suppressMapOpenBlock: true },
        );
        mapRef.current = map;
        setReady(true);
        setError(null);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Ошибка Яндекс.Карт");
      });

    return () => {
      cancelled = true;
      draftPolyRef.current = null;
      draftDotsRef.current = [];
      draftPointsRef.current = [];
      selectedRef.current = null;
      layerRef.current = [];
      clickHandlerRef.current = null;
      mapRef.current?.destroy();
      mapRef.current = null;
      ymapsRef.current = null;
      setReady(false);
    };
  }, []);

  // Render static zones + selected editable polygon
  useEffect(() => {
    const map = mapRef.current;
    const ymaps = ymapsRef.current;
    if (!map || !ymaps || !ready || drawing) return;

    clearDraftGraphics(map);
    for (const poly of layerRef.current) {
      map.geoObjects.remove(poly);
    }
    layerRef.current = [];
    selectedRef.current = null;

    const selected = zones.find((z) => z.id === selectedId) ?? null;

    for (const zone of zones) {
      if (zone.polygon.length < 3) continue;
      if (selected && zone.id === selected.id) continue;
      const poly = makePolygon(ymaps, zone.polygon, zone.color, false);
      map.geoObjects.add(poly);
      layerRef.current.push(poly);
    }

    if (selected && selected.polygon.length >= 3) {
      const editable = makePolygon(
        ymaps,
        selected.polygon,
        selected.color,
        true,
      );
      map.geoObjects.add(editable);
      layerRef.current.push(editable);
      selectedRef.current = editable;
      editable.editor.startEditing();
      const sync = () => {
        onPolygonChangeRef.current(readRing(editable));
      };
      editable.editor.events.add("vertexadd", sync);
      editable.editor.events.add("vertexdragend", sync);
      editable.editor.events.add("vertexremove", sync);
      editable.events.add("geometrychange", sync);
    }

    const bounds = boundsFromPolygons(
      zones.filter((z) => z.polygon.length >= 3).map((z) => z.polygon),
    );
    if (bounds) {
      map.setBounds(bounds, { checkZoomRange: true, zoomMargin: 48 });
    }
  }, [zones, selectedId, ready, drawing]);

  // Manual click-to-draw (reliable vs Yandex editor drawingstop)
  useEffect(() => {
    const map = mapRef.current;
    const ymaps = ymapsRef.current;
    if (!map || !ymaps || !ready) return;

    if (clickHandlerRef.current) {
      try {
        map.events.remove("click", clickHandlerRef.current);
      } catch {
        /* ignore */
      }
      clickHandlerRef.current = null;
    }

    if (!drawing) {
      draftPointsRef.current = [];
      setDraftCount(0);
      clearDraftGraphics(map);
      return;
    }

    for (const poly of layerRef.current) {
      map.geoObjects.remove(poly);
    }
    layerRef.current = [];
    selectedRef.current = null;

    for (const zone of zones) {
      if (zone.polygon.length < 3) continue;
      const poly = makePolygon(ymaps, zone.polygon, zone.color, false);
      map.geoObjects.add(poly);
      layerRef.current.push(poly);
    }

    draftPointsRef.current = [];
    setDraftCount(0);
    paintDraft(ymaps, map, draftColor);

    let lastClickAt = 0;
    const onClick = (e: { get: (key: string) => YMapsCoords }) => {
      const now = Date.now();
      const isDouble = now - lastClickAt < 350;
      lastClickAt = now;

      if (isDouble) {
        if (draftPointsRef.current.length >= 3) {
          finishDraft();
        }
        return;
      }

      const coords = e.get("coords");
      const point = normalizePair(coords);
      if (!point) return;
      draftPointsRef.current = [...draftPointsRef.current, point];
      setDraftCount(draftPointsRef.current.length);
      onPolygonChangeRef.current(draftPointsRef.current.slice());
      paintDraft(ymaps, map, draftColor);
    };

    clickHandlerRef.current = onClick;
    map.events.add("click", onClick);

    return () => {
      try {
        map.events.remove("click", onClick);
      } catch {
        /* ignore */
      }
      if (clickHandlerRef.current === onClick) {
        clickHandlerRef.current = null;
      }
      clearDraftGraphics(map);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drawing, draftColor, ready]);

  return (
    <div className="flex flex-col gap-2">
      {error ? (
        <MapPickerLoading heightClassName={heightClassName} isError>
          {error}
        </MapPickerLoading>
      ) : (
        <>
          {!ready ? (
            <MapPickerLoading heightClassName={heightClassName}>
              Загрузка Яндекс.Карты…
            </MapPickerLoading>
          ) : null}
          <div
            ref={containerRef}
            className={`z-0 w-full overflow-hidden rounded-[16px] border border-ink/10 ${heightClassName}`}
            style={{ display: ready ? "block" : "none" }}
          />
        </>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <p className="m-0 flex-1 text-[0.78rem] leading-[1.4] text-ink/50">
          {drawing
            ? `Кликайте по карте — ставятся вершины (${draftCount}). Двойной клик или кнопка «Готово» — завершить (нужно ≥ 3).`
            : selectedId
              ? "Тяните вершины выбранной зоны, чтобы поправить границы."
              : "Выберите зону слева или нажмите «Новая зона»."}
        </p>
        {drawing ? (
          <>
            <button
              type="button"
              className="cursor-pointer rounded-full border border-ink/12 bg-white/80 px-3 py-1.5 text-[10px] font-semibold tracking-[0.12em] text-ink uppercase hover:border-clay hover:text-clay disabled:opacity-45"
              disabled={draftCount < 1}
              onClick={() => {
                const map = mapRef.current;
                const ymaps = ymapsRef.current;
                if (!map || !ymaps) return;
                draftPointsRef.current = draftPointsRef.current.slice(0, -1);
                setDraftCount(draftPointsRef.current.length);
                onPolygonChangeRef.current(draftPointsRef.current.slice());
                paintDraft(ymaps, map, draftColor);
              }}
            >
              Undo
            </button>
            <button
              type="button"
              className="cursor-pointer rounded-full border-0 bg-ink px-3 py-1.5 text-[10px] font-semibold tracking-[0.12em] text-paper uppercase hover:bg-clay disabled:opacity-45"
              disabled={draftCount < 3}
              onClick={() => {
                if (!finishDraft()) return;
              }}
            >
              Готово · {draftCount} т.
            </button>
          </>
        ) : null}
      </div>
    </div>
  );
};
