"use client";

import { useEffect, useState } from "react";
import {
  btnLine,
  btnSmGhost,
  fieldClass,
} from "@/components/admin/styles";
import { Field, FileDrop, ToggleField } from "@/components/admin/ui";
import {
  createDefaultDeliverySettings,
  parseZonePolygon,
} from "@/lib/delivery-defaults";
import type { DeliverySettings, DeliveryZoneMode, SiteData } from "@/types/site";

const UPLOAD_HINT =
  "JPG, PNG или WebP · десктоп ~3200×1050 · мобильный ~880×800";

type DeliverySettingsPanelProps = {
  site: SiteData;
  busy: boolean;
  patchDelivery: (fn: (d: DeliverySettings) => void) => void;
  onUpload: (field: "deliveryBannerDesktop" | "deliveryBannerMobile", file: File) => void;
};

const moneyValue = (n: number): string => (n > 0 ? String(n) : "");

const parseMoney = (raw: string): number => {
  const n = Number(raw.replace(/\s/g, "").replace(",", "."));
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.round(n);
};

export const DeliverySettingsPanel = ({
  site,
  busy,
  patchDelivery,
  onUpload,
}: DeliverySettingsPanelProps) => {
  const delivery = site.delivery ?? createDefaultDeliverySettings();
  const [polygonText, setPolygonText] = useState(() =>
    JSON.stringify(delivery.zonePolygon ?? [], null, 2),
  );

  useEffect(() => {
    setPolygonText(JSON.stringify(delivery.zonePolygon ?? [], null, 2));
  }, [delivery.zonePolygon]);

  return (
    <section className="animate-panel-in rounded-3xl border border-ink/12 bg-white/78 px-[1.35rem] pt-[1.35rem] pb-6 shadow-[0_14px_40px_rgba(33,30,25,0.045)] backdrop-blur-[10px] md:px-[1.85rem] md:pt-7 md:pb-[1.9rem]">
      <div className="mb-[1.1rem] flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="m-0 font-serif text-[clamp(1.55rem,2.4vw,1.95rem)] leading-[1.15] tracking-[0.02em]">
            Доставка
          </h2>
          <p className="mt-[0.4rem] max-w-[42rem] text-[0.92rem] leading-normal text-ink/48">
            Баннер раздела, тексты, правила стоимости и зона. Позиции меню
            настраиваются во вкладке «Меню».
          </p>
        </div>
      </div>
      <hr className="mb-5 h-px border-0 bg-[linear-gradient(90deg,transparent,rgba(156,107,74,0.45),transparent)]" />

      <div className="grid gap-5">
        <ToggleField
          label="Приём заказов включён"
          checked={delivery.ordersEnabled}
          disabled={busy}
          hint="Выключите при перегрузе кухни — гости не смогут оформить заказ."
          onChange={(v) => patchDelivery((d) => { d.ordersEnabled = v; })}
        />

        <div className="grid gap-4 md:grid-cols-2">
          <Field
            label="Заголовок баннера"
            value={delivery.title}
            placeholder="Доставка из Денисова"
            onChange={(v) => patchDelivery((d) => { d.title = v; })}
          />
          <Field
            label="Подзаголовок"
            value={delivery.subtitle}
            placeholder="Московский пр., 71/3 · ежедневно 8:00–22:00"
            onChange={(v) => patchDelivery((d) => { d.subtitle = v; })}
          />
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="grid gap-2">
            <FileDrop
              label="Баннер · десктоп"
              title="Перетащите или выберите"
              hint={UPLOAD_HINT}
              accept="image/*"
              disabled={busy}
              onFile={(file) => onUpload("deliveryBannerDesktop", file)}
            />
            {delivery.bannerDesktop ? (
              <div className="overflow-hidden rounded-xl border border-ink/10">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={delivery.bannerDesktop}
                  alt=""
                  className="block max-h-36 w-full object-cover"
                />
                <button
                  type="button"
                  className={`${btnSmGhost} m-2`}
                  disabled={busy}
                  onClick={() =>
                    patchDelivery((d) => {
                      d.bannerDesktop = "";
                    })
                  }
                >
                  Удалить
                </button>
              </div>
            ) : null}
          </div>
          <div className="grid gap-2">
            <FileDrop
              label="Баннер · мобильный"
              title="Перетащите или выберите"
              hint={UPLOAD_HINT}
              accept="image/*"
              disabled={busy}
              onFile={(file) => onUpload("deliveryBannerMobile", file)}
            />
            {delivery.bannerMobile ? (
              <div className="overflow-hidden rounded-xl border border-ink/10">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={delivery.bannerMobile}
                  alt=""
                  className="block max-h-36 w-full object-cover"
                />
                <button
                  type="button"
                  className={`${btnSmGhost} m-2`}
                  disabled={busy}
                  onClick={() =>
                    patchDelivery((d) => {
                      d.bannerMobile = "";
                    })
                  }
                >
                  Удалить
                </button>
              </div>
            ) : null}
          </div>
        </div>

        <div>
          <h3 className="m-0 mb-3 font-sans text-[0.78rem] font-[650] tracking-[0.12em] text-clay uppercase">
            Правила доставки
          </h3>
          <div className="grid gap-4 md:grid-cols-3">
            <Field
              label="Мин. сумма заказа, ₽"
              value={moneyValue(delivery.minOrderAmount)}
              placeholder="0"
              type="number"
              hint="0 — без минимума"
              onChange={(v) =>
                patchDelivery((d) => {
                  d.minOrderAmount = parseMoney(v);
                })
              }
            />
            <Field
              label="Стоимость доставки, ₽"
              value={moneyValue(delivery.deliveryFee)}
              placeholder="0"
              type="number"
              onChange={(v) =>
                patchDelivery((d) => {
                  d.deliveryFee = parseMoney(v);
                })
              }
            />
            <Field
              label="Бесплатно от, ₽"
              value={moneyValue(delivery.freeDeliveryFrom)}
              placeholder="0"
              type="number"
              hint="0 — порог выключен"
              onChange={(v) =>
                patchDelivery((d) => {
                  d.freeDeliveryFrom = parseMoney(v);
                })
              }
            />
          </div>
        </div>

        <div>
          <h3 className="m-0 mb-3 font-sans text-[0.78rem] font-[650] tracking-[0.12em] text-clay uppercase">
            Зона доставки
          </h3>
          <div className={fieldClass}>
            <label htmlFor="delivery-zone-mode">Тип зоны</label>
            <select
              id="delivery-zone-mode"
              className="w-full rounded-xl border border-ink/12 bg-paper/95 px-[0.85rem] py-[0.7rem] font-sans text-sm font-medium leading-[1.4] text-ink outline-none focus:border-clay focus:shadow-[0_0_0_3px_rgba(156,107,74,0.12)]"
              value={delivery.zoneMode}
              disabled={busy}
              onChange={(e) =>
                patchDelivery((d) => {
                  d.zoneMode = e.target.value as DeliveryZoneMode;
                })
              }
            >
              <option value="radius">Радиус от точки</option>
              <option value="polygon">Полигон (координаты)</option>
            </select>
          </div>

          {delivery.zoneMode === "radius" ? (
            <div className="mt-4 grid gap-4 md:grid-cols-3">
              <Field
                label="Радиус, км"
                value={String(delivery.zoneRadiusKm || "")}
                placeholder="5"
                type="number"
                onChange={(v) =>
                  patchDelivery((d) => {
                    const n = Number(v.replace(",", "."));
                    d.zoneRadiusKm = Number.isFinite(n) && n >= 0 ? n : 0;
                  })
                }
              />
              <Field
                label="Центр · широта"
                value={
                  delivery.zoneCenterLat != null
                    ? String(delivery.zoneCenterLat)
                    : ""
                }
                placeholder="59.9…"
                onChange={(v) =>
                  patchDelivery((d) => {
                    const n = Number(v.replace(",", "."));
                    d.zoneCenterLat = v.trim() && Number.isFinite(n) ? n : null;
                  })
                }
              />
              <Field
                label="Центр · долгота"
                value={
                  delivery.zoneCenterLng != null
                    ? String(delivery.zoneCenterLng)
                    : ""
                }
                placeholder="30.3…"
                onChange={(v) =>
                  patchDelivery((d) => {
                    const n = Number(v.replace(",", "."));
                    d.zoneCenterLng = v.trim() && Number.isFinite(n) ? n : null;
                  })
                }
              />
            </div>
          ) : (
            <div className="mt-4 grid gap-2">
              <Field
                label="Полигон JSON"
                value={polygonText}
                multiline
                hint='Массив точек [[широта, долгота], …]. Минимум 3 точки.'
                onChange={(v) => {
                  setPolygonText(v);
                  try {
                    const parsed = parseZonePolygon(JSON.parse(v || "[]"));
                    patchDelivery((d) => {
                      d.zonePolygon = parsed;
                    });
                  } catch {
                    /* keep typing until JSON is valid */
                  }
                }}
              />
              <button
                type="button"
                className={btnLine}
                disabled={busy}
                onClick={() => {
                  setPolygonText("[]");
                  patchDelivery((d) => {
                    d.zonePolygon = [];
                  });
                }}
              >
                Очистить полигон
              </button>
            </div>
          )}
        </div>
      </div>
    </section>
  );
};
