# study/models.py
from django.db import models
from django.conf import settings
from django.contrib.auth import get_user_model

class Grade(models.Model):
    """
    Represents a school grade / class level (e.g. "Grade 7", "الصف الأول الثانوي").
    Use slug to query from frontend (e.g. ?grade=grade-7).
    """
    name = models.CharField(max_length=255)
    slug = models.SlugField(max_length=255, unique=True, db_index=True)
    order = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ("order", "name")

    def __str__(self):
        return self.name


class Section(models.Model):
    title = models.CharField(max_length=255)
    slug = models.SlugField(max_length=255, unique=True, db_index=True)
    order = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    # new: which grades this section applies to (can be empty = applies to all / or you enforce)
    grades = models.ManyToManyField(Grade, related_name="sections", blank=True)

    class Meta:
        ordering = ("order", "title")

    def __str__(self):
        return self.title

    def lessons_for_grade(self, grade):
        """
        Return lessons in this section that are assigned to `grade`.
        If you want 'section-level' assignment only (i.e. when section has grades and lessons are global),
        adjust logic accordingly. Current behavior: filter lessons by lesson.grades or fallback.
        """
        # If lessons themselves are assigned to grades, prefer that filter:
        return self.lessons.filter(models.Q(grades=grade) | models.Q(grades__isnull=True)).distinct()


class Lesson(models.Model):
    section = models.ForeignKey(Section, related_name="lessons", on_delete=models.CASCADE)
    title = models.CharField(max_length=255)
    slug = models.SlugField(max_length=255, db_index=True)
    short_description = models.CharField(max_length=400, blank=True)
    thumbnail_url = models.CharField(max_length=2000, blank=True, null=True)
    order = models.PositiveIntegerField(default=0)
    published = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    # new: which grades this lesson applies to
    grades = models.ManyToManyField(Grade, related_name="lessons", blank=True)

    class Meta:
        ordering = ("order", "title")
        unique_together = ("section", "slug")

    def __str__(self):
        return f"{self.section.title} — {self.title}"


class LessonPart(models.Model):
    lesson = models.ForeignKey(Lesson, related_name="parts", on_delete=models.CASCADE)
    title = models.CharField(max_length=255)
    slug = models.SlugField(max_length=255, db_index=True, blank=True)
    order = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ("order", "title")
        unique_together = ("lesson", "slug")

    def __str__(self):
        return f"{self.lesson.title} — {self.title}"


class LessonVideo(models.Model):
    KIND_CHOICES = (
        ("exp", "explain"),
        ("sol", "solution"),
        ("rev", "revision")  # Add this line
    )
    lesson = models.ForeignKey(Lesson, related_name="videos", on_delete=models.CASCADE)
    part = models.ForeignKey(LessonPart, related_name="videos", on_delete=models.SET_NULL, null=True, blank=True)
    kind = models.CharField(max_length=10, choices=KIND_CHOICES, default="exp")
    title = models.CharField(max_length=255, blank=True)
    url = models.CharField(max_length=2000)
    duration_seconds = models.PositiveIntegerField(null=True, blank=True)
    position = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ("position",)

    def __str__(self):
        if self.title:
            return self.title
        if self.part:
            return f"{self.lesson.title} — {self.part.title} — video"
        return f"{self.lesson.title} — video"


class Exam(models.Model):
    KIND_CHOICES = (
        ("exp", "explain"),
        ("rev", "revision")
    )

    # Make lesson nullable for revision exams
    lesson = models.ForeignKey(
        Lesson,
        related_name="exams",
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        help_text="الدرس المرتبط (إلزامي للامتحانات الشرح، اختياري للمراجعة)"
    )

    # Link exam to a specific lesson part (already nullable)
    part = models.ForeignKey(
        LessonPart,
        related_name="exams",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        help_text="Which lesson part this exam belongs to"
    )

    # Add kind field
    kind = models.CharField(
        max_length=10,
        choices=KIND_CHOICES,
        default="exp",
        help_text="نوع الامتحان: شرح أو مراجعة"
    )

    title = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    duration_minutes = models.PositiveIntegerField(null=True, blank=True)
    timer_enabled = models.BooleanField(default=True)
    auto_submit_on_expire = models.BooleanField(default=True)
    is_published = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    # order: 0 for quick exam, 1 for full exam
    order = models.PositiveIntegerField(
        default=0,
        help_text="0 = Quick Exam (before solution video), 1 = Full Exam (after solution video)"
    )

    # grades this exam applies to
    grades = models.ManyToManyField(Grade, related_name="exams", blank=True)

    class Meta:
        ordering = ("order", "title")

    def __str__(self):
        part_info = f" — {self.part.title}" if self.part else ""
        lesson_info = f" — {self.lesson.title}" if self.lesson else ""
        order_type = "Quick" if self.order == 0 else "Full"
        kind_display = dict(self.KIND_CHOICES).get(self.kind, self.kind)

        if self.kind == "rev":
            # For revision exams, don't show lesson/part info
            return f"{self.title} ({kind_display})"
        else:
            # For explain exams, show lesson/part info
            return f"{self.title} ({order_type} - {kind_display}){lesson_info}{part_info}"

    def clean(self):
        """Validation: explain exams must have a lesson"""
        from django.core.exceptions import ValidationError
        if self.kind == "exp" and not self.lesson:
            raise ValidationError({
                'lesson': 'امتحانات الشرح يجب أن تكون مرتبطة بدرس معين (Explain exams must have a lesson)'
            })

    def save(self, *args, **kwargs):
        self.full_clean()  # Run validation before saving
        super().save(*args, **kwargs)

class Question(models.Model):
    TYPE_CHOICES = (
        ("mcq_single", "MCQ single"),
        ("mcq_multi", "MCQ multiple"),
        ("tf", "True/False"),
        ("essay", "Essay"),
    )
    exam = models.ForeignKey(Exam, related_name="questions", on_delete=models.CASCADE)
    text = models.TextField()
    qtype = models.CharField(max_length=20, choices=TYPE_CHOICES, default="mcq_single")
    marks = models.DecimalField(max_digits=6, decimal_places=2, default=1)
    order = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ("order",)

    def __str__(self):
        return f"Q{self.order + 1}: {self.text[:50]}"


class Choice(models.Model):
    question = models.ForeignKey(Question, related_name="choices", on_delete=models.CASCADE)
    text = models.CharField(max_length=1000)
    is_correct = models.BooleanField(default=False)
    order = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ("order",)

    def __str__(self):
        return f"{self.text[:50]} ({'✓' if self.is_correct else '✗'})"


class ExamAttempt(models.Model):
    STATUS = (("in_progress", "in_progress"), ("submitted", "submitted"), ("graded", "graded"),
              ("auto_submitted", "auto_submitted"))
    exam = models.ForeignKey(Exam, related_name="attempts", on_delete=models.CASCADE)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    started_at = models.DateTimeField(auto_now_add=True)
    finished_at = models.DateTimeField(null=True, blank=True)
    status = models.CharField(max_length=30, choices=STATUS, default="in_progress")
    calculated_score = models.DecimalField(max_digits=8, decimal_places=2, null=True, blank=True)
    raw_answers = models.JSONField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.user} - {self.exam} - {self.id}"


class Revision(models.Model):
    """
    Revision materials - videos and photos for review
    """
    title = models.CharField(max_length=255)
    slug = models.SlugField(max_length=255, db_index=True, blank=True)

    video_link = models.URLField(max_length=2000, blank=True, null=True, help_text="رابط فيديو المراجعة")
    photo_link = models.URLField(max_length=2000, blank=True, null=True, help_text="رابط صورة المراجعة")

    # New: Upload photo from PC
    photo_file = models.ImageField(
        upload_to="revisions/photos/%Y/%m/",
        blank=True,
        null=True,
        help_text="ارفع صورة من الجهاز (اختياري - سيتم استخدامها بدلاً من الرابط إذا وجدت)"
    )

    # Optional: link to a specific lesson
    lesson = models.ForeignKey(
        Lesson,
        related_name="revisions",
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        help_text="الدرس المرتبط (اختياري)"
    )

    # Which grades this revision applies to
    grades = models.ManyToManyField(Grade, related_name="revisions", blank=True)

    order = models.PositiveIntegerField(default=0)
    is_published = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("order", "title")

    def __str__(self):
        return self.title

    def save(self, *args, **kwargs):
        # Auto-generate slug from title if not provided
        if not self.slug:
            from django.utils.text import slugify
            base_slug = slugify(self.title, allow_unicode=True)
            if not base_slug:
                base_slug = f"revision-{self.id or 'new'}"

            slug = base_slug
            counter = 1
            while Revision.objects.filter(slug=slug).exclude(pk=self.pk).exists():
                slug = f"{base_slug}-{counter}"
                counter += 1

            self.slug = slug

        super().save(*args, **kwargs)

    def get_photo_url(self):
        """Return photo file URL if uploaded, otherwise return photo_link"""
        if self.photo_file:
            return self.photo_file.url
        return self.photo_link

class StudentAnswer(models.Model):
    attempt = models.ForeignKey(ExamAttempt, related_name="answers", on_delete=models.CASCADE)
    question = models.ForeignKey(Question, on_delete=models.CASCADE)
    selected_choice_id = models.PositiveIntegerField(null=True, blank=True)
    selected_choice_ids = models.JSONField(null=True, blank=True)
    text_answer = models.TextField(blank=True, null=True)
    obtained_marks = models.DecimalField(max_digits=6, decimal_places=2, null=True, blank=True)
    answered_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Answer to {self.question.text[:30]} by {self.attempt.user}"




User = get_user_model()

class SingleVideo(models.Model):
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    price = models.DecimalField(max_digits=8, decimal_places=2)
    is_free = models.BooleanField(default=False)
    group_title = models.CharField(max_length=255, blank=True)
    video_url = models.URLField()
    created_by = models.ForeignKey(User, on_delete=models.CASCADE)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.title

class PaidExam(models.Model):
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    price = models.DecimalField(max_digits=8, decimal_places=2)
    is_free = models.BooleanField(default=False)
    exam_ref = models.ForeignKey(Exam, on_delete=models.CASCADE)

    def __str__(self):
        return self.title

class StudentPurchase(models.Model):
    student = models.ForeignKey(User, on_delete=models.CASCADE)
    video = models.ForeignKey(SingleVideo, null=True, blank=True, on_delete=models.CASCADE)
    exam = models.ForeignKey(PaidExam, null=True, blank=True, on_delete=models.CASCADE)
    paid = models.BooleanField(default=True)
    purchase_date = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        if self.video:
            return f"{self.student.username} - Video: {self.video.title}"
        elif self.exam:
            return f"{self.student.username} - Exam: {self.exam.title}"
        return f"{self.student.username} - Unknown Purchase"
