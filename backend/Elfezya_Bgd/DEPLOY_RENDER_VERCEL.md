# تجهيز الباك إند على Render وربطه بالفرونت على Vercel

## 1) ارفع المشروع المعدل على GitHub
- ارفع الملفات دي كما هي.
- المهم يكون `render.yaml` و `build.sh` و `start.sh` و `.python-version` موجودين.

## 2) أنشئ خدمة على Render
### أسهل طريقة
- من Render افتح **Blueprints**.
- اختر الريبو.
- Render هيقرأ `render.yaml` ويجهز الخدمة تلقائياً.

### أو لو هتعملها Manual
- Runtime: **Python**
- Build Command:
  `bash build.sh`
- Start Command:
  `bash start.sh`
- Health Check Path:
  `/health/`

## 3) اضبط Environment Variables على Render
لازم تضيف على الأقل:
- `DJANGO_SECRET_KEY` = قيمة عشوائية قوية
- `DJANGO_DEBUG` = `False`
- `FRONTEND_URL` = رابط مشروع الفرونت بعد ما يطلع على Vercel
  مثال:
  `https://your-frontend.vercel.app`

اختياري:
- `CORS_ALLOWED_ORIGINS` لو عندك أكثر من دومين للفرونت
- `CSRF_TRUSTED_ORIGINS` لو محتاج تضيف دومينات زيادة
- `DATABASE_URL` لو قررت تستخدم Postgres بعدين
- `USE_S3=True` لو هتخزن الصور والملفات على S3 / Cloudflare R2

## 4) قاعدة البيانات الحالية
- المشروع دلوقتي هيشتغل افتراضياً على **SQLite**.
- ده مناسب جداً كبداية لأنك قلت إنك مش مهتم بالداتا المخزنة.
- كل مرة السيرفس يعمل restart أو redeploy ممكن الداتا المحلية تضيع.

## 5) اربط الفرونت على Vercel
على Vercel أضف متغير بيئة للفرونت باسم مناسب لمشروعك مثل:
- `VITE_API_BASE_URL`
أو
- `NEXT_PUBLIC_API_BASE_URL`

وخليه يساوي:
`https://your-backend-name.onrender.com`

## 6) لو الفرونت بيستخدم session/cookies
لازم طلبات الفرونت تكون فيها:
- `credentials: 'include'`

## 7) اختبارات سريعة بعد الديبلاي
افتح الروابط دي وتأكد إنها شغالة:
- `/health/`
- `/admin/`
- `/api/grades/`
- `/api/landing/data/`

## 8) ملاحظة مهمة عن الصور والملفات
- لو رفعت صور أو ملفات على نفس سيرفر Render من غير S3 أو Persistent Disk فهي مش مضمونة تفضل موجودة بعد أي restart.
- لو محتاج الصور والكتب والملفات تفضل ثابتة، استخدم S3/R2 أو Render Disk.
