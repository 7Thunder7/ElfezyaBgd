
import "./LandingHero.css";

// ✅ الصورة من داخل src/imgs (نفس مكان المسار اللي عندك)
import teacherImg from "../imgs/WhatsApp Image 2026-02-03 at 2.18.03 AM.jpeg";

export default function LandingHero() {
    return (
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
                        أهلاً بيك في <span className="grad">منصة مستر زكريا هارون</span>
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
                        {/* <div className="mediaCard__badge">
                            <span className="badge__icon">⚡</span>
                            <span className="badge__text">
                                مستر زكريا هارون <small>Physics Teacher</small>
                            </span>
                        </div> */}

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
    );
}