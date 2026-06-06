# amoCRM Integration Architecture

## Purpose
The purpose of the amoCRM integration is to connect DentalFlow with a dedicated sales and lead management system. 
- **amoCRM** is responsible for leads, deals, the sales funnel, communication sourcing, and commercial follow-ups.
- **DentalFlow** remains the sole source of truth for patient cards, schedules, appointments, dental charts, clinical findings, and treatment plans.
- **Critical Rule:** Medical details must absolutely stay in DentalFlow and not be transmitted to amoCRM.

## Integration Principle

**amoCRM Handles:**
- Contacts
- Leads / Deals
- Sales statuses and pipeline movement
- Sales tasks and reminders
- Notes (non-medical)
- Communication sources (e.g., WhatsApp, Instagram connections)

**DentalFlow Handles:**
- Patients
- Schedule and clinic appointments
- Chief complaints
- Dental findings and risk assessments
- Dental charts
- Treatment plans (commercial summary only is exported)
- Patient preview
- Medical records

## Proposed Architecture
The recommended integration architecture introduces a middle layer between the DentalFlow frontend and the external amoCRM API.

**Data Flow:**
`Frontend DentalFlow React` → `DentalFlow backend / integration proxy` → `amoCRM API`

**Important Constraints:**
- The frontend must NOT store amoCRM access or refresh tokens.
- The frontend must NOT call the amoCRM API directly (to avoid CORS issues, token exposure, and cross-site scripting vulnerabilities).
- The OAuth `client_secret` must never be present in the React codebase.
- Access and refresh tokens must be stored securely on the server-side proxy only.

## Why Backend/Proxy is Required
A dedicated backend or proxy service is mandatory for real integration because it provides:
- **Secure token storage:** Keeping secrets away from the browser.
- **Refresh token handling:** Automatically rotating amoCRM access tokens seamlessly.
- **Webhook verification/handling:** Receiving incoming events securely from amoCRM.
- **Retry and error logging:** Ensuring robust data delivery even if APIs rate limit or fail.
- **Rate limit handling:** Queuing requests to comply with amoCRM API limits.
- **Audit trail:** Tracking successful and failed sync operations.
- **Future multi-clinic support:** Storing distinct credentials and pipelines for different clinics.

*Recommended MVP Stack:* A separate Node.js backend/proxy service (e.g., using Express or Fastify) running separately from the Vite frontend. Serverless functions are an alternative later, but a dedicated service is preferred for reliable token refresh, webhook polling, and retry logic.

## OAuth Flow
The high-level future authentication flow is as follows:
1. Admin opens **Settings → Integrations → amoCRM**.
2. Admin clicks "Connect amoCRM".
3. The backend redirects the user to the amoCRM authorization page.
4. amoCRM returns an authorization code to the backend callback URL.
5. The backend exchanges the code for access and refresh tokens.
6. The backend stores the tokens securely in a database.
7. The frontend polls or receives the connection status (success/failure) but *never* the tokens.
8. The backend automatically refreshes the access token when needed.
9. Admin can disconnect the integration via the frontend UI (calling a backend disconnect endpoint).

## Future Backend Endpoints
These are proposed internal endpoints for the future Node.js proxy service (not implemented yet):
- `GET /api/integrations/amocrm/status`
- `POST /api/integrations/amocrm/connect`
- `GET /api/integrations/amocrm/callback`
- `POST /api/integrations/amocrm/disconnect`
- `POST /api/integrations/amocrm/sync-patient`
- `POST /api/integrations/amocrm/sync-treatment-plan`
- `POST /api/integrations/amocrm/webhook`

## Future Frontend UI
The future UI elements should be located under:
**Settings → Integrations → amoCRM**

Possible UI blocks to implement in subsequent tasks:
- Connection status indicator (Connected/Disconnected).
- Connected amoCRM account/domain name.
- Sync direction toggle or display (e.g., DentalFlow → amoCRM).
- Default pipeline selector.
- Default responsible user selector.
- Mapping status overview.
- Last sync time indicator.
- Disconnect button.


## AMO-003 Backend Skeleton Status
- The `backend/` folder exists.
- Endpoints are 501/200 placeholders only.
- Real OAuth and token storage are still future tasks.
- No frontend integration yet.
