# study/urls.py
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    SectionViewSet, LessonViewSet, ExamViewSet,
    LessonPartViewSet, GradeViewSet, stream_local_video,RevisionViewSet, SingleVideoViewSet, PaidExamViewSet, StudentPurchaseViewSet
)

router = DefaultRouter()
router.register(r"sections", SectionViewSet)
router.register(r"lessons", LessonViewSet)
router.register(r"exams", ExamViewSet)
# register lesson-parts and grades so frontend can call:
router.register(r"lesson-parts", LessonPartViewSet, basename="lessonpart")
router.register(r"grades", GradeViewSet, basename="grade")
router.register(r"revisions", RevisionViewSet, basename="revision")  # Add this line
router = DefaultRouter()
router.register(r'single-videos', SingleVideoViewSet)
router.register(r'paid-exams', PaidExamViewSet)
router.register(r'purchases', StudentPurchaseViewSet)

urlpatterns = [
    path("", include(router.urls)),
    path("videos/local/<int:video_pk>/", stream_local_video, name="stream_local_video"),
]
