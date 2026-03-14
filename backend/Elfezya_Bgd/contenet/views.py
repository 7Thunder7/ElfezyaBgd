# from rest_framework import viewsets, permissions, status
# from rest_framework.decorators import action, api_view, permission_classes
# from rest_framework.response import Response
# from django.shortcuts import get_object_or_404
# from django.core.mail import send_mail
# from django.conf import settings
# from django.db import transaction
#
# from .models import Container, Step, Quiz, Question, Choice, QuizAttempt, StudentProfile, Lesson
# from .serializers import (
#     ContainerSerializer, StepSerializer, QuizReadSerializer,
#     QuizAdminSerializer, QuizAttemptSerializer
# )
#
# # Containers & Steps (admin CRUD)
# class ContainerViewSet(viewsets.ModelViewSet):
#     queryset = Container.objects.all().order_by("lesson", "order")
#     serializer_class = ContainerSerializer
#
#     def get_permissions(self):
#         if self.action in ("list", "retrieve"):
#             return [permissions.AllowAny()]
#         return [permissions.IsAdminUser()]
#
# # Quiz viewset: read for anyone, write for admins
# class QuizViewSet(viewsets.ModelViewSet):
#     queryset = Quiz.objects.all().order_by("created_at")
#     def get_serializer_class(self):
#         if self.request.method in ("GET",):
#             return QuizReadSerializer
#         return QuizAdminSerializer
#
#     def get_permissions(self):
#         if self.request.method in ("GET",):
#             return [permissions.AllowAny()]
#         return [permissions.IsAdminUser()]
#
# # submit grading endpoint
# @api_view(["POST"])
# @permission_classes([permissions.AllowAny])
# def quiz_submit(request, pk):
#     """
#     POST /api/quizzes/<pk>/submit/
#     Payload example:
#     {
#       "answers": [{"question": 11, "choice": 101}, ...],
#       "auto": false
#     }
#     """
#     quiz = get_object_or_404(Quiz, pk=pk)
#     data = request.data or {}
#     answers_in = data.get("answers", [])
#     user = request.user if request.user.is_authenticated else None
#     session_key = None
#     if not user:
#         if not request.session.session_key:
#             request.session.save()
#         session_key = request.session.session_key
#
#     per_q = []
#     score = 0
#     total = 0
#
#     # Fetch all correct choices once
#     correct_map = {}
#     for question in quiz.questions.prefetch_related("choices").all():
#         correct_choice = None
#         for c in question.choices.all():
#             if c.is_correct:
#                 correct_choice = c.id
#                 break
#         correct_map[question.id] = correct_choice
#
#     for item in answers_in:
#         qid = item.get("question")
#         choice_id = item.get("choice")
#         try:
#             question = Question.objects.get(pk=qid, quiz=quiz)
#         except Question.DoesNotExist:
#             continue
#         total += 1
#         selected_choice_id = None
#         if choice_id:
#             # ensure choice belongs to question
#             if Choice.objects.filter(pk=choice_id, question=question).exists():
#                 selected_choice_id = choice_id
#         correct_choice_id = correct_map.get(question.id)
#         correct = (selected_choice_id is not None and correct_choice_id is not None and selected_choice_id == correct_choice_id)
#         if correct:
#             score += 1
#         per_q.append({
#             "question": question.id,
#             "selected_choice": selected_choice_id,
#             "correct_choice": correct_choice_id,
#             "correct": correct,
#         })
#
#     # persist attempt
#     attempt = QuizAttempt.objects.create(
#         quiz=quiz,
#         user=user if user else None,
#         session_key=session_key if not user else None,
#         answers=per_q,
#         score=score,
#         total=total,
#     )
#
#     # send email to parent if exists
#     parent_email = None
#     if user:
#         profile = getattr(user, "profile", None)
#         if profile and getattr(profile, "parent_email", None):
#             parent_email = profile.parent_email
#
#     # Compose and send email (if parent_email exists)
#     if parent_email:
#         subject = f"نتيجة الامتحان: {quiz.title}"
#         percentage = round((score / max(1, total)) * 100)
#         message = f"السلام عليكم،\n\nتم تسجيل نتيجة الامتحان \"{quiz.title}\" للطالب {user.get_full_name() or user.email}.\nالنتيجة: {score}/{total} ({percentage}%).\n\nمع تحيات فريق المنصة."
#         # Use settings.EMAIL_HOST* configured
#         try:
#             send_mail(subject, message, settings.DEFAULT_FROM_EMAIL, [parent_email], fail_silently=False)
#         except Exception as e:
#             # log if you have logger; we ignore to not fail the request
#             print("Email send failed:", e)
#
#     return Response({
#         "score": score,
#         "total": total,
#         "per_question": per_q,
#         "attempt_id": attempt.id,
#     }, status=status.HTTP_200_OK)
