# Phase 44: Catalog Enrichment - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-17
**Phase:** 44-Catalog Enrichment
**Areas discussed:** Factual-field & photo gap, Downgrade guard, Script surface, Run & verify ownership

---

## Factual-Field & Photo Gap

### How to fill NULL factual columns

| Option | Description | Selected |
|--------|-------------|----------|
| LLM proposes, you approve | LLM proposes factual values into a reviewable batch; user approves before write. Satisfies "human-reviewed, not auto-written." | ✓ |
| Gap report, you hand-fill | Run only reports missing fields; user fills by hand. Strictest reading; most manual. | |
| Verify-only, gaps likely few | Run a verification query first; only build fill tooling if real gaps surface. | |

**User's choice:** LLM proposes, you approve
**Notes:** First question was reframed — the user challenged the premise that "the LLM can't write factual columns." Clarified that the URL extractor *does* write factual fields for personal watches; the ENRH-05 line is a governance policy for the shared authoritative catalog ("never *auto*-written"), not a capability limit. An approval gate satisfies it.

### Approval gate mechanism

| Option | Description | Selected |
|--------|-------------|----------|
| Editable review file | propose step → structured file → user edits/confirms → apply step writes confirmed rows. | ✓ |
| Interactive terminal prompts | One script prompts y/n/edit inline; not resumable mid-review. | |
| Draft DB columns | Proposals land in staging columns; requires a schema migration. | |

**User's choice:** Editable review file

### LLM sourcing strategy

| Option | Description | Selected |
|--------|-------------|----------|
| Web-search + citations | Anthropic web_search tool; each proposal carries a source URL. | ✓ |
| Parametric, no tools | Training knowledge only; no citations. | |
| Web-search, factual only | Web search for factual fill; enricher stays parametric. | |

**User's choice:** Web-search + citations
**Notes:** Second reframe — the user asked how the LLM would actually source values. Explained the enricher has no web access today and the realistic options. Also clarified the run is gap-driven (only NULL fields get proposals), not every-row.

### Taste enricher scope

| Option | Description | Selected |
|--------|-------------|----------|
| Keep enricher parametric | Leave enricher.ts as Phase 19.1 built it; web search only in factual-fill. | |
| Web search everywhere | Add web search to the taste enricher too. | ✓ |

**User's choice:** Web search everywhere

### Cover photo handling

| Option | Description | Selected |
|--------|-------------|----------|
| Cited source page, you grab | LLM proposes a source-page URL; user grabs the actual image. | ✓ |
| Best-effort + placeholder | Only trivially-recoverable photos; rest left blank with placeholder. | |
| LLM proposes image URLs | LLM proposes direct image URLs; high hallucination rejection rate. | |

**User's choice:** Cited source page, you grab

---

## Downgrade Guard (ENRH-03)

### Guard location

| Option | Description | Selected |
|--------|-------------|----------|
| In updateCatalogTaste | Data-layer enforcement; every force path protected. | ✓ |
| In reenrich-taste.ts | Guard in the only current force-caller; data layer stays dumb. | |

**User's choice:** In updateCatalogTaste

### Block rule

| Option | Description | Selected |
|--------|-------------|----------|
| Block text-over-vision only | Reject when existing row is vision-derived + high-confidence AND incoming is text-mode. | ✓ |
| Block any overwrite of vision rows | Reject any force write over a vision-derived high-confidence row. | |
| Block on lower confidence | Reject when incoming confidence < existing; ignores photo signal. | |

**User's choice:** Block text-over-vision only

### Confidence threshold

| Option | Description | Selected |
|--------|-------------|----------|
| 0.7 | Protects solidly-confident vision rows; above the <0.5 ambiguous band. | ✓ |
| 0.8 | Only strongly-confident rows protected. | |
| 0.6 | Protects moderately-confident rows too. | |

**User's choice:** 0.7

---

## Script Surface

### Script topology

| Option | Description | Selected |
|--------|-------------|----------|
| Separate by write semantics | 4 scripts: hardened backfill-taste, guarded reenrich-taste, new factual-propose, new factual-apply. | ✓ |
| Unified enrichment CLI | One script with subcommands. | |
| Combined per-row run | One run does taste + factual proposals per row. | |

**User's choice:** Separate by write semantics

### Factual-propose resumability

| Option | Description | Selected |
|--------|-------------|----------|
| Skip rows already proposed | Review file is the resume ledger; skip catalog_ids already present. | ✓ |
| Regenerate from scratch | Re-running rebuilds the whole file, re-paying web-search cost. | |
| Separate checkpoint file | A run-log tracks processed catalog_ids independently. | |

**User's choice:** Skip rows already proposed

---

## Run & Verify Ownership

### Run owner

| Option | Description | Selected |
|--------|-------------|----------|
| You run it, Claude builds + dry-runs | Claude delivers tooling; user runs live prod enrichment. | |
| Claude runs it against prod | Claude executes the live prod run directly. | |
| Run local, then sync | Enrich a local copy, then push results to prod. | ✓ |

**User's choice:** Run local, then sync
**Notes:** Sound rationale — prod never receives a live LLM write, only reviewed frozen values.

### Sync mechanism

| Option | Description | Selected |
|--------|-------------|----------|
| Generated SQL data migration | Apply steps emit a timestamped migration; pushed via supabase db push --linked. | ✓ |
| Table dump / restore | pg_dump + restore; overwrites whole table, no audit. | |
| Dual-connection sync script | Script connects to both DBs; holds prod creds, no committed artifact. | |

**User's choice:** Generated SQL data migration

### Verification delivery

| Option | Description | Selected |
|--------|-------------|----------|
| Committed verification script | npm script asserts full population + 8-archetype coverage; exits non-zero on gaps. | ✓ |
| Manual SQL queries | Documented queries run by hand once. | |

**User's choice:** Committed verification script

---

## Claude's Discretion

- Retry/backoff parameters and whether ENRH-01/02 resilience is extracted into a shared helper.
- Review-file format (JSON vs CSV vs other).
- Generated migration filename/timestamp convention (must follow Supabase naming).
- Run playbook structure.

## Deferred Ideas

None — discussion stayed within phase scope. Catalog breadth expansion was noted as out of scope (v5.2 / SEED-009).
