# accounts/urls.py
from django.urls import path
from .views import SignupView, LoginView, LogoutView, MeView, GoogleAuthView
urlpatterns = [
    path("signup/", SignupView.as_view()),
  #  path("signup/", SignupView.as_view(), name="accounts-signup"),
    path("login/", LoginView.as_view(), name="accounts-login"),
    path("logout/", LogoutView.as_view(), name="accounts-logout"),
    path("me/", MeView.as_view(), name="accounts-me"),
    path("auth/google/", GoogleAuthView.as_view(), name="accounts-google"),
    path("auth/google/", GoogleAuthView.as_view(), name="auth-google"),
]
