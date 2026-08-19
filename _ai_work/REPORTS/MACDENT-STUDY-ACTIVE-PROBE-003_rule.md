# MACDENT-STUDY-ACTIVE-PROBE-003

Verdict: PASS

## Goal

Clarify that STUDY/RECON is read-only by default, not absolutely read-only, and permit controlled active-probe writes when passive observation cannot establish causality. Also clarify bounded raw-memory inspection as an approved diagnostic technique for our own DentalFlow/Hermes processes.

## Rule changes

- Passive STUDY/RECON remains read-only by default.
- ACTIVE-PROBE STUDY is allowed with minimal test writes against a test/demo/sandbox tenant or explicitly created test entity.
- Active probes require baseline capture, observation, diff, rollback/cleanup and no privilege expansion.
- Real patient, clinical, appointment and financial facts must not be used as experimental fixtures.
- For our own DentalFlow/Hermes processes, bounded read-only runtime memory inspection is allowed when counters/runtime metadata are insufficient.
- Raw-memory inspection of third-party software is not automatic ordinary recon and requires a concrete diagnostic need while remaining read-only and non-bypassing.

## Canonical workflow

`READ BASELINE → MINIMAL TEST WRITE → OBSERVE → DIFF → ROLLBACK/CLEANUP → SEMANTIC CONTRACT`

## Files changed

- `_ai_work/MACDENT_REFERENCE_RULE.md`
- `_ai_work/REPORTS/MACDENT-STUDY-ACTIVE-PROBE-003_rule.md`

## Recommended next task

Continue MacDent/DentalFlow reconstruction using passive RECON first and ACTIVE-PROBE STUDY only where causality cannot be established otherwise.
