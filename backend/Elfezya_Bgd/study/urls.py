from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import (
    ExamViewSet,
    GradeViewSet,
    LessonPartViewSet,
    LessonViewSet,
    PaidExamViewSet,
    RevisionViewSet,
    SectionViewSet,
    SingleVideoViewSet,
    StudentPurchaseViewSet,
    stream_local_video,
)

router = DefaultRouter()
router.register(r"sections", SectionViewSet, basename="section")
router.register(r"lessons", LessonViewSet, basename="lesson")
router.register(r"exams", ExamViewSet, basename="exam")
router.register(r"lesson-parts", LessonPartViewSet, basename="lesson-part")
router.register(r"grades", GradeViewSet, basename="grade")
router.register(r"revisions", RevisionViewSet, basename="revision")
router.register(r"single-videos", SingleVideoViewSet, basename="single-video")
router.register(r"paid-exams", PaidExamViewSet, basename="paid-exam")
router.register(r"purchases", StudentPurchaseViewSet, basename="purchase")

urlpatterns = [
    path("", include(router.urls)),
    path("videos/local/<int:video_pk>/", stream_local_video, name="stream_local_video"),
]
