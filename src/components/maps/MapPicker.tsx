"use client";

import { useEffect, useRef, useState } from "react";
import { MapPickerLoading } from "@/components/maps/MapPickerLoading";
import { reverseGeocodePlaceAction } from "@/actions/geocode";
import {
  configuredDeliveryZones,
  findDeliveryZoneForPoint,
  isPointInDeliveryZone,
} from "@/lib/delivery-pricing";
import { DEFAULT_MAP_CENTER } from "@/lib/pickup-points";
import {
  boundsFromPolygons,
  getYandexMapsApiKey,
  loadYandexMaps,
  withAlpha,
  type YMapsMap,
  type YMapsPlacemark,
  type YMapsPolygon,
} from "@/lib/yandex-maps";
import type { DeliverySettings, DeliveryZone } from "@/types/site";

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
  /** When set, draws zones and rejects points outside coverage. */
  delivery?: DeliverySettings;
  onOutsideZone?: () => void;
  onInsideZone?: (zone: DeliveryZone | null) => void;
};

type MapContext = {
  map: YMapsMap;
  placemark: YMapsPlacemark;
  zoneLayer: YMapsPolygon[];
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
  delivery,
  onOutsideZone,
  onInsideZone,
}: MapPickerProps) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapContext | null>(null);
  const onChangeRef = useRef(onChange);
  const reverseRef = useRef(reverseGeocode);
  const deliveryRef = useRef(delivery);
  const onOutsideRef = useRef(onOutsideZone);
  const onInsideRef = useRef(onInsideZone);
  const geocodeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const geocodeSeqRef = useRef(0);
  const lastValidRef = useRef<{ lat: number; lng: number } | null>(
    lat != null && lng != null ? { lat, lng } : null,
  );
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [zoneError, setZoneError] = useState("");

  onChangeRef.current = onChange;
  reverseRef.current = reverseGeocode;
  deliveryRef.current = delivery;
  onOutsideRef.current = onOutsideZone;
  onInsideRef.current = onInsideZone;

  const hasPoint =
    typeof lat === "number" &&
    typeof lng === "number" &&
    Number.isFinite(lat) &&
    Number.isFinite(lng);

  useEffect(() => {
    if (hasPoint && lat != null && lng != null) {
      lastValidRef.current = { lat, lng };
    }
  }, [hasPoint, lat, lng]);

  const emitChange = (nextLat: number, nextLng: number) => {
    const settings = deliveryRef.current;
    if (settings && configuredDeliveryZones(settings.zones).length > 0) {
      if (!isPointInDeliveryZone(settings, nextLat, nextLng)) {
        setZoneError("В эту зону мы пока не доставляем");
        onOutsideRef.current?.();
        return;
      }
    } else if (settings && !isPointInDeliveryZone(settings, nextLat, nextLng)) {
      setZoneError("В эту зону мы пока не доставляем");
      onOutsideRef.current?.();
      return;
    }

    setZoneError("");
    lastValidRef.current = { lat: nextLat, lng: nextLng };
    const matched = settings
      ? findDeliveryZoneForPoint(settings.zones, nextLat, nextLng)
      : null;
    onInsideRef.current?.(matched);

    if (!reverseRef.current) {
      onChangeRef.current({ lat: nextLat, lng: nextLng });
      return;
    }

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
          const nextLat = round6(coords[0]);
          const nextLng = round6(coords[1]);
          const settings = deliveryRef.current;
          if (
            settings &&
            !isPointInDeliveryZone(settings, nextLat, nextLng)
          ) {
            setZoneError("В эту зону мы пока не доставляем");
            onOutsideRef.current?.();
            return;
          }
          placemark.geometry.setCoordinates(coords);
          void emitChange(nextLat, nextLng);
        });

        placemark.events.add("dragend", () => {
          const coords = placemark.geometry.getCoordinates();
          const nextLat = round6(coords[0]);
          const nextLng = round6(coords[1]);
          const settings = deliveryRef.current;
          if (
            settings &&
            !isPointInDeliveryZone(settings, nextLat, nextLng)
          ) {
            setZoneError("В эту зону мы пока не доставляем");
            onOutsideRef.current?.();
            const prev = lastValidRef.current;
            if (prev) {
              placemark.geometry.setCoordinates([prev.lat, prev.lng]);
            }
            return;
          }
          void emitChange(nextLat, nextLng);
        });

        mapRef.current = { map, placemark, zoneLayer: [] };
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
    if (!ctx || !ready) return;

    for (const poly of ctx.zoneLayer) {
      ctx.map.geoObjects.remove(poly);
    }
    ctx.zoneLayer = [];

    const zones = configuredDeliveryZones(delivery?.zones);
    if (!zones.length || !window.ymaps) return;

    for (const zone of zones) {
      const poly = new window.ymaps.Polygon(
        [zone.polygon.map(([a, b]) => [a, b] as [number, number])],
        { hintContent: `${zone.name}` },
        {
          fillColor: withAlpha(zone.color, "40"),
          strokeColor: zone.color,
          strokeWidth: 2,
          interactivityModel: "default#silent",
        },
      );
      ctx.map.geoObjects.add(poly);
      ctx.zoneLayer.push(poly);
    }

    if (!hasPoint) {
      const bounds = boundsFromPolygons(zones.map((z) => z.polygon));
      if (bounds) {
        ctx.map.setBounds(bounds, { checkZoomRange: true, zoomMargin: 40 });
      }
    }
  }, [delivery?.zones, ready, hasPoint]);

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
      {zoneError ? (
        <p
          className="rounded-xl bg-danger/8 px-3 py-[0.55rem] text-[0.82rem] leading-[1.35] text-danger"
          role="alert"
        >
          {zoneError}
        </p>
      ) : null}
      <p className="text-[0.78rem] leading-[1.35] text-ink/50">
        {resolving ? "Определяем адрес…" : hint}
      </p>
    </div>
  );
};
