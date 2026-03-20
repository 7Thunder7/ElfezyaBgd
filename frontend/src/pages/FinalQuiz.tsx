// src/pages/Exams.tsx
import  { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";

type Choice = {
    id: number;
    text: string;
    order?: number;
};

type Question = {
    id: number;
    text: string;
    order?: number;
    choices: Choice[];
};

type Quiz = {
    id: number;
    title: string;
    description?: string;
    time_limit_minutes?: number | null; // null => no timer
    questions: Question[];
};

type SubmitAnswer = {
    question: number;
    choice: number | null;
};

type SubmittedPerQuestion = {
    question: number;
    selected_choice: number | null;
    correct_choice: number | null;
    correct: boolean;
};

type SubmittedResult = {
    score: number;
    total: number;
    per_question?: SubmittedPerQuestion[];
    attempt_id?: number;
};

/** Helper: safely extract `detail` string from unknown JSON response */
function extractDetail(json: unknown): string | null {
    if (json && typeof json === "object" && !Array.isArray(json)) {
        const obj = json as Record<string, unknown>;
        const maybe = obj["detail"];
        if (typeof maybe === "string") return maybe;
    }
    return null;
}

export default function ExamsPage() {
    // try to read param OR query string
    const { quizId: paramQuizId } = useParams<{ quizId?: string }>();
    const location = useLocation();
    const navigate = useNavigate();

    const [quiz, setQuiz] = useState<Quiz | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // answers: questionId -> choiceId
    const [answers, setAnswers] = useState<Record<number, number | null>>({});
    const [submitting, setSubmitting] = useState(false);
    const [submittedResult, setSubmittedResult] = useState<SubmittedResult | null>(null);

    // Timer state (seconds remaining). null => no timer
    const [secondsLeft, setSecondsLeft] = useState<number | null>(null);

    // to prevent double auto-submit
    const [hasAutoSubmitted, setHasAutoSubmitted] = useState(false);

    // derive exam id from param or query
    const query = useMemo(() => new URLSearchParams(location.search), [location.search]);
    const examIdFromQuery = query.get("exam") ?? query.get("quiz") ?? query.get("quizId") ?? null;
    const examIdToUse = paramQuizId ?? examIdFromQuery; // string | null

    useEffect(() => {
        if (!examIdToUse) {
            setError("معرف الامتحان غير موجود في المسار أو في الـ query string (مثال: ?exam=123).");
            setLoading(false);
            return;
        }

        setLoading(true);
        setError(null);

        void (async () => {
            try {
                // use examIdToUse directly (string); backend may accept slug or id
                const res = await fetch(`/api/exams/${encodeURIComponent(examIdToUse)}/`, {
                    credentials: "include",
                });
                const json = await res.json().catch(() => null);

                if (!res.ok) {
                    const detail = extractDetail(json) ?? `HTTP ${res.status}`;
                    throw new Error(detail);
                }

                const data = json as Quiz;
                setQuiz(data);

                // init answers as null
                const initial: Record<number, number | null> = {};
                data.questions.forEach((q) => (initial[q.id] = null));
                setAnswers(initial);

                // set timer from backend value (minutes -> seconds)
                if (data.time_limit_minutes && data.time_limit_minutes > 0) {
                    setSecondsLeft(Math.max(1, Math.floor(data.time_limit_minutes * 60)));
                } else {
                    setSecondsLeft(null);
                }
            } catch (err: unknown) {
                // useful log for debugging
                // eslint-disable-next-line no-console
                console.error("Failed to fetch quiz:", err);
                if (err instanceof Error) setError(err.message);
                else setError("فشل جلب بيانات الامتحان.");
            } finally {
                setLoading(false);
            }
        })();
    }, [examIdToUse]); // re-run if param or query changes

    // start countdown interval
    useEffect(() => {
        if (secondsLeft === null) return;

        const interval = setInterval(() => {
            setSecondsLeft((s) => {
                if (s === null) return null;
                if (s <= 1) {
                    clearInterval(interval);
                    return 0;
                }
                return s - 1;
            });
        }, 1000);

        return () => clearInterval(interval);
    }, [secondsLeft]);

    // auto-submit when time is up
    useEffect(() => {
        if (secondsLeft === 0 && !hasAutoSubmitted && !submittedResult) {
            setHasAutoSubmitted(true);
            void handleSubmit(true);
        }
    }, [secondsLeft, hasAutoSubmitted, submittedResult]);

    // warn on leaving page (so student doesn't accidentally close)
    useEffect(() => {
        const onBeforeUnload = (e: BeforeUnloadEvent) => {
            if (!submittedResult && Object.values(answers).some((v) => v !== null)) {
                e.preventDefault();
                e.returnValue = ""; // standard
            }
        };
        window.addEventListener("beforeunload", onBeforeUnload);
        return () => window.removeEventListener("beforeunload", onBeforeUnload);
    }, [answers, submittedResult]);

    const handleSelect = (questionId: number, choiceId: number) => {
        if (submittedResult) return; // locked
        setAnswers((prev) => ({ ...prev, [questionId]: choiceId }));
    };

    const answeredCount = useMemo(
        () => Object.values(answers).filter((v) => v !== null).length,
        [answers]
    );

    async function handleSubmit(isAuto = false) {
        if (!quiz || !examIdToUse) return;
        if (submitting) return;
        setSubmitting(true);

        // prepare payload
        const payload = {
            started_at: null as string | null,
            ended_at: new Date().toISOString(),
            elapsed_seconds:
                quiz.time_limit_minutes && secondsLeft !== null
                    ? Math.round(quiz.time_limit_minutes * 60 - (secondsLeft ?? 0))
                    : null,
            answers: Object.entries(answers).map(([q, choice]) => ({
                question: Number(q),
                choice: choice,
            })) as SubmitAnswer[],
            auto: isAuto,
        };

        try {
            const res = await fetch(`/api/exams/${encodeURIComponent(String(examIdToUse))}/submit/`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify(payload),
            });

            const json = await res.json().catch(() => null);

            if (!res.ok) {
                const detail = extractDetail(json) ?? `HTTP ${res.status}`;
                throw new Error(detail);
            }

            const data = json as SubmittedResult;
            setSubmittedResult(data);
            setSecondsLeft(null);
        } catch (err: unknown) {
            // eslint-disable-next-line no-console
            console.error("Submit failed:", err);
            if (err instanceof Error) setError(err.message);
            else setError("حدث خطأ أثناء الإرسال");
        } finally {
            setSubmitting(false);
        }
    }

    function formatTime(seconds: number | null) {
        if (seconds === null) return "--:--";
        const mm = Math.floor(seconds / 60)
            .toString()
            .padStart(2, "0");
        const ss = Math.floor(seconds % 60)
            .toString()
            .padStart(2, "0");
        return `${mm}:${ss}`;
    }

    if (loading)
        return (
            <div className="min-h-screen flex items-center justify-center bg-neutral-900 text-white">
                <div className="text-center">
                    <div className="animate-pulse text-xl">جاري جلب الامتحان...</div>
                </div>
            </div>
        );

    if (error)
        return (
            <div className="min-h-screen flex items-center justify-center bg-neutral-900 text-white p-4">
                <div className="max-w-xl text-center">
                    <h2 className="text-2xl font-semibold mb-2">حدث خطأ</h2>
                    <p className="text-gray-300 mb-4">{error}</p>
                    <button
                        onClick={() => window.location.reload()}
                        className="px-4 py-2 rounded bg-blue-600 hover:bg-blue-700"
                    >
                        حاول مرة أخرى
                    </button>
                </div>
            </div>
        );

    if (!quiz) return null;

    return (
        <div dir="rtl" className="min-h-screen bg-gradient-to-b from-neutral-900 via-slate-900 to-black text-white py-12 px-4 sm:px-8 lg:px-20">
            <div className="max-w-4xl mx-auto space-y-6">
                <header className="flex items-start justify-between gap-4">
                    <div>
                        <h1 className="text-2xl sm:text-3xl font-extrabold">{quiz.title}</h1>
                        {quiz.description && <p className="text-gray-300 mt-1">{quiz.description}</p>}
                        <p className="text-sm text-gray-400 mt-2">الأسئلة: {quiz.questions.length} — مجواب: {answeredCount}</p>
                    </div>

                    <div className="flex flex-col items-end gap-2">
                        <div className="text-sm text-gray-300">الوقت المتبقي</div>
                        <div className="bg-white/6 px-3 py-2 rounded-md font-mono text-lg">
                            {formatTime(secondsLeft)}
                        </div>
                        <div className="text-xs text-gray-400 mt-1">{quiz.time_limit_minutes ? `${quiz.time_limit_minutes} دقيقة` : "بدون حد زمني"}</div>
                    </div>
                </header>

                {/* Questions list */}
                <div className="space-y-4">
                    {quiz.questions.map((q, idx) => (
                        <div key={q.id} className="bg-white/5 rounded-lg p-4">
                            <div className="flex items-center justify-between">
                                <h3 className="font-semibold text-lg">{idx + 1}. {q.text}</h3>
                                <div className="text-sm text-gray-400">سؤال #{q.order ?? q.id}</div>
                            </div>

                            <div className="mt-3 grid gap-3">
                                {q.choices.map((c) => {
                                    const selected = answers[q.id] === c.id;
                                    const disabled = !!submittedResult;
                                    // show correctness after submission
                                    const perQ = submittedResult?.per_question?.find((p) => p.question === q.id);
                                    const isCorrect = perQ?.correct_choice === c.id;
                                    const wasSelected = perQ?.selected_choice === c.id;

                                    return (
                                        <label
                                            key={c.id}
                                            className={`flex items-center gap-3 p-3 rounded-md cursor-pointer transition ${disabled ? "opacity-90" : "hover:bg-white/5"
                                                } ${selected ? "ring-2 ring-blue-500 bg-white/6" : "bg-white/3"}`}
                                        >
                                            <input
                                                type="radio"
                                                name={`q-${q.id}`}
                                                checked={selected}
                                                disabled={disabled}
                                                onChange={() => handleSelect(q.id, c.id)}
                                                className="w-4 h-4 accent-blue-500"
                                            />
                                            <div className="flex-1 text-sm">{c.text}</div>

                                            {/* after submit, show tick/cross */}
                                            {submittedResult && (
                                                <div className="ml-2">
                                                    {isCorrect ? (
                                                        <span className="text-green-400 font-bold">✓</span>
                                                    ) : wasSelected ? (
                                                        <span className="text-red-400 font-bold">✗</span>
                                                    ) : null}
                                                </div>
                                            )}
                                        </label>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </div>

                <div className="flex items-center justify-between gap-4">
                    <div className="text-sm text-gray-300">
                        {submittedResult ? (
                            <div>
                                <div>نتيجتك: <span className="font-semibold text-green-400">{submittedResult.score}/{submittedResult.total}</span></div>
                                <div className="text-xs text-gray-400 mt-1">درجة مئوية: {Math.round((submittedResult.score / Math.max(1, submittedResult.total)) * 100)}%</div>
                            </div>
                        ) : (
                            <div>عند انتهاء الوقت سيتم الإرسال تلقائياً.</div>
                        )}
                    </div>

                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => navigate(-1)}
                            className="px-4 py-2 rounded-md bg-white/6 hover:bg-white/8"
                        >
                            الرجوع
                        </button>

                        {!submittedResult ? (
                            <button
                                onClick={() => void handleSubmit(false)}
                                disabled={submitting}
                                className="px-4 py-2 rounded-md bg-gradient-to-r from-blue-600 to-indigo-600 hover:brightness-110"
                            >
                                {submitting ? "جاري الإرسال..." : "إرسال الإجابات"}
                            </button>
                        ) : (
                            <button
                                onClick={() => {
                                    navigate(-1);
                                }}
                                className="px-4 py-2 rounded-md border border-white/10"
                            >
                                انهاء
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
