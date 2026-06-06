# amoCRM Field Mapping

## Future Implementation Note
- Exact amoCRM API v4 payloads (e.g., `_embedded.contacts`, `custom_fields_values`) must be designed in AMO-003/AMO-004 after the backend/proxy architecture is finalized and chosen.
- Real `pipeline_id`, `status_id`, and custom field IDs must be configured dynamically per clinic.
- Do not hard-code amoCRM field IDs or complex request bodies in these architecture documents.

## Patient → amoCRM Contact

| DentalFlow Field | amoCRM Entity/Field | Status | Notes |
| :--- | :--- | :--- | :--- |
| `Patient.fullName` | Contact name | **Allowed** | Core identity. |
| `Patient.phone` | Contact phone | **Allowed** | Core communication. |
| `Patient.email` | Contact email | **Allowed** | If added to Patient in the future. |
| `Patient.integration.source` | Lead source / Custom field | **Allowed** | Used for marketing attribution. |
| `Patient.integration.sourceComment`| Note / Custom field | **Allowed** | Contextual admin notes. |
| `Patient.integration.externalCrm.externalContactId` | Internal Link | **Allowed** | Stored to prevent duplication. |
| Dental chart | Any | **Forbidden** | Medical data violation. |
| Clinical findings | Any | **Forbidden** | Medical data violation. |
| Diagnoses | Any | **Forbidden** | Medical data violation. |
| Tooth numbers | Any | **Forbidden** | Medical data violation. |
| Risk descriptions | Any | **Forbidden** | Medical data violation. |
| Medical recommendations | Any | **Forbidden** | Medical data violation. |
| Treatment notes | Any | **Forbidden** | Only generic admin notes allowed. |

## TreatmentPlan → amoCRM Lead / Deal

| DentalFlow Field | amoCRM Entity/Field | Status | Notes |
| :--- | :--- | :--- | :--- |
| `TreatmentPlan.title` | Lead/Deal name | **Allowed** | e.g., "План лечения: Брекеты". |
| `TreatmentPlan.totalPrice` | Lead/Deal price | **Allowed** | Commercial summary. |
| `TreatmentPlan.status` | Sales Status | **Allowed** | Mapped only if approved by mapping rules. |
| `Patient.fullName` | Lead Context / Contact | **Allowed** | Links the lead to the person. |
| Generic note | Lead note | **Allowed** | e.g., "План лечения создан в DentalFlow". |
| Stage descriptions | Any | **Forbidden** | *If* they contain medical details. |
| Tooth numbers | Any | **Forbidden** | Medical data violation. |
| Finding titles | Any | **Forbidden** | Medical data violation. |
| Diagnosis | Any | **Forbidden** | Medical data violation. |
| Risk descriptions | Any | **Forbidden** | Medical data violation. |
| Specific treatment details | Any | **Forbidden** | Clinical execution details stay in DentalFlow. |

## DentalFlow Lead Status → amoCRM Status Mapping

The following is a conceptual mapping table. Exact pipeline and status IDs must be configured dynamically per clinic in the backend.

| DentalFlow `PatientLeadStatus` | Proposed amoCRM Status Equivalent |
| :--- | :--- |
| `new_lead` | New lead / Incoming |
| `contacted` | Contacted / In progress |
| `scheduled` | Appointment scheduled |
| `arrived` | Arrived |
| `treatment_plan_created` | Treatment plan created |
| `treatment_plan_approved` | Deal approved / Won candidate |
| `declined` | Declined / Lost |
| `lost` | Lost |

## amoCRM → DentalFlow (Inbound Synchronization)

**Allowed future updates from amoCRM via Webhook:**
- `externalContactId`
- `externalLeadId`
- Lead status (`Patient.integration.leadStatus`)
- Responsible user name/ID (as a generic note or custom admin field)
- Last sync timestamp
- Sync error messages

**Forbidden inbound updates:**
- Overwriting any medical records from amoCRM.
- Changing the dental chart.
- Changing clinical findings.
- Changing treatment plan stages or prices automatically from CRM deal updates.
