"use client";

import { MapPin } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { updateProfileAction } from "@/actions/customer-profile";
import { AddressSuggestField } from "@/components/cart/AddressSuggestField";
import { DeliveryMapModal } from "@/components/cart/DeliveryMapModal";
import { PickupPointPickerModal } from "@/components/cart/PickupPointPickerModal";
import { PushOptIn } from "@/components/profile/PushOptIn";
import { TelegramOptIn } from "@/components/profile/TelegramOptIn";
import {
  profileBadge,
  profileBlockTitle,
  profileEditBtn,
  profileLead,
  profilePanelCard,
  profilePanelHead,
  profileTitle,
} from "@/components/profile/profile-styles";
import { PhoneInput } from "@/components/ui/PhoneInput";
import type {
  CustomerPublic,
  FulfillmentMode,
} from "@/lib/customer-auth";
import { formatPhoneDisplay } from "@/lib/phone";
import type { PickupPointPublic } from "@/lib/pickup-points";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import {
  setDeliveryAddress as setCartDeliveryAddress,
  setDeliveryLocation as setCartDeliveryLocation,
  setFulfillmentMode as setCartFulfillmentMode,
  setPickupPointId as setCartPickupPointId,
} from "@/store/cartSlice";

interface ProfilePageProps {
  customer: CustomerPublic;
  pickupPoints: PickupPointPublic[];
}

const formatBirthday = (iso: string | null): string => {
  if (!iso) return "Не указан";
  try {
    return new Date(`${iso}T12:00:00`).toLocaleDateString("ru-RU", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  } catch {
    return iso;
  }
};

const sectionsClass = "flex flex-col gap-5";
const blockHeadClass = "mb-[0.65rem]";
const fieldsClass =
  "grid overflow-hidden rounded-[14px] border border-ink/10 bg-paper/55";

const formFieldClass =
  "flex flex-col gap-[0.35rem] text-[0.72rem] tracking-[0.1em] text-ink/48 uppercase";
const formControlClass =
  "rounded-xl border border-ink/10 bg-white px-[0.85rem] py-3 text-[0.95rem] leading-[1.35] font-medium tracking-normal text-ink normal-case outline-none focus:border-clay/50 focus:shadow-[0_0_0_3px_rgba(156,107,74,0.12)]";

const btnBaseClass =
  "inline-flex min-h-11 cursor-pointer items-center justify-center rounded-full border px-[1.15rem] font-sans text-[12px] leading-none font-[650] tracking-[0.1em] uppercase no-underline transition-colors duration-180 disabled:cursor-wait disabled:opacity-50";
const btnPrimaryClass = `${btnBaseClass} border-transparent bg-ink text-paper hover:enabled:bg-clay-deep`;
const btnLineClass = `${btnBaseClass} border-ink/10 bg-transparent text-ink hover:enabled:border-clay/20 hover:enabled:bg-clay/6`;

const fulfillCardClass = (active: boolean, editable: boolean): string =>
  `flex flex-col items-start gap-[0.3rem] rounded-[14px] border px-[0.95rem] py-[0.9rem] text-left text-ink ${
    active ? "border-clay/45 bg-clay/10" : "border-ink/10 bg-paper/65"
  }${
    editable
      ? " cursor-pointer transition-colors duration-180 hover:border-clay/20"
      : ""
  }`;
const fulfillLabelClass =
  "text-[0.7rem] font-[650] tracking-[0.12em] text-clay uppercase";
const fulfillValueClass =
  "font-sans text-[0.92rem] leading-[1.3] font-[650]";
const fulfillGridClass = "grid grid-cols-2 gap-[0.65rem] max-[560px]:grid-cols-1";

const Field = ({ label, value }: { label: string; value: string }) => (
  <div className="grid grid-cols-[minmax(7rem,10rem)_1fr] gap-3 border-b border-ink/10 px-4 py-[0.85rem] last:border-b-0 max-[560px]:grid-cols-1 max-[560px]:gap-1">
    <span className="text-[0.8rem] text-ink/48">{label}</span>
    <strong className="font-sans text-[0.95rem] leading-[1.35] font-[650]">
      {value}
    </strong>
  </div>
);

const isAutoMapAddress = (address: string): boolean =>
  /^(точка на карте|адрес на карте)/i.test(address.trim());

const formatDeliveryLabel = (
  address: string,
  lat: number | null,
  lng: number | null,
): string => {
  const trimmed = address.trim();
  if (trimmed && !isAutoMapAddress(trimmed)) return trimmed;
  if (lat != null && lng != null) {
    return "Адрес сохранён и выбран на карте";
  }
  return "Адрес пока не указан";
};

const formatMapStatus = (hasPoint: boolean): string =>
  hasPoint
    ? "Адрес сохранён и выбран на карте"
    : "Точка на карте ещё не выбрана";

type LogisticsSnapshot = {
  mode: FulfillmentMode;
  address: string;
  lat: number | null;
  lng: number | null;
  pickupPointId: string | null;
};

export const ProfilePage = ({
  customer: initial,
  pickupPoints,
}: ProfilePageProps) => {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const cartMode = useAppSelector((s) => s.cart.fulfillmentMode);
  const cartAddress = useAppSelector((s) => s.cart.deliveryAddress);
  const cartLat = useAppSelector((s) => s.cart.deliveryLat);
  const cartLng = useAppSelector((s) => s.cart.deliveryLng);
  const cartPickupPointId = useAppSelector((s) => s.cart.pickupPointId);

  const [customer, setCustomer] = useState(initial);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [mapOpen, setMapOpen] = useState(false);
  const [pickupPickerOpen, setPickupPickerOpen] = useState(false);

  const [name, setName] = useState(initial.name ?? "");
  const [surname, setSurname] = useState(initial.surname ?? "");
  const [phone, setPhone] = useState(
    initial.phone ? formatPhoneDisplay(initial.phone) : "",
  );
  const [deliveryAddress, setDeliveryAddress] = useState(
    initial.deliveryAddress ?? "",
  );
  const [fulfillmentMode, setFulfillmentMode] = useState<FulfillmentMode>(
    initial.fulfillmentMode ?? "pickup",
  );
  const [editLat, setEditLat] = useState<number | null>(
    initial.deliveryLat ?? null,
  );
  const [editLng, setEditLng] = useState<number | null>(
    initial.deliveryLng ?? null,
  );
  const [pickupPointId, setPickupPointId] = useState<string | null>(
    initial.pickupPointId ?? null,
  );
  const [editSnapshot, setEditSnapshot] = useState<LogisticsSnapshot | null>(
    null,
  );

  // Seed cart from saved profile logistics if cart is empty for that mode.
  useEffect(() => {
    if (
      initial.fulfillmentMode === "delivery" &&
      initial.deliveryLat != null &&
      initial.deliveryLng != null &&
      cartLat == null &&
      cartLng == null
    ) {
      dispatch(
        setCartDeliveryLocation({
          lat: initial.deliveryLat,
          lng: initial.deliveryLng,
          address: initial.deliveryAddress ?? undefined,
        }),
      );
      dispatch(setCartFulfillmentMode("delivery"));
    }
    if (
      initial.fulfillmentMode === "pickup" &&
      initial.pickupPointId &&
      !cartPickupPointId
    ) {
      dispatch(setCartPickupPointId(initial.pickupPointId));
      dispatch(setCartFulfillmentMode("pickup"));
    }
  }, [
    cartLat,
    cartLng,
    cartPickupPointId,
    dispatch,
    initial.deliveryAddress,
    initial.deliveryLat,
    initial.deliveryLng,
    initial.fulfillmentMode,
    initial.pickupPointId,
  ]);

  useEffect(() => {
    if (editing) return;
    setFulfillmentMode(cartMode);
    setDeliveryAddress(
      cartAddress.trim() || customer.deliveryAddress || "",
    );
    setEditLat(cartLat ?? customer.deliveryLat);
    setEditLng(cartLng ?? customer.deliveryLng);
    setPickupPointId(cartPickupPointId ?? customer.pickupPointId);
  }, [
    cartMode,
    cartAddress,
    cartLat,
    cartLng,
    cartPickupPointId,
    customer.deliveryAddress,
    customer.deliveryLat,
    customer.deliveryLng,
    customer.pickupPointId,
    editing,
  ]);

  useEffect(() => {
    setCustomer(initial);
  }, [initial]);

  const phoneDisplay = customer.phone
    ? formatPhoneDisplay(customer.phone)
    : null;

  const liveMode = editing ? fulfillmentMode : cartMode;
  const liveLat = editing ? editLat : (cartLat ?? customer.deliveryLat);
  const liveLng = editing ? editLng : (cartLng ?? customer.deliveryLng);
  const livePickupId = editing
    ? pickupPointId
    : (cartPickupPointId ?? customer.pickupPointId);
  const selectedPickup = useMemo(() => {
    if (!pickupPoints.length) return null;
    return (
      pickupPoints.find((p) => p.id === livePickupId) ??
      pickupPoints[0] ??
      null
    );
  }, [livePickupId, pickupPoints]);
  const liveAddressLabel = formatDeliveryLabel(
    editing
      ? deliveryAddress
      : cartAddress || customer.deliveryAddress || "",
    liveLat,
    liveLng,
  );

  const applyMode = (mode: FulfillmentMode) => {
    setFulfillmentMode(mode);
    dispatch(setCartFulfillmentMode(mode));
    if (mode === "delivery") {
      setPickupPickerOpen(false);
      return;
    }
    if (mode === "pickup") {
      if (!pickupPointId && pickupPoints[0]) {
        applyPickupPoint(pickupPoints[0].id);
      }
      setPickupPickerOpen(true);
    }
  };

  const applyPickupPoint = (id: string) => {
    setPickupPointId(id);
    setFulfillmentMode("pickup");
    dispatch(setCartPickupPointId(id));
    dispatch(setCartFulfillmentMode("pickup"));
  };

  const applyAddress = (value: string) => {
    setDeliveryAddress(value);
    dispatch(setCartDeliveryAddress(value));
  };

  const applyMapPoint = (data: { lat: number; lng: number }) => {
    const address =
      deliveryAddress.trim() && !isAutoMapAddress(deliveryAddress)
        ? deliveryAddress.trim()
        : "Адрес на карте";
    setEditLat(data.lat);
    setEditLng(data.lng);
    setFulfillmentMode("delivery");
    if (!deliveryAddress.trim() || isAutoMapAddress(deliveryAddress)) {
      setDeliveryAddress(address);
    }
    dispatch(
      setCartDeliveryLocation({
        lat: data.lat,
        lng: data.lng,
        address,
      }),
    );
    setMapOpen(false);
  };

  const openEdit = () => {
    const address = cartAddress.trim() || customer.deliveryAddress || "";
    const lat = cartLat ?? customer.deliveryLat;
    const lng = cartLng ?? customer.deliveryLng;
    const pointId = cartPickupPointId ?? customer.pickupPointId;
    setName(customer.name ?? "");
    setSurname(customer.surname ?? "");
    setPhone(customer.phone ? formatPhoneDisplay(customer.phone) : "");
    setDeliveryAddress(address);
    setFulfillmentMode(cartMode);
    setEditLat(lat);
    setEditLng(lng);
    setPickupPointId(pointId);
    setEditSnapshot({
      mode: cartMode,
      address,
      lat,
      lng,
      pickupPointId: pointId,
    });
    setPickupPickerOpen(cartMode === "pickup");
    setError("");
    setEditing(true);
  };

  const cancelEdit = () => {
    if (editSnapshot) {
      dispatch(setCartFulfillmentMode(editSnapshot.mode));
      dispatch(setCartDeliveryAddress(editSnapshot.address));
      dispatch(setCartPickupPointId(editSnapshot.pickupPointId));
      if (editSnapshot.lat != null && editSnapshot.lng != null) {
        dispatch(
          setCartDeliveryLocation({
            lat: editSnapshot.lat,
            lng: editSnapshot.lng,
            address: editSnapshot.address,
          }),
        );
      }
      setFulfillmentMode(editSnapshot.mode);
      setDeliveryAddress(editSnapshot.address);
      setEditLat(editSnapshot.lat);
      setEditLng(editSnapshot.lng);
      setPickupPointId(editSnapshot.pickupPointId);
    }
    setEditSnapshot(null);
    setMapOpen(false);
    setPickupPickerOpen(false);
    setEditing(false);
    setError("");
  };

  const onSave = async () => {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      if (
        fulfillmentMode === "delivery" &&
        (editLat == null || editLng == null)
      ) {
        setError("Отметьте точку доставки на карте");
        setMapOpen(true);
        return;
      }
      if (fulfillmentMode === "pickup" && !pickupPointId) {
        setError("Выберите точку самовывоза");
        setPickupPickerOpen(true);
        return;
      }

      const addressForSave =
        deliveryAddress.trim() ||
        (editLat != null && editLng != null ? "Адрес на карте" : "");

      const result = await updateProfileAction({
        name,
        surname,
        phone,
        deliveryAddress: addressForSave,
        deliveryLat: fulfillmentMode === "delivery" ? editLat : null,
        deliveryLng: fulfillmentMode === "delivery" ? editLng : null,
        pickupPointId: fulfillmentMode === "pickup" ? pickupPointId : null,
        fulfillmentMode,
      });
      if (!result.success || !result.data) {
        setError(result.success ? "Ошибка" : result.error);
        return;
      }

      dispatch(setCartFulfillmentMode(fulfillmentMode));
      if (
        fulfillmentMode === "delivery" &&
        result.data.deliveryLat != null &&
        result.data.deliveryLng != null
      ) {
        dispatch(
          setCartDeliveryLocation({
            lat: result.data.deliveryLat,
            lng: result.data.deliveryLng,
            address: result.data.deliveryAddress ?? addressForSave,
          }),
        );
      } else if (fulfillmentMode === "pickup" && result.data.pickupPointId) {
        dispatch(setCartPickupPointId(result.data.pickupPointId));
      } else if (addressForSave) {
        dispatch(setCartDeliveryAddress(addressForSave));
      }

      setCustomer(result.data);
      setDeliveryAddress(result.data.deliveryAddress ?? "");
      setFulfillmentMode(result.data.fulfillmentMode);
      setEditLat(result.data.deliveryLat);
      setEditLng(result.data.deliveryLng);
      setPickupPointId(result.data.pickupPointId);
      setEditSnapshot(null);
      setPickupPickerOpen(false);
      setEditing(false);
      router.refresh();
    } finally {
      setBusy(false);
    }
  };

  const pointReady = liveLat != null && liveLng != null;
  const pickupReady = Boolean(selectedPickup);

  return (
    <div className={profilePanelCard}>
      <header className={profilePanelHead}>
        <div>
          <p className={profileBadge}>Профиль</p>
          <h2 className={profileTitle}>Личные данные</h2>
          <p className={profileLead}>
            Способ получения, точка самовывоза и адрес доставки сохраняются и
            совпадают с корзиной.
          </p>
        </div>
        {!editing ? (
          <button
            type="button"
            className={profileEditBtn}
            disabled={busy}
            onClick={openEdit}
          >
            Изменить
          </button>
        ) : null}
      </header>

      {editing ? (
        <div className={sectionsClass}>
          <section>
            <div className={blockHeadClass}>
              <h3 className={profileBlockTitle}>Контакты</h3>
            </div>
            <div className="grid gap-3 min-[640px]:grid-cols-2">
              <label className={formFieldClass}>
                <span>Имя</span>
                <input
                  className={formControlClass}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoComplete="given-name"
                  placeholder="Александр"
                />
              </label>
              <label className={formFieldClass}>
                <span>Фамилия</span>
                <input
                  className={formControlClass}
                  value={surname}
                  onChange={(e) => setSurname(e.target.value)}
                  autoComplete="family-name"
                  placeholder="Иванов"
                />
              </label>
              <div className={`${formFieldClass} min-[640px]:col-span-full`}>
                <span>Телефон</span>
                <PhoneInput
                  className={formControlClass}
                  value={phone}
                  onChange={setPhone}
                  placeholder="+7 900 000-00-00"
                />
              </div>
            </div>
          </section>

          <section>
            <div className={blockHeadClass}>
              <h3 className={profileBlockTitle}>Получение заказа</h3>
            </div>
            <div className={fulfillGridClass}>
              <button
                type="button"
                className={fulfillCardClass(fulfillmentMode === "pickup", true)}
                onClick={() => applyMode("pickup")}
              >
                <span className={fulfillLabelClass}>Самовывоз</span>
                <strong className={fulfillValueClass}>
                  {selectedPickup?.name || "Выберите точку"}
                </strong>
              </button>
              <button
                type="button"
                className={fulfillCardClass(
                  fulfillmentMode === "delivery",
                  true,
                )}
                onClick={() => applyMode("delivery")}
              >
                <span className={fulfillLabelClass}>Доставка</span>
                <strong className={fulfillValueClass}>
                  {pointReady ? "Адрес выбран" : "Отметьте на карте"}
                </strong>
              </button>
            </div>
            {fulfillmentMode === "pickup" ? (
              <div className="mt-3 flex flex-col gap-2">
                {pickupPoints.length ? (
                  <button
                    type="button"
                    className={`${btnLineClass} w-full justify-between gap-3 px-[0.95rem] text-left normal-case tracking-normal`}
                    onClick={() => setPickupPickerOpen(true)}
                  >
                    <span className="flex min-w-0 flex-col gap-[0.2rem]">
                      <span className="text-[0.72rem] font-[650] tracking-[0.12em] text-ink/48 uppercase">
                        Точка самовывоза
                      </span>
                      <strong className="truncate font-sans text-[0.95rem] font-[650] text-ink">
                        {selectedPickup?.name || "Выберите точку"}
                      </strong>
                      {selectedPickup ? (
                        <span className="truncate text-[0.82rem] font-normal tracking-normal text-ink/55 normal-case">
                          {selectedPickup.address}
                        </span>
                      ) : null}
                    </span>
                    <span className="shrink-0 text-[11px] font-[650] tracking-[0.1em] text-clay uppercase">
                      {selectedPickup ? "Изменить" : "Выбрать"}
                    </span>
                  </button>
                ) : (
                  <p className="m-0 text-[0.9rem] text-ink/55">
                    Точки самовывоза пока не добавлены.
                  </p>
                )}
              </div>
            ) : null}
            {fulfillmentMode === "delivery" ? (
              <div className="relative z-10 mt-3 flex flex-col gap-3">
                <AddressSuggestField
                  initialQuery={
                    isAutoMapAddress(deliveryAddress) ? "" : deliveryAddress
                  }
                  onPick={(suggestion) => {
                    const address =
                      suggestion.value || suggestion.unrestricted_value;
                    applyAddress(address);
                    if (suggestion.lat != null && suggestion.lng != null) {
                      setEditLat(suggestion.lat);
                      setEditLng(suggestion.lng);
                      setFulfillmentMode("delivery");
                      dispatch(
                        setCartDeliveryLocation({
                          lat: suggestion.lat,
                          lng: suggestion.lng,
                          address,
                        }),
                      );
                    }
                  }}
                />
                <div className="rounded-[14px] border border-ink/10 bg-paper/65 px-[0.95rem] py-[0.85rem]">
                  <p className="m-0 text-[0.9rem] font-[650] text-ink">
                    {formatMapStatus(pointReady)}
                  </p>
                  <button
                    type="button"
                    className={`${btnLineClass} mt-3 w-full gap-[0.45rem]`}
                    onClick={() => setMapOpen(true)}
                  >
                    <MapPin size={15} strokeWidth={2} aria-hidden="true" />
                    {pointReady ? "Уточнить на карте" : "Выбрать на карте"}
                  </button>
                </div>
              </div>
            ) : null}
          </section>

          {error ? (
            <p className="rounded-xl bg-danger/8 px-[0.85rem] py-[0.7rem] text-[0.9rem] text-danger">
              {error}
            </p>
          ) : null}

          <div className="flex flex-wrap gap-[0.55rem]">
            <button
              type="button"
              className={btnPrimaryClass}
              disabled={busy}
              onClick={() => void onSave()}
            >
              {busy ? "Сохранение…" : "Сохранить"}
            </button>
            <button
              type="button"
              className={btnLineClass}
              disabled={busy}
              onClick={cancelEdit}
            >
              Отмена
            </button>
          </div>
        </div>
      ) : (
        <div className={sectionsClass}>
          <section>
            <div className={blockHeadClass}>
              <h3 className={profileBlockTitle}>Контакты</h3>
            </div>
            <div className={fieldsClass}>
              <Field label="Имя" value={customer.name || "—"} />
              <Field label="Фамилия" value={customer.surname || "—"} />
              <Field label="Телефон" value={phoneDisplay || "—"} />
              <Field label="Email" value={customer.email || "Не указан"} />
              <Field
                label="День рождения"
                value={formatBirthday(customer.birthday)}
              />
            </div>
          </section>

          <PushOptIn />
          <TelegramOptIn />

          <section>
            <div className={blockHeadClass}>
              <h3 className={profileBlockTitle}>Получение заказа</h3>
            </div>
            <div className={fulfillGridClass}>
              <div className={fulfillCardClass(liveMode === "pickup", false)}>
                <span className={fulfillLabelClass}>Самовывоз</span>
                <strong className={fulfillValueClass}>
                  {selectedPickup?.name || "Точка не выбрана"}
                </strong>
              </div>
              <div className={fulfillCardClass(liveMode === "delivery", false)}>
                <span className={fulfillLabelClass}>Доставка</span>
                <strong className={fulfillValueClass}>
                  {liveAddressLabel}
                </strong>
              </div>
            </div>
            <div className={`${fieldsClass} mt-3`}>
              {liveMode === "pickup" ? (
                <>
                  <Field
                    label="Точка"
                    value={
                      selectedPickup
                        ? `${selectedPickup.name} · ${selectedPickup.address}`
                        : "Не выбрана"
                    }
                  />
                  <Field
                    label="Статус"
                    value={
                      pickupReady
                        ? "Сохранена и выбрана"
                        : "Не выбрана"
                    }
                  />
                </>
              ) : (
                <>
                  <Field label="Адрес" value={liveAddressLabel} />
                  <Field
                    label="На карте"
                    value={
                      pointReady ? "Сохранён и выбран" : "Не выбран"
                    }
                  />
                </>
              )}
              <Field
                label="Способ"
                value={
                  liveMode === "delivery"
                    ? "Доставка по адресу"
                    : "Самовывоз"
                }
              />
            </div>
          </section>
        </div>
      )}

      <PickupPointPickerModal
        open={pickupPickerOpen}
        points={pickupPoints}
        selectedId={pickupPointId}
        onClose={() => setPickupPickerOpen(false)}
        onConfirm={(id) => {
          applyPickupPoint(id);
          setPickupPickerOpen(false);
        }}
      />

      <DeliveryMapModal
        open={mapOpen}
        initialLat={editLat}
        initialLng={editLng}
        onClose={() => setMapOpen(false)}
        onSave={applyMapPoint}
      />
    </div>
  );
};
