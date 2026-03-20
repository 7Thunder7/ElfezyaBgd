// src/pages/review.tsx
import React, { useEffect, useMemo, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { getCurrentUser, logoutUser as apiLogout } from "../lib/auth";
import "../CSS/Review.css";

/* ========== TYPES ========== */
type VideoItem = {
  id: string | number;
  title: string;
  video_link?: string;
  photo_url?: string;
  lesson?: number | string | null;
  grades?: Array<{ id: number; name: string; slug: string }>;
  order?: number;
  created_at: string;
};

type ExamItem = {
  id: string | number;
  title: string;
  description?: string;
  kind?: string;
  lesson?: number | string | null;
  grades?: Array<{ id: number; name: string; slug: string }>;
  order?: number;
  created_at: string;
};

type UserData = {
  name: string;
  phone: string;
};

/* ========== MAIN COMPONENT ========== */
export default function ReviewPage() {
  const navigate = useNavigate();

  // State
  const [videos, setVideos] = useState<VideoItem[]>([]);
  const [exams, setExams] = useState<ExamItem[]>([]);
  const [loadingVideos, setLoadingVideos] = useState<boolean>(true);
  const [loadingExams, setLoadingExams] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [slideIndex, setSlideIndex] = useState(0);
  const [activeVideo, setActiveVideo] = useState<VideoItem | null>(null);
  const [userData, setUserData] = useState<UserData>({ name: "", phone: "" });
  const [isRecording, setIsRecording] = useState(false);
  const [watermarkPosition, setWatermarkPosition] = useState({ x: 50, y: 50 });
  const [isFullscreenMode, setIsFullscreenMode] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const videoContainerRef = useRef<HTMLDivElement>(null);
  const watermarkIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const savedVideoSrcRef = useRef<string | null>(null);

  /* ========== SECURITY: Recording Detection ========== */
  const handleRecordingDetected = () => {
    if (isRecording) return;
    setIsRecording(true);

    // Logout immediately
    try {
      apiLogout();
    } catch (e) {
      console.debug("Logout failed during recording detection", e);
    }

    // Blank the video
    try {
      const v = videoRef.current;
      if (v) {
        savedVideoSrcRef.current =
          v.currentSrc ||
          (v.querySelector &&
            (v.querySelector("source") as HTMLSourceElement)?.src) ||
          null;

        v.pause();

        try {
          const sources = v.querySelectorAll ? v.querySelectorAll("source") : [];
          Array.from(sources).forEach((s) => s.remove());
        } catch {
          /* ignore */
        }

        try {
          v.removeAttribute("src");
          v.load();
        } catch {
          /* ignore */
        }
      }
    } catch (err) {
      console.debug("Video cleanup failed", err);
    }

    // Navigate away
    try {
      navigate("/");
    } catch {
      window.location.href = "/";
    }
  };

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
      console.debug("restore failed", err);
    }
  };

  const closeVideoOnRecording = () => {
    setIsRecording(false);
    setActiveVideo(null);
    savedVideoSrcRef.current = null;
  };

  /* ========== USER DATA ========== */
  useEffect(() => {
    let mounted = true;

    function parseUserToUserData(d: unknown): UserData | null {
      if (!d || typeof d !== "object") return null;
      const rec = d as Record<string, unknown>;
      const maybeUser =
        rec["user"] && typeof rec["user"] === "object"
          ? (rec["user"] as Record<string, unknown>)
          : rec;

      const first = typeof maybeUser["first_name"] === "string" ? maybeUser["first_name"] : "";
      const last = typeof maybeUser["last_name"] === "string" ? maybeUser["last_name"] : "";
      const username = typeof maybeUser["username"] === "string" ? maybeUser["username"] : "";
      const phone =
        typeof maybeUser["phone"] === "string"
          ? maybeUser["phone"]
          : typeof maybeUser["mobile"] === "string"
            ? maybeUser["mobile"]
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
              /* ignore */
            }
          }
        }
      } catch (error) {
        console.error("Error fetching current user:", error);
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  /* ========== RECORDING DETECTION ========== */
  type DisplayMediaFunc = (constraints?: MediaStreamConstraints) => Promise<MediaStream>;

  useEffect(() => {
    let recordingTimeout: NodeJS.Timeout | null = null;
    let originalGetDisplayMedia: DisplayMediaFunc | undefined;

    const detectScreenCapture = () => {
      try {
        const mediaDevices = (navigator as any).mediaDevices;
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
        /* ignore */
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
        (document as any).fullscreenElement ??
        (document as any).webkitFullscreenElement ??
        (document as any).msFullscreenElement ??
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
        const mediaDevices = (navigator as any).mediaDevices;
        if (originalGetDisplayMedia && mediaDevices) {
          mediaDevices.getDisplayMedia = originalGetDisplayMedia;
        }
      } catch {
        /* ignore */
      }
    };
  }, [isRecording, navigate]);

  /* ========== ANIMATED WATERMARK ========== */
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

  /* ========== FULLSCREEN HELPERS ========== */
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
      if (typeof pd.webkitExitFullscreen === "function" && (pd as any).webkitFullscreenElement) {
        await Promise.resolve(pd.webkitExitFullscreen());
        return;
      }
      if (typeof pd.msExitFullscreen === "function" && (pd as any).msFullscreenElement) {
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

  /* ========== FETCH DATA ========== */
  const fetchVideos = async (signal?: AbortSignal) => {
    try {
      setLoadingVideos(true);
      setError(null);

      const res = await fetch("/api/revisions/", {
        signal,
        credentials: "include",
      });

      if (!res.ok) throw new Error(`Videos API error ${res.status}`);

      const data = await res.json();
      const items = Array.isArray(data) ? data : data.results || [];
      setVideos(items);
    } catch (err: any) {
      if (err?.name === "AbortError") return;
      console.error("fetchVideos:", err);
      setError("حدث خطأ أثناء جلب الفيديوهات");
    } finally {
      setLoadingVideos(false);
    }
  };

  const fetchExams = async (signal?: AbortSignal) => {
    try {
      setLoadingExams(true);
      setError(null);

      const res = await fetch("/api/exams/?kind=rev", {
        signal,
        credentials: "include",
      });

      if (!res.ok) throw new Error(`Exams API error ${res.status}`);

      const data = await res.json();
      const items = Array.isArray(data) ? data : data.results || [];
      setExams(items);
    } catch (err: any) {
      if (err?.name === "AbortError") return;
      console.error("fetchExams:", err);
      setError("حدث خطأ أثناء جلب الامتحانات");
    } finally {
      setLoadingExams(false);
    }
  };

  useEffect(() => {
    const controller = new AbortController();

    const doFetch = () => {
      fetchVideos(controller.signal);
      fetchExams(controller.signal);
    };

    doFetch();

    // Polling every 10s
    const POLL_MS = 10000;
    const timer = setInterval(doFetch, POLL_MS);

    return () => {
      controller.abort();
      clearInterval(timer);
    };
  }, []);

  const sortedVideos = useMemo(
    () => [...videos].sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at)),
    [videos]
  );

  const visiblePerView = 3;
  const pageCount = Math.max(1, Math.ceil(sortedVideos.length / visiblePerView));
  const lastIndex = Math.max(0, pageCount - 1);

  const nextSlide = () => setSlideIndex((s) => (s < lastIndex ? s + 1 : 0));
  const prevSlide = () => setSlideIndex((s) => (s > 0 ? s - 1 : lastIndex));

  const handleOpenVideo = (v: VideoItem) => {
    if (v.video_link) setActiveVideo(v);
    else setError("لا يوجد رابط فيديو متاح");
  };

  const handleCloseModal = () => setActiveVideo(null);

  const handleManualRefresh = async () => {
    setError(null);
    await Promise.all([fetchVideos(), fetchExams()]);
  };

  const openExam = (examId: number | string) => {
    navigate(`/exams?exam=${encodeURIComponent(String(examId))}`);
  };

  /* ========== RENDER ========== */
  return (
    <div dir="rtl" className="rvPage">
      {/* Animated background */}
      <div className="rvBg" aria-hidden="true">
        <span className="rvBlob rvBlob--a" />
        <span className="rvBlob rvBlob--b" />
        <span className="rvBlob rvBlob--c" />
        <span className="rvGrid" />
      </div>

      {/* Anti-Recording Overlay */}
      {isRecording && (
        <div className="rvOverlay">
          <div className="rvOverlay__card rvEnter">
            <div className="rvOverlay__icon">⚠️</div>
            <h3 className="rvOverlay__title">تم اكتشاف محاولة تسجيل الشاشة</h3>
            <p className="rvOverlay__text">التسجيل غير مسموح به لحماية المحتوى.</p>

            <div className="rvOverlay__actions">
              <button type="button" onClick={restoreVideoAfterBlock} className="rvBtn rvBtn--ok">
                أعد التشغيل
              </button>
              <button type="button" onClick={closeVideoOnRecording} className="rvBtn rvBtn--danger">
                إغلاق الفيديو
              </button>
            </div>

            <div className="rvOverlay__note">ملاحظة: هذا الحماية تحاول وقف التسجيل داخل المتصفح.</div>
          </div>
        </div>
      )}

      <header className="rvHeader rvEnter">
        <h1 className="rvTitle">يلا بينا نراجع</h1>
        <p className="rvSub">فيديوهات وامتحانات مراجعة شاملة علي مدار السنة</p>
      </header>

      {error && (
        <div className="rvError rvEnter">
          <div className="rvError__pill">{error}</div>
          <button onClick={handleManualRefresh} className="rvBtn rvBtn--ghost rvBtn--sm">
            حاول مرة أخرى
          </button>
        </div>
      )}

      {/* Videos slider */}
      <section className="rvSection rvEnter" style={{ animationDelay: "80ms" }}>
        <div className="rvSection__head">
          <h2 className="rvSection__title">فيديوهات المراجعة</h2>

          <div className="rvSection__actions">
            <button onClick={prevSlide} className="rvIconBtn" aria-label="السابق">
              ‹
            </button>
            <button onClick={nextSlide} className="rvIconBtn" aria-label="التالي">
              ›
            </button>
            <button onClick={handleManualRefresh} className="rvBtn rvBtn--ghost rvBtn--sm">
              تحديث
            </button>
          </div>
        </div>

        <div className="rvPanel">
          {loadingVideos && <div className="rvHint">جاري جلب الفيديوهات…</div>}

          <div className="rvSlider">
            <div
              className="rvTrack"
              style={{
                transform: `translateX(-${slideIndex * 100}%)`,
                width: `${pageCount * 100}%`,
              }}
            >
              {sortedVideos.length === 0 && !loadingVideos ? (
                <div className="rvEmpty">لا توجد فيديوهات حالياً.</div>
              ) : (
                sortedVideos.map((v, idx) => (
                  <article
                    key={v.id}
                    className="rvVidCard rvFloat"
                    style={{ animationDelay: `${120 + idx * 40}ms` }}
                  >
                    <button className="rvThumb" onClick={() => handleOpenVideo(v)} type="button">
                      <img
                        src={v.photo_url || "https://picsum.photos/seed/video/400/240"}
                        alt={v.title}
                        className="rvThumb__img"
                        loading="lazy"
                      />
                      <span className="rvThumb__play" aria-hidden="true">
                        ▶
                      </span>
                    </button>

                    <div className="rvVidCard__body">
                      <h4 className="rvVidCard__title">{v.title}</h4>
                      <div className="rvMeta">أضيف في: {new Date(v.created_at).toLocaleDateString()}</div>
                    </div>
                  </article>
                ))
              )}
            </div>
          </div>

          <div className="rvNote">اضغط على الصورة لتشغيل الفيديو داخل الصفحة. الفيديوهات المضافة حديثًا تظهر أولاً.</div>
        </div>
      </section>

      {/* Exams section */}
      <section className="rvSection rvEnter" style={{ animationDelay: "140ms" }}>
        <div className="rvSection__head">
          <h2 className="rvSection__title">امتحانات المراجعة</h2>
        </div>

        {loadingExams ? (
          <div className="rvHint">جاري جلب الامتحانات…</div>
        ) : exams.length === 0 ? (
          <div className="rvEmpty">لا توجد امتحانات حالياً.</div>
        ) : (
          <div className="rvGridCards">
            {exams.map((ex, idx) => (
              <article key={ex.id} className="rvExamCard rvEnter" style={{ animationDelay: `${180 + idx * 45}ms` }}>
                <div className="rvExamCard__icon" aria-hidden="true">
                  {ex.title.split(" ").slice(0, 2).map((w) => w[0]).join("")}
                </div>

                <div className="rvExamCard__body">
                  <h3 className="rvExamCard__title">{ex.title}</h3>
                  {ex.description && <p className="rvExamCard__desc">{ex.description}</p>}

                  <div className="rvExamCard__foot">
                    <button onClick={() => openExam(ex.id)} className="rvBtn rvBtn--primary rvBtn--sm">
                      ابدأ الامتحان
                    </button>
                    <div className="rvMeta">{new Date(ex.created_at).toLocaleDateString()}</div>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {/* Video Player with watermark */}
      {activeVideo && activeVideo.video_link && (
        <div className="rvPlayer rvEnter" style={{ animationDelay: "120ms" }}>
          <div className="rvPlayer__head">
            <div className="rvPlayer__title">مشغل الفيديو - {activeVideo.title}</div>

            <div className="rvPlayer__actions">
              <button type="button" onClick={() => toggleFullscreen()} title="تكبير" className="rvIconBtn">
                <svg className="rvIco" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path d="M8 3H5a2 2 0 0 0-2 2v3" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M16 21h3a2 2 0 0 0 2-2v-3" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M21 8V5a2 2 0 0 0-2-2h-3" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M3 16v3a2 2 0 0 0 2 2h3" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>

              <button type="button" onClick={handleCloseModal} className="rvBtn rvBtn--ghost rvBtn--sm">
                إغلاق
              </button>
            </div>
          </div>

          <div ref={videoContainerRef} className="rvPlayer__box">
            {/* Animated watermark */}
            <div
              className="rvWatermark"
              style={{
                top: `${watermarkPosition.y}%`,
                left: `${watermarkPosition.x}%`,
              }}
              aria-hidden="true"
            >
              <div className="rvWatermark__text">
                <div className="rvWatermark__name">{userData.name}</div>
                <div className="rvWatermark__phone">{userData.phone}</div>
              </div>
            </div>

            {/* Video Element */}
            <video
              ref={videoRef}
              controls
              autoPlay
              controlsList="nodownload nofullscreen noremoteplayback"
              onContextMenu={(e) => e.preventDefault()}
              className="rvVideo"
              style={{
                height: isFullscreenMode ? "100vh" : "auto",
                maxHeight: isFullscreenMode ? "100vh" : 520,
              }}
              key={activeVideo.video_link}
              onDoubleClick={(e) => {
                e.preventDefault();
                toggleFullscreen();
              }}
            >
              <source src={activeVideo.video_link} type="video/mp4" />
              المتصفح الخاص بك لا يدعم عنصر الفيديو.
            </video>
          </div>
        </div>
      )}

      <footer className="rvFooter rvEnter" style={{ animationDelay: "220ms" }}>
        بالتوفيق — مراجعة سريعة وممتعة ✨
      </footer>
    </div>
  );
}