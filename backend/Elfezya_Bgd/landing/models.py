# landing/models.py
from django.db import models
from django.core.validators import MinValueValidator
from study.models import Grade


class TopStudent(models.Model):
    """Model for top students of the year (أوائل ثانوية عامة)"""
    title = models.CharField(max_length=200, default="أوائل ثانوية عامة")
    year = models.PositiveIntegerField(
        validators=[MinValueValidator(2020)],
        help_text="السنة الدراسية (مثلاً 2025)"
    )
    image = models.ImageField(
        upload_to="top_students/",
        help_text="صورة جماعية للأوائل"
    )
    description = models.TextField(
        blank=True,
        null=True,
        help_text="وصف اختياري"
    )
    order = models.PositiveIntegerField(
        default=0,
        help_text="ترتيب العرض (الأصغر يظهر أولاً)"
    )
    is_active = models.BooleanField(
        default=True,
        help_text="هل يظهر في الصفحة الرئيسية؟"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Top Student Image"
        verbose_name_plural = "Top Students Images"
        ordering = ["order", "-year"]

    def __str__(self):
        return f"{self.title} - {self.year}"


class News(models.Model):
    """Model for news and announcements (الأخبار والإعلانات)"""
    title = models.CharField(
        max_length=200,
        help_text="عنوان الخبر"
    )
    excerpt = models.TextField(
        max_length=500,
        help_text="ملخص قصير للخبر (يظهر في الكارد)"
    )
    content = models.TextField(
        blank=True,
        null=True,
        help_text="المحتوى الكامل للخبر (اختياري)"
    )
    image = models.ImageField(
        upload_to="news/",
        help_text="صورة الخبر"
    )
    date = models.DateField(
        help_text="تاريخ الخبر"
    )
    link = models.URLField(
        blank=True,
        null=True,
        help_text="رابط خارجي للخبر (اختياري)"
    )
    order = models.PositiveIntegerField(
        default=0,
        help_text="ترتيب العرض (الأصغر يظهر أولاً)"
    )
    is_published = models.BooleanField(
        default=True,
        help_text="هل منشور؟"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "News"
        verbose_name_plural = "News"
        ordering = ["order", "-date"]

    def __str__(self):
        return self.title


class Package(models.Model):
    """Model for subscription packages (الباقات)"""
    DURATION_CHOICES = [
        ("month", "شهر"),
        ("term", "ترم"),
        ("year", "سنة"),
    ]

    title = models.CharField(
        max_length=100,
        help_text="اسم الباقة (مثلاً: شهر، ترم، سنة)"
    )
    duration_type = models.CharField(
        max_length=20,
        choices=DURATION_CHOICES,
        default="month"
    )
    price = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        validators=[MinValueValidator(0)],
        help_text="السعر بالجنيه"
    )
    description = models.TextField(
        blank=True,
        null=True,
        help_text="وصف الباقة"
    )
    features = models.JSONField(
        default=list,
        help_text='قائمة المميزات ["الفيديوهات", "الاختبارات", "دعم فني"]'
    )
    is_popular = models.BooleanField(
        default=False,
        help_text="هل هي الباقة الأكثر شيوعاً؟"
    )
    grades = models.ManyToManyField(
        Grade,
        blank=True,
        related_name="packages",
        help_text="الصفوف المتاحة لهذه الباقة (اختياري)"
    )
    order = models.PositiveIntegerField(
        default=0,
        help_text="ترتيب العرض (الأصغر يظهر أولاً)"
    )
    is_active = models.BooleanField(
        default=True,
        help_text="هل متاحة للاشتراك؟"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Package"
        verbose_name_plural = "Packages"
        ordering = ["order", "price"]

    def __str__(self):
        return f"{self.title} - {self.price} جنيه"


class Book(models.Model):
    """Model for books (الكتب)"""
    title = models.CharField(
        max_length=200,
        help_text="اسم الكتاب"
    )
    description = models.TextField(
        blank=True,
        null=True,
        help_text="وصف الكتاب"
    )
    cover_image = models.ImageField(
        upload_to="books/",
        help_text="صورة غلاف الكتاب"
    )
    pdf_file = models.FileField(
        upload_to="books/pdfs/",
        blank=True,
        null=True,
        help_text="ملف الكتاب PDF (اختياري)"
    )
    external_link = models.URLField(
        blank=True,
        null=True,
        help_text="رابط خارجي للكتاب (اختياري)"
    )
    price = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        validators=[MinValueValidator(0)],
        default=0,
        help_text="سعر الكتاب (0 = مجاني)"
    )
    grades = models.ManyToManyField(
        Grade,
        related_name="books",
        help_text="الصفوف الدراسية المتاحة لها الكتاب"
    )
    term = models.CharField(
        max_length=50,
        blank=True,
        null=True,
        help_text="الترم (مثلاً: الترم الأول، الترم الثاني)"
    )
    order = models.PositiveIntegerField(
        default=0,
        help_text="ترتيب العرض (الأصغر يظهر أولاً)"
    )
    is_published = models.BooleanField(
        default=True,
        help_text="هل منشور؟"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Book"
        verbose_name_plural = "Books"
        ordering = ["order", "title"]

    def __str__(self):
        return self.title

    @property
    def is_free(self):
        return self.price == 0