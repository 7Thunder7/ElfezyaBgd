# from rest_framework import serializers
# from .models import (
#     Container, Step, Quiz, Question, Choice, QuizAttempt, StudentProfile, Lesson
# )
# from django.contrib.auth import get_user_model
#
# User = get_user_model()
#
# # --- Read serializers for frontend (hide correctness) ---
# class ChoiceReadSerializer(serializers.ModelSerializer):
#     class Meta:
#         model = Choice
#         fields = ("id", "text", "order")  # DO NOT expose is_correct
#
# class QuestionReadSerializer(serializers.ModelSerializer):
#     choices = ChoiceReadSerializer(many=True, read_only=True)
#     class Meta:
#         model = Question
#         fields = ("id", "text", "order", "choices")
#
# class QuizReadSerializer(serializers.ModelSerializer):
#     questions = QuestionReadSerializer(many=True, read_only=True)
#     class Meta:
#         model = Quiz
#         fields = ("id", "title", "description", "time_limit_minutes", "is_final", "questions")
#
# class StepSerializer(serializers.ModelSerializer):
#     # include video URL if exists
#     video_url = serializers.SerializerMethodField()
#     quiz = QuizReadSerializer(read_only=True)
#     class Meta:
#         model = Step
#         fields = ("id", "step_number", "type", "title", "description", "video_url", "quiz", "order")
#
#     def get_video_url(self, obj):
#         request = self.context.get("request")
#         if obj.video_file:
#             return request.build_absolute_uri(obj.video_file.url) if request else obj.video_file.url
#         return None
#
# class ContainerSerializer(serializers.ModelSerializer):
#     steps = StepSerializer(many=True, read_only=True)
#     class Meta:
#         model = Container
#         fields = ("id", "lesson", "title", "description", "order", "steps")
#
# # --- Admin/write serializers (allow is_correct) ---
# class ChoiceAdminSerializer(serializers.ModelSerializer):
#     class Meta:
#         model = Choice
#         fields = ("id", "text", "is_correct", "order")
#
# class QuestionAdminSerializer(serializers.ModelSerializer):
#     choices = ChoiceAdminSerializer(many=True)
#     class Meta:
#         model = Question
#         fields = ("id", "text", "order", "choices")
#
#     def create(self, validated_data):
#         choices = validated_data.pop("choices", [])
#         q = Question.objects.create(**validated_data)
#         for c in choices:
#             Choice.objects.create(question=q, **c)
#         return q
#
#     def update(self, instance, validated_data):
#         choices = validated_data.pop("choices", None)
#         instance.text = validated_data.get("text", instance.text)
#         instance.order = validated_data.get("order", instance.order)
#         instance.save()
#         if choices is not None:
#             instance.choices.all().delete()
#             for c in choices:
#                 Choice.objects.create(question=instance, **c)
#         return instance
#
# class QuizAdminSerializer(serializers.ModelSerializer):
#     questions = QuestionAdminSerializer(many=True, required=False)
#     class Meta:
#         model = Quiz
#         fields = ("id", "lesson", "title", "description", "time_limit_minutes", "is_final", "questions")
#
#     def create(self, validated_data):
#         qs = validated_data.pop("questions", [])
#         quiz = Quiz.objects.create(**validated_data)
#         for q in qs:
#             choices = q.pop("choices", [])
#             question = Question.objects.create(quiz=quiz, **q)
#             for c in choices:
#                 Choice.objects.create(question=question, **c)
#         return quiz
#
# class QuizAttemptSerializer(serializers.ModelSerializer):
#     class Meta:
#         model = QuizAttempt
#         fields = ("id","quiz","user","session_key","answers","score","total","created_at")
#         read_only_fields = ("score","total","created_at")
