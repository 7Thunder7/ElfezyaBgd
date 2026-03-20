// src/pages/Store.tsx
import  { useEffect, useMemo, useRef, useState } from "react";
import api from "../lib/api";
import { getCurrentUser } from "../lib/auth";
import "../CSS/Store.css";

type Grade = { id: number; name: string; slug: string };

type VideoItem = {
    id: string | number;
    title: string;
    video_link?: string;
    photo_url?: string;
    lesson?: number | string | null;
    grades?: Grade[];
    created_at?: string;
    price?: number | null;
};

type ExamItem = {
    id: string | number;
    title: string;
    description?: string;
    kind?: string;
    lesson?: number | string | null;
    grades?: Grade[];
    created_at?: string;
    price?: number | null;
};

type BookItem = {
    id: string | number;
    title: string;
    description?: string;
    photo_url?: string;
    grades?: Grade[];
    created_at?: string;
    price?: number | null;
};

type ProductType = "video" | "exam" | "book";
type Product = {
    key: string; // `${type}:${id}`
    type: ProductType;
    id: string | number;
    title: string;
    description?: string;
    image?: string;
    created_at?: string;
    grades?: Grade[];
    price?: number | null;
};

type UserData = {
    name: string;
    phone: string;
    gradeId?: number | null;
    gradeSlug?: string | null;
    gradeName?: string | null;
};

type SortKey = "newest" | "title" | "price_low" | "price_high";

function safeStr(v: unknown): string {
    return typeof v === "string" ? v : "";
}

function tryPickGradeFromUser(obj: Record<string, unknown>): {
    gradeId?: number;
    gradeSlug?: string;
    gradeName?: string;
} {
    const gradeObj =
        obj["grade"] && typeof obj["grade"] === "object"
            ? (obj["grade"] as Record<string, unknown>)
            : null;

    if (gradeObj) {
        const id = typeof gradeObj["id"] === "number" ? gradeObj["id"] : undefined;
        const slug = safeStr(gradeObj["slug"]) || undefined;
        const name = safeStr(gradeObj["name"]) || undefined;
        return { gradeId: id, gradeSlug: slug, gradeName: name };
    }

    const gradesArr = Array.isArray(obj["grades"]) ? (obj["grades"] as unknown[]) : null;
    if (gradesArr && gradesArr.length) {
        const g0 =
            gradesArr[0] && typeof gradesArr[0] === "object"
                ? (gradesArr[0] as Record<string, unknown>)
                : null;

        if (g0) {
            const id = typeof g0["id"] === "number" ? g0["id"] : undefined;
            const slug = safeStr(g0["slug"]) || undefined;
            const name = safeStr(g0["name"]) || undefined;
            return { gradeId: id, gradeSlug: slug, gradeName: name };
        }
    }

    const gradeId =
        (typeof obj["grade_id"] === "number"
            ? obj["grade_id"]
            : typeof obj["gradeId"] === "number"
                ? obj["gradeId"]
                : undefined) as number | undefined;

    const gradeSlug = (safeStr(obj["grade_slug"]) || safeStr(obj["gradeSlug"]) || "") || undefined;
    const gradeName = (safeStr(obj["grade_name"]) || safeStr(obj["gradeName"]) || "") || undefined;

    return { gradeId, gradeSlug, gradeName };
}

function parseUserToUserData(d: unknown): UserData {
    const fallback: UserData = {
        name: "غير مسجل",
        phone: "غير محدد",
        gradeId: null,
        gradeSlug: null,
        gradeName: null,
    };
    if (!d || typeof d !== "object") return fallback;

    const rec = d as Record<string, unknown>;
    const maybeUser =
        rec["user"] && typeof rec["user"] === "object" ? (rec["user"] as Record<string, unknown>) : rec;

    const first = safeStr(maybeUser["first_name"]);
    const last = safeStr(maybeUser["last_name"]);
    const username = safeStr(maybeUser["username"]);
    const phone = safeStr(maybeUser["phone"]) || safeStr(maybeUser["mobile"]);
    const name = `${first} ${last}`.trim() || username || "غير مسجل";

    const g = tryPickGradeFromUser(maybeUser);

    return {
        name,
        phone: phone || "غير محدد",
        gradeId: g.gradeId ?? null,
        gradeSlug: g.gradeSlug ?? null,
        gradeName: g.gradeName ?? null,
    };
}

function normalizeListResponse<T>(data: any): T[] {
    if (Array.isArray(data)) return data as T[];
    if (data && Array.isArray(data.results)) return data.results as T[];
    return [];
}

function matchGrade(itemGrades: Grade[] | undefined, userGradeId: number | null, userGradeSlug: string | null): boolean {
    if (!userGradeId && !userGradeSlug) return true;
    if (!itemGrades || itemGrades.length === 0) return false;

    return itemGrades.some((g) => {
        if (userGradeId && g.id === userGradeId) return true;
        if (userGradeSlug && g.slug === userGradeSlug) return true;
        return false;
    });
}

function typeLabel(t: ProductType) {
    if (t === "video") return "فيديو";
    if (t === "exam") return "امتحان";
    return "كتاب";
}

function typeIcon(t: ProductType) {
    if (t === "video") return "🎬";
    if (t === "exam") return "📝";
    return "📚";
}

function formatPriceEGP(p: number) {
    const v = Math.round(p * 100) / 100;
    return `${v.toFixed(2)} ج`;
}

function safeDateMs(iso?: string) {
    if (!iso) return 0;
    const t = Date.parse(iso);
    return Number.isFinite(t) ? t : 0;
}

function clampText(s?: string, max = 110) {
    const t = (s || "").trim();
    if (!t) return "";
    return t.length > max ? `${t.slice(0, max - 1)}…` : t;
}

function useDebouncedValue<T>(value: T, delay = 250) {
    const [debounced, setDebounced] = useState(value);
    useEffect(() => {
        const id = window.setTimeout(() => setDebounced(value), delay);
        return () => window.clearTimeout(id);
    }, [value, delay]);
    return debounced;
}

export default function StorePage() {
    const [userData, setUserData] = useState<UserData>({
        name: "",
        phone: "",
        gradeId: null,
        gradeSlug: null,
        gradeName: null,
    });

    const [videos, setVideos] = useState<VideoItem[]>([]);
    const [exams, setExams] = useState<ExamItem[]>([]);
    const [books, setBooks] = useState<BookItem[]>([]);

    const [loadingUser, setLoadingUser] = useState(true);
    const [loadingData, setLoadingData] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [q, setQ] = useState("");
    const qDebounced = useDebouncedValue(q, 260);

    const [typeFilter, setTypeFilter] = useState<ProductType | "all">("all");
    const [sortKey, setSortKey] = useState<SortKey>("newest");

    const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
    const [cartOpen, setCartOpen] = useState(false);

    const mountedRef = useRef(true);

    // ========= Load user =========
    useEffect(() => {
        mountedRef.current = true;

        (async () => {
            setLoadingUser(true);
            try {
                const data = await getCurrentUser();
                if (!mountedRef.current) return;
                setUserData(parseUserToUserData(data));
            } catch {
                // ignore
            } finally {
                if (mountedRef.current) setLoadingUser(false);
            }
        })();

        return () => {
            mountedRef.current = false;
        };
    }, []);

    // ========= Load content =========
    useEffect(() => {
        let aborted = false;

        (async () => {
            setLoadingData(true);
            setError(null);

            try {
                const [vRes, eRes, bRes] = await Promise.all([
                    api.get("/revisions/").catch(() => ({ data: [] })),
                    api.get("/exams/").catch(() => ({ data: [] })),
                    api.get("/books/").catch(() => ({ data: [] })),
                ]);

                if (aborted || !mountedRef.current) return;

                setVideos(normalizeListResponse<VideoItem>(vRes.data));
                setExams(normalizeListResponse<ExamItem>(eRes.data));
                setBooks(normalizeListResponse<BookItem>(bRes.data));
            } catch {
                if (aborted) return;
                setError("حصل خطأ أثناء تحميل المحتوى. حاول تاني.");
            } finally {
                if (!aborted && mountedRef.current) setLoadingData(false);
            }
        })();

        return () => {
            aborted = true;
        };
    }, []);

    // ========= Normalize to unified products =========
    const productsAll: Product[] = useMemo(() => {
        const v: Product[] = videos.map((x) => ({
            key: `video:${x.id}`,
            type: "video",
            id: x.id,
            title: x.title,
            description: "",
            image: x.photo_url,
            created_at: x.created_at,
            grades: x.grades,
            price: x.price ?? null,
        }));

        const e: Product[] = exams.map((x) => ({
            key: `exam:${x.id}`,
            type: "exam",
            id: x.id,
            title: x.title,
            description: x.description || "",
            image: undefined,
            created_at: x.created_at,
            grades: x.grades,
            price: x.price ?? null,
        }));

        const b: Product[] = books.map((x) => ({
            key: `book:${x.id}`,
            type: "book",
            id: x.id,
            title: x.title,
            description: x.description || "",
            image: x.photo_url,
            created_at: x.created_at,
            grades: x.grades,
            price: x.price ?? null,
        }));

        return [...v, ...e, ...b];
    }, [videos, exams, books]);

    // ========= Filter by student's grade =========
    const productsByGrade: Product[] = useMemo(() => {
        const { gradeId, gradeSlug } = userData;
        return productsAll.filter((p) => matchGrade(p.grades, gradeId ?? null, gradeSlug ?? null));
    }, [productsAll, userData]);

    // ========= Search + type filter + sort =========
    const productsView: Product[] = useMemo(() => {
        const qq = qDebounced.trim().toLowerCase();

        const filtered = productsByGrade.filter((p) => {
            if (typeFilter !== "all" && p.type !== typeFilter) return false;
            if (!qq) return true;
            return p.title.toLowerCase().includes(qq);
        });

        const sorted = [...filtered].sort((a, b) => {
            if (sortKey === "title") return a.title.localeCompare(b.title, "ar");
            if (sortKey === "newest") return safeDateMs(b.created_at) - safeDateMs(a.created_at);

            const ap = typeof a.price === "number" ? a.price : Number.POSITIVE_INFINITY;
            const bp = typeof b.price === "number" ? b.price : Number.POSITIVE_INFINITY;

            if (sortKey === "price_low") return ap - bp;
            if (sortKey === "price_high") return bp - ap;
            return 0;
        });

        return sorted;
    }, [productsByGrade, qDebounced, typeFilter, sortKey]);

    // ========= Selection =========
    const togglePick = (key: string) => {
        setSelectedKeys((prev) => {
            const next = new Set(prev);
            if (next.has(key)) next.delete(key);
            else next.add(key);
            return next;
        });
    };

    const clearSelection = () => setSelectedKeys(new Set());

    const selectedProducts = useMemo(() => {
        const set = selectedKeys;
        return productsByGrade.filter((p) => set.has(p.key));
    }, [productsByGrade, selectedKeys]);

    const totalPrice = useMemo(() => {
        return selectedProducts.reduce((sum, p) => sum + (typeof p.price === "number" ? p.price : 0), 0);
    }, [selectedProducts]);

    const missingPriceCount = useMemo(() => {
        return selectedProducts.filter((p) => typeof p.price !== "number").length;
    }, [selectedProducts]);

    const canOpenCart = selectedKeys.size > 0;

    // ========= UX helpers =========
    const resetFilters = () => {
        setQ("");
        setTypeFilter("all");
        setSortKey("newest");
    };

    const headerPill = useMemo(() => {
        const count = selectedKeys.size;
        if (count <= 0) return null;
        return <span className="spHeaderPill">محدد {count}</span>;
    }, [selectedKeys.size]);

    return (
        <div dir="rtl" className="spPage">
            {/* BG */}
            <div className="spBg" aria-hidden="true">
                <span className="spBlob spBlob--a" />
                <span className="spBlob spBlob--b" />
                <span className="spBlob spBlob--c" />
                <span className="spGrid" />
            </div>

            <div className="spWrap">
                <header className="spHeader spEnter">
                    <div className="spHeader__left">
                        <div className="spTitleRow">
                            <h1 className="spTitle">المتجر</h1>
                            {headerPill}
                        </div>
                        <p className="spSub">اختار اللي محتاجه واشتريه بسهولة ✨</p>

                        <div className="spUserCard spEnter" style={{ animationDelay: "80ms" }}>
                            <div className="spUserCard__main">
                                <div className="spUserCard__name">{loadingUser ? "..." : userData.name}</div>
                                <div className="spUserCard__meta">
                                    <span>📞 {loadingUser ? "..." : userData.phone}</span>
                                    <span className="spDot" />
                                    <span>
                                        🎓{" "}
                                        {loadingUser
                                            ? "..."
                                            : userData.gradeName ||
                                            userData.gradeSlug ||
                                            (userData.gradeId ? `Grade #${userData.gradeId}` : "غير معروف")}
                                    </span>
                                </div>
                            </div>

                            {!loadingUser && !userData.gradeId && !userData.gradeSlug && (
                                <div className="spWarn">مش قادر أحدد سنة الطالب من بيانات المستخدم — هعرض المحتوى كله مؤقتًا.</div>
                            )}
                        </div>
                    </div>

                    <aside className="spActions spEnter" style={{ animationDelay: "120ms" }}>
                        <button type="button" className="spBtn spBtn--ghost" onClick={resetFilters}>
                            مسح الفلاتر
                        </button>

                        <button
                            type="button"
                            className="spBtn spBtn--primary"
                            disabled={!canOpenCart}
                            onClick={() => setCartOpen(true)}
                            title={!canOpenCart ? "اختار منتجات الأول" : "افتح عربة التسوق"}
                        >
                            شراء <span className="spBtn__count">({selectedKeys.size})</span>
                        </button>

                        <button type="button" className="spBtn spBtn--ghost" disabled={selectedKeys.size === 0} onClick={clearSelection}>
                            إلغاء التحديد
                        </button>
                    </aside>
                </header>

                {/* Toolbar */}
                <section className="spToolbar spEnter" style={{ animationDelay: "160ms" }}>
                    <div className="spSearch">
                        <input
                            value={q}
                            onChange={(e) => setQ(e.target.value)}
                            placeholder="ابحث بالعنوان…"
                            className="spSearch__input"
                        />
                        <span className="spSearch__icon" aria-hidden="true">
                            ⌕
                        </span>
                    </div>

                    <div className="spToolbar__right">
                        <div className="spFilters" aria-label="فلترة حسب النوع">
                            <button type="button" className={`spPill ${typeFilter === "all" ? "spPill--on" : ""}`} onClick={() => setTypeFilter("all")}>
                                الكل
                            </button>
                            <button type="button" className={`spPill ${typeFilter === "book" ? "spPill--on" : ""}`} onClick={() => setTypeFilter("book")}>
                                كتب
                            </button>
                            <button type="button" className={`spPill ${typeFilter === "video" ? "spPill--on" : ""}`} onClick={() => setTypeFilter("video")}>
                                فيديوهات
                            </button>
                            <button type="button" className={`spPill ${typeFilter === "exam" ? "spPill--on" : ""}`} onClick={() => setTypeFilter("exam")}>
                                امتحانات
                            </button>
                        </div>

                        <div className="spSort" aria-label="الترتيب">
                            <select className="spSelect" value={sortKey} onChange={(e) => setSortKey(e.target.value as SortKey)}>
                                <option value="newest">الأحدث</option>
                                <option value="title">بالاسم</option>
                                <option value="price_low">السعر: الأقل</option>
                                <option value="price_high">السعر: الأعلى</option>
                            </select>
                        </div>
                    </div>
                </section>

                {/* Data state */}
                {error && (
                    <div className="spError spEnter">
                        <div className="spError__pill">{error}</div>
                    </div>
                )}

                {loadingData ? (
                    <>
                        <div className="spSummary spEnter" style={{ animationDelay: "200ms" }}>
                            جاري التحميل…
                        </div>
                        <section className="spGridWrap">
                            <div className="spGridCards">
                                {Array.from({ length: 9 }).map((_, i) => (
                                    <div key={i} className="spCard spCard--skeleton spEnter" style={{ animationDelay: `${220 + i * 18}ms` }} />
                                ))}
                            </div>
                        </section>
                    </>
                ) : (
                    <>
                        <div className="spSummary spEnter" style={{ animationDelay: "200ms" }}>
                            المعروض: <b>{productsView.length}</b> — المحدد: <b>{selectedKeys.size}</b>
                        </div>

                        {/* Grid */}
                        <section className="spGridWrap">
                            {productsView.length === 0 ? (
                                <div className="spEmpty spEnter">
                                    <div className="spEmpty__icon">🧐</div>
                                    <div className="spEmpty__title">مفيش نتائج مطابقة</div>
                                    <div className="spEmpty__sub">جرّب كلمة تانية أو غيّر نوع المحتوى.</div>
                                    <button className="spBtn spBtn--ghost spEmpty__btn" onClick={resetFilters}>
                                        مسح الفلاتر
                                    </button>
                                </div>
                            ) : (
                                <div className="spGridCards">
                                    {productsView.map((p, idx) => {
                                        const picked = selectedKeys.has(p.key);
                                        const priceOK = typeof p.price === "number";
                                        const desc = clampText(p.description, 120);
                                        const gradeName = p.grades?.[0]?.name || p.grades?.[0]?.slug || "بدون سنة";

                                        return (
                                            <article
                                                key={p.key}
                                                className={`spCard spEnter ${picked ? "spCard--picked" : ""}`}
                                                style={{ animationDelay: `${220 + idx * 18}ms` }}
                                                onClick={() => togglePick(p.key)}
                                                role="button"
                                                tabIndex={0}
                                                onKeyDown={(e) => {
                                                    if (e.key === "Enter" || e.key === " ") {
                                                        e.preventDefault();
                                                        togglePick(p.key);
                                                    }
                                                }}
                                                aria-pressed={picked}
                                            >
                                                <div className="spCard__media">
                                                    {p.image ? (
                                                        <img className="spThumb" src={p.image} alt={p.title} loading="lazy" />
                                                    ) : (
                                                        <div className="spThumb spThumb--placeholder" aria-hidden="true">
                                                            <span className="spThumb__icon">{typeIcon(p.type)}</span>
                                                        </div>
                                                    )}

                                                    <div className="spCard__overlay">
                                                        <div className="spBadge">{typeLabel(p.type)}</div>
                                                        <div className={`spPrice ${priceOK ? "" : "spPrice--soon"}`} title={!priceOK ? "السعر لسه مش متوفر من الباك" : undefined}>
                                                            {priceOK ? formatPriceEGP(p.price as number) : "قريبًا"}
                                                        </div>
                                                    </div>

                                                    {picked && <div className="spPickedMark" aria-hidden="true">✓</div>}
                                                </div>

                                                <div className="spCard__body">
                                                    <div className="spCard__title">{p.title}</div>
                                                    {desc ? <div className="spCard__desc">{desc}</div> : null}
                                                </div>

                                                <div className="spCard__foot">
                                                    <label className="spPick" onClick={(e) => e.stopPropagation()}>
                                                        <input type="checkbox" checked={picked} onChange={() => togglePick(p.key)} />
                                                        <span>{picked ? "محدد" : "اختيار"}</span>
                                                    </label>

                                                    <div className={`spGradeTag ${p.grades && p.grades.length ? "" : "spGradeTag--muted"}`} title="السنة">
                                                        {gradeName}
                                                    </div>
                                                </div>
                                            </article>
                                        );
                                    })}
                                </div>
                            )}
                        </section>
                    </>
                )}
            </div>

            {/* Cart Drawer */}
            <div className={`spCart ${cartOpen ? "spCart--open" : ""}`} aria-hidden={!cartOpen}>
                <div className="spCart__backdrop" onClick={() => setCartOpen(false)} />

                <div className="spCart__panel" role="dialog" aria-modal="true" aria-label="عربة التسوق">
                    <div className="spCart__head">
                        <div>
                            <div className="spCart__title">عربة التسوق</div>
                            <div className="spCart__sub">
                                عناصر: <b>{selectedProducts.length}</b>
                                {missingPriceCount > 0 ? (
                                    <>
                                        <span className="spDot" /> <span className="spSoonNote">({missingPriceCount} بدون سعر)</span>
                                    </>
                                ) : null}
                            </div>
                        </div>

                        <button className="spIconBtn" onClick={() => setCartOpen(false)} aria-label="إغلاق">
                            ✕
                        </button>
                    </div>

                    <div className="spCart__list">
                        {selectedProducts.length === 0 ? (
                            <div className="spEmpty">العربة فاضية.</div>
                        ) : (
                            selectedProducts.map((p) => {
                                const priceOK = typeof p.price === "number";
                                return (
                                    <div key={p.key} className="spCartItem">
                                        <div className="spCartItem__meta">
                                            <div className="spCartItem__title">{p.title}</div>
                                            <div className="spCartItem__type">
                                                {typeIcon(p.type)} {typeLabel(p.type)}
                                            </div>
                                        </div>

                                        <div className={`spCartItem__price ${priceOK ? "" : "spCartItem__price--soon"}`}>
                                            {priceOK ? formatPriceEGP(p.price as number) : "قريبًا"}
                                        </div>

                                        <button className="spCartItem__remove" onClick={() => togglePick(p.key)} title="إزالة">
                                            إزالة
                                        </button>
                                    </div>
                                );
                            })
                        )}
                    </div>

                    <div className="spCart__foot">
                        <div className="spTotal">
                            <span>الإجمالي:</span>
                            <b>{formatPriceEGP(totalPrice)}</b>
                        </div>

                        <div className="spCart__actions">
                            <button className="spBtn spBtn--ghost" onClick={clearSelection} disabled={selectedKeys.size === 0}>
                                تفريغ
                            </button>

                            <button
                                className="spBtn spBtn--primary"
                                disabled={selectedProducts.length === 0}
                                onClick={() => alert("جاهز للدفع — اربط endpoint الشراء لما يكون متاح.")}
                            >
                                متابعة الشراء
                            </button>
                        </div>

                        {missingPriceCount > 0 && (
                            <div className="spCart__note">العناصر اللي مكتوب عليها “قريبًا” سعرها مش راجع من الباك لسه — مش داخلة في الإجمالي.</div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}