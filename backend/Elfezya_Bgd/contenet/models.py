# from django.conf import settings
# from django.db import models
# from django.utils import timezone
# from django.contrib.auth import get_user_model
#
# User = get_user_model()
#
# class Lesson(models.Model):
#     # إذا عندك Lesson موجود غيّر هذا أو امزجه معه
#     title = models.CharField(max_length=255)
#     slug = models.SlugField(unique=True)
#     description = models.TextField(blank=True)
#     img = models.ImageField(upload_to="lessons/%Y/%m/", null=True, blank=True)
#     year = models.PositiveSmallIntegerField(default=1)
#     created_at = models.DateTimeField(auto_now_add=True)
#
#     def __str__(self):
#         return self.title
#
# class Container(models.Model):
#     """A 'container' inside a Lesson - e.g. Part 1, Part 2, ..."""
#     lesson = models.ForeignKey(Lesson, related_name="containers", on_delete=models.CASCADE)
#     title = models.CharField(max_length=255, blank=True)
#     description = models.TextField(blank=True)
#     order = models.PositiveIntegerField(default=0)
#
#     class Meta:
#         ordering = ("order",)
#
#     def __str__(self):
#         return f"{self.lesson.slug} — {self.title or f'Container {self.order}'}"
#
# class Quiz(models.Model):
#     """Represents both quick quizzes and final exams; linkable from Step"""
#     lesson = models.ForeignKey(Lesson, related_name="quizzes", on_delete=models.CASCADE, null=True, blank=True)
#     title = models.CharField(max_length=255)
#     description = models.TextField(blank=True)
#     time_limit_minutes = models.PositiveIntegerField(null=True, blank=True)
#     is_final = models.BooleanField(default=False)
#     created_at = models.DateTimeField(auto_now_add=True)
#
#     def __str__(self):
#         return self.title
#
# class Question(models.Model):
#     quiz = models.ForeignKey(Quiz, related_name="questions", on_delete=models.CASCADE)
#     text = models.TextField()
#     order = models.PositiveIntegerField(default=0)
#
#     class Meta:
#         ordering = ("order",)
#
#     def __str__(self):
#         return f"Q{self.order} ({self.quiz.title})"
#
# class Choice(models.Model):
#     question = models.ForeignKey(Question, related_name="choices", on_delete=models.CASCADE)
#     text = models.CharField(max_length=1024)
#     is_correct = models.BooleanField(default=False)
#     order = models.PositiveIntegerField(default=0)
#
#     class Meta:
#         ordering = ("order",)
#
#     def __str__(self):
#         return f"Choice {self.order} ({self.question})"
#
# class Step(models.Model):
#     STEP_TYPES = (
#         ("explain", "شرح"),
#         ("quick_quiz", "كويز سريع"),
#         ("solution_video", "فيديو حلول"),
#         ("final_quiz", "امتحان"),
#     )
#     container = models.ForeignKey(Container, related_name="steps", on_delete=models.CASCADE)
#     step_number = models.PositiveIntegerField(default=1)
#     type = models.CharField(max_length=32, choices=STEP_TYPES)
#     title = models.CharField(max_length=255, blank=True)
#     description = models.TextField(blank=True)
#     video_file = models.FileField(upload_to="content/videos/%Y/%m/", null=True, blank=True)
#     quiz = models.ForeignKey(Quiz, null=True, blank=True, on_delete=models.SET_NULL, related_name="linked_steps")
#     order = models.PositiveIntegerField(default=0)
#
#     class Meta:
#         ordering = ("order", "step_number")
#         unique_together = ("container", "step_number")
#
#     def __str__(self):
#         return f"{self.container} - step {self.step_number} ({self.type})"
#
# class QuizAttempt(models.Model):
#     quiz = models.ForeignKey(Quiz, related_name="attempts", on_delete=models.CASCADE)
#     user = models.ForeignKey(
#         settings.AUTH_USER_MODEL,
#         null=True,
#         blank=True,
#         on_delete=models.SET_NULL,
#         related_name="contenet_quiz_attempts",
#         related_query_name="contenet_quiz_attempts",
#     )
#     session_key = models.CharField(max_length=100, null=True, blank=True)
#     answers = models.JSONField(default=list)  # list of dicts {question, selected_choice, correct_choice, correct}
#     score = models.IntegerField(default=0)
#     total = models.IntegerField(default=0)
#     created_at = models.DateTimeField(auto_now_add=True)
#
#     def __str__(self):
#         owner = self.user.email if self.user else f"session:{self.session_key}"
#         return f"Attempt {self.id} - {owner} - {self.quiz.title}"
#
# class StudentProfile(models.Model):
#     """Optional: profile data for users (to store parent email, academic year, etc.)"""
#     user = models.OneToOneField(
#         settings.AUTH_USER_MODEL,
#         on_delete=models.CASCADE,
#         related_name="contenet_profile",
#         related_query_name="contenet_profile",
#     )
#     parent_email = models.EmailField(blank=True, null=True)
#     academic_year = models.PositiveSmallIntegerField(null=True, blank=True)
#
#     def __str__(self):
#         return f"Profile: {self.user.email}"
