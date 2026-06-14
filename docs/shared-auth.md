# Shared Auth Setup

This backend is the source of truth for Trikonekt login and registration.

## Auth endpoints

Use these from the other frontend/backend:

```text
POST /api/accounts/register/
POST /api/accounts/login/
POST /api/accounts/token/refresh/
POST /api/accounts/consumer/password/request-otp/
POST /api/accounts/consumer/password/verify-otp/
POST /api/accounts/consumer/password/reset/
```

## Admin auth

If the other repo has an admin panel, use the same auth system. Admin users are
also rows in `accounts_customuser`; admin access is controlled by these fields
and role tables:

```text
accounts_customuser.is_staff
accounts_customuser.is_superuser
accounts_customuser.identity_type
accounts_customuser.admin_role_id
adminapi_role
adminapi_permission
adminapi_rolepermission
adminapi_user_roles
```

Consumer users are also in `accounts_customuser`; distinguish them with:

```text
accounts_customuser.identity_type=END_USER
accounts_customuser.category=consumer
accounts_customuser.role=user
```

Admin API routes are under:

```text
/api/admin/
/api/adminapi/
```

## Required production env

On this backend:

```text
DATABASE_URL=<same production database>
SECRET_KEY=<stable django secret>
JWT_SIGNING_KEY=<stable shared jwt signing key>
EXTERNAL_AUTH_SHARED_SECRET=<stable random server-to-server secret>
ALLOWED_HOSTS=api.growth.vin,growth.vin,www.growth.vin,www.trikonekt.com,trikonekt.com
CORS_ALLOWED_ORIGINS=https://www.trikonekt.com,https://trikonekt.com,https://growth.vin,https://www.growth.vin,<other-vercel-origin>
CSRF_TRUSTED_ORIGINS=https://www.trikonekt.com,https://trikonekt.com,https://growth.vin,https://www.growth.vin,https://api.growth.vin,<other-vercel-origin>
```

On the other frontend repo:

```text
REACT_APP_API_URL=https://api.growth.vin/api
```

If the other repo has its own backend and must verify the same JWT access tokens,
configure the same `JWT_SIGNING_KEY` there. Prefer calling this backend's auth
APIs for registration, login, and password reset instead of writing directly to
`accounts_customuser`.

If the other backend performs mobile OTP verification and then needs Django to
mint a normal JWT, configure the same `EXTERNAL_AUTH_SHARED_SECRET` in both
backends. The Java backend calls:

```text
POST /api/accounts/external/otp-token/
X-External-Auth-Secret: <EXTERNAL_AUTH_SHARED_SECRET>
```

## Shared database owner rule

Only one backend should own migrations and writes for these auth tables:

```text
accounts_customuser
accounts_customuser_groups
accounts_customuser_user_permissions
password_reset_otps
adminapi_role
adminapi_permission
adminapi_rolepermission
adminapi_user_roles
```

Other repos can read these tables or use unmanaged models, but should not create
conflicting migrations for them.
