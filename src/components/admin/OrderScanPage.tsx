"use client";

import { OrderDeliveryMapModal } from "@/components/admin/OrderDeliveryMapModal";
import { btnDark, btnLine, orderBadgeClass } from "@/components/admin/styles";
import {
  Camera,
  CheckCircle2,
  MapPin,
  Phone,
  QrCode,
  X,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  lookupOrderByFulfillmentTokenAction,
  verifyOrderFulfillmentAction,
} from "@/actions/orders";
import {
  ORDER_STATUS_LABELS,
  canFulfillOrderByQr,
  parseFulfillmentQrPayload,
  type OrderPublic,
} from "@/lib/orders";
import { formatPhoneDisplay } from "@/lib/phone";

type BarcodeDetectorLike = {
  detect: (source: ImageBitmapSource) => Promise<Array<{ rawValue: string }>>;
};

type BarcodeDetectorCtor = new (options?: {
  formats?: string[];
}) => BarcodeDetectorLike;

const getBarcodeDetector = (): BarcodeDetectorCtor | null => {
  if (typeof window === "undefined") return null;
  return (
    (window as Window & { BarcodeDetector?: BarcodeDetectorCtor })
      .BarcodeDetector ?? null
  );
};

const formatWhen = (iso: string): string => {
  try {
    return new Date(iso).toLocaleString("ru-RU", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
};

const bumpOrders = () => {
  try {
    window.localStorage.setItem(
      "denisov_admin_orders_bump",
      String(Date.now()),
    );
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new Event("denisov-orders-changed"));
};

interface OrderScanPanelProps {
  busy?: boolean;
  onOrdersChanged?: () => void;
  /** Admin panel vs courier personal cabinet. */
  variant?: "admin" | "courier";
}

export const OrderScanPanel = ({
  busy = false,
  onOrdersChanged,
  variant = "admin",
}: OrderScanPanelProps) => {
  const [tokenInput, setTokenInput] = useState("");
  const [scannedToken, setScannedToken] = useState("");
  const [order, setOrder] = useState<OrderPublic | null>(null);
  const [lookupBusy, setLookupBusy] = useState(false);
  const [confirmBusy, setConfirmBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraNote, setCameraNote] = useState("");
  const [deliveryMapOpen, setDeliveryMapOpen] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanningRef = useRef(false);
  const lastScanRef = useRef("");

  const stopCamera = useCallback(() => {
    scanningRef.current = false;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraOpen(false);
  }, []);

  useEffect(() => () => stopCamera(), [stopCamera]);

  const resetToScan = () => {
    setOrder(null);
    setScannedToken("");
    setTokenInput("");
    setError("");
    setDone(false);
    setDeliveryMapOpen(false);
    lastScanRef.current = "";
  };

  const lookupToken = useCallback(
    async (raw: string) => {
      const token =
        parseFulfillmentQrPayload(raw) ??
        raw.trim().toUpperCase().replace(/[\s·._-]+/g, "");
      if (!token || lookupBusy || confirmBusy || busy) return;

      setLookupBusy(true);
      setError("");
      setDone(false);
      const result = await lookupOrderByFulfillmentTokenAction({ token });
      setLookupBusy(false);

      if (!result.success || !result.data) {
        setOrder(null);
        setScannedToken("");
        setError(result.success ? "Заказ не найден" : result.error);
        return;
      }

      setScannedToken(token);
      setOrder(result.data);
      setTokenInput("");
      stopCamera();
    },
    [lookupBusy, confirmBusy, busy, stopCamera],
  );

  const startCamera = async () => {
    setCameraNote("");
    setError("");
    const Detector = getBarcodeDetector();
    if (!Detector) {
      setCameraNote(
        "Сканер камеры недоступен в этом браузере — введите код вручную.",
      );
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
        audio: false,
      });
      streamRef.current = stream;
      setCameraOpen(true);
      scanningRef.current = true;
      window.requestAnimationFrame(() => {
        const video = videoRef.current;
        if (!video) return;
        video.srcObject = stream;
        void video.play();
      });

      const detector = new Detector({ formats: ["qr_code"] });
      const tick = async () => {
        if (!scanningRef.current) return;
        const video = videoRef.current;
        if (video && video.readyState >= 2) {
          try {
            const codes = await detector.detect(video);
            const raw = codes[0]?.rawValue?.trim() ?? "";
            if (raw && raw !== lastScanRef.current) {
              lastScanRef.current = raw;
              await lookupToken(raw);
              return;
            }
          } catch {
            /* keep scanning */
          }
        }
        window.setTimeout(() => void tick(), 350);
      };
      void tick();
    } catch {
      setCameraNote(
        "Не удалось открыть камеру. Разрешите доступ или введите код.",
      );
      stopCamera();
    }
  };

  const confirmHandover = async () => {
    if (!order || !scannedToken || confirmBusy || busy) return;
    setConfirmBusy(true);
    setError("");
    const result = await verifyOrderFulfillmentAction({ token: scannedToken });
    setConfirmBusy(false);
    if (!result.success || !result.data) {
      setError(result.success ? "Ошибка выдачи" : result.error);
      return;
    }
    setOrder(result.data);
    setDone(true);
    bumpOrders();
    onOrdersChanged?.();
  };

  const canConfirm =
    order &&
    !done &&
    canFulfillOrderByQr(order.status, order.fulfillmentMode);

  const actionsLocked = lookupBusy || confirmBusy || busy;
  const hasDeliveryPoint =
    order != null &&
    order.deliveryLat != null &&
    order.deliveryLng != null;
  const deliveryLat = order?.deliveryLat ?? null;
  const deliveryLng = order?.deliveryLng ?? null;

  return (
    <>
    <section className="animate-panel-in rounded-3xl border border-ink/12 bg-white/78 px-[1.35rem] pt-[1.35rem] pb-6 shadow-[0_14px_40px_rgba(33,30,25,0.045)] backdrop-blur-[10px] md:px-[1.85rem] md:pt-7 md:pb-[1.9rem]">
      <div className="mb-[1.1rem]">
        <h2 className="m-0 font-serif text-[clamp(1.55rem,2.4vw,1.95rem)] leading-[1.15] tracking-[0.02em]">
          {variant === "courier" ? "Выдача клиенту" : "Передача заказа"}
        </h2>
        <p className="mt-[0.4rem] max-w-[42rem] text-[0.92rem] leading-normal text-ink/48">
          {variant === "courier"
            ? "Отсканируйте QR на заказе, проверьте адрес и подтвердите передачу клиенту"
            : "Отсканируйте QR клиента, проверьте заказ и подтвердите выдачу"}
        </p>
      </div>

      <hr className="mb-5 h-px border-0 bg-[linear-gradient(90deg,transparent,rgba(156,107,74,0.45),transparent)]" />

      {!order ? (
        <div>
          <div className="mb-[0.85rem] flex items-start gap-3">
            <QrCode size={18} strokeWidth={2} aria-hidden="true" className="mt-[0.15rem] text-clay" />
            <div>
              <h3 className="m-0 text-base font-semibold tracking-[0.01em]">
                Сканирование
              </h3>
              <p className="mt-1 text-[0.88rem] leading-[1.4] text-ink/60">
                Камера или ручной ввод кода с QR клиента
              </p>
            </div>
          </div>

          <form
            className="flex flex-wrap gap-2 [&_input]:h-[2.6rem] [&_input]:min-w-0 [&_input]:flex-[1_1_180px] [&_input]:rounded-[10px] [&_input]:border [&_input]:border-ink/14 [&_input]:bg-white [&_input]:px-[0.85rem]"
            onSubmit={(e) => {
              e.preventDefault();
              void lookupToken(tokenInput);
            }}
          >
            <input
              type="text"
              value={tokenInput}
              onChange={(e) => setTokenInput(e.target.value)}
              placeholder="Код из QR или DN1.…"
              autoComplete="off"
              spellCheck={false}
              disabled={actionsLocked}
            />
            <button
              type="submit"
              className={btnDark}
              disabled={actionsLocked || !tokenInput.trim()}
            >
              {lookupBusy ? "Ищем…" : "Найти"}
            </button>
            <button
              type="button"
              className={btnLine}
              disabled={actionsLocked}
              onClick={() => void startCamera()}
            >
              <Camera size={15} strokeWidth={2} aria-hidden="true" />
              Камера
            </button>
          </form>

          {cameraNote ? (
            <p className="mt-[0.65rem] text-[0.88rem]">{cameraNote}</p>
          ) : null}
          {error ? (
            <p className="mt-[0.65rem] text-[0.88rem] text-[#9b3d2e]" role="alert">
              {error}
            </p>
          ) : null}

          {cameraOpen ? (
            <div className="relative mt-[0.85rem] aspect-[3/4] max-h-[360px] overflow-hidden rounded-[14px] bg-[#111] [&_video]:block [&_video]:size-full [&_video]:object-cover">
              <video ref={videoRef} playsInline muted />
              <button
                type="button"
                className="absolute top-[0.65rem] right-[0.65rem] grid size-[2.1rem] cursor-pointer place-items-center rounded-full bg-black/55 text-white"
                aria-label="Закрыть камеру"
                onClick={stopCamera}
              >
                <X size={16} strokeWidth={2} aria-hidden="true" />
              </button>
            </div>
          ) : null}
        </div>
      ) : done ? (
        <div className="flex flex-col items-center gap-[0.35rem] py-[1.35rem] text-center text-[#3f6b4a]">
          <CheckCircle2 size={36} strokeWidth={1.75} aria-hidden="true" />
          <h3 className="m-0 mt-[0.35rem] font-serif text-[1.45rem] text-ink">
            Заказ выдан
          </h3>
          <p className="m-0 text-[0.92rem] text-ink/60">
            {order.number} · {order.customerName || "Клиент"} · {order.totalRub}{" "}
            ₽
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-[0.55rem]">
            <button
              type="button"
              className={btnDark}
              onClick={resetToScan}
            >
              Следующий QR
            </button>
            {variant === "admin" ? (
              <Link href={`/admin#order/${order.id}`} className={btnLine}>
                Открыть заказ
              </Link>
            ) : null}
          </div>
        </div>
      ) : (
        <div>
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <p className="m-0 text-[0.72rem] uppercase tracking-[0.12em] text-ink/55">
                Найден заказ
              </p>
              <h3 className="mt-[0.2rem] font-serif text-[clamp(1.6rem,2.6vw,2rem)] leading-[1.05]">
                {order.number}
              </h3>
              <p className="mt-[0.35rem] text-[0.9rem] text-ink/48">
                {ORDER_STATUS_LABELS[order.status]} ·{" "}
                {order.fulfillmentMode === "delivery"
                  ? "Доставка"
                  : "Самовывоз"}
              </p>
            </div>
            <span className={orderBadgeClass(order.status)}>
              {ORDER_STATUS_LABELS[order.status]}
            </span>
          </div>

          <div className="mb-4 flex flex-col gap-[0.35rem] border-b border-dashed border-ink/12 pb-[0.85rem]">
            <p className="font-sans text-[1.05rem] font-[650] leading-[1.3] text-ink">
              {order.customerName || "—"}
            </p>
            <p className="m-0 flex items-center gap-[0.4rem] text-[0.92rem]">
              <Phone size={15} strokeWidth={2} aria-hidden="true" />
              {order.customerPhone
                ? formatPhoneDisplay(order.customerPhone)
                : "—"}
            </p>
            {order.fulfillmentMode === "pickup" ? (
              <>
                <p className="m-0 flex items-center gap-[0.4rem] text-[0.92rem]">
                  <MapPin size={15} strokeWidth={2} aria-hidden="true" />
                  {order.pickupPointName || "Точка самовывоза"}
                </p>
                {order.pickupPointAddress ? (
                  <p className="m-0 text-[0.88rem] text-ink/60">
                    {order.pickupPointAddress}
                  </p>
                ) : null}
              </>
            ) : (
              <>
                <p className="m-0 flex items-start gap-[0.4rem] text-[0.92rem]">
                  <MapPin
                    size={15}
                    strokeWidth={2}
                    aria-hidden="true"
                    className="mt-[0.15rem] shrink-0"
                  />
                  <span>
                    {order.deliveryAddress || "Адрес выбран на карте клиентом"}
                    {(order.deliveryApartment ||
                      order.deliveryEntrance ||
                      order.deliveryFloor ||
                      order.deliveryIntercom) && (
                      <>
                        <br />
                        {[
                          order.deliveryApartment
                            ? `кв. ${order.deliveryApartment}`
                            : null,
                          order.deliveryEntrance
                            ? `подъезд ${order.deliveryEntrance}`
                            : null,
                          order.deliveryFloor
                            ? `этаж ${order.deliveryFloor}`
                            : null,
                          order.deliveryIntercom
                            ? `домофон ${order.deliveryIntercom}`
                            : null,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </>
                    )}
                    {order.deliveryCourierComment ? (
                      <>
                        <br />
                        Курьеру: {order.deliveryCourierComment}
                      </>
                    ) : null}
                  </span>
                </p>
                {hasDeliveryPoint ? (
                  <button
                    type="button"
                    className={`${btnLine} mt-[0.25rem] w-fit`}
                    onClick={() => setDeliveryMapOpen(true)}
                  >
                    <MapPin size={15} strokeWidth={2} aria-hidden="true" />
                    Об адресе заказа
                  </button>
                ) : (
                  <p className="m-0 text-[0.85rem] text-ink/55">
                    Координаты не указаны
                  </p>
                )}
              </>
            )}
            <p className="mt-1 text-[0.85rem] text-ink/55">
              Создан {formatWhen(order.createdAt)}
            </p>
          </div>

          <ul className="m-0 flex flex-col gap-[0.65rem] p-0">
            {order.items.map((item) => (
              <li
                key={item.id}
                className="grid grid-cols-[72px_minmax(0,1fr)] items-center gap-[0.85rem] border-b border-ink/6 py-[0.55rem] last:border-b-0 max-[560px]:grid-cols-[56px_minmax(0,1fr)]"
              >
                <div className="grid size-[72px] place-items-center overflow-hidden rounded-xl bg-ink/5 text-[0.7rem] text-ink/40 max-[560px]:size-14 [&_img]:block [&_img]:size-full [&_img]:object-cover">
                  {item.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={item.image} alt="" />
                  ) : (
                    <span>Нет фото</span>
                  )}
                </div>
                <div className="flex min-w-0 flex-col gap-[0.15rem]">
                  <strong className="text-base">{item.name}</strong>
                  <span className="text-[0.85rem] text-ink/65">
                    {item.qty} шт. · {item.lineTotalRub} ₽
                  </span>
                </div>
              </li>
            ))}
          </ul>

          <div className="mt-3 flex items-baseline justify-between border-t border-dashed border-ink/14 pt-3">
            <span>Итого</span>
            <strong className="font-serif text-[1.5rem]">{order.totalRub} ₽</strong>
          </div>

          {!canConfirm ? (
            <p className="mt-[0.65rem] text-[0.88rem] text-[#9b3d2e]" role="status">
              {order.status === "cancelled"
                ? "Заказ отменён — выдача невозможна"
                : order.status === "completed"
                  ? "Этот заказ уже выдан"
                  : order.fulfillmentMode === "pickup"
                    ? "Заказ ещё не готов к выдаче"
                    : "Заказ ещё не готов к передаче"}
            </p>
          ) : null}

          {error ? (
            <p className="mt-[0.65rem] text-[0.88rem] text-[#9b3d2e]" role="alert">
              {error}
            </p>
          ) : null}

          <div className="mt-4 flex flex-wrap gap-[0.55rem]">
            {canConfirm ? (
              <button
                type="button"
                className={btnDark}
                disabled={actionsLocked}
                onClick={() => void confirmHandover()}
              >
                {confirmBusy ? "Подтверждаем…" : "Подтвердить выдачу"}
              </button>
            ) : null}
            <button
              type="button"
              className={btnLine}
              disabled={actionsLocked}
              onClick={resetToScan}
            >
              Сканировать другой
            </button>
          </div>
        </div>
      )}
    </section>
    {hasDeliveryPoint && deliveryLat != null && deliveryLng != null ? (
      <OrderDeliveryMapModal
        open={deliveryMapOpen}
        lat={deliveryLat}
        lng={deliveryLng}
        customerName={order?.customerName}
        onClose={() => setDeliveryMapOpen(false)}
      />
    ) : null}
    </>
  );
};
