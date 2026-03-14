# landing/serializers.py
from rest_framework import serializers
from .models import TopStudent, News, Package, Book
from study.models import Grade


class GradeSimpleSerializer(serializers.ModelSerializer):
    """Simple grade serializer for nested relations"""
    class Meta:
        model = Grade
        fields = ["id", "name", "slug"]


class TopStudentSerializer(serializers.ModelSerializer):
    image_url = serializers.SerializerMethodField()

    class Meta:
        model = TopStudent
        fields = [
            "id",
            "title",
            "year",
            "image",
            "image_url",
            "description",
            "order",
            "created_at"
        ]

    def get_image_url(self, obj):
        """Return full URL for image"""
        if obj.image:
            request = self.context.get("request")
            if request:
                return request.build_absolute_uri(obj.image.url)
            return obj.image.url
        return None


class NewsSerializer(serializers.ModelSerializer):
    image_url = serializers.SerializerMethodField()

    class Meta:
        model = News
        fields = [
            "id",
            "title",
            "excerpt",
            "content",
            "image",
            "image_url",
            "date",
            "link",
            "order",
            "created_at"
        ]

    def get_image_url(self, obj):
        if obj.image:
            request = self.context.get("request")
            if request:
                return request.build_absolute_uri(obj.image.url)
            return obj.image.url
        return None


class PackageSerializer(serializers.ModelSerializer):
    grades = GradeSimpleSerializer(many=True, read_only=True)
    duration_display = serializers.CharField(source="get_duration_type_display", read_only=True)

    class Meta:
        model = Package
        fields = [
            "id",
            "title",
            "duration_type",
            "duration_display",
            "price",
            "description",
            "features",
            "is_popular",
            "grades",
            "order",
            "created_at"
        ]


class BookSerializer(serializers.ModelSerializer):
    cover_url = serializers.SerializerMethodField()
    pdf_url = serializers.SerializerMethodField()
    grades = GradeSimpleSerializer(many=True, read_only=True)

    class Meta:
        model = Book
        fields = [
            "id",
            "title",
            "description",
            "cover_image",
            "cover_url",
            "pdf_file",
            "pdf_url",
            "external_link",
            "price",
            "is_free",
            "grades",
            "term",
            "order",
            "created_at"
        ]

    def get_cover_url(self, obj):
        if obj.cover_image:
            request = self.context.get("request")
            if request:
                return request.build_absolute_uri(obj.cover_image.url)
            return obj.cover_image.url
        return None

    def get_pdf_url(self, obj):
        if obj.pdf_file:
            request = self.context.get("request")
            if request:
                return request.build_absolute_uri(obj.pdf_file.url)
            return obj.pdf_file.url
        return None


class LandingDataSerializer(serializers.Serializer):
    """Combined serializer for all landing page data"""
    top_students = TopStudentSerializer(many=True)
    news = NewsSerializer(many=True)
    packages = PackageSerializer(many=True)
    books = BookSerializer(many=True)