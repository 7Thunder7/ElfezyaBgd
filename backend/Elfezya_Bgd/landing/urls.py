# landing/urls.py
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

app_name = "landing"

router = DefaultRouter()
router.register(r"top-students", views.TopStudentViewSet, basename="topstudent")
router.register(r"news", views.NewsViewSet, basename="news")
router.register(r"packages", views.PackageViewSet, basename="package")
router.register(r"books", views.BookViewSet, basename="book")

urlpatterns = [
    # Combined endpoint for all landing data
    path("data/", views.landing_data, name="landing-data"),

    # Router URLs
    path("", include(router.urls)),
]