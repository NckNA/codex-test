# MACDENT-REFERENCE-RULE-002 — MacDent Lawful Deep-Recon Project Rule

## 1. Final verdict

Task verdict: **MACDENT LAWFUL DEEP-RECON RULE CODIFIED AND VERIFIED**

Machine-readable final verdict: **PASS**

DentalFlow now explicitly treats MacDent as a functional, process, domain and engineering reference. Reading and analyzing lawfully accessible MacDent client code is explicitly allowed. Mechanical copying and unauthorized access remain outside the project method.

## 2. Summary

This task replaces the ambiguous product-spec sentence `Не копировать MacDent` with a precise operational rule.

The rule now distinguishes:

```text
lawfully accessible material -> READ / STUDY / UNDERSTAND = ALLOWED
understanding -> SEMANTIC CONTRACT -> INDEPENDENT DENTALFLOW IMPLEMENTATION
mechanical code/text/asset copying = NOT THE METHOD
unauthorized access / auth bypass / secret extraction = FORBIDDEN
```

The rule also makes future blanket statements such as `we cannot read MacDent code` explicitly inconsistent with project policy unless a concrete access/privacy/contract/legal issue exists for the specific material.

## 3. Branch

`docs/macdent-reference-rule-002`

## 4. PR URL

https://github.com/NckNA/codex-test/pull/366

## 5. Baseline

- Repository: `NckNA/codex-test`.
- Base branch: `main`.
- Verified baseline: `b0f59296848a707082855824c0dd09fd6a055c60`.
- Worktree: `D:\hermes\macdent-reference-rule-002-work`.
- Application code changes: `0`.
- Database/migration changes: `0`.
- Cloud Supabase writes: `0`.
- MacDent writes: `0`.
- amoCRM writes: `0`.

## 6. Implementation head reviewed before final report update

- Implementation head: `ec1731a94926b142cadfe3dacefe10bd3efa9972`.
- Workflow: `CI`.
- Run number: `#779`.
- Run ID: `32198977968`.
- Conclusion: `success`.
- Tested commit matched implementation head exactly.

## 7. Report update commit

Report update commit: N/A because a report-only follow-up commit cannot contain its own future SHA and final CI result without creating another SHA.

The exact final report commit and fresh CI run must be recorded by the final task response / immutable finalization metadata.

## 8. Changed files

Implementation rule changes:

1. `_ai_work/MACDENT_REFERENCE_RULE.md`;
2. `_ai_work/PRODUCT_SPEC.md`.

Final report:

3. `_ai_work/REPORTS/MACDENT-REFERENCE-RULE-002_rule.md`.

No application source, migration, seed, package, lockfile, environment or production integration file belongs in this diff.

## 9. Canonical rule content

The new rule establishes:

- MacDent is an allowed and expected functional/process/domain/engineering reference;
- lawfully accessible client code may be read and analyzed;
- client JavaScript already delivered to an authorized browser is valid STUDY/RECON material;
- installed files already present on the user's own computer may be inspected read-only;
- UI, DOM, routes, API semantics, state machines, error handling and algorithms may be studied for understanding;
- patient data and secrets are not the reconnaissance target and should be redacted/avoided;
- no blanket prohibition on code reading is permitted;
- server-side source that is not delivered to the authorized client must not be obtained by bypassing access controls;
- mechanical line-by-line or structure-preserving source translation is not the implementation method;
- semantic distillation is mandatory before DentalFlow implementation.

## 10. Mandatory semantic boundary

Required flow:

```text
MacDent UI / client code / behavior / API contract
                    ↓
              STUDY / RECON
                    ↓
         semantic facts/evidence
                    ↓
       independent semantic contract
                    ↓
 DentalFlow entities/invariants/roles
                    ↓
    DentalFlow architecture/source truth
                    ↓
      independent implementation
                    ↓
              VERIFY / AUDIT
```

This preserves the value of studying an existing mature dental system without using MacDent source as a mechanical source-to-source transformation template.

## 11. Deep-recon tool capability verified in Hermes

Separate Hermes Core work performed during this task established the read-only reconnaissance capability contract:

`D:\hermes\core\bridge\docs\HERMES_LAWFUL_DEEP_RECON_CONTRACT_RU.md`

Current ordinary read-only coverage:

- L0: visible UI/workflow behavior;
- L1: DOM/action structure without input values;
- L2: loaded resources/scripts/service workers/storage key names/IndexedDB database names;
- L3: already-loaded JavaScript source through local CDP;
- L3 search: compact line-context search over already-loaded JavaScript;
- L4: installed application metadata and safe install-tree inventory;
- L5: running process/module/TCP metadata without process-memory access;
- L6: PE metadata/signatures/hashes/bounded strings;
- L7: immutable SQLite schema inspection without row contents.

Decompilation/disassembly/runtime-memory instrumentation remain a separate yellow-gate class and are not ordinary automatic reconnaissance.

## 12. Live MacDent capability verification

Using the existing authorized MacDent Chrome profile on localhost CDP port `9366`, read-only smoke verification succeeded for:

- authenticated page inventory;
- page title/path/resource structure;
- service-worker discovery;
- storage key-name discovery without values;
- DOM action structure without form values;
- JavaScript already parsed by the page;
- exact loaded-source SHA-256 calculation;
- compact code search with line numbers/context.

The read-only loaded-script check successfully inspected the already-loaded MacDent `v2.macdent.kz/js/main.js` script. The reconnaissance tooling did not navigate to hidden endpoints, fetch server-side source, read cookies/storage values, replay requests or perform a MacDent mutation.

## 13. Checks

### Rule consistency

**PASS**

`PRODUCT_SPEC.md` no longer contains an ambiguous blanket `Не копировать MacDent` statement. It now points to the canonical reference rule and explicitly allows lawful client-code analysis.

### Deep-inspection base smoke

**PASS**

Verified:

- installed application lookup;
- Windows process inspection;
- binary metadata inspection;
- immutable SQLite schema inspection;
- Chrome CDP page reconnaissance.

### Deep-inspection extra smoke

**PASS**

Verified:

- safe install-tree inventory;
- DOM action mapping;
- already-loaded script source reading;
- compact loaded-code search.

### Temporary Hermes Bridge startup

**PASS**

A separate local bridge instance started successfully on `127.0.0.1:8899` with the new deep-inspection modules loaded and was automatically stopped after the smoke check.

### Git diff

- `git diff --check`: **PASS** before implementation commit.
- implementation commit changed exactly two rule/spec files.

### GitHub CI

Implementation head `ec1731a94926b142cadfe3dacefe10bd3efa9972` passed CI run `32198977968` / `#779`:

- Merge guard: success;
- ESLint: success;
- Tests: success;
- Build: success.

## 14. Browser smoke

**NOT REQUIRED FOR DENTALFLOW RULE CHANGE**

Reason: the repository change is documentation/rule-only and changes no application/browser behavior.

Hermes deep-recon tools themselves were separately live-smoked against the existing authorized MacDent browser session as described above.

## 15. Issues / Limitations

- The currently running public Hermes Node process predates the new deep-inspection tool registrations. The modules are implemented and smoke-tested, but the new tool names become first-class connector calls after the next normal public bridge restart.
- A full public-launcher restart was intentionally not forced during this active ChatGPT session because that launcher creates a new public connector URL and could interrupt the current session.
- Until that restart, the same tested module functions remain usable through the existing Hermes terminal/local execution path.
- Ordinary deep recon intentionally excludes unauthorized server-side source acquisition, credential extraction and protection bypass.
- Decompilation/disassembly/runtime-memory work is a separately gated class, not part of automatic L0-L7 reconnaissance.

## 16. Safety result

```text
LAWFUL CLIENT-CODE READING: EXPLICITLY ALLOWED
SEMANTIC-DISTILLATION BOUNDARY: REQUIRED
MECHANICAL SOURCE COPYING: NOT THE METHOD
AUTHORIZATION BYPASS: FORBIDDEN
SECRET EXTRACTION: FORBIDDEN
PRODUCTION MACDENT WRITES DURING RECON: 0
DATABASE CHANGES: 0
APPLICATION CODE CHANGES: 0
CLOUD WRITES: 0
```

## 17. Recommended next task

`MACDENT-DEEP-RECON-CATALOG-001` — use the new L0-L7 read-only tooling to build a structured MacDent module/code/workflow catalog and semantic feature map, starting from already-open authorized pages and loaded client code, while retaining zero production mutations and zero PHI persistence.
