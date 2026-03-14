# accounts/middleware.py
from django.contrib.auth import logout

class OneSessionMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response
    def __call__(self, request):
        user = getattr(request, "user", None)
        if user and user.is_authenticated:
            if hasattr(user, "current_session_key"):
                if request.session.session_key != user.current_session_key:
                    logout(request)
        return self.get_response(request)
