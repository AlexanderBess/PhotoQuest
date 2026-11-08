# PhotoQuest

PhotoQuest is a photography discovery and knowledge platform for photographers of every experience level. It helps people find places worth shooting, see what others photographed there, understand how those photographs were made, and share their own work with technical context. An AI Photo Coach and learning challenges help those who want to improve.

**Working tagline:** See where and how great photos are made.

## Product loops

- **Discover:** map and location catalog → location page → photos taken there → Shooting Details → save.
- **Contribute:** upload → review extracted Shooting Details → choose a location mode (exact, approximate, private) → publish.
- **Improve (MVP extensions):** ask the AI Coach about your own photo; learning paths and challenges.

## MVP focus

Direction: narrowed discovery-first (ADR-018). The pilot runs in Novosibirsk with a Russian-language UI; the product model is not tied to one city or language.

**Pilot essentials**
- Accounts, photographer profiles with handles and per-field visibility, equipment
- Photo publishing, public feed, photo detail pages, bookmarks
- Shooting Details from EXIF, reviewed and correctable before publishing
- Explore map and curated photography locations
- Photo–location links with exact, approximate or private mode
- Basic search and filtering; saved locations
- Reporting and basic admin moderation
- Privacy, security, backups and operational monitoring

**MVP extensions** (may follow during the pilot)
- Standalone AI Photo Coach on your own photos
- Learning paths, practical challenges and challenge feedback

Public photo, location and profile pages are viewable without registration in production; personal actions require an account. Until the pilot gate, the staging environment is open only to invited testers.

Future modules are anticipated architecturally but not part of the MVP: rich Community (comments, follows, groups, messaging), advanced Explore (user suggestions, imports, routes, forecasts), Academy, Gear Explorer, and social-platform API integrations.

## Repository layout

```text
photoquest/
├── CLAUDE.md
├── README.md
├── TASKS.md
├── docs/
│   ├── product/
│   ├── architecture/
│   │   └── decisions/
│   ├── analysis/
│   ├── frontend/
│   ├── ai/
│   ├── media/
│   └── development/
├── backend/
└── frontend/
```

## Development status

The project skeleton (PQ-002) exists: a Go API and worker with a root-level `/healthz`, and a Russian, i18n-ready Vue shell. The local development environment (PQ-003) runs PostgreSQL 18 and a provisional local S3-compatible service in Docker Compose. Quality gates (PQ-004) run in GitHub Actions on Linux and Windows for every pull request. There are no product features yet. Analysis and documentation are approved (decision record: `docs/analysis/decision-review-2026-11-03.md`, Revision 4). Work proceeds in vertical slices S0–S5; the next task is **PQ-005** in `TASKS.md`. Open decisions are tracked in `docs/analysis/risks-and-open-questions.md`.

## Local startup

Install the tools listed in `docs/development/setup.md` (Go, Node.js, pnpm, Task, golangci-lint, Docker Desktop).

One-time setup, from the repository root:

```powershell
git config core.autocrlf false
Copy-Item backend/.env.example backend/.env
cd frontend; pnpm install --frozen-lockfile; cd ..
```

Start the local dependencies (PostgreSQL on `127.0.0.1:5432`, local S3 on `127.0.0.1:8333`):

```powershell
task deps:up      # returns when both services are healthy
```

Then run each process in its own terminal, from the repository root:

```powershell
task dev:api      # API on http://127.0.0.1:8080
task dev:worker   # worker process
task dev:web      # Vite dev server on http://localhost:5173, proxies /api and /healthz to the API
```

Open http://localhost:5173/ for the shell; `http://127.0.0.1:8080/healthz` returns `{"status":"ok"}`. Press Ctrl+C in a terminal to stop its process.

Stop the dependencies with `task deps:down` (data is kept); `task deps:status`, `task deps:logs` and `task deps:reset` (deletes all local data) are also available.

Other root commands: `task test`, `task lint`, `task fmt`, `task build`. Before opening a pull request, run `task check`: it runs every quality gate that CI runs (see `docs/development/setup.md`, "Quality gates"). Changes reach `main` only through pull requests with a green `ci` check.

## Principles

1. Ship a narrow, useful product before expanding its surface area.
2. Discovery first; the AI Coach and learning support it.
3. Use a modular monolith, not microservices.
4. Keep module boundaries explicit and communicate through public interfaces.
5. Protect original images and location data; the author's chosen location mode limits everything others can see.
6. Treat metadata and AI output as fallible: show what is known, mark what is missing, let people correct it.
7. Respect photographer attribution.
8. Prefer boring, maintainable technology.
9. Every implementation task must have observable acceptance criteria.
