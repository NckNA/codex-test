# 15_AI_WORKFLOW_FOR_JULES_CODEX_CHATGPT.md

## Назначение документа

Этот документ описывает правила совместной работы пользователя, ChatGPT, Jules, Codex и GitHub при разработке DentalFlow CRM.

DentalFlow создаётся не одним действием и не одним агентом. В проекте используется связка:

```text
User
→ ChatGPT
→ Jules / Codex
→ GitHub
→ Review
→ Merge
→ Next task
```

Главное правило:

**ИИ-агенты должны работать по точным задачам, источникам и ограничениям, а не “примерно понять и улучшить всё вокруг”.**

Второе главное правило:

**если точное содержание документа, файла или требования отсутствует, агент должен остановиться и сообщить, чего не хватает, а не придумывать.**

Третье главное правило:

**каждая задача должна иметь ограниченный scope, отдельную ветку, отчёт и проверяемый результат.**

Иначе проект быстро превращается в весёлый фестиваль: один ИИ создал PR из прошлого, второй переписал риски проекта, человек думал, что отправил payload, GitHub сделал вид, что всё нормально, а потом все смотрят на diff как на место преступления. Технологический прогресс, конечно, впечатляет.

---

## Участники workflow

В процессе участвуют несколько ролей.

### User

Пользователь является владельцем идеи, продукта и бизнес-целей.

User:

- определяет направление;
- принимает продуктовые решения;
- подтверждает задачи;
- передаёт payload;
- проверяет PR;
- делает merge;
- принимает финальное решение;
- сообщает, если агент ушёл не туда.

User может ошибаться.

Поэтому workflow должен быть устойчивым к человеческой путанице.

### ChatGPT

ChatGPT помогает:

- структурировать идеи;
- создавать source documents;
- формировать задачи для Jules/Codex;
- проверять отчёты;
- проверять PR status;
- анализировать риски;
- писать review checklist;
- объяснять, что делать дальше;
- удерживать архитектурные границы проекта.

ChatGPT не должен придумывать факт выполненного PR без проверки.

### Jules

Jules выполняет задачи в репозитории.

Jules может:

- создавать ветки;
- редактировать файлы;
- запускать проверки;
- создавать commit;
- создавать PR;
- писать final response.

Jules должен строго соблюдать scope задачи.

Jules не должен делать “улучшения по пути”.

### Codex

Codex может использоваться для анализа кода, проверки, исправлений и реализации.

Codex должен:

- проверять сборку;
- анализировать ошибки;
- предлагать исправления;
- не ломать архитектуру;
- не выходить за scope;
- не создавать изменения без ясной задачи.

### GitHub

GitHub является источником правды по:

- PR;
- commit;
- branch;
- merge status;
- changed files;
- history;
- reports;
- source documents.

Если слова агента противоречат GitHub, проверяется GitHub.

---

## Главная цепочка работы

Правильная цепочка:

```text
1. User формулирует цель
2. ChatGPT уточняет и превращает цель в задачу
3. User передаёт задачу Jules/Codex
4. Jules/Codex выполняет задачу в отдельной ветке
5. Jules/Codex создаёт PR
6. Jules/Codex даёт final response
7. ChatGPT/User проверяют PR
8. User делает merge
9. ChatGPT фиксирует следующий шаг
```

Нельзя перескакивать сразу к большому изменению без понятного scope.

---

## Почему задачи должны быть маленькими

Большие задачи повышают риск:

- смешать документы;
- изменить не те файлы;
- сломать код;
- создать конфликт;
- потерять контекст;
- переписать legacy docs;
- добавить лишнюю реализацию;
- выдумать отсутствующее содержание;
- создать duplicate PR;
- затруднить review.

Маленькая задача ограничивает ущерб.

Это не бюрократия ради бюрократии.

Это ремень безопасности для проекта, где люди и ИИ по очереди делают вид, что всё помнят.

---

## Источники проекта

Ключевые source documents находятся в:

```text
_ai_work/SOURCES/
```

Они являются стабильной основой проекта.

Документы:

```text
00_PROJECT_MASTER_CONTEXT.md
01_PRODUCT_VISION_AND_BUSINESS_MODEL.md
02_ROLES_AND_PERMISSIONS.md
03_MULTI_TENANT_ARCHITECTURE_RULES.md
04_DATA_ISOLATION_AND_SECURITY.md
05_MEDICAL_DOMAIN_MODEL.md
06_PATIENT_CARD_AND_DENTAL_CHART_RULES.md
07_TREATMENT_PLAN_AND_DOCUMENTS.md
08_APPOINTMENTS_AND_SCHEDULE.md
09_AMOCRM_INTEGRATION_RULES.md
10_AMOCRM_TECHNICAL_ARCHITECTURE.md
11_BACKEND_AND_API_ARCHITECTURE.md
12_BILLING_AND_ACCESS_CONTROL.md
13_STORAGE_AND_MIGRATION_STRATEGY.md
14_UI_UX_RULES.md
15_AI_WORKFLOW_FOR_JULES_CODEX_CHATGPT.md
16_DEVELOPMENT_ROADMAP_AND_TASK_BACKLOG.md
17_TASK_TEMPLATE_AND_PR_REVIEW_CHECKLIST.md
18_TESTING_AND_QUALITY_ASSURANCE_STRATEGY.md
```

Если документ ещё не создан, агент не должен выдумывать его содержание.

---

## SOURCES_INDEX.md

`_ai_work/SOURCES/SOURCES_INDEX.md` показывает статус source documents.

Правила:

- если документ создан, status должен быть Provided;
- если документ отсутствует, status должен оставаться Missing / Not Provided;
- нельзя отмечать документ Provided без файла;
- нельзя создавать пустой placeholder и считать его Provided;
- нельзя менять статус документов вне scope.

SOURCES_INDEX должен соответствовать реальному состоянию файлов.

---

## Legacy docs

В проекте могут существовать legacy docs в `_ai_work/`.

Legacy docs не являются автоматической заменой source documents.

Запрещено:

```text
скопировать старый PRODUCT_CONTEXT.md в новый source document
```

если задача требует exact content.

Разрешено использовать legacy docs только если задача явно разрешает.

---

## Правило exact content

Если задача говорит:

```text
Use only the exact content provided in this task payload.
```

агент обязан:

- использовать только текст из payload;
- не переписывать;
- не сокращать;
- не расширять;
- не улучшать стиль;
- не добавлять новые правила;
- не копировать из других файлов;
- не вставлять теги `<<<BEGIN...>>>` and `<<<END...>>>` в итоговый файл.

Если exact content отсутствует, файл не создаётся.

---

## Правило missing content

Если точное содержание отсутствует, агент должен остановиться.

Правильный ответ:

```text
I cannot create this file because the exact content was not provided.
Missing file:
- _ai_work/SOURCES/XX_NAME.md
```

Неправильный ответ:

```text
I created a reasonable draft based on previous context.
```

“Reasonable draft” — это красивая фраза для “я придумал правила проекта за владельца”.

---

## Payload markers

Для передачи точного текста используются markers:

```text
<<<BEGIN_FILE_XX>>
...
<<<END_FILE_XX>>
```

Агент должен:

- извлечь только текст между markers;
- исключить сами markers;
- сохранить Markdown;
- проверить code blocks;
- не добавлять обрамляющие комментарии.

Если markers повреждены или отсутствуют, остановиться и сообщить.

---

## Один документ за одну задачу

Для source documents предпочтительно:

```text
one document = one task = one branch = one PR
```

Это уменьшает риск.

Особенно если документы большие.

И да, это полезно именно потому, что человек может случайно вставить старый отчёт, не отправить payload или подумать, что “уже дал задачу”. Встроенная защита от человеческого фольклора.

---

## Название Task ID

Task ID должен быть стабильным.

Примеры:

```text
DOCS-002-A-00
DOCS-002-B-06
DOCS-002-C-09
DOCS-002-D-13
DOCS-002-E-15
AMO-004
```

Task ID должен быть указан:

- в payload;
- в report;
- в branch name if practical;
- в PR title;
- в final response.

---

## Branch naming

Branch name должен быть понятным.

Пример:

```text
feature/docs-002-e-15-add-ai-workflow-rules
```

Правила:

- lowercase;
- kebab-case;
- включает task id или смысл;
- не переиспользовать старую ветку;
- не создавать ветку от старого head;
- начинать от актуального main.

Плохой вариант:

```text
fix-docs
new-branch
test-pr-004
feature/old-task-again
```

---

## Base branch

Для каждой новой задачи агент должен начинать от актуального `main`.

Правильная последовательность:

```text
git fetch origin
git checkout main
g.i.t p.u.l.l origin main
git checkout -b feature/task-name
```

Если используется другой механизм, результат всё равно должен быть:

```text
new branch from current main
```

Не создавать новую задачу поверх старой feature ветки без явного разрешения.

---

## PR title

PR title должен быть точным.

Пример:

```text
DOCS-002-E-15: add AI workflow rules source
```

PR title должен соответствовать задаче.

Если PR title отличается, но файлы правильные, это может быть acceptable, но лучше соблюдать шаблон.

---

## PR body

PR body должен содержать:

- summary;
- changed files;
- safety notes;
- checks;
- what was not implemented;
- risks if relevant.

PR body не должен содержать secrets.

PR body не должен заявлять production readiness, если задача skeleton/docs-only.

---

## Changed files discipline

Каждая задача должна иметь ожидаемый список файлов.

Пример docs-only source task:

```text
_ai_work/SOURCES/15_AI_WORKFLOW_FOR_JULES_CODEX_CHATGPT.md
_ai_work/SOURCES/SOURCES_INDEX.md
_ai_work/REPORTS/DOCS-002-E-15_add_ai_workflow_rules_report.md
```

Если changed files больше ожидаемого списка, агент должен объяснить почему.

Если изменены forbidden files, задача считается подозрительной.

---

## Forbidden files

Для docs-only задач запрещено менять:

```text
src/
backend/src/
package.json
package-lock.json
```

Также запрещено менять:

- application logic;
- backend logic;
- storage/localStorage logic;
- OAuth implementation;
- amoCRM implementation;
- UI components;
- routing.

Если это случилось случайно, агент должен откатить изменение.

---

## Report file

Каждая задача должна создавать report.

Report path:

```text
_ai_work/REPORTS/<TASK_ID>_<description>_report.md
```

Report нужен, чтобы оставить след:

- что сделано;
- какие файлы изменены;
- какие проверки прошли;
- что не реализовано;
- какие риски остались;
- что важно для следующей задачи.

Report — это не украшение. Это память проекта, потому что человеческая память уже показала себя как storage engine с багами.

---

## Report structure

Report должен включать:

```text
# <Task ID> Report

## Task ID

## Summary

## Added files

## Modified files

## Missing source files

## SOURCES_INDEX.md update summary

## Markdown formatting notes

## Changed files

## Checks

## Safety notes

## What was not implemented

## Risks
```

Не все разделы нужны для каждой задачи, но core sections должны быть.

---

## Safety notes

Safety notes обязательны для задач, которые могут касаться:

- medical data;
- patient data;
- tenant isolation;
- security;
- billing;
- integrations;
- tokens;
- storage;
- UI visibility;
- backend.

Для docs-only задач safety notes должны указать:

- docs-only;
- no application logic changed;
- no backend logic changed;
- no secrets added;
- no real patient data added;
- no production data added;
- no `.env` with real values added;
- no package changes.

---

## What was not implemented

Report должен честно писать, что не реализовано.

Пример:

```text
No source code changes were implemented.
No backend logic was implemented.
No real amoCRM sync was implemented.
No production token storage was implemented.
No billing/payment provider was implemented.
```

Честное “not implemented” лучше, чем бодрое “completed”, после которого все думают, что система готова, а там только документ и три обещания.

---

## Checks

Checks должны быть реальными.

Для frontend project:

```text
npm run lint
npm run build
```

Для backend skeleton:

```text
npm run check
node --check ...
```

Если CI нет, так и писать:

```text
No GitHub CI checks are configured.
```

Не заявлять CI passed, если CI нет.

---

## Markdown checks

Для source docs нужно проверять:

- file exists;
- headings valid;
- code blocks closed;
- no accidental inclusion of payload markers;
- no unclosed code fence;
- no plain text blob;
- title preserved;
- SOURCES_INDEX status matches.

Если code block не закрыт, агент должен исправить до PR.

---

## GitHub as source of truth

GitHub проверяет реальность.

Нужно проверять:

- PR URL;
- branch;
- commit hash;
- base branch;
- changed files;
- merged status;
- merge commit;
- conflicts;
- CI/checks if available.

Если Jules говорит “merged”, но GitHub говорит “open”, верить GitHub.

Если connector temporarily returns Not Found, это не доказательство провала PR. Нужно перепроверить через PR URL/status.

---

## Проверка PR

После final response агента нужно проверить:

```text
PR exists
PR target is main
branch name correct
changed files correct
no forbidden files changed
mergeable true
checks passed or reported
report exists
```

Если PR open, его нужно смержить вручную или через согласованный механизм.

Если PR already merged, зафиксировать факт.

---

## Merge discipline

Merge делает пользователь или явный authorized step.

После merge нужно проверить:

```text
state = closed
merged = true
merged_at exists
merge_commit_sha exists
```

Не считать задачу закрытой только потому, что PR создан.

PR created ≠ merged.

Опять эта странная человеческая любовь путать “заявку подали” и “дом построен”.

---

## Duplicate PR problem

Если агент создал duplicate PR, нужно:

- определить правильный PR;
- проверить, какой PR merged;
- не продолжать работу из конфликтного duplicate;
- закрыть duplicate if needed;
- начать новую задачу от clean main.

Признаки duplicate:

- похожий branch name with random suffix;
- same task repeated;
- merge conflicts with old history;
- PR body refers to previous task;
- branch not from latest main.

---

## Wrong context problem

Если агент ушёл в старый контекст, нужно остановить.

Пример wrong context:

```text
TEST-PR-004_jules_gh_token_direct_delivery_check
```

когда текущая задача:

```text
DOCS-002-B-08
```

Правильная команда:

```text
Stop.
You are in the wrong old context.
Current task is <TASK_ID>.
Do not create files/branch/PR for old task.
Work only from the latest payload.
```

Если агент снова уходит в старый контекст, лучше открыть новую сессию.

---

## Old report pasted as new result

Иногда пользователь или агент может вставить старый отчёт.

Нужно проверять:

- Task ID;
- PR number;
- branch;
- commit;
- changed files;
- document number.

Если пользователь прислал отчёт по `07`, а текущая задача `08`, это не завершение `08`.

Нужно сказать:

```text
Это старый отчёт.
Текущая задача другая.
```

Да, это уже стало ритуалом. Но хотя бы теперь он документирован.

---

## Human error handling

Workflow должен учитывать, что пользователь может:

- забыть отправить payload;
- отправить старый отчёт;
- перепутать номер документа;
- подумать, что уже дал задачу;
- случайно подтвердить не тот план;
- забыть merge;
- не заметить open PR;
- вставить partial content.

ИИ не должен обвинять пользователя.

ИИ должен выявить несоответствие и вернуть процесс на рельсы.

---

## AI error handling

Workflow должен учитывать, что агент может:

- уйти в старый контекст;
- создать duplicate PR;
- переписать не тот файл;
- изменить forbidden files;
- заявить checks без запуска;
- создать PR из старой ветки;
- включить payload markers в файл;
- придумать missing content;
- скопировать legacy docs;
- поменять scope.

Такие ошибки нужно ловить через review checklist.

---

## Stop conditions

Агент должен остановиться, если:

- exact content отсутствует;
- payload markers отсутствуют;
- task unclear;
- required source file missing;
- repo state dirty in unexpected way;
- branch conflict unresolved;
- forbidden file changed and cannot be reverted;
- secret found;
- real patient data included;
- implementation requires decision not in task;
- migration destructive but not approved;
- payment/provider action needed;
- external API action would be real and not authorized.

Остановиться лучше, чем уверенно сделать глупость.

Редкое, но полезное умение.

---

## No invention rule

Агент не должен придумывать:

- business rules;
- medical rules;
- billing policy;
- tenant policy;
- legal retention;
- source document content;
- production readiness;
- exact API behavior;
- field mapping;
- pricing;
- permissions;
- status transitions.

Если нужно решение, агент должен спросить or mark future.

---

## No scope creep rule

Агент не должен “улучшать” проект вне задачи.

Примеры forbidden scope creep:

```text
docs task → changes React component
source doc task → updates package.json
UI task → implements amoCRM sync
backend skeleton task → rewrites frontend routing
billing doc task → adds payment provider dependency
```

Даже если изменение “полезное”, оно должно быть отдельной задачей.

---

## No silent code changes

Если задача docs-only, code changes запрещены.

Если код изменился случайно:

- revert code changes;
- keep docs changes only;
- mention in report if relevant.

Нельзя сказать:

```text
I also fixed a small bug
```

в docs-only PR.

Маленький багфикс в неправильном PR — это будущий археологический слой.

---

## No secrets rule

Никогда не добавлять в repo:

- real `.env`;
- access token;
- refresh token;
- client secret;
- authorization code;
- webhook secret;
- GitHub token;
- database URL;
- private key;
- payment provider secret.

Если secret попал в repo:

```text
stop
report incident
rotate secret
remove from history if needed
```

---

## No real patient data rule

Не добавлять в repo реальные данные пациентов.

Запрещено:

- реальные ФИО;
- реальные телефоны;
- реальные медицинские заметки;
- реальные документы;
- реальные снимки;
- реальные платежи;
- реальные диагнозы;
- реальные файлов пациентов.

Для docs использовать fake examples.

---

## Medical boundary rule

Если задача касается medical data, агент должен проверить:

- no medical data to amoCRM;
- no auto diagnosis;
- no payment equals treatment;
- no appointment equals treatment;
- no preview equals document;
- no document snapshot mutation;
- role-aware access;
- tenant isolation.

Эти правила повторяются не потому, что тексту нечем заняться, а потому что ошибки в этих местах дорогие.

---

## amoCRM boundary rule

Если задача касается amoCRM, агент должен проверить:

- no direct frontend amoCRM API calls;
- backend/proxy boundary;
- tokens server-side;
- safe DTO allowlist;
- no toothNumber;
- no findings;
- no riskDescription;
- no diagnosis;
- no medical document;
- no raw patient object;
- no full treatment plan object;
- tenant-scoped connection.

---

## Billing boundary rule

Если задача касается billing/access:

- platform billing != clinic finance;
- patient payment != SaaS payment;
- subscription status separated from access status;
- suspended tenant data not deleted;
- feature gate backend-enforced;
- ordinary staff not shown billing debt;
- audit for access changes.

---

## Storage boundary rule

Если задача касается storage/migration:

- localStorage not production source of truth;
- no `localStorage.clear()` migration;
- tenantId preserved;
- no cross-tenant references;
- snapshots not mutated;
- no destructive migration without approval;
- backup/rollback considered;
- sensitive data not logged.

---

## UI boundary rule

Если задача касается UI:

- role-aware UI;
- tenant context clear;
- no stale tenant data;
- empty/loading/error states;
- disabled states explained;
- dangerous actions confirmed;
- no fake buttons;
- no secrets shown;
- no medical data in amoCRM preview;
- PatientCard not God Component.

---

## Backend boundary rule

Если задача касается backend/API:

- backend is security boundary;
- frontend not trusted;
- auth/tenant/permission considered;
- feature entitlement considered;
- validation backend-side;
- safe DTO;
- safe errors;
- no raw secrets;
- no raw database object leakage;
- audit/log impact described.

---

## Task payload structure

Хороший task payload должен содержать:

```text
Task ID
Title
Phase
Type
Goal
Context
Scope
Allowed
Forbidden
Critical rule
Markdown rules, if docs
Tenant impact
Storage impact
Sensitive data impact
Acceptance criteria
Checks
Report path and report contents
Branch
PR title
Final response requirements
Source file content, if needed
```

Чем точнее payload, тем меньше ИИ делает вид, что умеет читать мысли.

---

## Task type

Возможные task types:

```text
docs
frontend
backend
integration
test
refactor
migration
security
bugfix
chore
```

Task type должен соответствовать scope.

Docs task не должен менять code.

Migration task не должен прятаться как chore.

---

## Phase

Phase помогает понять контекст.

Примеры:

```text
Phase 0 — Source foundation
Phase 1 — Prototype stabilization
Phase 2 — Backend foundation
Phase 3 — Multi-tenant SaaS foundation
Phase 4 — Real integrations
Phase 5 — Billing and access control
Phase 6 — Production hardening
```

Фаза не заменяет scope.

---

## Impact fields

Каждая задача должна указывать:

```text
Tenant impact
Storage impact
Sensitive data impact
```

В future backend/code задачах также полезно:

```text
Auth impact
Permission impact
Billing impact
Integration impact
Migration impact
```

Если impact none, так и писать.

---

## Acceptance criteria

Acceptance criteria должны быть проверяемыми.

Плохо:

```text
make it better
```

Хорошо:

```text
- file X created
- file Y updated
- no src/ changes
- build passes
- report created
```

Acceptance criteria — это не пожелания, а условия приёмки.

---

## Checks are not decoration

Checks должны быть привязаны к задаче.

Docs task:

```text
changed files docs-only
Markdown valid
no source code changed
```

Frontend task:

```text
lint
build
UI states verified
no forbidden data exposure
```

Backend task:

```text
syntax check
tests
route checks
secret scan
tenant guard review
```

---

## PR final response

Final response агента должен включать:

```text
PR URL
Branch
Commit hash
PR target
Changed files summary
Checks results
Report path
```

Если PR не создан, агент должен сказать почему.

Если checks не запускались, агент должен сказать честно.

---

## Review by ChatGPT/User

После final response нужно проверить:

- PR exists;
- changed files match;
- branch correct;
- base main;
- status open/merged;
- no forbidden files;
- report exists;
- checks credible;
- task ID correct;
- no stale old task;
- no duplicate PR.

Review не должен быть “ну вроде норм”.

“Вроде” — отличная прелюдия к багу.

---

## When to ask clarification

Агент должен спрашивать clarification только если:

- required content missing;
- decision affects architecture;
- scope ambiguous;
- destructive change possible;
- external action needed;
- secrets/auth/payment needed;
- multiple implementation paths with important tradeoffs.

Не спрашивать лишние вопросы ради имитации глубины.

---

## Clarification quality

Хороший clarification:

```text
I need exact content for file 15.
Without it I cannot create the file.
```

Плохой clarification:

```text
Would you like me to use Markdown?
```

если task already says Markdown.

Агенты иногда любят превращать очевидное в совещание. Нельзя.

---

## Consent checkpoints

Нужен явный checkpoint перед:

- payment;
- booking;
- posting publicly;
- sending messages;
- changing account settings;
- deleting data;
- merging if user controls merge;
- destructive migrations;
- real external API sync;
- production secrets changes.

Docs-only PR creation can proceed if task says to create PR.

---

## No background promises

Агент не должен обещать background work вне инструмента.

Правильно:

```text
I will execute this task now.
```

только если он реально делает задачу в текущей сессии.

Неправильно:

```text
I will monitor this later.
```

если нет scheduled automation.

---

## Connector/tool limitations

Если GitHub connector or tool returns Not Found, это может быть:

- cache issue;
- access issue;
- branch deleted;
- PR merged;
- connector limitation;
- wrong PR number.

Не делать вывод, что PR failed, без проверки альтернативным способом.

GitHub facts должны быть проверяемыми.

---

## Merge status terms

Термины:

```text
open
closed
merged
mergeable
draft
base
head
head_sha
merge_commit_sha
```

Важно:

```text
closed != merged
open != failed
PR created != task complete
merged == task integrated
```

---

## Commit hash

Commit hash в final response должен быть head commit PR.

Merge commit отличается.

После merge полезно фиксировать оба:

```text
head commit
merge commit
```

---

## PR target

PR target должен быть `main`, если не сказано иначе.

Если target другой, это нужно объяснить.

---

## Conflict handling

Если PR имеет conflicts:

- stop;
- do not force merge;
- fetch latest main;
- rebase/merge carefully if allowed;
- or create fresh branch from main and reapply changes;
- report conflict.

Для docs-only source tasks проще создать fresh branch from current main.

---

## Random branch suffix problem

Если branch имеет random suffix из internal process, проверить.

Пример:

```text
feature/docs-002-a-00-add-project-master-context-15386594244866785985
```

Это может быть duplicate/broken branch.

Не использовать его для новых задач.

---

## Use CLI workaround if needed

Если internal PR process создаёт duplicates, использовать проверенный CLI approach:

```text
git
gh pr create
```

или другой стабильный механизм, если он доступен.

Главное:

- branch from clean main;
- one PR;
- correct title;
- correct changed files.

---

## Do not reuse old PR

Нельзя использовать старый PR для новой задачи.

Если текущая задача `08`, нельзя обновлять PR `07`.

Каждая source document задача имеет свой PR.

---

## Do not reuse old branch

Нельзя переиспользовать old branch.

Плохой вариант:

```text
continue on feature/docs-002-b-07-add-treatment-plan-documents
```

для task 08.

Правильный:

```text
feature/docs-002-b-08-add-appointments-schedule
```

---

## Worktree cleanliness

Перед задачей агент должен проверить, что worktree clean or understand changes.

Если есть неожиданные changes:

- do not overwrite;
- report;
- clean/revert only if safe and allowed.

---

## File overwrite rule

Нельзя перезаписывать existing important docs unless task says.

Если файл уже существует:

- verify whether task is duplicate;
- stop if unexpected;
- ask or report.

Для source docs, если file already exists and task says create, проверить main status.

---

## Previous incident: RISKS.md overwrite

Проект уже сталкивался с перезаписью документа рисков.

Правило:

```text
do not overwrite broad project docs with narrow integration content
```

Если task updates shared docs, agent must preserve existing content and append/update carefully.

Shared docs high-risk:

```text
RISKS.md
PROJECT_ROUTES.md
SOURCES_INDEX.md
```

---

## PROJECT_ROUTES.md

`PROJECT_ROUTES.md` обновлять only if needed.

Для source docs task usually not needed unless task says.

Если update не требуется, не трогать.

Не использовать PROJECT_ROUTES.md как мусорную корзину для каждого отчёта.

---

## RISKS.md

RISKS.md — общий документ рисков проекта.

Если задача добавляет module-specific risk, не перезаписывать общий контекст.

Правильно:

- append section;
- preserve existing risks;
- clearly separate module risk.

Неправильно:

- replace whole file with amoCRM risks.

---

## Reports folder

Reports should accumulate.

Не удалять старые reports.

Reports являются audit trail AI workflow.

---

## Source docs immutability

После создания source docs не менять их случайно.

Изменения source docs должны быть отдельной docs task.

Нельзя редактировать 00-14 while creating 15 unless fixing broken Markdown with explicit note.

---

## Versioning source documents

Если source document needs change later:

- create new task;
- explain reason;
- update only that doc;
- report changes;
- maybe add changelog if needed.

Не править молча.

---

## How to move from docs to implementation

После source foundation, implementation tasks should reference docs.

Example:

```text
Relevant source documents:
- 03_MULTI_TENANT_ARCHITECTURE_RULES.md
- 04_DATA_ISOLATION_AND_SECURITY.md
- 11_BACKEND_AND_API_ARCHITECTURE.md
```

Agent must read relevant docs before implementation.

Не нужно читать все 19 docs for every tiny task, but relevant docs must be named.

---

## Context window problem

AI has limited context.

Therefore:

- tasks must restate critical constraints;
- source docs exist in repo;
- reports summarize changes;
- small PRs preferred;
- no reliance on memory only.

Если agent says “I remember”, всё равно task should provide source references.

Memory is cheap. Bugs are expensive.

---

## Task dependency

Some tasks depend on previous tasks.

Example:

```text
AMO-004 depends on AMO-003 backend skeleton
DOCS-002-B-08 depends on DOCS-001 sources structure
```

Task should state dependency.

If dependency missing, stop.

---

## Implementation readiness

Before implementation task, check:

- source docs exist;
- relevant architecture rules exist;
- current code state;
- target files;
- tests/checks;
- risk boundaries;
- acceptance criteria.

No implementation from vague idea.

---

## Architecture before code

For high-risk modules:

- multi-tenant;
- security;
- backend;
- billing;
- amoCRM;
- storage;
- documents;
- payments;

architecture rules come before production implementation.

Код без архитектуры — это когда проект сначала бежит, потом ищет карту, потом удивляется обрыву.

---

## Prototype vs production language

Reports must distinguish:

```text
prototype
skeleton
placeholder
dev-only
production-ready
```

Do not call skeleton production.

Do not call placeholder integration.

Do not call localStorage SaaS storage.

---

## Safe words for incomplete features

Use:

```text
placeholder
disabled
future
not implemented
dev-only
skeleton
prototype
```

Avoid:

```text
completed
fully implemented
production-ready
secure
final
```

unless true.

---

## AI task report honesty

Report should never exaggerate.

Bad:

```text
Real amoCRM integration completed.
```

when only OAuth skeleton exists.

Good:

```text
OAuth connection skeleton added.
Real sync, production token storage, webhooks, retries and field mapping UI are not implemented.
```

---

## Reviewing generated docs

Docs should be checked for:

- correct title;
- correct scope;
- no accidental old task;
- no missing code fence;
- no source markers;
- no invented content if exact task;
- no contradictory rules;
- no secrets;
- no real patient data.

---

## Reviewing generated code

Code should be checked for:

- scope;
- compile/build;
- tests;
- tenant impact;
- permission impact;
- storage impact;
- security;
- data boundaries;
- UI states;
- error handling;
- reports.

Code review must not be “build passed, ship it”.

Build passing means code is syntactically acceptable to a machine. Машина не знает, что ты хотел построить стоматологическую CRM, а не автоматическую катапульту данных.

---

## Review checklist location

Detailed task template and PR review checklist belongs in:

```text
17_TASK_TEMPLATE_AND_PR_REVIEW_CHECKLIST.md
```

This document defines workflow principles.

Document 17 defines reusable templates and checklist.

---

## Roadmap location

Roadmap and backlog belong in:

```text
16_DEVELOPMENT_ROADMAP_AND_TASK_BACKLOG.md
```

This document does not define full roadmap.

It defines how AI agents should move through tasks.

---

## Testing location

Testing and QA strategy belongs in:

```text
18_TESTING_AND_QUALITY_ASSURANCE_STRATEGY.md
```

This document mentions checks, but detailed QA belongs in 18.

---

## Communication style for agent instructions

Instructions to Jules/Codex should be direct.

Good:

```text
Create only these files.
Do not modify src/.
If content is missing, stop and report.
```

Bad:

```text
Maybe improve docs if you think it helps.
```

Never invite the agent to “improve broadly” unless that is the task.

---

## Prompt format for Jules

Prompt should include:

- Task ID;
- goal;
- branch;
- exact files;
- allowed;
- forbidden;
- acceptance;
- checks;
- report requirements;
- final response format;
- exact content if docs.

This reduces improvisation.

AIs improvise confidently. That is the problem, not a feature.

---

## Prompt format for Codex

Codex prompts should be implementation-focused.

Include:

- current problem;
- files involved;
- expected behavior;
- constraints;
- no scope creep;
- checks;
- report format;
- screenshots/logs if relevant.

Do not ask Codex “fix everything”.

Codex may try.

That is how “everything” становится хуже.

---

## Когда использовать Jules

Использовать Jules для:

- repo file changes;
- docs tasks;
- isolated implementation tasks;
- PR creation;
- running checks;
- structured reports.

Хорош для контролируемых задач.

---

## Когда использовать Codex

Использовать Codex для:

- code analysis;
- debugging;
- refactor planning;
- implementation review;
- build errors;
- test failures;
- verifying architecture against code.

Codex должен соблюдать scope.

---

## Когда использовать ChatGPT

Использовать ChatGPT для:

- task design;
- architecture explanation;
- document drafting;
- PR review support;
- risk analysis;
- next-step planning;
- user-facing decisions.

ChatGPT не должен заявлять состояние repo без проверки GitHub, если это важно.

---

## Проверка текущего состояния

Для всего, что касается GitHub:

- PR status;
- merge status;
- branch exists;
- file exists;
- latest main content;
- changed files;

проверять реальный инструмент или repo.

Не полагаться на память.

---

## Source documents и память проекта

Source docs существуют, чтобы уменьшить зависимость от памяти чата.

Перед критической реализацией агент должен ссылаться на релевантные документы.

Примеры:

Billing task:

```text
12_BILLING_AND_ACCESS_CONTROL.md
11_BACKEND_AND_API_ARCHITECTURE.md
03_MULTI_TENANT_ARCHITECTURE_RULES.md
```

amoCRM task:

```text
09_AMOCRM_INTEGRATION_RULES.md
10_AMOCRM_TECHNICAL_ARCHITECTURE.md
04_DATA_ISOLATION_AND_SECURITY.md
```

UI task:

```text
14_UI_UX_RULES.md
02_ROLES_AND_PERMISSIONS.md
04_DATA_ISOLATION_AND_SECURITY.md
```

---

## Обработка скриншотов и логов

Если пользователь предоставляет скриншоты/логи/отчёты:

- изучить их;
- определить Task ID;
- выявить ошибки;
- не предполагать, что скриншот всегда равен правде репозитория;
- проверять через GitHub, когда нужно;
- переводить путаницу пользователя в чёткий следующий шаг.

Скриншоты помогают, но для PR фактов выигрывает состояние GitHub.

---

## Языковые правила

Общение с пользователем в этом проекте ведётся в основном на русском.

Задачи могут содержать английские идентификаторы и технические термины.

Итоговые объяснения для пользователя должны быть на русском, если он не просит иное.

Видимые в коде/файлах идентификаторы остаются как есть.

---

## Тон в артефактах проекта

Артефакты проекта должны быть профессиональными.

Лёгкая ирония допустима в source docs, если это проясняет риски человеческого фактора, но implementation reports и PR descriptions должны быть фактическими.

Не добавлять излишние шутки в комментарии к коду или формальные отчёты.

Продукту нужен характер, а не клоун, живущий в каждом Markdown-файле.

---

## Тон формальных отчётов

Отчёты должны быть нейтральными.

Пример:

```text
This was a documentation-only change.
No application code was modified.
```

Не:

```text
Humanity survived another docs task.
```

Даже если это правда.

---

## Тон при планировании с пользователем

Помогая пользователю, будьте прямолинейны.

Пользователю нужны практические следующие шаги.

Избегайте долгих философских отступлений, если не обсуждаете архитектуру.

---

## Владение AI-генерируемым контентом

Все сгенерированные документы рассматриваются как исходный код проекта.

Перед слиянием ответственность несёт пользователь.

Если агент создаёт контент, он всё равно должен соответствовать замыслу проекта.

AI output — это черновик до тех пор, пока не проверен и не слит.

---

## Предотвращение выдуманного завершения

Агент не должен заявлять о завершении задачи, пока:

- файлы не изменены;
- commit не создан;
- PR не создан, если требуется;
- checks не запущены или их отсутствие не зафиксировано;
- final response не включает обязательные детали.

Если агент только запланировал, он должен сказать "план".

Plan ≠ execution.

Снова эта тема: люди и ИИ одинаково любят считать “я собираюсь сделать” за “сделано”. Нет.

---

## Plan vs execution

Если агент говорит:

```text
I will proceed
```

задача не выполнена.

Если агент говорит:

```text
PR URL: ...
Commit hash: ...
```

тогда нужно проверить.

Пока PR не существует, задача не доставлена.

Пока не смержено, код не интегрирован в main.

---

## Обработка “I am ready to proceed”

Когда Jules просит подтверждения:

- если предположения верны, дайте краткое подтверждение;
- повторите критические ограничения;
- упомяните ожидаемые файлы;
- запретите запрещённые изменения;
- скажите выполнить.

Не добавляйте новый неопределённый scope.

---

## Обработка циклов бесконечного уточнения

Если агент продолжает задавать очевидные вопросы, на которые уже ответили:

- ответьте один раз;
- скажите, что предположения верны;
- дайте команду на выполнение;
- не позволяйте задаче превратиться в бесконечное планирование.

Планирование полезно, пока оно не становится декоративной беговой дорожкой.

---

## Обработка stale сессий

Если сессия Jules устарела:

- остановите;
- откройте новую сессию;
- вставьте полный актуальный payload;
- не полагайтесь на старый чат.

Используйте это, если агент постоянно ссылается на старую задачу.

---

## Обработка проблем с connector/cache

Если коннектор не может получить diff, но URL PR и метаданные GitHub показывают, что он смержен:

- отметьте проблему с кэшем/доступом/коннектором;
- не делайте вывод, что PR провалился;
- используйте доступные метаданные GitHub;
- повторите попытку позже, если необходимо.

---

## Порядок финальной заливки source docs

Документы source foundation должны быть завершены по порядку:

```text
00 → 01 → 02 → 03 → 04 → 05 → 06 → 07 → 08 → 09 → 10 → 11 → 12 → 13 → 14 → 15 → 16 → 17 → 18
```

Порядок помогает сохранить контекст.

Не пропускайте, если пользователь не указал явно.

---

## После source foundation

После завершения 00-18 следующие шаги:

```text
1. Убедиться, что в SOURCES_INDEX всё Provided
2. Создать summary report по source foundation
3. Создать задачи development roadmap
4. Начать реализацию с маленьких безопасных задач
5. Использовать документы как обязательный контекст для Jules/Codex
```

Не спешите в код до формирования roadmap.

---

## AI workflow риски

Основные риски:

- выдуманные требования (hallucination);
- duplicate PRs;
- старый контекст;
- stale ветка;
- неверный номер документа;
- отсутствие payload;
- legacy docs скопированы как exact source;
- изменены запрещённые файлы;
- перезаписаны source docs;
- checks заявлены, но не запущены;
- PR создан, но не смержен;
- раскрыты secrets;
- включены реальные patient data;
- широкий “improvement” PR вместо чёткой задачи;
- нет отчёта;
- отчёт скрывает limitations.

---

## Снижение рисков

Смягчение:

- одна задача за раз;
- точный payload;
- явные allowed/forbidden;
- чистая ветка от main;
- ожидаемые changed files;
- обязательный отчёт;
- GitHub verification;
- проверка статуса merge;
- маленькие PRs;
- остановка при отсутствии данных;
- правило no invention;
- safety notes;
- review checklist.

---

## Что нельзя делать

Нельзя:

- придумывать missing source content;
- создавать source doc без exact content;
- включать payload markers в финальный файл;
- менять src/ в docs-only задаче;
- менять backend/src/ в docs-only задаче;
- менять package files без задачи;
- копировать legacy docs как source без разрешения;
- перезаписывать shared docs вслепую;
- создавать duplicate PR и игнорировать его;
- продолжать из неверного старого контекста;
- использовать old branch для новой задачи;
- заявлять PR merged без проверки;
- считать PR created за task complete;
- считать build passed за достаточный review;
- добавлять secrets;
- добавлять real patient data;
- делать real external API call без scope/permission;
- делать destructive migration без явного одобрения;
- скрывать limitations в отчёте;
- называть skeleton production-ready.

---

## Правила для ИИ-задач

Если задача выполняется через Jules/Codex/ChatGPT workflow, агент должен проверить:

- Task ID корректен;
- source docs упомянуты, если релевантны;
- exact scope понят;
- allowed/forbidden соблюдены;
- ветка от latest main;
- ожидаемые changed files перечислены;
- запрещённые файлы не изменены;
- checks запущены или ограничения заявлены;
- отчёт создан;
- final response включает PR URL, branch, commit hash, target, changed files, checks, report path;
- статус PR проверен после создания, если возможно;
- статус merge проверен после слияния;
- нет старого контекста.

---

## Acceptance для AI workflow задач

AI workflow задача считается корректной, если:

- задача выполнена в правильном контексте;
- имя ветки соответствует задаче;
- заголовок PR соответствует задаче;
- changed files соответствуют ожидаемому scope;
- отчёт существует;
- checks указаны честно;
- secrets или реальные данные пациентов не раскрыты;
- запрещённые файлы не изменены;
- состояние GitHub подтверждает PR;
- статус слияния известен;
- следующий шаг понятен.

---

## Итог

AI workflow для DentalFlow должен быть строгим, скучным и проверяемым.

Главная цепочка:

```text
User intent
→ ChatGPT task design
→ Jules/Codex execution
→ GitHub PR
→ Review
→ Merge
→ Verified next step
```

Главная защитная мысль:

```text
если точного содержания нет — остановись
```

Главная техническая мысль:

```text
small scoped PRs beat giant magical changes
```

Главная практическая мысль:

```text
GitHub is source of truth for repository state
```

ИИ может ускорить разработку DentalFlow.

Но только если каждый агент работает в рамках задачи, не выдумывает недостающие правила, не плодит PR из прошлого и не считает “я почти сделал” за “готово”.

Связка User + ChatGPT + Jules + Codex может быть сильной.

Но её сила не в том, что все умные.

Её сила в том, что процесс не даёт умным участникам слишком красиво ошибаться.
