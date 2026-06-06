# Risk Assessment

## General Project Risks
1. **PatientCardPage Overload:** The `PatientCardPage` component risks becoming too large and difficult to maintain if all tabs and sections are built directly into it.
2. **Mixing Medical & Administrative Logic:** Risk of violating domain rules by blending financial/sales data with clinical patient records.
3. **Improper Data Flow:** Mixing complaints, findings, diagnosis, treatment plan, and completed services can cause confusion. These must remain strictly separated logically and visually.
4. **Storage Breakage:** Changes to `localStorage` schemas without careful handling or defaults might break existing patient data or app startup.
5. **Patient Data Loss:** Accidental overwrite or omission of fields during updates might result in data loss.
6. **Type Inconsistency:** Adding UI fields without backing types or creating mismatched interfaces.
7. **Duplicated UI Components:** Failing to reuse existing generic components, bloating the application.
8. **Oversized Modals:** Creating single, massive modals instead of step-by-step or tabbed interfaces, hurting UX.
9. **Copying Competitor CRM Logic:** Blindly copying standard CRM behavior without adapting to medical clinic realities.
10. **Tasks Too Large for AI:** Providing prompts that exceed context windows or logical scope limits for single AI sessions.
11. **Changing Neighboring Modules:** Modifying areas of the app not directly related to the current task scope.

## amoCRM Integration Risks
1. **Mixing Sales Data with Medical Data:** High risk of leaking medical details (findings, diagnoses, tooth numbers) into the amoCRM payload. Strict pure mapping functions must be maintained.
2. **Leaking Medical Findings into amoCRM:** Accidentally sending detailed dental chart statuses or medical notes via drafts.
3. **Token Storage in Frontend:** High risk of exposing CRM tokens by storing them in the client-side app. Do not implement token storage.
4. **Duplicate Patient/Contact Records:** Source-of-truth conflicts between DentalFlow and amoCRM could lead to duplicate or fragmented patient contacts.
5. **Source-of-Truth Conflict:** Disagreements between amoCRM and DentalFlow regarding lead status and patient reality.
6. **Failed Sync / Sync Error Handling:** Future sync operations may fail due to rate limits or API outages, requiring robust error handling states.
7. **Accidental Real API Calls from Frontend:** Implementing direct backend/CRM requests from the React frontend instead of through a secure proxy/backend.

8. **Proxy Downtime:** If the integration backend/proxy goes down, sync queues could back up or fail.
9. **Rate Limit Handling:** Uncontrolled bulk updates from the frontend could violate amoCRM API rate limits if the proxy doesn't throttle.
10. **Token Refresh Failure:** If the refresh token expires or is revoked, the integration will silently fail until manually re-authenticated.
