import React, { createContext, useContext, useEffect, useMemo, useState } from "react";

type Theme = "dark" | "light";

type ThemeCtx = {
    theme: Theme;
    toggle: () => void;
    setTheme: (t: Theme) => void;
};

const ThemeContext = createContext<ThemeCtx | null>(null);

const STORAGE_KEY = "theme";

function getPreferredTheme(): Theme {
    // localStorage first
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === "light" || saved === "dark") return saved;

    // system preference
    const prefersLight = window.matchMedia?.("(prefers-color-scheme: light)")?.matches;
    return prefersLight ? "light" : "dark";
}

function applyTheme(theme: Theme) {
    document.documentElement.setAttribute("data-theme", theme);
}

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [theme, setThemeState] = useState<Theme>("dark");

    useEffect(() => {
        const initial = getPreferredTheme();
        setThemeState(initial);
        applyTheme(initial);
    }, []);

    const setTheme = (t: Theme) => {
        setThemeState(t);
        applyTheme(t);
        localStorage.setItem(STORAGE_KEY, t);
    };

    const toggle = () => setTheme(theme === "dark" ? "light" : "dark");

    // (اختياري) لو المستخدم ما اختارش حاجة، وخدنا من النظام، نقدر نسمع تغيّر النظام
    useEffect(() => {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) return;

        const mq = window.matchMedia?.("(prefers-color-scheme: light)");
        if (!mq) return;

        const onChange = () => {
            const next: Theme = mq.matches ? "light" : "dark";
            setThemeState(next);
            applyTheme(next);
        };

        mq.addEventListener?.("change", onChange);
        return () => mq.removeEventListener?.("change", onChange);
    }, []);

    const value = useMemo(() => ({ theme, toggle, setTheme }), [theme]);

    return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export function useTheme() {
    const ctx = useContext(ThemeContext);
    if (!ctx) throw new Error("useTheme must be used inside ThemeProvider");
    return ctx;
}