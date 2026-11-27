"use client";

import {
  Banknote,
  ChevronLeft,
  CreditCard,
  Lock,
  MapPin,
  Phone,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { useMemo, useState, type CSSProperties, type FormEvent } from "react";
import { placeOrderAction } from "@/actions/orders";
import { hasHouseNumber } from "@/lib/address-validation";
import {
  cartCheckoutEnter,
  cartCheckoutSubmitButton,
  cartCheckoutTitle,
  cartIcon,
  cartKicker,
  cartStepItem,
  cartStepsList,
} from "@/components/cart/cart-styles";
import {
  cartNutritionTotals,
  formatCartNutritionLine,
} from "@/lib/cart-nutrition";
import { formatPrice } from "@/lib/format";
import type { CheckoutPaymentMethod } from "@/lib/order-schema";
import { formatPhoneDisplay } from "@/lib/phone";
import type { OrderPublic } from "@/lib/orders";
import type { CustomerPublic } from "@/lib/customer-auth";
import {
  cartLineTotal,
  cartSnapshot,
  cartSubtotal,
  type CartLine,
} from "@/store/cartSlice";
import type { RootState } from "@/store";
import { useAppSelector } from "@/store/hooks";
import type { SiteMenu } from "@/types/site";

type CheckoutStepProps = {
  customer: CustomerPublic;
  menu: SiteMenu;
  onlinePayEnabled?: boolean;
  /** Admin toggle: allow cash/card to courier on delivery. */
  deliveryPayOnReceiptEnabled?: boolean;
  onBack: () => void;
  onSuccess: (order: OrderPublic, paymentUrl?: string) => void;
};

const cardClass =
  "flex flex-col gap-3 rounded-2xl border border-ink/8 bg-[linear-gradient(165deg,rgba(255,255,255,0.92),rgba(251,248,241,0.75))] px-[0.95rem] pt-[0.95rem] pb-4 shadow-[0_10px_28px_rgba(33,30,25,0.04)]";
const cardIconClass =
  "inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-clay/12 leading-none text-clay";
const labelClass =
  "flex flex-col gap-[0.35rem] text-[0.72rem] tracking-[0.1em] text-ink/50 uppercase";
const inputClass =
  "rounded-xl border border-ink/12 bg-white/88 px-[0.85rem] py-[0.72rem] text-[0.95rem] leading-[1.3] font-medium tracking-normal text-ink normal-case transition-[border-color,box-shadow] duration-200 focus:border-clay/55 focus:shadow-[0_0_0_3px_rgba(156,107,74,0.12)] focus:outline-none";

const payOptionClass = (active: boolean): string =>
  [
    "flex w-full cursor-pointer items-start gap-3 rounded-xl border px-3 py-[0.75rem] text-left transition-[border-color,background-color,box-shadow] duration-200",
    active
      ? "border-clay/55 bg-clay/[0.07] shadow-[0_0_0_3px_rgba(156,107,74,0.1)]"
      : "border-ink/10 bg-white/70 hover:border-ink/22",
  ].join(" ");

const enterStyle = (index: number): CSSProperties =>
  ({ "--i": index }) as CSSProperties;

export const CheckoutStep = ({
  customer,
  menu,
  onlinePayEnabled = true,
  deliveryPayOnReceiptEnabled = false,
  onBack,
  onSuccess,
}: CheckoutStepProps) => {
  const cartState = useAppSelector((s: RootState) => s.cart);
  const items = cartState.items as CartLine[];
  const total = cartSubtotal(items);
  const isDelivery = cartState.fulfillmentMode === "delivery";
  const deliveryOnlyOnline = isDelivery && !deliveryPayOnReceiptEnabled;
  const showOnReceiptOption = !isDelivery || deliveryPayOnReceiptEnabled;
  const nutrition = useMemo(
    () => cartNutritionTotals(items, menu),
    [items, menu],
  );
  const nutritionLine = formatCartNutritionLine(nutrition);

  const [name, setName] = useState(
    [customer.name, customer.surname].filter(Boolean).join(" ").trim() ||
      customer.name ||
      "",
  );
  const apartment = cartState.deliveryApartment || customer.deliveryApartment || "";
  const entrance = cartState.deliveryEntrance || customer.deliveryEntrance || "";
  const floor = cartState.deliveryFloor || customer.deliveryFloor || "";
  const intercom = cartState.deliveryIntercom || customer.deliveryIntercom || "";
  const courierComment =
    cartState.deliveryCourierComment || customer.deliveryCourierComment || "";
  const [payMethod, setPayMethod] = useState<CheckoutPaymentMethod>(
    deliveryOnlyOnline ? "card" : "on_receipt",
  );
  // Delivery prepaid-only: force online without an effect (avoids cascading renders).
  const activePayMethod: CheckoutPaymentMethod = deliveryOnlyOnline
    ? "card"
    : payMethod;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [confirmAddressOpen, setConfirmAddressOpen] = useState(false);

  const submitOrder = async () => {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const payment =
        activePayMethod === "card"
          ? { method: "card" as const }
          : { method: "on_receipt" as const };

      const result = await placeOrderAction({
        cart: cartSnapshot(cartState),
        customerName: name.trim(),
        customerPhone: customer.phone,
        payment,
        ...(isDelivery
          ? {
              deliveryDetails: {
                apartment: apartment.trim(),
                entrance: entrance.trim(),
                floor: floor.trim(),
                courierComment: courierComment.trim(),
                intercom: intercom.trim(),
              },
            }
          : {}),
      });
      if (!result.success || !result.data) {
        setError(result.success ? "Ошибка" : result.error);
        return;
      }
      onSuccess(result.data.order, result.data.paymentUrl);
    } finally {
      setBusy(false);
    }
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    if (!customer.phone) {
      setError("Добавьте телефон в профиле, затем оформите заказ");
      return;
    }
    if (isDelivery && !hasHouseNumber(cartState.deliveryAddress)) {
      setError("Укажите номер дома для доставки");
      return;
    }
    if (isDelivery && !apartment.trim()) {
      setError("Укажите квартиру или офис");
      return;
    }
    if (deliveryOnlyOnline && activePayMethod !== "card") {
      setError("Доставка только с онлайн-оплатой");
      return;
    }
    if (activePayMethod === "card" && !onlinePayEnabled) {
      setError(
        deliveryOnlyOnline
          ? "Онлайн-оплата временно недоступна. Доставка без предоплаты невозможна — попробуйте позже или выберите самовывоз."
          : "Онлайн-оплата временно недоступна",
      );
      return;
    }
    if (isDelivery) {
      setError("");
      setConfirmAddressOpen(true);
      return;
    }
    await submitOrder();
  };

  const submitLabel =
    activePayMethod === "card"
      ? `Перейти к оплате · ${formatPrice(String(total))}`
      : `Оформить · ${formatPrice(String(total))}`;

  return (
    <form
      className="flex flex-col gap-[0.9rem] px-[1.15rem] pt-3 pb-[1.35rem]"
      onSubmit={(e) => void onSubmit(e)}
    >
      <button
        type="button"
        className="inline-flex cursor-pointer items-center justify-center gap-[0.2rem] self-start border-0 bg-transparent py-[0.2rem] text-[11px] leading-none font-[650] tracking-[0.12em] text-clay uppercase transition-[color,translate] duration-200 hover:-translate-x-0.5 hover:text-ink"
        onClick={onBack}
      >
        <ChevronLeft
          size={18}
          strokeWidth={2}
          className={cartIcon}
          aria-hidden="true"
        />
        Назад к корзине
      </button>

      <ol
        className={`${cartStepsList} mt-[0.15rem] mb-[0.35rem]`}
        aria-label="Этапы оформления"
      >
        <li className={cartStepItem("done")}>Корзина</li>
        <li className={cartStepItem("current")} aria-current="step">
          Оплата
        </li>
        <li className={cartStepItem("idle")}>Готово</li>
      </ol>

      <header
        className={`mt-[0.1rem] ${cartCheckoutEnter}`}
        style={enterStyle(0)}
      >
        <p className={cartKicker}>Оформление</p>
        <h3 className={cartCheckoutTitle}>Подтверждение заказа</h3>
        <p className="mt-[0.35rem] text-[0.88rem] leading-[1.4] text-ink/55">
          Выберите способ оплаты и проверьте данные
        </p>
      </header>

      <section
        className={`${cardClass} ${cartCheckoutEnter}`}
        style={enterStyle(1)}
        aria-label="Контакты"
      >
        <div className="flex items-center gap-[0.7rem]">
          <span className={cardIconClass} aria-hidden="true">
            <UserRound size={16} strokeWidth={2} className={cartIcon} />
          </span>
          <div>
            <strong className="block text-[0.95rem] leading-[1.25] font-[650] text-ink">
              Получатель
            </strong>
            <span className="text-[0.78rem] leading-[1.35] text-ink/52">
              Контакты для связи по заказу
            </span>
          </div>
        </div>
        <label className={labelClass}>
          Имя
          <input
            type="text"
            className={inputClass}
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            maxLength={255}
            autoComplete="name"
          />
        </label>
        <div className="inline-flex items-center justify-start gap-[0.45rem] rounded-full bg-ink/4 px-3 py-[0.55rem] text-[0.88rem] leading-[1.2] text-ink/72">
          <Phone
            size={15}
            strokeWidth={2}
            className={cartIcon}
            aria-hidden="true"
          />
          <span>
            {customer.phone
              ? formatPhoneDisplay(customer.phone)
              : "Телефон не указан"}
          </span>
        </div>
      </section>

      {isDelivery ? (
        <section
          className={`${cardClass} ${cartCheckoutEnter}`}
          style={enterStyle(2)}
          aria-label="Адрес доставки"
        >
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-[0.7rem]">
              <span className={cardIconClass} aria-hidden="true">
                <MapPin size={16} strokeWidth={2} className={cartIcon} />
              </span>
              <div>
                <strong className="block text-[0.95rem] leading-[1.25] font-[650] text-ink">
                  Адрес доставки
                </strong>
                <span className="text-[0.78rem] leading-[1.35] text-ink/52">
                  Сохраним для следующих заказов
                </span>
              </div>
            </div>
            <button
              type="button"
              className="cursor-pointer border-0 bg-transparent text-[11px] font-bold tracking-[0.1em] text-clay uppercase transition-colors hover:text-ink"
              onClick={onBack}
            >
              Изменить
            </button>
          </div>
          <div className="rounded-xl bg-ink/[0.03] px-3 py-[0.65rem]">
            <p className="m-0 text-[0.9rem] leading-[1.35] font-medium text-ink">
              {cartState.deliveryAddress.trim() || "Адрес не указан"}
            </p>
            <p className="mt-1 m-0 text-[0.8rem] leading-[1.4] text-ink/60">
              {[
                apartment.trim() ? `кв./офис ${apartment.trim()}` : "",
                entrance.trim() ? `подъезд ${entrance.trim()}` : "",
                floor.trim() ? `этаж ${floor.trim()}` : "",
                intercom.trim() ? `домофон ${intercom.trim()}` : "",
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
            {courierComment.trim() ? (
              <p className="mt-1 m-0 text-[0.78rem] leading-[1.35] text-ink/52">
                Комментарий: {courierComment.trim()}
              </p>
            ) : null}
          </div>
        </section>
      ) : null}

      <section
        className={`${cardClass} ${cartCheckoutEnter}`}
        style={enterStyle(isDelivery ? 3 : 2)}
        aria-label="Состав"
      >
        <div className="flex items-center gap-[0.7rem]">
          <span className={cardIconClass} aria-hidden="true">
            <ShieldCheck size={16} strokeWidth={2} className={cartIcon} />
          </span>
          <div>
            <strong className="block text-[0.95rem] leading-[1.25] font-[650] text-ink">
              Состав
            </strong>
            <span className="text-[0.78rem] leading-[1.35] text-ink/52">
              {items.length} поз. в заказе
            </span>
          </div>
        </div>
        <ul className="m-0 flex list-none flex-col gap-[0.15rem] p-0">
          {items.map((line, index) => (
            <li
              key={line.id}
              className="flex animate-cart-line justify-between gap-3 border-b border-ink/6 py-[0.45rem] text-[0.9rem] text-ink [animation-delay:calc(0.05s*var(--i,0))] last:border-b-0 motion-reduce:animate-none"
              style={enterStyle(index)}
            >
              <span className="flex min-w-0 flex-col gap-[0.1rem]">
                {line.name}
                <em className="text-[0.78rem] text-ink/45 not-italic">
                  × {line.qty}
                </em>
              </span>
              <strong>{formatPrice(String(cartLineTotal(line)))}</strong>
            </li>
          ))}
        </ul>
        {nutrition.hasAny && nutritionLine ? (
          <div className="rounded-[12px] border border-ink/8 bg-ink/[0.03] px-3 py-2">
            <p className="m-0 text-[10px] font-bold tracking-[0.14em] text-ink/42 uppercase">
              КБЖУ заказа
            </p>
            <p className="mt-[0.25rem] m-0 text-[0.9rem] leading-[1.35] font-[650] text-ink/78">
              {nutritionLine}
            </p>
          </div>
        ) : null}
        <div className="mt-1 flex items-baseline justify-between border-t border-dashed border-ink/14 pt-[0.65rem] text-[0.92rem]">
          <span>Итого</span>
          <strong className="font-serif text-[1.35rem] font-semibold text-ink">
            {formatPrice(String(total))}
          </strong>
        </div>
      </section>

      <section
        className={`${cardClass} ${cartCheckoutEnter}`}
        style={enterStyle(isDelivery ? 4 : 3)}
        aria-label="Способ оплаты"
      >
        <div className="flex items-center gap-[0.7rem]">
          <span className={cardIconClass} aria-hidden="true">
            <Banknote size={16} strokeWidth={2} className={cartIcon} />
          </span>
          <div>
            <strong className="block text-[0.95rem] leading-[1.25] font-[650] text-ink">
              Способ оплаты
            </strong>
            <span className="text-[0.78rem] leading-[1.35] text-ink/52">
              {deliveryOnlyOnline
                ? "Доставка — только онлайн через Sber"
                : isDelivery
                  ? "Курьеру при получении или онлайн через Sber"
                  : "На кассе в кафе или онлайн через Sber"}
            </span>
          </div>
        </div>

        {deliveryOnlyOnline && !onlinePayEnabled ? (
          <p
            className="rounded-xl bg-danger/8 px-3 py-[0.65rem] text-[0.88rem] text-danger"
            role="alert"
          >
            Онлайн-оплата временно недоступна. Доставка без предоплаты
            невозможна — попробуйте позже или выберите самовывоз.
          </p>
        ) : (
          <div
            className="flex flex-col gap-2"
            role="radiogroup"
            aria-label="Способ оплаты"
          >
            {showOnReceiptOption ? (
              <button
                type="button"
                role="radio"
                aria-checked={activePayMethod === "on_receipt"}
                className={payOptionClass(activePayMethod === "on_receipt")}
                onClick={() => setPayMethod("on_receipt")}
              >
                <span className={cardIconClass} aria-hidden="true">
                  <Banknote size={16} strokeWidth={2} className={cartIcon} />
                </span>
                <span className="min-w-0">
                  <strong className="block text-[0.92rem] leading-[1.25] font-[650] text-ink">
                    При получении
                  </strong>
                  <span className="mt-[0.15rem] block text-[0.78rem] leading-[1.35] text-ink/55">
                    {isDelivery
                      ? "Наличными или картой курьеру"
                      : "Наличными или картой на кассе в кафе"}
                  </span>
                </span>
              </button>
            ) : null}
            {onlinePayEnabled ? (
              <button
                type="button"
                role="radio"
                aria-checked={activePayMethod === "card"}
                className={payOptionClass(activePayMethod === "card")}
                onClick={() => setPayMethod("card")}
              >
                <span className={cardIconClass} aria-hidden="true">
                  <CreditCard size={16} strokeWidth={2} className={cartIcon} />
                </span>
                <span className="min-w-0">
                  <strong className="block text-[0.92rem] leading-[1.25] font-[650] text-ink">
                    Онлайн · карта / SberPay
                  </strong>
                  <span className="mt-[0.15rem] block text-[0.78rem] leading-[1.35] text-ink/55">
                    Безопасная оплата на странице Сбера
                  </span>
                </span>
              </button>
            ) : null}
          </div>
        )}

        {activePayMethod === "card" && onlinePayEnabled ? (
          <p className="flex items-start gap-[0.4rem] text-[0.78rem] leading-[1.4] text-ink/55">
            <Lock
              size={14}
              strokeWidth={2}
              className={`${cartIcon} mt-[0.1rem] shrink-0`}
              aria-hidden="true"
            />
            После нажатия откроется платёжная страница Сбера. Данные карты на
            нашем сайте не вводятся и не хранятся.
          </p>
        ) : null}
      </section>

      {error ? (
        <p
          className="animate-cart-shake rounded-xl bg-danger/8 px-3 py-[0.65rem] text-[0.88rem] text-danger motion-reduce:animate-none"
          role="alert"
        >
          {error}
        </p>
      ) : null}

      <button
        type="submit"
        className={`${cartCheckoutSubmitButton} ${busy ? "pointer-events-none" : ""}`}
        disabled={
          busy ||
          !items.length ||
          (deliveryOnlyOnline && !onlinePayEnabled)
        }
      >
        <span className="relative z-1">
          {busy
            ? activePayMethod === "card"
              ? "Создаём оплату…"
              : "Оформляем…"
            : submitLabel}
        </span>
        {busy ? (
          <span
            className="size-4 animate-cart-spin rounded-full border-2 border-paper/25 border-t-paper motion-reduce:animate-none"
            aria-hidden="true"
          />
        ) : null}
      </button>

      {confirmAddressOpen ? (
        <div
          className="fixed inset-0 z-[120] flex items-center justify-center bg-ink/55 p-4 backdrop-blur-[2px] animate-fade-in"
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirm-delivery-address-title"
          onClick={() => setConfirmAddressOpen(false)}
        >
          <div
            className="w-full max-w-[26rem] rounded-[22px] border border-ink/10 bg-paper p-5 shadow-[0_24px_64px_rgba(33,30,25,0.28)]"
            onClick={(e) => e.stopPropagation()}
          >
            <p className={cartKicker}>Доставка</p>
            <h4
              id="confirm-delivery-address-title"
              className="mt-1 font-serif text-[1.45rem] leading-[1.15] font-normal text-ink"
            >
              Проверьте адрес доставки
            </h4>
            <p className="mt-1.5 text-[0.84rem] leading-[1.4] text-ink/55">
              Курьер привезёт заказ именно по этому адресу:
            </p>

            <div className="mt-3.5 rounded-[14px] border border-clay/25 bg-sand/70 px-3.5 py-3">
              <p className="m-0 text-[0.95rem] leading-[1.35] font-[650] text-ink">
                {cartState.deliveryAddress.trim()}
              </p>
              <p className="mt-1.5 m-0 text-[0.82rem] leading-[1.4] text-ink/65">
                {[
                  apartment.trim() ? `кв./офис ${apartment.trim()}` : "",
                  entrance.trim() ? `подъезд ${entrance.trim()}` : "",
                  floor.trim() ? `этаж ${floor.trim()}` : "",
                  intercom.trim() ? `домофон ${intercom.trim()}` : "",
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
              {courierComment.trim() ? (
                <p className="mt-1.5 m-0 text-[0.8rem] leading-[1.35] text-ink/55">
                  Комментарий: {courierComment.trim()}
                </p>
              ) : null}
            </div>

            <div className="mt-4 flex flex-col gap-2">
              <button
                type="button"
                className={cartCheckoutSubmitButton}
                disabled={busy}
                onClick={() => {
                  setConfirmAddressOpen(false);
                  void submitOrder();
                }}
              >
                Да, адрес верный
              </button>
              <button
                type="button"
                className="inline-flex min-h-11 w-full cursor-pointer items-center justify-center rounded-[14px] border border-ink/14 bg-transparent px-4 py-2.5 text-[11px] font-bold tracking-[0.12em] text-ink/75 uppercase transition-colors hover:border-ink/30 hover:text-ink"
                disabled={busy}
                onClick={() => {
                  setConfirmAddressOpen(false);
                  onBack();
                }}
              >
                Изменить адрес
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </form>
  );
};
