# landing/views.py
from rest_framework import viewsets, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework.permissions import AllowAny
from django.db.models import Q

from .models import TopStudent, News, Package, Book
from .serializers import (
    TopStudentSerializer,
    NewsSerializer,
    PackageSerializer,
    BookSerializer,
    LandingDataSerializer
)


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

        # Filter by year if provided
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

        # Limit results if specified
        limit = self.request.query_params.get("limit", None)
        if limit:
            try:
                queryset = queryset[:int(limit)]
            except ValueError:
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

        # Filter by grade
        grade = self.request.query_params.get("grade", None)
        if grade:
            queryset = queryset.filter(
                Q(grades__slug=grade) | Q(grades__id=grade) | Q(grades__isnull=True)
            ).distinct()

        # Filter by duration type
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

        # Filter by grade
        grade = self.request.query_params.get("grade", None)
        if grade:
            queryset = queryset.filter(
                Q(grades__slug=grade) | Q(grades__id=grade)
            ).distinct()

        # Filter by term
        term = self.request.query_params.get("term", None)
        if term:
            queryset = queryset.filter(term__icontains=term)

        # Filter free books
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
    # Get query params
    grade = request.query_params.get("grade", None)
    limit_news = int(request.query_params.get("limit_news", 3))
    limit_books = int(request.query_params.get("limit_books", 8))

    # Fetch data
    top_students = TopStudent.objects.filter(is_active=True)
    news = News.objects.filter(is_published=True)[:limit_news]

    # Packages filtered by grade if provided
    packages = Package.objects.filter(is_active=True)
    if grade:
        packages = packages.filter(
            Q(grades__slug=grade) | Q(grades__id=grade) | Q(grades__isnull=True)
        ).distinct()

    # Books filtered by grade if provided
    books = Book.objects.filter(is_published=True)
    if grade:
        books = books.filter(
            Q(grades__slug=grade) | Q(grades__id=grade)
        ).distinct()
    books = books[:limit_books]

    # Serialize
    context = {"request": request}
    data = {
        "top_students": TopStudentSerializer(top_students, many=True, context=context).data,
        "news": NewsSerializer(news, many=True, context=context).data,
        "packages": PackageSerializer(packages, many=True, context=context).data,
        "books": BookSerializer(books, many=True, context=context).data,
    }

    return Response(data, status=status.HTTP_200_OK)