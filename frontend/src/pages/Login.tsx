// src/pages/Login.tsx
import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import api from "../lib/api";
import { loginWithPassword, getCurrentUser } from "../lib/auth";
import "../CSS/Login.css";
import platformLogo from "../imgs/elfezya bgd.png";

/**
 * Minimal typings for the Google Identity SDK
 */
declare global {
    interface Window {
        google?: {
            accounts?: {
                id?: {
                    initialize: (opts: {
                        client_id: string;
                        callback: (resp: { credential?: string }) => void;
                    }) => void;
                    renderButton: (
                        container: HTMLElement,
                        options?: { theme?: string; size?: string; type?: string }
                    ) => void;
                    prompt?: () => void;
                    cancel?: () => void;
                };
            };
        };
        gapi?: unknown;
    }
}

/**
 * Extract error message from API response
 */
function extractMessageFromData(data: unknown): string | null {
    if (!data || typeof data !== "object") return null;

    const obj = data as Record<string, unknown>;
    const maybeDetail = obj.detail ?? obj.message ?? obj.error ?? null;

    if (typeof maybeDetail === "string") return maybeDetail;

    const maybeErrors = obj.errors ?? obj.error ?? null;
    if (maybeErrors && typeof maybeErrors === "object") {
        const errs = maybeErrors as Record<string, unknown>;
        for (const k of Object.keys(errs)) {
            const v = errs[k];
            if (Array.isArray(v) && v.length > 0 && typeof v[0] === "string")
                return v[0];
            if (typeof v === "string") return v;
        }
    }

    const nfe = (obj.non_field_errors ?? obj.nonFieldErrors) as unknown;
    if (Array.isArray(nfe) && nfe.length > 0 && typeof nfe[0] === "string")
        return nfe[0];

    return null;
}

function extractMessageFromError(
    err: unknown,
    fallback = "حدث خطأ غير متوقع"
): string {
    if (axios.isAxiosError(err)) {
        const resp = err.response;
        const fromData = extractMessageFromData(resp?.data);
        if (fromData) return fromData;

        if (resp) {
            const statusText = resp.statusText ?? "";
            return statusText || `HTTP ${resp.status}` || fallback;
        }
        return err.message ?? fallback;
    }

    if (err instanceof Error) return err.message || fallback;

    try {
        return String(err) || fallback;
    } catch {
        return fallback;
    }
}

/**
 * Fetch current user from /api/accounts/me/ and store in localStorage
 */
async function fetchAndStoreCurrentUser(): Promise<void> {
    try {
        const user = await getCurrentUser();

        if (user) {
            try {
                localStorage.setItem("current_user", JSON.stringify(user));
            } catch {
                // ignore storage errors
            }

            // Notify other components
            try {
                window.dispatchEvent(new Event("auth:update"));
            } catch {
                // ignore
            }
        }
    } catch (err) {
        console.warn("fetch /me/ failed after login:", err);
    }
}

const LoginPage: React.FC = () => {
    const navigate = useNavigate();
    const googleRef = useRef<HTMLDivElement | null>(null);

    const [identifier, setIdentifier] = useState("");
    const [password, setPassword] = useState("");

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [googleReady, setGoogleReady] = useState(false);

    const CLIENT_ID = (import.meta.env.VITE_GOOGLE_CLIENT_ID as string) || "";

    // Handle Google Sign-In
    const handleGoogleCredential = async (resp: { credential?: string }) => {
        if (!resp?.credential) {
            setError("لم يصدر توكن من جوجل.");
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const res = await api.post(
                "/auth/google/",
                { id_token: resp.credential, create_session: true },
                { withCredentials: true }
            );

            const data = res?.data;
            console.log("Google auth response:", data);

            // Check if we got user data
            if (data?.user) {
                await fetchAndStoreCurrentUser();
                window.location.replace("/");
                return;
            }

            // Fallback
            await fetchAndStoreCurrentUser();
            window.location.replace("/");
        } catch (err) {
            console.error("Google auth error:", err);
            const msg = extractMessageFromError(err, "فشل تسجيل الدخول عبر جوجل.");
            setError(msg);
        } finally {
            setLoading(false);
        }
    };

    // Initialize Google Sign-In button
    useEffect(() => {
        const tryInit = () => {
            const win = window as unknown as Window;

            if (!CLIENT_ID) {
                console.warn("VITE_GOOGLE_CLIENT_ID not provided");
                setGoogleReady(false);
                return;
            }

            if (win.google?.accounts?.id?.initialize) {
                try {
                    win.google.accounts.id.initialize({
                        client_id: CLIENT_ID,
                        callback: handleGoogleCredential,
                    });

                    if (googleRef.current && win.google.accounts.id.renderButton) {
                        googleRef.current.innerHTML = "";
                        win.google.accounts.id.renderButton(googleRef.current, {
                            theme: "outline",
                            size: "large",
                            type: "standard",
                        });
                        setGoogleReady(true);
                    }
                } catch (errInit) {
                    console.warn("Google init error:", errInit);
                    setGoogleReady(false);
                }
            }
        };

        tryInit();
        const t1 = window.setTimeout(tryInit, 700);
        const t2 = window.setTimeout(tryInit, 1600);

        return () => {
            window.clearTimeout(t1);
            window.clearTimeout(t2);
            try {
                const w = window as unknown as Window;
                w.google?.accounts?.id?.cancel?.();
            } catch (cancelErr) {
                console.warn("Error cancelling Google prompt:", cancelErr);
            }
        };
    }, [CLIENT_ID]);

    // Handle manual login (email/username + password)
    const handleManual = async (ev: React.FormEvent) => {
        ev.preventDefault();
        setError(null);
        setLoading(true);

        console.log("🔐 Manual login attempt with:", identifier);

        try {
            await loginWithPassword(identifier, password);

            console.log("✅ Login successful, fetching user data...");

            await fetchAndStoreCurrentUser();

            console.log("🔄 Redirecting to home...");
            window.location.replace("/");
        } catch (err) {
            console.error("❌ Manual login error:", err);
            const msg = extractMessageFromError(
                err,
                "فشل تسجيل الدخول. تحقق من البريد/اسم المستخدم وكلمة السر."
            );
            setError(msg);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="lpLogin" dir="rtl">
            <div className="lpLogin__card">
                {/* Left: branding / illustration */}
                <div className="lpLogin__brand">
                    <div className="lpLogin__brandHead">
                        <div className="lpSignup__logo" aria-hidden="true">
                            <img
                                src={platformLogo}
                                alt="Elfezya Bgd"
                                className="lpSignup__logoImg"
                                loading="lazy"
                                draggable={false}
                            />
                        </div>

                        <div>
                            <h3 className="lpLogin__brandTitle">Elfezya Bgd</h3>
                            <p className="lpLogin__brandSub">
                                منصة تعليمية تفاعلية — تعلّم بسرعة وجاهز للاختبار
                            </p>
                        </div>
                    </div>

                    <div className="lpLogin__brandCopy">
                        <h4>تسجيل أسرع ولا يُنسى</h4>
                        <p>
                            سجّل دخولك باستخدام حساب جوجل بضغطة واحدة أو استخدم البريد أو اسم
                            المستخدم. سيتم حفظ معلوماتك بأمان ويمكنك البدء فورًا.
                        </p>
                    </div>

                    <div className="lpLogin__illus">
                        {/* ✅ نفس الـSVG بتاعك زي ما هو */}
                        <svg
                            viewBox="0 0 700 300"
                            className="w-full max-w-[700px]"
                            preserveAspectRatio="xMidYMid meet"
                            xmlns="http://www.w3.org/2000/svg"
                            role="img"
                            aria-hidden="true"
                        >
                            <defs>
                                <linearGradient id="g1" x1="0" x2="1">
                                    <stop offset="0" stopColor="#4e91fd" stopOpacity="0.18" />
                                    <stop offset="1" stopColor="#7c3aed" stopOpacity="0.08" />
                                </linearGradient>
                                <linearGradient id="cardGrad" x1="0" x2="1">
                                    <stop offset="0" stopColor="#0f172a" stopOpacity="0.9" />
                                    <stop offset="1" stopColor="#0b1220" stopOpacity="0.75" />
                                </linearGradient>
                                <filter id="softShadow" x="-20%" y="-20%" width="140%" height="140%">
                                    <feDropShadow
                                        dx="0"
                                        dy="8"
                                        stdDeviation="18"
                                        floodColor="#000"
                                        floodOpacity="0.25"
                                    />
                                </filter>
                                <pattern id="dots" x="0" y="0" width="12" height="12" patternUnits="userSpaceOnUse">
                                    <circle cx="1.5" cy="1.5" r="1" fill="rgba(255,255,255,0.03)" />
                                </pattern>
                            </defs>

                            <g transform="translate(50,10)">
                                <rect x="8" y="8" width="600" height="220" rx="14" fill="url(#g1)" />
                                <g transform="translate(24,20)" filter="url(#softShadow)">
                                    <rect x="0" y="0" width="360" height="160" rx="12" fill="url(#cardGrad)" />
                                    <rect x="0" y="0" width="360" height="160" rx="12" fill="url(#dots)" />

                                    <g transform="translate(22,28)">
                                        <circle cx="36" cy="36" r="36" fill="#ffffff" fillOpacity="0.95" />
                                        <circle cx="36" cy="36" r="34" fill="none" stroke="#4e91fd" strokeWidth="2" />
                                        <polygon points="44,36 28,46 28,26" fill="#0b1220" opacity="0.95" />
                                    </g>

                                    <g transform="translate(100,28)">
                                        <rect x="0" y="8" width="220" height="14" rx="3" fill="#ffffff" fillOpacity="0.07" />
                                        <rect x="0" y="34" width="160" height="12" rx="3" fill="#ffffff" fillOpacity="0.04" />
                                        <rect x="0" y="54" width="120" height="10" rx="3" fill="#ffffff" fillOpacity="0.03" />
                                    </g>

                                    <rect x="22" y="128" width="316" height="8" rx="4" fill="#ffffff" fillOpacity="0.06" />
                                    <rect x="22" y="128" width="120" height="8" rx="4" fill="#4e91fd" />
                                </g>

                                <g transform="translate(400,36)">
                                    <rect x="0" y="0" width="140" height="96" rx="8" fill="#ffffff" fillOpacity="0.06" />
                                    <rect x="8" y="8" width="124" height="20" rx="4" fill="#ffffff" fillOpacity="0.08" />
                                    <rect x="8" y="36" width="90" height="12" rx="3" fill="#ffffff" fillOpacity="0.04" />
                                    <rect x="8" y="56" width="110" height="10" rx="3" fill="#ffffff" fillOpacity="0.03" />

                                    <g transform="translate(0,110)">
                                        <rect x="0" y="0" width="110" height="64" rx="8" fill="#ffffff" fillOpacity="0.05" />
                                        <rect x="12" y="10" width="86" height="12" rx="3" fill="#ffffff" fillOpacity="0.06" />
                                        <rect x="12" y="30" width="60" height="10" rx="3" fill="#ffffff" fillOpacity="0.04" />
                                    </g>
                                </g>

                                <g transform="translate(28,12)">
                                    <text
                                        x="0"
                                        y="-2"
                                        fontFamily="sans-serif"
                                        fontSize="12"
                                        fill="#ffffff"
                                        fillOpacity="0.85"
                                    >
                                        تعلم الآن
                                    </text>
                                </g>
                            </g>
                        </svg>
                    </div>
                </div>

                {/* Right: login form */}
                <div className="lpLogin__panel">
                    <h2 className="lpLogin__title">مرحبًا بعودتك</h2>
                    <p className="lpLogin__subtitle">
                        سجل دخولك لتتمكن من مشاهدة الدروس وحل الامتحانات
                    </p>

                    {error && <div className="lpLogin__error">{error}</div>}

                    <form onSubmit={handleManual} className="lpLogin__form">
                        <div className="lpLogin__field">
                            <label className="lpLogin__label">البريد الإلكتروني أو اسم المستخدم</label>
                            <div className="lpLogin__inputWrap">
                                <span className="lpLogin__icon" aria-hidden="true">
                                    <svg
                                        xmlns="http://www.w3.org/2000/svg"
                                        className="w-4 h-4"
                                        fill="none"
                                        viewBox="0 0 24 24"
                                        stroke="currentColor"
                                    >
                                        <path
                                            strokeWidth="1.5"
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                                        />
                                    </svg>
                                </span>

                                <input
                                    type="text"
                                    value={identifier}
                                    onChange={(e) => setIdentifier(e.target.value)}
                                    required
                                    className="lpLogin__input"
                                    placeholder="example@mail.com او username"
                                    aria-label="email or username"
                                    autoComplete="username"
                                />
                            </div>
                        </div>

                        <div className="lpLogin__field">
                            <label className="lpLogin__label">كلمة المرور</label>
                            <div className="lpLogin__inputWrap">
                                <span className="lpLogin__icon" aria-hidden="true">
                                    <svg
                                        xmlns="http://www.w3.org/2000/svg"
                                        className="w-4 h-4"
                                        fill="none"
                                        viewBox="0 0 24 24"
                                        stroke="currentColor"
                                    >
                                        <path
                                            strokeWidth="1.5"
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                                        />
                                    </svg>
                                </span>

                                <input
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    required
                                    className="lpLogin__input"
                                    placeholder="••••••••"
                                    aria-label="password"
                                    autoComplete="current-password"
                                />
                            </div>
                        </div>

                        <div className="lpLogin__actions">
                            <button type="submit" disabled={loading} className="lpLogin__submit">
                                {loading ? "جاري..." : "تسجيل الدخول"}
                            </button>

                            <button
                                type="button"
                                onClick={() => navigate("/reset-password")}
                                className="lpLogin__linkBtn"
                            >
                                نسيت كلمة المرور؟
                            </button>
                        </div>
                    </form>

                    <div className="lpLogin__divider" aria-hidden="true">
                        <span />
                        <b>أو</b>
                        <span />
                    </div>

                    <div className="lpLogin__oauth">
                        <div ref={googleRef} className="lpLogin__google" />

                        {!googleReady && CLIENT_ID && (
                            <button
                                type="button"
                                onClick={() =>
                                    setError("زر جوجل غير متاح حاليًا — تحقق من إعداد Google Client ID")
                                }
                                className="lpLogin__ghost"
                            >
                                سجّل عبر جوجل
                            </button>
                        )}

                        <p className="lpLogin__hint">
                            يمكنك التسجيل باستخدام البريد/اسم المستخدم وكلمة المرور أو عبر جوجل
                        </p>
                    </div>

                    <div className="lpLogin__footer">
                        ليس لديك حساب؟{" "}
                        <button type="button" onClick={() => navigate("/signup")} className="lpLogin__link">
                            إنشاء حساب جديد
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default LoginPage;