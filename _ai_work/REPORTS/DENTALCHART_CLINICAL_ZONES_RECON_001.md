# DENTALCHART-CLINICAL-ZONES-RECON-001

## 1. Verdict
**Verdict: Needs Refactor.**
The current model incorrectly intertwines systemic tooth position statuses and clinical zones with editable dictionaries. Specifically, the available tabs (clinical zones) for a tooth are dynamically derived from the `allowedZones` and `allowedPresenceStatuses` arrays of *all* diagnoses and works in the system. Because dictionaries are now editable (Issue #237), a user can accidentally or maliciously alter the core architectural tab structure of a tooth by creating a work or diagnosis with invalid zone combinations. A hardcoded, system-controlled layer for `Status → Zones` mapping must be introduced before further expanding dictionary functionality.

## 2. Current tooth position status model
- **Type names / enum values:** `ToothPresenceStatus` (`natural`, `missing`, `implant`, `root_remnant`, `deciduous`, `impacted`).
- **Where defined:** `src/types/index.ts`
- **How ToothEditorModal uses them:** Reads `formData?.presenceStatus` to determine the active tooth presence. It then dynamically requests `availableZones` based on this presence to render the modal's tabs.
- **How ToothGrid visualizes them:** Visualized via SVG components by normalizing `presenceStatus` and mapping to specific markers/conditions.
- **Persisted in tooth state:** Yes, as `presenceStatus` inside `ToothRecord`.
- **localStorage / Supabase-ready:** Currently stored in localStorage. It is Supabase-ready as a string-based enum, but requires strict validation so invalid values aren't saved.

## 3. Current clinical zone model
- **Ids/names:** `ClinicalZone` (`crown`, `endodontics`, `root`, `periodontium`, `bone`, `orthopedics`, `planning`).
- **Where defined:** `src/types/index.ts`
- **How tabs are generated:** In `ToothEditorModal.tsx`, tabs are generated via `availableZones.map()`, which in turn calls `getAvailableZonesForPresence(presenceStatus)`.
- **How zone filtering works:** `getAvailableZonesForPresence` dynamically scans all dictionaries (diagnoses and works) and aggregates any zone that is associated with the current `presenceStatus`.
- **How diagnoses/works are attached to zones:** `ClinicalDiagnosis` and `ClinicalWork` interfaces have an `allowedZones` array property.
- **How plannedWorkRecords store zone:** Stored directly as a `zone` property of type `ClinicalZone` in `PlannedWorkRecord`.

## 4. Current status → zones behavior

| Tooth position status | Current visible zones/tabs | Notes / problems |
| :--- | :--- | :--- |
| natural | crown, endodontics, root, periodontium | Vulnerable to change if a user adds an orthopedics work with `natural` status. |
| missing | planning, bone | `planning` is used as a generic zone, but it shouldn't be a clinical zone at all. |
| root_remnant | root | Missing bone, gum/periodontium, and orthopedics tabs. |
| implant | periodontium, bone, orthopedics | Missing gum tab (periodontium is used interchangeably). |
| deciduous | crown, endodontics, periodontium | Endodontics for deciduous teeth is valid, but often uses different terminology. |
| impacted | planning, bone | Fails to account for coronal / root pathologies that can still exist in impacted teeth. |

*(Note: The actual visible tabs change dynamically depending on the current state of the editable dictionaries in `src/config/clinicalDictionaries.ts` and `localStorage`)*

## 5. Recommended status → zones model

A strict, immutable system mapping should be established:

**Natural tooth:**
- crown / coronal part
- canals (endodontics)
- root
- gum (periodontium)
- orthopedics

**Deciduous tooth:**
- crown / coronal part
- canals (endodontics)
- root
- gum (periodontium)

**Root remnant:**
- root
- gum (periodontium)
- bone
- orthopedics

**Implant:**
- gum (periodontium)
- orthopedics
- bone

**Missing:**
- gum (periodontium)
- bone
- orthopedics

**Retained / unerupted (impacted):**
- crown / coronal part
- root
- gum (periodontium)
- bone

*Uncertainty:* The term `planning` was previously used as a zone but should be removed. Planning is a workflow phase, not a physical anatomical location.

## 6. Zone roles

- **crown / coronal part:** 
  - *Meaning:* The visible, enamel-covered part of the tooth.
  - *Diagnoses:* Caries, fractures, enamel defects.
  - *Works:* Fillings, fissure sealing, remineralization.
  - *Statuses:* natural, deciduous, retained.
  - *Not for:* Implants, root remnants, missing teeth.
- **canals (endodontics):**
  - *Meaning:* The inner pulp chamber and nerve canals.
  - *Diagnoses:* Pulpitis, necrosis, previously treated canals.
  - *Works:* Extirpation, canal obturation, root canal retreatment.
  - *Statuses:* natural, deciduous.
  - *Not for:* Implants, missing teeth.
- **root:**
  - *Meaning:* The portion of the tooth within the bone.
  - *Diagnoses:* Apical periodontitis, root caries, cysts.
  - *Works:* Root amputation, resection, root canal treatment.
  - *Statuses:* natural, deciduous, root_remnant, retained.
  - *Not for:* Implants, missing teeth.
- **gum (periodontium):**
  - *Meaning:* The soft tissue surrounding the tooth/implant.
  - *Diagnoses:* Gingivitis, periodontitis, recession, peri-implantitis.
  - *Works:* Scaling, root planing, flap surgery.
  - *Statuses:* ALL statuses.
- **orthopedics:**
  - *Meaning:* Prosthetic constructions attached to the tooth position.
  - *Diagnoses:* Crown defect, prosthesis failure.
  - *Works:* Crowns, veneers, bridges, removable prosthetics.
  - *Statuses:* natural, root_remnant, implant, missing.
  - *Not for:* deciduous, retained.
- **bone:**
  - *Meaning:* The alveolar bone supporting the tooth/implant.
  - *Diagnoses:* Bone atrophy, osteomyelitis.
  - *Works:* Bone grafting, sinus lift, implant placement.
  - *Statuses:* root_remnant, implant, missing, retained.
  - *Not for:* healthy natural/deciduous teeth (usually handled via periodontium).

## 7. Dictionary relationship impact

The new model guarantees architectural stability:
1. **tooth position status** (System) securely dictates → **available zones** (System).
2. **zone** dictates → **zone diagnoses** (Filtered from editable dictionary where `allowedZones` includes the zone).
3. **selected diagnosis** dictates → **linked works** (Filtered via `allowedDiagnosisIds`).
4. **work price** is derived strictly from the finalized work selection.

This prevents the editable dictionary from breaking the UI. If a clinic incorrectly assigns a "Caries" diagnosis to the "bone" zone, the system simply won't show it unless the user navigates to the "bone" tab (which is impossible for a "natural" tooth if "bone" isn't in its system-allowed zones).

## 8. Risks

- **Risk of mixing systemic statuses with editable dictionaries:** High. Clinics modifying dictionary items can currently alter the fundamental UI structure of the tooth modal.
- **Risk of putting prosthetics into anatomical/tooth position status:** Treating "Crown" or "Bridge" as a `presenceStatus` breaks filtering. Orthopedics must remain a clinical zone overlaying a base systemic status (e.g., natural + orthopedics: crown).
- **Risk of breaking existing saved tooth records:** Changing zone names (e.g., `planning` to `orthopedics` or dropping `planning`) may invalidate old `plannedWorkRecords` storing these zone IDs in localStorage.
- **Risk of Supabase column compatibility later:** Enum constraints in the database will fail if legacy or invalid zones are pushed to the backend.
- **Risk of ToothGrid markers depending on current zone names:** The visual UI map requires updating if zones are renamed (e.g., `periodontium` -> `gum`).
- **Risk of tests only covering static happy paths:** Tests currently expect `getAvailableZonesForPresence` to dynamically compute tabs and might fail when this is hardcoded.

## 9. Proposed next implementation tasks

1. `DENTALCHART-ZONE-MODEL-001` — Define immutable constants for `SystemicPresenceStatuses`, `SystemicClinicalZones`, and a hardcoded `STATUS_TO_ZONES_MAP`. Replace the dynamic `getAvailableZonesForPresence` calculation.
2. `DENTALCHART-ZONE-MIGRATION-001` — Safely rename internal zones (e.g., `planning` -> `orthopedics`, `periodontium` -> `gum`) and provide a backward-compatibility data normalizer for existing `plannedWorkRecords`.
3. `DENTALCHART-ZONE-TABS-001` — Update `ToothEditorModal` to reliably render tabs using the immutable `STATUS_TO_ZONES_MAP` regardless of dictionary state.
4. `DENTALCHART-DICTIONARY-ZONE-FILTER-001` — Enforce zone-aware and status-aware filtering loops inside `DiagnosesEditor` and `WorksEditor` so clinics cannot accidentally assign invalid zones to diagnoses.
5. `DENTALCHART-ORTHOPEDICS-LAYER-RECON-001` — Separate prosthetic constructions from tooth position status, defining how multi-tooth bridges span across "missing" statuses.

## 10. Required QA for future implementation

- **natural tooth tabs:** Assert presence of Crown, Canals, Root, Gum, Orthopedics.
- **implant tabs:** Assert presence of Gum, Orthopedics, Bone.
- **missing tabs:** Assert presence of Gum, Bone, Orthopedics.
- **root remnant tabs:** Assert presence of Root, Gum, Bone, Orthopedics.
- **retained tooth tabs:** Assert presence of Crown, Root, Gum, Bone.
- **Existing records load without crash:** Create a mock localStorage record with legacy `planning` and `periodontium` zones and ensure it maps to the new zones successfully without white-screening.
- **Persistence of selection:** Selected diagnosis/work should remain visible after status changes *only* if the new status shares the same allowed zone.
- **Invalid zone handling:** Ensure UI handles out-of-bounds `activeZone` state gracefully when switching from `natural` (active tab: crown) to `implant` (where crown doesn't exist).
- **Scope check:** Confirm no modifications were applied to treatment plans, billing, or storage logic.
