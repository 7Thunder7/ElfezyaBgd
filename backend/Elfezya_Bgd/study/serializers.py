# study/serializers.py
from rest_framework import serializers
from .models import (
    Grade,
    Section, Lesson, LessonVideo, Exam, Question, Choice,
    ExamAttempt, StudentAnswer, LessonPart,Revision, SingleVideo, PaidExam, StudentPurchase
)


class GradeSerializer(serializers.ModelSerializer):
    class Meta:
        model = Grade
        fields = ("id", "name", "slug")


class LessonSummarySerializer(serializers.ModelSerializer):
    grades = GradeSerializer(many=True, read_only=True)

    class Meta:
        model = Lesson
        fields = ("id", "title", "slug", "short_description", "thumbnail_url", "order", "published", "grades")


class SectionSerializer(serializers.ModelSerializer):
    grades = GradeSerializer(many=True, read_only=True)
    lessons = LessonSummarySerializer(many=True, read_only=True)

    class Meta:
        model = Section
        fields = ("id", "title", "slug", "order", "grades", "lessons")


class LessonVideoSerializer(serializers.ModelSerializer):
    url = serializers.SerializerMethodField()

    class Meta:
        model = LessonVideo
        fields = ("id", "kind", "title", "url", "duration_seconds", "position", "part")

    def get_url(self, obj):
        # Your existing logic
        pass


class ChoiceSerializer(serializers.ModelSerializer):
    is_correct = serializers.SerializerMethodField()

    class Meta:
        model = Choice
        fields = ("id", "text", "order", "is_correct")

    def get_is_correct(self, obj):
        req = self.context.get("request", None)
        if req and getattr(req.user, "is_staff", False):
            return obj.is_correct
        return None


class QuestionSerializer(serializers.ModelSerializer):
    choices = ChoiceSerializer(many=True, read_only=True)

    class Meta:
        model = Question
        fields = ("id", "text", "qtype", "marks", "order", "choices")

class ExamSummarySerializer(serializers.ModelSerializer):
    grades = GradeSerializer(many=True, read_only=True)
    part = serializers.PrimaryKeyRelatedField(read_only=True)
    lesson = serializers.PrimaryKeyRelatedField(read_only=True)  # Add this
    kind_display = serializers.CharField(source='get_kind_display', read_only=True)

    class Meta:
        model = Exam
        fields = (
            "id", "title", "description", "duration_minutes", "timer_enabled",
            "is_published", "order", "kind", "kind_display", "lesson", "grades", "part"
        )


class ExamDetailSerializer(serializers.ModelSerializer):
    questions = QuestionSerializer(many=True, read_only=True)
    grades = GradeSerializer(many=True, read_only=True)
    lesson = serializers.PrimaryKeyRelatedField(read_only=True)  # Add this
    kind_display = serializers.CharField(source='get_kind_display', read_only=True)

    class Meta:
        model = Exam
        fields = (
            "id", "title", "description", "duration_minutes", "timer_enabled",
            "auto_submit_on_expire", "is_published", "kind", "kind_display",
            "lesson", "questions", "grades"
        )

class LessonDetailSerializer(serializers.ModelSerializer):
    videos = LessonVideoSerializer(many=True, read_only=True)
    exams = ExamSummarySerializer(many=True, read_only=True)
    section = SectionSerializer(read_only=True)
    grades = GradeSerializer(many=True, read_only=True)

    class Meta:
        model = Lesson
        fields = ("id", "section", "title", "slug", "short_description", "thumbnail_url", "order", "published",
                  "grades", "videos", "exams")

class RevisionSerializer(serializers.ModelSerializer):
    """Serializer for Revision with grade info"""
    grades = GradeSerializer(many=True, read_only=True)
    lesson = serializers.PrimaryKeyRelatedField(read_only=True)
    photo_url = serializers.SerializerMethodField()

    class Meta:
        model = Revision
        fields = (
            "id", "title", "slug", "video_link", "photo_link", "photo_file", "photo_url",
            "lesson", "grades", "order", "is_published",
            "created_at", "updated_at"
        )

    def get_photo_url(self, obj):
        """Return the appropriate photo URL (file if uploaded, otherwise link)"""
        request = self.context.get('request')
        if obj.photo_file:
            if request:
                return request.build_absolute_uri(obj.photo_file.url)
            return obj.photo_file.url
        return obj.photo_link

# New LessonPartSerializer
class LessonPartSerializer(serializers.ModelSerializer):
    """Serializer for LessonPart with progress tracking"""

    class Meta:
        model = LessonPart
        fields = ("id", "lesson", "title", "slug", "order")


class SingleVideoSerializer(serializers.ModelSerializer):
    class Meta:
        model = SingleVideo
        fields = '__all__'

class PaidExamSerializer(serializers.ModelSerializer):
    class Meta:
        model = PaidExam
        fields = '__all__'

class StudentPurchaseSerializer(serializers.ModelSerializer):
    class Meta:
        model = StudentPurchase
        fields = '__all__'