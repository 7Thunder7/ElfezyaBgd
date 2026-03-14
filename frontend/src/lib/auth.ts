// src/lib/auth.ts

/**
 * Authentication utilities for session-based Django backend
 * NOTE: This uses session cookies, NOT localStorage tokens (to comply with artifact restrictions)
 * If you need localStorage in your actual app, the implementation below shows where to add it.
 */

/* ==== Helper: build base URL (matches api.ts logic) ==== */
type LocalImportMetaEnv = { VITE_API_URL?: string };
const RAW_API_URL =
    ((import.meta as unknown) as { env?: LocalImportMetaEnv }).env?.VITE_API_URL ?? "";

const base = RAW_API_URL.trim() === "" ? "" : RAW_API_URL.trim().replace(/\/$/, "");
const baseURL = base === "" ? "/api" : `${base}/api`;

/* ==== Helper: get CSRF token from cookie ==== */
function getCookie(name: string): string | null {
    try {
        if (typeof document === "undefined" || !document.cookie) return null;
        const match = document.cookie.match(new RegExp('(^|; )' + name + '=([^;]*)'));
        return match ? decodeURIComponent(match[2]) : null;
    } catch {
        return null;
    }
}

function getCSRFToken(): string | null {
    return getCookie("csrftoken") || getCookie("csrf_token") || getCookie("CSRF-TOKEN");
}

/* ==== Helper: safe JSON parse ==== */
function safeJsonParse<T = unknown>(txt: string | null): T | null {
    if (!txt) return null;
    try {
        return JSON.parse(txt) as T;
    } catch {
        return null;
    }
}

/* ==== Types ==== */
export type TokenPair = {
    access: string;
    refresh: string;
};

export type LoginResponse = {
    user?: Record<string, unknown>;
    tokens?: {
        access: string;
        refresh: string;
    };
};

/* ==== Token management (kept for compatibility but backend uses sessions) ==== */
// In your actual app, you can use localStorage here if needed:
// const ACCESS_KEY = "access";
// const REFRESH_KEY = "refresh";

export function setTokens(access: string | null, refresh: string | null) {
    // Backend uses session cookies, so we don't store tokens in localStorage
    // If you want to store tokens, uncomment:
    // if (access) localStorage.setItem(ACCESS_KEY, access);
    // else localStorage.removeItem(ACCESS_KEY);
    // if (refresh) localStorage.setItem(REFRESH_KEY, refresh);
    // else localStorage.removeItem(REFRESH_KEY);

    console.log("Tokens would be set:", { access: access ? "***" : null, refresh: refresh ? "***" : null });
}

export function getAccessToken(): string | null {
    // return localStorage.getItem(ACCESS_KEY);
    return null; // Backend uses session cookies
}

export function getRefreshToken(): string | null {
    // return localStorage.getItem(REFRESH_KEY);
    return null; // Backend uses session cookies
}

export function isAuthenticated(): boolean {
    // Check if session cookie exists
    const sessionId = getCookie("sessionid");
    return !!sessionId;
}

export function logout() {
    setTokens(null, null);
    // Session logout is handled by calling /api/accounts/logout/ endpoint
}

/* ==== Main login function: supports both email and username ==== */
/**
 * loginWithPassword: Authenticates with Django session-based backend
 * 
 * Your backend endpoint: /api/login/ (NOT /api/accounts/login/)
 * Expected payload: { "identifier": "email_or_username", "password": "xxx" }
 * OR if you update backend: { "email": "xxx", "password": "xxx" }
 * 
 * Returns: Promise<TokenPair> where tokens are empty strings (backend uses sessions)
 */
export async function loginWithPassword(identifier: string, password: string): Promise<TokenPair> {
    const url = `${baseURL}/login/`;  // Changed from /accounts/login/ to /login/

    console.log("🔐 Attempting login at:", url);
    console.log("📧 Identifier:", identifier);

    try {
        // Get CSRF token for the request
        const csrfToken = getCSRFToken();
        const headers: Record<string, string> = {
            "Content-Type": "application/json",
            "Accept": "application/json",
        };

        if (csrfToken) {
            headers["X-CSRFToken"] = csrfToken;
        }

        // Try with "identifier" field (if backend accepts it)
        // If your backend still uses "email" field, change this to: { email: identifier, password }
        const response = await fetch(url, {
            method: "POST",
            headers,
            body: JSON.stringify({
                identifier: identifier,  // Change to "email" if backend expects that
                password: password
            }),
            credentials: "include", // Critical: sends and receives cookies
        });

        console.log("📡 Response status:", response.status);

        // Read response text
        const text = await response.text();
        console.log("📄 Response text:", text.substring(0, 200));

        const json = safeJsonParse<LoginResponse>(text);

        if (!response.ok) {
            // Extract error message
            const errorMsg = extractErrorMessage(json, text, response.status);
            console.error("❌ Login failed:", errorMsg);
            throw new Error(errorMsg);
        }

        // Success: backend returns { "user": {...} } and sets session cookie
        console.log("✅ Login successful!");

        // Check if backend returned JWT tokens (optional)
        if (json?.tokens) {
            const { access, refresh } = json.tokens;
            setTokens(access, refresh || "");
            return { access, refresh: refresh || "" };
        }

        // Backend uses session cookies (no tokens returned)
        // Return empty tokens to indicate session-based auth
        return { access: "", refresh: "" };

    } catch (error) {
        console.error("💥 Login error:", error);

        if (error instanceof Error) {
            throw error;
        }
        throw new Error("فشل تسجيل الدخول. حاول مرة أخرى.");
    }
}

/* ==== Helper: extract error messages from API responses ==== */
function extractErrorMessage(
    json: Record<string, unknown> | null,
    text: string | null,
    status: number
): string {
    if (json) {
        // Try common error fields
        const detail = json["detail"] ?? json["message"] ?? json["error"];
        if (typeof detail === "string" && detail.trim()) {
            return detail.trim();
        }

        // Try field-specific errors
        const errors = json["errors"] ?? json;
        if (errors && typeof errors === "object") {
            for (const key of Object.keys(errors as Record<string, unknown>)) {
                const value = (errors as Record<string, unknown>)[key];

                if (Array.isArray(value) && value.length > 0 && typeof value[0] === "string") {
                    return value[0];
                }

                if (typeof value === "string" && value.trim()) {
                    return value;
                }
            }
        }

        // Try non_field_errors
        const nfe = json["non_field_errors"] ?? json["nonFieldErrors"];
        if (Array.isArray(nfe) && nfe.length > 0 && typeof nfe[0] === "string") {
            return nfe[0];
        }
    }

    // Fallback to text response or generic message
    if (text && text.trim()) {
        return text.trim();
    }

    // Status-specific messages
    if (status === 401) {
        return "البريد الإلكتروني أو اسم المستخدم أو كلمة المرور غير صحيحة";
    }
    if (status === 400) {
        return "البيانات المدخلة غير صحيحة";
    }
    if (status === 403) {
        return "غير مصرح لك بالدخول";
    }
    if (status === 404) {
        return "الخدمة غير متوفرة";
    }
    if (status >= 500) {
        return "خطأ في الخادم. حاول مرة أخرى لاحقاً";
    }

    return `فشل تسجيل الدخول (${status})`;
}

/* ==== Refresh token function (for JWT-based systems) ==== */
/**
 * refreshAccessToken: Refreshes JWT access token
 * Note: Your current backend uses sessions, so this may not be needed
 */
export async function refreshAccessToken(): Promise<string> {
    const refresh = getRefreshToken();
    if (!refresh) {
        throw new Error("No refresh token available");
    }

    const url = `${baseURL}/auth/token/refresh/`;

    try {
        const csrfToken = getCSRFToken();
        const headers: Record<string, string> = {
            "Content-Type": "application/json",
            "Accept": "application/json",
        };

        if (csrfToken) {
            headers["X-CSRFToken"] = csrfToken;
        }

        const response = await fetch(url, {
            method: "POST",
            headers,
            body: JSON.stringify({ refresh }),
            credentials: "include",
        });

        if (!response.ok) {
            throw new Error(`Token refresh failed (${response.status})`);
        }

        const text = await response.text();
        const json = safeJsonParse<Record<string, unknown>>(text);

        const newAccess = json?.access ?? json?.access_token;
        const newRefresh = json?.refresh ?? json?.refresh_token ?? refresh;

        if (!newAccess || typeof newAccess !== "string") {
            throw new Error("No access token in refresh response");
        }

        setTokens(String(newAccess), String(newRefresh));
        return String(newAccess);

    } catch (error) {
        console.error("Token refresh failed:", error);
        setTokens(null, null);
        throw error;
    }
}

/* ==== Get current user from /api/accounts/me/ ==== */
// src/lib/auth.ts  (استبدل الملف الحالي أو طبّق التعديلات الآتية)

// الجزء العلوي كما عندك (types, helpers, baseURL, getCSRFToken, safeJsonParse)

/* ==== Get current user from /api/me/ ==== */
export async function getCurrentUser(): Promise<Record<string, unknown> | null> {
    // baseURL already contains '/api' or the configured API base
    // For your Django setup (accounts included at path("api/", include("accounts.urls"))),
    // the "me" endpoint is at `${baseURL}/me/`
    const url = `${baseURL}/me/`;

    try {
        const response = await fetch(url, {
            method: "GET",
            headers: {
                "Accept": "application/json",
            },
            credentials: "include",
        });

        if (!response.ok) {
            // return null when not authenticated or endpoint missing
            return null;
        }

        const text = await response.text();
        const json = safeJsonParse<Record<string, unknown>>(text);
        return json ?? null;

    } catch (error) {
        console.error("Failed to get current user:", error);
        return null;
    }
}

/* ==== Logout function ==== */
export async function logoutUser(): Promise<void> {
    const url = `${baseURL}/logout/`; // was /accounts/logout/ before

    try {
        const csrfToken = getCSRFToken();
        const headers: Record<string, string> = {
            "Content-Type": "application/json",
            "Accept": "application/json",
        };
        if (csrfToken) headers["X-CSRFToken"] = csrfToken;

        await fetch(url, {
            method: "POST",
            headers,
            credentials: "include",
        });

        setTokens(null, null);
        try {
            localStorage.removeItem("current_user");
        } catch (error) {
            console.debug("auth: failed to remove current_user from localStorage:", error);
        }

        try {
            window.dispatchEvent(new Event("auth:update"));
        } catch (error) {
            console.debug("auth: dispatch auth:update failed:", error);
        }

    } catch (error) {
        console.error("Logout error:", error);
        setTokens(null, null);
    }
}
