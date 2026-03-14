// src/pages/Signup.tsx
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../lib/api";
import axios from "axios";
import "../CSS/Signup.css";
import platformLogo from "../imgs/elfezya bgd.png";

/* ---------------------
   static data
--------------------- */
const governorates = [
  "القاهرة", "الجيزة", "الإسكندرية", "بورسعيد", "الإسماعيلية", "السويس", "دمياط",
  "الدقهلية", "الشرقية", "الغربية", "المنوفية", "كفر الشيخ", "البحيرة", "مطروح",
  "الفيوم", "بني سويف", "المنيا", "قنا", "الأقصر", "أسوان", "سوهاج",
  "أسيوط", "قليوبية", "شمال سيناء", "جنوب سيناء", "البحر الأحمر"
];

/* ---------------------
   Initial form & types
--------------------- */
const initialForm = {
  firstName: "",
  middleName: "",
  lastName: "",
  email: "",
  phone: "",
  nationalId: "",
  gender: "",
  grade: "",
  division: "",
  parentEmail: "",
  parentPhone: "",
  governorate: "",
  parentJob: "",
  password: "",
  confirmPassword: "",
};

type FormState = typeof initialForm;
type GradeOption = { id: string; name: string; slug?: string };

/* ---------------------
   Helpers
--------------------- */
function isRecord(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

function parseAxiosError(err: unknown): string {
  if (axios.isAxiosError(err)) {
    const data = err.response?.data;
    if (!data) return `HTTP ${err.response?.status ?? "??"}`;

    if (typeof data === "string") return data;

    if (typeof data === "object" && data !== null) {
      const obj = data as Record<string, unknown>;
      if (typeof obj.detail === "string") return obj.detail;
      if (typeof obj.message === "string") return obj.message;

      const maybeErrors = (obj.errors ?? obj) as Record<string, unknown> | undefined;
      if (maybeErrors) {
        for (const k of Object.keys(maybeErrors)) {
          const v = maybeErrors[k];
          if (Array.isArray(v) && v.length > 0 && typeof v[0] === "string") return v[0];
          if (typeof v === "string") return v;
        }
      }

      const nfe = obj.non_field_errors;
      if (Array.isArray(nfe) && nfe.length > 0 && typeof nfe[0] === "string") return nfe[0];

      try {
        return JSON.stringify(obj);
      } catch {
        return "خطأ في الاستجابة من الخادم";
      }
    }
  }

  if (err instanceof Error) return err.message;
  try { return String(err); } catch { return "خطأ غير معروف"; }
}

/* ---------------------
   Signup component
--------------------- */
const Signup: React.FC = () => {
  const navigate = useNavigate();

  const [form, setForm] = useState<FormState>(initialForm);
  const [loading, setLoading] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const [grades, setGrades] = useState<GradeOption[]>([]);
  const [gradesLoading, setGradesLoading] = useState(false);
  const [gradesError, setGradesError] = useState<string | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setForm((p) => ({ ...p, [name]: value } as FormState));
  };

  /* -----------------------------
     fetch grades (multi-endpoint)
  ------------------------------ */
  useEffect(() => {
    let mounted = true;

    (async () => {
      setGradesLoading(true);
      setGradesError(null);

      const candidates = [
        "/api/grades/",
        "/api/study/grades/",
        "/api/grades",
        "/api/study/grades",
      ];

      let fetched: unknown = null;

      for (const url of candidates) {
        try {
          const r = await fetch(url, {
            credentials: "include",
            headers: { Accept: "application/json" },
          });
          if (!r.ok) continue;
          fetched = await r.json();
          break;
        } catch {
          // try next silently
        }
      }

      if (!mounted) return;

      try {
        const list: unknown[] = Array.isArray(fetched)
          ? fetched
          : (isRecord(fetched) && Array.isArray((fetched as Record<string, unknown>).results)
            ? ((fetched as Record<string, unknown>).results as unknown[])
            : []);

        const normalized: GradeOption[] = list.map((x) => {
          if (isRecord(x)) {
            const id = String(x.id ?? x.pk ?? Math.random().toString(36).slice(2, 9));
            const name = String(x.name ?? x.title ?? `صف ${id}`);
            const slug = x.slug ? String(x.slug) : undefined;
            return { id, name, slug };
          }
          return { id: String(x), name: String(x) };
        });

        setGrades(normalized);
        if (normalized.length === 0) setGradesError("لا توجد صفوف دراسية متاحة حالياً");
      } catch {
        setGradesError("فشل في جلب الصفوف الدراسية");
      } finally {
        if (mounted) setGradesLoading(false);
      }
    })();

    return () => { mounted = false; };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setServerError(null);

    if (form.password !== form.confirmPassword) {
      setServerError("كلمة المرور وتأكيدها غير متطابقين");
      return;
    }
    if (!form.email || !form.password) {
      setServerError("الرجاء تعبئة البريد الإلكتروني وكلمة المرور");
      return;
    }

    setLoading(true);

    try {
      const payload = {
        first_name: form.firstName.trim(),
        middle_name: form.middleName.trim(),
        last_name: form.lastName.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        national_id: form.nationalId.trim(),
        gender: form.gender,
        grade: form.grade,
        division: form.division,
        parent_email: form.parentEmail.trim(),
        parent_phone: form.parentPhone.trim(),
        governorate: form.governorate,
        parent_job: form.parentJob.trim(),
        password: form.password,
      };

      const res = await api.post("/signup/", payload, { withCredentials: true });

      if (res.status >= 200 && res.status < 300) {
        alert("تم إنشاء الحساب بنجاح. يمكنك الآن تسجيل الدخول.");
        navigate("/login", { replace: true });
        return;
      }

      setServerError(`Unexpected response: ${res.status}`);
    } catch (err: unknown) {
      setServerError(parseAxiosError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="lpSignup" dir="rtl">
      <div className="lpSignup__wrap lpSignup__fade">


        <div className="lpSignup__card">
          <div className="lpSignup__brand">
            <div className="lpSignup__brandHead">
              <div className="lpSignup__logo" aria-hidden="true">
                <img
                  src={platformLogo}
                  alt="Elfezya Bgd"
                  className="lpSignup__logoImg"
                  loading="lazy"
                  draggable={false}
                />
              </div>
              <div>
                <h3 className="lpSignup__brandTitle">Elfezya Bgd</h3>
                <p className="lpSignup__brandSub">
                  أنشئ حسابك وابدأ الدروس والاختبارات فورًا
                </p>
              </div>
            </div>

            <div className="lpSignup__brandCopy">
              <h4>بيانات دقيقة = تفعيل أسرع</h4>
              <p>
                اكتب بيانات الطالب وولي الأمر بشكل صحيح. بعد التسجيل يمكنك تسجيل الدخول ومتابعة الدروس
                وحل الامتحانات بسهولة.
              </p>
            </div>

            <div className="lpSignup__brandActions">
              <button
                type="button"
                className="lpSignup__ghost"
                onClick={() => navigate("/login")}
              >
                لديك حساب؟ تسجيل الدخول
              </button>
            </div>
          </div>

          <div className="lpSignup__panel">

            <div className="lpSignup__panelHead">
              <h2 className="lpSignup__panelTitle">إنشاء حساب الطالب</h2>
              <p className="lpSignup__panelSub">
                املأ بيانات الطالب وولي الأمر بدقة لتفعيل الحساب
              </p>
            </div>
            {serverError && <div className="lpSignup__error">{serverError}</div>}

            <form onSubmit={handleSubmit} className="lpSignup__form">
              {/* الاسم */}
              <div className="lpSignup__row3 lpSignup__field" style={{ ["--delay" as any]: "0ms" }}>
                <div className="lpSignup__fieldInner">
                  <label className="lpSignup__label">الاسم الأول</label>
                  <input
                    name="firstName"
                    value={form.firstName}
                    onChange={handleChange}
                    placeholder="الاسم الأول"
                    className="lpSignup__input"
                  />
                </div>

                <div className="lpSignup__fieldInner">
                  <label className="lpSignup__label">الثاني</label>
                  <input
                    name="middleName"
                    value={form.middleName}
                    onChange={handleChange}
                    placeholder="الاسم الثاني"
                    className="lpSignup__input"
                  />
                </div>

                <div className="lpSignup__fieldInner">
                  <label className="lpSignup__label">الثالث</label>
                  <input
                    name="lastName"
                    value={form.lastName}
                    onChange={handleChange}
                    placeholder="الاسم الثالث"
                    className="lpSignup__input"
                  />
                </div>
              </div>

              {/* صفين */}
              <div className="lpSignup__row2 lpSignup__field" style={{ ["--delay" as any]: "90ms" }}>
                <div className="lpSignup__fieldInner">
                  <label className="lpSignup__label">البريد الإلكتروني</label>
                  <input
                    name="email"
                    value={form.email}
                    onChange={handleChange}
                    placeholder="example@mail.com"
                    className="lpSignup__input"
                    autoComplete="email"
                  />
                </div>

                <div className="lpSignup__fieldInner">
                  <label className="lpSignup__label">رقم الهاتف</label>
                  <input
                    name="phone"
                    value={form.phone}
                    onChange={handleChange}
                    placeholder="01XXXXXXXXX"
                    className="lpSignup__input"
                    autoComplete="tel"
                  />
                </div>
              </div>

              <div className="lpSignup__row2 lpSignup__field" style={{ ["--delay" as any]: "170ms" }}>
                <div className="lpSignup__fieldInner">
                  <label className="lpSignup__label">الرقم القومي</label>
                  <input
                    name="nationalId"
                    value={form.nationalId}
                    onChange={handleChange}
                    placeholder="الرقم القومي"
                    className="lpSignup__input"
                  />
                </div>

                <div className="lpSignup__fieldInner">
                  <label className="lpSignup__label">النوع</label>
                  <select
                    name="gender"
                    value={form.gender}
                    onChange={handleChange}
                    className="lpSignup__input"
                  >
                    <option value="">اختر النوع</option>
                    <option value="male">ذكر</option>
                    <option value="female">أنثى</option>
                  </select>
                </div>
              </div>

              <div className="lpSignup__row2 lpSignup__field" style={{ ["--delay" as any]: "250ms" }}>
                <div className="lpSignup__fieldInner">
                  <label className="lpSignup__label">الصف الدراسي</label>
                  <select
                    name="grade"
                    value={form.grade}
                    onChange={handleChange}
                    className="lpSignup__input"
                  >
                    <option value="">
                      {gradesLoading ? "جاري جلب الصفوف..." : "اختر الصف الدراسي"}
                    </option>
                    {gradesError && <option value="">{gradesError}</option>}
                    {!gradesLoading && !gradesError && grades.map((g) => (
                      <option key={g.id} value={g.slug ?? g.id}>{g.name}</option>
                    ))}
                  </select>
                </div>

                <div className="lpSignup__fieldInner">
                  <label className="lpSignup__label">الشعبة</label>
                  <select
                    name="division"
                    value={form.division}
                    onChange={handleChange}
                    className="lpSignup__input"
                  >
                    <option value="">اختر الشعبة</option>
                    <option value="sci">علمي علوم</option>
                    <option value="sci-math">علمي رياضة</option>
                  </select>
                </div>
              </div>

              <div className="lpSignup__row2 lpSignup__field" style={{ ["--delay" as any]: "330ms" }}>
                <div className="lpSignup__fieldInner">
                  <label className="lpSignup__label">البريد الإلكتروني لولي الأمر</label>
                  <input
                    name="parentEmail"
                    value={form.parentEmail}
                    onChange={handleChange}
                    placeholder="parent@mail.com"
                    className="lpSignup__input"
                    autoComplete="email"
                  />
                </div>

                <div className="lpSignup__fieldInner">
                  <label className="lpSignup__label">رقم هاتف ولي الأمر</label>
                  <input
                    name="parentPhone"
                    value={form.parentPhone}
                    onChange={handleChange}
                    placeholder="01XXXXXXXXX"
                    className="lpSignup__input"
                    autoComplete="tel"
                  />
                </div>
              </div>

              <div className="lpSignup__row2 lpSignup__field" style={{ ["--delay" as any]: "410ms" }}>
                <div className="lpSignup__fieldInner">
                  <label className="lpSignup__label">المحافظة</label>
                  <select
                    name="governorate"
                    value={form.governorate}
                    onChange={handleChange}
                    className="lpSignup__input"
                  >
                    <option value="">اختر المحافظة</option>
                    {governorates.map((g) => <option key={g} value={g}>{g}</option>)}
                  </select>
                </div>

                <div className="lpSignup__fieldInner">
                  <label className="lpSignup__label">مهنة ولي الأمر</label>
                  <input
                    name="parentJob"
                    value={form.parentJob}
                    onChange={handleChange}
                    placeholder="مهنة ولي الأمر"
                    className="lpSignup__input"
                  />
                </div>
              </div>

              <div className="lpSignup__row2 lpSignup__field" style={{ ["--delay" as any]: "490ms" }}>
                <div className="lpSignup__fieldInner">
                  <label className="lpSignup__label">الرقم السري</label>
                  <input
                    name="password"
                    type="password"
                    value={form.password}
                    onChange={handleChange}
                    placeholder="كلمة المرور"
                    className="lpSignup__input"
                    autoComplete="new-password"
                  />
                </div>

                <div className="lpSignup__fieldInner">
                  <label className="lpSignup__label">تأكيد الرقم السري</label>
                  <input
                    name="confirmPassword"
                    type="password"
                    value={form.confirmPassword}
                    onChange={handleChange}
                    placeholder="تأكيد كلمة المرور"
                    className="lpSignup__input"
                    autoComplete="new-password"
                  />
                </div>
              </div>

              <div className="lpSignup__submitRow lpSignup__field" style={{ ["--delay" as any]: "570ms" }}>
                <button type="submit" disabled={loading} className="lpSignup__submit">
                  {loading ? "جاري الإرسال..." : "تسجيل"}
                </button>
              </div>
            </form>
          </div>
        </div>

        <div className="lpSignup__foot">
          <button type="button" className="lpSignup__link" onClick={() => navigate("/login")}>
            الرجوع لتسجيل الدخول
          </button>
        </div>
      </div>
    </div>
  );
};

export default Signup;