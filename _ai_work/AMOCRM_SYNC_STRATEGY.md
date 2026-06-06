# amoCRM Sync Strategy

## Recommended MVP Sync Direction

### Phase 1: Outbound Only (DentalFlow → amoCRM)
The initial integration phase will be one-way, pushing data from DentalFlow to the CRM.
**Allowed Actions:**
- Create or update a Contact in amoCRM when a Patient is created/updated in DentalFlow.
- Create or update a Lead in amoCRM when a Treatment Plan is created/approved in DentalFlow.
- Store the returned `externalContactId`, `externalLeadId`, and `externalDealId` back into DentalFlow.
- Display the current sync status in the DentalFlow UI.

### Phase 2: Limited Inbound Sync (amoCRM → DentalFlow)
The second phase introduces webhook handling for updates originating in the CRM.
**Allowed Actions:**
- Update the lead status in DentalFlow based on amoCRM pipeline changes.
- Update external IDs if leads are merged or shifted in the CRM.
- Update sync timestamps and sync error states.
**Not Allowed:**
- Any modification, deletion, or overwriting of medical data, appointments, or dental charts.

## Source of Truth

**DentalFlow is the absolute source of truth for:**
- Patient clinical and demographic data
- Dental chart state
- Clinical findings and risks
- Treatment plans (stages, medical requirements)
- Medical documents and history

**amoCRM is the absolute source of truth for:**
- Sales pipeline state and deal progression
- Communication history progress (e.g., chat logs, calls)
- Sales responsible person / manager assignment
- Commercial follow-up tasks

**Shared Data:**
- Patient contact identity (Name, Phone mapped via `externalContactId`).
- External IDs for tracking relationships.
- Lead status mapping between the systems.

## Duplicate Prevention
Future rules for preventing duplicate records when syncing:
1. Match by `externalContactId` first (if it already exists in DentalFlow).
2. Fallback to matching by exact `phone` number (standardized format).
3. If uncertain, require manual review by an admin.
4. **Never** automatically merge patients if there is conflicting identity or medical data.

## Error Handling
The `SyncStatus` field should be used as follows:
- `not_synced`: The entity has been created in DentalFlow but no attempt has been made to send it to amoCRM yet.
- `synced`: The entity was successfully delivered to amoCRM, and external IDs match.
- `needs_update`: The entity was modified in DentalFlow and the changes need to be pushed to amoCRM.
- `sync_error`: The last attempt to sync with amoCRM failed (e.g., rate limit, network error, invalid phone). The error detail should be stored in `lastSyncError`.

## Audit Log
Future tracking of integration events should utilize an `IntegrationSyncLog` entity (to be implemented in the backend proxy).

**Potential fields:**
- `id`
- `provider` (e.g., 'amocrm')
- `entityType` ('patient', 'treatment_plan')
- `entityId`
- `action` ('create', 'update', 'webhook_receive')
- `status` ('success', 'failure')
- `requestSummary`
- `responseSummary`
- `error`
- `createdAt`

*Note: Do not implement this entity in the frontend during the current phase.*


## AMO-004 Skeleton Status
- All sync endpoints (Patient/Lead/Webhook) remain disabled or as placeholders in AMO-004.
