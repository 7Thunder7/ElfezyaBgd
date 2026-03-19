import os
from pathlib import Path
from datetime import timedelta

import dj_database_url
from corsheaders.defaults import default_headers
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / '.env')

try:
    import pymysql
    pymysql.install_as_MySQLdb()
except Exception:
    pass


def env_bool(name: str, default: bool = False) -> bool:
    return os.environ.get(name, str(default)).strip().lower() in {"1", "true", "yes", "on"}


def env_list(name: str) -> list[str]:
    value = os.environ.get(name, "")
    return [item.strip() for item in value.split(",") if item.strip()]


def unique(values: list[str]) -> list[str]:
    seen = set()
    result = []
    for value in values:
        if value not in seen:
            seen.add(value)
            result.append(value)
    return result


SECRET_KEY = os.environ.get("DJANGO_SECRET_KEY", "dev-only-insecure-key-change-me")
DEBUG = env_bool("DJANGO_DEBUG", True)
TIME_ZONE = os.environ.get("DJANGO_TIME_ZONE", "Africa/Cairo")

ALLOWED_HOSTS = env_list("DJANGO_ALLOWED_HOSTS")
render_external_hostname = os.environ.get("RENDER_EXTERNAL_HOSTNAME", "").strip()
if render_external_hostname:
    ALLOWED_HOSTS.append(render_external_hostname)
if DEBUG:
    ALLOWED_HOSTS.extend(["127.0.0.1", "localhost"])
ALLOWED_HOSTS = unique(ALLOWED_HOSTS)

INSTALLED_APPS = [
    "corsheaders",
    "nested_admin",
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "rest_framework",
    "storages",
    "study",
    "accounts",
    "contenet",
    "landing",
]

AUTH_USER_MODEL = "accounts.CustomUser"

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "whitenoise.middleware.WhiteNoiseMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
    "Elfezya_Bgd.middleware.dev_coop.DevCoopMiddleware",
]

ROOT_URLCONF = "Elfezya_Bgd.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.debug",
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "Elfezya_Bgd.wsgi.application"

DATABASE_URL = os.environ.get("DATABASE_URL", "").strip()
DB_ENGINE = os.environ.get("DB_ENGINE", "sqlite").strip().lower()

if DATABASE_URL:
    DATABASES = {
        "default": dj_database_url.parse(
            DATABASE_URL,
            conn_max_age=600,
            ssl_require=not DEBUG,
        )
    }
elif DB_ENGINE == "mysql":
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.mysql",
            "NAME": os.getenv("DB_NAME", "elfezya"),
            "USER": os.getenv("DB_USER", "root"),
            "PASSWORD": os.getenv("DB_PASS", ""),
            "HOST": os.getenv("DB_HOST", "127.0.0.1"),
            "PORT": os.getenv("DB_PORT", "3306"),
            "OPTIONS": {
                "init_command": "SET sql_mode='STRICT_TRANS_TABLES'",
                "charset": "utf8mb4",
            },
        }
    }
else:
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.sqlite3",
            "NAME": os.environ.get("SQLITE_PATH", str(BASE_DIR / "db.sqlite3")),
        }
    }

AUTH_PASSWORD_VALIDATORS = [
    {
        "NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator",
    },
    {
        "NAME": "django.contrib.auth.password_validation.MinimumLengthValidator",
    },
    {
        "NAME": "django.contrib.auth.password_validation.CommonPasswordValidator",
    },
    {
        "NAME": "django.contrib.auth.password_validation.NumericPasswordValidator",
    },
]

LANGUAGE_CODE = "en-us"
USE_I18N = True
USE_TZ = True

STATIC_URL = "/static/"
STATIC_ROOT = BASE_DIR / "staticfiles"

MEDIA_URL = "/media/"
MEDIA_ROOT = Path(os.environ.get("DJANGO_MEDIA_ROOT", str(BASE_DIR / "media")))

USE_S3 = env_bool("USE_S3", False)

if USE_S3:
    STORAGES = {
        "default": {
            "BACKEND": "storages.backends.s3.S3Storage",
        },
        "staticfiles": {
            "BACKEND": "whitenoise.storage.CompressedManifestStaticFilesStorage",
        },
    }

    AWS_ACCESS_KEY_ID = os.environ.get("AWS_ACCESS_KEY_ID", "")
    AWS_SECRET_ACCESS_KEY = os.environ.get("AWS_SECRET_ACCESS_KEY", "")
    AWS_STORAGE_BUCKET_NAME = os.environ.get("AWS_STORAGE_BUCKET_NAME", "")
    AWS_S3_REGION_NAME = os.environ.get("AWS_S3_REGION_NAME", "auto")
    AWS_S3_ENDPOINT_URL = os.environ.get("AWS_S3_ENDPOINT_URL", "")
    AWS_S3_SIGNATURE_VERSION = "s3v4"
    AWS_S3_ADDRESSING_STYLE = "path"
    AWS_DEFAULT_ACL = None
    AWS_QUERYSTRING_AUTH = False
else:
    STORAGES = {
        "default": {
            "BACKEND": "django.core.files.storage.FileSystemStorage",
        },
        "staticfiles": {
            "BACKEND": "whitenoise.storage.CompressedManifestStaticFilesStorage",
        },
    }

CORS_ALLOW_ALL_ORIGINS = False

local_frontend_origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
]

frontend_url = os.environ.get("FRONTEND_URL", "").strip().rstrip("/")

cors_origins = []
if DEBUG:
    cors_origins.extend(local_frontend_origins)
if frontend_url:
    cors_origins.append(frontend_url)
cors_origins.extend(env_list("CORS_ALLOWED_ORIGINS"))
CORS_ALLOWED_ORIGINS = unique(cors_origins)
CORS_ALLOWED_ORIGIN_REGEXES = env_list("CORS_ALLOWED_ORIGIN_REGEXES")

csrf_trusted = []
if DEBUG:
    csrf_trusted.extend(local_frontend_origins)
if frontend_url:
    csrf_trusted.append(frontend_url)
csrf_trusted.extend(env_list("CSRF_TRUSTED_ORIGINS"))
CSRF_TRUSTED_ORIGINS = unique(csrf_trusted)

CORS_ALLOW_CREDENTIALS = True
CORS_ALLOW_HEADERS = list(default_headers) + [
    "authorization",
    "content-type",
]

SESSION_COOKIE_SAMESITE = os.environ.get("SESSION_COOKIE_SAMESITE", "Lax" if DEBUG else "None")
CSRF_COOKIE_SAMESITE = os.environ.get("CSRF_COOKIE_SAMESITE", "Lax" if DEBUG else "None")
SESSION_COOKIE_SECURE = not DEBUG
CSRF_COOKIE_SECURE = not DEBUG

SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
USE_X_FORWARDED_HOST = True

if not DEBUG:
    SECURE_SSL_REDIRECT = env_bool("DJANGO_SECURE_SSL_REDIRECT", False)
    SECURE_BROWSER_XSS_FILTER = True
    SECURE_CONTENT_TYPE_NOSNIFF = True
    SECURE_HSTS_SECONDS = int(os.environ.get("SECURE_HSTS_SECONDS", "0"))
    SECURE_HSTS_INCLUDE_SUBDOMAINS = env_bool("SECURE_HSTS_INCLUDE_SUBDOMAINS", False)
    SECURE_HSTS_PRELOAD = env_bool("SECURE_HSTS_PRELOAD", False)
    X_FRAME_OPTIONS = "DENY"

REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": (
        "rest_framework_simplejwt.authentication.JWTAuthentication",
        "rest_framework.authentication.SessionAuthentication",
        "rest_framework.authentication.BasicAuthentication",
    ),
    "DEFAULT_PERMISSION_CLASSES": (
        "rest_framework.permissions.IsAuthenticatedOrReadOnly",
    ),
}

SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(minutes=60),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=7),
    "AUTH_HEADER_TYPES": ("Bearer",),
}

GOOGLE_CLIENT_ID = os.environ.get("GOOGLE_CLIENT_ID", "")

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"
