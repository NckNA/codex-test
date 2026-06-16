# CHATGPT-APPS-WORKFLOW-RECON-001

## Summary

Report-only recon for ChatGPT Apps, Apps SDK, MCP, Actions, connectors, Codex tooling, and browser/computer-use capability for DentalFlow CRM.

Recommendation: do not build a DentalFlow ChatGPT App now. Finish patient timeline, encounter/visit recon, audit/activity log, stable backend APIs, and reporting first.

## Branch

`recon/chatgpt-apps-workflow-001`

## PR URL

https://github.com/NckNA/codex-test/pull/296

## PR head reviewed before final report update

`641ebae0a5d0a2ea671f03d57a9ac8d5b80a48d6`

## Report update commit

N/A because the final report update commit cannot reference itself before creation.

## Changed files summary

One report file only:

- `_ai_work/REPORTS/CHATGPT-APPS-WORKFLOW-RECON-001_chatgpt_apps_workflow.md`

## Source basis

Reviewed official OpenAI Apps SDK, MCP Apps, MCP/connectors, GPT Actions, Codex browser/computer-use docs. Reviewed DentalFlow source docs for AI workflow, task review, multi-tenant rules, data isolation, backend/API rules, patient timeline, patient files, and cloud apply 0011.

Two requested project files were not present on current `main`:

- `_ai_work/SOURCES/19_TOOL_REGISTRY_AND_USAGE_POLICY.md`
- `_ai_work/REPORTS/OPEN-SOURCE-DENTAL-CRM-ARCHITECTURE-RECON-001_open_source_patterns.md`

## Definitions

ChatGPT Apps are in-chat integrations with tools and optional UI.

Apps SDK is the build stack for those integrations.

MCP is the tool connection protocol used by Apps SDK and connector flows.

Actions are a Custom GPT REST integration pattern.

Connectors are maintained integrations for common services.

Codex/Jules tools are development workflow tools.

Browser/computer-use capabilities are separate UI inspection and operation capabilities. An App is not automatically a browser controller.

## Practical difference table

| Item | Meaning | Use now |
|---|---|---|
| ChatGPT App | In-chat integration | Later |
| Apps SDK | App build stack | Later |
| MCP | Tool connection protocol | Later |
| Connector | Service integration | Sometimes |
| Action | REST bridge | Narrow cases |
| Codex/Jules | Code workflow | Yes |
| Browser tool | UI smoke | When needed |
| GitHub/Supabase | Project operations | Yes, scoped |

## What helps DentalFlow now

Useful now:

- GitHub for PR truth;
- Codex/Jules for scoped implementation;
- Supabase tools only for explicit database/cloud tasks;
- browser tooling only for UI acceptance criteria;
- web research for current official docs.

Useful later:

- read-only DentalFlow assistant;
- clinic reporting assistant;
- doctor patient-summary assistant;
- registrar scheduling assistant;
- support/onboarding assistant.

Not useful now:

- building a DentalFlow ChatGPT App;
- building a broad DentalFlow MCP layer;
- connecting production clinic data;
- giving broad autonomous access by default.

## Future DentalFlow product use cases

Clinic owner assistant:

- appointments;
- revenue/status questions;
- debts;
- workload;
- treatment plan acceptance.

Doctor assistant:

- patient summary;
- timeline;
- findings;
- treatment plan;
- patient files.

Registrar assistant:

- appointment search;
- free slots;
- patient contact lookup;
- reminders.

Cashier assistant:

- payments;
- debt summary;
- invoices.

Admin assistant:

- users and roles;
- dictionaries;
- clinic settings;
- subscription state.

Analytics assistant:

- reports;
- patient flow;
- conversion;
- workload.

Support assistant:

- help clinics learn DentalFlow without patient data access.

## Security and tenant risks

Main risks:

- cross-tenant data leakage;
- wrong-role visibility;
- over-broad tool access;
- browser tool opens the wrong clinic;
- unreviewed actions;
- prompt injection through notes, files, or documents;
- unclear medical-data retention;
- platform role confused with clinic role;
- dev/test and production environment confusion.

Future DentalFlow App/MCP rule:

- tenant-scoped;
- role-scoped;
- read-only first;
- logged;
- explicit confirmation for writes;
- no hidden demo/local fallback;
- security review before real patient data.

## Capability cost policy for Nick

| Task type | Enable |
|---|---|
| Report-only recon | GitHub, web if current docs |
| PR review | GitHub |
| Local tests | terminal/local agent |
| Local database validation | terminal/local database |
| Cloud migration apply | cloud database + GitHub |
| Browser smoke | browser tool + local app |
| File upload smoke | browser + local database |
| App integration test | browser + test app account |
| Full implementation | GitHub + terminal + tests |
| Production-like QA | explicit approval |

Before every task, ChatGPT should state:

- GitHub: yes/no
- Terminal/autonomous agent: yes/no
- Local Supabase: yes/no
- Browser/site: yes/no
- Supabase cloud: yes/no
- Web research: yes/no

## Should DentalFlow build a ChatGPT App now?

No.

Recommended sequence:

1. `PATIENT-TIMELINE-AGGREGATOR-001`
2. `ENCOUNTER-VISIT-MODEL-RECON-001`
3. `AUDIT-ACTIVITY-LOG-RECON-001`
4. `REPORTING-API-RECON-001`
5. `DENTALFLOW-READONLY-API-GATEWAY-RECON-001`
6. `DENTALFLOW-MCP-READONLY-ASSISTANT-RECON-001`
7. `DENTALFLOW-CHATGPT-APP-READONLY-PROTOTYPE-001`

Do not jump to step 7. That would be decorating scaffolding.

## What was intentionally NOT changed

- no code;
- no migrations;
- no cloud;
- no browser smoke;
- no app created;
- no MCP layer created;
- no external account connection;
- no dependencies added;
- no external code copied;
- no sensitive values added.

## Checks

- Local `git status --short`: not run in this runtime.
- npm checks: not required for report-only recon unless CI runs.
- GitHub Actions CI: run `27626542103` / CI `#465` / success on head `641ebae0a5d0a2ea671f03d57a9ac8d5b80a48d6`.

## Final verdict

`RECON COMPLETE`

## Recommended next task

`PATIENT-TIMELINE-AGGREGATOR-001`
