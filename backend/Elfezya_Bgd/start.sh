#!/usr/bin/env bash
set -o errexit

python manage.py migrate

python manage.py shell <<EOF
from django.contrib.auth import get_user_model
from os import getenv

User = get_user_model()

username = getenv("DJANGO_SUPERUSER_USERNAME")
email = getenv("DJANGO_SUPERUSER_EMAIL")
password = getenv("DJANGO_SUPERUSER_PASSWORD")

if username and email and password:
    if not User.objects.filter(username=username).exists():
        User.objects.create_superuser(username=username, email=email, password=password)
        print("Superuser created.")
    else:
        print("Superuser already exists.")
else:
    print("Superuser env vars not set. Skipping.")
EOF

gunicorn Elfezya_Bgd.wsgi:application