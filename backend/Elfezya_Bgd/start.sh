#!/usr/bin/env bash
set -o errexit

python manage.py migrate --noinput
gunicorn Elfezya_Bgd.wsgi:application --bind 0.0.0.0:${PORT:-10000} --workers ${WEB_CONCURRENCY:-2}
