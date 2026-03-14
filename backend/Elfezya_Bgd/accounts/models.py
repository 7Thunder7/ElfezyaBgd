# accounts/models.py
from django.db import models
from django.contrib.auth.base_user import BaseUserManager
from django.contrib.auth.models import AbstractUser
from django.conf import settings
from django.utils import timezone


class CustomUserManager(BaseUserManager):
    use_in_migrations = True

    def _create_user(self, username, email, password, **extra_fields):
        if not email and not username:
            raise ValueError("An email or username is required")
        email = self.normalize_email(email) if email else ""
        username = username or (email.split("@")[0] if email else None)
        user = self.model(username=username, email=email, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_user(self, username=None, email=None, password=None, **extra_fields):
        extra_fields.setdefault("is_staff", False)
        extra_fields.setdefault("is_superuser", False)
        return self._create_user(username, email, password, **extra_fields)

    def create_superuser(self, username=None, email=None, password=None, **extra_fields):
        extra_fields.setdefault("is_staff", True)
        extra_fields.setdefault("is_superuser", True)
        if extra_fields.get("is_staff") is not True or extra_fields.get("is_superuser") is not True:
            raise ValueError("Superuser must have is_staff=True and is_superuser=True.")
        return self._create_user(username, email, password, **extra_fields)


class CustomUser(AbstractUser):
    middle_name = models.CharField("middle name", max_length=150, blank=True)
    national_id = models.CharField("national id", max_length=50, blank=True, null=True)
    phone = models.CharField("phone", max_length=30, blank=True, null=True)
    gender = models.CharField("gender", max_length=20, blank=True, null=True)
    grade = models.CharField("grade", max_length=50, blank=True, null=True)
    division = models.CharField("division", max_length=120, blank=True, null=True)
    parent_email = models.EmailField("parent email", blank=True, null=True)
    parent_phone = models.CharField("parent phone", max_length=30, blank=True, null=True)
    governorate = models.CharField("governorate", max_length=120, blank=True, null=True)
    city = models.CharField("city", max_length=120, blank=True, null=True)
    parent_job = models.CharField("parent job", max_length=200, blank=True, null=True)

    current_session_key = models.CharField(max_length=64, blank=True, null=True)

    ROLE_CHOICES = (("student", "Student"), ("parent", "Parent"), ("admin", "Admin"))
    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default="student")

    objects = CustomUserManager()

    class Meta:
        verbose_name = "User"
        verbose_name_plural = "Users"

    def full_name(self):
        parts = [self.first_name, self.middle_name, self.last_name]
        return " ".join([p for p in parts if p]).strip()

    def __str__(self):
        return self.full_name() or self.email or self.username
