from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.http import JsonResponse
from django.urls import include, path
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView


def health_check(_request):
    return JsonResponse({"status": "ok"})


urlpatterns = [
    path("health/", health_check, name="health-check"),
    path("_nested_admin/", include("nested_admin.urls")),
    path("admin/", admin.site.urls),
    path("api/", include("study.urls")),
    path("api/", include("accounts.urls")),
    path("api/auth/token/", TokenObtainPairView.as_view(), name="token_obtain_pair"),
    path("api/auth/token/refresh/", TokenRefreshView.as_view(), name="token_refresh"),
    path("api/landing/", include("landing.urls")),
]

if settings.DEBUG or not getattr(settings, "USE_S3", False):
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
