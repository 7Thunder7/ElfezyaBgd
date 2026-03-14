# from django.urls import path, include
# from rest_framework.routers import DefaultRouter
# from .views import ContainerViewSet, QuizViewSet, quiz_submit
#
# router = DefaultRouter()
# router.register(r"containers", ContainerViewSet, basename="container")
# router.register(r"quizzes", QuizViewSet, basename="quiz")
#
# urlpatterns = [
#     path("", include(router.urls)),
#     path("quizzes/<int:pk>/submit/", quiz_submit, name="quiz-submit"),
# ]
