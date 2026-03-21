# accounts/views.py
from django.conf import settings
from django.contrib.auth import authenticate, login, logout, get_user_model
from django.contrib.sessions.models import Session
from django.http import JsonResponse
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_exempt, ensure_csrf_cookie

from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from .serializers import SignupSerializer, UserSerializer, LoginSerializer
import logging

User = get_user_model()
logger = logging.getLogger(__name__)


@ensure_csrf_cookie
def csrf(request):
    """
    GET /api/auth/csrf/
    Sets CSRF cookie so the frontend can send X-CSRFToken in later requests.
    """
    return JsonResponse({"detail": "CSRF cookie set"})


@method_decorator(csrf_exempt, name="dispatch")
class SignupView(generics.CreateAPIView):
    """
    POST /api/signup/
    Creates user, logs them in (session) and returns user info.
    """
    serializer_class = SignupSerializer
    permission_classes = [permissions.AllowAny]

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()

        try:
            login(request, user)
            logger.info(f"User {user.username} registered and logged in successfully")
        except Exception as e:
            logger.warning(f"Failed to login user after signup: {e}")

        out = UserSerializer(user, context={"request": request}).data
        headers = self.get_success_headers(serializer.data)
        return Response(out, status=status.HTTP_201_CREATED, headers=headers)


@method_decorator(csrf_exempt, name="dispatch")
class LoginView(APIView):
    """
    POST /api/login/
    Accepts: { "identifier": "email_or_username", "password": "xxx" }
    Returns: { "user": {...} } and sets session cookie
    """
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        identifier = serializer.validated_data["identifier"].lower()
        password = serializer.validated_data["password"]

        logger.info(f"Login attempt with identifier: {identifier}")

        # Strategy 1: Try authenticate using identifier as username
        user = authenticate(request, username=identifier, password=password)

        if user is None:
            # Strategy 2: Try to find user by email and verify password manually
            try:
                u = User.objects.get(email__iexact=identifier)
                if u.check_password(password):
                    user = u
                    logger.info(f"User authenticated via email: {identifier}")
            except User.DoesNotExist:
                logger.warning(f"No user found with email: {identifier}")

        if user is None:
            # Strategy 3: Try to find user by username (case-insensitive)
            try:
                u = User.objects.get(username__iexact=identifier)
                if u.check_password(password):
                    user = u
                    logger.info(f"User authenticated via username: {identifier}")
            except User.DoesNotExist:
                logger.warning(f"No user found with username: {identifier}")

        if user is None:
            logger.warning(f"Authentication failed for identifier: {identifier}")
            return Response(
                {"detail": "البريد الإلكتروني أو اسم المستخدم أو كلمة المرور غير صحيحة."},
                status=status.HTTP_401_UNAUTHORIZED
            )

        if not user.is_active:
            logger.warning(f"Inactive user attempted login: {user.username}")
            return Response(
                {"detail": "هذا الحساب معطل. يرجى التواصل مع الدعم."},
                status=status.HTTP_403_FORBIDDEN
            )

        login(request, user)
        logger.info(f"User {user.username} logged in successfully")

        if not request.session.session_key:
            request.session.save()
        new_session_key = request.session.session_key

        # SINGLE DEVICE ENFORCEMENT: remove any old session assigned to this user
        try:
            old_key = getattr(user, "current_session_key", None)
            if old_key and old_key != new_session_key:
                Session.objects.filter(session_key=old_key).delete()
                logger.info(f"Removed old session for user {user.username}")
        except Exception as e:
            logger.warning(f"Failed to remove old session: {e}")

        # Save new session key on user
        try:
            user.current_session_key = new_session_key
            user.save(update_fields=["current_session_key"])
        except Exception as e:
            logger.warning(f"Failed to save session key: {e}")

        out = UserSerializer(user, context={"request": request}).data
        return Response({"user": out}, status=status.HTTP_200_OK)


class LogoutView(APIView):
    """
    POST /api/logout/
    Logs out current user and clears session
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        username = request.user.username if request.user and request.user.is_authenticated else "unknown"

        try:
            user = request.user
            user.current_session_key = None
            user.save(update_fields=["current_session_key"])
        except Exception as e:
            logger.warning(f"Failed to clear session key: {e}")

        logout(request)
        logger.info(f"User {username} logged out successfully")

        return Response({"ok": True, "message": "تم تسجيل الخروج بنجاح"})


class MeView(APIView):
    """
    GET /api/me/
    Returns current authenticated user or null
    """
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        if not request.user or not request.user.is_authenticated:
            return Response(None, status=status.HTTP_200_OK)

        return Response(
            UserSerializer(request.user, context={"request": request}).data,
            status=status.HTTP_200_OK
        )


@method_decorator(csrf_exempt, name="dispatch")
class GoogleAuthView(APIView):
    """
    POST /api/auth/google/
    Accepts JSON: { "id_token": "<google-id-token>", "create_session": true/false }
    Verifies id_token with Google, finds/creates user,
    returns {"user":..., "tokens": {access, refresh}} (if SimpleJWT available)
    """
    permission_classes = [permissions.AllowAny]
    authentication_classes = []

    def post(self, request):
        id_token_value = (
            request.data.get("id_token")
            or request.data.get("token")
            or request.data.get("credential")
        )
        create_session = bool(request.data.get("create_session", True))

        if not id_token_value:
            return Response(
                {"detail": "id_token مطلوب"},
                status=status.HTTP_400_BAD_REQUEST
            )

        payload = None

        # Try to verify using google-auth library
        try:
            from google.oauth2 import id_token as google_id_token
            from google.auth.transport import requests as google_requests

            audience = getattr(settings, "GOOGLE_CLIENT_ID", None)
            try:
                payload = google_id_token.verify_oauth2_token(
                    id_token_value, google_requests.Request(), audience
                )
            except Exception:
                payload = google_id_token.verify_oauth2_token(
                    id_token_value, google_requests.Request()
                )
        except Exception as e:
            logger.debug(f"google-auth verification failed: {e}")

        # Fallback: call Google's tokeninfo endpoint
        if payload is None:
            try:
                import requests
                r = requests.get(
                    "https://oauth2.googleapis.com/tokeninfo",
                    params={"id_token": id_token_value},
                    timeout=6
                )
                if r.status_code == 200:
                    payload = r.json()
                else:
                    logger.warning(f"tokeninfo failed: {r.status_code}")
            except Exception as e:
                logger.error(f"tokeninfo request failed: {e}")

        if not payload:
            return Response(
                {"detail": "توكن جوجل غير صالح"},
                status=status.HTTP_400_BAD_REQUEST
            )

        email = payload.get("email")
        if not email:
            return Response(
                {"detail": "توكن جوجل لا يحتوي على بريد إلكتروني"},
                status=status.HTTP_400_BAD_REQUEST
            )

        first_name = payload.get("given_name") or ""
        last_name = payload.get("family_name") or ""

        try:
            user = User.objects.filter(email__iexact=email).first()

            if not user:
                base_username = email.split("@")[0]
                username = base_username
                counter = 1
                while User.objects.filter(username=username).exists():
                    username = f"{base_username}{counter}"
                    counter += 1

                user = User(
                    username=username,
                    email=email,
                    first_name=first_name,
                    last_name=last_name
                )
                user.set_unusable_password()
                user.save()
                logger.info(f"Created new user via Google: {username}")

        except Exception as e:
            logger.exception(f"User creation error: {e}")
            return Response(
                {"detail": "خطأ في إنشاء المستخدم"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

        if create_session:
            try:
                login(request, user)

                if not request.session.session_key:
                    request.session.save()

                try:
                    user.current_session_key = request.session.session_key
                    user.save(update_fields=["current_session_key"])
                except Exception as e:
                    logger.warning(f"Failed to save session key: {e}")

            except Exception as e:
                logger.warning(f"login() failed: {e}")

        tokens = None
        try:
            from rest_framework_simplejwt.tokens import RefreshToken
            refresh = RefreshToken.for_user(user)
            tokens = {
                "access": str(refresh.access_token),
                "refresh": str(refresh)
            }
        except Exception as e:
            logger.debug(f"SimpleJWT not available: {e}")

        data = {"user": UserSerializer(user, context={"request": request}).data}
        if tokens:
            data["tokens"] = tokens

        return Response(data, status=status.HTTP_200_OK)