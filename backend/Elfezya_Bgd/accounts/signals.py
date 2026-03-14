# accounts/signals.py
from django.contrib.auth.signals import user_logged_in
from django.contrib.sessions.models import Session
from django.dispatch import receiver

@receiver(user_logged_in)
def one_session_only(sender, user, request, **kwargs):
    # حذف الجلسة القديمة لو موجودة
    old_key = getattr(user, "current_session_key", None)
    if old_key and old_key != request.session.session_key:
        Session.objects.filter(session_key=old_key).delete()
    # حفظ المفتاح الحالي
    request.session.save()
    user.current_session_key = request.session.session_key
    user.save(update_fields=["current_session_key"])
