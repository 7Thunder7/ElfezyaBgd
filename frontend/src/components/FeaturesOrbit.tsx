import React, { useEffect, useMemo, useRef } from "react";

export type FeatureItem = {
    key: string;
    title: string;
    desc: string;
    icon: React.ReactNode;
};

type Props = {
    title?: string;
    subtitle?: string;
    centerImg: string;
    items: FeatureItem[];
};

const FeaturesOrbit: React.FC<Props> = ({
    title = "مميزات الموقع",
    subtitle = "منصة متكاملة لتعلّم الفيزياء — أدوات، فيديوهات، اختبارات ودعم متواصل.",
    centerImg,
    items,
}) => {
    const sectionRef = useRef<HTMLElement | null>(null);

    // ✅ Scroll reveal باستخدام IntersectionObserver
    useEffect(() => {
        const root = sectionRef.current;
        if (!root) return;

        const targets = Array.from(root.querySelectorAll<HTMLElement>("[data-reveal]"));

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
    }, []);

    // ✅ توزيع دائري + ألوان Accent ديناميكية
    const positioned = useMemo(() => {
        if (!items?.length) return [];

        const n = items.length;
        const r = n <= 5 ? 34 : 36; // %
        const startDeg = -90;

        return items.map((it, idx) => {
            const theta = ((360 / n) * idx + startDeg) * (Math.PI / 180);
            const x = 50 + r * Math.cos(theta);
            const y = 50 + r * Math.sin(theta);

            // hue مختلف لكل عنصر (أنيق جداً مع HSL)
            const hue = Math.round((360 / n) * idx);

            return {
                ...it,
                style: {
                    ["--x" as any]: `${x}%`,
                    ["--y" as any]: `${y}%`,
                    ["--d" as any]: `${idx * 90}ms`,
                    ["--ph" as any]: `${idx * 0.8}s`,
                    ["--h" as any]: `${hue}`, // ✅ جديد
                } as React.CSSProperties,
            };
        });
    }, [items]);

    return (
        <section ref={sectionRef} className="lpFeatOrbit" id="features">
            <div className="lpFeatOrbit__inner">
                <header className="lpFeatOrbit__head" data-reveal style={{ ["--d" as any]: "0ms" }}>
                    <h2 className="lpFeatOrbit__title">{title}</h2>
                    <p className="lpFeatOrbit__sub">{subtitle}</p>
                    <div className="lpFeatOrbit__divider" aria-hidden="true" />
                </header>

                <div className="lpFeatOrbit__stage" aria-label="platform features">
                    {/* Center logo */}
                    <div className="lpFeatOrbit__center" data-reveal style={{ ["--d" as any]: "120ms" }}>
                        <div className="lpFeatOrbit__centerRing" aria-hidden="true" />
                        <div className="lpFeatOrbit__centerCard">
                            <img className="lpFeatOrbit__centerImg" src={centerImg} alt="Logo" />
                        </div>
                    </div>

                    {/* Items around */}
                    {positioned.map((it) => (
                        <article key={it.key} className="lpFeatOrbit__item" style={it.style} data-reveal>
                            <div className="lpFeatOrbit__icon" aria-hidden="true">
                                {it.icon}
                            </div>
                            <div className="lpFeatOrbit__txt">
                                <div className="lpFeatOrbit__t">{it.title}</div>
                                <div className="lpFeatOrbit__d">{it.desc}</div>
                            </div>
                        </article>
                    ))}
                </div>
            </div>
        </section>
    );
};

export default FeaturesOrbit;