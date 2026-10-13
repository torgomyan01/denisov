"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";
import {
  checkAuthAction,
  loginAction,
  logoutAction,
} from "@/actions/auth";
import {
  getSiteAction,
  updateSiteAction,
  uploadFileAction,
} from "@/actions/site";
import { brandLabel } from "@/lib/format";
import { createClientId } from "@/lib/ids";
import {
  formatUploadLimitError,
  MAX_UPLOAD_BYTES,
  MAX_UPLOAD_LABEL,
} from "@/lib/upload-limits";
import type { SiteData } from "@/types/site";
import {
  ConfirmModal,
  EmptyState,
  Field,
  FileDrop,
  IconNav,
  MediaPreview,
} from "@/components/admin/ui";
import { DndProvider, SortableItem } from "@/components/admin/dnd";

const UPLOAD_HINT = `JPG, PNG или WebP · до ${MAX_UPLOAD_LABEL} · сжатие авто`;
const LOGO_HINT = `SVG, PNG или WebP · до ${MAX_UPLOAD_LABEL}`;


const TABS = ["hero", "dishes", "about", "contacts", "menu"] as const;
type TabId = (typeof TABS)[number];

const TAB_LABELS: Record<TabId, string> = {
  hero: "Hero",
  dishes: "Блюда",
  about: "О кафе",
  contacts: "Контакты",
  menu: "Меню",
};

const TAB_HINTS: Record<TabId, string> = {
  hero: "Главный экран, кнопки и большое фото",
  dishes: "Галерея блюд для слайдера на сайте",
  about: "Тексты и три ключевые цифры",
  contacts: "Телефон, адрес, SEO и футер",
  menu: "Категории и позиции страницы меню",
};

const DEFAULT_LOGO = "/images/logo.png";

const isTabId = (value: string): value is TabId =>
  (TABS as readonly string[]).includes(value);

const parseTabFromHash = (): TabId => {
  const raw = window.location.hash.replace("#", "");
  return isTabId(raw) ? raw : "hero";
};


const ensureMenu = (site: SiteData): SiteData => {
  const next = structuredClone(site);
  if (!next.menu || typeof next.menu !== "object") {
    next.menu = { title: "Меню", note: "", categories: [] };
  }
  if (!Array.isArray(next.menu.categories)) next.menu.categories = [];
  next.menu.categories = next.menu.categories.map((cat) => ({
    id: cat.id || createClientId("cat"),
    name: cat.name ?? "",
    items: Array.isArray(cat.items)
      ? cat.items.map((item) => ({
          id: item.id || createClientId("item"),
          name: item.name ?? "",
          description: item.description ?? "",
          price: item.price ?? "",
        }))
      : [],
  }));
  if (!Array.isArray(next.dishes)) next.dishes = [];
  next.dishes = next.dishes.map((dish) => ({
    id: dish.id || createClientId("dish"),
    image: dish.image ?? "",
    caption: dish.caption ?? "",
  }));
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

export default function AdminApp() {
  const [booting, setBooting] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);
  const [site, setSite] = useState<SiteData | null>(null);
  const [savedSnap, setSavedSnap] = useState("");
  const [tab, setTab] = useState<TabId>("hero");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loginError, setLoginError] = useState("");
  const [toast, setToast] = useState({ text: "", tone: "success" as "success" | "error" });
  const [toastVisible, setToastVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [collapsedCats, setCollapsedCats] = useState<Record<number, boolean>>({});
  const [confirm, setConfirm] = useState<ConfirmState>(null);
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [menuFilter, setMenuFilter] = useState("");
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedAtRef = useRef<string>("");

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

  const applySavedSite = useCallback((data: SiteData) => {
    const normalized = prepareForSave(data);
    const snap = snapshot(normalized);
    setSite(normalized);
    setSavedSnap(snap);
    savedAtRef.current = new Date().toLocaleTimeString("ru-RU", {
      hour: "2-digit",
      minute: "2-digit",
    });
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

  const persistSite = useCallback(
    async (next: SiteData, successMessage: string): Promise<boolean> => {
      setBusy(true);
      try {
        const payload = prepareForSave(next);
        const result = await updateSiteAction(payload);
        if (!result.success) {
          showToast(result.error, "error");
          return false;
        }
        applySavedSite(result.data ?? payload);
        showToast(successMessage);
        return true;
      } finally {
        setBusy(false);
      }
    },
    [applySavedSite, showToast],
  );

  const addDish = useCallback(async () => {
    if (!site || busy) return;
    const next = prepareForSave(site);
    next.dishes.push({ id: createClientId("dish"), image: "", caption: "" });
    // Show immediately as clean state, then persist — no "save changes" bar.
    applySavedSite(next);
    const ok = await persistSite(next, "Блюдо добавлено");
    if (!ok) await loadSite();
  }, [site, busy, applySavedSite, persistSite, loadSite]);

  const showPanel = useCallback((name: TabId) => {
    setTab(name);
    if (window.location.hash.replace("#", "") !== name) {
      window.history.replaceState(null, "", `#${name}`);
    }
  }, []);


  useEffect(() => {
    let cancelled = false;

    const boot = async () => {
      const auth = await checkAuthAction();
      if (cancelled) return;
      if (auth.success && auth.data?.ok) {
        const ok = await loadSite();
        if (!cancelled && ok) {
          setAuthenticated(true);
          showPanel(parseTabFromHash());
        }
      }
      if (!cancelled) setBooting(false);
    };

    void boot();
    const onHash = () => showPanel(parseTabFromHash());
    window.addEventListener("hashchange", onHash);
    return () => {
      cancelled = true;
      window.removeEventListener("hashchange", onHash);
      if (toastTimer.current) clearTimeout(toastTimer.current);
    };
  }, [loadSite, showPanel]);

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
        showPanel(parseTabFromHash());
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
    setAuthenticated(false);
    setSite(null);
    setSavedSnap("");
    setPassword("");
    setBusy(false);
  };

  const discardChanges = () => {
    if (!site) return;
    void loadSite().then((ok) => {
      if (ok) showToast("Изменения отменены");
    });
  };

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
      const fd = new FormData();
      fd.append("field", field);
      fd.append("file", file);
      const result = await uploadFileAction(fd);
      if (!result.success || !result.data) {
        showToast(result.success ? "Ошибка загрузки" : result.error, "error");
        return;
      }
      applySavedSite(result.data.site);
      showToast("Загружено и сжато");
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
      <div className="admin-root">
        <div className="boot-screen">
          <div className="boot-spinner" aria-hidden="true" />
          <p>Загрузка панели…</p>
        </div>
      </div>
    );
  }

  if (!authenticated || !site) {
    return (
      <div className="admin-root">
        <div className="login-shell">
          <div className="login-card">
            <p className="text-center text-[11px] font-semibold uppercase tracking-[0.35em] text-[var(--clay)]">
              Кафе ДЕНИСОВ
            </p>
            <h1 className="login-mark">Админ</h1>
            <hr className="section-rule mt-6" />
            <form className="mt-7 space-y-5" onSubmit={handleLogin}>
              <div className="field">
                <label htmlFor="password">Пароль</label>
                <div className="password-wrap">
                  <input
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
                    className="password-toggle"
                    onClick={() => setShowPassword((v) => !v)}
                  >
                    {showPassword ? "Скрыть" : "Показать"}
                  </button>
                </div>
              </div>
              {loginError ? <p className="login-error">{loginError}</p> : null}
              <button className="btn btn-dark w-full" type="submit" disabled={busy}>
                {busy ? "Вход…" : "Войти"}
              </button>
            </form>
          </div>
        </div>
        <div className={`toast ${toast.tone} ${toastVisible ? "show" : ""}`}>{toast.text}</div>
      </div>
    );
  }

  const logoSrc = site.brand.logo?.trim() || DEFAULT_LOGO;
  const dishCount = site.dishes.length;
  const catCount = site.menu.categories.length;
  const itemCount = site.menu.categories.reduce((n, c) => n + c.items.length, 0);
  const filter = menuFilter.trim().toLowerCase();

  return (
    <DndProvider>
    <div className="admin-root">
      <div className="admin-shell">
        <aside className="admin-sidebar" aria-label="Разделы">
          <div className="admin-brand">
            <p className="admin-brand-kicker">{brandLabel(site)}</p>
            <p className="admin-brand-title">Панель</p>
          </div>

          <nav className="admin-nav">
            {TABS.map((id) => (
              <button
                key={id}
                type="button"
                className={`admin-nav-item ${tab === id ? "active" : ""}`}
                onClick={() => showPanel(id)}
              >
                <span className="admin-nav-ico">
                  <IconNav name={id} />
                </span>
                <span className="admin-nav-label">{TAB_LABELS[id]}</span>
                {id === "dishes" ? <span className="admin-nav-meta">{dishCount}</span> : null}
                {id === "menu" ? <span className="admin-nav-meta">{itemCount}</span> : null}
              </button>
            ))}
          </nav>

          <div className="admin-sidebar-foot">
            <a href="/" target="_blank" rel="noreferrer" className="btn btn-line w-full">
              Открыть сайт
            </a>
            <button type="button" className="btn btn-ghost-soft w-full" disabled={busy} onClick={() => void handleLogout()}>
              Выйти
            </button>
          </div>
        </aside>

        <div>
          <header className="admin-top">
            <div className="admin-top-inner">
              <div className="admin-top-copy">
                <h1>{TAB_LABELS[tab]}</h1>
                <p>{TAB_HINTS[tab]}</p>
              </div>
              <div className="admin-actions">
                <span className={`chip ${dirty ? "dirty" : "ok"}`}>
                  {dirty ? "Не сохранено" : savedAtRef.current ? `Сохранено ${savedAtRef.current}` : "Актуально"}
                </span>
                <a href="/menu" target="_blank" rel="noreferrer" className="btn btn-line lg:hidden">
                  Меню
                </a>
                <button
                  className="btn btn-dark"
                  type="button"
                  disabled={busy || !dirty}
                  onClick={() => void handleSave()}
                >
                  {busy ? "Сохранение…" : "Сохранить"}
                </button>
                <button
                  className="btn btn-line lg:hidden"
                  type="button"
                  disabled={busy}
                  onClick={() => void handleLogout()}
                >
                  Выйти
                </button>
              </div>
            </div>

            <div className="admin-tabs-mobile" aria-label="Разделы админки">
              {TABS.map((id) => (
                <button
                  key={id}
                  type="button"
                  className={`tab ${tab === id ? "active" : ""}`}
                  onClick={() => showPanel(id)}
                >
                  {TAB_LABELS[id]}
                </button>
              ))}
            </div>
          </header>

          <main className="admin-main">
            <div className={`admin-grid ${tab === "hero" ? "has-preview" : ""}`}>
              <div>
                {tab === "hero" ? (
                  <section className="panel">
                    <div className="panel-head">
                      <div>
                        <h2 className="panel-title">Hero и кнопки</h2>
                        <p className="panel-hint">Тексты первого экрана, Telegram и фирменные изображения.</p>
                      </div>
                    </div>
                    <hr className="section-rule" />

                    <div className="fields-grid cols-2">
                      <Field label="Верхняя строка" value={site.hero.eyebrow} placeholder="Кафе · Пекарня · …" onChange={(v) => patchSite((d) => { d.hero.eyebrow = v; })} />
                      <Field label="Заголовок" value={site.hero.title} placeholder="Денисов" onChange={(v) => patchSite((d) => { d.hero.title = v; })} />
                      <div className="span-2">
                        <Field label="Подзаголовок" multiline value={site.hero.subtitle} placeholder="Короткое описание атмосферы" onChange={(v) => patchSite((d) => { d.hero.subtitle = v; })} />
                      </div>
                      <div className="span-2">
                        <Field label="Строка адреса / часов" value={site.hero.metaLine} onChange={(v) => patchSite((d) => { d.hero.metaLine = v; })} />
                      </div>
                      <Field label="Текст кнопки меню" value={site.hero.menuButtonLabel} onChange={(v) => patchSite((d) => { d.hero.menuButtonLabel = v; })} />
                      <Field label="Текст кнопки Telegram" value={site.hero.telegramButtonLabel} onChange={(v) => patchSite((d) => { d.hero.telegramButtonLabel = v; })} />
                      <div className="span-2">
                        <Field
                          label="Ссылка Telegram"
                          type="url"
                          value={site.hero.telegramUrl}
                          placeholder="https://t.me/cafe_Denisov"
                          hint="Эта ссылка подставится во все Telegram-кнопки на сайте."
                          onChange={(v) => patchSite((d) => { d.hero.telegramUrl = v; })}
                        />
                      </div>
                      <Field label="Подпись большого фото" value={site.hero.featuredCaption} onChange={(v) => patchSite((d) => { d.hero.featuredCaption = v; })} />
                      <Field label="Бейдж" value={site.hero.featuredBadge} onChange={(v) => patchSite((d) => { d.hero.featuredBadge = v; })} />
                    </div>

                    <div className="section-block">
                      <p className="section-label">Медиа</p>
                      <div className="media-row">
                        <MediaPreview src={logoSrc} logo />
                        <FileDrop label="Логотип" title="Перетащите или выберите файл" hint={LOGO_HINT} accept="image/*,.svg" disabled={busy} onFile={(file) => void handleUpload("logo", file)} />
                      </div>
                      <div className="media-row wide-preview mt-4">
                        <MediaPreview
                          src={site.hero.featuredImage || ""}
                          onOpen={site.hero.featuredImage ? () => setLightbox(site.hero.featuredImage) : undefined}
                        />
                        <FileDrop label="Большое фото (featured)" title="Перетащите или выберите файл" hint={UPLOAD_HINT} accept="image/*" disabled={busy} onFile={(file) => void handleUpload("featured", file)} />
                      </div>
                    </div>
                  </section>
                ) : null}

                {tab === "dishes" ? (
                  <section className="panel">
                    <div className="panel-head">
                      <div>
                        <h2 className="panel-title">Блюда</h2>
                        <p className="panel-hint">
                          {dishCount
                            ? `${dishCount} в слайдере. Тяните ⋮⋮ чтобы менять порядок.`
                            : "Добавляйте фото с подписями для галереи на главной."}
                        </p>
                      </div>
                      <button
                        type="button"
                        className="btn btn-dark"
                        disabled={busy}
                        onClick={() => void addDish()}
                      >
                        + Добавить блюдо
                      </button>
                    </div>
                    <hr className="section-rule" />

                    {!dishCount ? (
                      <EmptyState
                        title="Пока пусто"
                        text="Добавьте первое блюдо и сразу загрузите фото."
                        action={
                          <button
                            type="button"
                            className="btn btn-dark"
                            disabled={busy}
                            onClick={() => void addDish()}
                          >
                            + Добавить блюдо
                          </button>
                        }
                      />
                    ) : (
                      <div className="dish-grid">
                        {site.dishes.map((dish, i) => (
                          <SortableItem
                            key={dish.id}
                            group="dishes"
                            index={i}
                            className="dish-card"
                            onReorder={(from, to) =>
                              patchSite((d) => {
                                d.dishes = moveItem(d.dishes, from, to);
                              })
                            }
                          >
                            <div className="dish-card-top">
                              <span className="badge">Блюдо {i + 1}</span>
                              <div className="dish-tools">
                                <button
                                  type="button"
                                  className="btn-danger"
                                  onClick={() =>
                                    askDelete("Удалить блюдо?", "Фото останется в uploads, но карточка исчезнет из слайдера.", () => {
                                      patchSite((d) => { d.dishes.splice(i, 1); });
                                    })
                                  }
                                >
                                  Удалить
                                </button>
                              </div>
                            </div>
                            <MediaPreview
                              src={dish.image || ""}
                              onOpen={dish.image ? () => setLightbox(dish.image) : undefined}
                            />
                            <Field
                              label="Подпись"
                              value={dish.caption}
                              placeholder="Название блюда"
                              onChange={(v) => patchSite((d) => { if (d.dishes[i]) d.dishes[i].caption = v; })}
                            />
                            <FileDrop
                              label="Фото"
                              title="Загрузить"
                              hint={UPLOAD_HINT}
                              accept="image/*"
                              disabled={busy}
                              onFile={(file) => void handleUpload(`dish-${i}`, file)}
                            />
                          </SortableItem>
                        ))}
                      </div>
                    )}
                  </section>
                ) : null}

                {tab === "about" ? (
                  <section className="panel">
                    <div className="panel-head">
                      <div>
                        <h2 className="panel-title">О кафе</h2>
                        <p className="panel-hint">История места и три акцентные цифры.</p>
                      </div>
                    </div>
                    <hr className="section-rule" />
                    <div className="fields-grid">
                      <Field label="Метка секции" value={site.about.eyebrow} onChange={(v) => patchSite((d) => { d.about.eyebrow = v; })} />
                      <Field label="Заголовок" multiline value={site.about.title} onChange={(v) => patchSite((d) => { d.about.title = v; })} />
                      <Field label="Текст" multiline value={site.about.text} onChange={(v) => patchSite((d) => { d.about.text = v; })} />
                    </div>

                    <div className="section-block">
                      <p className="section-label">Цифры</p>
                      <div className="stats-grid mb-4">
                        <div className="stat-card">
                          <strong>{site.about.stat1Value || "—"}</strong>
                          <span>{site.about.stat1Label || "стат 1"}</span>
                        </div>
                        <div className="stat-card">
                          <strong>{site.about.stat2Value || "—"}</strong>
                          <span>{site.about.stat2Label || "стат 2"}</span>
                        </div>
                        <div className="stat-card">
                          <strong>{site.about.stat3Value || "—"}</strong>
                          <span>{site.about.stat3Label || "стат 3"}</span>
                        </div>
                      </div>
                      <div className="fields-grid cols-2">
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
                  <section className="panel">
                    <div className="panel-head">
                      <div>
                        <h2 className="panel-title">Контакты и SEO</h2>
                        <p className="panel-hint">Как с вами связаться и как сайт видят поисковики.</p>
                      </div>
                    </div>
                    <hr className="section-rule" />

                    <div className="fields-grid cols-2">
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

                    <div className="section-block">
                      <p className="section-label">Фото блока</p>
                      <div className="media-row wide-preview">
                        <MediaPreview
                          src={site.contacts.image || ""}
                          onOpen={site.contacts.image ? () => setLightbox(site.contacts.image) : undefined}
                        />
                        <FileDrop label="Фото контактов" title="Перетащите или выберите файл" hint={UPLOAD_HINT} accept="image/*" disabled={busy} onFile={(file) => void handleUpload("contacts", file)} />
                      </div>
                    </div>

                    <div className="section-block">
                      <p className="section-label">Футер</p>
                      <div className="fields-grid cols-2">
                        <Field label="Footer — название" value={site.footer.brand} hint="Пусто = «ДЕНИСОВ»" onChange={(v) => patchSite((d) => { d.footer.brand = v; })} />
                        <Field label="Footer — копирайт" value={site.footer.copyright} onChange={(v) => patchSite((d) => { d.footer.copyright = v; })} />
                      </div>
                    </div>

                    <div className="section-block">
                      <p className="section-label">SEO</p>
                      <div className="fields-grid">
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
                  <section className="panel">
                    <div className="panel-head">
                      <div>
                        <h2 className="panel-title">Меню</h2>
                        <p className="panel-hint">
                          {catCount} категорий · {itemCount} позиций · тяните ⋮⋮ для порядка
                        </p>
                      </div>
                      <button
                        type="button"
                        className="btn btn-dark"
                        onClick={() => {
                          patchSite((d) => {
                            d.menu.categories.push({
                              id: createClientId("cat"),
                              name: "Новая категория",
                              items: [
                                {
                                  id: createClientId("item"),
                                  name: "",
                                  description: "",
                                  price: "",
                                },
                              ],
                            });
                          });
                          showToast("Категория добавлена");
                        }}
                      >
                        + Категория
                      </button>
                    </div>
                    <hr className="section-rule" />

                    <div className="fields-grid cols-2">
                      <Field label="Заголовок меню" value={site.menu.title} placeholder="Меню" onChange={(v) => patchSite((d) => { d.menu.title = v; })} />
                      <Field label="Подпись внизу" value={site.menu.note} placeholder="Цены указаны в рублях" onChange={(v) => patchSite((d) => { d.menu.note = v; })} />
                      <div className="span-2">
                        <Field
                          label="Быстрый поиск по позициям"
                          value={menuFilter}
                          placeholder="Например: борщ, блины…"
                          onChange={setMenuFilter}
                        />
                      </div>
                    </div>

                    <div className="menu-list mt-5">
                      {!site.menu.categories.length ? (
                        <EmptyState
                          title="Меню ещё пустое"
                          text="Создайте первую категорию — завтраки, супы, выпечка и так далее."
                          action={
                            <button
                              type="button"
                              className="btn btn-dark"
                              onClick={() =>
                                patchSite((d) => {
                                  d.menu.categories.push({
                                    id: createClientId("cat"),
                                    name: "",
                                    items: [],
                                  });
                                })
                              }
                            >
                              + Категория
                            </button>
                          }
                        />
                      ) : null}

                      {site.menu.categories.map((cat, ci) => {
                        const collapsed = Boolean(collapsedCats[ci]);
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

                        return (
                          <SortableItem
                            key={cat.id}
                            group="menu-categories"
                            index={ci}
                            className="menu-cat"
                            onReorder={(from, to) =>
                              patchSite((d) => {
                                d.menu.categories = moveItem(d.menu.categories, from, to);
                              })
                            }
                          >
                            <div className="menu-cat-head">
                              <span className="badge">
                                Категория {ci + 1}
                                {cat.items.length ? ` · ${cat.items.length}` : ""}
                              </span>
                              <div className="menu-cat-tools">
                                <button
                                  type="button"
                                  className="btn-sm btn-ghost"
                                  onClick={() => setCollapsedCats((prev) => ({ ...prev, [ci]: !prev[ci] }))}
                                >
                                  {collapsed ? "Развернуть" : "Свернуть"}
                                </button>
                                <button
                                  type="button"
                                  className="btn-sm btn-ghost"
                                  onClick={() =>
                                    patchSite((d) => {
                                      d.menu.categories[ci]?.items.push({
                                        id: createClientId("item"),
                                        name: "",
                                        description: "",
                                        price: "",
                                      });
                                    })
                                  }
                                >
                                  + Позиция
                                </button>
                                <button
                                  type="button"
                                  className="btn-danger"
                                  onClick={() =>
                                    askDelete("Удалить категорию?", "Все позиции внутри тоже исчезнут.", () => {
                                      patchSite((d) => { d.menu.categories.splice(ci, 1); });
                                    })
                                  }
                                >
                                  Удалить
                                </button>
                              </div>
                            </div>

                            <Field
                              label="Название категории"
                              value={cat.name}
                              placeholder="Например: Завтраки"
                              onChange={(v) => patchSite((d) => { if (d.menu.categories[ci]) d.menu.categories[ci].name = v; })}
                            />

                            {!collapsed ? (
                              <div className="menu-items-list">
                                {!items.length ? (
                                  <p className="text-sm text-[var(--muted)]">
                                    {filter ? "Нет совпадений в этой категории." : "Позиций пока нет."}
                                  </p>
                                ) : null}
                                {items.map(({ item, ii }) => (
                                  <SortableItem
                                    key={item.id}
                                    group={`menu-items-${ci}`}
                                    index={ii}
                                    className="menu-item-wrap"
                                    bodyClassName="menu-item-row"
                                    onReorder={(from, to) =>
                                      patchSite((d) => {
                                        const catItems = d.menu.categories[ci]?.items;
                                        if (catItems) {
                                          d.menu.categories[ci].items = moveItem(catItems, from, to);
                                        }
                                      })
                                    }
                                  >
                                    <Field
                                      label="Блюдо"
                                      value={item.name}
                                      placeholder="Название"
                                      onChange={(v) => patchSite((d) => {
                                        const row = d.menu.categories[ci]?.items[ii];
                                        if (row) row.name = v;
                                      })}
                                    />
                                    <Field
                                      label="Описание"
                                      value={item.description}
                                      placeholder="Коротко"
                                      onChange={(v) => patchSite((d) => {
                                        const row = d.menu.categories[ci]?.items[ii];
                                        if (row) row.description = v;
                                      })}
                                    />
                                    <Field
                                      label="Цена"
                                      value={item.price}
                                      placeholder="450"
                                      onChange={(v) => patchSite((d) => {
                                        const row = d.menu.categories[ci]?.items[ii];
                                        if (row) row.price = v;
                                      })}
                                    />
                                    <button
                                      type="button"
                                      className="btn-danger self-end pb-2"
                                      onClick={() =>
                                        askDelete("Удалить позицию?", "Блюдо исчезнет из меню на сайте.", () => {
                                          patchSite((d) => { d.menu.categories[ci]?.items.splice(ii, 1); });
                                        })
                                      }
                                    >
                                      Удалить
                                    </button>
                                  </SortableItem>
                                ))}
                              </div>
                            ) : null}
                          </SortableItem>
                        );
                      })}
                    </div>
                  </section>
                ) : null}
              </div>

              {tab === "hero" ? (
                <aside className="live-preview" aria-label="Живой превью">
                  <div className="live-preview-inner">
                    <div className="live-preview-bar">
                      <span>Превью Hero</span>
                      <span>{dirty ? "черновик" : "опубликовано"}</span>
                    </div>
                    <div className="live-hero">
                      <p className="eyebrow">{site.hero.eyebrow || " "}</p>
                      <h3>{site.hero.title || "Денисов"}</h3>
                      <p className="subtitle">{site.hero.subtitle || "Подзаголовок появится здесь"}</p>
                      <div className="live-cta-row">
                        <span className="live-cta primary">{site.hero.menuButtonLabel || "Меню"}</span>
                        <span className="live-cta ghost">{site.hero.telegramButtonLabel || "Telegram"}</span>
                      </div>
                      <p className="meta">{site.hero.metaLine || " "}</p>
                      <div className="live-hero-media">
                        {site.hero.featuredImage ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={site.hero.featuredImage} alt="" />
                        ) : null}
                      </div>
                    </div>
                  </div>
                </aside>
              ) : null}
            </div>
          </main>
        </div>
      </div>

      {dirty ? (
        <div className="save-bar show">
          <div className="save-bar-inner">
            <div>
              <p>Есть несохранённые изменения</p>
              <small>
                Быстрое сохранение: <span className="kbd">Ctrl</span> + <span className="kbd">S</span>
              </small>
            </div>
            <div className="save-bar-actions">
              <button type="button" className="btn btn-line" disabled={busy} onClick={discardChanges}>
                Отменить
              </button>
              <button type="button" className="btn btn-dark" disabled={busy} onClick={() => void handleSave()}>
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

      {lightbox ? (
        <div className="lightbox-admin" role="dialog" aria-modal="true" onClick={() => setLightbox(null)}>
          <button type="button" aria-label="Закрыть" onClick={() => setLightbox(null)}>
            ×
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={lightbox} alt="" onClick={(e) => e.stopPropagation()} />
        </div>
      ) : null}

      <div className={`toast ${toast.tone} ${toastVisible ? "show" : ""}`}>{toast.text}</div>
    </div>
    </DndProvider>
  );
}
