// src/lib/api.ts
import axios from "axios";
import type {
  AxiosInstance,
  AxiosRequestConfig,
  AxiosError,
  InternalAxiosRequestConfig,
} from "axios";
import { getRefreshToken, setTokens, getAccessToken } from "./auth";

/* ==== بيئة وتهيئة base URL (دعم proxy في dev أو URL خارجي في production) ==== */
type LocalImportMetaEnv = { VITE_API_URL?: string };
const RAW_API_URL =
  ((import.meta as unknown) as { env?: LocalImportMetaEnv }).env?.VITE_API_URL ?? "";

// إذا RAW_API_URL فاضي -> نستخدم المسار النسبي "/api" (تناسب proxy في Vite).
// إذا غير فاضي -> نستخدم الـ URL المزوَّد بعد إزالة trailing slash.
const base = RAW_API_URL.trim() === "" ? "" : RAW_API_URL.trim().replace(/\/$/, "");
const baseURL = base === "" ? "/api" : `${base}/api`;

/* ==== Axios instance ==== */
const api: AxiosInstance = axios.create({
  baseURL,
  headers: {
    "Content-Type": "application/json",
    Accept: "application/json",
  },
  timeout: 15000,
  withCredentials: true, // مهم: لإرسال الكوكيز (session auth / CSRF cookie) عند الحاجة
});

/* ================= Helper: read cookie ================== */
function getCookie(name: string): string | null {
  try {
    if (typeof document === "undefined" || !document.cookie) return null;
    const match = document.cookie.match(new RegExp('(^|; )' + name + '=([^;]*)'));
    return match ? decodeURIComponent(match[2]) : null;
  } catch {
    return null;
  }
}

/* ================= Request interceptor ================== */
api.interceptors.request.use(
  (cfg: InternalAxiosRequestConfig): InternalAxiosRequestConfig => {
    try {
      // ensure headers object exists
      if (!cfg.headers || typeof cfg.headers !== "object") {
        cfg.headers = {} as InternalAxiosRequestConfig["headers"];
      }

      // Add Authorization header when access token present
      const token = getAccessToken();
      if (token) {
        (cfg.headers as Record<string, unknown>)["Authorization"] = `Bearer ${token}`;
      }

      // Add CSRF header automatically for unsafe HTTP methods
      const method = (cfg.method ?? "get").toString().toLowerCase();
      if (["post", "put", "patch", "delete"].includes(method)) {
        // Try common cookie names for CSRF: Django uses "csrftoken"
        const csrf = getCookie("csrftoken") || getCookie("csrf_token") || getCookie("CSRF-TOKEN");
        if (csrf) {
          (cfg.headers as Record<string, unknown>)["X-CSRFToken"] = csrf;
        }
      }
    } catch {
      // don't fail the request if anything goes wrong here
    }
    return cfg;
  },
  (error) => Promise.reject(error)
);

/* ================= Response interceptor: refresh flow ================== */
type RetryRequestConfig = InternalAxiosRequestConfig & { _retry?: boolean };

let isRefreshing = false;
let failedQueue: { resolve: (token: string | null) => void; reject: (reason?: unknown) => void }[] = [];

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

    // نحاول فقط عند 401 ومرة واحدة لكل طلب أصلي
    if (err.response?.status === 401 && !originalConfig._retry) {
      originalConfig._retry = true;

      if (isRefreshing) {
        // إذا أحد يحدّث الآن، نضع الطلب في قائمة الانتظار
        return new Promise<string | null>((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then((token) => {
          // عند الحصول على توكن جديد، نعدّل الهيدر ونعيد الطلب عبر الـ instance
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
        // بناء endpoint للتجديد بطريقة آمنة (لا تكسّر http://)
        const refreshEndpoint = base === ""
          ? "/api/auth/token/refresh/"
          : `${base}/api/auth/token/refresh/`;

        // نستخدم axios العام لإجراء طلب التجديد (لتجنّب الاشتباك مع نفس الـ instance interceptors)
        // لكن نضمن withCredentials:true إن كانت الجلسة تستخدم كوكيز
        const refreshRes = await axios.post(refreshEndpoint, { refresh }, { withCredentials: true });

        const newAccess = refreshRes?.data && refreshRes.data.access ? String(refreshRes.data.access) : null;
        if (!newAccess) {
          throw new Error("No access token in refresh response");
        }

        const newRefresh = refreshRes.data?.refresh ? String(refreshRes.data.refresh) : refresh;
        setTokens(newAccess, newRefresh);

        processQueue(null, newAccess);
        isRefreshing = false;

        // حط الهيدر للتجربة الفورية وأعد الطلب عبر الـ instance (سيستخدم request interceptor إن لزم)
        if (originalConfig.headers) {
          originalConfig.headers = {
            ...(originalConfig.headers as Record<string, unknown>),
            Authorization: `Bearer ${newAccess}`,
          } as InternalAxiosRequestConfig["headers"];
        }

        return api.request(originalConfig as AxiosRequestConfig);
      } catch (refreshErr) {
        processQueue(refreshErr, null);
        isRefreshing = false;
        setTokens(null, null);
        return Promise.reject(refreshErr);
      }
    }

    return Promise.reject(err);
  }
);

export default api;
