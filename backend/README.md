# DentalFlow Integration Proxy

Tenant-safe server boundary for external integrations. This implementation only provides the amoCRM OAuth/account security foundation.

## Security boundary

- Every browser request is authenticated through the Supabase session access token.
- Tenant selection is carried as `X-Tenant-Id`, then independently verified against `tenant_users` by service-role-only database functions.
- OAuth state is random, short-lived, one-time, tenant-bound, user-bound and integration-bound. Only its SHA-256 hash is stored.
- Authorization codes, access credentials, refresh credentials and client secrets are never returned to the frontend or written to logs/audit.
- Credentials are encrypted server-side with AES-256-GCM before protected database storage.
- Refresh uses a database lease plus expected credential version so rotated refresh credentials cannot be overwritten by a parallel stale request.
- There is no process-global token or OAuth state store.

## Routes

- `GET /health`
- `GET /api/integrations/amocrm/status`
- `POST /api/integrations/amocrm/connect`
- `GET /api/integrations/amocrm/callback`
- `POST /api/integrations/amocrm/refresh`
- `POST /api/integrations/amocrm/reconnect`
- `POST /api/integrations/amocrm/disconnect`
- `GET|POST /api/integrations/amocrm/external-references`
- `POST /api/integrations/amocrm/external-references/:id/archive`

Authenticated routes require:

- `Authorization: Bearer <Supabase access token>`
- `X-Tenant-Id: <current tenant UUID>`

## Intentionally absent

No contact, lead, deal, task, note or message synchronization. No Chats API. No webhook. No worker. No cron. No provider message sending. No cloud migration apply.

## Local configuration

Copy `.env.example` into a local environment source without committing real values. The encryption key must be exactly 32 random bytes encoded as base64 or 64 hexadecimal characters. Server-only values must never use a `VITE_` prefix.
