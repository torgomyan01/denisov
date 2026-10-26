"use client";

import {
  adminGridClass,
  adminRootClass,
  btnDangerText,
  btnDark,
  btnGhostSoft,
  btnLine,
  btnSaveDark,
  btnSaveLine,
  btnSmGhost,
  chipClass,
  cx,
  fieldClass,
  inputClass,
  logoModeClass,
  menuCatChevronClass,
  menuItemUploadClass,
  navBadgeClass,
  navChevronClass,
  navGroupClass,
  navSubIconClass,
  navSubItemClass,
  tabClass,
  toastClass,
} from "@/components/admin/styles";
import { X } from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { createPortal } from "react-dom";
import {
  checkAuthAction,
  loginAction,
  logoutAction,
} from "@/actions/auth";
import { countNewOrdersAdminAction } from "@/actions/orders";
import {
  getSiteAction,
  updateSiteAction,
  uploadFileAction,
} from "@/actions/site";
import {
  compressImageForUpload,
  compressProductImageForUpload,
} from "@/lib/compress-image-client";
import { brandLabelOrDefault } from "@/lib/format";
import { createClientId } from "@/lib/ids";
import {
  formatUploadLimitError,
  MAX_UPLOAD_BYTES,
  MAX_UPLOAD_LABEL,
} from "@/lib/upload-limits";
import type { HeaderLogoMode, MenuItem, SiteData } from "@/types/site";
import {
  ConfirmModal,
  EmptyState,
  Field,
  FileDrop,
  IconNav,
  MediaPreview,
  ToggleField,
} from "@/components/admin/ui";
import { DndProvider, SortableItem } from "@/components/admin/dnd";
import { OrderDetailPanel } from "@/components/admin/OrderDetailPage";
import { OrdersPanel } from "@/components/admin/OrdersPanel";
import { OrderScanPanel } from "@/components/admin/OrderScanPage";
import { PickupPointsPanel } from "@/components/admin/PickupPointsPanel";
import { UsersPanel } from "@/components/admin/UsersPanel";
import {
  createDefaultDeliverySettings,
  createDefaultMenuCategory,
  createDefaultMenuItem,
} from "@/lib/delivery-defaults";

const UPLOAD_HINT = `JPG, PNG или WebP · до ${MAX_UPLOAD_LABEL} · уменьшение ≤1000px + сжатие`;
const LOGO_HINT = `SVG, PNG или WebP · до ${MAX_UPLOAD_LABEL} · сжатие авто`;
const PRODUCT_UPLOAD_HINT = `Фото продукта · пропорции сохранены · длинная сторона ≤1000px · сжатие`;


const TABS = [
  "hero",
  "about",
  "contacts",
  "menu",
  "pickup",
  "orders",
  "fulfillment",
  "users",
] as const;
type TabId = (typeof TABS)[number];

const TAB_LABELS: Record<TabId, string> = {
  hero: "Hero",
  about: "О кафе",
  contacts: "Контакты",
  menu: "Меню",
  pickup: "Самовывоз",
  orders: "Заказы",
  fulfillment: "Выдача по QR",
  users: "Пользователи",
};

const TAB_HINTS: Record<TabId, string> = {
  hero: "Тексты и медиа первого экрана — бренд и кнопки зафиксированы",
  about: "Тексты и три ключевые цифры",
  contacts: "Телефон, адрес, SEO и футер",
  menu: "Категории, позиции, доставка и допродажа",
  pickup: "Точки самовывоза: название, телефон, адрес и карта",
  orders: "Заказы клиентов: статусы от кухни до выдачи",
  fulfillment: "Сканер QR клиента — проверка и подтверждение выдачи",
  users: "Клиенты сайта: список, создание и редактирование",
};

/** Top-level collapsible groups — add new sections here as the admin grows. */
type NavGroup = {
  id: string;
  label: string;
  icon: string;
  items: readonly TabId[];
};

const NAV_GROUPS: readonly NavGroup[] = [
  {
    id: "site",
    label: "Разделы",
    icon: "sections",
    /** Homepage content only — edit главная here, nowhere else. */
    items: ["hero", "about", "contacts"],
  },
  {
    id: "catalog",
    label: "Каталог",
    icon: "sections",
    items: ["menu"],
  },
];

/** Tabs shown outside collapsible groups (e.g. Users). */
const NAV_STANDALONE: readonly TabId[] = [
  "fulfillment",
  "pickup",
  "orders",
  "users",
];

const isTabId = (value: string): value is TabId =>
  (TABS as readonly string[]).includes(value);

type AdminHashRoute = {
  tab: TabId;
  orderId: string | null;
};

const parseAdminHash = (): AdminHashRoute => {
  const raw = decodeURIComponent(window.location.hash.replace(/^#/, ""));
  const orderMatch = /^order\/([^/]+)$/.exec(raw);
  if (orderMatch?.[1]) {
    return { tab: "orders", orderId: orderMatch[1] };
  }
  if (isTabId(raw)) return { tab: raw, orderId: null };
  return { tab: "hero", orderId: null };
};

const hashForRoute = (route: AdminHashRoute): string =>
  route.orderId ? `order/${route.orderId}` : route.tab;

const formatNewOrdersLabel = (count: number): string => {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return `${count} новый заказ`;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) {
    return `${count} новых заказа`;
  }
  return `${count} новых заказов`;
};


const ensureMenu = (site: SiteData): SiteData => {
  const next = structuredClone(site);
  if (!next.menu || typeof next.menu !== "object") {
    next.menu = { title: "Меню", note: "", categories: [] };
  }
  if (!Array.isArray(next.menu.categories)) next.menu.categories = [];
  next.menu.categories = next.menu.categories.map((cat) =>
    createDefaultMenuCategory({
      id: cat.id || createClientId("cat"),
      name: cat.name ?? "",
      availableFrom: cat.availableFrom ?? "",
      availableTo: cat.availableTo ?? "",
      items: Array.isArray(cat.items)
        ? cat.items.map((item) =>
            createDefaultMenuItem({
              id: item.id || createClientId("item"),
              name: item.name ?? "",
              description: item.description ?? "",
              price: item.price ?? "",
              image: item.image ?? "",
              weight: item.weight ?? "",
              kcal: item.kcal ?? null,
              protein: item.protein ?? null,
              fat: item.fat ?? null,
              carbs: item.carbs ?? null,
              showInDelivery: item.showInDelivery !== false,
              inStock: item.inStock !== false,
              showInUpsell: Boolean(item.showInUpsell),
              upsellSortOrder: item.upsellSortOrder ?? 0,
            }),
          )
        : [],
    }),
  );
  if (!Array.isArray(next.dishes)) next.dishes = [];
  next.dishes = next.dishes.map((dish) => ({
    id: dish.id || createClientId("dish"),
    image: dish.image ?? "",
    caption: dish.caption ?? "",
  }));
  if (!next.brand || typeof next.brand !== "object") {
    next.brand = { logo: "", headerLogoMode: "text" };
  } else {
    next.brand.logo = next.brand.logo ?? "";
    next.brand.headerLogoMode =
      next.brand.headerLogoMode === "image" ||
      next.brand.headerLogoMode === "hidden" ||
      next.brand.headerLogoMode === "text"
        ? next.brand.headerLogoMode
        : "text";
  }
  next.delivery = {
    ...createDefaultDeliverySettings(),
    ...(next.delivery ?? {}),
  };
  return next;
};

const prepareForSave = (site: SiteData): SiteData => {
  const next = ensureMenu(site);
  const tg = next.hero.telegramUrl?.trim();
  if (tg) next.contacts.telegramUrl = tg;
  return next;
};

const snapshot = (site: SiteData): string => JSON.stringify(prepareForSave(site));

const moveItem = <T,>(list: T[], from: number, to: number): T[] => {
  if (to < 0 || to >= list.length || from === to) return list;
  const next = [...list];
  const [item] = next.splice(from, 1);
  if (item === undefined) return list;
  next.splice(to, 0, item);
  return next;
};

type ConfirmState = {
  title: string;
  message: string;
  confirmLabel?: string;
  onConfirm: () => void;
} | null;

type MenuItemEditTarget = {
  categoryId: string;
  itemId: string;
} | null;

export default function AdminApp() {
  const [booting, setBooting] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);
  const [site, setSite] = useState<SiteData | null>(null);
  const [savedSnap, setSavedSnap] = useState("");
  const [tab, setTab] = useState<TabId>("hero");
  const [viewOrderId, setViewOrderId] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loginError, setLoginError] = useState("");
  const [toast, setToast] = useState({ text: "", tone: "success" as "success" | "error" });
  const [toastVisible, setToastVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [newOrdersCount, setNewOrdersCount] = useState(0);
  /** Menu categories start closed; id → true means accordion is open. */
  const [openMenuCats, setOpenMenuCats] = useState<Record<string, boolean>>({});
  const [navOpen, setNavOpen] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    for (const group of NAV_GROUPS) initial[group.id] = false;
    return initial;
  });
  const [confirm, setConfirm] = useState<ConfirmState>(null);
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [menuFilter, setMenuFilter] = useState("");
  const [menuItemEdit, setMenuItemEdit] = useState<MenuItemEditTarget>(null);
  const [savedAt, setSavedAt] = useState("");
  const [portalReady, setPortalReady] = useState(false);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setPortalReady(true);
  }, []);

  const dirty = useMemo(
    () => (site ? snapshot(site) !== savedSnap : false),
    [site, savedSnap],
  );

  const showToast = useCallback((msg: string, tone: "success" | "error" = "success") => {
    setToast({ text: msg, tone });
    setToastVisible(true);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToastVisible(false), 2600);
  }, []);

  const toastNode = (
    <div
      className={toastClass(toast.tone, toastVisible)}
      role="status"
      aria-live="polite"
    >
      {toast.text}
    </div>
  );

  const toastPortal =
    portalReady && typeof document !== "undefined"
      ? createPortal(toastNode, document.body)
      : null;

  const applySavedSite = useCallback((data: SiteData) => {
    const normalized = prepareForSave(data);
    const snap = snapshot(normalized);
    setSite(normalized);
    setSavedSnap(snap);
    setSavedAt(
      new Date().toLocaleTimeString("ru-RU", {
        hour: "2-digit",
        minute: "2-digit",
      }),
    );
  }, []);

  const loadSite = useCallback(async (): Promise<boolean> => {
    const result = await getSiteAction();
    if (!result.success || !result.data) {
      showToast(result.success ? "Ошибка загрузки" : result.error, "error");
      return false;
    }
    applySavedSite(result.data);
    return true;
  }, [showToast, applySavedSite]);

  const forceLogoutLocal = useCallback(() => {
    setAuthenticated(false);
    setSite(null);
    setSavedSnap("");
    setSavedAt("");
    setPassword("");
  }, []);

  const persistSite = useCallback(
    async (next: SiteData, successMessage: string): Promise<boolean> => {
      setBusy(true);
      try {
        const payload = prepareForSave(next);
        const result = await updateSiteAction(payload);
        if (!result.success) {
          showToast(result.error, "error");
          if (result.error === "Требуется авторизация") {
            forceLogoutLocal();
          }
          return false;
        }
        applySavedSite(result.data ?? payload);
        showToast(successMessage);
        return true;
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Ошибка сохранения";
        showToast(message, "error");
        return false;
      } finally {
        setBusy(false);
      }
    },
    [applySavedSite, forceLogoutLocal, showToast],
  );

  const refreshNewOrdersCount = useCallback(async () => {
    const result = await countNewOrdersAdminAction();
    if (result.success && result.data) {
      setNewOrdersCount(result.data.count);
    }
  }, []);

  const applyRoute = useCallback((route: AdminHashRoute) => {
    setTab(route.tab);
    setViewOrderId(route.orderId);
    const nextHash = hashForRoute(route);
    if (window.location.hash.replace(/^#/, "") !== nextHash) {
      window.history.replaceState(null, "", `#${nextHash}`);
    }
    if (route.tab === "orders") {
      void refreshNewOrdersCount();
    }
  }, [refreshNewOrdersCount]);

  const showPanel = useCallback(
    (name: TabId) => {
      applyRoute({ tab: name, orderId: null });
    },
    [applyRoute],
  );

  const showOrder = useCallback(
    (orderId: string) => {
      applyRoute({ tab: "orders", orderId });
    },
    [applyRoute],
  );

  const toggleNavGroup = useCallback((groupId: string) => {
    setNavOpen((prev) => ({ ...prev, [groupId]: !prev[groupId] }));
  }, []);

  useEffect(() => {
    if (!authenticated) {
      setNewOrdersCount(0);
      return;
    }
    void refreshNewOrdersCount();
    const timer = window.setInterval(() => {
      void refreshNewOrdersCount();
    }, 20000);
    const onFocus = () => {
      void refreshNewOrdersCount();
    };
    const onStorage = (event: StorageEvent) => {
      if (event.key === "denisov_admin_orders_bump") {
        void refreshNewOrdersCount();
      }
    };
    const onOrdersChanged = () => {
      void refreshNewOrdersCount();
    };
    window.addEventListener("focus", onFocus);
    window.addEventListener("storage", onStorage);
    window.addEventListener("denisov-orders-changed", onOrdersChanged);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("denisov-orders-changed", onOrdersChanged);
    };
  }, [authenticated, refreshNewOrdersCount]);

  useEffect(() => {
    if (!authenticated) return;
    const base = "Админ — ДЕНИСОВ";
    document.title =
      newOrdersCount > 0 ? `(${newOrdersCount}) ${base}` : base;
  }, [authenticated, newOrdersCount]);


  const loadSiteRef = useRef(loadSite);
  loadSiteRef.current = loadSite;
  const applyRouteRef = useRef(applyRoute);
  applyRouteRef.current = applyRoute;

  // Mount-once boot. Do not depend on loadSite/applyRoute — unstable
  // identities were cancelling boot before setBooting(false), leaving the
  // panel stuck on «Загрузка» while checkAuth kept re-firing.
  useEffect(() => {
    let cancelled = false;

    const boot = async () => {
      const auth = await checkAuthAction();
      if (cancelled) return;
      if (auth.success && auth.data?.ok) {
        const ok = await loadSiteRef.current();
        if (!cancelled && ok) {
          setAuthenticated(true);
          applyRouteRef.current(parseAdminHash());
        }
      }
      if (!cancelled) setBooting(false);
    };

    void boot();
    const onHash = () => applyRouteRef.current(parseAdminHash());
    window.addEventListener("hashchange", onHash);
    return () => {
      cancelled = true;
      window.removeEventListener("hashchange", onHash);
      if (toastTimer.current) clearTimeout(toastTimer.current);
    };
  }, []);

  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!dirty) return;
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  const patchSite = useCallback((updater: (draft: SiteData) => void) => {
    setSite((prev) => {
      if (!prev) return prev;
      const next = ensureMenu(prev);
      updater(next);
      return next;
    });
  }, []);

  const handleSave = useCallback(async () => {
    if (!site || busy) return;
    await persistSite(site, "Сохранено");
  }, [site, busy, persistSite]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        if (authenticated && dirty) void handleSave();
      }
      if (e.key === "Escape") {
        setLightbox(null);
        setConfirm(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [authenticated, dirty, handleSave]);

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    setLoginError("");
    setBusy(true);
    try {
      const result = await loginAction({ password });
      if (!result.success) {
        setLoginError(result.error);
        return;
      }
      const ok = await loadSite();
      if (ok) {
        setAuthenticated(true);
        applyRoute(parseAdminHash());
      }
    } finally {
      setBusy(false);
    }
  };

  const handleLogout = async () => {
    if (dirty) {
      setConfirm({
        title: "Выйти без сохранения?",
        message: "Есть несохранённые изменения. Они будут потеряны.",
        confirmLabel: "Выйти",
        onConfirm: () => {
          setConfirm(null);
          void doLogout();
        },
      });
      return;
    }
    await doLogout();
  };

  const doLogout = async () => {
    setBusy(true);
    try {
      await logoutAction();
    } catch {
      /* ignore */
    }
    forceLogoutLocal();
    setBusy(false);
  };

  const discardChanges = () => {
    if (!site) return;
    void loadSite().then((ok) => {
      if (ok) showToast("Изменения отменены");
    });
  };

  const rematchMenuItemEdit = useCallback(
    (data: SiteData, field: string) => {
      const match = /^menu-item-(\d+)-(\d+)$/.exec(field);
      if (!match) return;
      const catIndex = Number(match[1]);
      const itemIndex = Number(match[2]);
      const category = data.menu.categories[catIndex];
      const item = category?.items[itemIndex];
      if (!category || !item) return;
      setMenuItemEdit({ categoryId: category.id, itemId: item.id });
    },
    [],
  );

  const handleUpload = async (field: string, file: File) => {
    if (file.size > MAX_UPLOAD_BYTES) {
      showToast(formatUploadLimitError(), "error");
      return;
    }
    if (file.size <= 0) {
      showToast("Файл пустой", "error");
      return;
    }

    setBusy(true);
    try {
      // Persist draft first so dish/menu indices match the DB before upload.
      if (
        site &&
        dirty &&
        (/^dish-\d+$/.test(field) || /^menu-item-\d+-\d+$/.test(field))
      ) {
        const payload = prepareForSave(site);
        const saveResult = await updateSiteAction(payload);
        if (!saveResult.success) {
          showToast(saveResult.error, "error");
          if (saveResult.error === "Требуется авторизация") forceLogoutLocal();
          return;
        }
        const saved = saveResult.data ?? payload;
        applySavedSite(saved);
        rematchMenuItemEdit(saved, field);
      }

      let uploadFile = file;
      if (file.type.startsWith("image/") && file.type !== "image/svg+xml") {
        try {
          const isProduct =
            /^dish-\d+$/.test(field) || /^menu-item-\d+-\d+$/.test(field);
          uploadFile = isProduct
            ? await compressProductImageForUpload(file)
            : await compressImageForUpload(file, { maxEdge: 1000 });
        } catch {
          showToast("Не удалось обрезать / сжать изображение", "error");
          return;
        }
      }

      const fd = new FormData();
      fd.append("field", field);
      fd.append("file", uploadFile);
      const result = await uploadFileAction(fd);
      if (!result.success || !result.data) {
        const error = result.success ? "Ошибка загрузки" : result.error;
        showToast(error, "error");
        if (error === "Требуется авторизация") forceLogoutLocal();
        return;
      }
      applySavedSite(result.data.site);
      rematchMenuItemEdit(result.data.site, field);
      const shrunk = uploadFile.size < file.size;
      showToast(shrunk ? "Загружено и сжато" : "Загружено");
    } finally {
      setBusy(false);
    }
  };

  const askDelete = (title: string, message: string, onConfirm: () => void) => {
    setConfirm({ title, message, onConfirm: () => {
      onConfirm();
      setConfirm(null);
    }});
  };

  if (booting) {
    return (
      <div className={adminRootClass}>
        <div className="grid min-h-screen place-items-center gap-[0.85rem] text-ink/48">
          <div className="size-[34px] animate-spin rounded-full border-2 border-clay/20 border-t-clay" aria-hidden="true" />
          <p>Загрузка панели…</p>
        </div>
      </div>
    );
  }

  if (!authenticated || !site) {
    return (
      <div className={adminRootClass}>
        <div className="grid min-h-screen place-items-center p-6">
          <div className="w-[min(420px,100%)] rounded-3xl border border-ink/12 bg-white/80 px-[1.6rem] pt-8 pb-[1.7rem] shadow-[0_20px_60px_rgba(33,30,25,0.08)] backdrop-blur-[12px]">
            <p className="text-center text-[11px] font-semibold uppercase tracking-[0.35em] text-clay">
              Кафе ДЕНИСОВ
            </p>
            <h1 className="mt-[0.4rem] text-center font-serif text-[2.4rem] tracking-[0.28em]">Админ</h1>
            <hr className="mb-5 h-px border-0 bg-[linear-gradient(90deg,transparent,rgba(156,107,74,0.45),transparent)] mt-6" />
            <form className="mt-7 space-y-5" onSubmit={handleLogin}>
              <div className={fieldClass}>
                <label htmlFor="password">Пароль</label>
                <div className="relative [&_input]:pr-[3.25rem]">
                  <input
                    className={inputClass()}
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    autoComplete="current-password"
                    placeholder="Введите пароль"
                    required
                    onChange={(e) => setPassword(e.target.value)}
                  />
                  <button
                    type="button"
                    className="absolute top-1/2 right-[0.55rem] -translate-y-1/2 cursor-pointer rounded-full bg-transparent px-[0.55rem] py-[0.4rem] text-[11px] font-semibold uppercase tracking-[0.08em] text-ink/48 hover:bg-clay/8 hover:text-clay"
                    onClick={() => setShowPassword((v) => !v)}
                  >
                    {showPassword ? "Скрыть" : "Показать"}
                  </button>
                </div>
              </div>
              {loginError ? <p className="text-[0.9rem] text-danger">{loginError}</p> : null}
              <button className={`${btnDark} w-full`} type="submit" disabled={busy}>
                {busy ? "Вход…" : "Войти"}
              </button>
            </form>
          </div>
        </div>
        {toastPortal}
      </div>
    );
  }

  const logoSrc = site.brand.logo?.trim() || "";
  const catCount = site.menu.categories.length;
  const itemCount = site.menu.categories.reduce((n, c) => n + c.items.length, 0);
  const filter = menuFilter.trim().toLowerCase();

  const editingMenuItem = (() => {
    if (!menuItemEdit) return null;
    const catIndex = site.menu.categories.findIndex(
      (c) => c.id === menuItemEdit.categoryId,
    );
    if (catIndex < 0) return null;
    const category = site.menu.categories[catIndex];
    const itemIndex = category.items.findIndex(
      (item) => item.id === menuItemEdit.itemId,
    );
    if (itemIndex < 0) return null;
    return {
      category,
      item: category.items[itemIndex],
      catIndex,
      itemIndex,
    };
  })();

  const closeMenuItemEdit = () => setMenuItemEdit(null);

  const patchEditingMenuItem = (updater: (row: MenuItem) => void) => {
    if (!menuItemEdit) return;
    const { categoryId, itemId } = menuItemEdit;
    patchSite((d) => {
      const category = d.menu.categories.find((c) => c.id === categoryId);
      const row = category?.items.find((item) => item.id === itemId);
      if (row) updater(row);
    });
  };

  const moveEditingMenuItemToCategory = (nextCategoryId: string) => {
    if (!menuItemEdit || nextCategoryId === menuItemEdit.categoryId) return;
    const { categoryId, itemId } = menuItemEdit;
    patchSite((d) => {
      const from = d.menu.categories.find((c) => c.id === categoryId);
      const to = d.menu.categories.find((c) => c.id === nextCategoryId);
      if (!from || !to) return;
      const index = from.items.findIndex((item) => item.id === itemId);
      if (index < 0) return;
      const [row] = from.items.splice(index, 1);
      if (!row) return;
      to.items.push(row);
    });
    setMenuItemEdit({ categoryId: nextCategoryId, itemId: menuItemEdit.itemId });
  };

  const moveEditingMenuItem = (direction: -1 | 1) => {
    if (!menuItemEdit) return;
    const { categoryId, itemId } = menuItemEdit;
    patchSite((d) => {
      const category = d.menu.categories.find((c) => c.id === categoryId);
      if (!category) return;
      const index = category.items.findIndex((item) => item.id === itemId);
      if (index < 0) return;
      const nextIndex = index + direction;
      if (nextIndex < 0 || nextIndex >= category.items.length) return;
      category.items = moveItem(category.items, index, nextIndex);
    });
  };

  return (
    <DndProvider>
    <div className={adminRootClass}>
      <div className="grid min-h-screen lg:grid-cols-[260px_1fr]">
        <aside className="sticky top-0 hidden h-screen flex-col border-r border-ink/12 bg-paper/72 px-[1.1rem] py-6 backdrop-blur-[14px] lg:flex" aria-label="Разделы">
          <div className="px-[0.65rem] pt-[0.35rem] pb-5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.32em] text-clay">{brandLabelOrDefault(site)}</p>
            <p className="mt-[0.35rem] font-serif text-[1.65rem] leading-[1.1] tracking-[0.04em]">Панель</p>
          </div>

          <nav className="flex min-h-0 flex-1 flex-col gap-[0.35rem] overflow-y-auto" aria-label="Разделы панели">
            {NAV_GROUPS.map((group) => {
              const open = Boolean(navOpen[group.id]);
              const hasActive = group.items.includes(tab);
              return (
                <div
                  key={group.id}
                  className={navGroupClass(open || hasActive)}
                >
                  <button
                    type="button"
                    className="flex w-full cursor-pointer items-center gap-[0.55rem] rounded-xl bg-transparent px-[0.65rem] py-[0.55rem] text-left text-ink transition duration-200 hover:bg-white/70"
                    aria-expanded={open}
                    onClick={() => toggleNavGroup(group.id)}
                  >
                    <span className="grid size-6 shrink-0 place-items-center rounded-[7px] bg-clay/12 text-clay [&_svg]:size-[14px]">
                      <IconNav name={group.icon} />
                    </span>
                    <span className="text-[13px] font-[650] uppercase tracking-[0.04em]">{group.label}</span>
                    <span className="ml-auto text-[11px] font-semibold tracking-[0.08em] opacity-65">{group.items.length}</span>
                    <span className={navChevronClass(open)} aria-hidden>
                      ▾
                    </span>
                  </button>
                  {open ? (
                    <div className="flex flex-col gap-[0.15rem] px-[0.35rem] pt-0 pb-[0.4rem]" role="group" aria-label={group.label}>
                      {group.items.map((id) => (
                        <button
                          key={id}
                          type="button"
                          className={navSubItemClass(tab === id)}
                          onClick={() => showPanel(id)}
                        >
                          <span className={navSubIconClass(tab === id)}>
                            <IconNav name={id} />
                          </span>
                          <span className="text-[14px] font-semibold tracking-[0.01em]">{TAB_LABELS[id]}</span>
                          {id === "menu" ? (
                            <span className="ml-auto text-[11px] font-semibold tracking-[0.08em] opacity-65">{itemCount}</span>
                          ) : null}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
              );
            })}

            {NAV_STANDALONE.map((id) => (
              <button
                key={id}
                type="button"
                className={cx(navSubItemClass(tab === id), "mt-[0.15rem]")}
                onClick={() => showPanel(id)}
              >
                <span className={navSubIconClass(tab === id)}>
                  <IconNav name={id} />
                </span>
                <span className="text-[14px] font-semibold tracking-[0.01em]">{TAB_LABELS[id]}</span>
                {id === "orders" && newOrdersCount > 0 ? (
                  <span
                    className={navBadgeClass(tab === id)}
                    aria-label={formatNewOrdersLabel(newOrdersCount)}
                  >
                    {newOrdersCount > 99 ? "99+" : newOrdersCount}
                  </span>
                ) : null}
              </button>
            ))}
          </nav>

          <div className="mt-auto flex flex-col gap-2 pt-4">
            <a href="/" target="_blank" rel="noreferrer" className={`${btnLine} w-full`}>
              Открыть сайт
            </a>
            <button type="button" className={`${btnGhostSoft} w-full`} disabled={busy} onClick={() => void handleLogout()}>
              Выйти
            </button>
          </div>
        </aside>

        <div>
          <header className="sticky top-0 z-30 border-b border-ink/12 bg-[#f4efe6]/90 backdrop-blur-[14px]">
            <div className="mx-auto flex max-w-[1180px] items-center justify-between gap-4 px-4 py-[0.95rem] lg:max-w-none lg:px-6">
              <div className="[&_h1]:m-0 [&_h1]:font-serif [&_h1]:text-[1.45rem] [&_h1]:leading-[1.15] [&_h1]:tracking-[0.03em] [&_p]:mt-[0.2rem] [&_p]:text-xs [&_p]:text-ink/48">
                <h1>{viewOrderId ? "Заказ" : TAB_LABELS[tab]}</h1>
                <p>
                  {viewOrderId
                    ? "Карточка заказа, статусы и этикетка"
                    : TAB_HINTS[tab]}
                </p>
              </div>
              <div className="flex flex-wrap items-center justify-end gap-[0.45rem]">
                {newOrdersCount > 0 ? (
                  <button
                    type="button"
                    className="inline-flex cursor-pointer items-center gap-[0.45rem] rounded-full border border-[#c45c3a]/28 bg-[#c45c3a]/10 px-3 py-[0.4rem] font-sans text-xs font-[650] leading-none tracking-[0.04em] text-[#8a3320] transition duration-150 hover:-translate-y-px hover:bg-[#c45c3a]/16"
                    onClick={() => showPanel("orders")}
                  >
                    <span className="size-2 animate-admin-badge rounded-full bg-[#c45c3a]" aria-hidden="true" />
                    {formatNewOrdersLabel(newOrdersCount)}
                  </button>
                ) : null}
                <span className={chipClass(dirty)}>
                  {dirty ? "Не сохранено" : savedAt ? `Сохранено ${savedAt}` : "Актуально"}
                </span>
                <a href="/menu" target="_blank" rel="noreferrer" className={`${btnLine} lg:hidden`}>
                  Меню
                </a>
                <button
                  className={btnDark}
                  type="button"
                  disabled={busy || !dirty}
                  onClick={() => void handleSave()}
                >
                  {busy ? "Сохранение…" : "Сохранить"}
                </button>
                <button
                  className={`${btnLine} lg:hidden`}
                  type="button"
                  disabled={busy}
                  onClick={() => void handleLogout()}
                >
                  Выйти
                </button>
              </div>
            </div>

            <div className="mx-auto flex max-w-[1180px] flex-wrap gap-[0.4rem] px-4 pb-[0.9rem] lg:hidden" aria-label="Разделы админки">
              {NAV_GROUPS.map((group) => {
                const open = Boolean(navOpen[group.id]);
                return (
                  <div key={group.id} className="contents">
                    <button
                      type="button"
                      className={cx(tabClass(open), "gap-[0.35rem]")}
                      aria-expanded={open}
                      onClick={() => toggleNavGroup(group.id)}
                    >
                      {group.label}
                      <span className={navChevronClass(open, true)} aria-hidden>
                        ▾
                      </span>
                    </button>
                    {open
                      ? group.items.map((id) => (
                          <button
                            key={id}
                            type="button"
                            className={tabClass(tab === id)}
                            onClick={() => showPanel(id)}
                          >
                            {TAB_LABELS[id]}
                          </button>
                        ))
                      : null}
                  </div>
                );
              })}
              {NAV_STANDALONE.map((id) => (
                <button
                  key={id}
                  type="button"
                  className={tabClass(tab === id)}
                  onClick={() => showPanel(id)}
                >
                  {TAB_LABELS[id]}
                  {id === "orders" && newOrdersCount > 0 ? (
                    <span className="ml-[0.4rem] inline-grid h-5 min-w-5 animate-admin-badge place-items-center rounded-full bg-[#c45c3a] px-[0.35rem] align-middle text-[10px] font-bold leading-none tracking-normal text-white">
                      {newOrdersCount > 99 ? "99+" : newOrdersCount}
                    </span>
                  ) : null}
                </button>
              ))}
            </div>
          </header>

          <main className="mx-auto w-full max-w-[1180px] px-4 pt-5 pb-28 lg:max-w-none lg:px-6 lg:pt-6">
            {newOrdersCount > 0 && tab !== "orders" ? (
              <button
                type="button"
                className="mb-4 flex w-full cursor-pointer items-center gap-[0.85rem] rounded-[14px] border border-[#c45c3a]/22 bg-[linear-gradient(120deg,rgba(196,92,58,0.12),rgba(251,248,241,0.9))] px-4 py-[0.9rem] text-left text-ink transition duration-150 hover:-translate-y-px hover:shadow-[0_10px_24px_rgba(33,30,25,0.08)]"
                onClick={() => showPanel("orders")}
              >
                <span className="grid size-[2.4rem] min-w-[2.4rem] shrink-0 animate-admin-badge place-items-center rounded-full bg-[#c45c3a] font-sans text-[0.95rem] font-bold leading-none text-white">
                  {newOrdersCount > 99 ? "99+" : newOrdersCount}
                </span>
                <span className="flex min-w-0 flex-1 flex-col gap-[0.15rem] [&_strong]:text-[0.95rem] [&_strong]:font-[650] [&_strong]:leading-[1.25] [&_em]:text-[0.82rem] [&_em]:not-italic [&_em]:text-ink/55">
                  <strong>{formatNewOrdersLabel(newOrdersCount)}</strong>
                  <em>Откройте раздел «Заказы», чтобы принять в работу</em>
                </span>
                <span className="shrink-0 text-xs font-[650] uppercase leading-none tracking-[0.08em] text-[#8a3320] max-[720px]:hidden">Перейти →</span>
              </button>
            ) : null}
            <div className={adminGridClass(tab === "hero")}>
              <div>
                {tab === "hero" ? (
                  <section className="animate-panel-in rounded-3xl border border-ink/12 bg-white/78 px-[1.35rem] pt-[1.35rem] pb-6 shadow-[0_14px_40px_rgba(33,30,25,0.045)] backdrop-blur-[10px] md:px-[1.85rem] md:pt-7 md:pb-[1.9rem]">
                    <div className="mb-[1.1rem] flex flex-wrap items-start justify-between gap-4">
                      <div>
                        <h2 className="m-0 font-serif text-[clamp(1.55rem,2.4vw,1.95rem)] leading-[1.15] tracking-[0.02em]">Главный экран</h2>
                        <p className="mt-[0.4rem] max-w-[42rem] text-[0.92rem] leading-normal text-ink/48">
                          Редактируйте тексты и фото. Название бренда и подписи кнопок зафиксированы.
                        </p>
                      </div>
                    </div>
                    <hr className="mb-5 h-px border-0 bg-[linear-gradient(90deg,transparent,rgba(156,107,74,0.45),transparent)]" />

                    <div className="mt-[1.35rem] border-t border-ink/8 pt-5">
                      <p className="mb-[0.85rem] text-[10px] font-bold uppercase tracking-[0.2em] text-clay">Бренд</p>
                      <div className="grid gap-4 rounded-[18px] border border-dashed border-clay/35 bg-[linear-gradient(135deg,rgba(251,248,241,0.95),rgba(244,239,230,0.65))] px-5 py-[1.15rem] md:grid-cols-2 md:items-start">
                        <Field
                          label="Название"
                          value={site.hero.title || "Денисов"}
                          readOnly
                          hint="Фирменное имя на первом экране — не меняется из панели."
                        />
                        <div>
                          <p className="text-xs leading-[1.4] text-ink/48" style={{ marginBottom: "0.65rem" }}>
                            Кнопки навигации
                          </p>
                          <div className="mt-[0.35rem] flex flex-wrap gap-[0.55rem]" aria-label="Фиксированные кнопки">
                            <span className="inline-flex items-center gap-[0.45rem] rounded-full border border-ink bg-ink px-[0.85rem] py-[0.45rem] text-xs font-semibold uppercase tracking-[0.08em] text-paper [&_em]:text-[10px] [&_em]:not-italic [&_em]:tracking-[0.14em] [&_em]:opacity-55">
                              {site.hero.menuButtonLabel || "Меню"}
                              <em>фикс.</em>
                            </span>
                            <span className="inline-flex items-center gap-[0.45rem] rounded-full border border-ink/12 bg-paper px-[0.85rem] py-[0.45rem] text-xs font-semibold uppercase tracking-[0.08em] text-ink [&_em]:text-[10px] [&_em]:not-italic [&_em]:tracking-[0.14em] [&_em]:opacity-55">
                              {site.hero.telegramButtonLabel || "Telegram"}
                              <em>фикс.</em>
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="mt-[1.35rem] border-t border-ink/8 pt-5">
                      <p className="mb-[0.85rem] text-[10px] font-bold uppercase tracking-[0.2em] text-clay">Тексты</p>
                      <div className="grid gap-4 md:grid-cols-2">
                        <div className="col-span-full">
                          <Field
                            label="Верхняя строка"
                            value={site.hero.eyebrow}
                            placeholder="Кафе · Санкт-Петербург"
                            onChange={(v) => patchSite((d) => { d.hero.eyebrow = v; })}
                          />
                        </div>
                        <div className="col-span-full">
                          <Field
                            label="Подзаголовок"
                            multiline
                            value={site.hero.subtitle}
                            placeholder="Короткое описание атмосферы"
                            onChange={(v) => patchSite((d) => { d.hero.subtitle = v; })}
                          />
                        </div>
                        <div className="col-span-full">
                          <Field
                            label="Адрес и часы"
                            value={site.hero.metaLine}
                            placeholder="Московский пр., 71/3 · ежедневно 8:00–22:00"
                            onChange={(v) => patchSite((d) => { d.hero.metaLine = v; })}
                          />
                        </div>
                      </div>
                    </div>

                    <div className="mt-[1.35rem] border-t border-ink/8 pt-5">
                      <p className="mb-[0.85rem] text-[10px] font-bold uppercase tracking-[0.2em] text-clay">Telegram</p>
                      <div className="grid gap-4">
                        <Field
                          label="Ссылка"
                          type="url"
                          value={site.hero.telegramUrl}
                          placeholder="https://t.me/cafe_Denisov"
                          hint="Одна ссылка для всех Telegram-кнопок на сайте."
                          onChange={(v) => patchSite((d) => { d.hero.telegramUrl = v; })}
                        />
                      </div>
                    </div>

                    <div className="mt-[1.35rem] border-t border-ink/8 pt-5">
                      <p className="mb-[0.85rem] text-[10px] font-bold uppercase tracking-[0.2em] text-clay">Логотип в шапке</p>
                      <p className="mt-[0.4rem] max-w-[42rem] text-[0.92rem] leading-normal text-ink/48 mb-4">
                        Редактируйте текст или картинку, разместите в шапке или полностью уберите.
                        Данные не теряются при скрытии.
                      </p>

                      <div className="grid gap-[0.65rem] sm:grid-cols-3" role="radiogroup" aria-label="Отображение логотипа">
                        {(
                          [
                            { id: "text", label: "Текст", hint: "Показать текстовый знак" },
                            { id: "image", label: "Картинка", hint: "Показать загруженный файл" },
                            { id: "hidden", label: "Убрать", hint: "Полностью скрыть из шапки" },
                          ] as const
                        ).map((opt) => {
                          const active =
                            (site.brand.headerLogoMode || "text") === opt.id;
                          return (
                            <button
                              key={opt.id}
                              type="button"
                              role="radio"
                              aria-checked={active}
                              className={logoModeClass(active)}
                              disabled={busy}
                              title={opt.hint}
                              onClick={() =>
                                patchSite((d) => {
                                  d.brand.headerLogoMode = opt.id as HeaderLogoMode;
                                })
                              }
                            >
                              <strong>{opt.label}</strong>
                              <span>{opt.hint}</span>
                            </button>
                          );
                        })}
                      </div>

                      <div className="grid gap-4 mt-4">
                        <Field
                          label="Текстовый логотип"
                          value={site.footer.brand}
                          placeholder="ДЕНИСОВ"
                          hint="Редактируется всегда. В шапке виден при режиме «Текст» (и как запасной вариант без картинки)."
                          onChange={(v) =>
                            patchSite((d) => {
                              d.footer.brand = v;
                            })
                          }
                        />
                      </div>

                      <div className="grid gap-4 md:grid-cols-[180px_1fr] md:items-center mt-4">
                        <MediaPreview src={logoSrc} logo />
                        <div className="flex flex-col gap-3">
                          <FileDrop
                            label="Картинка логотипа"
                            title="Перетащите или выберите файл"
                            hint={`${LOGO_HINT}. Чтобы показать в шапке — выберите режим «Картинка».`}
                            accept="image/*,.svg"
                            disabled={busy}
                            onFile={(file) => {
                              patchSite((d) => {
                                d.brand.headerLogoMode = "image";
                              });
                              void handleUpload("logo", file);
                            }}
                          />
                          {logoSrc ? (
                            <button
                              type="button"
                              className={`${btnDangerText} self-start`}
                              disabled={busy}
                              onClick={() =>
                                askDelete(
                                  "Удалить картинку?",
                                  "Файл логотипа будет очищен. Можно снова загрузить новый.",
                                  () => {
                                    patchSite((d) => {
                                      d.brand.logo = "";
                                      if (d.brand.headerLogoMode === "image") {
                                        d.brand.headerLogoMode = "text";
                                      }
                                    });
                                  },
                                )
                              }
                            >
                              Удалить картинку
                            </button>
                          ) : null}
                        </div>
                      </div>
                    </div>

                    <div className="mt-[1.35rem] border-t border-ink/8 pt-5">
                      <p className="mb-[0.85rem] text-[10px] font-bold uppercase tracking-[0.2em] text-clay">Большое фото</p>
                      <div className="grid gap-4 md:grid-cols-[220px_1fr] md:items-center">
                        <MediaPreview
                          src={site.hero.featuredImage || ""}
                          onOpen={site.hero.featuredImage ? () => setLightbox(site.hero.featuredImage) : undefined}
                        />
                        <FileDrop
                          label="Featured-изображение"
                          title="Перетащите или выберите файл"
                          hint={UPLOAD_HINT}
                          accept="image/*"
                          disabled={busy}
                          onFile={(file) => void handleUpload("featured", file)}
                        />
                      </div>
                      <div className="grid gap-4 md:grid-cols-2 mt-4">
                        <Field
                          label="Подпись фото"
                          value={site.hero.featuredCaption}
                          placeholder="Например: Утренний стол"
                          onChange={(v) => patchSite((d) => { d.hero.featuredCaption = v; })}
                        />
                        <Field
                          label="Бейдж"
                          value={site.hero.featuredBadge}
                          placeholder="Опционально"
                          onChange={(v) => patchSite((d) => { d.hero.featuredBadge = v; })}
                        />
                      </div>
                    </div>
                  </section>
                ) : null}

                {tab === "about" ? (
                  <section className="animate-panel-in rounded-3xl border border-ink/12 bg-white/78 px-[1.35rem] pt-[1.35rem] pb-6 shadow-[0_14px_40px_rgba(33,30,25,0.045)] backdrop-blur-[10px] md:px-[1.85rem] md:pt-7 md:pb-[1.9rem]">
                    <div className="mb-[1.1rem] flex flex-wrap items-start justify-between gap-4">
                      <div>
                        <h2 className="m-0 font-serif text-[clamp(1.55rem,2.4vw,1.95rem)] leading-[1.15] tracking-[0.02em]">О кафе</h2>
                        <p className="mt-[0.4rem] max-w-[42rem] text-[0.92rem] leading-normal text-ink/48">История места и три акцентные цифры.</p>
                      </div>
                    </div>
                    <hr className="mb-5 h-px border-0 bg-[linear-gradient(90deg,transparent,rgba(156,107,74,0.45),transparent)]" />
                    <div className="grid gap-4">
                      <Field label="Метка секции" value={site.about.eyebrow} onChange={(v) => patchSite((d) => { d.about.eyebrow = v; })} />
                      <Field label="Заголовок" multiline value={site.about.title} onChange={(v) => patchSite((d) => { d.about.title = v; })} />
                      <Field label="Текст" multiline value={site.about.text} onChange={(v) => patchSite((d) => { d.about.text = v; })} />
                    </div>

                    <div className="mt-[1.35rem] border-t border-ink/8 pt-5">
                      <p className="mb-[0.85rem] text-[10px] font-bold uppercase tracking-[0.2em] text-clay">Цифры</p>
                      <div className="grid gap-[0.85rem] sm:grid-cols-3 mb-4">
                        <div className="rounded-2xl border border-ink/12 bg-paper/70 p-4 [&_strong]:block [&_strong]:font-serif [&_strong]:text-[1.75rem] [&_strong]:leading-none [&_strong]:text-olive [&_span]:mt-[0.4rem] [&_span]:block [&_span]:text-[11px] [&_span]:uppercase [&_span]:tracking-[0.14em] [&_span]:text-ink/48">
                          <strong>{site.about.stat1Value || "—"}</strong>
                          <span>{site.about.stat1Label || "стат 1"}</span>
                        </div>
                        <div className="rounded-2xl border border-ink/12 bg-paper/70 p-4 [&_strong]:block [&_strong]:font-serif [&_strong]:text-[1.75rem] [&_strong]:leading-none [&_strong]:text-olive [&_span]:mt-[0.4rem] [&_span]:block [&_span]:text-[11px] [&_span]:uppercase [&_span]:tracking-[0.14em] [&_span]:text-ink/48">
                          <strong>{site.about.stat2Value || "—"}</strong>
                          <span>{site.about.stat2Label || "стат 2"}</span>
                        </div>
                        <div className="rounded-2xl border border-ink/12 bg-paper/70 p-4 [&_strong]:block [&_strong]:font-serif [&_strong]:text-[1.75rem] [&_strong]:leading-none [&_strong]:text-olive [&_span]:mt-[0.4rem] [&_span]:block [&_span]:text-[11px] [&_span]:uppercase [&_span]:tracking-[0.14em] [&_span]:text-ink/48">
                          <strong>{site.about.stat3Value || "—"}</strong>
                          <span>{site.about.stat3Label || "стат 3"}</span>
                        </div>
                      </div>
                      <div className="grid gap-4 md:grid-cols-2">
                        <Field label="Стат 1 — значение" value={site.about.stat1Value} onChange={(v) => patchSite((d) => { d.about.stat1Value = v; })} />
                        <Field label="Стат 1 — подпись" value={site.about.stat1Label} onChange={(v) => patchSite((d) => { d.about.stat1Label = v; })} />
                        <Field label="Стат 2 — значение" value={site.about.stat2Value} onChange={(v) => patchSite((d) => { d.about.stat2Value = v; })} />
                        <Field label="Стат 2 — подпись" value={site.about.stat2Label} onChange={(v) => patchSite((d) => { d.about.stat2Label = v; })} />
                        <Field label="Стат 3 — значение" value={site.about.stat3Value} onChange={(v) => patchSite((d) => { d.about.stat3Value = v; })} />
                        <Field label="Стат 3 — подпись" value={site.about.stat3Label} onChange={(v) => patchSite((d) => { d.about.stat3Label = v; })} />
                      </div>
                    </div>
                  </section>
                ) : null}

                {tab === "contacts" ? (
                  <section className="animate-panel-in rounded-3xl border border-ink/12 bg-white/78 px-[1.35rem] pt-[1.35rem] pb-6 shadow-[0_14px_40px_rgba(33,30,25,0.045)] backdrop-blur-[10px] md:px-[1.85rem] md:pt-7 md:pb-[1.9rem]">
                    <div className="mb-[1.1rem] flex flex-wrap items-start justify-between gap-4">
                      <div>
                        <h2 className="m-0 font-serif text-[clamp(1.55rem,2.4vw,1.95rem)] leading-[1.15] tracking-[0.02em]">Контакты и SEO</h2>
                        <p className="mt-[0.4rem] max-w-[42rem] text-[0.92rem] leading-normal text-ink/48">Как с вами связаться и как сайт видят поисковики.</p>
                      </div>
                    </div>
                    <hr className="mb-5 h-px border-0 bg-[linear-gradient(90deg,transparent,rgba(156,107,74,0.45),transparent)]" />

                    <div className="grid gap-4 md:grid-cols-2">
                      <Field label="Метка" value={site.contacts.eyebrow} onChange={(v) => patchSite((d) => { d.contacts.eyebrow = v; })} />
                      <Field label="Заголовок" value={site.contacts.title} onChange={(v) => patchSite((d) => { d.contacts.title = v; })} />
                      <Field label="Телефон" type="tel" value={site.contacts.phone} placeholder="+7 981 943-98-88" onChange={(v) => patchSite((d) => { d.contacts.phone = v; })} />
                      <Field label="Метка адреса" value={site.contacts.addressLabel} onChange={(v) => patchSite((d) => { d.contacts.addressLabel = v; })} />
                      <Field label="Адрес" value={site.contacts.address} onChange={(v) => patchSite((d) => { d.contacts.address = v; })} />
                      <Field label="Метка часов" value={site.contacts.hoursLabel} onChange={(v) => patchSite((d) => { d.contacts.hoursLabel = v; })} />
                      <Field label="Часы работы" value={site.contacts.hours} onChange={(v) => patchSite((d) => { d.contacts.hours = v; })} />
                      <Field label="Кнопка меню" value={site.contacts.menuButtonLabel} onChange={(v) => patchSite((d) => { d.contacts.menuButtonLabel = v; })} />
                      <Field label="Кнопка Telegram" value={site.contacts.telegramButtonLabel} onChange={(v) => patchSite((d) => { d.contacts.telegramButtonLabel = v; })} />
                    </div>

                    <div className="mt-[1.35rem] border-t border-ink/8 pt-5">
                      <p className="mb-[0.85rem] text-[10px] font-bold uppercase tracking-[0.2em] text-clay">Фото блока</p>
                      <div className="grid gap-4 md:grid-cols-[220px_1fr] md:items-center">
                        <MediaPreview
                          src={site.contacts.image || ""}
                          onOpen={site.contacts.image ? () => setLightbox(site.contacts.image) : undefined}
                        />
                        <FileDrop label="Фото контактов" title="Перетащите или выберите файл" hint={UPLOAD_HINT} accept="image/*" disabled={busy} onFile={(file) => void handleUpload("contacts", file)} />
                      </div>
                    </div>

                    <div className="mt-[1.35rem] border-t border-ink/8 pt-5">
                      <p className="mb-[0.85rem] text-[10px] font-bold uppercase tracking-[0.2em] text-clay">Футер</p>
                      <div className="grid gap-4 md:grid-cols-2">
                        <Field
                          label="Название в футере"
                          value={site.footer.brand}
                          placeholder="ДЕНИСОВ"
                          hint="То же поле, что текстовый логотип в Hero. Пусто — без названия."
                          onChange={(v) => patchSite((d) => { d.footer.brand = v; })}
                        />
                        <Field
                          label="Копирайт"
                          value={site.footer.copyright}
                          onChange={(v) => patchSite((d) => { d.footer.copyright = v; })}
                        />
                      </div>
                    </div>

                    <div className="mt-[1.35rem] border-t border-ink/8 pt-5">
                      <p className="mb-[0.85rem] text-[10px] font-bold uppercase tracking-[0.2em] text-clay">SEO</p>
                      <div className="grid gap-4">
                        <Field
                          label="Title страницы"
                          value={site.meta.title}
                          counter={{ current: site.meta.title.length, max: 70 }}
                          onChange={(v) => patchSite((d) => { d.meta.title = v; })}
                        />
                        <Field
                          label="Description"
                          multiline
                          value={site.meta.description}
                          counter={{ current: site.meta.description.length, max: 160 }}
                          onChange={(v) => patchSite((d) => { d.meta.description = v; })}
                        />
                        <Field label="Keywords" value={site.meta.keywords} onChange={(v) => patchSite((d) => { d.meta.keywords = v; })} />
                      </div>
                    </div>
                  </section>
                ) : null}

                {tab === "menu" ? (
                  <section className="animate-panel-in rounded-3xl border border-ink/12 bg-white/78 px-[1.35rem] pt-[1.35rem] pb-6 shadow-[0_14px_40px_rgba(33,30,25,0.045)] backdrop-blur-[10px] md:px-[1.85rem] md:pt-7 md:pb-[1.9rem]">
                    <div className="mb-[1.1rem] flex flex-wrap items-start justify-between gap-4">
                      <div>
                        <h2 className="m-0 font-serif text-[clamp(1.55rem,2.4vw,1.95rem)] leading-[1.15] tracking-[0.02em]">Меню</h2>
                        <p className="mt-[0.4rem] max-w-[42rem] text-[0.92rem] leading-normal text-ink/48">
                          {catCount} категорий · {itemCount} позиций · Изменить открывает карточку · тяните ⋮⋮ для порядка
                        </p>
                      </div>
                      <button
                        type="button"
                        className={btnDark}
                        onClick={() => {
                          const id = createClientId("cat");
                          patchSite((d) => {
                            d.menu.categories.push(
                              createDefaultMenuCategory({
                                id,
                                name: "Новая категория",
                                items: [
                                  createDefaultMenuItem({
                                    id: createClientId("item"),
                                  }),
                                ],
                              }),
                            );
                          });
                          setOpenMenuCats((prev) => ({ ...prev, [id]: true }));
                          showToast("Категория добавлена");
                        }}
                      >
                        + Категория
                      </button>
                    </div>
                    <hr className="mb-5 h-px border-0 bg-[linear-gradient(90deg,transparent,rgba(156,107,74,0.45),transparent)]" />

                    <div className="grid gap-4 md:grid-cols-2">
                      <Field label="Заголовок меню" value={site.menu.title} placeholder="Меню" onChange={(v) => patchSite((d) => { d.menu.title = v; })} />
                      <Field label="Подпись внизу" value={site.menu.note} placeholder="Цены указаны в рублях" onChange={(v) => patchSite((d) => { d.menu.note = v; })} />
                      <div className="col-span-full">
                        <Field
                          label="Быстрый поиск по позициям"
                          value={menuFilter}
                          placeholder="Например: борщ, блины…"
                          onChange={setMenuFilter}
                        />
                      </div>
                    </div>

                    <div className="flex flex-col gap-3 mt-5">
                      {!site.menu.categories.length ? (
                        <EmptyState
                          title="Меню ещё пустое"
                          text="Создайте первую категорию — завтраки, супы, выпечка и так далее."
                          action={
                            <button
                              type="button"
                              className={btnDark}
                              onClick={() => {
                                const id = createClientId("cat");
                                patchSite((d) => {
                                  d.menu.categories.push(
                                    createDefaultMenuCategory({ id }),
                                  );
                                });
                                setOpenMenuCats((prev) => ({
                                  ...prev,
                                  [id]: true,
                                }));
                              }}
                            >
                              + Категория
                            </button>
                          }
                        />
                      ) : null}

                      {site.menu.categories.map((cat, ci) => {
                        const categoryId = cat.id;
                        const items = cat.items
                          .map((item, ii) => ({ item, ii }))
                          .filter(({ item }) => {
                            if (!filter) return true;
                            return (
                              item.name.toLowerCase().includes(filter) ||
                              item.description.toLowerCase().includes(filter) ||
                              cat.name.toLowerCase().includes(filter)
                            );
                          });

                        if (filter && !items.length && !cat.name.toLowerCase().includes(filter)) {
                          return null;
                        }

                        // Closed by default; search keeps matching categories open.
                        const isOpen =
                          Boolean(openMenuCats[categoryId]) || Boolean(filter);

                        const toggleCategory = () => {
                          if (filter) return;
                          setOpenMenuCats((prev) => ({
                            ...prev,
                            [categoryId]: !prev[categoryId],
                          }));
                        };

                        return (
                          <SortableItem
                            key={categoryId}
                            group="menu-categories"
                            index={ci}
                            className="rounded-[14px] border border-ink/12 bg-paper/72 p-[10px]"
                            bodyClassName="flex flex-col gap-[10px]"
                            onReorder={(from, to) =>
                              patchSite((d) => {
                                d.menu.categories = moveItem(d.menu.categories, from, to);
                              })
                            }
                          >
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <button
                                type="button"
                                className="flex min-w-0 flex-[1_1_12rem] cursor-pointer items-center gap-[0.55rem] rounded-[10px] bg-transparent px-[0.2rem] py-[0.15rem] text-left text-inherit hover:bg-clay/6"
                                aria-expanded={isOpen}
                                onClick={toggleCategory}
                              >
                                <span
                                  className={menuCatChevronClass(isOpen)}
                                  aria-hidden="true"
                                />
                                <span className="flex min-w-0 flex-col items-start gap-[0.2rem]">
                                  <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-clay">
                                    Категория {ci + 1}
                                    {cat.items.length ? ` · ${cat.items.length}` : ""}
                                  </span>
                                  <strong className="block max-w-full truncate text-[0.98rem] font-semibold text-ink">
                                    {cat.name.trim() || "Без названия"}
                                  </strong>
                                </span>
                              </button>
                              <div className="flex flex-wrap items-center gap-[0.35rem]">
                                <button
                                  type="button"
                                  className={btnSmGhost}
                                  onClick={() => {
                                    patchSite((d) => {
                                      const target = d.menu.categories.find(
                                        (c) => c.id === categoryId,
                                      );
                                      target?.items.push(
                                        createDefaultMenuItem({
                                          id: createClientId("item"),
                                        }),
                                      );
                                    });
                                    setOpenMenuCats((prev) => ({
                                      ...prev,
                                      [categoryId]: true,
                                    }));
                                  }}
                                >
                                  + Позиция
                                </button>
                                <button
                                  type="button"
                                  className={btnDangerText}
                                  onClick={() =>
                                    askDelete(
                                      "Удалить категорию?",
                                      "Все позиции внутри тоже исчезнут.",
                                      () => {
                                        patchSite((d) => {
                                          d.menu.categories =
                                            d.menu.categories.filter(
                                              (c) => c.id !== categoryId,
                                            );
                                        });
                                        setOpenMenuCats((prev) => {
                                          const next = { ...prev };
                                          delete next[categoryId];
                                          return next;
                                        });
                                      },
                                    )
                                  }
                                >
                                  Удалить
                                </button>
                              </div>
                            </div>

                            {isOpen ? (
                              <>
                                <Field
                                  label="Название категории"
                                  value={cat.name}
                                  placeholder="Например: Завтраки"
                                  onChange={(v) =>
                                    patchSite((d) => {
                                      const target = d.menu.categories.find(
                                        (c) => c.id === categoryId,
                                      );
                                      if (target) target.name = v;
                                    })
                                  }
                                />
                                <div className="grid gap-3 md:grid-cols-2">
                                  <Field
                                    label="Доступно с (доставка)"
                                    value={cat.availableFrom}
                                    placeholder="08:00"
                                    hint="Пусто — без ограничения"
                                    onChange={(v) =>
                                      patchSite((d) => {
                                        const target = d.menu.categories.find(
                                          (c) => c.id === categoryId,
                                        );
                                        if (target) target.availableFrom = v;
                                      })
                                    }
                                  />
                                  <Field
                                    label="Доступно до"
                                    value={cat.availableTo}
                                    placeholder="12:00"
                                    onChange={(v) =>
                                      patchSite((d) => {
                                        const target = d.menu.categories.find(
                                          (c) => c.id === categoryId,
                                        );
                                        if (target) target.availableTo = v;
                                      })
                                    }
                                  />
                                </div>

                                <div className="flex flex-col gap-2">
                                  {!items.length ? (
                                    <p className="text-sm text-ink/48">
                                      {filter
                                        ? "Нет совпадений в этой категории."
                                        : "Позиций пока нет."}
                                    </p>
                                  ) : null}
                                  {items.map(({ item, ii }) => (
                                    <SortableItem
                                      key={item.id}
                                      group={`menu-items-${categoryId}`}
                                      index={ii}
                                      
                                      bodyClassName="grid min-h-[46px] grid-cols-[40px_minmax(0,1fr)_auto] items-center gap-2 rounded-xl border border-ink/6 bg-white/78 px-[10px] py-2"
                                      onReorder={(from, to) =>
                                        patchSite((d) => {
                                          const target = d.menu.categories.find(
                                            (c) => c.id === categoryId,
                                          );
                                          if (target) {
                                            target.items = moveItem(
                                              target.items,
                                              from,
                                              to,
                                            );
                                          }
                                        })
                                      }
                                    >
                                      {item.image ? (
                                        <button
                                          type="button"
                                          className="grid size-9 shrink-0 cursor-zoom-in place-items-center overflow-hidden rounded-[10px] border border-ink/12 bg-[linear-gradient(145deg,rgba(239,231,216,0.75),rgba(251,248,241,0.98))] p-0 [&_img]:block [&_img]:size-full [&_img]:object-contain"
                                          aria-label={`Открыть фото: ${item.name.trim() || "позиция"}`}
                                          onClick={() => setLightbox(item.image)}
                                        >
                                          {/* eslint-disable-next-line @next/next/no-img-element */}
                                          <img src={item.image} alt="" />
                                        </button>
                                      ) : (
                                        <span
                                          className="grid size-9 shrink-0 cursor-default select-none place-items-center overflow-hidden rounded-[10px] border border-ink/12 bg-[linear-gradient(145deg,rgba(239,231,216,0.75),rgba(251,248,241,0.98))] p-[2px] text-center text-[7px] font-[650] leading-[1.15] tracking-[0.02em] text-ink/48"
                                          aria-label="Нет фото"
                                        >
                                          Нет фото
                                        </span>
                                      )}
                                      <div className="min-w-0">
                                        <span className="block truncate text-[0.95rem] font-[550] text-ink">
                                          {item.name.trim() || "Без названия"}
                                        </span>
                                      </div>
                                      <button
                                        type="button"
                                        className={`${btnSmGhost} shrink-0`}
                                        onClick={() =>
                                          setMenuItemEdit({
                                            categoryId,
                                            itemId: item.id,
                                          })
                                        }
                                      >
                                        Изменить
                                      </button>
                                    </SortableItem>
                                  ))}
                                </div>
                              </>
                            ) : null}
                          </SortableItem>
                        );
                      })}
                    </div>
                  </section>
                ) : null}

                {tab === "pickup" ? (
                  <PickupPointsPanel
                    busy={busy}
                    setBusy={setBusy}
                    showToast={showToast}
                  />
                ) : null}

                {tab === "orders" ? (
                  viewOrderId ? (
                    <OrderDetailPanel
                      orderId={viewOrderId}
                      onBack={() => showPanel("orders")}
                      onOrdersChanged={refreshNewOrdersCount}
                    />
                  ) : (
                    <OrdersPanel
                      busy={busy}
                      setBusy={setBusy}
                      showToast={showToast}
                      onOrdersChanged={refreshNewOrdersCount}
                      onOpenOrder={showOrder}
                    />
                  )
                ) : null}

                {tab === "fulfillment" ? (
                  <OrderScanPanel
                    busy={busy}
                    onOrdersChanged={refreshNewOrdersCount}
                  />
                ) : null}

                {tab === "users" ? (
                  <UsersPanel
                    busy={busy}
                    setBusy={setBusy}
                    showToast={showToast}
                  />
                ) : null}
              </div>

              {tab === "hero" ? (
                <aside className="sticky top-[5.5rem] max-lg:hidden" aria-label="Живой превью">
                  <div className="overflow-hidden rounded-[22px] border border-ink/12 bg-paper shadow-[0_16px_40px_rgba(33,30,25,0.06)]">
                    <div className="flex items-center justify-between gap-3 border-b border-ink/12 bg-[#f4efe6]/80 px-4 py-3 [&_span]:text-[10px] [&_span]:font-bold [&_span]:uppercase [&_span]:tracking-[0.18em] [&_span]:text-ink/48">
                      <span>Превью</span>
                      <span>{dirty ? "черновик" : "опубликовано"}</span>
                    </div>
                    <div className="bg-paper bg-[radial-gradient(ellipse_80%_60%_at_70%_20%,rgba(239,231,216,0.85)_0%,transparent_60%)] px-[1.2rem] pt-[1.35rem] pb-6">
                      <p className="text-[10px] uppercase tracking-[0.28em] text-clay">{site.hero.eyebrow || " "}</p>
                      <h3 className="mt-[0.7rem] font-serif text-[2.4rem] leading-[0.95]">{site.hero.title || "Денисов"}</h3>
                      <p className="mt-[0.85rem] font-serif text-[1.05rem] italic leading-[1.4] text-ink/65">{site.hero.subtitle || "Подзаголовок появится здесь"}</p>
                      <div className="mt-4 flex flex-wrap gap-[0.45rem]">
                        <span className="rounded-full bg-ink px-[0.9rem] py-[0.55rem] text-[10px] font-semibold uppercase tracking-[0.14em] text-paper">{site.hero.menuButtonLabel || "Меню"}</span>
                        <span className="rounded-full border border-ink/15 px-[0.9rem] py-[0.55rem] text-[10px] font-semibold uppercase tracking-[0.14em] text-ink">{site.hero.telegramButtonLabel || "Telegram"}</span>
                      </div>
                      <p className="mt-4 text-[10px] uppercase tracking-[0.16em] text-ink/40">{site.hero.metaLine || " "}</p>
                      <div className="mt-[1.1rem] aspect-[4/5] overflow-hidden rounded-[14px] bg-sand [&_img]:size-full [&_img]:object-cover">
                        {site.hero.featuredImage ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={site.hero.featuredImage}
                            alt={site.hero.featuredCaption || ""}
                          />
                        ) : null}
                      </div>
                      {site.hero.featuredCaption || site.hero.featuredBadge ? (
                        <p className="mt-3 text-[10px] uppercase tracking-[0.16em] text-ink/40">
                          {[site.hero.featuredCaption, site.hero.featuredBadge]
                            .filter(Boolean)
                            .join(" · ")}
                        </p>
                      ) : null}
                    </div>
                  </div>
                </aside>
              ) : null}
            </div>
          </main>
        </div>
      </div>

      {dirty ? (
        <div className="pointer-events-auto fixed inset-x-0 bottom-0 z-40 px-4 pt-[0.85rem] pb-[calc(0.85rem_+_env(safe-area-inset-bottom))] lg:left-[260px]">
          <div className="mx-auto flex max-w-[920px] flex-wrap items-center justify-between gap-3 rounded-[18px] border border-clay/25 bg-ink/94 px-4 py-[0.85rem] text-paper shadow-[0_18px_50px_rgba(33,30,25,0.28)] backdrop-blur-[10px] [&_p]:text-[0.95rem] [&_small]:mt-[0.15rem] [&_small]:block [&_small]:text-xs [&_small]:opacity-65">
            <div>
              <p>Есть несохранённые изменения</p>
              <small>
                Быстрое сохранение: <span className="inline-flex items-center rounded-md border border-paper/25 px-[0.35rem] py-[0.1rem] text-[10px] tracking-[0.04em] opacity-80">Ctrl</span> + <span className="inline-flex items-center rounded-md border border-paper/25 px-[0.35rem] py-[0.1rem] text-[10px] tracking-[0.04em] opacity-80">S</span>
              </small>
            </div>
            <div className="flex gap-[0.45rem]">
              <button type="button" className={btnSaveLine} disabled={busy} onClick={discardChanges}>
                Отменить
              </button>
              <button type="button" className={btnSaveDark} disabled={busy} onClick={() => void handleSave()}>
                {busy ? "Сохранение…" : "Сохранить"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <ConfirmModal
        open={Boolean(confirm)}
        title={confirm?.title ?? ""}
        message={confirm?.message ?? ""}
        confirmLabel={confirm?.confirmLabel}
        onCancel={() => setConfirm(null)}
        onConfirm={() => confirm?.onConfirm()}
      />

      {editingMenuItem ? (
        <div
          className="fixed inset-0 z-[68] grid animate-fade-in place-items-center bg-[#181612]/55 p-4 backdrop-blur-[6px]"
          role="presentation"
          onClick={closeMenuItemEdit}
        >
          <div
            className="max-h-[min(92vh,44rem)] w-[min(720px,100%)] animate-panel-in overflow-auto rounded-[20px] border border-ink/12 bg-paper px-[1.3rem] pt-5 pb-[1.15rem] shadow-[0_24px_60px_rgba(0,0,0,0.25)]"
            role="dialog"
            aria-modal="true"
            aria-labelledby="menu-item-edit-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-start justify-between gap-3 [&_h3]:m-0 [&_h3]:font-serif [&_h3]:text-[1.55rem] [&_h3]:leading-[1.15]">
              <div>
                <p className="mb-[0.2rem] text-[10px] font-bold uppercase tracking-[0.14em] text-clay">Позиция меню</p>
                <h3 id="menu-item-edit-title">
                  {editingMenuItem.item.name.trim() || "Новая позиция"}
                </h3>
              </div>
              <button
                type="button"
                className={btnSmGhost}
                onClick={closeMenuItemEdit}
              >
                Закрыть
              </button>
            </div>

            <div className="grid gap-[1.1rem] min-[720px]:grid-cols-[220px_minmax(0,1fr)] min-[720px]:items-start">
              <div >
                <span className="text-[10px] font-[650] uppercase tracking-[0.12em] text-ink/48">Фото</span>
                {editingMenuItem.item.image ? (
                  <button
                    type="button"
                    className="grid h-[160px] w-full max-w-[220px] cursor-zoom-in place-items-center overflow-hidden rounded-xl border border-ink/12 bg-[linear-gradient(145deg,rgba(239,231,216,0.75),rgba(251,248,241,0.98))] p-0 [&_img]:block [&_img]:size-full [&_img]:object-contain"
                    onClick={() => setLightbox(editingMenuItem.item.image)}
                    aria-label="Открыть фото"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={editingMenuItem.item.image} alt="" />
                  </button>
                ) : (
                  <div className="grid h-[160px] w-full max-w-[220px] cursor-default place-items-center overflow-hidden rounded-xl border border-ink/12 bg-[linear-gradient(145deg,rgba(239,231,216,0.75),rgba(251,248,241,0.98))] p-0 text-[10px] uppercase tracking-[0.06em] text-ink/48" aria-hidden="true">
                    <span>Нет фото</span>
                  </div>
                )}
                <div className="flex flex-wrap items-center gap-[0.4rem]">
                  <label className={menuItemUploadClass(busy)}>
                    <span>
                      {editingMenuItem.item.image ? "Заменить фото" : "Загрузить фото"}
                    </span>
                    <input
                      type="file"
                      accept="image/*"
                      disabled={busy}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        e.target.value = "";
                        if (file) {
                          void handleUpload(
                            `menu-item-${editingMenuItem.catIndex}-${editingMenuItem.itemIndex}`,
                            file,
                          );
                        }
                      }}
                    />
                  </label>
                  {editingMenuItem.item.image ? (
                    <button
                      type="button"
                      className={btnSmGhost}
                      disabled={busy}
                      onClick={() =>
                        patchEditingMenuItem((row) => {
                          row.image = "";
                        })
                      }
                    >
                      Удалить фото
                    </button>
                  ) : null}
                </div>
                <p className="text-xs leading-[1.4] text-ink/48">{PRODUCT_UPLOAD_HINT}</p>
              </div>

              <div className="grid gap-3">
                <Field
                  label="Название"
                  value={editingMenuItem.item.name}
                  placeholder="Название блюда"
                  onChange={(v) => patchEditingMenuItem((row) => { row.name = v; })}
                />
                <Field
                  label="Описание"
                  value={editingMenuItem.item.description}
                  placeholder="Коротко о блюде"
                  multiline
                  onChange={(v) =>
                    patchEditingMenuItem((row) => { row.description = v; })
                  }
                />
                <Field
                  label="Цена"
                  value={editingMenuItem.item.price}
                  placeholder="450"
                  onChange={(v) => patchEditingMenuItem((row) => { row.price = v; })}
                />
                <Field
                  label="Вес / выход"
                  value={editingMenuItem.item.weight}
                  placeholder="250 г"
                  onChange={(v) =>
                    patchEditingMenuItem((row) => {
                      row.weight = v;
                    })
                  }
                />

                <div className="grid gap-3 sm:grid-cols-2">
                  <ToggleField
                    label="Показывать в доставке"
                    checked={editingMenuItem.item.showInDelivery}
                    onChange={(v) =>
                      patchEditingMenuItem((row) => {
                        row.showInDelivery = v;
                      })
                    }
                  />
                  <ToggleField
                    label="В наличии"
                    checked={editingMenuItem.item.inStock}
                    hint="Выкл. — «Закончилось» в доставке"
                    onChange={(v) =>
                      patchEditingMenuItem((row) => {
                        row.inStock = v;
                      })
                    }
                  />
                  <ToggleField
                    label="Допродажа"
                    checked={editingMenuItem.item.showInUpsell}
                    hint="Лента «Добавить к заказу»"
                    onChange={(v) =>
                      patchEditingMenuItem((row) => {
                        row.showInUpsell = v;
                      })
                    }
                  />
                  <Field
                    label="Порядок в допродаже"
                    value={String(editingMenuItem.item.upsellSortOrder || 0)}
                    type="number"
                    placeholder="0"
                    onChange={(v) =>
                      patchEditingMenuItem((row) => {
                        const n = Number(v);
                        row.upsellSortOrder =
                          Number.isFinite(n) && n >= 0 ? Math.round(n) : 0;
                      })
                    }
                  />
                </div>

                <div>
                  <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.14em] text-clay">
                    КБЖУ на 100 г
                  </p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field
                      label="Ккал"
                      value={
                        editingMenuItem.item.kcal != null
                          ? String(editingMenuItem.item.kcal)
                          : ""
                      }
                      type="number"
                      placeholder="—"
                      onChange={(v) =>
                        patchEditingMenuItem((row) => {
                          const n = Number(v.replace(",", "."));
                          row.kcal = v.trim() && Number.isFinite(n) ? n : null;
                        })
                      }
                    />
                    <Field
                      label="Белки"
                      value={
                        editingMenuItem.item.protein != null
                          ? String(editingMenuItem.item.protein)
                          : ""
                      }
                      type="number"
                      placeholder="—"
                      onChange={(v) =>
                        patchEditingMenuItem((row) => {
                          const n = Number(v.replace(",", "."));
                          row.protein =
                            v.trim() && Number.isFinite(n) ? n : null;
                        })
                      }
                    />
                    <Field
                      label="Жиры"
                      value={
                        editingMenuItem.item.fat != null
                          ? String(editingMenuItem.item.fat)
                          : ""
                      }
                      type="number"
                      placeholder="—"
                      onChange={(v) =>
                        patchEditingMenuItem((row) => {
                          const n = Number(v.replace(",", "."));
                          row.fat = v.trim() && Number.isFinite(n) ? n : null;
                        })
                      }
                    />
                    <Field
                      label="Углеводы"
                      value={
                        editingMenuItem.item.carbs != null
                          ? String(editingMenuItem.item.carbs)
                          : ""
                      }
                      type="number"
                      placeholder="—"
                      onChange={(v) =>
                        patchEditingMenuItem((row) => {
                          const n = Number(v.replace(",", "."));
                          row.carbs =
                            v.trim() && Number.isFinite(n) ? n : null;
                        })
                      }
                    />
                  </div>
                </div>

                <div className={fieldClass}>
                  <div className="flex items-baseline justify-between gap-3">
                    <label htmlFor="menu-item-category">Категория</label>
                  </div>
                  <select
                    id="menu-item-category"
                    className="w-full rounded-xl border border-ink/12 bg-paper/95 px-[0.85rem] py-[0.7rem] font-sans text-sm font-medium leading-[1.4] text-ink outline-none focus:border-clay focus:shadow-[0_0_0_3px_rgba(156,107,74,0.12)]"
                    value={menuItemEdit?.categoryId ?? ""}
                    onChange={(e) => moveEditingMenuItemToCategory(e.target.value)}
                  >
                    {site.menu.categories.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.name.trim() || "Без названия"}
                      </option>
                    ))}
                  </select>
                </div>

                <div className={fieldClass}>
                  <div className="flex items-baseline justify-between gap-3">
                    <label>Порядок в категории</label>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      className={btnLine}
                      disabled={editingMenuItem.itemIndex <= 0}
                      onClick={() => moveEditingMenuItem(-1)}
                    >
                      Выше
                    </button>
                    <span className="min-w-[4.5rem] text-center text-[0.9rem] text-ink/48">
                      {editingMenuItem.itemIndex + 1} из{" "}
                      {editingMenuItem.category.items.length}
                    </span>
                    <button
                      type="button"
                      className={btnLine}
                      disabled={
                        editingMenuItem.itemIndex >=
                        editingMenuItem.category.items.length - 1
                      }
                      onClick={() => moveEditingMenuItem(1)}
                    >
                      Ниже
                    </button>
                  </div>
                  <p className="text-xs leading-[1.4] text-ink/48">
                    Или тяните ⋮⋮ в списке категорий, чтобы менять порядок.
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-[1.15rem] flex items-center justify-between gap-[0.65rem] border-t border-ink/8 pt-[0.9rem]">
              <button
                type="button"
                className={btnDangerText}
                onClick={() =>
                  askDelete(
                    "Удалить позицию?",
                    "Блюдо исчезнет из меню на сайте.",
                    () => {
                      const target = menuItemEdit;
                      if (!target) return;
                      patchSite((d) => {
                        const category = d.menu.categories.find(
                          (c) => c.id === target.categoryId,
                        );
                        if (!category) return;
                        category.items = category.items.filter(
                          (item) => item.id !== target.itemId,
                        );
                      });
                      closeMenuItemEdit();
                    },
                  )
                }
              >
                Удалить
              </button>
              <button
                type="button"
                className={btnDark}
                onClick={closeMenuItemEdit}
              >
                Готово
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {lightbox ? (
        <div className="fixed inset-0 z-[80] grid place-items-center bg-[#181612]/88 p-5 backdrop-blur-[8px] [&_img]:max-h-[85vh] [&_img]:max-w-[min(900px,100%)] [&_img]:rounded-[10px] [&_img]:object-contain [&_img]:shadow-[0_30px_80px_rgba(0,0,0,0.35)] [&_button]:absolute [&_button]:top-4 [&_button]:right-4 [&_button]:inline-flex [&_button]:size-11 [&_button]:cursor-pointer [&_button]:items-center [&_button]:justify-center [&_button]:rounded-full [&_button]:border [&_button]:border-paper/20 [&_button]:bg-[#181612]/40 [&_button]:p-0 [&_button]:text-white" role="dialog" aria-modal="true" onClick={() => setLightbox(null)}>
          <button type="button" aria-label="Закрыть" onClick={() => setLightbox(null)}>
            <X size={18} strokeWidth={2} aria-hidden="true" />
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={lightbox} alt="" onClick={(e) => e.stopPropagation()} />
        </div>
      ) : null}

      {toastPortal}
    </div>
    </DndProvider>
  );
}
