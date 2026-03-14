// src/pages/Exams.tsx
import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { getAccessToken } from "../lib/auth";
import type { ReactElement } from "react";
import "../CSS/Exams.css";

/**
 * Types matching backend models/serializers
 */
type Choice = {
  id: number;
  text: string;
  order?: number;
  is_correct?: boolean | null;
};

type QuestionAPI = {
  id: number;
  text: string;
  qtype: "mcq_single" | "mcq_multi" | "tf" | "essay" | string;
  marks: number;
  order?: number;
  choices: Choice[];
};

type ExamAPI = {
  id: number | string;
  title?: string;
  description?: string | null;
  duration_minutes?: number | null;
  timer_enabled?: boolean;
  auto_submit_on_expire?: boolean;
  is_published?: boolean;
  questions?: QuestionAPI[];
};

type SingleAnswer = { kind: "single"; selectedChoiceId: number | null };
type MultipleAnswer = { kind: "multiple"; selectedChoiceIds: number[] };
type TextAnswer = { kind: "text"; text: string };
type AnswerState = SingleAnswer | MultipleAnswer | TextAnswer;

type SubmittedResult = {
  attempt_id?: number | string;
  score?: number;
  max_score?: number;
};

function extractDetail(json: unknown): string | null {
  if (json && typeof json === "object" && !Array.isArray(json)) {
    const obj = json as Record<string, unknown>;
    const maybe = obj["detail"] ?? obj["message"] ?? obj["error"];
    if (typeof maybe === "string") return maybe;
  }
  return null;
}

function mapQTypeToKind(qtype: string): "single" | "multiple" | "text" {
  if (qtype === "mcq_multi") return "multiple";
  if (qtype === "essay") return "text";
  return "single";
}

/** read cookie (for CSRF token) */
function getCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const v = document.cookie.match("(^|;)\\s*" + name + "\\s*=\\s*([^;]+)");
  return v ? decodeURIComponent(v[2]) : null;
}

/**
 * Small helper to perform fetches with:
 * - credentials: include (for session cookies)
 * - Authorization header if access token exists (for JWT)
 * - X-CSRFToken header if cookie found
 */
async function authFetch(input: RequestInfo, init?: RequestInit) {
  const baseInit: RequestInit = {
    credentials: "include",
    headers: {
      ...(init && init.headers ? (init.headers as Record<string, string>) : {}),
      "Content-Type":
        (init && init.headers && (init.headers as Record<string, string>)["Content-Type"]) ||
        "application/json",
      Accept: "application/json",
    },
    ...init,
  };

  // Attach Authorization if access token present (JWT flow)
  try {
    const access = getAccessToken();
    if (access) {
      (baseInit.headers as Record<string, string>)["Authorization"] = `Bearer ${access}`;
    }
  } catch {
    // ignore
  }

  // Attach CSRF token if present (session-based flow)
  try {
    const csrf = getCookie("csrftoken");
    if (csrf) {
      (baseInit.headers as Record<string, string>)["X-CSRFToken"] = csrf;
    }
  } catch {
    // ignore
  }

  return fetch(input, baseInit);
}

/**
 * Component
 */
export default function ExamsPage(): ReactElement | null {
  const { quizId: paramQuizId } = useParams<{ quizId?: string }>();
  const location = useLocation();
  const navigate = useNavigate();

  const query = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const examIdFromQuery = query.get("exam") ?? query.get("quiz") ?? query.get("quizId") ?? null;
  const examIdToUse = paramQuizId ?? examIdFromQuery;

  const [exam, setExam] = useState<ExamAPI | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [answers, setAnswers] = useState<Record<number, AnswerState>>({});
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [submittedResult, setSubmittedResult] = useState<SubmittedResult | null>(null);

  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const [hasAutoSubmitted, setHasAutoSubmitted] = useState<boolean>(false);

  const startedAtRef = useRef<string | null>(null);
  const firstInteractRef = useRef<boolean>(false);

  useEffect(() => {
    if (!examIdToUse) {
      setError("معرف الامتحان غير موجود في المسار أو في عنوان الصفحة (query param `exam`).");
      setLoading(false);
      return;
    }

    let mounted = true;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const url = `/api/exams/${encodeURIComponent(String(examIdToUse))}/`;
        const res = await authFetch(url, { method: "GET" });
        const json = await res.json().catch(() => null);

        if (!res.ok) {
          const detail = extractDetail(json) ?? `HTTP ${res.status}`;
          if (res.status === 401 || res.status === 403) {
            throw new Error("يجب تسجيل الدخول لعرض هذا الامتحان.");
          }
          throw new Error(detail);
        }

        if (!mounted) return;
        const data = json as ExamAPI;
        setExam(data);

        const init: Record<number, AnswerState> = {};
        (data.questions ?? []).forEach((q) => {
          const kind = mapQTypeToKind(q.qtype);
          if (kind === "multiple") init[q.id] = { kind: "multiple", selectedChoiceIds: [] };
          else if (kind === "text") init[q.id] = { kind: "text", text: "" };
          else init[q.id] = { kind: "single", selectedChoiceId: null };
        });
        setAnswers(init);

        if (data.duration_minutes && data.timer_enabled !== false) {
          setSecondsLeft(Math.max(0, Math.floor(data.duration_minutes * 60)));
        } else {
          setSecondsLeft(null);
        }
      } catch (err: unknown) {
        console.error("Failed to fetch exam:", err);
        if (err instanceof Error) setError(err.message);
        else setError("فشل جلب بيانات الامتحان.");
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [examIdToUse]);

  useEffect(() => {
    if (secondsLeft === null) return;
    const iv = setInterval(() => {
      setSecondsLeft((s) => {
        if (s === null) return null;
        if (s <= 1) {
          clearInterval(iv);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(iv);
  }, [secondsLeft]);

  useEffect(() => {
    if (secondsLeft === 0 && !hasAutoSubmitted && !submittedResult) {
      setHasAutoSubmitted(true);
      void handleSubmit(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [secondsLeft, hasAutoSubmitted, submittedResult]);

  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (
        !submittedResult &&
        Object.values(answers).some((a) => {
          if (!a) return false;
          if (a.kind === "text") return a.text.trim() !== "";
          if (a.kind === "single") return a.selectedChoiceId !== null;
          if (a.kind === "multiple") return a.selectedChoiceIds.length > 0;
          return false;
        })
      ) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [answers, submittedResult]);

  const markStarted = () => {
    if (!firstInteractRef.current) {
      firstInteractRef.current = true;
      startedAtRef.current = new Date().toISOString();
    }
  };

  const handleSingle = (questionId: number, choiceId: number) => {
    if (submittedResult) return;
    markStarted();
    setAnswers((prev) => ({ ...prev, [questionId]: { kind: "single", selectedChoiceId: choiceId } }));
  };

  const handleMultipleToggle = (questionId: number, choiceId: number) => {
    if (submittedResult) return;
    markStarted();
    setAnswers((prev) => {
      const cur = prev[questionId] as MultipleAnswer | undefined;
      const current = cur?.selectedChoiceIds ?? [];
      const exists = current.some((c) => c === choiceId);
      const next = exists ? current.filter((c) => c !== choiceId) : [...current, choiceId];
      return { ...prev, [questionId]: { kind: "multiple", selectedChoiceIds: next } };
    });
  };

  const handleText = (questionId: number, text: string) => {
    if (submittedResult) return;
    markStarted();
    setAnswers((prev) => ({ ...prev, [questionId]: { kind: "text", text } }));
  };

  const answeredCount = useMemo(() => {
    return Object.values(answers).filter((a) => {
      if (!a) return false;
      if (a.kind === "single") return a.selectedChoiceId !== null;
      if (a.kind === "multiple") return a.selectedChoiceIds.length > 0;
      if (a.kind === "text") return a.text.trim() !== "";
      return false;
    }).length;
  }, [answers]);

  function formatTime(sec: number | null) {
    if (sec === null) return "--:--";
    const mm = Math.floor(sec / 60).toString().padStart(2, "0");
    const ss = Math.floor(sec % 60).toString().padStart(2, "0");
    return `${mm}:${ss}`;
  }

  function buildPayload(isAuto = false) {
    const answersArray = Object.entries(answers).map(([qId, a]) => {
      const q = Number(qId);
      if (!a) return { question: q };
      if (a.kind === "single") {
        return { question: q, selected_choice_id: a.selectedChoiceId ?? null };
      }
      if (a.kind === "multiple") {
        return { question: q, selected_choice_ids: a.selectedChoiceIds };
      }
      return { question: q, text_answer: a.text };
    });
    return { answers: answersArray, auto: isAuto };
  }

  async function handleSubmit(isAuto = false) {
    if (!exam || !examIdToUse) return;
    if (submitting) return;
    setSubmitting(true);
    setError(null);

    try {
      const url = `/api/exams/${encodeURIComponent(String(examIdToUse))}/attempt/`;
      const payload = buildPayload(isAuto);

      const res = await authFetch(url, {
        method: "POST",
        body: JSON.stringify(payload),
        headers: { "Content-Type": "application/json" },
      });

      if (res.status === 401 || res.status === 403) {
        setError("يجب تسجيل الدخول لإرسال الامتحان. سيتم تحويلك إلى صفحة الدخول.");
        setTimeout(() => navigate("/login"), 1200);
        return;
      }

      const json = await res.json().catch(() => null);
      if (!res.ok) {
        const detail = extractDetail(json) ?? `HTTP ${res.status}`;
        throw new Error(detail);
      }

      const data = json as SubmittedResult;
      setSubmittedResult(data);
      setSecondsLeft(null);
    } catch (err: unknown) {
      console.error("Submit failed:", err);
      if (err instanceof Error) setError(err.message);
      else setError("حدث خطأ أثناء إرسال الامتحان.");
    } finally {
      setSubmitting(false);
    }
  }

  // ====== Loading / Error screens (same theme) ======
  if (loading) {
    return (
      <div dir="rtl" className="exPage exPage--screen">
        <div className="exBg" aria-hidden="true">
          <span className="exBlob exBlob--a" />
          <span className="exBlob exBlob--b" />
          <span className="exBlob exBlob--c" />
          <span className="exGrid" />
        </div>

        <div className="exCenter exEnter">
          <div className="exSpinner" aria-hidden="true" />
          <div className="exCenter__text">جاري جلب الامتحان...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div dir="rtl" className="exPage exPage--screen">
        <div className="exBg" aria-hidden="true">
          <span className="exBlob exBlob--a" />
          <span className="exBlob exBlob--b" />
          <span className="exBlob exBlob--c" />
          <span className="exGrid" />
        </div>

        <div className="exCenter exEnter">
          <div className="exErrorCard">
            <h2 className="exErrorCard__title">حدث خطأ</h2>
            <p className="exErrorCard__text">{error}</p>
            <div className="exErrorCard__actions">
              <button onClick={() => window.location.reload()} className="exBtn exBtn--primary">
                حاول مرة أخرى
              </button>
              <button onClick={() => navigate(-1)} className="exBtn exBtn--ghost">
                الرجوع
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!exam) return null;

  return (
    <div dir="rtl" className="exPage">
      {/* Animated background */}
      <div className="exBg" aria-hidden="true">
        <span className="exBlob exBlob--a" />
        <span className="exBlob exBlob--b" />
        <span className="exBlob exBlob--c" />
        <span className="exGrid" />
      </div>

      <div className="exWrap">
        <header className="exHeader exEnter">
          <div className="exHeader__left">
            <h1 className="exTitle">{exam.title}</h1>
            {exam.description && <p className="exDesc">{exam.description}</p>}
            <p className="exMeta">
              الأسئلة: {(exam.questions ?? []).length} — مجواب: {answeredCount}
            </p>
          </div>

          <aside className="exTimer exEnter" style={{ animationDelay: "80ms" }}>
            <div className="exTimer__label">الوقت المتبقي</div>
            <div className="exTimer__time">{formatTime(secondsLeft)}</div>
            <div className="exTimer__hint">
              {exam.duration_minutes ? `${exam.duration_minutes} دقيقة` : "بدون حد زمني"}
            </div>
          </aside>
        </header>

        <section className="exQuestions">
          {(exam.questions ?? []).map((q, idx) => {
            const kind = mapQTypeToKind(q.qtype);
            const cur = answers[q.id];

            return (
              <article
                key={q.id}
                className="exQCard exEnter"
                style={{ animationDelay: `${120 + idx * 35}ms` }}
              >
                <div className="exQCard__head">
                  <h3 className="exQCard__title">
                    {idx + 1}. {q.text}
                  </h3>
                  <div className="exQCard__tag">سؤال #{q.order ?? q.id}</div>
                </div>

                <div className="exQCard__body">
                  {kind === "single" && (
                    <div className="exChoices">
                      {(q.choices ?? []).map((c) => {
                        const selected = !!cur && cur.kind === "single" && cur.selectedChoiceId === c.id;
                        const disabled = !!submittedResult;
                        const cls =
                          "exChoice" +
                          (selected ? " exChoice--selected" : "") +
                          (disabled ? " exChoice--disabled" : "");

                        return (
                          <label key={c.id} className={cls}>
                            <input
                              type="radio"
                              name={`q-${q.id}`}
                              checked={selected}
                              disabled={disabled}
                              onChange={() => handleSingle(q.id, c.id)}
                              className="exChoice__input"
                            />
                            <span className="exChoice__text">{c.text}</span>
                          </label>
                        );
                      })}

                      {(!q.choices || q.choices.length === 0) && (
                        <div className="exEmptyMini">لا توجد خيارات مُوفّرة لهذا السؤال.</div>
                      )}
                    </div>
                  )}

                  {kind === "multiple" && (
                    <div className="exChoices">
                      {(q.choices ?? []).map((c) => {
                        const selected =
                          !!cur && cur.kind === "multiple" && cur.selectedChoiceIds.some((id) => id === c.id);
                        const disabled = !!submittedResult;
                        const cls =
                          "exChoice" +
                          (selected ? " exChoice--selected" : "") +
                          (disabled ? " exChoice--disabled" : "");

                        return (
                          <label key={c.id} className={cls}>
                            <input
                              type="checkbox"
                              checked={selected}
                              disabled={disabled}
                              onChange={() => handleMultipleToggle(q.id, c.id)}
                              className="exChoice__input"
                            />
                            <span className="exChoice__text">{c.text}</span>
                          </label>
                        );
                      })}

                      {(!q.choices || q.choices.length === 0) && (
                        <div className="exEmptyMini">لا توجد خيارات لهذا السؤال.</div>
                      )}
                    </div>
                  )}

                  {kind === "text" && (
                    <div className="exTextWrap">
                      <textarea
                        placeholder="اكتب إجابتك هنا..."
                        value={cur && cur.kind === "text" ? cur.text : ""}
                        onChange={(e) => handleText(q.id, e.target.value)}
                        rows={6}
                        className="exTextarea"
                        disabled={!!submittedResult}
                      />
                    </div>
                  )}
                </div>
              </article>
            );
          })}
        </section>

        <footer className="exFoot exEnter" style={{ animationDelay: "120ms" }}>
          <div className="exFoot__left">
            {submittedResult ? (
              <div className="exResult">
                <div>
                  نتيجتك:{" "}
                  <span className="exResult__score">
                    {submittedResult.score ?? 0}/{submittedResult.max_score ?? 0}
                  </span>
                </div>
                <div className="exResult__pct">
                  درجة مئوية:{" "}
                  {Math.round(
                    ((submittedResult.score ?? 0) / Math.max(1, submittedResult.max_score ?? 1)) * 100
                  )}
                  %
                </div>
              </div>
            ) : (
              <div className="exHint">عند انتهاء الوقت سيتم الإرسال تلقائيًا (إن كان مفعّلًا).</div>
            )}
          </div>

          <div className="exFoot__actions">
            <button onClick={() => navigate(-1)} className="exBtn exBtn--ghost">
              الرجوع
            </button>

            {!submittedResult ? (
              <button
                onClick={() => void handleSubmit(false)}
                disabled={submitting}
                className="exBtn exBtn--primary"
              >
                {submitting ? "جاري الإرسال..." : "إرسال الإجابات"}
              </button>
            ) : (
              <button onClick={() => navigate(-1)} className="exBtn exBtn--ghost">
                انهاء
              </button>
            )}
          </div>
        </footer>
      </div>
    </div>
  );
}