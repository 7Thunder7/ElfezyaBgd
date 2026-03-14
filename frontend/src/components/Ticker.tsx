// src/components/Ticker.tsx
import React, { useRef, useEffect } from "react";
import "./ticker.css";

export type TickerProps = {
    items: string[];               // قائمة العناصر (مثلاً أسماء العلماء)
    speed?: number;                // مدة الدورة بالثواني (أكبر = أبطأ). الافتراضي 18
    pauseOnHover?: boolean;        // هل يتوقف عند hover؟ (default: true)
    title?: string | null;         // نص تمهيدي يسار الشريط مثل "Great Physicists" (أو null)
    className?: string;            // CSS إضافي اختياري
};

const Ticker: React.FC<TickerProps> = ({
    items,
    speed = 18,
    pauseOnHover = true,
    title = "Great Physicists",
    className = "",
}) => {
    const trackRef = useRef<HTMLDivElement | null>(null);

    // نكرر العناصر مرتين لإعطاء حلقة سلسة
    const feed = [...items, ...items];

    useEffect(() => {
        const el = trackRef.current;
        if (!el) return;
        // نضبط مدة الأنيميشن ديناميكياً (بالثواني)
        el.style.animationDuration = `${Math.max(6, speed)}s`;
    }, [speed, items]);

    return (
        <div className={`ticker-wrap ${className}`} aria-label={title ?? "ticker"}>
            {title && <div className="ticker-title" aria-hidden>{title}</div>}

            <div className={`ticker ${pauseOnHover ? "pause-on-hover" : ""}`} role="region" aria-live="polite">
                <div className="ticker-track" ref={trackRef}>
                    {feed.map((it, idx) => (
                        <div className="ticker-item" key={idx}>
                            <svg width="16" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" className="ticker-icon" aria-hidden>
                                <path d="M12 2v6" />
                                <path d="M12 16v6" />
                                <path d="M4.5 6.5l3 3" />
                                <path d="M16.5 14.5l3 3" />
                            </svg>
                            <span className="ticker-text">{it}</span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default Ticker;
