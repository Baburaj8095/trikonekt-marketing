from pathlib import Path
import os
from datetime import timedelta
from dotenv import load_dotenv
import dj_database_url
from corsheaders.defaults import default_headers, default_methods

BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / ".env")
def _csv_env(name, default=''):
    val = os.environ.get(name, default)
    return [h.strip() for h in val.split(',') if h.strip()]

SECRET_KEY = os.environ.get('SECRET_KEY', 'replace-this-with-a-real-secret-in-prod')
DEBUG = os.environ.get('DEBUG', 'True').lower() in ('1', 'true', 'yes')
ALLOWED_HOSTS = [h.strip() for h in os.environ.get('ALLOWED_HOSTS', 'localhost,127.0.0.1,[::1]').split(',') if h.strip()]

INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'django.contrib.humanize',

    'rest_framework',
    'rest_framework_simplejwt.token_blacklist',
    'django_filters',
    'corsheaders',
    'accounts',
    'uploads',
    'locations',
    'coupons',
    'business',
    'market',
    'adminapi',
    'ui',
    'core',
    'notifications',
    'jobs',
    'mlm_ranks',
]

MIDDLEWARE = [
    'corsheaders.middleware.CorsMiddleware',  # must be as high as possible
    'django.middleware.security.SecurityMiddleware',
    'whitenoise.middleware.WhiteNoiseMiddleware',
    'core.middleware.CharsetUTF8Middleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'core.middleware.CsrfExemptApiMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'core.urls'

TEMPLATES = [{
    'BACKEND': 'django.template.backends.django.DjangoTemplates',
    'DIRS': [BASE_DIR / 'templates'],
    'APP_DIRS': True,
    'OPTIONS': {'context_processors': [
        'django.template.context_processors.debug',
        'django.template.context_processors.request',
        'django.contrib.auth.context_processors.auth',
        'django.contrib.messages.context_processors.messages',
    ]},
}]

WSGI_APPLICATION = 'core.wsgi.application'

# Database
# --------
# SECURITY: never hardcode credentials in source control.
# Require DATABASE_URL in the environment for any non-local deployment.
DEFAULT_DB_URL = os.environ.get("DATABASE_URL", "").strip()
if not DEFAULT_DB_URL:
    # Safe local fallback only.
    DEFAULT_DB_URL = f"sqlite:///{BASE_DIR / 'db.sqlite3'}"

DATABASES = {
    'default': dj_database_url.config(
        default=DEFAULT_DB_URL,
        conn_max_age=int(os.environ.get('DB_CONN_MAX_AGE', '0')),
        ssl_require=bool(os.environ.get("DB_SSL_REQUIRE", "True").lower() in ("1", "true", "yes")),
    )
}
# Force Starter-plan safety: always disable persistent DB connections
try:
    DATABASES['default']['CONN_MAX_AGE'] = 0
except Exception:
    pass

# Enable persistent connection health checks (Django 4.2+; harmless if ignored on older versions)
try:
    DATABASES['default']['CONN_HEALTH_CHECKS'] = True
except Exception:
    pass

# Add Postgres keepalive and SSL options to reduce "SSL connection has been closed unexpectedly" on Render
try:
    DATABASES['default'].setdefault('OPTIONS', {})
    if 'postgresql' in str(DATABASES['default'].get('ENGINE', '')).lower():
        DATABASES['default']['OPTIONS'].setdefault('sslmode', 'require')
        DATABASES['default']['OPTIONS'].setdefault('connect_timeout', int(os.environ.get('DB_CONNECT_TIMEOUT', '10')))
        DATABASES['default']['OPTIONS'].setdefault('keepalives', 1)
        DATABASES['default']['OPTIONS'].setdefault('keepalives_idle', int(os.environ.get('DB_KEEPALIVES_IDLE', '30')))
        DATABASES['default']['OPTIONS'].setdefault('keepalives_interval', int(os.environ.get('DB_KEEPALIVES_INTERVAL', '10')))
        DATABASES['default']['OPTIONS'].setdefault('keepalives_count', int(os.environ.get('DB_KEEPALIVES_COUNT', '5')))
    else:
        for _pg_only in ("sslmode", "connect_timeout", "keepalives", "keepalives_idle", "keepalives_interval", "keepalives_count"):
            DATABASES['default']['OPTIONS'].pop(_pg_only, None)
except Exception:
    # Fallback silently if OPTIONS cannot be set
    pass

AUTH_PASSWORD_VALIDATORS = []

LANGUAGE_CODE = 'en-us'
TIME_ZONE = 'UTC'
USE_I18N = True
USE_TZ = True

STATIC_URL = '/static/'
STATICFILES_DIRS = [BASE_DIR / 'static']
STATIC_ROOT = BASE_DIR / 'staticfiles'
STATICFILES_STORAGE = 'whitenoise.storage.CompressedManifestStaticFilesStorage'

AUTH_USER_MODEL = 'accounts.CustomUser'

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

HIDE_COUPONS_IN_ADMIN = False

# REST_FRAMEWORK authentication disabled for development (JWT commented out)
REST_FRAMEWORK = {
    'DEFAULT_PERMISSION_CLASSES': (
        'rest_framework.permissions.AllowAny',
    ),
    'DEFAULT_FILTER_BACKENDS': ['django_filters.rest_framework.DjangoFilterBackend'],
    'DEFAULT_AUTHENTICATION_CLASSES': (
        'rest_framework_simplejwt.authentication.JWTAuthentication',
        'rest_framework.authentication.BasicAuthentication',
    ),
    # Global pagination to bound response sizes
    'DEFAULT_PAGINATION_CLASS': 'rest_framework.pagination.PageNumberPagination',
    'PAGE_SIZE': int(os.environ.get('DRF_PAGE_SIZE', '25')),
    # Basic rate limiting (tune per needs)
    'DEFAULT_THROTTLE_CLASSES': [
        'rest_framework.throttling.AnonRateThrottle',
        'rest_framework.throttling.UserRateThrottle',
    ],
    'DEFAULT_THROTTLE_RATES': {
        'anon': os.environ.get('DRF_THROTTLE_ANON', '60/min'),
        'user': os.environ.get('DRF_THROTTLE_USER', '300/min'),
        # Dedicated webhook throttle (default high enough to avoid breaking real traffic).
        'hubble_webhook': os.environ.get('DRF_THROTTLE_HUBBLE_WEBHOOK', '600/min'),
    },
}

def _env_int(name: str, default: int) -> int:
    try:
        return int(os.environ.get(name, str(default)))
    except Exception:
        return default


# JWT configuration
# -----------------
# Backward compatible change:
# - Reducing lifetimes affects only newly-minted tokens.
# - Existing long-lived tokens (if any) will continue to validate until their embedded exp.
ACCESS_TOKEN_MINUTES = _env_int("JWT_ACCESS_TOKEN_MINUTES", 15)
REFRESH_TOKEN_DAYS = _env_int("JWT_REFRESH_TOKEN_DAYS", 30)

SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME': timedelta(minutes=max(1, ACCESS_TOKEN_MINUTES)),
    'REFRESH_TOKEN_LIFETIME': timedelta(days=max(1, REFRESH_TOKEN_DAYS)),
    'ROTATE_REFRESH_TOKENS': os.environ.get("JWT_ROTATE_REFRESH_TOKENS", "True").lower() in ("1", "true", "yes"),
    'BLACKLIST_AFTER_ROTATION': os.environ.get("JWT_BLACKLIST_AFTER_ROTATION", "True").lower() in ("1", "true", "yes"),
    'UPDATE_LAST_LOGIN': False,
    # Keep shared auth stable across repos/services. Set JWT_SIGNING_KEY to the
    # same value in any backend that must verify tokens issued by this service.
    'SIGNING_KEY': os.environ.get("JWT_SIGNING_KEY", SECRET_KEY),
    'AUTH_HEADER_TYPES': ('Bearer',),
    'LEEWAY': 60,  # absorb up to 60s clock drift to avoid false token_not_valid
}

# Server-to-server secret for trusted external backends that perform their own
# OTP verification and need Django to mint a normal user JWT afterwards.
EXTERNAL_AUTH_SHARED_SECRET = os.environ.get("EXTERNAL_AUTH_SHARED_SECRET", "")

# CORS configuration
# Default list includes both old (trikonekt.com) and new (growth.vin) domains to support migration.
# You can override completely via the CORS_ALLOWED_ORIGINS environment variable on Render.
CORS_ALLOWED_ORIGINS = _csv_env(
    'CORS_ALLOWED_ORIGINS',
    ','.join([
        # New domains
        'https://growth.vin',
        'https://www.growth.vin',
        'https://admin.growth.vin',
        # Existing/old domains
        'https://trikonekt.com',
        'https://www.trikonekt.com',
    ])
)

# Keep regex allowlist for preview deployments / known subdomains
CORS_ALLOWED_ORIGIN_REGEXES = _csv_env(
    'CORS_ALLOWED_ORIGIN_REGEXES',
    '^https://.*\\.vercel\\.app$,^https://.*\\.trikonekt\\.com$,^https://.*\\.growth\\.vin$'
)
CORS_ALLOW_ALL_ORIGINS = False if (CORS_ALLOWED_ORIGINS or CORS_ALLOWED_ORIGIN_REGEXES) else True
CORS_ALLOW_CREDENTIALS = True
CORS_ALLOW_HEADERS = list(default_headers) + ["authorization"]
CORS_ALLOW_METHODS = list(default_methods)
CORS_EXPOSE_HEADERS = ['Content-Disposition']

# Allow local React dev server origins in DEBUG (for direct http://localhost:8000 API calls)
if DEBUG:
    for _o in ('http://localhost:3000', 'http://127.0.0.1:3000'):
        if _o not in CORS_ALLOWED_ORIGINS:
            CORS_ALLOWED_ORIGINS.append(_o)

MEDIA_URL = '/media/'
MEDIA_ROOT = os.path.join(BASE_DIR, 'media')

# Request/Upload size limits (override via env)
DATA_UPLOAD_MAX_MEMORY_SIZE = int(os.environ.get('DATA_UPLOAD_MAX_MEMORY_SIZE', str(5 * 1024 * 1024)))
FILE_UPLOAD_MAX_MEMORY_SIZE = int(os.environ.get('FILE_UPLOAD_MAX_MEMORY_SIZE', str(5 * 1024 * 1024)))

# Cloudinary media storage (enabled when CLOUDINARY_URL is set; shim re-exports real classes if available)
if os.environ.get('CLOUDINARY_URL'):
    # Always point default storage to cloudinary_storage shim; it binds to real classes when available.
    DEFAULT_FILE_STORAGE = 'cloudinary_storage.storage.MediaCloudinaryStorage'
    CLOUDINARY_STORAGE = {'SECURE': True}
    # Add apps if available; local shim makes 'cloudinary_storage' import-safe
    if 'cloudinary_storage' not in INSTALLED_APPS:
        INSTALLED_APPS += ['cloudinary_storage']
    try:
        import cloudinary  # type: ignore
        if 'cloudinary' not in INSTALLED_APPS:
            INSTALLED_APPS += ['cloudinary']
    except Exception:
        # cloudinary pkg missing; uploads will fall back to local via shim
        pass

# CSRF trusted origins for local frontend dev and deployed frontends
# This allows POST/PUT/PATCH/DELETE from the React dev server at port 3000
# without failing the CSRF Origin check.
CSRF_TRUSTED_ORIGINS = _csv_env(
    'CSRF_TRUSTED_ORIGINS',
    ','.join([
        'http://localhost:3000',
        'http://127.0.0.1:3000',
        # New domains
        'https://growth.vin',
        'https://www.growth.vin',
        'https://admin.growth.vin',
        'https://api.growth.vin',
        # Existing/old domains
        'https://trikonekt.com',
        'https://www.trikonekt.com',
        'https://api.trikonekt.com',
        # Vercel preview/production hostnames (update if you have a new one for growth.vin)
        'https://trikonekt.vercel.app',
        'https://*.vercel.app',
    ])
)

# Email configuration (env-driven with safe defaults)
MAIL_ENABLED = os.environ.get('MAIL_ENABLED', '').lower() in ('1', 'true', 'yes')
EMAIL_HOST = os.environ.get('EMAIL_HOST', 'smtp.gmail.com')
EMAIL_PORT = int(os.environ.get('EMAIL_PORT', '587'))
EMAIL_USE_TLS = os.environ.get('EMAIL_USE_TLS', 'True').lower() in ('1', 'true', 'yes')
EMAIL_USE_SSL = os.environ.get('EMAIL_USE_SSL', 'False').lower() in ('1', 'true', 'yes')
EMAIL_HOST_USER = os.environ.get('EMAIL_HOST_USER', 'trikonekt@gmail.com')
EMAIL_HOST_PASSWORD = os.environ.get('EMAIL_HOST_PASSWORD', '')
DEFAULT_FROM_EMAIL = os.environ.get('DEFAULT_FROM_EMAIL', EMAIL_HOST_USER)
EMAIL_TIMEOUT = int(os.environ.get('EMAIL_TIMEOUT', '10'))
SERVER_EMAIL = os.environ.get('SERVER_EMAIL', DEFAULT_FROM_EMAIL)
# Choose backend: SMTP only if enabled and credentials present; else fall back to console
if MAIL_ENABLED and EMAIL_HOST_USER and EMAIL_HOST_PASSWORD:
    EMAIL_BACKEND = 'django.core.mail.backends.smtp.EmailBackend'
else:
    EMAIL_BACKEND = os.environ.get('EMAIL_BACKEND', 'django.core.mail.backends.console.EmailBackend')

# Security and proxy settings (Render-friendly)
SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')
SECURE_SSL_REDIRECT = os.environ.get('SECURE_SSL_REDIRECT', 'False').lower() in ('1', 'true', 'yes')
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True
SECURE_HSTS_SECONDS = int(os.environ.get('SECURE_HSTS_SECONDS', '0'))
SECURE_HSTS_INCLUDE_SUBDOMAINS = os.environ.get('SECURE_HSTS_INCLUDE_SUBDOMAINS', 'False').lower() in ('1', 'true', 'yes')
SECURE_HSTS_PRELOAD = os.environ.get('SECURE_HSTS_PRELOAD', 'False').lower() in ('1', 'true', 'yes')

# Feature flags (disabled by default to avoid impacting existing functionality)
NOTIFICATIONS_ENABLED = os.environ.get('NOTIFICATIONS_ENABLED', 'False').lower() in ('1', 'true', 'yes')
NOTIFICATIONS_PUSH_ENABLED = os.environ.get('NOTIFICATIONS_PUSH_ENABLED', 'False').lower() in ('1', 'true', 'yes')

# Dev-performance flag: skip heavy allocation/distribution during promo purchase approval.
# Default True in DEBUG to avoid long requests against remote databases; override via env in prod.
SKIP_HEAVY_ON_APPROVE = os.environ.get('SKIP_HEAVY_ON_APPROVE', 'True' if DEBUG else 'False').lower() in ('1', 'true', 'yes')

# ==========================
# Hubble (Gift Cards) SDK
# ==========================
# Web SDK base URL.
# Hubble experience center is typically served at:
#   https://sdk.myhubble.money/experience-center
# We keep this as the default and let env override for staging/dev.
HUBBLE_SDK_BASE_URL = os.environ.get('HUBBLE_SDK_BASE_URL', 'https://sdk.myhubble.money/experience-center')
# Partner client id (used as JWT 'iss' for JWT SSO)
HUBBLE_CLIENT_ID = os.environ.get('HUBBLE_CLIENT_ID', '')

# NOTE: Hubble partner setup may require passing a clientSecret/clientAppSecret in the iframe URL.
# This value will be exposed to the browser as a query param.
# Prefer using server-side token-only flows if Hubble supports it.
HUBBLE_CLIENT_SECRET = os.environ.get('HUBBLE_CLIENT_SECRET', '')

# Optional theme for SDK iframe URL (e.g., "light" or "dark").
HUBBLE_SDK_THEME = os.environ.get('HUBBLE_SDK_THEME', '')

# Backward-compat (older env var name used in earlier integration draft)
HUBBLE_APP_SECRET = os.environ.get('HUBBLE_APP_SECRET', '')

# RSA private key (PEM) used to sign JWT (RS256) for SSO.
# Provide either full PEM in env, or a file path.
HUBBLE_JWT_PRIVATE_KEY_PEM = os.environ.get('HUBBLE_JWT_PRIVATE_KEY_PEM', '')
HUBBLE_JWT_PRIVATE_KEY_PATH = os.environ.get('HUBBLE_JWT_PRIVATE_KEY_PATH', '')

# Webhook verification secret (HMAC-SHA256 base64 signature in X-Verify)
HUBBLE_WEBHOOK_SECRET = os.environ.get('HUBBLE_WEBHOOK_SECRET', '')

# Optional IP allowlist for webhook ingress.
# Leave empty to disable IP checks (backward compatible).
HUBBLE_WEBHOOK_IP_ALLOWLIST = os.environ.get('HUBBLE_WEBHOOK_IP_ALLOWLIST', '')

# SECURITY: default is to NOT expose HUBBLE_CLIENT_SECRET to browsers via iframe URL.
# Enable only if Hubble requires it for your partner setup.
HUBBLE_SEND_CLIENT_SECRET_TO_BROWSER = os.environ.get('HUBBLE_SEND_CLIENT_SECRET_TO_BROWSER', '')
