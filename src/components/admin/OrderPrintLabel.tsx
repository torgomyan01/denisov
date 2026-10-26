"use client";

import { btnDark, btnLine } from "@/components/admin/styles";
import { ChevronDown, Download, Printer, Tag } from "lucide-react";
import QRCode from "qrcode";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  encodeFulfillmentQrPayload,
  type OrderPublic,
} from "@/lib/orders";

type OrderPrintLabelProps = {
  order: OrderPublic;
};

const LABEL_W = 320;
const LABEL_H = 440;
const QR_SIZE = 180;

const formatTokenChunks = (token: string): string => {
  const t = token.replace(/\s/g, "").toUpperCase();
  const parts: string[] = [];
  for (let i = 0; i < t.length; i += 4) parts.push(t.slice(i, i + 4));
  return parts.join(" · ");
};

const wrapText = (
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
): string[] => {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];
  const lines: string[] = [];
  let line = words[0] ?? "";
  for (let i = 1; i < words.length; i += 1) {
    const word = words[i] ?? "";
    const next = `${line} ${word}`;
    if (ctx.measureText(next).width <= maxWidth) {
      line = next;
    } else {
      lines.push(line);
      line = word;
    }
  }
  lines.push(line);
  return lines;
};

export const OrderPrintLabel = ({ order }: OrderPrintLabelProps) => {
  const previewRef = useRef<HTMLCanvasElement | null>(null);
  const [open, setOpen] = useState(false);
  const [qrUrl, setQrUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const doorBits = [
    order.deliveryApartment ? `кв. ${order.deliveryApartment}` : null,
    order.deliveryEntrance ? `под. ${order.deliveryEntrance}` : null,
    order.deliveryFloor ? `эт. ${order.deliveryFloor}` : null,
  ].filter(Boolean);
  const destination =
    order.fulfillmentMode === "pickup"
      ? order.pickupPointName || "Самовывоз"
      : [
          (order.deliveryAddress || "").trim() || "Адрес на карте",
          ...doorBits,
        ]
          .filter(Boolean)
          .join(", ");

  const modeLabel =
    order.fulfillmentMode === "delivery" ? "Доставка" : "Самовывоз";

  const drawLabel = useCallback(
    async (target: HTMLCanvasElement, qrDataUrl: string) => {
      await document.fonts.ready;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      target.width = Math.round(LABEL_W * dpr);
      target.height = Math.round(LABEL_H * dpr);
      target.style.width = `${LABEL_W}px`;
      target.style.height = `${LABEL_H}px`;

      const ctx = target.getContext("2d");
      if (!ctx) throw new Error("Canvas недоступен");
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, LABEL_W, LABEL_H);

      ctx.strokeStyle = "rgba(156, 107, 74, 0.35)";
      ctx.lineWidth = 1.5;
      ctx.strokeRect(8, 8, LABEL_W - 16, LABEL_H - 16);

      ctx.fillStyle = "#211e19";
      ctx.font = "700 26px 'EB Garamond', Georgia, serif";
      ctx.textAlign = "center";
      ctx.fillText("ДЕНИСОВ", LABEL_W / 2, 40);

      ctx.fillStyle = "#9c6b4a";
      ctx.font = "650 10px 'Ysabeau', system-ui, sans-serif";
      ctx.fillText("К А Ф Е", LABEL_W / 2, 58);

      const qrPad = 10;
      const qrBox = QR_SIZE + qrPad * 2;
      const qrX = (LABEL_W - qrBox) / 2;
      const qrY = 70;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(qrX, qrY, qrBox, qrBox);
      ctx.strokeStyle = "rgba(33, 30, 25, 0.1)";
      ctx.lineWidth = 1;
      ctx.strokeRect(qrX, qrY, qrBox, qrBox);

      const qrImg = new Image();
      await new Promise<void>((resolve, reject) => {
        qrImg.onload = () => resolve();
        qrImg.onerror = () => reject(new Error("Не удалось загрузить QR"));
        qrImg.src = qrDataUrl;
      });
      ctx.drawImage(qrImg, qrX + qrPad, qrY + qrPad, QR_SIZE, QR_SIZE);

      let y = qrY + qrBox + 22;
      ctx.fillStyle = "#9c6b4a";
      ctx.font = "650 11px ui-monospace, SFMono-Regular, Menlo, monospace";
      ctx.fillText(formatTokenChunks(order.fulfillmentToken), LABEL_W / 2, y);

      y += 16;
      ctx.strokeStyle = "rgba(156, 107, 74, 0.3)";
      ctx.beginPath();
      ctx.moveTo(36, y);
      ctx.lineTo(LABEL_W - 36, y);
      ctx.stroke();

      y += 26;
      ctx.fillStyle = "#211e19";
      ctx.font = "700 22px 'EB Garamond', Georgia, serif";
      ctx.fillText(order.number, LABEL_W / 2, y);

      y += 18;
      ctx.fillStyle = "#9c6b4a";
      ctx.font = "650 11px 'Ysabeau', system-ui, sans-serif";
      ctx.fillText(modeLabel.toUpperCase(), LABEL_W / 2, y);

      y += 20;
      ctx.fillStyle = "#211e19";
      ctx.font = "650 14px 'Ysabeau', system-ui, sans-serif";
      ctx.fillText(order.customerName || "Клиент", LABEL_W / 2, y);

      y += 20;
      ctx.fillStyle = "rgba(33, 30, 25, 0.78)";
      ctx.font = "500 12px 'Ysabeau', system-ui, sans-serif";
      const lines = wrapText(ctx, destination, LABEL_W - 48).slice(0, 2);
      for (const line of lines) {
        ctx.fillText(line, LABEL_W / 2, y);
        y += 16;
      }

      ctx.fillStyle = "rgba(156, 107, 74, 0.65)";
      ctx.font = "italic 12px 'EB Garamond', Georgia, serif";
      ctx.fillText("Денисов", LABEL_W / 2, LABEL_H - 22);
    },
    [destination, modeLabel, order.customerName, order.fulfillmentToken, order.number],
  );

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setError("");
    void (async () => {
      try {
        const url = await QRCode.toDataURL(
          encodeFulfillmentQrPayload(order.fulfillmentToken),
          {
            width: QR_SIZE * 2,
            margin: 1,
            errorCorrectionLevel: "M",
            color: { dark: "#211e19", light: "#ffffff" },
          },
        );
        if (cancelled) return;
        setQrUrl(url);
        // Wait a frame so canvas is mounted after expand
        await new Promise<void>((r) => {
          window.requestAnimationFrame(() => r());
        });
        if (cancelled) return;
        const canvas = previewRef.current;
        if (canvas) await drawLabel(canvas, url);
      } catch {
        if (!cancelled) setError("Не удалось собрать этикетку");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [drawLabel, open, order.fulfillmentToken]);

  const withFreshCanvas = async (): Promise<HTMLCanvasElement> => {
    if (!qrUrl) throw new Error("QR ещё не готов");
    const canvas = document.createElement("canvas");
    await drawLabel(canvas, qrUrl);
    return canvas;
  };

  const downloadPng = async () => {
    setBusy(true);
    setError("");
    try {
      const canvas = await withFreshCanvas();
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, "image/png"),
      );
      if (!blob) throw new Error("Не удалось создать файл");
      const href = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = href;
      a.download = `denisov-label-${order.number}.png`;
      a.click();
      URL.revokeObjectURL(href);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка скачивания");
    } finally {
      setBusy(false);
    }
  };

  const printLabel = async () => {
    setBusy(true);
    setError("");
    let iframe: HTMLIFrameElement | null = null;
    let objectUrl = "";
    try {
      const canvas = await withFreshCanvas();
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, "image/png"),
      );
      if (!blob) throw new Error("Не удалось создать файл этикетки");
      objectUrl = URL.createObjectURL(blob);
      const title = `Этикетка ${order.number}`;

      iframe = document.createElement("iframe");
      iframe.setAttribute("aria-hidden", "true");
      iframe.setAttribute("title", title);
      iframe.style.cssText =
        "position:fixed;right:0;bottom:0;width:0;height:0;border:0;opacity:0;pointer-events:none;";
      document.body.appendChild(iframe);

      await new Promise<void>((resolve, reject) => {
        const frame = iframe!;
        const timeout = window.setTimeout(() => {
          reject(new Error("Таймаут подготовки печати"));
        }, 12000);

        const fail = (message: string) => {
          window.clearTimeout(timeout);
          reject(new Error(message));
        };

        const run = () => {
          const doc = frame.contentDocument;
          const frameWin = frame.contentWindow;
          if (!doc || !frameWin) {
            fail("Не удалось открыть окно печати");
            return;
          }

          doc.title = title;
          doc.body.style.margin = "0";
          doc.body.style.background = "#fff";

          // Build DOM in the iframe realm — do not use parent
          // `instanceof HTMLImageElement` (cross-window always fails).
          const img = doc.createElement("img");
          img.alt = title;
          img.style.display = "block";
          img.style.width = "100%";
          img.style.maxWidth = "320px";
          img.style.margin = "0 auto";
          img.onload = () => {
            try {
              frameWin.focus();
              frameWin.print();
              window.clearTimeout(timeout);
              resolve();
            } catch (err) {
              fail(
                err instanceof Error ? err.message : "Ошибка диалога печати",
              );
            }
          };
          img.onerror = () =>
            fail("Не удалось загрузить изображение этикетки");
          doc.body.replaceChildren(img);
          img.src = objectUrl;
        };

        frame.addEventListener("load", run, { once: true });
        frame.src = "about:blank";
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка печати");
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      objectUrl = "";
      iframe?.remove();
      iframe = null;
    } finally {
      setBusy(false);
      if (iframe && objectUrl) {
        const frame = iframe;
        const url = objectUrl;
        window.setTimeout(() => {
          URL.revokeObjectURL(url);
          frame.remove();
        }, 2000);
      }
    }
  };

  return (
    <section className="rounded-2xl border border-ink/8 bg-white px-[1.05rem] pt-4 pb-[1.1rem] shadow-[0_10px_28px_rgba(33,30,25,0.04)]">
      <button
        type="button"
        className="flex w-full cursor-pointer items-center justify-between gap-3 border-0 bg-transparent p-0 text-left text-ink"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="flex min-w-0 items-start gap-3">
          <span className="mt-[0.1rem] grid size-8 shrink-0 place-items-center rounded-full bg-clay/10 text-clay">
            <Tag size={15} strokeWidth={2} aria-hidden="true" />
          </span>
          <span>
            <span className="block text-[0.72rem] font-semibold uppercase tracking-[0.12em] text-ink/55">
              Этикетка
            </span>
            <span className="mt-[0.2rem] block text-[0.95rem] text-ink/70">
              QR для наклейки на заказ — печать или скачать
            </span>
          </span>
        </span>
        <ChevronDown
          size={18}
          strokeWidth={2}
          aria-hidden="true"
          className={`shrink-0 text-ink/45 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open ? (
        <div className="mt-4 border-t border-dashed border-ink/12 pt-4">
          <div className="flex flex-wrap items-start gap-5">
            <div className="overflow-hidden rounded-[12px] border border-ink/10 bg-white shadow-[0_8px_22px_rgba(33,30,25,0.05)]">
              <canvas
                ref={previewRef}
                className="block max-w-full"
                aria-label={`Превью этикетки ${order.number}`}
              />
            </div>

            <div className="flex min-w-[180px] flex-1 flex-col gap-[0.55rem]">
              <button
                type="button"
                className={btnDark}
                disabled={busy || !qrUrl}
                onClick={() => void downloadPng()}
              >
                <Download size={15} strokeWidth={2} aria-hidden="true" />
                {busy ? "Готовим…" : "Скачать PNG"}
              </button>
              <button
                type="button"
                className={btnLine}
                disabled={busy || !qrUrl}
                onClick={() => void printLabel()}
              >
                <Printer size={15} strokeWidth={2} aria-hidden="true" />
                Печать
              </button>
              {error ? (
                <p className="m-0 text-[0.88rem] text-[#9b3d2e]" role="alert">
                  {error}
                </p>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
};
