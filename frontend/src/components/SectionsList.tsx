import { useEffect, useState } from "react";
import api from "../lib/api";

interface SectionItem {
  id: number;
  title: string;
  slug?: string;
  // ضيف حقول إضافية هنا لو الـ API بيرجعهم
}

interface Section {
  id: number;
  slug: string;
  title: string;
  items?: SectionItem[];
  // ضيف حقول إضافية هنا لو الـ API بيرجعهم
}

export default function SectionsList() {
  const [sections, setSections] = useState<Section[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    api.get<Section[]>("/sections/")
      .then(res => {
        if (!mounted) return;
        setSections(res.data);
      })
      .catch(err => {
        console.error("fetch sections error", err);
      })
      .finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, []);

  if (loading) return <div>جاري التحميل...</div>;
  return (
    <div>
      {sections.map(s => (
        <div key={s.slug} className="card">
          {s.title} ({s.items?.length ?? 0})
        </div>
      ))}
    </div>
  );
}
