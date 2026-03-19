from django.db.models import Q
from rest_framework import status, viewsets
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from .models import Book, News, Package, TopStudent
from .serializers import BookSerializer, NewsSerializer, PackageSerializer, TopStudentSerializer


class TopStudentViewSet(viewsets.ReadOnlyModelViewSet):
    """
    ViewSet for TopStudent model
    GET /api/landing/top-students/ - List all active top students
    GET /api/landing/top-students/{id}/ - Get specific top student
    """

    queryset = TopStudent.objects.filter(is_active=True)
    serializer_class = TopStudentSerializer
    permission_classes = [AllowAny]

    def get_queryset(self):
        queryset = super().get_queryset()
        year = self.request.query_params.get("year", None)
        if year:
            queryset = queryset.filter(year=year)
        return queryset


class NewsViewSet(viewsets.ReadOnlyModelViewSet):
    """
    ViewSet for News model
    GET /api/landing/news/ - List all published news
    GET /api/landing/news/{id}/ - Get specific news item
    """

    queryset = News.objects.filter(is_published=True)
    serializer_class = NewsSerializer
    permission_classes = [AllowAny]

    def get_queryset(self):
        queryset = super().get_queryset()
        limit = self.request.query_params.get("limit", None)
        if limit:
            try:
                queryset = queryset[: int(limit)]
            except (TypeError, ValueError):
                pass
        return queryset


class PackageViewSet(viewsets.ReadOnlyModelViewSet):
    """
    ViewSet for Package model
    GET /api/landing/packages/ - List all active packages
    GET /api/landing/packages/{id}/ - Get specific package

    Query params:
    - grade: filter by grade slug or id
    - duration_type: filter by duration (month, term, year)
    """

    queryset = Package.objects.filter(is_active=True)
    serializer_class = PackageSerializer
    permission_classes = [AllowAny]

    def get_queryset(self):
        queryset = super().get_queryset()

        grade = self.request.query_params.get("grade", None)
        if grade:
            queryset = queryset.filter(
                Q(grades__slug=grade) | Q(grades__id=grade) | Q(grades__isnull=True)
            ).distinct()

        duration_type = self.request.query_params.get("duration_type", None)
        if duration_type:
            queryset = queryset.filter(duration_type=duration_type)

        return queryset


class BookViewSet(viewsets.ReadOnlyModelViewSet):
    """
    ViewSet for Book model
    GET /api/landing/books/ - List all published books
    GET /api/landing/books/{id}/ - Get specific book

    Query params:
    - grade: filter by grade slug or id
    - term: filter by term
    - free: filter free books only (true/false)
    """

    queryset = Book.objects.filter(is_published=True)
    serializer_class = BookSerializer
    permission_classes = [AllowAny]

    def get_queryset(self):
        queryset = super().get_queryset()

        grade = self.request.query_params.get("grade", None)
        if grade:
            queryset = queryset.filter(Q(grades__slug=grade) | Q(grades__id=grade)).distinct()

        term = self.request.query_params.get("term", None)
        if term:
            queryset = queryset.filter(term__icontains=term)

        free = self.request.query_params.get("free", None)
        if free and free.lower() in ["true", "1", "yes"]:
            queryset = queryset.filter(price=0)

        return queryset


@api_view(["GET"])
@permission_classes([AllowAny])
def landing_data(request):
    """
    Combined endpoint that returns all landing page data in one call
    GET /api/landing/data/

    Optional query params:
    - grade: filter grade-specific content
    - limit_news: limit number of news items (default: 3)
    - limit_books: limit number of books (default: 8)
    """

    grade = request.query_params.get("grade", None)

    try:
        limit_news = int(request.query_params.get("limit_news", 3))
    except (TypeError, ValueError):
        limit_news = 3

    try:
        limit_books = int(request.query_params.get("limit_books", 8))
    except (TypeError, ValueError):
        limit_books = 8

    top_students = TopStudent.objects.filter(is_active=True)
    news = News.objects.filter(is_published=True)[:limit_news]

    packages = Package.objects.filter(is_active=True)
    if grade:
        packages = packages.filter(
            Q(grades__slug=grade) | Q(grades__id=grade) | Q(grades__isnull=True)
        ).distinct()

    books = Book.objects.filter(is_published=True)
    if grade:
        books = books.filter(Q(grades__slug=grade) | Q(grades__id=grade)).distinct()
    books = books[:limit_books]

    context = {"request": request}
    data = {
        "top_students": TopStudentSerializer(top_students, many=True, context=context).data,
        "news": NewsSerializer(news, many=True, context=context).data,
        "packages": PackageSerializer(packages, many=True, context=context).data,
        "books": BookSerializer(books, many=True, context=context).data,
    }

    return Response(data, status=status.HTTP_200_OK)
