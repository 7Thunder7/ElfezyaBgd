// src/components/Header.tsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import api from "../lib/api";
import { logout as clearLocalTokens } from "../lib/auth";
import "../CSS/Header.css";
import { useTheme } from "../theme/ThemeProvider";

import logoImg from "../imgs/elmobde3 logo.png";

type UserLite = {
  id?: number;
  username?: string;
  first_name?: string;
  last_name?: string;
  email?: string;
};

type NavItem = {
  to: string;
  label: string;
  match?: "exact" | "startsWith";
  icon?: string;
};

const Header: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { theme, toggle } = useTheme();

  const [user, setUser] = useState<UserLite | null>(null);
  const [loadingUser, setLoadingUser] = useState(false);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  const menuRef = useRef<HTMLDivElement | null>(null);
  const avatarBtnRef = useRef<HTMLButtonElement | null>(null);

  const navItems: NavItem[] = useMemo(
    () => [
      { to: "/", label: "الصفحة الرئيسية", match: "exact", icon: "🏠" },
      { to: "/study", label: "يلا نذاكر", match: "startsWith", icon: "📘" },
      { to: "/store", label: "المتجر", match: "startsWith", icon: "🛍️" },
      { to: "/review", label: "المراجعة", match: "startsWith", icon: "✅" },
    ],
    []
  );

  const pathname = location.pathname || "/";

  const isActive = useCallback(
    (item: NavItem) => {
      if (item.match === "startsWith") return pathname.startsWith(item.to);
      return pathname === item.to;
    },
    [pathname]
  );

  const onLoginClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    navigate("/login", { state: { backgroundLocation: location } });
  };

  const fetchMe = useCallback(async () => {
    setLoadingUser(true);
    try {
      const res = await api.get("/me/");
      setUser((res?.data as UserLite) ?? null);
    } catch {
      setUser(null);
    } finally {
      setLoadingUser(false);
    }
  }, []);

  useEffect(() => {
    fetchMe();

    const onFocus = () => fetchMe();
    const onStorage = (ev: StorageEvent) => {
      if (ev.key === "access" || ev.key === "refresh") fetchMe();
    };

    window.addEventListener("focus", onFocus);
    window.addEventListener("storage", onStorage);

    return () => {
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("storage", onStorage);
    };
  }, [fetchMe]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (!menuOpen) return;
      const target = e.target as Node;
      if (menuRef.current?.contains(target)) return;
      if (avatarBtnRef.current?.contains(target)) return;
      setMenuOpen(false);
    };

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };

    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);

    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  useEffect(() => {
    setDrawerOpen(false);
    setMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!drawerOpen) return;

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setDrawerOpen(false);
    };

    document.addEventListener("keydown", onKey);

    return () => {
      document.body.style.overflow = prevOverflow;
      document.removeEventListener("keydown", onKey);
    };
  }, [drawerOpen]);

  const userInitial = useMemo(() => {
    if (!user) return "";
    const src = (user.first_name && user.first_name.trim()) || user.username || user.email || "";
    return src ? src.trim().charAt(0).toUpperCase() : "";
  }, [user]);

  const displayName = useMemo(() => {
    if (!user) return "";
    const name = `${user.first_name ?? ""} ${user.last_name ?? ""}`.trim();
    return name || user.username || user.email || "الحساب";
  }, [user]);

  const handleLogout = async () => {
    const ok = window.confirm("هل ترغب في تسجيل الخروج؟");
    if (!ok) return;

    try {
      await api.post("/logout/");
    } catch {
      // ignore
    } finally {
      try {
        clearLocalTokens();
      } catch {
        // ignore
      }
      setUser(null);
      setMenuOpen(false);
      setDrawerOpen(false);
      navigate("/", { replace: true });
    }
  };

  const themeLabel = theme === "dark" ? "تفعيل الوضع الفاتح" : "تفعيل الوضع الداكن";
  const themeTitle = theme === "dark" ? "Light mode" : "Dark mode";

  return (
    <header className={`siteHeader ${scrolled ? "siteHeader--scrolled" : ""}`}>
      <div className="siteHeader__row">
        <Link to="/" className="brand" aria-label="العودة للصفحة الرئيسية">
          <img className="brand__logo" src={logoImg} alt="الفيزياء BGD" />
        </Link>

        <div className="siteNavCard">
          <div className="siteNavCard__glow" aria-hidden="true" />

          <div className="siteNavCard__desktopShell">
            <nav className="nav nav--desktop" aria-label="Primary navigation">
              {navItems.map((it) => {
                const active = isActive(it);
                return (
                  <Link
                    key={it.to}
                    to={it.to}
                    className={`nav__link ${active ? "isActive" : ""}`}
                    aria-current={active ? "page" : undefined}
                  >
                    <span className="nav__icon" aria-hidden="true">
                      {it.icon}
                    </span>
                    <span className="nav__label">{it.label}</span>
                  </Link>
                );
              })}
            </nav>

            <div className="actions">
              <button
                type="button"
                className="themeBtn"
                onClick={toggle}
                aria-label={themeLabel}
                title={themeTitle}
              >
                {theme === "dark" ? "☀️" : "🌙"}
              </button>

              {user ? (
                <div className="userMenu">
                  <button
                    ref={avatarBtnRef}
                    type="button"
                    className="avatarBtn"
                    onClick={() => setMenuOpen((v) => !v)}
                    aria-haspopup="menu"
                    aria-expanded={menuOpen}
                    aria-label="قائمة الحساب"
                    title={displayName}
                  >
                    <span className="avatarBtn__ring" aria-hidden="true" />
                    <span className="avatarBtn__inner">{loadingUser ? "…" : userInitial || "؟"}</span>
                  </button>

                  {menuOpen && (
                    <div ref={menuRef} className="dropdown" role="menu">
                      <div className="dropdown__head">
                        <div className="dropdown__name">{displayName}</div>
                        <div className="dropdown__sub">{user?.email || "مرحباً بك 👋"}</div>
                      </div>

                      <div className="dropdown__sep" />

                      <button
                        type="button"
                        className="dropdown__item"
                        onClick={() => navigate("/profile")}
                        role="menuitem"
                      >
                        <span>الملف الشخصي</span>
                        <span className="dropdown__icon" aria-hidden="true">
                          👤
                        </span>
                      </button>

                      <button
                        type="button"
                        className="dropdown__item dropdown__item--danger"
                        onClick={handleLogout}
                        role="menuitem"
                      >
                        <span>تسجيل الخروج</span>
                        <span className="dropdown__icon" aria-hidden="true">
                          ⎋
                        </span>
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="guestActions">
                  <Link
                    to="/login"
                    state={{ backgroundLocation: location }}
                    onClick={onLoginClick}
                    className="btnX btnX--ghost"
                    aria-label="Open login"
                  >
                    Login
                  </Link>

                  <Link to="/signup" className="btnX btnX--primary">
                    Sign up
                  </Link>
                </div>
              )}

              <button
                type="button"
                className={`burger ${drawerOpen ? "isOpen" : ""}`}
                onClick={() => setDrawerOpen((v) => !v)}
                aria-label="فتح القائمة"
                aria-expanded={drawerOpen}
                aria-controls="mobileNav"
                title="القائمة"
              >
                <span className="burger__line" />
                <span className="burger__line" />
                <span className="burger__line" />
              </button>
            </div>
          </div>

          <button
            type="button"
            className={`navBackdrop ${drawerOpen ? "navBackdrop--open" : ""}`}
            onClick={() => setDrawerOpen(false)}
            aria-label="إغلاق القائمة"
            tabIndex={drawerOpen ? 0 : -1}
          />

          <nav
            id="mobileNav"
            className={`navDrawer ${drawerOpen ? "navDrawer--open" : ""}`}
            aria-label="Mobile navigation"
          >
            <div className="navDrawer__top">
              <div className="navDrawer__brand">
                <img src={logoImg} alt="الفيزياء BGD" className="navDrawer__logo" />
                <div>
                  <div className="navDrawer__title">القائمة الرئيسية</div>
                  <div className="navDrawer__subtitle">تنقل سريع داخل الموقع</div>
                </div>
              </div>

              <button
                type="button"
                className="navDrawer__close"
                onClick={() => setDrawerOpen(false)}
                aria-label="إغلاق"
                title="إغلاق"
              >
                ✕
              </button>
            </div>

            {user && (
              <div className="mobileUserCard">
                <div className="mobileUserCard__avatar">{loadingUser ? "…" : userInitial || "؟"}</div>
                <div className="mobileUserCard__meta">
                  <div className="mobileUserCard__name">{displayName}</div>
                  <div className="mobileUserCard__sub">{user?.email || "مرحباً بك 👋"}</div>
                </div>
              </div>
            )}

            <div className="navDrawer__list">
              {navItems.map((it) => {
                const active = isActive(it);
                return (
                  <Link
                    key={it.to}
                    to={it.to}
                    className={`navDrawer__link ${active ? "isActive" : ""}`}
                    aria-current={active ? "page" : undefined}
                    onClick={() => setDrawerOpen(false)}
                  >
                    <span className="navDrawer__linkIcon" aria-hidden="true">
                      {it.icon}
                    </span>
                    <span className="navDrawer__linkLabel">{it.label}</span>
                    <span className="navDrawer__chev" aria-hidden="true">
                      ‹
                    </span>
                  </Link>
                );
              })}
            </div>

            <div className="navDrawer__bottom">
              {!user ? (
                <div className="mobileAuth">
                  <Link
                    to="/login"
                    state={{ backgroundLocation: location }}
                    onClick={(e) => {
                      onLoginClick(e);
                      setDrawerOpen(false);
                    }}
                    className="btnX btnX--ghost mobileAuth__btn"
                  >
                    Login
                  </Link>
                  <Link
                    to="/signup"
                    className="btnX btnX--primary mobileAuth__btn"
                    onClick={() => setDrawerOpen(false)}
                  >
                    Sign up
                  </Link>
                </div>
              ) : (
                <button type="button" className="mobileLogoutBtn" onClick={handleLogout}>
                  تسجيل الخروج
                </button>
              )}

              <button
                type="button"
                className="mobileThemeBtn"
                onClick={toggle}
                aria-label={themeLabel}
                title={themeTitle}
              >
                <span>{theme === "dark" ? "☀️" : "🌙"}</span>
                <span>{theme === "dark" ? "الوضع الفاتح" : "الوضع الداكن"}</span>
              </button>
            </div>
          </nav>
        </div>
      </div>
    </header>
  );
};

export default Header;