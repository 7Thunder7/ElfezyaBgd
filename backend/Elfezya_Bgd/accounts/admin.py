# accounts/admin.py
from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as DjangoUserAdmin
from django.utils.translation import gettext_lazy as _
from django.apps import apps
from django.contrib import admin
from django.utils.html import format_html
from  landing.models import TopStudent, News, Package, Book

from .models import CustomUser

# import study models
from study.models import (
    Grade,
    Section,
    Lesson,
    LessonPart,
    LessonVideo,
    Exam,
    Question,
    Choice,
    ExamAttempt,
    StudentAnswer,
    Revision,
SingleVideo, PaidExam, StudentPurchase
)

# حاول استخدام django-nested-admin إذا كان متاحًا لتحسين تجربة nested inlines
try:
    import nested_admin
    NESTED_ADMIN_AVAILABLE = True
except Exception:
    NESTED_ADMIN_AVAILABLE = False


@admin.register(CustomUser)
class CustomUserAdmin(DjangoUserAdmin):
    fieldsets = (
        (None, {"fields": ("username", "password")}),
        (_("Personal info"), {"fields": ("first_name", "middle_name", "last_name", "email", "phone")}),
        (_("Profile"), {"fields": ("national_id", "gender", "grade", "division", "parent_email", "parent_phone", "governorate", "city", "parent_job", "role", "current_session_key")}),
        (_("Permissions"), {"fields": ("is_active", "is_staff", "is_superuser", "groups", "user_permissions")}),
        (_("Important dates"), {"fields": ("last_login", "date_joined")}),
    )

    add_fieldsets = DjangoUserAdmin.add_fieldsets + (
        (_("Extra profile"), {"fields": ("middle_name", "national_id", "phone", "grade", "division")}),
    )

    list_display = ("id", "email", "username", "first_name", "middle_name", "last_name", "grade", "division", "is_staff")
    search_fields = ("email", "username", "first_name", "last_name", "national_id")
    ordering = ("-date_joined",)


@admin.register(Grade)
class GradeAdmin(admin.ModelAdmin):
    list_display = ("name", "slug", "order", "created_at")
    search_fields = ("name", "slug")
    prepopulated_fields = {"slug": ("name",)}
    readonly_fields = ("created_at",)
    ordering = ("order", "name")


@admin.register(Section)
class SectionAdmin(admin.ModelAdmin):
    list_display = ("title", "slug", "get_grades", "order", "created_at")
    list_editable = ("order",)
    search_fields = ("title", "slug", "grades__name")
    prepopulated_fields = {"slug": ("title",)}
    readonly_fields = ("created_at",)
    ordering = ("order", "title")
    filter_horizontal = ("grades",)

    def get_grades(self, obj):
        return ", ".join([g.name for g in obj.grades.all()])
    get_grades.short_description = "Grades"


# ========== INLINES ONLY (لن تظهر في القائمة الرئيسية) ==========

class LessonPartInline(admin.TabularInline):
    model = LessonPart
    extra = 0
    fields = ("title", "slug", "order")
    prepopulated_fields = {"slug": ("title",)}
    show_change_link = True


class LessonVideoInline(admin.TabularInline):
    model = LessonVideo
    extra = 0
    fields = ("part", "kind", "title", "url", "duration_seconds", "position")
    raw_id_fields = ("part",)
    show_change_link = True


@admin.register(Lesson)
class LessonAdmin(admin.ModelAdmin):
    list_display = ("title", "section", "slug", "get_grades", "order", "published", "created_at")
    list_filter = ("section", "published",)
    inlines = [LessonPartInline, LessonVideoInline]
    search_fields = ("title", "section__title", "slug", "grades__name")
    ordering = ("section__title", "order")
    prepopulated_fields = {"slug": ("title",)}
    raw_id_fields = ("section",)
    readonly_fields = ("created_at",)
    filter_horizontal = ("grades",)

    def get_grades(self, obj):
        return ", ".join([g.name for g in obj.grades.all()])
    get_grades.short_description = "Grades"


# ---------- Exam / Question / Choice admin: support nested inlines if possible ----------

if NESTED_ADMIN_AVAILABLE:
    # Using django-nested-admin to allow choices inside questions inside exams
    class ChoiceInline(nested_admin.NestedTabularInline):
        model = Choice
        fk_name = "question"
        extra = 0
        fields = ("text", "is_correct", "order")

    class QuestionInline(nested_admin.NestedStackedInline):
        model = Question
        fk_name = "exam"
        inlines = [ChoiceInline]
        extra = 0
        fields = ("text", "qtype", "marks", "order")
        show_change_link = True

    @admin.register(Exam)
    class ExamAdmin(nested_admin.NestedModelAdmin):
        list_display = ("title", "kind", "lesson", "get_grades", "duration_minutes", "is_published", "order", "created_at")
        inlines = [QuestionInline]
        search_fields = ("title", "lesson__title", "grades__name")
        raw_id_fields = ("lesson", "part")
        list_filter = ("is_published", "kind", "order")
        list_editable = ("order", "is_published")
        readonly_fields = ("created_at",)
        filter_horizontal = ("grades",)

        def get_grades(self, obj):
            return ", ".join([g.name for g in obj.grades.all()])
        get_grades.short_description = "Grades"

        fieldsets = (
            ("Basic Information", {
                "fields": ("title", "description", "kind", "order", "is_published")
            }),
            ("Relations", {
                "fields": ("lesson", "part", "grades"),
                "description": "ملاحظة: امتحانات المراجعة لا تحتاج لدرس محدد، امتحانات الشرح يجب أن تكون مرتبطة بدرس"
            }),
            ("Exam Settings", {
                "fields": ("duration_minutes", "timer_enabled", "auto_submit_on_expire")
            }),
            ("Timestamps", {
                "fields": ("created_at",),
                "classes": ("collapse",)
            }),
        )

else:
    # Fallback: regular inlines (questions inline under exam). Choices are edited via QuestionAdmin.
    class ChoiceInline(admin.TabularInline):
        model = Choice
        extra = 0
        fields = ("text", "is_correct", "order")

    class QuestionInline(admin.StackedInline):
        model = Question
        extra = 0
        fields = ("text", "qtype", "marks", "order")
        show_change_link = True

    @admin.register(Exam)
    class ExamAdmin(admin.ModelAdmin):
        list_display = ("title", "kind", "lesson", "get_grades", "duration_minutes", "is_published", "order", "created_at")
        inlines = [QuestionInline]
        search_fields = ("title", "lesson__title", "grades__name")
        raw_id_fields = ("lesson", "part")
        list_filter = ("is_published", "kind", "order")
        list_editable = ("order", "is_published")
        readonly_fields = ("created_at",)
        filter_horizontal = ("grades",)

        def get_grades(self, obj):
            return ", ".join([g.name for g in obj.grades.all()])
        get_grades.short_description = "Grades"

        fieldsets = (
            ("Basic Information", {
                "fields": ("title", "description", "kind", "order", "is_published")
            }),
            ("Relations", {
                "fields": ("lesson", "part", "grades"),
                "description": "ملاحظة: امتحانات المراجعة لا تحتاج لدرس محدد، امتحانات الشرح يجب أن تكون مرتبطة بدرس"
            }),
            ("Exam Settings", {
                "fields": ("duration_minutes", "timer_enabled", "auto_submit_on_expire")
            }),
            ("Timestamps", {
                "fields": ("created_at",),
                "classes": ("collapse",)
            }),
        )


# ========== REMOVED FROM MAIN ADMIN LIST ==========
# These are now only accessible as inlines within their parent models:
# - Question (inline in Exam)
# - Choice (inline in Question)
# - LessonVideo (inline in Lesson)
# - StudentAnswer (inline in ExamAttempt if needed)

# If you still want to access them directly in rare cases, you can uncomment:
# @admin.register(Question)
# @admin.register(Choice)
# @admin.register(LessonVideo)
# @admin.register(StudentAnswer)


@admin.register(ExamAttempt)
class ExamAttemptAdmin(admin.ModelAdmin):
    list_display = ("id", "exam", "user", "status", "calculated_score", "started_at", "finished_at")
    readonly_fields = ("raw_answers", "created_at")
    search_fields = ("user__username", "exam__title")
    list_filter = ("status",)


# LessonPart admin (kept because it's useful to manage parts directly)
@admin.register(LessonPart)
class LessonPartAdmin(admin.ModelAdmin):
    list_display = ("id", "title", "lesson", "order", "created_at")
    list_filter = ("lesson",)
    search_fields = ("title", "lesson__title")
    prepopulated_fields = {"slug": ("title",)}
    raw_id_fields = ("lesson",)


@admin.register(Revision)
class RevisionAdmin(admin.ModelAdmin):
    list_display = ("id", "title", "slug", "lesson", "get_grades", "has_photo", "order", "is_published", "created_at", "updated_at")
    list_filter = ("is_published", "grades", "lesson")
    list_editable = ("order", "is_published")
    search_fields = ("title", "slug", "lesson__title", "grades__name")
    prepopulated_fields = {"slug": ("title",)}
    readonly_fields = ("created_at", "updated_at", "preview_photo")
    filter_horizontal = ("grades",)
    raw_id_fields = ("lesson",)
    ordering = ("order", "title")

    def get_grades(self, obj):
        return ", ".join([g.name for g in obj.grades.all()])
    get_grades.short_description = "Grades"

    def has_photo(self, obj):
        """Show if revision has a photo (file or link)"""
        if obj.photo_file:
            return "✓ File"
        elif obj.photo_link:
            return "✓ Link"
        return "✗"
    has_photo.short_description = "Photo"

    def preview_photo(self, obj):
        """Show photo preview in admin"""
        from django.utils.html import format_html
        if obj.photo_file:
            return format_html('<img src="{}" style="max-width: 300px; max-height: 300px;" />', obj.photo_file.url)
        elif obj.photo_link:
            return format_html('<img src="{}" style="max-width: 300px; max-height: 300px;" />', obj.photo_link)
        return "No photo"
    preview_photo.short_description = "Photo Preview"

    fieldsets = (
        ("Basic Information", {
            "fields": ("title", "slug", "order", "is_published")
        }),
        ("Content Links", {
            "fields": ("video_link", "photo_link", "photo_file", "preview_photo")
        }),
        ("Relations", {
            "fields": ("lesson", "grades")
        }),
        ("Timestamps", {
            "fields": ("created_at", "updated_at"),
            "classes": ("collapse",)
        }),
    )

    @admin.register(TopStudent)
    class TopStudentAdmin(admin.ModelAdmin):
        list_display = ("title", "year", "preview_image", "order", "is_active", "created_at")
        list_filter = ("year", "is_active")
        list_editable = ("order", "is_active")
        search_fields = ("title", "year", "description")
        readonly_fields = ("created_at", "updated_at", "image_preview")
        ordering = ("order", "-year")

        fieldsets = (
            ("Basic Information", {
                "fields": ("title", "year", "description")
            }),
            ("Image", {
                "fields": ("image", "image_preview")
            }),
            ("Display Settings", {
                "fields": ("order", "is_active")
            }),
            ("Timestamps", {
                "fields": ("created_at", "updated_at"),
                "classes": ("collapse",)
            }),
        )

        def preview_image(self, obj):
            """Small preview in list"""
            if obj.image:
                return format_html(
                    '<img src="{}" style="width: 50px; height: 50px; object-fit: cover; border-radius: 4px;" />',
                    obj.image.url
                )
            return "No image"

        preview_image.short_description = "Preview"

        def image_preview(self, obj):
            """Large preview in detail view"""
            if obj.image:
                return format_html(
                    '<img src="{}" style="max-width: 500px; max-height: 500px; object-fit: contain;" />',
                    obj.image.url
                )
            return "No image"

        image_preview.short_description = "Image Preview"

    @admin.register(News)
    class NewsAdmin(admin.ModelAdmin):
        list_display = ("title", "date", "preview_image", "order", "is_published", "created_at")
        list_filter = ("is_published", "date")
        list_editable = ("order", "is_published")
        search_fields = ("title", "excerpt", "content")
        readonly_fields = ("created_at", "updated_at", "image_preview")
        ordering = ("order", "-date")
        date_hierarchy = "date"

        fieldsets = (
            ("Basic Information", {
                "fields": ("title", "date")
            }),
            ("Content", {
                "fields": ("excerpt", "content", "link")
            }),
            ("Image", {
                "fields": ("image", "image_preview")
            }),
            ("Display Settings", {
                "fields": ("order", "is_published")
            }),
            ("Timestamps", {
                "fields": ("created_at", "updated_at"),
                "classes": ("collapse",)
            }),
        )

        def preview_image(self, obj):
            if obj.image:
                return format_html(
                    '<img src="{}" style="width: 50px; height: 50px; object-fit: cover; border-radius: 4px;" />',
                    obj.image.url
                )
            return "No image"

        preview_image.short_description = "Preview"

        def image_preview(self, obj):
            if obj.image:
                return format_html(
                    '<img src="{}" style="max-width: 400px; max-height: 300px; object-fit: contain;" />',
                    obj.image.url
                )
            return "No image"

        image_preview.short_description = "Image Preview"

    @admin.register(Package)
    class PackageAdmin(admin.ModelAdmin):
        list_display = ("title", "duration_type", "price", "is_popular", "get_grades", "order", "is_active")
        list_filter = ("duration_type", "is_popular", "is_active")
        list_editable = ("order", "is_active", "is_popular")
        search_fields = ("title", "description")
        filter_horizontal = ("grades",)
        readonly_fields = ("created_at", "updated_at", "features_preview")
        ordering = ("order", "price")

        fieldsets = (
            ("Basic Information", {
                "fields": ("title", "duration_type", "price", "description")
            }),
            ("Features", {
                "fields": ("features", "features_preview"),
                "description": 'أدخل المميزات كقائمة JSON مثلاً: ["الفيديوهات", "الاختبارات", "دعم فني"]'
            }),
            ("Grades", {
                "fields": ("grades",)
            }),
            ("Display Settings", {
                "fields": ("is_popular", "order", "is_active")
            }),
            ("Timestamps", {
                "fields": ("created_at", "updated_at"),
                "classes": ("collapse",)
            }),
        )

        def get_grades(self, obj):
            return ", ".join([g.name for g in obj.grades.all()]) or "All grades"

        get_grades.short_description = "Grades"

        def features_preview(self, obj):
            """Display features in a readable format"""
            if obj.features:
                features_html = "<ul style='margin: 0; padding-left: 20px;'>"
                for feature in obj.features:
                    features_html += f"<li>{feature}</li>"
                features_html += "</ul>"
                return format_html(features_html)
            return "No features"

        features_preview.short_description = "Features Preview"

    @admin.register(Book)
    class BookAdmin(admin.ModelAdmin):
        list_display = ("title", "preview_cover", "price", "get_grades", "term", "order", "is_published")
        list_filter = ("is_published", "grades", "term", "price")
        list_editable = ("order", "is_published")
        search_fields = ("title", "description", "term")
        filter_horizontal = ("grades",)
        readonly_fields = ("created_at", "updated_at", "cover_preview", "is_free")
        ordering = ("order", "title")

        fieldsets = (
            ("Basic Information", {
                "fields": ("title", "description", "term")
            }),
            ("Cover Image", {
                "fields": ("cover_image", "cover_preview")
            }),
            ("Files & Links", {
                "fields": ("pdf_file", "external_link"),
                "description": "يمكنك رفع ملف PDF أو إضافة رابط خارجي أو كليهما"
            }),
            ("Pricing", {
                "fields": ("price", "is_free")
            }),
            ("Grades", {
                "fields": ("grades",)
            }),
            ("Display Settings", {
                "fields": ("order", "is_published")
            }),
            ("Timestamps", {
                "fields": ("created_at", "updated_at"),
                "classes": ("collapse",)
            }),
        )

        def preview_cover(self, obj):
            if obj.cover_image:
                return format_html(
                    '<img src="{}" style="width: 50px; height: 70px; object-fit: cover; border-radius: 4px;" />',
                    obj.cover_image.url
                )
            return "No cover"

        preview_cover.short_description = "Cover"

        def cover_preview(self, obj):
            if obj.cover_image:
                return format_html(
                    '<img src="{}" style="max-width: 300px; max-height: 400px; object-fit: contain;" />',
                    obj.cover_image.url
                )
            return "No cover"

        cover_preview.short_description = "Cover Preview"

        def get_grades(self, obj):
            return ", ".join([g.name for g in obj.grades.all()]) or "No grades"

        get_grades.short_description = "Grades"

@admin.register(SingleVideo)
class SingleVideoAdmin(admin.ModelAdmin):
    list_display = ('title', 'group_title', 'price', 'is_free', 'created_by', 'created_at')
    list_filter = ('is_free', 'group_title')
    search_fields = ('title', 'group_title', 'created_by__username')

@admin.register(PaidExam)
class PaidExamAdmin(admin.ModelAdmin):
    list_display = ('title', 'price', 'is_free', 'exam_ref')
    list_filter = ('is_free',)
    search_fields = ('title',)

@admin.register(StudentPurchase)
class StudentPurchaseAdmin(admin.ModelAdmin):
    list_display = ('student', 'video', 'exam', 'paid', 'purchase_date')
    list_filter = ('paid',)
    search_fields = ('student__username', 'video__title', 'exam__title')