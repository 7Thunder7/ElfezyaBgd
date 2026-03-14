from django.conf import settings

class DevCoopMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        response = self.get_response(request)
        if getattr(settings, "DEBUG", False):
            response["Cross-Origin-Opener-Policy"] = "same-origin-allow-popups"
            # إزالة أي COEP صارم لو تم وضعه
            if "Cross-Origin-Embedder-Policy" in response:
                del response["Cross-Origin-Embedder-Policy"]
            if "Cross-Origin-Opener-Policy-Report-Only" in response:
                del response["Cross-Origin-Opener-Policy-Report-Only"]
        return response
