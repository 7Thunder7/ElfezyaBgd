# # study/admin.py
# from django.contrib import admin
# from django.contrib.admin.sites import AlreadyRegistered
# from django.contrib.auth.admin import UserAdmin
#
# # models from this app (study)
# from .models import Section, Lesson as StudyLesson, Resource, ReviewCard, Quiz as StudyQuiz, Question as StudyQuestion, Choice as StudyChoice
#
# # accounts app models
# from accounts.models import CustomUser, AuthEvent, Visit
#
# # content app (اسم التطبيق عندك يبدو "contenet" حسب traceback السابق)
# # نعَمِّل استيراد الموديلات تحت namespace لتجنّب التصادم بالأسماء
# try:
#     from contenet import models as content_models
# except Exception:
#     # لو اسم التطبيق مختلف، هذا السطر سيفشل؛ تبليغ للـ admin سيكون واضحاً في traceback
#     content_models = None
#
# # -------------------------
# # Helpers
# # -------------------------
# def register_if_not_registered(model, admin_class=None):
#     """Register model with admin.site, but ignore if already registered elsewhere."""
#     if model is None:
#         return
#     try:
#         if admin_class:
#             admin.site.register(model, admin_class)
#         else:
#             admin.site.register(model)
#     except AlreadyRegistered:
#         # تم التسجيل في مكان آخر — نتجاهل التسجيل المزدوج
#         pass
#
# # -------------------------
# # Study app admin classes
# # -------------------------
# @admin.register(Section)
# class SectionAdmin(admin.ModelAdmin):
#     list_display = ("title", "slug", "order", "created_at")
#     prepopulated_fields = {"slug": ("title",)}
#     search_fields = ("title", "slug")
#     ordering = ("order", "title")
#
#
# @admin.register(StudyLesson)
# class StudyLessonAdmin(admin.ModelAdmin):
#     list_display = ("title", "slug", "section", "is_quiz", "order", "published")
#     list_filter = ("section", "published", "is_quiz")
#     prepopulated_fields = {"slug": ("title",)}
#     search_fields = ("title", "slug", "section__title")
#     raw_id_fields = ("section",)
#
#
# @admin.register(Resource)
# class ResourceAdmin(admin.ModelAdmin):
#     list_display = ("title", "lesson", "uploaded_at")
#     raw_id_fields = ("lesson",)
#
#
# @admin.register(ReviewCard)
# class ReviewCardAdmin(admin.ModelAdmin):
#     list_display = ("title", "order", "published")
#     filter_horizontal = ("lessons",)
#
#
# # Quiz / Question / Choice for study app
# class StudyChoiceInline(admin.TabularInline):
#     model = StudyChoice
#     extra = 0
#
#
# class StudyQuestionInline(admin.StackedInline):
#     model = StudyQuestion
#     extra = 0
#
#
# @admin.register(StudyQuiz)
# class StudyQuizAdmin(admin.ModelAdmin):
#     list_display = ("lesson", "title", "time_limit_minutes")
#     inlines = [StudyQuestionInline]
#
#
# @admin.register(StudyQuestion)
# class StudyQuestionAdmin(admin.ModelAdmin):
#     inlines = [StudyChoiceInline]
#
#
# # -------------------------
# # CustomUser admin (top-level, not nested!)
# # -------------------------
# class CustomUserAdmin(UserAdmin):
#     model = CustomUser
#     # إضافة الحقول الإضافية كما في كودك الأصلي
#     fieldsets = UserAdmin.fieldsets + (
#         (
#             "Additional",
#             {
#                 "fields": (
#                     "middle_name",
#                     "national_id",
#                     "phone",
#                     "gender",
#                     "grade",
#                     "section",
#                     "parent_email",
#                     "parent_phone",
#                     "governorate",
#                     "city",
#                     "parent_job",
#                 )
#             },
#         ),
#     )
#
#
# # سجّل CustomUser و AuthEvent و Visit
# # نستخدم register_if_not_registered لتفادي AlreadyRegistered
# register_if_not_registered(CustomUser, CustomUserAdmin)
# register_if_not_registered(AuthEvent)
# register_if_not_registered(Visit)
#
# # -------------------------
# # content app admin (داخل namespace content_models)
# # -------------------------
# if content_models is not None:
#     # تعريفات Admin خاصة بموديلات الـ content (نسخ واضحة باسماء مختلفة لتجنب التضارب)
#     class ContentChoiceInline(admin.TabularInline):
#         model = getattr(content_models, "Choice", None)
#         extra = 1
#
#     class ContentQuestionAdmin(admin.ModelAdmin):
#         inlines = [ContentChoiceInline]
#         list_display = ("id", "quiz", "order", "text")
#
#     class ContentQuestionInline(admin.StackedInline):
#         model = getattr(content_models, "Question", None)
#         extra = 1
#
#     class ContentQuizAdmin(admin.ModelAdmin):
#         inlines = [ContentQuestionInline]
#         list_display = ("id", "title", "time_limit_minutes", "is_final", "created_at")
#
#     class ContentStepInline(admin.StackedInline):
#         model = getattr(content_models, "Step", None)
#         extra = 1
#
#     class ContentContainerAdmin(admin.ModelAdmin):
#         inlines = [ContentStepInline]
#         list_display = ("id", "lesson", "title", "order")
#
#     # الآن نسجل موديلات الـ content فقط إن لم تكن مسجلة بالفعل
#     register_if_not_registered(getattr(content_models, "Lesson", None))
#     register_if_not_registered(getattr(content_models, "Container", None), ContentContainerAdmin)
#     register_if_not_registered(getattr(content_models, "Step", None))
#     register_if_not_registered(getattr(content_models, "Quiz", None), ContentQuizAdmin)
#     register_if_not_registered(getattr(content_models, "Question", None), ContentQuestionAdmin)
#     register_if_not_registered(getattr(content_models, "Choice", None))
#     register_if_not_registered(getattr(content_models, "QuizAttempt", None))
#     register_if_not_registered(getattr(content_models, "StudentProfile", None))
#
# # End of file
