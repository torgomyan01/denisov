"use client";

import { useEffect, useRef, useState } from "react";
import { MapPickerLoading } from "@/components/maps/MapPickerLoading";
import { DEFAULT_MAP_CENTER } from "@/lib/pickup-points";
import { reverseGeocodePlaceAction } from "@/actions/geocode";
import {
  getYandexMapsApiKey,
  loadYandexMaps,
  type YMapsMap,
  type YMapsPlacemark,
} from "@/lib/yandex-maps";

export type MapPickerChange = {
  lat: number;
  lng: number;
  /** Pretty street/building label for UI */
  address?: string;
  /** Full geocoder line (optional, for DB/logistics) */
  fullAddress?: string;
};

type MapPickerProps = {
  lat: number | null;
  lng: number | null;
  onChange: (coords: MapPickerChange) => void;
  className?: string;
  /** Resolve street/building label via Nominatim (server). */
  reverseGeocode?: boolean;
  compact?: boolean;
  /** Overrides the default map/placeholder height (e.g. `h-[min(52vh,420px)]`). */
  heightClassName?: string;
  hint?: string;
};

type MapContext = {
  map: YMapsMap;
  placemark: YMapsPlacemark;
};

const round6 = (n: number): number => Number(n.toFixed(6));
const GEOCODE_DEBOUNCE_MS = 450;

export const MapPicker = ({
  lat,
  lng,
  onChange,
  className = "",
  reverseGeocode = false,
  compact = false,
  heightClassName,
  hint = "Кликните по карте или перетащите маркер, чтобы задать координаты (Яндекс.Карты).",
}: MapPickerProps) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapContext | null>(null);
  const onChangeRef = useRef(onChange);
  const reverseRef = useRef(reverseGeocode);
  const geocodeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const geocodeSeqRef = useRef(0);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [resolving, setResolving] = useState(false);

  onChangeRef.current = onChange;
  reverseRef.current = reverseGeocode;

  const hasPoint =
    typeof lat === "number" &&
    typeof lng === "number" &&
    Number.isFinite(lat) &&
    Number.isFinite(lng);

  const emitChange = (nextLat: number, nextLng: number) => {
    if (!reverseRef.current) {
      onChangeRef.current({ lat: nextLat, lng: nextLng });
      return;
    }

    // Immediate coords; address resolves shortly (Nominatim, not Yandex Geocoder).
    onChangeRef.current({ lat: nextLat, lng: nextLng });
    setResolving(true);

    if (geocodeTimerRef.current) clearTimeout(geocodeTimerRef.current);
    const seq = ++geocodeSeqRef.current;

    geocodeTimerRef.current = setTimeout(() => {
      void (async () => {
        try {
          const result = await reverseGeocodePlaceAction(nextLat, nextLng);
          if (seq !== geocodeSeqRef.current) return;
          onChangeRef.current({
            lat: nextLat,
            lng: nextLng,
            address: result.success ? result.data?.label : undefined,
            fullAddress: result.success ? result.data?.fullAddress : undefined,
          });
        } catch {
          if (seq !== geocodeSeqRef.current) return;
          onChangeRef.current({ lat: nextLat, lng: nextLng });
        } finally {
          if (seq === geocodeSeqRef.current) setResolving(false);
        }
      })();
    }, GEOCODE_DEBOUNCE_MS);
  };

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    if (!getYandexMapsApiKey()) {
      setError(
        "Добавьте NEXT_PUBLIC_YANDEX_MAPS_API_KEY в .env (ключ JavaScript API с developer.tech.yandex.ru).",
      );
      return;
    }

    let cancelled = false;

    void loadYandexMaps()
      .then((ymaps) => {
        if (cancelled || !containerRef.current) return;

        const centerLat = hasPoint ? lat! : DEFAULT_MAP_CENTER.lat;
        const centerLng = hasPoint ? lng! : DEFAULT_MAP_CENTER.lng;

        const map = new ymaps.Map(containerRef.current, {
          center: [centerLat, centerLng],
          zoom: hasPoint ? 16 : 12,
          controls: ["zoomControl", "geolocationControl"],
        });

        const placemark = new ymaps.Placemark(
          [centerLat, centerLng],
          {},
          {
            draggable: true,
            preset: "islands#brownDotIcon",
          },
        );
        map.geoObjects.add(placemark);

        map.events.add("click", (e) => {
          const coords = e.get("coords");
          placemark.geometry.setCoordinates(coords);
          void emitChange(round6(coords[0]), round6(coords[1]));
        });

        placemark.events.add("dragend", () => {
          const coords = placemark.geometry.getCoordinates();
          void emitChange(round6(coords[0]), round6(coords[1]));
        });

        mapRef.current = { map, placemark };
        setReady(true);
        setError(null);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const message =
          err instanceof Error ? err.message : "Ошибка загрузки Яндекс.Карт";
        setError(message);
      });

    return () => {
      cancelled = true;
      if (geocodeTimerRef.current) clearTimeout(geocodeTimerRef.current);
      geocodeSeqRef.current += 1;
      mapRef.current?.map.destroy();
      mapRef.current = null;
      setReady(false);
    };
    // Init once on mount — coordinate sync is handled below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const ctx = mapRef.current;
    if (!ctx || !hasPoint || lat == null || lng == null) return;
    const current = ctx.placemark.geometry.getCoordinates();
    if (
      Math.abs(current[0] - lat) < 1e-7 &&
      Math.abs(current[1] - lng) < 1e-7
    ) {
      return;
    }
    ctx.placemark.geometry.setCoordinates([lat, lng]);
    ctx.map.setCenter([lat, lng], undefined, { duration: 200 });
  }, [lat, lng, hasPoint]);

  const heightClass =
    heightClassName ?? (compact ? "h-[200px]" : "h-[280px]");

  return (
    <div className={`flex flex-col gap-[0.45rem] ${className}`.trim()}>
      {error ? (
        <MapPickerLoading heightClassName={heightClass} isError>
          {error}
        </MapPickerLoading>
      ) : (
        <>
          {!ready ? (
            <MapPickerLoading heightClassName={heightClass}>
              Загрузка Яндекс.Карты…
            </MapPickerLoading>
          ) : null}
          <div
            ref={containerRef}
            className={`z-0 w-full overflow-hidden rounded-[14px] border border-[rgba(28,24,20,0.1)] ${heightClass}`}
            style={{ display: ready ? "block" : "none" }}
          />
        </>
      )}
      <p className="text-[0.78rem] leading-[1.35] text-ink/50">
        {resolving ? "Определяем адрес…" : hint}
      </p>
    </div>
  );
};
