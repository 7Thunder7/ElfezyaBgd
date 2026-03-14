// src/pages/Learning.tsx
import React, { useEffect, useState, useRef } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { getCurrentUser } from "../lib/auth";
import { logoutUser as apiLogout } from "../lib/auth";
import "../CSS/Learning.css";

/* ========== TYPES ========== */
type StepState = { watched: boolean; unlocked: boolean };
type PartProgress = StepState[];
type ProgressDynamic = { parts: PartProgress[] };

type LessonPartAPI = {
    id: number | string;
    title?: string;
    slug?: string;
    order?: number;
};

type VideoAPI = {
    id: number | string;
    title?: string;
    url?: string;
    kind?: string;
    position?: number;
    part?: number | string | null;
};

type ExamAPI = {
    id: number | string;
    title?: string;
    description?: string;
    order?: number;
    is_published?: boolean;
    lesson?: number | string;
};

type LessonAPI = {
    id: number | string;
    title?: string;
    slug?: string;
    short_description?: string;
    section?: { id?: number | string; title?: string };
    videos?: VideoAPI[];
    exams?: ExamAPI[];
};

type OrganizedPart = {
    partData: LessonPartAPI;
    explanationVideo: VideoAPI | null;
    solutionVideo: VideoAPI | null;
    quickExam: ExamAPI | null;
    fullExam: ExamAPI | null;
};

type UserData = {
    name: string;
    phone: string;
};

/* ========== HELPERS ========== */
function isRecord(v: unknown): v is Record<string, unknown> {
    return v !== null && typeof v === "object" && !Array.isArray(v);
}

function progressKeyForLesson(lessonId: string | number) {
    return `LEARNING_V4_PROGRESS_${String(lessonId)}`;
}

function readProgressForLesson(lessonId: string | number): ProgressDynamic | null {
    try {
        const raw = localStorage.getItem(progressKeyForLesson(lessonId));
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        if (!isRecord(parsed) || !Array.isArray(parsed.parts)) return null;
        return { parts: parsed.parts as PartProgress[] };
    } catch {
        return null;
    }
}

function writeProgressForLesson(lessonId: string | number, prog: ProgressDynamic) {
    try {
        localStorage.setItem(progressKeyForLesson(lessonId), JSON.stringify(prog));
    } catch {
        /* ignore */
    }
}

function pct(watched: number, total: number) {
    return total === 0 ? 0 : Math.round((watched / total) * 100);
}

/* ========== UI COMPONENTS ========== */
const Badge: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className }) => (
    <span className={`lpBadge ${className ?? ""}`}>{children}</span>
);

const IconVideo = () => (
    <svg className="lpIcon" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
        <path strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" d="M15 10l4 2-4 2V10z" />
        <rect x="3" y="6" width="12" height="12" rx="2" strokeWidth="1.5" />
    </svg>
);

const IconExam = () => (
    <svg className="lpIcon" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
        <path d="M12 9v6" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M9 12h6" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        <rect x="3" y="3" width="18" height="18" rx="2" strokeWidth="1.5" />
    </svg>
);

const IconLock = () => (

    <svg className="lpIconSm" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
        <rect x="3" y="11" width="18" height="11" rx="2" ry="2" strokeWidth="2" />
        <path d="M7 11V7a5 5 0 0 1 10 0v4" strokeWidth="2" />
    </svg>
);

const IconFull = () => (
    <svg className="lpIcon" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
        <path d="M8 3H5a2 2 0 0 0-2 2v3" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M16 21h3a2 2 0 0 0 2-2v-3" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M21 8V5a2 2 0 0 0-2-2h-3" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M3 16v3a2 2 0 0 0 2 2h3" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
);

/* ========== MAIN COMPONENT ========== */
const Learning: React.FC = () => {
    const navigate = useNavigate();
    const params = useParams();
    const location = useLocation();

    const slugOrIdParam = params.slugOrId ?? null;
    const stateLessonId = isRecord(location.state)
        ? (location.state as Record<string, unknown>)["lessonId"] ?? null
        : null;

    const [lesson, setLesson] = useState<LessonAPI | null>(null);
    const [parts, setParts] = useState<OrganizedPart[]>([]);
    const [progress, setProgress] = useState<ProgressDynamic | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [activeVideo, setActiveVideo] = useState<{ src: string; partIndex: number; stepIndex: number } | null>(null);
    const [userData, setUserData] = useState<UserData>({ name: "", phone: "" });
    const [isRecording, setIsRecording] = useState(false);
    const [watermarkPosition, setWatermarkPosition] = useState({ x: 50, y: 50 });
    const [isFullscreenMode, setIsFullscreenMode] = useState(false);

    const videoRef = useRef<HTMLVideoElement>(null);
    const videoContainerRef = useRef<HTMLDivElement>(null);
    const watermarkIntervalRef = useRef<NodeJS.Timeout | null>(null);
    const savedVideoSrcRef = useRef<string | null>(null);




    // Called when we detect a recording attempt — pause & blank the video and show overlay
    const handleRecordingDetected = () => {
        if (isRecording) return;
        setIsRecording(true);

        // ✅ Logout immediately, regardless of video state
        try {
            apiLogout();
        } catch {
            console.debug("Logout failed during recording detection");
        }

        try {
            const v = videoRef.current;
            if (v) {
                savedVideoSrcRef.current =
                    v.currentSrc || (v.querySelector && (v.querySelector("source") as HTMLSourceElement)?.src) || null;
                v.pause();

                try {
                    const sources = v.querySelectorAll ? v.querySelectorAll("source") : [];
                    Array.from(sources).forEach((s) => s.remove());
                } catch {
                    // ignore
                }

                try {
                    v.removeAttribute("src");
                    v.load();
                } catch {
                    // ignore load errors
                }
            }
        } catch (err) {
            console.debug("Video cleanup failed", err);
        }

        // ✅ Navigate away
        try {
            navigate("/");
        } catch {
            window.location.href = "/";
        }
    };

    // Restore video after user acknowledges
    const restoreVideoAfterBlock = () => {
        setIsRecording(false);
        try {
            const v = videoRef.current;
            const saved = savedVideoSrcRef.current;
            if (v && saved) {
                v.src = saved;
                v.load();
                v.play().catch(() => {
                    /* autoplay policy */
                });
                savedVideoSrcRef.current = null;
            }
        } catch (err) {
            console.debug("restoreVideoAfterBlock failed", err);
        }
    };

    // Close the video player entirely when recording attempt detected
    const closeVideoOnRecording = () => {
        setIsRecording(false);
        setActiveVideo(null);
        savedVideoSrcRef.current = null;
    };

    // Fetch current user and normalize shape
    useEffect(() => {
        let mounted = true;

        function parseUserToUserData(d: unknown): UserData | null {
            if (!d || typeof d !== "object") return null;
            const rec = d as Record<string, unknown>;

            const maybeUser =
                rec["user"] && typeof rec["user"] === "object" ? (rec["user"] as Record<string, unknown>) : rec;

            const first = typeof maybeUser["first_name"] === "string" ? (maybeUser["first_name"] as string) : "";
            const last = typeof maybeUser["last_name"] === "string" ? (maybeUser["last_name"] as string) : "";
            const username = typeof maybeUser["username"] === "string" ? (maybeUser["username"] as string) : "";
            const phone =
                typeof maybeUser["phone"] === "string"
                    ? (maybeUser["phone"] as string)
                    : typeof maybeUser["mobile"] === "string"
                        ? (maybeUser["mobile"] as string)
                        : "";

            const name = `${first} ${last}`.trim() || username || "غير مسجل";
            return { name, phone: phone || "غير محدد" };
        }

        (async () => {
            try {
                const data = await getCurrentUser();
                if (!mounted) return;

                if (data) {
                    const ud = parseUserToUserData(data);
                    if (ud) {
                        setUserData(ud);
                        try {
                            localStorage.setItem("current_user", JSON.stringify(data));
                        } catch {
                            // ignore localStorage errors
                        }
                    }
                }
            } catch (error) {
                console.error("Error while fetching current user in Learning:", error);
            }
        })();

        return () => {
            mounted = false;
        };
    }, []);

    // Enhanced screen recording detection (typed, cleaned)
    type DisplayMediaFunc = (constraints?: MediaStreamConstraints) => Promise<MediaStream>;

    useEffect(() => {
        let recordingTimeout: NodeJS.Timeout | null = null;
        let originalGetDisplayMedia: DisplayMediaFunc | undefined;

        const detectScreenCapture = () => {
            try {
                const mediaDevices = (navigator as unknown as { mediaDevices?: { getDisplayMedia?: DisplayMediaFunc } }).mediaDevices;
                if (mediaDevices && typeof mediaDevices.getDisplayMedia === "function") {
                    originalGetDisplayMedia = mediaDevices.getDisplayMedia;

                    mediaDevices.getDisplayMedia = async (): ReturnType<DisplayMediaFunc> => {
                        handleRecordingDetected();

                        const err =
                            typeof DOMException !== "undefined"
                                ? new DOMException("Screen capture disabled", "NotAllowedError")
                                : new Error("Screen capture disabled");
                        return Promise.reject(err);
                    };
                }
            } catch {
                // ignore override failures
            }
        };

        const handleVisibilityChange = () => {
            if (document.hidden) {
                handleRecordingDetected();
                if (recordingTimeout) clearTimeout(recordingTimeout);
                recordingTimeout = setTimeout(() => setIsRecording(false), 5000);
            }
        };

        const handleKeyDown = (e: KeyboardEvent) => {
            if (
                e.key === "PrintScreen" ||
                (e.metaKey && e.shiftKey && ["3", "4", "5"].includes(e.key)) ||
                (e.metaKey && e.shiftKey && e.key === "s") ||
                (e.key === "s" && e.shiftKey && (e.metaKey || e.ctrlKey))
            ) {
                handleRecordingDetected();
                if (recordingTimeout) clearTimeout(recordingTimeout);
                recordingTimeout = setTimeout(() => setIsRecording(false), 3000);
            }
        };

        const handleBlur = () => {
            handleRecordingDetected();
            if (recordingTimeout) clearTimeout(recordingTimeout);
            recordingTimeout = setTimeout(() => setIsRecording(false), 2000);
        };

        const handleFullscreenChange = () => {
            const fsEl =
                (document as Document & {
                    fullscreenElement?: Element;
                    webkitFullscreenElement?: Element;
                    msFullscreenElement?: Element;
                }).fullscreenElement ??
                (document as Document & { webkitFullscreenElement?: Element }).webkitFullscreenElement ??
                (document as Document & { msFullscreenElement?: Element }).msFullscreenElement ??
                null;
            setIsFullscreenMode(Boolean(fsEl));
        };

        detectScreenCapture();
        document.addEventListener("visibilitychange", handleVisibilityChange);
        document.addEventListener("keydown", handleKeyDown);
        window.addEventListener("blur", handleBlur);
        document.addEventListener("fullscreenchange", handleFullscreenChange);

        return () => {
            document.removeEventListener("visibilitychange", handleVisibilityChange);
            document.removeEventListener("keydown", handleKeyDown);
            window.removeEventListener("blur", handleBlur);
            document.removeEventListener("fullscreenchange", handleFullscreenChange);
            if (recordingTimeout) clearTimeout(recordingTimeout);

            try {
                const mediaDevices = (navigator as unknown as { mediaDevices?: { getDisplayMedia?: DisplayMediaFunc } }).mediaDevices;
                if (originalGetDisplayMedia && mediaDevices) {
                    mediaDevices.getDisplayMedia = originalGetDisplayMedia;
                }
            } catch {
                // ignore restore failure
            }
        };
    }, []);

    // Animated watermark position (single watermark)
    useEffect(() => {
        if (!activeVideo) {
            if (watermarkIntervalRef.current) {
                clearInterval(watermarkIntervalRef.current);
                watermarkIntervalRef.current = null;
            }
            return;
        }

        watermarkIntervalRef.current = setInterval(() => {
            setWatermarkPosition({
                x: Math.random() * 60 + 20,
                y: Math.random() * 60 + 20,
            });
        }, 3000);

        return () => {
            if (watermarkIntervalRef.current) {
                clearInterval(watermarkIntervalRef.current);
                watermarkIntervalRef.current = null;
            }
        };
    }, [activeVideo]);

    // ---------- Fullscreen helpers ----------
    type PrefixedFullscreenElement = HTMLElement & {
        webkitRequestFullscreen?: () => Promise<void> | void;
        msRequestFullscreen?: () => Promise<void> | void;
    };

    type PrefixedDocument = Document & {
        webkitExitFullscreen?: () => Promise<void> | void;
        msExitFullscreen?: () => Promise<void> | void;
    };

    const enterFullscreenOnContainer = async (): Promise<void> => {
        const el = videoContainerRef.current as PrefixedFullscreenElement | null;
        if (!el) return;

        try {
            if ("requestFullscreen" in el && typeof el.requestFullscreen === "function") {
                await el.requestFullscreen();
                return;
            }

            if (typeof el.webkitRequestFullscreen === "function") {
                await Promise.resolve(el.webkitRequestFullscreen());
                return;
            }

            if (typeof el.msRequestFullscreen === "function") {
                await Promise.resolve(el.msRequestFullscreen());
                return;
            }
        } catch (err) {
            console.debug("enterFullscreen failed", err);
        }
    };

    const exitFullscreen = async (): Promise<void> => {
        try {
            const pd = document as PrefixedDocument;

            if ("exitFullscreen" in pd && typeof pd.exitFullscreen === "function" && pd.fullscreenElement) {
                await pd.exitFullscreen();
                return;
            }

            if (
                typeof pd.webkitExitFullscreen === "function" &&
                (pd as Document & { webkitFullscreenElement?: Element }).webkitFullscreenElement
            ) {
                await Promise.resolve(pd.webkitExitFullscreen());
                return;
            }

            if (
                typeof pd.msExitFullscreen === "function" &&
                (pd as Document & { msFullscreenElement?: Element }).msFullscreenElement
            ) {
                await Promise.resolve(pd.msExitFullscreen());
                return;
            }
        } catch (err) {
            console.debug("exitFullscreen failed", err);
        }
    };

    const toggleFullscreen = async () => {
        if (document.fullscreenElement) {
            await exitFullscreen();
        } else {
            await enterFullscreenOnContainer();
        }
    };

    const handleVideoDoubleClick = (e: React.MouseEvent) => {
        e.preventDefault();
        toggleFullscreen();
    };

    // Fetch lesson data
    useEffect(() => {
        let mounted = true;

        (async () => {
            setLoading(true);
            setError(null);

            const idOrSlug = slugOrIdParam ?? String(stateLessonId ?? "");
            if (!idOrSlug) {
                setError("لم يتم تحديد الدرس.");
                setLoading(false);
                return;
            }

            try {
                const lessonRes = await fetch(`/api/lessons/${encodeURIComponent(idOrSlug)}/`, {
                    credentials: "include",
                });

                if (!lessonRes.ok) {
                    throw new Error(`فشل تحميل الدرس (${lessonRes.status})`);
                }

                const lessonData: LessonAPI = await lessonRes.json();
                if (!mounted) return;

                setLesson(lessonData);

                const partsRes = await fetch(`/api/lesson-parts/?lesson=${lessonData.id}`, {
                    credentials: "include",
                });

                let lessonParts: LessonPartAPI[] = [];
                if (partsRes.ok) {
                    const partsData = await partsRes.json();
                    lessonParts = Array.isArray(partsData) ? partsData : Array.isArray(partsData.results) ? partsData.results : [];
                } else {
                    console.warn("Could not fetch lesson parts, will create one default part");
                }

                if (lessonParts.length === 0) {
                    lessonParts = [{ id: "default", title: "الجزء الوحيد", order: 0 }];
                }

                lessonParts.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

                const videos = lessonData.videos ?? [];
                const exams = lessonData.exams ?? [];

                const organized: OrganizedPart[] = lessonParts.map((part) => {
                    const partVideos = videos.filter((v) => v.part !== null && v.part !== undefined && String(v.part) === String(part.id));

                    const partExams = exams.filter((e) => {
                        const examPart = (e as Record<string, unknown>).part;
                        return e.is_published !== false && examPart !== null && examPart !== undefined && String(examPart) === String(part.id);
                    });

                    const explanationVideo = partVideos.find((v) => v.kind === "exp") ?? null;
                    const solutionVideo = partVideos.find((v) => v.kind === "sol") ?? null;

                    const sortedExams = [...partExams].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
                    const quickExam = sortedExams.find((e) => (e.order ?? 0) === 0) ?? null;
                    const fullExam = sortedExams.find((e) => (e.order ?? 0) === 1) ?? null;

                    return { partData: part, explanationVideo, solutionVideo, quickExam, fullExam };
                });

                setParts(organized);

                const lessonId = lessonData.id ?? idOrSlug;
                const existing = readProgressForLesson(lessonId);

                if (existing && existing.parts.length === organized.length) {
                    setProgress(existing);
                } else {
                    const initial: ProgressDynamic = {
                        parts: organized.map(() => [
                            { watched: false, unlocked: true },
                            { watched: false, unlocked: false },
                            { watched: false, unlocked: false },
                            { watched: false, unlocked: false },
                        ]),
                    };
                    setProgress(initial);
                    writeProgressForLesson(lessonId, initial);
                }

                setLoading(false);
            } catch (err) {
                if (!mounted) return;
                console.error("Error loading lesson:", err);
                setError(err instanceof Error ? err.message : "حدث خطأ غير متوقع");
                setLoading(false);
            }
        })();

        return () => {
            mounted = false;
        };
    }, [slugOrIdParam, stateLessonId]);

    const setStepState = (partIndex: number, stepIndex: number, next: Partial<StepState>) => {
        if (!lesson) return;
        const lessonId = lesson.id ?? slugOrIdParam ?? "unknown";

        setProgress((prev) => {
            if (!prev) return prev;

            const partsCopy = prev.parts.map((p) => p.map((s) => ({ ...s })));

            if (!partsCopy[partIndex] || !partsCopy[partIndex][stepIndex]) return prev;

            partsCopy[partIndex][stepIndex] = { ...partsCopy[partIndex][stepIndex], ...next };

            if (next.watched === true) {
                const nextIdx = stepIndex + 1;
                if (partsCopy[partIndex][nextIdx]) {
                    partsCopy[partIndex][nextIdx].unlocked = true;
                } else {
                    const nextPart = partIndex + 1;
                    if (partsCopy[nextPart]?.[0]) {
                        partsCopy[nextPart][0].unlocked = true;
                    }
                }
            }

            const newProg = { parts: partsCopy };
            writeProgressForLesson(lessonId, newProg);
            return newProg;
        });
    };

    const openVideo = async (video: VideoAPI | null, partIndex: number, stepIndex: number) => {
        if (!video || !lesson) return;

        if (video.url) {
            setActiveVideo({ src: video.url, partIndex, stepIndex });
            return;
        }

        if (video.id && lesson.slug) {
            try {
                const res = await fetch(`/api/lessons/${encodeURIComponent(String(lesson.slug))}/presign-video/${video.id}/`, {
                    credentials: "include",
                });

                if (!res.ok) throw new Error(`Presign failed (${res.status})`);

                const data = await res.json();
                if (data.url) {
                    setActiveVideo({ src: data.url, partIndex, stepIndex });
                    return;
                }
            } catch (err) {
                console.error("Presign error:", err);
            }
        }

        setError("لا يمكن الحصول على رابط الفيديو");
    };

    const openExam = (examId: number | string | null | undefined) => {
        if (!lesson || !examId) {
            setError("معرّف الامتحان غير متوفر");
            return;
        }

        const lessonRef = lesson.slug ?? lesson.id;
        const url = `/exams?lesson=${encodeURIComponent(String(lessonRef))}&exam=${encodeURIComponent(String(examId))}`;
        navigate(url);
    };

    const onVideoEnded = () => {
        if (!activeVideo) return;
        setStepState(activeVideo.partIndex, activeVideo.stepIndex, { watched: true });
        setActiveVideo(null);
    };

    /* ========== RENDER ========== */
    if (loading) {
        return (
            <div className="lpLearnPage">
                <div className="lpLearnShell">
                    <div className="lpStateCard">
                        <div className="lpSpinner" aria-hidden />
                        <div className="lpStateTitle">جاري تحميل الدرس...</div>
                        <div className="lpStateSub">لحظة واحدة بس</div>
                    </div>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="lpLearnPage">
                <div className="lpLearnShell">
                    <div className="lpStateCard">
                        <h2 className="lpStateTitle">حدث خطأ</h2>
                        <p className="lpStateSub">{error}</p>
                        <button type="button" onClick={() => window.location.reload()} className="lpBtn lpBtnPrimary">
                            إعادة المحاولة
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    if (!lesson || parts.length === 0) {
        return (
            <div className="lpLearnPage">
                <div className="lpLearnShell">
                    <div className="lpStateCard">
                        <h2 className="lpStateTitle">لم يتم العثور على محتوى</h2>
                        <p className="lpStateSub">لا توجد أجزاء لهذا الدرس.</p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div dir="rtl" className="lpLearnPage">
            {/* Anti-Recording Overlay */}
            {isRecording && (
                <div className="lpOverlay">
                    <div className="lpOverlayCard">
                        <div className="lpOverlayWarn">⚠️</div>
                        <h3 className="lpOverlayTitle">تم اكتشاف محاولة تسجيل الشاشة</h3>
                        <p className="lpOverlayText">التسجيل غير مسموح به لحماية المحتوى.</p>

                        <div className="lpOverlayActions">
                            <button type="button" onClick={restoreVideoAfterBlock} className="lpBtn lpBtnPrimary">
                                أعد التشغيل
                            </button>
                            <button type="button" onClick={closeVideoOnRecording} className="lpBtn lpBtnRose">
                                إغلاق الفيديو
                            </button>
                        </div>

                        <div className="lpOverlayNote">
                            ملاحظة: هذا الحماية تحاول وقف التسجيل داخل المتصفح. لا يمكننا إيقاف برامج تسجيل الشاشة الخارجيّة على مستوى النظام.
                        </div>
                    </div>
                </div>
            )}
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

            <div className="lpLearnShell lpLearnStack">
                {/* Header */}
                <header className="lpLearnHeader">
                    <h1 className="lpLearnTitle">{lesson.title ?? "درس"}</h1>
                    <p className="lpLearnSub">{lesson.short_description ?? "شرح منظم بحسب الأجزاء"}</p>
                </header>

                {/* Controls */}
                <div className="lpLearnControls">
                    <div className="lpLearnBadges">
                        <Badge>عدد الأجزاء: {parts.length}</Badge>
                        <Badge>4 خطوات لكل جزء</Badge>
                    </div>
                </div>

                {/* Parts */}
                <div className="lpParts">
                    {parts.map((part, pIdx) => {
                        const partProg =
                            progress?.parts?.[pIdx] ?? [
                                { watched: false, unlocked: true },
                                { watched: false, unlocked: false },
                                { watched: false, unlocked: false },
                                { watched: false, unlocked: false },
                            ];

                        const watchedCount = partProg.filter((s) => s.watched).length;
                        const totalCount = 4;
                        const percent = pct(watchedCount, totalCount);

                        return (
                            <section key={String(part.partData.id)} className="lpPartCard">
                                {/* Part Header */}
                                <div className="lpPartHead">
                                    <div>
                                        <h2 className="lpPartTitle">{part.partData.title ?? `الجزء ${pIdx + 1}`}</h2>
                                        <div className="lpPartHint">4 خطوات: فيديو شرح → اختبار سريع → فيديو حل → امتحان نهائي</div>
                                    </div>

                                    <div className="lpProgress">
                                        <div className="lpProgressLabel">التقدم</div>
                                        <div className="lpProgressBar" aria-hidden>
                                            <div className="lpProgressFill" style={{ width: `${percent}%` }} />
                                        </div>
                                        <div className="lpProgressMeta">
                                            {watchedCount}/{totalCount} ({percent}%)
                                        </div>
                                    </div>
                                </div>

                                {/* Steps Grid */}
                                <div className="lpStepsGrid">
                                    {/* Step 1 */}
                                    <div className="lpStepCard">
                                        <div className="lpStepTop">
                                            <div className="lpStepName">
                                                <IconVideo /> فيديو الشرح
                                            </div>
                                            <Badge className="lpBadge--blue">شرح</Badge>
                                        </div>

                                        {part.explanationVideo ? (
                                            <>
                                                <div className="lpStepTitle">{part.explanationVideo.title ?? "فيديو الشرح"}</div>
                                                <button
                                                    type="button"
                                                    onClick={() => openVideo(part.explanationVideo, pIdx, 0)}
                                                    disabled={!partProg[0]?.unlocked}
                                                    className={
                                                        partProg[0]?.unlocked ? "lpBtn lpBtnPrimary lpBtnBlock lpBtnSm" : "lpBtn lpBtnLocked lpBtnBlock lpBtnSm"
                                                    }
                                                >
                                                    {!partProg[0]?.unlocked && <IconLock />}
                                                    {partProg[0]?.watched ? "✓ تم المشاهدة" : "تشغيل"}
                                                </button>
                                            </>
                                        ) : (
                                            <div className="lpStepEmpty">لا يوجد فيديو شرح</div>
                                        )}
                                    </div>

                                    {/* Step 2 */}
                                    <div className="lpStepCard">
                                        <div className="lpStepTop">
                                            <div className="lpStepName">
                                                <IconExam /> اختبار سريع
                                            </div>
                                            <Badge className="lpBadge--yellow">اختبار</Badge>
                                        </div>

                                        {part.quickExam ? (
                                            <>
                                                <div className="lpStepTitle">{part.quickExam.title ?? "اختبار سريع"}</div>
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        openExam(part.quickExam?.id);
                                                        setStepState(pIdx, 1, { watched: true });
                                                    }}
                                                    disabled={!partProg[1]?.unlocked}
                                                    className={
                                                        partProg[1]?.unlocked ? "lpBtn lpBtnWarn lpBtnBlock lpBtnSm" : "lpBtn lpBtnLocked lpBtnBlock lpBtnSm"
                                                    }
                                                >
                                                    {!partProg[1]?.unlocked && <IconLock />}
                                                    {partProg[1]?.watched ? "✓ تم الاختبار" : "ابدأ الاختبار"}
                                                </button>
                                            </>
                                        ) : (
                                            <div className="lpStepEmpty">لا يوجد اختبار سريع</div>
                                        )}
                                    </div>

                                    {/* Step 3 */}
                                    <div className="lpStepCard">
                                        <div className="lpStepTop">
                                            <div className="lpStepName">
                                                <IconVideo /> فيديو الحل
                                            </div>
                                            <Badge className="lpBadge--purple">حل</Badge>
                                        </div>

                                        {part.solutionVideo ? (
                                            <>
                                                <div className="lpStepTitle">{part.solutionVideo.title ?? "فيديو الحل"}</div>
                                                <button
                                                    type="button"
                                                    onClick={() => openVideo(part.solutionVideo, pIdx, 2)}
                                                    disabled={!partProg[2]?.unlocked}
                                                    className={
                                                        partProg[2]?.unlocked ? "lpBtn lpBtnViolet lpBtnBlock lpBtnSm" : "lpBtn lpBtnLocked lpBtnBlock lpBtnSm"
                                                    }
                                                >
                                                    {!partProg[2]?.unlocked && <IconLock />}
                                                    {partProg[2]?.watched ? "✓ تم المشاهدة" : "تشغيل"}
                                                </button>
                                            </>
                                        ) : (
                                            <div className="lpStepEmpty">لا يوجد فيديو حل</div>
                                        )}
                                    </div>

                                    {/* Step 4 */}
                                    <div className="lpStepCard">
                                        <div className="lpStepTop">
                                            <div className="lpStepName">
                                                <IconExam /> امتحان نهائي
                                            </div>
                                            <Badge className="lpBadge--rose">نهائي</Badge>
                                        </div>

                                        {part.fullExam ? (
                                            <>
                                                <div className="lpStepTitle">{part.fullExam.title ?? "امتحان نهائي"}</div>
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        openExam(part.fullExam?.id);
                                                        setStepState(pIdx, 3, { watched: true });
                                                    }}
                                                    disabled={!partProg[3]?.unlocked}
                                                    className={
                                                        partProg[3]?.unlocked ? "lpBtn lpBtnRose lpBtnBlock lpBtnSm" : "lpBtn lpBtnLocked lpBtnBlock lpBtnSm"
                                                    }
                                                >
                                                    {!partProg[3]?.unlocked && <IconLock />}
                                                    {partProg[3]?.watched ? "✓ تم الاختبار" : "افتح الامتحان"}
                                                </button>
                                            </>
                                        ) : (
                                            <div className="lpStepEmpty">لا يوجد امتحان نهائي</div>
                                        )}
                                    </div>
                                </div>
                            </section>
                        );
                    })}
                </div>

                {/* Video Player */}
                {activeVideo && (
                    <div className="lpVideoDock">
                        <div className="lpVideoTop">
                            <div className="lpVideoTitle">مشغل الفيديو</div>

                            <div className="lpVideoTopActions">
                                <button type="button" onClick={() => toggleFullscreen()} title="تكبير" className="lpIconBtn">
                                    <IconFull />
                                </button>
                                <button type="button" onClick={() => setActiveVideo(null)} className="lpIconBtn">
                                    إغلاق
                                </button>
                            </div>
                        </div>

                        <div ref={videoContainerRef} className="lpVideoBox">
                            <div
                                className="lpWatermark"
                                style={{
                                    top: `${watermarkPosition.y}%`,
                                    left: `${watermarkPosition.x}%`,
                                }}
                            >
                                <div className="lpWatermarkInner">
                                    <div>{userData.name}</div>
                                    <small>{userData.phone}</small>
                                </div>
                            </div>

                            <video
                                ref={videoRef}
                                controls
                                autoPlay
                                controlsList="nodownload nofullscreen noremoteplayback"
                                onContextMenu={(e) => e.preventDefault()}
                                onEnded={onVideoEnded}
                                className="lpVideoEl"
                                style={{
                                    height: isFullscreenMode ? "100vh" : "auto",
                                    maxHeight: isFullscreenMode ? "100vh" : 520,
                                }}
                                key={activeVideo.src}
                                onDoubleClick={handleVideoDoubleClick}
                            >
                                <source src={activeVideo.src} type="video/mp4" />
                                المتصفح لا يدعم تشغيل الفيديو.
                            </video>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default Learning;