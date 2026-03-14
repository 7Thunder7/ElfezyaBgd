// src/pages/study.tsx
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { isAuthenticated, getCurrentUser } from "../lib/auth";
import "../CSS/Study.css";

/* ---------- Types ---------- */
type Item = {
    id: string;
    title: string;
    img?: string | null;
    description?: string | null;
    slug?: string | null;
};

type Section = {
    id: string;
    title: string;
    items: Item[];
};

/* ---------- Mock data (fallback) ---------- */
const MOCK_SECTIONS: Section[] = [
    {
        id: "core",
        title: " الوحدة الاولي",
        items: [
            { id: "phy1", title: "الميكانيكا 1", img: "/src/imgs/placeholder.png", description: "مقدمة في الحركة و القوانين الأساسية" },
            { id: "phy2", title: "الكهرباء الساكنة", img: "/src/imgs/placeholder.png", description: "شحنة، مجال و فرق جهد" },
            { id: "phy3", title: "الاهتزازات", img: "/src/imgs/placeholder.png", description: "الاهتزازات البسيطة والموجات" },
        ],
    },
];

/* ---------- Helpers ---------- */
function safeArr<T>(v: T[] | null | undefined): T[] {
    return Array.isArray(v) ? v : [];
}
function isRecord(v: unknown): v is Record<string, unknown> {
    return v !== null && typeof v === "object" && !Array.isArray(v);
}
function toString(v: unknown): string | null {
    if (typeof v === "string") return v;
    if (typeof v === "number") return String(v);
    return null;
}
function toItemsArray(v: unknown): unknown[] {
    return Array.isArray(v) ? v : [];
}
function normalizeSections(raw: unknown): Section[] {
    const arr = Array.isArray(raw) ? raw : [];
    return arr.map((s) => {
        const rec = isRecord(s) ? s : {};
        const id = toString(rec.id ?? rec.slug ?? rec.title) ?? Math.random().toString(36).slice(2, 9);
        const title = toString(rec.title ?? rec.name) ?? "بدون عنوان";

        const rawItems = toItemsArray(rec.lessons ?? rec.items ?? rec.children ?? rec.lessons_list ?? []);
        const items: Item[] = rawItems.map((l) => {
            const lr = isRecord(l) ? l : {};
            const itemId = toString(lr.id ?? lr.slug ?? lr._id ?? lr.title) ?? Math.random().toString(36).slice(2, 9);
            const itemTitle = toString(lr.title ?? lr.name) ?? "بدون عنوان";
            const img = toString(lr.thumbnail_url ?? lr.thumbnail ?? lr.img ?? lr.image) ?? null;
            const description = toString(lr.short_description ?? lr.description ?? lr.about) ?? null;
            const slug = toString(lr.slug ?? null) ?? null;

            return { id: itemId, title: itemTitle, img, description, slug };
        });

        return { id, title, items };
    });
}

/* ---------- Auth / API helpers ---------- */
function getStoredToken(): string | null {
    try {
        const t1 = localStorage.getItem("access");
        if (t1) return t1;
        const t2 = localStorage.getItem("token");
        if (t2) return t2;
    } catch {
        // ignore
    }
    return null;
}
function buildAuthHeaders(): Headers {
    const headers = new Headers();
    headers.set("Accept", "application/json");
    const token = getStoredToken();
    if (token) headers.set("Authorization", `Bearer ${token}`);
    return headers;
}
function extractGradeSlugFromUser(u: unknown): string | null {
    if (!isRecord(u)) return null;

    const maybe = u["grade"];
    if (typeof maybe === "string" && maybe.trim()) return maybe.trim();
    if (isRecord(maybe)) {
        const s = toString(maybe.slug ?? maybe.id ?? maybe.name);
        if (s) return s;
    }

    const alt = toString(u["grade_slug"] ?? u["gradeSlug"] ?? u["gradeId"] ?? u["grade_id"]);
    if (alt) return alt;

    const profile = u["profile"];
    if (isRecord(profile)) {
        const p = profile["grade"];
        if (typeof p === "string" && p.trim()) return p.trim();
        if (isRecord(p)) {
            const s = toString(p.slug ?? p.id ?? p.name);
            if (s) return s;
        }
        const palt = toString(profile["grade_slug"] ?? profile["gradeSlug"]);
        if (palt) return palt;
    }

    return null;
}

/* ---------- Component ---------- */
const Study: React.FC = () => {
    const navigate = useNavigate();
    const [isLoggedIn, setIsLoggedIn] = useState<boolean>(false);
    const [checkingAuth, setCheckingAuth] = useState<boolean>(true);
    const [sections, setSections] = useState<Section[] | null>(null);
    const [loading, setLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [openMap, setOpenMap] = useState<Record<string, boolean>>({});

    useEffect(() => {
        let mounted = true;

        (async () => {
            try {
                let user: unknown = null;
                try {
                    user = await getCurrentUser();
                } catch {
                    // ignore
                }

                const hasSession = isAuthenticated();
                if (!mounted) return;

                if (user || hasSession) setIsLoggedIn(true);
                else setIsLoggedIn(false);
            } catch (err) {
                if (mounted) {
                    console.error("Auth check failed:", err);
                    setIsLoggedIn(false);
                }
            } finally {
                if (mounted) setCheckingAuth(false);
            }
        })();

        return () => {
            mounted = false;
        };
    }, []);

    useEffect(() => {
        if (!isLoggedIn || checkingAuth) return;
        if (!sections) return;
        if (Object.keys(openMap).length === 0) {
            const map: Record<string, boolean> = {};
            safeArr(sections).forEach((s) => (map[String(s.id)] = false));
            setOpenMap(map);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [sections, isLoggedIn, checkingAuth]);

    const toggle = (id: string | number) => {
        setOpenMap((prev) => ({ ...prev, [String(id)]: !prev[String(id)] }));
    };

    useEffect(() => {
        let mounted = true;

        (async () => {
            if (!isLoggedIn || checkingAuth) return;
            setLoading(true);
            setError(null);

            const headersWithToken = buildAuthHeaders();
            const fetchOptionsWithToken: RequestInit = {
                method: "GET",
                headers: headersWithToken,
                credentials: "include",
            };
            const fetchOptionsCookieOnly: RequestInit = {
                method: "GET",
                headers: new Headers({ Accept: "application/json" }),
                credentials: "include",
            };

            let userJson: unknown = null;
            try {
                userJson = await getCurrentUser();
            } catch {
                // ignore
            }

            const gradeSlug = extractGradeSlugFromUser(userJson);

            const candidateUrls: string[] = [];
            if (gradeSlug) {
                candidateUrls.push(`/api/curriculum/${encodeURIComponent(gradeSlug)}/`);
                candidateUrls.push(`/api/sections/?grade=${encodeURIComponent(gradeSlug)}`);
                candidateUrls.push(`/api/sections/?grade_slug=${encodeURIComponent(gradeSlug)}`);
                candidateUrls.push(`/api/study/sections/?grade=${encodeURIComponent(gradeSlug)}`);
            }
            candidateUrls.push("/api/sections/");
            candidateUrls.push("/api/curriculum/");
            candidateUrls.push("/api/study/sections/");
            candidateUrls.push("/study/sections/");

            let finalData: unknown = null;

            for (const url of candidateUrls) {
                try {
                    const r = await fetch(url, fetchOptionsWithToken);
                    if (!r.ok) {
                        console.debug("Study: token-request failed", url, r.status);
                        continue;
                    }
                    finalData = await r.json();
                    console.debug("Study: token-request succeeded", url);
                    break;
                } catch (err) {
                    console.debug("Study: token-request error", url, err);
                }
            }

            if (!finalData) {
                for (const url of candidateUrls) {
                    try {
                        const r = await fetch(url, fetchOptionsCookieOnly);
                        if (!r.ok) {
                            console.debug("Study: cookie-request failed", url, r.status);
                            continue;
                        }
                        finalData = await r.json();
                        console.debug("Study: cookie-request succeeded", url);
                        break;
                    } catch (err) {
                        console.debug("Study: cookie-request error", url, err);
                    }
                }
            }

            try {
                const normalized = normalizeSections(finalData ?? []);
                if (!mounted) return;

                if (normalized.length === 0) setSections(MOCK_SECTIONS);
                else setSections(normalized);
            } catch (err) {
                if (mounted) {
                    console.error("Error normalizing curriculum data:", err);
                    setError("خطأ في معالجة بيانات المنهج");
                }
            } finally {
                if (mounted) setLoading(false);
            }
        })();

        return () => {
            mounted = false;
        };
    }, [isLoggedIn, checkingAuth]);

    /* ---------- UI ---------- */
    if (checkingAuth) {
        return (
            <div className="studyPage">
                <div className="studyShell">
                    <div className="studyStateCard">
                        <div className="studySpinner" aria-hidden />
                        <div className="studyStateTitle">جاري التحقق من الجلسة...</div>
                        <div className="studyStateSub">لحظة واحدة بس</div>
                    </div>
                </div>
            </div>
        );
    }

    if (!isLoggedIn) {
        return (
            <div className="studyPage">
                <div className="studyShell">
                    <div className="studyStateCard">
                        <div className="studyIconLock" aria-hidden>
                            <svg viewBox="0 0 24 24" fill="none">
                                <path
                                    d="M7 11V8a5 5 0 0 1 10 0v3M6 11h12a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2Z"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                />
                                <path d="M12 16v2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                            </svg>
                        </div>

                        <h2 className="studyStateTitle">يجب تسجيل الدخول</h2>
                        <p className="studyStateSub">لازم تكون مسجّل دخول عشان تشوف محتوى الدراسة.</p>

                        <div className="studyActions">
                            <button className="studyBtn studyBtnPrimary" onClick={() => navigate("/login")}>
                                تسجيل الدخول
                            </button>
                            <button className="studyBtn studyBtnGhost" onClick={() => navigate("/")}>
                                العودة للرئيسية
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    if (loading) {
        return (
            <div className="studyPage">
                <div className="studyShell">
                    <div className="studyStateCard">
                        <div className="studySpinner" aria-hidden />
                        <div className="studyStateTitle">جاري التحميل...</div>
                        <div className="studyStateSub">بنجهّز المحتوى حسب صفّك الدراسي</div>
                    </div>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="studyPage">
                <div className="studyShell">
                    <div className="studyStateCard">
                        <h2 className="studyStateTitle">حدث خطأ</h2>
                        <p className="studyStateSub">{error}</p>
                        <button className="studyBtn studyBtnPrimary" onClick={() => window.location.reload()}>
                            إعادة المحاولة
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div dir="rtl" className="studyPage">
             <div className="lpFunBg" aria-hidden="true">
                <span className="lpFunShape s1" />
                <span className="lpFunShape s2" />
                <span className="lpFunShape s3" />
                <span className="lpFunShape s4" />
                <span className="lpFunShape s5" />
                <span className="lpFunShape s6" />
                <span className="lpFunShape s7" />
                <span className="lpFunShape s8" />
            </div>

            <div className="lpFunGrid" aria-hidden="true" />
            <div className="lpFunVignette" aria-hidden="true" />

            <div className="lpLearnShell lpLearnStack"></div>
            <div className="studyShell">
                <header className="studyHeader">
                    <h1 className="studyTitle">مكتبة الدراسة</h1>
                    <p className="studySubtitle">اختار الوحدة والدرس اللي حابب تذاكرهم</p>
                </header>

                <div
                    role="button"
                    tabIndex={0}
                    onClick={() => navigate("/review")}
                    onKeyDown={(e) => e.key === "Enter" && navigate("/review")}
                    className="studyReviewCard"
                    aria-label="اذهب إلى صفحة المراجعة"
                >
                    <div className="studyReviewInfo">
                        <h3 className="studyReviewTitle">قسم المراجعة</h3>
                        <p className="studyReviewSub">راجع أهم النقاط في الدروس السابقة — اضغط للذهاب إلى صفحة المراجعة.</p>
                    </div>

                    <div className="studyReviewGo">
                        <span>اذهب</span>
                        <svg viewBox="0 0 24 24" fill="none" aria-hidden>
                            <path d="M9 5l7 7-7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                    </div>
                </div>

                <div className="studySections">
                    {safeArr(sections).map((sec, idx) => {
                        const isOpen = !!openMap[String(sec.id)];
                        return (
                            <section key={sec.id} className="studySection">
                                <button
                                    onClick={() => toggle(sec.id)}
                                    aria-expanded={isOpen}
                                    aria-controls={`panel-${sec.id}`}
                                    className="studySectionBtn"
                                >
                                    <div className="studySectionLeft">
                                        <div className="studyBadge" aria-hidden>
                                            <span>{idx + 1}</span>
                                        </div>

                                        <div className="studySectionMeta">
                                            <h3 className="studySectionTitle">{sec.title}</h3>
                                            <p className="studySectionCount">{safeArr(sec.items).length} عنصر</p>
                                        </div>
                                    </div>

                                    <div className={`studyChevron ${isOpen ? "isOpen" : ""}`} aria-hidden>
                                        <svg viewBox="0 0 24 24" fill="none">
                                            <path d="M9 5l7 7-7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                        </svg>
                                    </div>
                                </button>

                                <div
                                    id={`panel-${sec.id}`}
                                    className={`studyPanel ${isOpen ? "isOpen" : ""}`}
                                >
                                    <div className="studyGrid">
                                        {safeArr(sec.items).map((it) => {
                                            const slugOrId = it.slug ?? it.id;
                                            return (
                                                <article key={it.id} className="studyItem" role="article">
                                                    <div className="studyThumb">
                                                        <img src={it.img ?? "/src/imgs/placeholder.png"} alt={it.title} loading="lazy" />
                                                    </div>

                                                    <div className="studyItemBody">
                                                        <h4 className="studyItemTitle">{it.title}</h4>
                                                        <p className="studyItemDesc line-clamp-2">
                                                            {it.description ?? "وصف مختصر للمادة أو الدرس إن احتجت تضيفه لاحقاً"}
                                                        </p>

                                                        <div className="studyItemActions">
                                                            <button
                                                                className="studyBtn studyBtnPrimary studyBtnSm"
                                                                onClick={() =>
                                                                    navigate(`/learning/${slugOrId}`, {
                                                                        state: { playFirst: true, lessonId: it.id },
                                                                    })
                                                                }
                                                            >
                                                                مشاهدة
                                                            </button>

                                                            <button
                                                                className="studyBtn studyBtnOutline studyBtnSm"
                                                                onClick={() =>
                                                                    navigate(`/learning/${slugOrId}`, {
                                                                        state: { lessonId: it.id },
                                                                    })
                                                                }
                                                            >
                                                                اطلع
                                                            </button>
                                                        </div>
                                                    </div>
                                                </article>
                                            );
                                        })}
                                    </div>
                                </div>
                            </section>
                        );
                    })}
                </div>

                <footer className="studyFooter">استمتع بتعلمك معنا</footer>
            </div>
        </div>
    );
};

export default Study;