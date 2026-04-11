---
focus: quality
generated: 2026-04-11
---
# Testing

## Summary
No tests exist. There is no test framework configured, no test files, and no CI pipeline. The codebase is MVP-stage with zero automated coverage.

## Test Framework

- **None configured** — no Jest, Vitest, Playwright, Cypress, or any other test runner found
- No `test` script in `package.json`
- No test config files (`jest.config.*`, `vitest.config.*`, `playwright.config.*`)

## Test Files

- **None found** — no `*.test.ts`, `*.spec.ts`, `__tests__/` directories, or similar

## Coverage

- **0%** — no automated test coverage of any kind

## CI/CD

- No `.github/workflows/`, no CI config of any kind
- No pre-commit hooks or lint-staged configuration

## What Warrants Testing

The following are the highest-value test targets given the app's architecture:

**Unit tests (pure functions):**
- `src/lib/similarity.ts` — `analyzeSimilarity`, `calculatePairSimilarity`, `arrayOverlap`, `caseSizeSimilarity` — all pure, deterministic, and have clear input/output contracts
- `src/lib/extractors/structured.ts` and `html.ts` — parse HTML and return structured data; testable with fixture HTML strings
- `src/store/watchStore.ts` — Zustand store CRUD and filter logic

**Integration tests:**
- `POST /api/extract-watch` — the full extraction pipeline including URL fetch, merge logic, and confidence scoring

**E2E:**
- Watch import flow: paste URL → extract → form review → save → appears in grid
- Filter flow: apply status/style filters → grid updates correctly
