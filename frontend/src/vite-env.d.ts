/// <reference types="vite/client" />
// src/env.d.ts

interface ImportMetaEnv {
    readonly VITE_API_URL?: string;
    readonly VITE_GOOGLE_CLIENT_ID?: string;
}

interface ImportMeta {
    readonly env: ImportMetaEnv;
}

/**
 * Minimal, safe typings for Google Identity we actually use.
 * نعرّف فقط الدوال اللي مشروعنا يحتاجها حالياً: initialize و renderButton
 * يمكن توسيع هذه الأنواع لاحقاً لو احتجنا oauth2 أو وظائف إضافية.
 */

interface GoogleIdentityButtonOptions {
    theme?: string;
    size?: string;
    type?: string;
}

interface GoogleIdInitializeOptions {
    client_id: string;
    callback: (resp: { credential?: string; clientId?: string }) => void;
}

interface GoogleAccountsId {
    initialize: (opts: GoogleIdInitializeOptions) => void;
    renderButton: (container: HTMLElement, options?: GoogleIdentityButtonOptions) => void;
}

/**
 * If you later need other Google APIs (oauth2, token client, etc.)
 * you can extend this interface rather than using `any`.
 */
interface GoogleAccounts {
    id: GoogleAccountsId;
    // any other subsystems from the google object we don't need now:
    // mark as unknown so we don't reintroduce `any`.
    oauth2?: unknown;
    [key: string]: unknown;
}

/* Avoid using `any` — use the strongly typed GoogleAccounts instead */
declare global {
    interface Window {
        google?: GoogleAccounts;
    }
}
