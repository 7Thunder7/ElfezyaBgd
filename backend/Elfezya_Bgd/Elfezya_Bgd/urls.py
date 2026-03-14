# Elfezya_Bgd/Elfezya_Bgd/urls.py
from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView


# إذا تستخدم DRF routers داخل تطبيقات فرعية (مثل study.urls) فإنه كافٍ لعمل include لملف urls الخاص بالتطبيق
# تأكد أن كل تطبيق (study, accounts, ...) يحتوي على ملف urls.py صالح.

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/", include("study.urls")),      # <-- هنا ندرج جميع مسارات study تحت /api/
    path("api/", include("accounts.urls")),   # إذا accounts يقدم endpoints مثل api/auth/...
    # path("api/contenet/", include("contenet.urls")),
    path("api/auth/token/", TokenObtainPairView.as_view(), name="token_obtain_pair"),
    path("api/auth/token/refresh/", TokenRefreshView.as_view(), name="token_refresh"),
    path('api/landing/', include('landing.urls')),
]

# إعدادات لتقديم ملفات الوسائط أثناء التطوير
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
