# DEV-QA-LOGIN-SHORTCUT-001 — local dev QA login shortcut

## Summary

Implemented a local-development-only QA login shortcut panel on the login page so browser smoke agents can sign in as predefined QA users by clicking role buttons instead of manually typing login details.

The shortcut still uses the normal application `signIn` flow. Authentication, tenant loading, role checks, and RLS remain intact.

## Branch

`feature/dev-qa-login-shortcut-001`

## PR URL

https://github.com/NckNA/codex-test/pull/300

## PR head reviewed before final report update

`8e19e647113e015850aa071aecf0a38ae48f3f32`

## Report update commit

N/A because the final report update commit cannot reference itself before creation.

## Changed files summary

Matches the GitHub PR changed-file list exactly:

- `_ai_work/REPORTS/DEV-QA-LOGIN-SHORTCUT-001_dev_qa_login_shortcut.md` — this report and final metadata update.
- `src/pages/LoginPage.test.tsx` — tests for shortcut visibility, role-button sign-in, and the narrow type-only import build fix.
- `src/pages/LoginPage.tsx` — local QA shortcut panel behind strict local dev gates.
- `src/pages/devQaLoginShortcut.ts` — local-only QA shortcut helpers and allowed QA users.

## Implementation details

The shortcut renders only when all conditions are true:

- Vite dev mode is active.
- Current hostname is `localhost` or `127.0.0.1`.
- The QA shortcut feature flag is enabled.
- The configured local QA login credential exists.

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
- Normal login is preserved.
- RLS was not changed.
- Role permissions were not changed.
- Patient pages were not made public.
- No privileged backend key is used in browser code.
- No passwords or secrets are stored in Git or this report.
- `.env.local` was not committed.
- Supabase cloud was not touched.
- Local Supabase was not required or run.
- Browser smoke was not run.
- No migrations were created.
- No code beyond the local-dev-only QA shortcut implementation and its tests was added.

## Tests

Updated:

- `src/pages/LoginPage.test.tsx`

Covered scenarios:

- normal login form still renders and calls `signIn`;
- shortcut hidden by default;
- shortcut hidden when the feature flag is not enabled;
- shortcut disabled on non-localhost hosts;
- shortcut visible on localhost when dev flag and local QA login credential are configured;
- all configured QA role buttons render;
- clicking Admin A calls `signIn` with `qa.admin.a@example.local` and the configured local QA login credential;
- shortcut helper only depends on local dev flag, localhost, and the configured local QA login credential.

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

## CI result

- Run id: `27651805191`
- CI number: `488`
- Conclusion: `success`
- Tested commit: `8e19e647113e015850aa071aecf0a38ae48f3f32`
- ESLint: `success`
- Tests: `success`
- Build: `success`

## Checks

GitHub Actions CI passed:

- `npm run lint`
- `npm run test -- --run`
- `npm run build`

No browser smoke was run in this PR.

## Final verdict

DEV QA LOGIN SHORTCUT IMPLEMENTED AND VERIFIED

## Recommended next task

`PATIENT-TIMELINE-UI-SMOKE-001`
