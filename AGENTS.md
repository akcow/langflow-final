# Repository Guidelines

## Project Structure & Module Organization
LangFlow is organized into uv workspaces: `src/backend` (FastAPI service under `base/langflow` plus CLI helpers), `src/frontend` (Vite/React UI in `src/` with assets in `public/`), and `src/lfx` (agent toolkit in `src/lfx/src`). Tests sit in `src/backend/tests/{unit,integration}` and `src/frontend/tests`. Documentation lives in `docs/`; operational scripts and containers are under `scripts/`, `deploy/`, and `docker*/`.

## Build, Test, and Development Commands
Run `make init` once to install backend deps via uv, frontend npm packages, and pre-commit hooks. `make run_cli` boots LangFlow with the cached frontend bundle, while `make run_clic` forces a clean rebuild before `uv run langflow run`. Backend-only iterations can use `uv run langflow run --frontend-path src/backend/base/langflow/frontend`. Frontend contributors rely on `npm run dev` inside `src/frontend`; `make build` performs the release bundle.

## Coding Style & Naming Conventions
Python code targets 3.10+, four-space indents, and Ruff’s 120-character limit. Use `make format` (runs `ruff check --fix` + `ruff format`) before committing, and `make lint` for mypy. Modules/functions stay snake_case, classes PascalCase, env vars ALL_CAPS. TypeScript/React follows Biome formatting via `npm run format` or `npm run lint`; component files prefer `PascalCase.tsx` and directories kebab-case.

## Testing Guidelines
Backend tests use pytest through uv. `make unit_tests` parallelizes async suites and skips API-key-only marks; `make integration_tests` exercises live adapters; `make tests` adds coverage via `uv run coverage run`. Target folders like `src/backend/tests/unit/test_flow_api.py` and name tests `test_<feature>.py`. Frontend checks run with `npm run test`, `npm run test:coverage`, or `npx playwright test` for E2E. Track progress against `codecov.yml` thresholds (55% backend, 10% frontend, 60% lfx, ≥40% patch) and stash artifacts in `test-results/`.

## Commit & Pull Request Guidelines
Commits follow Conventional Commits as enforced by `.github/semantic.yml` (`feat: 集成豆包AI组件...`, `docs: 添加开发进度报告文档`). Keep the type + scope concise and reference issues like `feat(auth): add OTP (#123)`. Every pull request should summarize intent, list impacted packages (`backend`, `frontend`, `lfx`), link design docs under `docs/` when updated, and attach screenshots/GIFs for UI changes. Verify `make tests` and `npm run test` locally, paste any noteworthy `test-results/` output, and call out migration or config steps.

