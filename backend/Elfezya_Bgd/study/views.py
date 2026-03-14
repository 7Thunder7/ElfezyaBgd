# study/views.py
import logging
import os
import mimetypes

from rest_framework import viewsets, response, status, serializers, permissions
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticatedOrReadOnly, IsAuthenticated
from django.shortcuts import get_object_or_404
from django.db.models import Prefetch, Q
from django.conf import settings
from django.http import FileResponse, Http404

# optional boto3 import will be attempted only if needed
try:
    import boto3  # type: ignore
except Exception:
    boto3 = None  # not installed / not available

from .models import (
    Section, Lesson, LessonPart, LessonVideo, Exam, Question, Choice, ExamAttempt, StudentAnswer, Grade, Revision, SingleVideo, PaidExam, StudentPurchase
)
from .serializers import (
    SectionSerializer, LessonDetailSerializer, ExamDetailSerializer, LessonPartSerializer, GradeSerializer,RevisionSerializer, SingleVideoSerializer, PaidExamSerializer, StudentPurchaseSerializer
)

logger = logging.getLogger(__name__)


class SectionViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Returns sections. Supports optional query param ?grade=<grade-slug-or-id> which will
    prefetch lessons filtered to that grade (lessons that list the grade or lessons without any grade).
    """
    queryset = Section.objects.all()
    serializer_class = SectionSerializer
    permission_classes = [IsAuthenticatedOrReadOnly]

    def get_queryset(self):
        req_qs = getattr(self.request, "query_params", None) or getattr(self.request, "GET", {})
        grade_param = req_qs.get("grade")

        if grade_param:
            grade_obj = None
            try:
                if str(grade_param).isdigit():
                    grade_obj = Grade.objects.filter(pk=int(grade_param)).first()
                if grade_obj is None:
                    grade_obj = Grade.objects.filter(slug=grade_param).first()
            except Exception:
                logger.exception("get_queryset: error looking up grade %s", grade_param)

            if grade_obj:
                lessons_qs = Lesson.objects.filter(
                    Q(grades=grade_obj) | Q(grades__isnull=True),
                    published=True
                ).order_by("order")
            else:
                lessons_qs = Lesson.objects.none()
        else:
            lessons_qs = Lesson.objects.filter(published=True).order_by("order")

        return Section.objects.prefetch_related(
            Prefetch("lessons", queryset=lessons_qs)
        ).all()


class LessonViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Lesson.objects.select_related("section").prefetch_related("videos", "exams", "parts").all()
    serializer_class = LessonDetailSerializer
    lookup_field = "slug"
    permission_classes = [IsAuthenticatedOrReadOnly]

    def get_object(self):
        """
        Try default lookup (slug). If not found and lookup looks numeric, fallback to pk.
        """
        lookup_value = self.kwargs.get(self.lookup_field)
        try:
            return super().get_object()
        except Exception as exc:
            try:
                if lookup_value is not None and str(lookup_value).isdigit():
                    obj = get_object_or_404(Lesson, pk=int(lookup_value))
                    self.check_object_permissions(self.request, obj)
                    logger.debug("get_object: fallback by pk=%s succeeded", lookup_value)
                    return obj
            except Exception as exc2:
                logger.exception("get_object: fallback by pk failed: %s", exc2)
            logger.exception("get_object: original resolution failed: %s", exc)
            raise

    @action(detail=True, methods=["get"], url_path=r"videos")
    def videos(self, request, *args, **kwargs):
        try:
            lesson = self.get_object()
        except Http404:
            logger.warning("videos: lesson not found for lookup %s", self.kwargs.get(self.lookup_field))
            return response.Response({"detail": "lesson not found"}, status=status.HTTP_404_NOT_FOUND)

        videos_qs = LessonVideo.objects.filter(lesson=lesson).order_by("position")
        count = videos_qs.count()
        from .serializers import LessonVideoSerializer

        serializer = LessonVideoSerializer(videos_qs, many=True, context={"request": request})
        return response.Response({"videos": serializer.data, "count": count}, status=status.HTTP_200_OK)

    @action(detail=True, methods=["get"], url_path=r"videos-debug")
    def videos_debug(self, request, *args, **kwargs):
        try:
            lesson = self.get_object()
        except Http404:
            logger.warning("videos-debug: lesson not found for lookup %s", self.kwargs.get(self.lookup_field))
            return response.Response({"detail": "lesson not found"}, status=status.HTTP_404_NOT_FOUND)

        qs = LessonVideo.objects.filter(lesson=lesson).order_by("position")
        raw = []
        for v in qs:
            raw.append({
                "id": getattr(v, "id", None),
                "title": getattr(v, "title", None),
                "url_field": getattr(v, "url", None),
                "file_field": str(getattr(v, "file", None)),
                "is_active": getattr(v, "is_active", None) if hasattr(v, "is_active") else None,
                "published": getattr(v, "published", None) if hasattr(v, "published") else None,
            })

        from .serializers import LessonVideoSerializer
        serializer = LessonVideoSerializer(qs, many=True, context={"request": request})
        return response.Response({
            "lesson_id": getattr(lesson, "id", None),
            "db_count": qs.count(),
            "db_raw": raw,
            "serialized_count": len(serializer.data),
            "serialized": serializer.data,
        }, status=status.HTTP_200_OK)

    @action(detail=True, methods=["get"], url_path=r"presign-video/(?P<video_pk>[^/.]+)")
    def presign_video(self, request, *args, **kwargs):
        try:
            lesson = self.get_object()
        except Http404:
            logger.warning("presign_video: lesson not found for lookup %s", self.kwargs.get(self.lookup_field))
            raise Http404("lesson not found")

        video_pk = kwargs.get("video_pk") or self.kwargs.get("video_pk")
        if video_pk is None:
            logger.warning("presign_video: no video_pk provided in kwargs for lesson %s", getattr(lesson, "id", None))
            raise Http404("video not specified")

        try:
            video = LessonVideo.objects.get(pk=video_pk, lesson=lesson)
        except LessonVideo.DoesNotExist:
            logger.warning("presign_video: video %s not found for lesson %s", video_pk, getattr(lesson, "id", None))
            raise Http404("video not found for this lesson")

        file_field = getattr(video, "file", None)
        if file_field and hasattr(file_field, "url"):
            try:
                url = request.build_absolute_uri(file_field.url)
                logger.info("presign_video: returning file.url for video %s", video_pk)
                return response.Response({"url": url}, status=status.HTTP_200_OK)
            except Exception:
                logger.exception("presign_video: failed building absolute uri for file.url")

        for attr in ("url", "src", "file_url", "video_url"):
            v = getattr(video, attr, None)
            if isinstance(v, str) and v.strip():
                val = v.strip()
                logger.info("presign_video: returning textual url attr %s for video %s", attr, video_pk)
                if request and val.startswith("/"):
                    return response.Response({"url": request.build_absolute_uri(val)}, status=status.HTTP_200_OK)
                return response.Response({"url": val}, status=status.HTTP_200_OK)

        if boto3 is not None and file_field and hasattr(file_field, "name"):
            key = getattr(file_field, "name", None)
            if key and getattr(settings, "AWS_STORAGE_BUCKET_NAME", None):
                try:
                    client = boto3.client(
                        "s3",
                        endpoint_url=getattr(settings, "AWS_S3_ENDPOINT_URL", None),
                        aws_access_key_id=getattr(settings, "AWS_ACCESS_KEY_ID", None),
                        aws_secret_access_key=getattr(settings, "AWS_SECRET_ACCESS_KEY", None),
                        region_name=getattr(settings, "AWS_S3_REGION_NAME", None),
                    )
                    presigned = client.generate_presigned_url(
                        "get_object",
                        Params={"Bucket": settings.AWS_STORAGE_BUCKET_NAME, "Key": str(key)},
                        ExpiresIn=3600,
                    )
                    logger.info("presign_video: generated presigned url for key %s", key)
                    return response.Response({"url": presigned}, status=status.HTTP_200_OK)
                except Exception:
                    logger.exception("presign_video: boto3 presign failed for key %s", key)

        if settings.DEBUG and file_field and hasattr(file_field, "path"):
            path = getattr(file_field, "path", None)
            if path and os.path.exists(path):
                media_url = getattr(file_field, "url", None)
                if media_url:
                    logger.info("presign_video: DEBUG fallback returning media url for video %s", video_pk)
                    return response.Response({"url": request.build_absolute_uri(media_url)}, status=status.HTTP_200_OK)

        logger.warning("presign_video: nothing available for video %s (lesson %s)", video_pk,
                       getattr(lesson, "id", None))
        return response.Response({"detail": "no video url available"}, status=status.HTTP_404_NOT_FOUND)


class ExamViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Exam.objects.prefetch_related("questions__choices", "grades").select_related("lesson", "part").all()
    serializer_class = ExamDetailSerializer
    permission_classes = [IsAuthenticatedOrReadOnly]

    def get_queryset(self):
        """Filter by kind, lesson, or grade if provided"""
        queryset = super().get_queryset()

        # Filter by kind (exp or rev)
        kind_param = self.request.query_params.get('kind')
        if kind_param and kind_param in ['exp', 'rev']:
            queryset = queryset.filter(kind=kind_param)
            logger.info(f"Filtered exams by kind: {kind_param}")

        # Filter by lesson (for explain exams)
        lesson_param = self.request.query_params.get('lesson')
        if lesson_param:
            try:
                if str(lesson_param).isdigit():
                    queryset = queryset.filter(lesson_id=int(lesson_param))
                else:
                    queryset = queryset.filter(lesson__slug=lesson_param)
                logger.info(f"Filtered exams by lesson: {lesson_param}")
            except Exception as e:
                logger.exception(f"Error filtering exams by lesson {lesson_param}: {e}")

        # Filter by grade (useful for revision exams)
        grade_param = self.request.query_params.get('grade')
        if grade_param:
            try:
                if str(grade_param).isdigit():
                    queryset = queryset.filter(
                        Q(grades__id=int(grade_param)) | Q(grades__isnull=True)
                    )
                else:
                    queryset = queryset.filter(
                        Q(grades__slug=grade_param) | Q(grades__isnull=True)
                    )
                logger.info(f"Filtered exams by grade: {grade_param}")
            except Exception as e:
                logger.exception(f"Error filtering exams by grade {grade_param}: {e}")

        return queryset.distinct()

    @action(detail=True, methods=["post"], permission_classes=[IsAuthenticated])
    def attempt(self, request, pk=None):
        exam = self.get_object()
        payload = request.data or {}
        answers = payload.get("answers", [])

        attempt = ExamAttempt.objects.create(exam=exam, user=request.user, status="in_progress", raw_answers=payload)
        total_score = 0
        total_max = 0

        for a in answers:
            qid = a.get("question")
            try:
                q = Question.objects.get(pk=qid, exam=exam)
            except Question.DoesNotExist:
                continue

            obtained = 0
            max_marks = float(q.marks)
            total_max += max_marks

            if q.qtype == "mcq_single":
                sel = a.get("selected_choice_id")
                if sel:
                    StudentAnswer.objects.create(attempt=attempt, question=q, selected_choice_id=sel)
                    try:
                        chosen = Choice.objects.get(pk=sel, question=q)
                        if chosen.is_correct:
                            obtained = float(q.marks)
                    except Choice.DoesNotExist:
                        obtained = 0
            elif q.qtype == "mcq_multi":
                sels = a.get("selected_choice_ids") or []
                StudentAnswer.objects.create(attempt=attempt, question=q, selected_choice_ids=sels)
                choices_qs = getattr(q, "choices", Choice.objects.none())
                correct_ids = list(choices_qs.filter(is_correct=True).values_list("id", flat=True))
                if len(correct_ids) == 0:
                    obtained = 0
                else:
                    correct_set = set(correct_ids)
                    try:
                        sel_set = set(int(x) for x in sels)
                    except Exception:
                        sel_set = set()
                    true_positive = len(correct_set & sel_set)
                    false_positive = len(sel_set - correct_set)
                    score_ratio = max(0.0, (true_positive - false_positive) / len(correct_set))
                    obtained = float(q.marks) * score_ratio
            else:
                text = a.get("text_answer")
                StudentAnswer.objects.create(attempt=attempt, question=q, text_answer=text)

            total_score += obtained
            StudentAnswer.objects.filter(attempt=attempt, question=q).update(obtained_marks=obtained)

        attempt.calculated_score = total_score
        attempt.status = "submitted"
        attempt.finished_at = getattr(attempt, "created_at", None)
        attempt.save()
        ser = {
            "attempt_id": getattr(attempt, "id", None),
            "score": float(total_score),
            "max_score": float(total_max)
        }
        return response.Response(ser, status=status.HTTP_201_CREATED)
# ---------------------------
# LessonPart + Grade ViewSets
# ---------------------------

class LessonPartViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Read-only viewset for LessonPart.
    Provides endpoints:
      GET /api/lesson-parts/
      GET /api/lesson-parts/{pk-or-slug}/
    Supports filtering by lesson: ?lesson=<lesson_id_or_slug>
    """
    queryset = LessonPart.objects.select_related("lesson").order_by("order", "id").all()
    serializer_class = LessonPartSerializer
    permission_classes = [IsAuthenticatedOrReadOnly]

    def get_queryset(self):
        """Filter by lesson if provided in query params"""
        queryset = super().get_queryset()

        # Get lesson parameter from query string
        lesson_param = self.request.query_params.get('lesson')

        if lesson_param:
            # Try by ID first, then by slug
            try:
                if str(lesson_param).isdigit():
                    queryset = queryset.filter(lesson_id=int(lesson_param))
                else:
                    queryset = queryset.filter(lesson__slug=lesson_param)

                logger.info(f"Filtered lesson parts by lesson: {lesson_param}, count: {queryset.count()}")
            except Exception as e:
                logger.exception(f"Error filtering lesson parts by lesson {lesson_param}: {e}")

        return queryset


class GradeViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Grade.objects.all().order_by("order", "name")
    serializer_class = GradeSerializer
    permission_classes = [IsAuthenticatedOrReadOnly]


class RevisionViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Read-only viewset for Revision materials.
    Provides endpoints:
      GET /api/revisions/
      GET /api/revisions/{pk}/
    Supports filtering by:
      - grade: ?grade=<grade_id_or_slug>
      - lesson: ?lesson=<lesson_id_or_slug>
    """
    queryset = Revision.objects.select_related("lesson").prefetch_related("grades").order_by("order", "id")
    serializer_class = RevisionSerializer
    permission_classes = [IsAuthenticatedOrReadOnly]

    def get_queryset(self):
        """Filter by grade or lesson if provided in query params"""
        queryset = super().get_queryset().filter(is_published=True)

        # Filter by grade
        grade_param = self.request.query_params.get('grade')
        if grade_param:
            try:
                if str(grade_param).isdigit():
                    queryset = queryset.filter(
                        Q(grades__id=int(grade_param)) | Q(grades__isnull=True)
                    )
                else:
                    queryset = queryset.filter(
                        Q(grades__slug=grade_param) | Q(grades__isnull=True)
                    )
                logger.info(f"Filtered revisions by grade: {grade_param}")
            except Exception as e:
                logger.exception(f"Error filtering revisions by grade {grade_param}: {e}")

        # Filter by lesson
        lesson_param = self.request.query_params.get('lesson')
        if lesson_param:
            try:
                if str(lesson_param).isdigit():
                    queryset = queryset.filter(lesson_id=int(lesson_param))
                else:
                    queryset = queryset.filter(lesson__slug=lesson_param)
                logger.info(f"Filtered revisions by lesson: {lesson_param}")
            except Exception as e:
                logger.exception(f"Error filtering revisions by lesson {lesson_param}: {e}")

        return queryset.distinct()

# Development helper: stream a local file directly (optional)
def stream_local_video(request, video_pk):
    try:
        video = LessonVideo.objects.get(pk=video_pk)
    except LessonVideo.DoesNotExist:
        raise Http404("video not found")
    file_field = getattr(video, "file", None)
    if not file_field:
        raise Http404("no file for this video")
    path = getattr(file_field, "path", None)
    if not path or not os.path.exists(path):
        raise Http404("file missing on disk")
    content_type, _ = mimetypes.guess_type(path)
    if not content_type:
        content_type = "application/octet-stream"
    return FileResponse(open(path, "rb"), content_type=content_type)




class SingleVideoViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = SingleVideo.objects.all()
    serializer_class = SingleVideoSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]

class PaidExamViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = PaidExam.objects.all()
    serializer_class = PaidExamSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]

class StudentPurchaseViewSet(viewsets.ModelViewSet):
    queryset = StudentPurchase.objects.all()
    serializer_class = StudentPurchaseSerializer
    permission_classes = [permissions.IsAuthenticated]

    def perform_create(self, serializer):
        serializer.save(student=self.request.user)
