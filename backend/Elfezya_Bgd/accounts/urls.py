from django.urls import path

from .views import GoogleAuthView, LoginView, LogoutView, MeView, SignupView

urlpatterns = [
    path("signup/", SignupView.as_view(), name="accounts-signup"),
    path("login/", LoginView.as_view(), name="accounts-login"),
    path("logout/", LogoutView.as_view(), name="accounts-logout"),
    path("me/", MeView.as_view(), name="accounts-me"),
    path("auth/google/", GoogleAuthView.as_view(), name="accounts-google"),
]
