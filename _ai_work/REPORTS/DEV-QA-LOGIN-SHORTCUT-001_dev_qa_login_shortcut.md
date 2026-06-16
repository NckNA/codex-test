# DEV-QA-LOGIN-SHORTCUT-001 — local dev QA login shortcut

## Summary

Implemented a local-development-only QA login shortcut panel on the login page so browser smoke agents can sign in as predefined QA users by clicking role buttons instead of manually typing login details.

The shortcut still uses the normal application `signIn` flow. Authentication, tenant loading, role checks, and RLS remain intact.

## Branch

`feature/dev-qa-login-shortcut-001`

## PR URL

Pending until PR creation.

## PR head reviewed before final report update

Pending until final PR update.

## Report update commit

N/A because the final report update commit cannot reference itself before creation.

## Changed files summary

- `src/pages/devQaLoginShortcut.ts` — local-only QA shortcut helpers and allowed QA users.
- `src/pages/LoginPage.tsx` — local QA shortcut panel behind strict local dev gates.
- `src/pages/LoginPage.test.tsx` — tests for shortcut visibility and role-button sign-in.
- `_ai_work/REPORTS/DEV-QA-LOGIN-SHORTCUT-001_dev_qa_login_shortcut.md` — this report.

## Implementation details

The shortcut renders only when all conditions are true:

- Vite dev mode is active.
- Current hostname is `localhost` or `127.0.0.1`.
- The QA shortcut feature flag is enabled.
- The configured local QA login secret exists.

If any condition is false, the normal login page behaves exactly as before and no QA shortcut panel is rendered.

## Supported QA users

- `qa.admin.a@example.local`
- `qa.doctor.a@example.local`
- `qa.receptionist.a@example.local`
- `qa.cashier.a@example.local`
- `qa.notenant@example.local`
- `qa.multitenant@example.local`
- `qa.admin.b@example.local`

Each role button calls the same `signIn` function used by the normal login form.

## Safety boundaries preserved

- Authentication was not removed.
- AuthContext was not disabled.
- TenantContext was not disabled.
- RLS was not changed.
- Role permissions were not changed.
- Patient pages were not made public.
- No privileged backend key is used in browser code.
- No secret value is stored in Git or this report.
- `.env.local` was not committed.
- Supabase cloud was not touched.

## Tests

Updated:

- `src/pages/LoginPage.test.tsx`

Covered scenarios:

- normal login form still renders and calls `signIn`;
- shortcut hidden by default;
- shortcut hidden when the feature flag is not enabled;
- shortcut disabled on non-localhost hosts;
- shortcut visible on localhost when dev flag and local QA login secret are configured;
- all configured QA role buttons render;
- clicking Admin A calls `signIn` with `qa.admin.a@example.local` and the configured local QA login secret;
- shortcut helper only depends on local dev flag, localhost, and the local QA login secret.

## What was intentionally NOT changed

- No migrations.
- No Supabase cloud access.
- No RLS changes.
- No role permission changes.
- No patient page public access.
- No browser smoke in this PR.
- No local Supabase seed/run in this PR.
- No production/staging shortcut.
- No next feature work.

## Checks

Not run locally by this assistant environment.

Expected GitHub Actions validation:

- `npm run lint`
- `npm run test -- --run`
- `npm run build`

## Final verdict

PENDING CI

## Recommended next task

`PATIENT-TIMELINE-UI-SMOKE-001`
