// src/pages/LandingPage.tsx

import React, { useState, useEffect } from "react";
import Ticker from "../components/Ticker";
import "./LandingHero.css";
import api from "../lib/api";
import teacherImg from "../imgs/Layer 7.png";
import y3Img from "../imgs/y3.jpg";
import h1Img from "../imgs/h1.jpg";
import h2Img from "../imgs/h2.jpg";
import h3Img from "../imgs/h3.jpg";
import { Link } from "react-router-dom";
import platformLogo from "../imgs/elfezya bgd.png";
import FeaturesOrbit from "../components/FeaturesOrbit";
import type { FeatureItem } from "../components/FeaturesOrbit";
import { createPortal } from "react-dom";
import "./LandingBooks.css";
import "./FloatingWhatsApp.css";
// ========== Types ==========

type GradeCardStatus = "available" | "soon";

interface GradeCard {
  title: string;
  description: string;
  href: string;
  image: string;
  status: GradeCardStatus;
  statusLabel: string;
}

const gradeCards: GradeCard[] = [
  {
    title: "الصف الثالث الاعدادي",
    description: "اشترك وتعرف علي المنهج",
    href: "/signup",
    image: y3Img,
    status: "available",
    statusLabel: "Available",
  },
  {
    title: "الصف الاول الثانوي",
    description: "اشترك وتعرف علي المنهج",
    href: "/signup",
    image: h1Img,
    status: "soon",
    statusLabel: "Coming soon",
  },
  {
    title: "الصف الثاني الثانوي",
    description: "اشترك وتعرف علي المنهج",
    href: "/signup",
    image: h2Img,
    status: "available",
    statusLabel: "Available",
  },
  {
    title: "الصف الثالث الثانوي",
    description: "اشترك وتعرف علي المنهج",
    href: "/signup",
    image: h3Img,
    status: "available",
    statusLabel: "Available",
  },
];

interface Grade {
  id: number;
  name: string;
  slug: string;
}

interface TopStudent {
  id: number;
  title: string;
  year: number;
  image: string;
  image_url: string | null;
  description: string | null;
  order: number;
  created_at: string;
}

interface News {
  id: number;
  title: string;
  excerpt: string;
  content: string | null;
  image: string;
  image_url: string | null;
  date: string;
  link: string | null;
  order: number;
  created_at: string;
}
const WHATSAPP_NUMBER = "2001208987589";
const WHATSAPP_TEXT = "مرحباً، أحتاج مساعدة في المنصة";

const waHref = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(WHATSAPP_TEXT)}`;


interface Package {
  id: number;
  title: string;
  duration_type: "month" | "term" | "year";
  duration_display: string;
  price: string;
  description: string | null;
  features: string[];
  is_popular: boolean;
  grades: Grade[];
  order: number;
  created_at: string;
}

interface Book {
  id: number;
  title: string;
  description: string | null;
  cover_image: string;
  cover_url: string | null;
  pdf_file: string | null;
  pdf_url: string | null;
  external_link: string | null;
  price: string;
  is_free: boolean;
  grades: Grade[];
  term: string | null;
  order: number;
  created_at: string;
}

interface LandingData {
  top_students: TopStudent[];
  news: News[];
  packages: Package[];
  books: Book[];
}


const physicists = [
  "Isaac Newton",
  "Albert Einstein",
  "Galileo Galilei",
  "James Clerk Maxwell",
  "Niels Bohr",
  "Marie Curie",
  "Michael Faraday",
  "Richard Feynman",
  "Paul Dirac",
  "Erwin Schrödinger",
];




const LandingPage: React.FC = () => {
  const [data, setData] = useState<LandingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newsIndex, setNewsIndex] = useState(0);
  const [currentBookIndex, setCurrentBookIndex] = useState(0);
  const [selectedBook, setSelectedBook] = useState<Book | null>(null);

  const booksPerPage = 4;

  useEffect(() => {
    const fetchLandingData = async () => {
      try {
        setLoading(true);
        setError(null);

        // Fetch all landing data in one call
        const response = await api.get<LandingData>("/landing/data/");
        setData(response.data);
      } catch (err) {
        console.error("Failed to fetch landing data:", err);
        setError("فشل تحميل البيانات. يرجى المحاولة مرة أخرى.");
      } finally {
        setLoading(false);
      }
    };

    fetchLandingData();
  }, []);

  useEffect(() => {
    // سكوب على سكشن الأخبار فقط
    const root = document.getElementById("news");
    if (!root) return;

    const targets = Array.from(root.querySelectorAll<HTMLElement>("[data-news-reveal]"));

    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) (e.target as HTMLElement).classList.add("is-in");
        });
      },
      { threshold: 0.18 }
    );

    targets.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [data?.news?.length]);


  useEffect(() => {
    const root = document.getElementById("packages");
    if (!root) return;

    const targets = Array.from(root.querySelectorAll<HTMLElement>("[data-pkg-reveal]"));

    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) (e.target as HTMLElement).classList.add("is-in");
        });
      },
      { threshold: 0.18 }
    );

    targets.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [data?.packages?.length]);

  const features: FeatureItem[] = [
    {
      key: "support",
      title: "دعم مستمر",
      desc: "رد سريع على أسئلة الطالب ومتابعة خطوة بخطوة.",
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
          <path
            d="M4 18v-6a8 8 0 1 1 16 0v6"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <path
            d="M4 18a2 2 0 0 0 2 2h1v-6H6a2 2 0 0 0-2 2Z"
            stroke="currentColor"
            strokeWidth="2"
          />
          <path
            d="M20 18a2 2 0 0 1-2 2h-1v-6h1a2 2 0 0 1 2 2Z"
            stroke="currentColor"
            strokeWidth="2"
          />
        </svg>
      ),
    },
    {
      key: "organized",
      title: "محتوى منظم",
      desc: "مسار واضح: شرح → أمثلة → تدريب → امتحان.",
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
          <path
            d="M4 19V6a2 2 0 0 1 2-2h11l3 3v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2Z"
            stroke="currentColor"
            strokeWidth="2"
          />
          <path
            d="M8 12h8M8 16h8M8 8h5"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
      ),
    },
    {
      key: "easyui",
      title: "واجهة مستخدم سهلة",
      desc: "تجربة استخدام بسيطة وسريعة على كل الأجهزة.",
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
          <path d="M7 7h10v10H7z" stroke="currentColor" strokeWidth="2" />
          <path
            d="M4 12h3M17 12h3M12 4v3M12 17v3"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
      ),
    },
    {
      key: "videos",
      title: "فيديوهات عالية الجودة",
      desc: "شرح واضح وصورة وصوت بجودة ممتازة.",
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
          <path
            d="M4 7h12a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H4z"
            stroke="currentColor"
            strokeWidth="2"
          />
          <path
            d="M18 10l2-1v6l-2-1v-4Z"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinejoin="round"
          />
        </svg>
      ),
    },
    {
      key: "quizzes",
      title: "اختبارات تفاعلية",
      desc: "أسئلة تدريجية بعد كل درس لقياس مستواك.",
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
          <path d="M7 3h10v18H7z" stroke="currentColor" strokeWidth="2" />
          <path
            d="M9 7h6M9 11h6M9 15h4"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
      ),
    },
  ];

  // Books carousel navigation
  const nextBooks = () => {
    if (!data?.books) return;
    setCurrentBookIndex((prev) =>
      prev + booksPerPage < data.books.length ? prev + booksPerPage : 0
    );
  };

  const prevBooks = () => {
    if (!data?.books) return;
    setCurrentBookIndex((prev) =>
      prev - booksPerPage >= 0 ? prev - booksPerPage : data.books.length - booksPerPage
    );
  };

  // Format date to Arabic
  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString("ar-EG", {
        year: "numeric",
        month: "long",
        day: "numeric",
      });
    } catch {
      return dateString;
    }
  };


  

  // ========== Loading State ==========
  if (loading) {
    return (
      <div className="bg-white dark:bg-black min-h-screen w-full flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">جاري التحميل...</p>
        </div>
      </div>
    );
  }

  // ========== Error State ==========
  if (error) {
    return (
      <div className="bg-white dark:bg-black min-h-screen w-full flex items-center justify-center">
        <div className="text-center p-8">
          <div className="text-red-500 text-6xl mb-4">⚠️</div>
          <h2 className="text-2xl font-bold text-gray-800 dark:text-white mb-2">
            حدث خطأ
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-4">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
          >
            إعادة المحاولة
          </button>
        </div>
      </div>
    );
  }

  // ========== No Data State ==========
  if (!data) {
    return (
      <div className="bg-white dark:bg-black min-h-screen w-full flex items-center justify-center">
        <p className="text-gray-600 dark:text-gray-400">لا توجد بيانات لعرضها</p>
      </div>
    );
  }

  return (
    <div className="landingPage">
      <div className="landingPage__bg" aria-hidden="true">
        <span className="lpBlob lpBlob--a" />
        <span className="lpBlob lpBlob--b" />
        <span className="lpGrid" />
        <span className="lpNoise" />
        <span className="lpGlow" />
      </div>


      {/*Landing Section */}

      <section className="hero" aria-label="Landing Section">
        <div className="hero__bg" aria-hidden="true">
          <span className="blob blob--a" />
          <span className="blob blob--b" />
          <span className="grid" />
          <span className="scanline" />
        </div>

        {/* Floating physics shapes */}
        <div className="fx" aria-hidden="true">
          <span className="atom atom--1" />
          <span className="atom atom--2" />
          <span className="wave wave--1" />
          <span className="wave wave--2" />
          <span className="eq eq--1">E = mc²</span>
          <span className="eq eq--2">F = ma</span>
          <span className="eq eq--3">V = IR</span>
          <span className="particle p1" />
          <span className="particle p2" />
          <span className="particle p3" />
          <span className="particle p4" />
        </div>

        <div className="hero__wrap">
          {/* Text */}
          <div className="hero__content">
            <div className="pill">
              <span className="pill__dot" />
              <span>منصة فيزياء — شرح + تدريب + متابعة</span>
            </div>

            <h1 className="hero__title">
              أهلاً بيك في{" "}
              <span className="grad">
                منصة مستر <span className="nameBlue">زكريا هارون</span>
              </span>
            </h1>

            <p className="hero__subtitle">
              اتعلم الفيزياء بأسلوب حديث: تبسيط للفكرة + تطبيق مباشر + مسائل متدرجة لحد
              الاحتراف. كل درس مصمم علشان “تفهم” مش تحفظ.
            </p>

            <div className="hero__cta">
              <a className="btn btn--primary" href="#courses">
                ابدأ الكورس الآن
              </a>
              <a className="btn btn--ghost" href="#intro">
                شاهد المقدمة
              </a>
            </div>

            <div className="hero__stats">
              <div className="stat">
                <span className="stat__num">+100</span>
                <span className="stat__label">درس ومسألة</span>
              </div>
              <div className="stat">
                <span className="stat__num">نظام</span>
                <span className="stat__label">مذاكرة متكامل</span>
              </div>
              <div className="stat">
                <span className="stat__num">متابعة</span>
                <span className="stat__label">واجبات وتقييم</span>
              </div>
            </div>
          </div>

          {/* Image */}
          <div className="hero__media" aria-label="صورة المدرس">
            <div className="mediaCard">
              <img className="mediaCard__img" src={teacherImg} alt="مستر زكريا هارون" />
              <div className="mediaCard__overlay" />
              <div className="mediaCard__badge">
                <span className="badge__icon">⚡</span>
                <span className="badge__text">
                  مستر زكريا هارون <small>Physics Teacher</small>
                </span>
              </div>

              {/* orbit rings */}
              <div className="orbits" aria-hidden="true">
                <span className="orbit o1" />
                <span className="orbit o2" />
                <span className="orbit o3" />
                <span className="dot d1" />
                <span className="dot d2" />
                <span className="dot d3" />
              </div>
            </div>
          </div>
        </div>
      </section>

     <div className="max-w-screen mx-auto mt-6 px-4 sm:px-8 lpTickerWrap">
  <Ticker items={physicists} speed={18} pauseOnHover={true} title="Great Physicists" />
</div>

      {/* [بندرس مين؟] */}
      <section id="grades" className="lpSection--grades" aria-label="بندرس مين؟">
        <div className="lpSection__inner">
          <header className="lpHead">
            <h2 className="lpTitle">بندرس مين؟</h2>
            <p className="lpSubTitle">الصفوف اللي بنشرحها على المنصة</p>
            <div className="lpDivider" aria-hidden="true" />
          </header>

          <div className="lpGradesGrid" role="list">
            {gradeCards.map((card, idx) => {
              const isSoon = card.status === "soon";
              const hue = Math.round((360 / Math.max(gradeCards.length, 1)) * idx);

              return (
                <Link
                  key={card.title}
                  to={card.href}
                  onClick={(e) => { if (isSoon) e.preventDefault(); }}
                  className={`lpGradeCard ${isSoon ? "isSoon" : ""}`}
                  role="listitem"
                  aria-label={card.title}
                  aria-disabled={isSoon}
                  tabIndex={isSoon ? -1 : 0}
                  style={{ ["--h" as any]: hue } as React.CSSProperties}
                >
                  <div className="lpGradeMedia">
                    <img className="lpGradeImg" src={card.image} alt={card.title} loading="lazy" />
                    <span className="lpGradeOverlay" aria-hidden="true" />
                    <span className={`lpBadge ${isSoon ? "lpBadge--soon" : "lpBadge--ok"}`}>
                      {card.statusLabel}
                    </span>
                  </div>

                  <div className="lpGradeBody">
                    <h3 className="lpGradeTitle">{card.title}</h3>
                    <p className="lpGradeText">{card.description}</p>

                    <div className="lpGradeFooter">
                      <span className="lpGradeLink">{isSoon ? "قريباً" : "اشترك الآن"}</span>
                      <span className={`lpGradeCta ${isSoon ? "isDisabled" : ""}`} aria-hidden="true">→</span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </section>
      {/* <!-- End Card Blog --> */}

      {data.top_students && data.top_students.length > 0 && (
        <section className="lpTopStudents">
          <div className="lpTopStudents__head">
            <h2 className="lpTopStudents__title">
              {data.top_students[0]?.title || "أوائل ثانوية عامة"}
            </h2>
            <p className="lpTopStudents__sub">
              {data.top_students[0]?.year ? `Heroes ${data.top_students[0].year}` : ""}
            </p>
          </div>

          <div className="lpTopStudents__mediaWrap">
            <div className="lpTopStudents__media">
              <img
                src={data.top_students[0].image_url || data.top_students[0].image}
                alt={data.top_students[0].title}
                className="lpTopStudents__img"
                loading="lazy"
              />
            </div>
          </div>
        </section>
      )}

      {/*المميزات */}
      <FeaturesOrbit
        centerImg={platformLogo}
        title="مميزات الموقع"
        subtitle="منصة متكاملة لتعلّم الفيزياء — أدوات، فيديوهات، اختبارات ودعم متواصل."

        items={features}
      />
      {/*المميزات نهاية*/}

      {/* ========== News Section ========== */}
      {data.news && data.news.length > 0 && (
        <section className="lpNews" id="news" dir="rtl">
          <div className="lpNews__head" data-news-reveal style={{ ["--d" as any]: "0ms" }}>
            <h2 className="lpNews__title">الأخبار</h2>
            <p className="lpNews__sub">تابع آخر الإعلانات والفعاليات والمحتوى الجديد</p>
            <div className="lpDivider" aria-hidden="true" />
          </div>

          {/* ✅ مسافة أكبر بين العنوان والبوكس */}
          <div className="lpNews__wrap" data-news-reveal style={{ ["--d" as any]: "140ms" }}>
            <div
              className="lpNews__panel"
              style={
                {
                  ["--p" as any]: `${((newsIndex + 1) / data.news.length) * 100}%`,
                } as React.CSSProperties
              }
            >
              <div className="lpNews__top">
                <div className="lpNews__meta">
                  <span className="lpNews__count">
                    {newsIndex + 1}/{data.news.length}
                  </span>
                </div>

                <div className="lpNews__controls">
                  <button
                    type="button"
                    onClick={() => setNewsIndex((p) => (p - 1 + data.news.length) % data.news.length)}
                    className="lpNewsBtn"
                    aria-label="السابق"
                    title="السابق"
                  >
                    ›
                  </button>

                  <button
                    type="button"
                    onClick={() => setNewsIndex((p) => (p + 1) % data.news.length)}
                    className="lpNewsBtn"
                    aria-label="التالي"
                    title="التالي"
                  >
                    ‹
                  </button>
                </div>
              </div>
              <div className="lpNews__progress" aria-hidden="true" />

              {/* ✅ key عشان انيميشن تبديل الخبر يشتغل مع كل تغيير */}
              <article key={data.news[newsIndex].id} className="lpNewsCard lpNewsCard--swap">
                <div className="lpNewsCard__grid">
                  {/* المحتوى */}
                  <div className="lpNewsCard__content">
                    <h3 className="lpNewsCard__headline">{data.news[newsIndex].title}</h3>

                    <div className="lpNewsCard__date">{formatDate(data.news[newsIndex].date)}</div>

                    <p className="lpNewsCard__excerpt line-clamp-3">{data.news[newsIndex].excerpt}</p>

                    <div className="lpNewsCard__footer">
                      {data.news[newsIndex].link && (
                        <a
                          href={data.news[newsIndex].link!}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="lpNewsCard__link"
                        >
                          اقرأ المزيد <span aria-hidden="true">←</span>
                        </a>
                      )}

                      <div className="lpNewsDots" aria-label="التنقل بين الأخبار">
                        {data.news.map((_, i) => (
                          <button
                            key={i}
                            onClick={() => setNewsIndex(i)}
                            aria-label={`انتقال إلى خبر ${i + 1}`}
                            className={`lpNewsDot ${i === newsIndex ? "isActive" : ""}`}
                          />
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* الصورة (يمين لأننا عاملين الأعمدة 1fr + عمود للصورة) */}
                  <div className="lpNewsCard__media">
                    <img
                      src={data.news[newsIndex].image_url || data.news[newsIndex].image}
                      alt={data.news[newsIndex].title}
                      className="lpNewsCard__img"
                      loading="lazy"
                    />
                    <span className="lpNewsCard__mediaGlow" aria-hidden="true" />
                  </div>
                </div>
              </article>
            </div>
          </div>
        </section>
      )}

      {/* ========== Packages Section ========== */}
      {data.packages && data.packages.length > 0 && (
        <section className="lpPackages" id="packages" dir="rtl">
          <div className="lpPackages__head" data-pkg-reveal style={{ ["--d" as any]: "0ms" }}>
            <h2 className="lpPackages__title">الباقات</h2>
            <p className="lpPackages__sub">اختر الباقة التي تناسبك وابدأ التعلم معنا</p>
            <div className="lpDivider" aria-hidden="true" />
          </div>

          <div className="lpPackages__wrap" data-pkg-reveal style={{ ["--d" as any]: "120ms" }}>
            <div className="lpPackagesGrid" role="list">
              {data.packages
                .slice()
                .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
                .map((pkg) => (
                  <article
                    key={pkg.id}
                    className={`lpPkgCard ${pkg.is_popular ? "isPopular" : ""}`}
                    role="listitem"
                    data-pkg-reveal
                    style={{ ["--d" as any]: "220ms" }}
                  >
                    {pkg.is_popular && (
                      <div className="lpPkgBadge" aria-label="الأكثر شعبية">
                        <span className="lpPkgBadge__icon" aria-hidden="true">★</span>
                        الأكثر شعبية
                      </div>
                    )}

                    <h3 className="lpPkgName">{pkg.title}</h3>

                    <div className="lpPkgPrice">
                      <span className="lpPkgCurrency">جنيه</span>
                      <span className="lpPkgAmount">{pkg.price}</span>
                    </div>

                    <div className="lpPkgMeta">
                      {pkg.description || `احصل على كامل خدمات المنصة لمدة ${pkg.duration_display}`}
                    </div>

                    {/* (اختياري) عرض الصفوف */}
                    {pkg.grades && pkg.grades.length > 0 && (
                      <div className="lpPkgGrades" aria-label="الصفوف">
                        {pkg.grades.slice(0, 3).map((g) => (
                          <span key={g.id} className="lpPkgChip">
                            {g.name}
                          </span>
                        ))}
                        {pkg.grades.length > 3 && (
                          <span className="lpPkgChip lpPkgChip--muted">+{pkg.grades.length - 3}</span>
                        )}
                      </div>
                    )}

                    <ul className="lpPkgFeatures">
                      {(pkg.features ?? []).map((feature, idx) => (
                        <li key={idx} className="lpPkgFeature">
                          <span className="lpPkgCheck" aria-hidden="true">
                            {/* نفس CheckIcon بتاعك لكن بلون متناسق */}
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              width="18"
                              height="18"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2.4"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            >
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
                          </span>
                          <span className="lpPkgFeatureText">{feature}</span>
                        </li>
                      ))}
                    </ul>

                    <a
                      href="#"
                      className={`lpPkgBtn ${pkg.is_popular ? "lpPkgBtn--primary" : "lpPkgBtn--ghost"}`}
                    >
                      اشتراك
                      <span aria-hidden="true">←</span>
                    </a>
                  </article>
                ))}
            </div>
          </div>
        </section>
      )}

      {/* ========== Books Section (Premium + Light/Dark + RTL) ========== */}




      {/* ========== Books Section (Pro + Light/Dark + RTL) ========== */}
      {data.books && data.books.length > 0 && (() => {
        const page = Math.floor(currentBookIndex / booksPerPage);
        const pageCount = Math.ceil(data.books.length / booksPerPage);
        const canPrev = page > 0;
        const canNext = page < pageCount - 1;

        return (
          <section id="books" className="lpBooks" dir="rtl" aria-label="الكتب">
            <header className="lpBooks__head">
              <h2 className="lpBooks__title">الكتب</h2>
              <p className="lpBooks__sub">مجموعة شاملة من الكتب الدراسية المتاحة</p>
              <div className="lpDivider" aria-hidden="true" />
            </header>

            <div className="lpBooks__wrap">
              <div className="lpBooks__panel">
                <div className="lpBooks__top">
                  <span className="lpBooks__count">
                    {page + 1}/{pageCount}
                  </span>

                  {pageCount > 1 && (
                    <div className="lpBooks__controls">
                      <button
                        type="button"
                        className="lpBooksBtn"
                        onClick={prevBooks}
                        disabled={!canPrev}
                        aria-label="المجموعة السابقة"
                        title="المجموعة السابقة"
                      >
                        ❯
                      </button>
                      <button
                        type="button"
                        className="lpBooksBtn"
                        onClick={nextBooks}
                        disabled={!canNext}
                        aria-label="المجموعة التالية"
                        title="المجموعة التالية"
                      >
                        ❮
                      </button>
                    </div>
                  )}
                </div>

                {/* viewport (LTR) عشان translate يفضل ثابت */}
                <div className="lpBooks__viewport" dir="ltr">
                  <div
                    className="lpBooks__track"
                    style={{ ["--page" as any]: page } as React.CSSProperties}
                  >
                    {Array.from({ length: pageCount }).map((_, pageIdx) => {
                      const slice = data.books.slice(
                        pageIdx * booksPerPage,
                        (pageIdx + 1) * booksPerPage
                      );

                      return (
                        <div key={pageIdx} className="lpBooks__page" dir="rtl">
                          <div className="lpBooksGrid">
                            {slice.map((book) => {
                              const cover = book.cover_url || book.cover_image;
                              const isFree = !!book.is_free;

                              return (
                                <button
                                  key={book.id}
                                  type="button"
                                  className="lpBookCard"
                                  onClick={() => setSelectedBook(book)}
                                  aria-label={`فتح تفاصيل كتاب: ${book.title}`}
                                >
                                  <div className="lpBookCard__media">
                                    {cover ? (
                                      <img
                                        className="lpBookCard__img"
                                        src={cover}
                                        alt={book.title}
                                        loading="lazy"
                                      />
                                    ) : (
                                      <div className="lpBookCard__fallback" aria-hidden="true">
                                        📘
                                      </div>
                                    )}

                                    <span className="lpBookCard__overlay" aria-hidden="true" />

                                    <span className={`lpBookBadge ${isFree ? "isFree" : "isPaid"}`}>
                                      {isFree ? "مجاني" : `${book.price} ج`}
                                    </span>

                                    <div className="lpBookCard__bottom">
                                      {book.term && <span className="lpBookTerm">{book.term}</span>}
                                      <h3 className="lpBookTitle">{book.title}</h3>

                                      <div className="lpBookMeta">
                                        <span className={`lpBookPill ${isFree ? "isFree" : "isPaid"}`}>
                                          {isFree ? "تحميل متاح" : "شراء / تفاصيل"}
                                        </span>
                                        <span className="lpBookHint">اضغط للمزيد ←</span>
                                      </div>
                                    </div>
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {pageCount > 1 && (
                  <div className="lpBooksDots" aria-label="التنقل بين مجموعات الكتب">
                    {Array.from({ length: pageCount }).map((_, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setCurrentBookIndex(idx * booksPerPage)}
                        className={`lpBooksDot ${idx === page ? "isActive" : ""}`}
                        aria-label={`انتقل إلى المجموعة ${idx + 1}`}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>
          </section>
        );
      })()}

      {/* ========== Book Modal (Portal) ========== */}
      {selectedBook && typeof document !== "undefined" &&
        createPortal(
          <div
            className="lpBooksModalOverlay"
            role="dialog"
            aria-modal="true"
            aria-labelledby="lpBookModalTitle"
            onClick={() => setSelectedBook(null)}
          >
            <div className="lpBooksModal" onClick={(e) => e.stopPropagation()}>
              <button
                type="button"
                className="lpBooksModal__close"
                onClick={() => setSelectedBook(null)}
                aria-label="إغلاق"
              >
                ✕
              </button>

              <div className="lpBooksModal__hero">
                <div className="lpBooksModal__heroBg" aria-hidden="true" />
                <img
                  className="lpBooksModal__heroImg"
                  src={selectedBook.cover_url || selectedBook.cover_image}
                  alt={selectedBook.title}
                  loading="lazy"
                />
                <div className="lpBooksModal__coverWrap">
                  <img
                    className="lpBooksModal__cover"
                    src={selectedBook.cover_url || selectedBook.cover_image}
                    alt={selectedBook.title}
                    loading="lazy"
                  />
                </div>
              </div>

              <div className="lpBooksModal__body">
                <div className="lpBooksModal__titleWrap">
                  <h2 id="lpBookModalTitle" className="lpBooksModal__title">
                    {selectedBook.title}
                  </h2>
                  {selectedBook.term && <p className="lpBooksModal__term">{selectedBook.term}</p>}
                </div>

                <div className="lpBooksModal__price">
                  {selectedBook.is_free ? (
                    <span className="lpBooksPriceBadge isFree">كتاب مجاني</span>
                  ) : (
                    <span className="lpBooksPriceBadge isPaid">
                      {selectedBook.price} <small>جنيه</small>
                    </span>
                  )}
                </div>

                {selectedBook.description && (
                  <div className="lpBooksModal__block">
                    <h3 className="lpBooksModal__h3">وصف الكتاب</h3>
                    <p className="lpBooksModal__p">{selectedBook.description}</p>
                  </div>
                )}

                {selectedBook.grades && selectedBook.grades.length > 0 && (
                  <div className="lpBooksModal__block">
                    <h3 className="lpBooksModal__h3">الصفوف الدراسية</h3>
                    <div className="lpBooksChips">
                      {selectedBook.grades.map((g) => (
                        <span key={g.id} className="lpBooksChip">
                          {g.name}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                <div className="lpBooksModal__actions">
                  <button
                    type="button"
                    className="lpBooksPrimaryBtn"
                    onClick={() => {
                      alert(selectedBook.is_free ? "سيتم توفير التحميل قريباً" : "سيتم توجيهك لصفحة الدفع قريباً");
                    }}
                  >
                    {selectedBook.is_free ? "تحميل الكتاب" : "شراء الكتاب"}
                  </button>

                  {selectedBook.pdf_url && (
                    <a
                      className="lpBooksGhostBtn"
                      href={selectedBook.pdf_url}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      معاينة
                    </a>
                  )}
                </div>
              </div>
            </div>
          </div>,
          document.body
        )
      }
      {/* Floating WhatsApp Button */}
      {typeof document !== "undefined" &&
        createPortal(
          <a
            className="lpWa group"
            href={waHref}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="تواصل معنا عبر واتساب"
          >
            <span className="lpWa__ring" aria-hidden="true" />
            <span className="lpWa__btn" aria-hidden="true">
              <svg
                className="lpWa__icon"
                fill="currentColor"
                viewBox="0 0 24 24"
                focusable="false"
                aria-hidden="true"
              >
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
              </svg>
            </span>
            <span className="lpWa__tip" role="tooltip">
              تواصل معنا
              <span className="lpWa__tipArrow" aria-hidden="true" />
            </span>
          </a>,
          document.body
        )
      }
    </div>
  );
};

export default LandingPage;