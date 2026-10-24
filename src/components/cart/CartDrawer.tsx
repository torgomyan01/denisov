"use client";

import {
  CheckCircle2,
  ChevronRight,
  Clock,
  MapPin,
  MessageSquare,
  ShoppingBag,
  User,
  Utensils,
  X,
} from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { getCustomerAction } from "@/actions/customer-auth";
import { saveMyCartAction } from "@/actions/customer-cart";
import { CheckoutStep } from "@/components/cart/CheckoutStep";
import {
  cartCheckoutButton,
  cartCheckoutSubmitButton,
  cartCheckoutTitle,
  cartCloseButton,
  cartDeliveryAddress,
  cartIcon,
  cartKicker,
  cartStepItem,
  cartStepsList,
  cartTitle,
} from "@/components/cart/cart-styles";
import { AddressSuggestField } from "@/components/cart/AddressSuggestField";
import { DeliveryMapModal } from "@/components/cart/DeliveryMapModal";
import { PickupPointPickerModal } from "@/components/cart/PickupPointPickerModal";
import { OrderFulfillmentQr } from "@/components/orders/OrderFulfillmentQr";
import {
  ASAP_LABEL,
  CHANGE_TIME_LABEL,
  buildPickupTimeSlots,
  formatScheduledLabel,
} from "@/lib/cart-fulfillment";
import type { CustomerPublic } from "@/lib/customer-auth";
import { formatPrice } from "@/lib/format";
import type { OrderPublic } from "@/lib/orders";
import { getSuggestedProducts } from "@/lib/cart-suggestions";
import { createDefaultDeliverySettings } from "@/lib/delivery-defaults";
import {
  calcDeliveryTotals,
  isPointInDeliveryZone,
} from "@/lib/delivery-pricing";
import type { PickupPointPublic } from "@/lib/pickup-points";
import type { DeliverySettings } from "@/types/site";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import {
  addToCart,
  cartItemCount,
  cartLineTotal,
  cartSnapshot,
  cartSubtotal,
  clearCart,
  closeCart,
  decrementQty,
  decrementUtensils,
  incrementQty,
  incrementUtensils,
  isCartCloudPersist,
  setComment,
  setDeliveryAddress,
  setDeliveryLocation,
  setFulfillmentMode,
  setPickupPointId,
  setScheduledAt,
  setTimeMode,
  toggleComment,
  removeFromCart,
  type CartProduct,
} from "@/store/cartSlice";
import type { SiteMenu } from "@/types/site";

type CartDrawerProps = {
  menu: SiteMenu;
  pickupPoints: PickupPointPublic[];
  cafeHours: string;
  delivery?: DeliverySettings;
};

export const CartDrawer = ({
  menu,
  pickupPoints,
  cafeHours,
  delivery: deliveryProp,
}: CartDrawerProps) => {
  const delivery = deliveryProp ?? createDefaultDeliverySettings();
  const dispatch = useAppDispatch();
  const router = useRouter();
  const pathname = usePathname() || "/";
  const isOpen = useAppSelector((s) => s.cart.isOpen);
  const cartState = useAppSelector((s) => s.cart);
  const items = cartState.items;
  const utensils = cartState.utensils;
  const comment = cartState.comment;
  const commentOpen = cartState.commentOpen;
  const fulfillmentMode = cartState.fulfillmentMode;
  const pickupPointId = cartState.pickupPointId;
  const deliveryAddress = cartState.deliveryAddress;
  const deliveryLat = cartState.deliveryLat;
  const deliveryLng = cartState.deliveryLng;
  const timeMode = cartState.timeMode;
  const scheduledAt = cartState.scheduledAt;
  const count = cartItemCount(items);
  const subtotal = cartSubtotal(items);
  const totals = useMemo(
    () => calcDeliveryTotals(delivery, subtotal, fulfillmentMode),
    [delivery, subtotal, fulfillmentMode],
  );
  const inZone =
    fulfillmentMode !== "delivery" ||
    deliveryLat == null ||
    deliveryLng == null ||
    isPointInDeliveryZone(delivery, deliveryLat, deliveryLng);
  const ordersEnabled = delivery.ordersEnabled !== false;
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);
  const [locationOpen, setLocationOpen] = useState(false);
  const [timeOpen, setTimeOpen] = useState(false);
  const [mapModalOpen, setMapModalOpen] = useState(false);
  const [pickupPickerOpen, setPickupPickerOpen] = useState(false);
  const [customer, setCustomer] = useState<CustomerPublic | null>(null);
  const [checkoutBusy, setCheckoutBusy] = useState(false);
  const [checkoutNote, setCheckoutNote] = useState("");
  const [step, setStep] = useState<"cart" | "checkout" | "success">("cart");
  const [placedOrder, setPlacedOrder] = useState<OrderPublic | null>(null);

  const suggestions = useMemo(
    () => getSuggestedProducts(menu, items, 6),
    [menu, items],
  );
  const suggestedProducts = suggestions.products;

  const timeSlots = useMemo(
    () => buildPickupTimeSlots(cafeHours),
    [cafeHours],
  );

  const selectedPoint = useMemo(() => {
    if (!pickupPoints.length) return null;
    return (
      pickupPoints.find((p) => p.id === pickupPointId) ?? pickupPoints[0] ?? null
    );
  }, [pickupPoints, pickupPointId]);

  useEffect(() => {
    if (!pickupPoints.length || !pickupPoints[0]) return;
    const exists = Boolean(
      pickupPointId && pickupPoints.some((p) => p.id === pickupPointId),
    );
    // Remembered point was removed — fall back to first active.
    if (pickupPointId && !exists) {
      dispatch(setPickupPointId(pickupPoints[0].id));
      return;
    }
    // Pickup mode needs a point; do not override delivery-only carts.
    if (fulfillmentMode === "pickup" && !pickupPointId) {
      dispatch(setPickupPointId(pickupPoints[0].id));
    }
  }, [pickupPoints, pickupPointId, fulfillmentMode, dispatch]);

  const locationLabel =
    fulfillmentMode === "pickup" ? "Самовывоз" : "Доставка";
  const deliveryReady =
    deliveryLat != null && deliveryLng != null && inZone;
  const deliveryAddressLabel = deliveryAddress.trim();
  const locationValue =
    fulfillmentMode === "pickup"
      ? selectedPoint?.name || "Выберите точку"
      : deliveryReady && deliveryAddressLabel
        ? deliveryAddressLabel
        : deliveryReady
          ? "Адрес выбран"
          : "Укажите адрес";

  const timePrimary =
    timeMode === "asap" ? ASAP_LABEL : formatScheduledLabel(scheduledAt);

  useEffect(() => {
    if (isOpen) {
      setMounted(true);
      void (async () => {
        const result = await getCustomerAction();
        setCustomer(result.success && result.data ? result.data : null);
      })();
      return;
    }
    setVisible(false);
    setLocationOpen(false);
    setTimeOpen(false);
    setMapModalOpen(false);
    setCheckoutNote("");
    setStep("cart");
    setPlacedOrder(null);
  }, [isOpen]);

  const onCheckout = async () => {
    if (!items.length || checkoutBusy) return;

    if (!customer) {
      dispatch(closeCart());
      const next = encodeURIComponent(pathname);
      router.push(`/auth?next=${next}`);
      return;
    }

    setCheckoutBusy(true);
    setCheckoutNote("");
    try {
      if (isCartCloudPersist()) {
        await saveMyCartAction(cartSnapshot(cartState));
      }
      setStep("checkout");
    } finally {
      setCheckoutBusy(false);
    }
  };

  const onOrderSuccess = (order: OrderPublic) => {
    dispatch(clearCart());
    setPlacedOrder(order);
    setStep("success");
  };

  useEffect(() => {
    if (!mounted || !isOpen) return;
    const id = window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => setVisible(true));
    });
    return () => window.cancelAnimationFrame(id);
  }, [mounted, isOpen]);

  const scrollYRef = useRef(0);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (mapModalOpen) return;
      dispatch(closeCart());
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, mapModalOpen, dispatch]);

  useEffect(() => {
    if (!isOpen) return;

    const html = document.documentElement;
    const body = document.body;
    scrollYRef.current = window.scrollY;

    const prev = {
      htmlOverflow: html.style.overflow,
      bodyOverflow: body.style.overflow,
      bodyPosition: body.style.position,
      bodyTop: body.style.top,
      bodyLeft: body.style.left,
      bodyRight: body.style.right,
      bodyWidth: body.style.width,
    };

    html.style.overflow = "hidden";
    body.style.overflow = "hidden";
    body.style.position = "fixed";
    body.style.top = `-${scrollYRef.current}px`;
    body.style.left = "0";
    body.style.right = "0";
    body.style.width = "100%";

    return () => {
      html.style.overflow = prev.htmlOverflow;
      body.style.overflow = prev.bodyOverflow;
      body.style.position = prev.bodyPosition;
      body.style.top = prev.bodyTop;
      body.style.left = prev.bodyLeft;
      body.style.right = prev.bodyRight;
      body.style.width = prev.bodyWidth;
      window.scrollTo(0, scrollYRef.current);
    };
  }, [isOpen]);

  if (!mounted) return null;

  return (
    <>
      <div
        className={`fixed inset-0 z-80 overflow-hidden ${
          visible ? "pointer-events-auto" : "pointer-events-none motion-reduce:hidden"
        }`}
        role="presentation"
      >
        <button
          type="button"
          className={`absolute inset-0 m-0 cursor-pointer border-0 bg-[rgba(24,22,18,0.48)] p-0 backdrop-blur-[6px] transition-opacity duration-[350ms] ease-in-out motion-reduce:transition-none ${
            visible ? "opacity-100" : "pointer-events-none opacity-0"
          }`}
          aria-label="Закрыть корзину"
          tabIndex={isOpen ? 0 : -1}
          onClick={() => dispatch(closeCart())}
        />
        <aside
          className={`pointer-events-auto absolute top-0 right-0 z-1 flex h-full max-h-dvh w-[min(100vw,500px)] flex-col border-l border-ink/8 bg-paper bg-[image:linear-gradient(180deg,rgba(239,231,216,0.5)_0%,transparent_26%)] shadow-[-24px_0_60px_rgba(24,22,18,0.18)] transition-[transform] duration-[420ms] ease-[cubic-bezier(0.22,1,0.36,1)] will-change-transform motion-reduce:transition-none motion-reduce:[transform:none] ${
            visible
              ? "[transform:translate3d(0,0,0)]"
              : "[transform:translate3d(104%,0,0)]"
          }`}
          role="dialog"
          aria-modal="true"
          aria-hidden={!visible}
          aria-labelledby="cart-title"
          onTransitionEnd={(e) => {
            if (e.propertyName !== "transform") return;
            if (e.target !== e.currentTarget) return;
            if (!visible) setMounted(false);
          }}
        >
          <header className="flex items-start justify-between gap-3 border-b border-ink/8 px-[1.15rem] pt-[1.15rem] pb-[0.85rem]">
            <div>
              <p className={cartKicker}>Заказ</p>
              <h2 id="cart-title" className={cartTitle}>
                Корзина{count ? ` · ${count}` : ""}
              </h2>
            </div>
            <button
              type="button"
              className={cartCloseButton}
              aria-label="Закрыть"
              onClick={() => dispatch(closeCart())}
            >
              <X
                size={18}
                strokeWidth={2}
                className={cartIcon}
                aria-hidden="true"
              />
            </button>
          </header>

          <div className="flex flex-auto flex-col gap-5 overflow-auto px-[1.15rem] pt-[0.85rem] pb-4">
            {step === "success" && placedOrder ? (
              <div className="relative flex animate-cart-rise flex-col items-center gap-[0.4rem] px-[1.15rem] pt-[1.1rem] pb-[1.55rem] text-center text-ink motion-reduce:animate-none">
                <div
                  className="relative mt-[0.15rem] mb-[0.35rem] grid size-[5.75rem] shrink-0 place-items-center"
                  aria-hidden="true"
                >
                  <span className="pointer-events-none absolute inset-0 animate-success-glow rounded-full bg-[radial-gradient(circle,rgba(107,143,113,0.38)_0%,rgba(107,143,113,0.12)_48%,transparent_72%)] [animation-delay:0.55s] motion-reduce:animate-none" />
                  <span className="pointer-events-none absolute inset-[12%] animate-success-ring rounded-full border-[1.5px] border-olive-soft/45 [animation-delay:0.08s] motion-reduce:animate-none" />
                  <span className="relative z-1 inline-flex size-[3.55rem] items-center justify-center rounded-full bg-olive-soft/16 leading-none text-[#5f8566] shadow-[0_0_0_0_rgba(107,143,113,0.28)] [animation:cartSuccessPop_0.72s_cubic-bezier(0.34,1.45,0.64,1)_0.12s_both,cartSuccessPulse_2.6s_ease-in-out_0.9s_infinite] motion-reduce:animate-none">
                    <CheckCircle2
                      size={34}
                      strokeWidth={1.85}
                      className={cartIcon}
                    />
                  </span>
                </div>
                <ol
                  className={`${cartStepsList} mt-[0.2rem] mb-[0.4rem] w-full`}
                  aria-hidden="true"
                >
                  <li className={cartStepItem("done")}>Корзина</li>
                  <li className={cartStepItem("done")}>Оплата</li>
                  <li className={cartStepItem("current")}>Готово</li>
                </ol>
                <p className={cartKicker}>Готово</p>
                <h3 className={cartCheckoutTitle}>Заказ оформлен</h3>
                <p className="mt-[0.15rem] text-[1.2rem] leading-[1.2] font-[650] tracking-[0.06em] text-clay">
                  № {placedOrder.number}
                </p>
                <p className="mx-auto mt-[0.15rem] mb-3 max-w-[32ch] text-[0.9rem] leading-[1.45] text-ink/65">
                  Заказ отправлен на кухню. Сохраните QR — по нему выдадут заказ
                  на точке или курьер при доставке.
                </p>
                <OrderFulfillmentQr
                  token={placedOrder.fulfillmentToken}
                  orderNumber={placedOrder.number}
                  fulfillmentMode={placedOrder.fulfillmentMode}
                  status={placedOrder.status}
                  className="mt-[0.35rem] mb-[0.85rem] w-full"
                />
                <button
                  type="button"
                  className={cartCheckoutSubmitButton}
                  onClick={() => {
                    setStep("cart");
                    setPlacedOrder(null);
                    dispatch(closeCart());
                    router.push(`/profile/orders/${placedOrder.id}`);
                  }}
                >
                  Открыть заказ
                </button>
                <button
                  type="button"
                  className="mt-[0.45rem] w-full cursor-pointer border-0 bg-transparent py-[0.55rem] text-[11px] leading-none font-[650] tracking-[0.12em] text-ink/55 uppercase hover:text-ink"
                  onClick={() => {
                    setStep("cart");
                    setPlacedOrder(null);
                    dispatch(closeCart());
                  }}
                >
                  Закрыть
                </button>
              </div>
            ) : null}

            {step === "checkout" && customer ? (
              <CheckoutStep
                customer={customer}
                onBack={() => setStep("cart")}
                onSuccess={onOrderSuccess}
              />
            ) : null}

            {step === "cart" ? (
              <>
                {customer ? null : (
                  <div
                    className="mx-[1.15rem] mt-[0.85rem] flex items-center gap-3 border-b border-ink/8 bg-transparent px-[0.85rem] py-3"
                    aria-label="Гость"
                  >
                    <span
                      className="inline-flex size-8 shrink-0 items-center justify-center text-clay"
                      aria-hidden="true"
                    >
                      <User size={16} strokeWidth={2} className={cartIcon} />
                    </span>
                    <div className="flex min-w-0 flex-col gap-[0.15rem]">
                      <strong className="text-[0.95rem] leading-[1.25] font-[650] text-ink">
                        Гостевой заказ
                      </strong>
                      <span className="text-[0.8rem] leading-[1.35] text-ink/62">
                        Для оформления войдите или зарегистрируйтесь
                      </span>
                    </div>
                  </div>
                )}

                <section
                  className="flex flex-col gap-[0.55rem]"
                  aria-label="Получение заказа"
                >
                  <div className="flex flex-col gap-[0.45rem]">
                    <button
                      type="button"
                      className={logisticsRow}
                      aria-expanded={locationOpen}
                      onClick={() => {
                        setLocationOpen((v) => !v);
                        setTimeOpen(false);
                      }}
                    >
                      <span className={logisticsIcon} aria-hidden="true">
                        <ShoppingBag
                          size={20}
                          strokeWidth={1.75}
                          className={cartIcon}
                        />
                      </span>
                      <span className="flex min-w-0 flex-col gap-[0.12rem]">
                        <span className={logisticsLabel}>{locationLabel}</span>
                        <span className={logisticsValue}>{locationValue}</span>
                      </span>
                      <span
                        className={chevron(locationOpen, "text-[1.4rem]")}
                        aria-hidden="true"
                      >
                        <ChevronRight
                          size={18}
                          strokeWidth={2}
                          className={cartIcon}
                        />
                      </span>
                    </button>

                    {locationOpen ? (
                      <div className="flex flex-col gap-[0.45rem] px-[0.1rem] pt-[0.15rem] pb-1">
                        <button
                          type="button"
                          className={optionClass(fulfillmentMode === "pickup")}
                          onClick={() => {
                            if (!pickupPoints.length) return;
                            setPickupPickerOpen(true);
                          }}
                          disabled={!pickupPoints.length}
                        >
                          <span className={optionTitle}>Самовывоз</span>
                          <span className={optionSub}>
                            {pickupPoints.length
                              ? selectedPoint?.name || "Выберите точку"
                              : "Точки пока не добавлены"}
                          </span>
                          {fulfillmentMode === "pickup" && selectedPoint ? (
                            <span className="mt-[0.1rem] text-[0.78rem] text-ink/42">
                              {selectedPoint.address}
                            </span>
                          ) : null}
                        </button>

                        <button
                          type="button"
                          className={optionClass(fulfillmentMode === "delivery")}
                          onClick={() => {
                            dispatch(setFulfillmentMode("delivery"));
                          }}
                        >
                          <span className={optionTitle}>Доставка</span>
                          <span className={optionSub}>
                            {deliveryReady && deliveryAddressLabel
                              ? deliveryAddressLabel
                              : deliveryReady
                                ? "Адрес выбран"
                                : "Введите улицу и дом"}
                          </span>
                        </button>
                        {fulfillmentMode === "delivery" ? (
                          <div className="relative z-10 flex flex-col gap-[0.55rem] pt-[0.1rem] pb-[0.15rem]">
                            <AddressSuggestField
                              initialQuery={
                                deliveryAddressLabel &&
                                !/^(точка на карте|адрес на карте)/i.test(
                                  deliveryAddressLabel,
                                )
                                  ? deliveryAddressLabel
                                  : ""
                              }
                              onPick={(suggestion) => {
                                const address =
                                  suggestion.value ||
                                  suggestion.unrestricted_value;
                                if (
                                  suggestion.lat != null &&
                                  suggestion.lng != null
                                ) {
                                  dispatch(
                                    setDeliveryLocation({
                                      lat: suggestion.lat,
                                      lng: suggestion.lng,
                                      address,
                                    }),
                                  );
                                  return;
                                }
                                dispatch(setDeliveryAddress(address));
                              }}
                            />
                            <p
                              className={cartDeliveryAddress(
                                deliveryLat != null &&
                                  deliveryLng != null &&
                                  inZone,
                              )}
                            >
                              {deliveryLat == null || deliveryLng == null
                                ? "Выберите адрес из списка — или уточните на карте"
                                : inZone
                                  ? deliveryAddressLabel ||
                                    "Адрес в зоне доставки"
                                  : "Сюда пока не доставляем, можно забрать самовывозом"}
                            </p>
                            <button
                              type="button"
                              className="inline-flex min-h-11 w-full cursor-pointer items-center justify-center gap-[0.45rem] rounded-[14px] border border-clay/35 bg-clay/8 px-[0.9rem] py-[0.65rem] text-[11px] leading-none font-bold tracking-[0.12em] text-clay uppercase transition-[background-color,border-color,color] duration-200 hover:border-transparent hover:bg-clay hover:text-paper"
                              onClick={() => setMapModalOpen(true)}
                            >
                              <MapPin
                                size={16}
                                strokeWidth={2}
                                className={cartIcon}
                                aria-hidden="true"
                              />
                              {deliveryReady
                                ? "Уточнить на карте"
                                : "Выбрать на карте"}
                            </button>
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                  </div>

                  <div className="flex flex-col gap-[0.45rem]">
                    <button
                      type="button"
                      className={logisticsRow}
                      aria-expanded={timeOpen}
                      onClick={() => {
                        setTimeOpen((v) => !v);
                        setLocationOpen(false);
                      }}
                    >
                      <span className={logisticsIcon} aria-hidden="true">
                        <Clock
                          size={20}
                          strokeWidth={1.75}
                          className={cartIcon}
                        />
                      </span>
                      <span className="flex min-w-0 flex-col gap-[0.12rem]">
                        <span className={logisticsValue}>{timePrimary}</span>
                        <span className={logisticsLabel}>
                          {CHANGE_TIME_LABEL}
                        </span>
                      </span>
                      <span
                        className={chevron(timeOpen, "text-[1.4rem]")}
                        aria-hidden="true"
                      >
                        <ChevronRight
                          size={18}
                          strokeWidth={2}
                          className={cartIcon}
                        />
                      </span>
                    </button>

                    {timeOpen ? (
                      <div className="flex flex-col gap-[0.45rem] px-[0.1rem] pt-[0.15rem] pb-1">
                        <button
                          type="button"
                          className={optionClass(timeMode === "asap")}
                          onClick={() => {
                            dispatch(setTimeMode("asap"));
                            setTimeOpen(false);
                          }}
                        >
                          <span className={optionTitle}>{ASAP_LABEL}</span>
                          <span className={optionSub}>Как можно скорее</span>
                        </button>
                        {timeSlots.length ? (
                          <div
                            className="grid max-h-[220px] grid-cols-3 gap-[0.4rem] overflow-auto p-[0.1rem]"
                            role="listbox"
                            aria-label="Время"
                          >
                            {timeSlots.map((slot) => {
                              const active =
                                timeMode === "scheduled" &&
                                scheduledAt === slot.id;
                              return (
                                <button
                                  key={slot.id}
                                  type="button"
                                  role="option"
                                  aria-selected={active}
                                  className={`flex min-h-[52px] cursor-pointer flex-col items-center gap-[0.1rem] rounded-xl border px-[0.3rem] py-[0.45rem] text-ink transition-[border-color,background-color] duration-200 ${
                                    active
                                      ? "border-clay/50 bg-clay/10"
                                      : "border-ink/8 bg-white/72 hover:border-clay/30"
                                  }`}
                                  onClick={() => {
                                    dispatch(setScheduledAt(slot.id));
                                    setTimeOpen(false);
                                  }}
                                >
                                  <span className="text-[0.68rem] tracking-[0.04em] text-ink/45 uppercase">
                                    {slot.dayLabel}
                                  </span>
                                  <span className="text-[0.92rem] leading-[1.1] font-[650]">
                                    {slot.timeLabel}
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        ) : (
                          <p className={slotsEmpty}>
                            На сегодня слотов нет — попробуйте завтра или ASAP.
                          </p>
                        )}
                      </div>
                    ) : null}
                  </div>
                </section>

                {!items.length ? (
                  <p className="my-6 text-center font-serif leading-[1.45] text-ink/50 italic">
                    Пока пусто. Добавьте блюда из меню — они появятся здесь.
                  </p>
                ) : (
                  <ul className="m-0 flex list-none flex-col gap-3 p-0">
                    {items.map((line) => (
                      <li
                        key={line.id}
                        className="grid grid-cols-[72px_minmax(0,1fr)] gap-3 rounded-2xl border border-ink/7 bg-white/62 p-[0.65rem]"
                      >
                        <div
                          className={`${mediaPlaceholder} size-[72px] rounded-xl bg-[linear-gradient(145deg,#efe7d8,#fbf8f1)] text-[9px] tracking-[0.08em] overflow-hidden text-center`}
                          aria-hidden={!line.image}
                        >
                          {line.image ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={line.image}
                              alt=""
                              className="block size-full object-cover"
                            />
                          ) : (
                            <span>Нет фото</span>
                          )}
                        </div>
                        <div className="flex min-w-0 flex-col gap-1">
                          <div className="flex items-start justify-between gap-2">
                            <strong className="font-serif text-[1.12rem] leading-[1.15] font-medium text-ink">
                              {line.name}
                            </strong>
                            <button
                              type="button"
                              className="cursor-pointer border-0 bg-transparent p-0 text-[10px] tracking-[0.08em] text-ink/40 uppercase hover:text-clay"
                              aria-label={`Удалить ${line.name}`}
                              onClick={() => dispatch(removeFromCart(line.id))}
                            >
                              Удалить
                            </button>
                          </div>
                          {line.categoryName ? (
                            <p className="text-[11px] text-ink/45">
                              {line.categoryName}
                            </p>
                          ) : null}
                          <div className="mt-1 flex items-center justify-between gap-2">
                            <div className={qtyBox("bg-paper/90")}>
                              <button
                                type="button"
                                className={qtyButton}
                                aria-label="Меньше"
                                onClick={() => dispatch(decrementQty(line.id))}
                              >
                                −
                              </button>
                              <span className={qtyValue}>{line.qty}</span>
                              <button
                                type="button"
                                className={qtyButton}
                                aria-label="Больше"
                                onClick={() => dispatch(incrementQty(line.id))}
                              >
                                +
                              </button>
                            </div>
                            <p className="font-serif text-[1.1rem] text-clay">
                              {formatPrice(String(cartLineTotal(line)))}
                            </p>
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}

                <div className="flex flex-col gap-[0.55rem]">
                  <div className={extraRow}>
                    <div className={extraLabel}>
                      <span className={extraIcon} aria-hidden="true">
                        <Utensils
                          size={18}
                          strokeWidth={1.75}
                          className={cartIcon}
                        />
                      </span>
                      <span>Приборы</span>
                    </div>
                    <div className={qtyBox("bg-paper/95")}>
                      <button
                        type="button"
                        className={qtyButton}
                        aria-label="Меньше приборов"
                        onClick={() => dispatch(decrementUtensils())}
                      >
                        −
                      </button>
                      <span className={qtyValue}>{utensils}</span>
                      <button
                        type="button"
                        className={qtyButton}
                        aria-label="Больше приборов"
                        onClick={() => dispatch(incrementUtensils())}
                      >
                        +
                      </button>
                    </div>
                  </div>

                  <div className="flex flex-col gap-[0.45rem]">
                    <button
                      type="button"
                      className={`${extraRow} cursor-pointer transition-[background-color,border-color] duration-200 hover:border-clay/22 hover:bg-white/95`}
                      aria-expanded={commentOpen}
                      onClick={() => dispatch(toggleComment())}
                    >
                      <div className={extraLabel}>
                        <span className={extraIcon} aria-hidden="true">
                          <MessageSquare
                            size={18}
                            strokeWidth={1.75}
                            className={cartIcon}
                          />
                        </span>
                        <span>Комментарий к заказу</span>
                      </div>
                      <span
                        className={chevron(commentOpen, "text-[1.35rem]")}
                        aria-hidden="true"
                      >
                        <ChevronRight
                          size={18}
                          strokeWidth={2}
                          className={cartIcon}
                        />
                      </span>
                    </button>
                    {commentOpen ? (
                      <div className="px-[0.15rem]">
                        <textarea
                          className="min-h-[84px] w-full resize-y rounded-[14px] border border-ink/10 bg-white/85 px-[0.85rem] py-3 text-[0.92rem] leading-[1.45] font-medium text-ink outline-none focus:border-clay/45 focus:shadow-[0_0_0_3px_rgba(156,107,74,0.1)]"
                          value={comment}
                          onChange={(e) => dispatch(setComment(e.target.value))}
                          placeholder="Например: без лука, позвонить за 10 минут…"
                          rows={3}
                          maxLength={500}
                        />
                        <p className="mx-[0.15rem] mt-[0.35rem] text-right text-[10px] tracking-[0.08em] text-ink/40">
                          {comment.length}/500
                        </p>
                      </div>
                    ) : comment.trim() ? (
                      <p className="mx-[0.2rem] px-[0.65rem] pb-[0.15rem] text-[0.88rem] leading-[1.4] text-ink/55 italic">
                        {comment.trim()}
                      </p>
                    ) : null}
                  </div>
                </div>

                {items.length && suggestedProducts.length ? (
                  <section
                    className="border-t border-ink/8 pt-[0.35rem]"
                    aria-label="Рекомендуем"
                  >
                    <header className="mb-[0.7rem]">
                      <p className={cartKicker}>{suggestions.kicker}</p>
                      <h3 className="font-serif text-[1.25rem] text-ink">
                        {suggestions.title}
                      </h3>
                    </header>
                    <div className="grid auto-cols-[minmax(148px,160px)] grid-flow-col gap-[0.65rem] overflow-x-auto pb-1">
                      {suggestedProducts.map((product) => (
                        <SuggestedCard
                          key={product.id}
                          product={product}
                          onAdd={() => dispatch(addToCart(product))}
                        />
                      ))}
                    </div>
                  </section>
                ) : null}
              </>
            ) : null}
          </div>

          {step === "cart" ? (
            <footer className="border-t border-ink/8 bg-paper/92 px-[1.15rem] pt-[0.85rem] pb-[1.15rem]">
              {!ordersEnabled ? (
                <p className="mb-3 rounded-[12px] border border-clay/25 bg-clay/8 px-3 py-2 text-[0.85rem] text-ink/70">
                  Приём заказов временно приостановлен.
                </p>
              ) : null}
              {fulfillmentMode === "delivery" && !totals.meetsMinimum ? (
                <p className="mb-3 rounded-[12px] border border-ink/10 bg-ink/4 px-3 py-2 text-[0.85rem] text-ink/65">
                  До минимальной суммы доставки ещё{" "}
                  {formatPrice(String(totals.minRemainingRub))}
                </p>
              ) : null}
              {fulfillmentMode === "delivery" &&
              deliveryLat != null &&
              deliveryLng != null &&
              !inZone ? (
                <p className="mb-3 rounded-[12px] border border-danger/20 bg-danger/6 px-3 py-2 text-[0.85rem] text-danger">
                  Сюда пока не доставляем, можно забрать самовывозом.
                </p>
              ) : null}
              <div className="mb-2 flex items-baseline justify-between text-[0.9rem] text-ink/55">
                <span>Товары</span>
                <span>{formatPrice(String(totals.subtotalRub))}</span>
              </div>
              {fulfillmentMode === "delivery" ? (
                <div className="mb-2 flex items-baseline justify-between text-[0.9rem] text-ink/55">
                  <span>Доставка</span>
                  <span>
                    {totals.deliveryFeeRub > 0
                      ? formatPrice(String(totals.deliveryFeeRub))
                      : "0 ₽"}
                  </span>
                </div>
              ) : null}
              <div className="mb-3 flex items-baseline justify-between text-[0.95rem] text-ink/55">
                <span>К оплате</span>
                <strong className="font-serif text-[1.45rem] font-medium text-ink">
                  {formatPrice(String(totals.totalRub))}
                </strong>
              </div>
              <button
                type="button"
                className={cartCheckoutButton}
                disabled={
                  checkoutBusy ||
                  !ordersEnabled ||
                  !items.length ||
                  !totals.meetsMinimum ||
                  (fulfillmentMode === "pickup" && !selectedPoint) ||
                  (fulfillmentMode === "delivery" && !deliveryReady) ||
                  (timeMode === "scheduled" && !scheduledAt)
                }
                onClick={() => void onCheckout()}
              >
                {checkoutBusy
                  ? "Сохраняем…"
                  : customer
                    ? "Оформить заказ"
                    : "Войти и оформить"}
              </button>
              <p className="mt-[0.55rem] text-center text-[11px] text-ink/42">
                {checkoutNote ||
                  (customer
                    ? "Корзина сохранена в вашем аккаунте."
                    : "Корзина хранится на этом устройстве до входа.")}
              </p>
            </footer>
          ) : null}
        </aside>
      </div>

      <PickupPointPickerModal
        open={pickupPickerOpen}
        points={pickupPoints}
        selectedId={pickupPointId}
        onClose={() => setPickupPickerOpen(false)}
        onConfirm={(id) => {
          dispatch(setPickupPointId(id));
          dispatch(setFulfillmentMode("pickup"));
          setPickupPickerOpen(false);
          setLocationOpen(false);
        }}
      />

      <DeliveryMapModal
        open={mapModalOpen}
        initialLat={deliveryLat}
        initialLng={deliveryLng}
        onClose={() => setMapModalOpen(false)}
        onSave={(data) => {
          dispatch(setDeliveryLocation(data));
          setMapModalOpen(false);
          setLocationOpen(false);
        }}
      />
    </>
  );
};

const mediaPlaceholder =
  "grid place-items-center text-ink/40 uppercase";

const logisticsRow =
  "grid min-h-16 w-full cursor-pointer grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-[18px] border-0 bg-ink/5 px-[0.9rem] py-3 text-left text-ink transition-[background-color] duration-200 hover:bg-ink/8";
const logisticsIcon =
  "inline-flex size-7 shrink-0 items-center justify-center text-ink";
const logisticsLabel = "text-[0.82rem] leading-[1.2] text-ink/48";
const logisticsValue =
  "overflow-hidden text-[0.98rem] leading-[1.25] font-semibold text-ellipsis whitespace-nowrap text-ink";

const chevron = (open: boolean, size: string): string =>
  `inline-flex w-5 items-center justify-center ${size} leading-none transition-[rotate,color] duration-200 ${
    open ? "rotate-90 text-clay" : "text-ink/35"
  }`;

const optionClass = (active: boolean): string =>
  `flex w-full cursor-pointer flex-col items-start gap-[0.15rem] rounded-[14px] border px-[0.9rem] py-3 text-left text-ink transition-[border-color,background-color] duration-200 ${
    active
      ? "border-clay/45 bg-clay/8"
      : "border-ink/8 bg-white/72 hover:border-clay/28"
  }`;
const optionTitle = "text-[0.95rem] leading-[1.2] font-[650]";
const optionSub = "text-[0.82rem] leading-[1.3] text-ink/50";
const slotsEmpty = "px-1 py-[0.35rem] text-[0.85rem] leading-[1.4] text-ink/50";

const qtyBox = (bg: string): string =>
  `inline-flex items-center gap-[0.35rem] rounded-full border border-ink/10 p-[0.15rem] ${bg}`;
const qtyButton =
  "size-7 cursor-pointer rounded-full border-0 bg-transparent text-base text-ink hover:bg-clay/12";
const qtyValue = "min-w-5 text-center text-[0.9rem] font-semibold";

const extraRow =
  "flex min-h-[54px] w-full items-center justify-between gap-3 rounded-2xl border border-ink/7 bg-white/72 px-[0.85rem] py-[0.65rem] text-left text-ink";
const extraLabel =
  "inline-flex items-center gap-[0.65rem] text-[0.95rem] font-[550]";
const extraIcon =
  "inline-flex size-5 shrink-0 items-center justify-center text-ink";

const SuggestedCard = ({
  product,
  onAdd,
}: {
  product: CartProduct;
  onAdd: () => void;
}) => (
  <article className="flex h-full min-h-full flex-col overflow-hidden rounded-[14px] border border-ink/7 bg-white/70">
    <div
      className={`${mediaPlaceholder} aspect-[4/3] shrink-0 bg-[linear-gradient(145deg,#efe7d8,#fbf8f1)] text-[9px] tracking-[0.1em]`}
    >
      {product.image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={product.image}
          alt=""
          className="block size-full object-cover"
        />
      ) : (
        <span>Нет фото</span>
      )}
    </div>
    <div className="flex min-h-0 flex-auto flex-col gap-1 px-[0.6rem] pt-[0.55rem] pb-[0.65rem]">
      <strong className="font-serif text-[0.98rem] leading-[1.15] font-medium text-ink">
        {product.name}
      </strong>
      <span className="text-[0.85rem] text-clay">
        {formatPrice(product.price)}
      </span>
      <button
        type="button"
        className="mt-auto cursor-pointer rounded-full border border-clay/35 bg-transparent px-[0.55rem] py-[0.4rem] text-[10px] font-bold tracking-[0.12em] text-clay uppercase hover:border-transparent hover:bg-clay hover:text-paper"
        onClick={onAdd}
      >
        Добавить
      </button>
    </div>
  </article>
);
