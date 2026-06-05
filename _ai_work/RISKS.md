# Risk Assessment

## amoCRM Integration Risks
1. **Mixing Medical & Sales Data:** High risk of leaking medical details (findings, diagnoses) into the amoCRM payload. Strict pure mapping functions must be maintained to prevent this.
2. **Token Exposure:** High risk of storing CRM tokens in the frontend. Do not implement token storage.
3. **Record Duplication:** Source of truth conflicts between DentalFlow and amoCRM could lead to duplicate patients/contacts.
4. **Synchronization Failure:** Future syncs might fail if external APIs rate limit or respond with errors.
