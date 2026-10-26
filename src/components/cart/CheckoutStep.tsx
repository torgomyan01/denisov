"use client";

import {
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
  onBack: () => void;
  onSuccess: (order: OrderPublic) => void;
};

const cardClass =
  "flex flex-col gap-3 rounded-2xl border border-ink/8 bg-[linear-gradient(165deg,rgba(255,255,255,0.92),rgba(251,248,241,0.75))] px-[0.95rem] pt-[0.95rem] pb-4 shadow-[0_10px_28px_rgba(33,30,25,0.04)]";
const cardIconClass =
  "inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-clay/12 leading-none text-clay";
const labelClass =
  "flex flex-col gap-[0.35rem] text-[0.72rem] tracking-[0.1em] text-ink/50 uppercase";
const inputClass =
  "rounded-xl border border-ink/12 bg-white/88 px-[0.85rem] py-[0.72rem] text-[0.95rem] leading-[1.3] font-medium tracking-normal text-ink normal-case transition-[border-color,box-shadow] duration-200 focus:border-clay/55 focus:shadow-[0_0_0_3px_rgba(156,107,74,0.12)] focus:outline-none";

const enterStyle = (index: number): CSSProperties =>
  ({ "--i": index }) as CSSProperties;

const formatCardNumber = (raw: string): string => {
  const digits = raw.replace(/\D/g, "").slice(0, 16);
  return digits.replace(/(\d{4})(?=\d)/g, "$1 ").trim();
};

const formatExpiry = (raw: string): string => {
  const digits = raw.replace(/\D/g, "").slice(0, 4);
  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)}/${digits.slice(2)}`;
};

const maskPreviewNumber = (formatted: string): string => {
  const digits = formatted.replace(/\s/g, "");
  if (!digits) return "•••• •••• •••• ••••";
  const padded = digits.padEnd(16, "•");
  return padded.replace(/(.{4})(?=.)/g, "$1 ").trim();
};

export const CheckoutStep = ({
  customer,
  menu,
  onBack,
  onSuccess,
}: CheckoutStepProps) => {
  const cartState = useAppSelector((s: RootState) => s.cart);
  const items = cartState.items as CartLine[];
  const total = cartSubtotal(items);
  const isDelivery = cartState.fulfillmentMode === "delivery";
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
  const [apartment, setApartment] = useState(
    customer.deliveryApartment ?? "",
  );
  const [entrance, setEntrance] = useState(customer.deliveryEntrance ?? "");
  const [floor, setFloor] = useState(customer.deliveryFloor ?? "");
  const [intercom, setIntercom] = useState(customer.deliveryIntercom ?? "");
  const [courierComment, setCourierComment] = useState(
    customer.deliveryCourierComment ?? "",
  );
  const [cardNumber, setCardNumber] = useState("");
  const [expiry, setExpiry] = useState("");
  const [cvc, setCvc] = useState("");
  const [cardHolder, setCardHolder] = useState(
    [customer.name, customer.surname].filter(Boolean).join(" ").trim() || "",
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const previewNumber = useMemo(
    () => maskPreviewNumber(cardNumber),
    [cardNumber],
  );

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    if (!customer.phone) {
      setError("Добавьте телефон в профиле, затем оформите заказ");
      return;
    }
    if (isDelivery && !apartment.trim()) {
      setError("Укажите квартиру или офис");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const result = await placeOrderAction({
        cart: cartSnapshot(cartState),
        customerName: name.trim(),
        customerPhone: customer.phone,
        payment: {
          cardNumber,
          expiry,
          cvc,
          cardHolder,
        },
        ...(isDelivery
          ? {
              deliveryDetails: {
                apartment: apartment.trim(),
                entrance: entrance.trim(),
                floor: floor.trim(),
                intercom: intercom.trim(),
                courierComment: courierComment.trim(),
              },
            }
          : {}),
      });
      if (!result.success || !result.data) {
        setError(result.success ? "Ошибка" : result.error);
        return;
      }
      onSuccess(result.data.order);
    } finally {
      setBusy(false);
    }
  };

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
          Проверьте данные и завершите тестовую оплату
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
          {cartState.deliveryAddress.trim() ? (
            <p className="rounded-xl bg-ink/[0.03] px-3 py-[0.65rem] text-[0.9rem] leading-[1.35] text-ink/75">
              {cartState.deliveryAddress.trim()}
            </p>
          ) : (
            <p className="text-[0.85rem] text-ink/48">
              Точка на карте выбрана — уточните детали ниже
            </p>
          )}
          <div className="grid grid-cols-2 gap-[0.65rem]">
            <label className={labelClass}>
              Квартира / офис
              <input
                type="text"
                className={inputClass}
                value={apartment}
                onChange={(e) => setApartment(e.target.value)}
                required
                maxLength={64}
                autoComplete="address-line2"
                placeholder="12"
              />
            </label>
            <label className={labelClass}>
              Подъезд
              <input
                type="text"
                className={inputClass}
                value={entrance}
                onChange={(e) => setEntrance(e.target.value)}
                maxLength={64}
                placeholder="1"
              />
            </label>
            <label className={labelClass}>
              Этаж
              <input
                type="text"
                className={inputClass}
                value={floor}
                onChange={(e) => setFloor(e.target.value)}
                maxLength={32}
                placeholder="4"
              />
            </label>
            <label className={labelClass}>
              Домофон
              <input
                type="text"
                className={inputClass}
                value={intercom}
                onChange={(e) => setIntercom(e.target.value)}
                maxLength={64}
                placeholder="12К456"
              />
            </label>
          </div>
          <label className={labelClass}>
            Комментарий курьеру
            <textarea
              className={`${inputClass} min-h-[4.5rem] resize-y`}
              value={courierComment}
              onChange={(e) => setCourierComment(e.target.value)}
              maxLength={500}
              rows={3}
              placeholder="Код от калитки, куда оставить заказ…"
            />
          </label>
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
          <span>Итого к оплате</span>
          <strong className="font-serif text-[1.35rem] font-semibold text-ink">
            {formatPrice(String(total))}
          </strong>
        </div>
      </section>

      <section
        className={`${cardClass} ${cartCheckoutEnter}`}
        style={enterStyle(isDelivery ? 4 : 3)}
        aria-label="Оплата"
      >
        <div className="flex items-center gap-[0.7rem]">
          <span className={cardIconClass} aria-hidden="true">
            <CreditCard size={16} strokeWidth={2} className={cartIcon} />
          </span>
          <div>
            <strong className="block text-[0.95rem] leading-[1.25] font-[650] text-ink">
              Банковская карта
            </strong>
            <span className="text-[0.78rem] leading-[1.35] text-ink/52">
              Тестовый режим — списания не будет
            </span>
          </div>
        </div>

        <div
          className="relative min-h-[132px] overflow-hidden rounded-2xl bg-[radial-gradient(120%_90%_at_100%_0%,rgba(156,107,74,0.45),transparent_55%),linear-gradient(145deg,#2a261f_0%,#1a1713_55%,#3a2a20_100%)] px-[1.05rem] pt-4 pb-[0.95rem] text-[#f7f1e6] shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] before:absolute before:-top-[40%] before:-left-[20%] before:size-40 before:animate-pay-glow before:rounded-full before:bg-white/6 before:content-[''] motion-reduce:before:animate-none"
          aria-hidden="true"
        >
          <div className="h-6 w-[34px] rounded-[5px] bg-[linear-gradient(135deg,#d8c29a,#b89563_45%,#e7d4ad)] shadow-[inset_0_0_0_1px_rgba(0,0,0,0.12)]" />
          <p className="mt-[0.7rem] text-[10px] leading-none font-[650] tracking-[0.16em] uppercase opacity-70">
            Denisov · Test
          </p>
          <p className="mt-[0.85rem] font-serif text-[1.05rem] leading-[1.2] font-medium tracking-[0.12em] tabular-nums">
            {previewNumber}
          </p>
          <div className="mt-[0.85rem] flex justify-between gap-3 text-[10px] leading-none font-[650] tracking-[0.1em] uppercase opacity-78">
            <span className="max-w-[60%] overflow-hidden text-ellipsis whitespace-nowrap">
              {cardHolder.trim() || "ИМЯ НА КАРТЕ"}
            </span>
            <span className="max-w-[60%] overflow-hidden text-ellipsis whitespace-nowrap">
              {expiry || "MM/YY"}
            </span>
          </div>
        </div>

        <label className={labelClass}>
          Номер карты
          <input
            type="text"
            className={inputClass}
            inputMode="numeric"
            autoComplete="cc-number"
            placeholder="4242 4242 4242 4242"
            value={cardNumber}
            onChange={(e) => setCardNumber(formatCardNumber(e.target.value))}
            required
          />
        </label>

        <div className="grid grid-cols-2 gap-[0.65rem]">
          <label className={labelClass}>
            Срок
            <input
              type="text"
              className={inputClass}
              inputMode="numeric"
              autoComplete="cc-exp"
              placeholder="MM/YY"
              value={expiry}
              onChange={(e) => setExpiry(formatExpiry(e.target.value))}
              required
            />
          </label>
          <label className={labelClass}>
            CVC
            <input
              type="password"
              className={inputClass}
              inputMode="numeric"
              autoComplete="cc-csc"
              placeholder="123"
              value={cvc}
              onChange={(e) =>
                setCvc(e.target.value.replace(/\D/g, "").slice(0, 4))
              }
              required
            />
          </label>
        </div>

        <label className={labelClass}>
          Имя на карте
          <input
            type="text"
            className={inputClass}
            autoComplete="cc-name"
            value={cardHolder}
            onChange={(e) => setCardHolder(e.target.value)}
            required
            maxLength={80}
          />
        </label>

        <p className="flex items-center gap-[0.4rem] text-[0.78rem] leading-[1.35] text-ink/50">
          <Lock
            size={14}
            strokeWidth={2}
            className={cartIcon}
            aria-hidden="true"
          />
          Данные только для теста. Реальную оплату подключим позже.
        </p>
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
        disabled={busy || !items.length}
      >
        <span className="relative z-1">
          {busy ? "Оформляем…" : `Оплатить ${formatPrice(String(total))}`}
        </span>
        {busy ? (
          <span
            className="size-4 animate-cart-spin rounded-full border-2 border-paper/25 border-t-paper motion-reduce:animate-none"
            aria-hidden="true"
          />
        ) : null}
      </button>
    </form>
  );
};
