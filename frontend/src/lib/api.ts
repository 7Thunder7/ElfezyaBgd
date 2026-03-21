// src/lib/api.ts
import axios from "axios";
import type {
  AxiosInstance,
  AxiosRequestConfig,
  AxiosError,
  InternalAxiosRequestConfig,
} from "axios";
import { getRefreshToken, setTokens, getAccessToken } from "./auth";

/* ==== Environment / base URL ==== */
type LocalImportMetaEnv = { VITE_API_URL?: string };

const RAW_API_URL =
  ((import.meta as unknown) as { env?: LocalImportMetaEnv }).env?.VITE_API_URL ?? "";

// لو مفيش VITE_API_URL -> نشتغل على /api (مناسب للـ proxy في dev)
// لو فيه -> نشيل trailing slash ونضيف /api
const base = RAW_API_URL.trim() === "" ? "" : RAW_API_URL.trim().replace(/\/$/, "");
const baseURL = base === "" ? "/api" : `${base}/api`;
const csrfEndpoint = `${baseURL}/auth/csrf/`;

/* ==== Axios instance ==== */
const api: AxiosInstance = axios.create({
  baseURL,
  headers: {
    "Content-Type": "application/json",
    Accept: "application/json",
  },
  timeout: 15000,
  withCredentials: true,
});

/* ================= Cookie helper ================== */
function getCookie(name: string): string | null {
  try {
    if (typeof document === "undefined" || !document.cookie) return null;
    const escaped = name.replace(/[-[\]/{}()*+?.\\^$|]/g, "\\$&");
    const match = document.cookie.match(new RegExp(`(^|; )${escaped}=([^;]*)`));
    return match ? decodeURIComponent(match[2]) : null;
  } catch {
    return null;
  }
}

/* ================= CSRF handling ==================
   مهم:
   في حالة Vercel frontend + Render backend (cross-origin)،
   document.cookie على الفرونت مش هيقدر يقرأ cookie خاصة بالباك.
   علشان كده لازم endpoint /api/auth/csrf/ يرجّع token في الـ JSON body.
=================================================== */

let csrfTokenCache: string | null = null;
let csrfInitPromise: Promise<string | null> | null = null;

function extractCsrfTokenFromResponse(data: unknown, headers?: Record<string, unknown>): string | null {
  if (data && typeof data === "object") {
    const obj = data as Record<string, unknown>;
    const token =
      obj.csrfToken ||
      obj.csrf_token ||
      obj.csrf ||
      obj.token;

    if (typeof token === "string" && token.trim()) {
      return token.trim();
    }
  }

  if (headers) {
    const headerToken =
      headers["x-csrftoken"] ||
      headers["x-csrf-token"] ||
      headers["X-CSRFToken"] ||
      headers["X-CSRF-Token"];

    if (typeof headerToken === "string" && headerToken.trim()) {
      return headerToken.trim();
    }
  }

  return null;
}

export async function initCsrf(force = false): Promise<string | null> {
  // 1) لو عندنا token محفوظ
  if (!force && csrfTokenCache) {
    return csrfTokenCache;
  }

  // 2) لو شغال same-origin/dev وموجود في cookies
  const cookieToken =
    getCookie("csrftoken") ||
    getCookie("csrf_token") ||
    getCookie("CSRF-TOKEN");

  if (!force && cookieToken) {
    csrfTokenCache = cookieToken;
    return cookieToken;
  }

  // 3) لو فيه طلب جارٍ بالفعل
  if (!force && csrfInitPromise) {
    return csrfInitPromise;
  }

  // 4) جيب token من backend endpoint
  csrfInitPromise = axios
    .get(csrfEndpoint, {
      withCredentials: true,
      headers: {
        Accept: "application/json",
      },
      timeout: 10000,
    })
    .then((res) => {
      const fromBody = extractCsrfTokenFromResponse(
        res.data,
        res.headers as Record<string, unknown>
      );

      const fromCookie =
        getCookie("csrftoken") ||
        getCookie("csrf_token") ||
        getCookie("CSRF-TOKEN");

      const token = fromBody || fromCookie || null;
      csrfTokenCache = token;
      return token;
    })
    .catch(() => {
      csrfTokenCache = null;
      return null;
    })
    .finally(() => {
      csrfInitPromise = null;
    });

  return csrfInitPromise;
}

export function clearCsrfCache() {
  csrfTokenCache = null;
}

/* ================= Request interceptor ================== */
api.interceptors.request.use(
  async (cfg: InternalAxiosRequestConfig): Promise<InternalAxiosRequestConfig> => {
    try {
      if (!cfg.headers || typeof cfg.headers !== "object") {
        cfg.headers = {} as InternalAxiosRequestConfig["headers"];
      }

      // Authorization
      const accessToken = getAccessToken();
      if (accessToken) {
        (cfg.headers as Record<string, unknown>)["Authorization"] = `Bearer ${accessToken}`;
      }

      // CSRF for unsafe methods
      const method = (cfg.method ?? "get").toString().toLowerCase();
      const isUnsafeMethod = ["post", "put", "patch", "delete"].includes(method);

      if (isUnsafeMethod) {
        const token = await initCsrf();
        if (token) {
          (cfg.headers as Record<string, unknown>)["X-CSRFToken"] = token;
        }
      }
    } catch {
      // ما نوقعش الطلب بسبب interceptor
    }

    return cfg;
  },
  (error) => Promise.reject(error)
);

/* ================= Response interceptor: refresh flow ================== */
type RetryRequestConfig = InternalAxiosRequestConfig & { _retry?: boolean };

let isRefreshing = false;
let failedQueue: {
  resolve: (token: string | null) => void;
  reject: (reason?: unknown) => void;
}[] = [];

const processQueue = (error: unknown, token: string | null = null) => {
  failedQueue.forEach((p) => {
    if (error) p.reject(error);
    else p.resolve(token);
  });
  failedQueue = [];
};

api.interceptors.response.use(
  (res) => res,
  async (error: unknown) => {
    if (!axios.isAxiosError(error)) {
      return Promise.reject(error);
    }

    const err = error as AxiosError & { config?: RetryRequestConfig };
    const originalConfig = err.config;

    if (!originalConfig) {
      return Promise.reject(err);
    }

    if (err.response?.status === 401 && !originalConfig._retry) {
      originalConfig._retry = true;

      if (isRefreshing) {
        return new Promise<string | null>((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then((token) => {
          if (token) {
            originalConfig.headers = {
              ...(originalConfig.headers as Record<string, unknown>),
              Authorization: `Bearer ${token}`,
            } as InternalAxiosRequestConfig["headers"];
          }
          return api.request(originalConfig as AxiosRequestConfig);
        });
      }

      isRefreshing = true;
      const refresh = getRefreshToken();

      if (!refresh) {
        isRefreshing = false;
        return Promise.reject(err);
      }

      try {
        const refreshEndpoint =
          base === ""
            ? "/api/auth/token/refresh/"
            : `${base}/api/auth/token/refresh/`;

        const refreshRes = await axios.post(
          refreshEndpoint,
          { refresh },
          { withCredentials: true }
        );

        const newAccess =
          refreshRes?.data && refreshRes.data.access
            ? String(refreshRes.data.access)
            : null;

        if (!newAccess) {
          throw new Error("No access token in refresh response");
        }

        const newRefresh = refreshRes.data?.refresh
          ? String(refreshRes.data.refresh)
          : refresh;

        setTokens(newAccess, newRefresh);

        processQueue(null, newAccess);
        isRefreshing = false;

        originalConfig.headers = {
          ...(originalConfig.headers as Record<string, unknown>),
          Authorization: `Bearer ${newAccess}`,
        } as InternalAxiosRequestConfig["headers"];

        return api.request(originalConfig as AxiosRequestConfig);
      } catch (refreshErr) {
        processQueue(refreshErr, null);
        isRefreshing = false;
        setTokens(null, null);
        clearCsrfCache();
        return Promise.reject(refreshErr);
      }
    }

    return Promise.reject(err);
  }
);

export default api;