# DentalFlow — MacDent Reference & Lawful Deep Recon Rule

Status: ACTIVE PROJECT RULE
Rule ID: MACDENT-REFERENCE-RULE-002
Date: 2026-08-19

## 1. Purpose

MacDent is an allowed and expected functional, process, domain and engineering reference for DentalFlow.

The project must study MacDent deeply enough to understand how a mature dental system solves real workflows. The goal is not to reproduce MacDent source code or branding. The goal is to extract knowledge, semantics, invariants, state transitions, edge cases and integration contracts, then build an independent DentalFlow implementation.

## 2. Reading code is explicitly allowed

The project MAY read and analyze code and technical material that is lawfully available to the user's own computer, browser session or authorized account.

This includes, when already accessible without bypassing access controls:

- JavaScript already delivered to and parsed by the browser;
- client-side bundles, modules and static assets already loaded by an authorized session;
- source-map metadata or source files when the application itself exposes them to that authorized client;
- HTML/DOM structure, forms, routes and UI action structure;
- network endpoint names, request methods and client-side API contracts observable from the authorized client;
- service workers, client routing and storage schema/key names;
- installed application files present on the user's machine;
- executable/DLL metadata, signatures, versions, hashes and bounded strings;
- local application configuration that is already present on the user's machine, subject to secret redaction;
- local database schema, table/column/index/foreign-key structure without default extraction of patient row contents;
- documented or observable error states and edge-case handling;
- algorithms and implementation approaches insofar as they are studied to understand behavior and design choices.

A future agent MUST NOT interpret this project rule as "MacDent code must not be read". That interpretation is incorrect.

The correct distinction is:

```text
READ / STUDY / UNDERSTAND = ALLOWED when access is lawful
MECHANICAL COPY / LINE-BY-LINE TRANSLATION = NOT THE PROJECT METHOD
BYPASS / HACK / SECRET EXTRACTION / UNAUTHORIZED SERVER ACCESS = FORBIDDEN
```

## 3. Lawful-access boundary

Deep reconnaissance may use only information available without defeating access controls or exploiting systems.

Allowed examples:

- authenticated pages opened through the clinic's legitimate MacDent account;
- code already downloaded by that page to the browser;
- files already installed on the user's computer;
- metadata exposed by the operating system for running processes;
- localhost Chrome DevTools Protocol when the user's own browser was intentionally launched with remote debugging;
- read-only inspection of local schemas and application directories;
- normal application navigation and normal read actions inside the authorized account.

Forbidden by default:

- exploiting vulnerabilities to obtain otherwise inaccessible code or data;
- bypassing authentication, authorization, licensing or technical protection;
- attempting to obtain MacDent server-side source code that is not delivered to the authorized client;
- credential theft, password extraction, cookie/session-value extraction or token harvesting;
- memory injection, DLL injection, debugger manipulation intended to defeat protections, or patching the target process;
- reading unrelated users', clinics' or tenants' data;
- making any MacDent production mutation for reconnaissance or experimentation. ACTIVE-PROBE writes are postponed until our own DentalFlow/Hermes systems or a separately authorized test/sandbox environment.

## 4. Patient data and secrets

The reconnaissance goal is architecture and semantics, not patient-data collection.

Default behavior:

- prefer metadata, schemas, labels, code and structure over row contents;
- redact tokens, passwords, cookies, authorization headers and secret-like literals;
- strip URL query strings and fragments when they may contain identifiers;
- do not persist patient names, phone numbers, medical facts or other PHI/PII in recon artifacts unless a specific authorized test requires it;
- when a workflow can be understood without patient values, do not collect those values.

## 5. Mandatory semantic-distillation boundary

Information learned from MacDent does not flow directly into DentalFlow source code.

Required pipeline:

```text
MacDent UI / client code / observable behavior / API contract
                    ↓
              STUDY / RECON
                    ↓
        semantic facts and evidence
                    ↓
       independent semantic contract
                    ↓
  DentalFlow entities + invariants + roles
                    ↓
 DentalFlow architecture and source-of-truth rules
                    ↓
      independent DentalFlow implementation
                    ↓
             VERIFY / AUDIT
```

Recon artifacts should capture meaning in our own terminology rather than preserve large source-code passages.

## 6. What may be learned and reused

The following knowledge may be extracted and used as design input:

- business processes;
- workflows and state machines;
- domain concepts and entity relationships;
- validation rules as behavior;
- edge cases and failure modes;
- navigation structure and task sequencing;
- role responsibilities;
- data dependencies;
- API semantics and interoperability requirements;
- performance and usability lessons;
- successful and unsuccessful design decisions;
- algorithms and technical approaches as concepts to be independently implemented.

## 7. What must not be mechanically carried over

Do not use MacDent as a mechanical transformation template for:

- line-by-line code rewriting;
- function-by-function syntax translation whose internal expression remains substantially the same;
- copying distinctive text blocks;
- copying proprietary visual assets;
- copying branding or trade dress;
- pixel-for-pixel UI reconstruction;
- copying comments, variable names or implementation-specific organization merely because they exist in MacDent.

Similarity of required dental functionality is acceptable as a product requirement. The DentalFlow expression of that functionality must be independently designed.

## 8. Binary/decompilation yellow zone

Ordinary reconnaissance should prefer behavior, client-side code already delivered to the browser, documented interfaces, metadata and installed files.

Decompilation or deeper binary reconstruction is not categorically forbidden, but it is NOT a default RECON action. It requires a separately scoped task with an explicit interoperability/compatibility purpose, a documented necessity, and a legal/safety gate before use.

Reading PE metadata, signatures, hashes, module lists, printable strings and local schema structure is read-only reconnaissance and does not by itself trigger that deeper gate.

Raw process-memory extraction (`ReadProcessMemory`, memory slices/dumps or whole-process scanning) is not exposed as a shared MacDent reconnaissance capability. If later needed for our own DentalFlow/Hermes processes, it must be introduced as a separate project-scoped diagnostic tool with ownership checks and bounded reads.

## 9. MacDent is evidence, not source of truth for DentalFlow architecture

MacDent may show what works in a real clinic, but DentalFlow remains a different product architecture.

DentalFlow requirements remain authoritative for:

- multi-tenancy;
- tenant isolation;
- RLS/security;
- SaaS operation;
- source-of-truth boundaries;
- medical-domain separation;
- amoCRM integration boundaries;
- auditability;
- modern API/repository design;
- AI and automation safety.

If MacDent combines concepts that DentalFlow intentionally separates, DentalFlow keeps its own domain boundary.

## 10. Implementation workflow

For MacDent-derived work use:

```text
HERMES SKILL FIRST
→ STUDY / RECON
→ ANALYZE
→ DESIGN
→ IMPLEMENT
→ VERIFY
→ AUDIT / QA
→ FREEZE / MERGE
```

MacDent production STUDY/RECON is passive read-only. Recon notes, hashes, screenshots and semantic artifacts are stored only in our Hermes/DentalFlow workspace. ACTIVE-PROBE writes are not part of ordinary MacDent production reconnaissance and are postponed until our own DentalFlow/Hermes systems or a separately authorized test/sandbox environment.

Every implementation must be explainable without requiring MacDent source code to be present. The accepted artifact is the DentalFlow semantic contract and our implementation, not a transformed copy of MacDent code.

## 11. Conflict rule for future sessions

If an assistant or agent later states any blanket rule such as:

- "we are not allowed to read MacDent code";
- "client JavaScript cannot be inspected";
- "we may only look at screenshots";

that statement conflicts with this project rule unless there is a concrete access, privacy, contractual or legal reason for the specific material in question.

The agent must identify the specific blocked access method or specific protected use. It must not invent a blanket prohibition on reading lawfully accessible code.
