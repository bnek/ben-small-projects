---
name: project-discovery
description: >-
  Supervisor planning tool for breaking project documentation work into well-scoped worker tasks.
  Guides the supervisor in creating self-contained task files in the queue folder for each discovery area.
  USE FOR: project onboarding, codebase documentation, discovering project patterns, documenting architecture for agents.
  DO NOT USE FOR: generating API docs from code comments, creating user-facing documentation.
  LOADED BY: supervisor only. Workers receive their instructions via task files — they do NOT load this skill.
---

# Project Discovery — Supervisor Task Planning Guide

This skill is loaded by the **supervisor** when it encounters a task requesting project documentation, codebase onboarding, or discovery. It guides you to **create task files** in `tasks/queue/` — one per discovery area — so each is picked up and executed independently through the normal task processing flow.

**You do NOT invoke workers directly.** You create task files and return.

---

## When to Use This Skill

Load this skill when the task involves any of:
- Documenting an existing codebase for agent context
- Onboarding to a new project
- Discovering project patterns, conventions, or architecture
- Creating a "how to add a feature" reference

---

## Supervisor Workflow

1. **Read the task** requesting documentation. Identify the `{project_path}` to document.
2. **Determine scope** — which discovery areas are needed:
   - Full documentation → all 6 tasks
   - Architecture overview only → tasks 1–2
   - "How to add a feature" → tasks 1–3
   - Specific area → pick the relevant task(s)
3. **Determine task numbering** — list existing `.md` files in `tasks/queue/`, `tasks/in-progress/`, and `tasks/done/` to find the highest existing task number. Start your numbering from the next available number.
4. **Create task files** — for each selected discovery area, create a `.md` file in `tasks/queue/` using the templates below. Replace all `{placeholders}` with project-specific values.
5. **Return to the orchestrator** — do NOT invoke workers. The task files will be processed through the normal flow.

### Task File Naming

Use the pattern: `{NNN}-discover-{area}.md`

Example (if highest existing task is 004):
- `005-discover-overview.md`
- `006-discover-architecture.md`
- `007-discover-vertical-slice.md`
- `008-discover-cross-cutting.md`
- `009-discover-testing.md`
- `010-discover-conventions.md`

### Task Ordering

Tasks should be processed in order because later tasks reference earlier findings:
1. **Project Overview & Tech Stack** — foundational, no dependencies
2. **Architecture & Patterns** — builds on tech stack knowledge
3. **Vertical Slice** — requires architecture understanding
4. **Cross-Cutting Concerns** — benefits from architecture + vertical slice context
5. **Testing Patterns** — standalone but benefits from knowing conventions
6. **Conventions & Standards** — standalone

### Output Files

Each task produces its own file in `docs/`:

| Task | Output File |
|------|-------------|
| Project Overview & Tech Stack | `docs/overview.md` |
| Architecture & Patterns | `docs/architecture.md` |
| Vertical Slice | `docs/vertical-slice.md` |
| Cross-Cutting Concerns | `docs/cross-cutting.md` |
| Testing Patterns | `docs/testing.md` |
| Conventions & Standards | `docs/conventions.md` |

- Each task **creates** its own file — no appending
- Later tasks should **read** earlier output files for context (see dependency notes in each template)
- Reference templates: `references/output-template.md`

---

## Task File Templates

Copy each template below into a task file, replacing `{placeholders}` with actual values.

---

### Template 1: Project Overview & Tech Stack

````markdown
## Task: Document Project Overview & Tech Stack

Discover and document the foundational information about the project at `{project_path}`.

### What to Discover

| Item | How to find it |
|------|---------------|
| Languages & frameworks | Read `package.json`, `*.csproj`, `requirements.txt`, `go.mod`, `Cargo.toml`, `pom.xml`, or equivalent |
| Runtime versions | Check `.nvmrc`, `.python-version`, `.tool-versions`, `global.json`, Dockerfiles, CI config |
| Package manager | Look for `package-lock.json` (npm), `yarn.lock` (yarn), `pnpm-lock.yaml` (pnpm), `poetry.lock`, `Pipfile.lock` |
| Build tools | Read build scripts in `package.json`, `Makefile`, `Taskfile`, `Justfile`, CI/CD configs |
| Entry points | Search for `main`, `index`, `Program.cs`, `app.py`, `server.ts`, startup files |
| Directory structure | Run `Get-ChildItem -Recurse -Depth 2 -Directory` to map top-level layout |
| Build & run commands | Read `README.md`, `package.json` scripts, `Makefile` targets, `docker-compose.yml` |
| Test commands | Look for `test` scripts in package manager config, `Makefile` test targets |

### Output

**Create** the file `docs/overview.md` with the following content (fill in all sections):

```
# Project Overview: {project_name}

> Generated by project discovery. Last updated: {date}

## Description
<!-- One-paragraph summary of what this project does and who it serves. -->

## Tech Stack

| Category | Technology | Version |
|----------|-----------|---------|
| Language | | |
| Framework | | |
| Runtime | | |
| Package Manager | | |
| Database | | |
| ORM / Data Access | | |

## Directory Structure

project-root/
├── {dir}/          ← {purpose}
├── {dir}/          ← {purpose}
└── {dir}/          ← {purpose}

## Build, Run & Test Commands

| Action | Command |
|--------|---------|
| Install dependencies | |
| Build | |
| Run (development) | |
| Run (production) | |
| Run all tests | |
| Lint | |
| Format | |
```

### Guidelines
- Document the **pattern**, not every instance
- Focus on what a coding agent needs to build, run, and test the project
- If the project has a monorepo structure, note sub-projects and their relationships
- Commit your changes before returning
````

---

### Template 2: Architecture & Patterns

````markdown
## Task: Document Architecture & Patterns

Discover and document the architecture style and design patterns used in the project at `{project_path}`.

Read `docs/overview.md` first to understand the tech stack.

### What to Discover

| Pattern area | How to find it |
|-------------|---------------|
| Architecture style | Look at top-level directories — `src/services/`, `apps/`, `packages/` suggest monorepo; single `src/` with layers suggests monolith; separate deployable dirs suggest microservices |
| Backend patterns | Search for `Repository`, `Service`, `Handler`, `Controller`, `Command`, `Query`, `Mediator` class/file names |
| Frontend patterns | Look for state management imports (`redux`, `zustand`, `@ngrx`, `signals`), component directories, routing config |
| Data access | Search for ORM imports (`prisma`, `typeorm`, `entity-framework`, `sqlalchemy`, `gorm`), migration dirs, model/entity files |
| API patterns | Look for route/controller definitions, OpenAPI/Swagger files, GraphQL schemas, gRPC proto files |
| Dependency injection | Search for DI container setup (`services.Add*`, `@Injectable`, `container.register`, `wire`, `inject`) |

### Output

**Create** the file `docs/architecture.md` with the following content:

```
# Architecture & Patterns

> Generated by project discovery. Last updated: {date}

## Architecture Style
<!-- Monolith, microservices, modular monolith, etc. Explain why you concluded this. -->

## Key Patterns

| Pattern | Where Used | Example File |
|---------|-----------|-------------|
| | | |

## Request Flow (High-Level)
<!-- Describe the typical path of a request through the system, e.g.:
     HTTP Request → Router → Controller → Service → Repository → Database -->

## Dependency Injection
<!-- How DI is configured and where. -->
```

### Guidelines
- Document the **pattern**, not every instance
- Show **one concrete example** (file path + brief description) for each pattern found
- Focus on patterns a coding agent needs to follow when adding new features
- If a pattern area doesn't apply (e.g., no frontend), skip it
- Commit your changes before returning
````

---

### Template 3: Vertical Slice

````markdown
## Task: Document a Vertical Slice — One Feature End-to-End

Trace one representative feature through every layer of the project at `{project_path}`, from entry point to data store.

Read `docs/overview.md` and `docs/architecture.md` first to understand the tech stack and architecture.

### How to Pick a Feature

Choose a simple CRUD operation that touches all layers. Good candidates:
- "Create a new [entity]" (e.g., create a new user, order, item)
- "List all [entities]" with filtering

### What to Trace

Follow the request through each layer and document file paths:

| Layer | What to find |
|-------|-------------|
| **Entry point** | Route/endpoint definition |
| **Validation** | Input validation logic |
| **Business logic** | Service/handler that processes the request |
| **Data access** | Repository/query that persists data |
| **Data model** | Entity/model definition |
| **Database** | Migration or schema definition |
| **Response** | How the response is shaped and returned |

### Discovery Approach

1. Find an endpoint definition (e.g., `POST /items`)
2. Read the handler — note what service/function it calls
3. Follow that call into the service layer — note validation, business rules
4. Follow to the data access layer — note ORM calls, queries
5. Find the entity/model definition
6. Look for related tests at each layer

### Output

**Create** the file `docs/vertical-slice.md` with the following content:

```
# Vertical Slice: {Feature Name}

> Generated by project discovery. Last updated: {date}

## Feature Description
<!-- What this feature does (e.g., "Create a new item"). -->

## Request Flow

| Step | Layer | File | Description |
|------|-------|------|-------------|
| 1 | Entry point / Route | | |
| 2 | Validation | | |
| 3 | Business logic | | |
| 4 | Data access | | |
| 5 | Data model / Entity | | |
| 6 | Database / Migration | | |

## Patterns Observed in This Slice
<!-- Which patterns from docs/architecture.md are visible in this feature's code? -->

## How to Add a Similar Feature
<!-- Step-by-step guide based on this slice: what files to create, what to register, what to wire up. This is the most valuable output — make it concrete and actionable. -->
```

### Guidelines
- This file serves as the "how to add a new feature" reference
- Include actual file paths and brief code descriptions at each layer
- If a layer doesn't exist in this project (e.g., no separate validation layer), note that
- Commit your changes before returning
````

---

### Template 4: Cross-Cutting Concerns

````markdown
## Task: Document Cross-Cutting Concerns

Discover and document the shared infrastructure that applies across features in the project at `{project_path}` — logging, errors, auth, config, validation.

Read `docs/overview.md` and `docs/architecture.md` for context.

### What to Discover

| Concern | How to find it |
|---------|---------------|
| **Logging** | Search for `logger`, `log`, `ILogger`, `winston`, `pino`, `serilog`, `logging` imports. Check for logging config or middleware. |
| **Error handling** | Search for global error handlers, exception filters, custom exception classes, error middleware. Look for `ExceptionHandler`, `ErrorBoundary`, `@Catch`. |
| **Auth/AuthZ** | Search for `auth`, `jwt`, `bearer`, `[Authorize]`, `@UseGuards`, `middleware`, `passport`, `claims`, `roles`. |
| **Configuration** | Look for `.env`, `appsettings.json`, `config/`, `process.env`, `IConfiguration`, `ConfigService`. |
| **Validation** | Search for validation libraries (`class-validator`, `joi`, `zod`, `FluentValidation`, `pydantic`), validation decorators. |

### Output

**Create** the file `docs/cross-cutting.md` with the following content. For each concern, fill in the table and add a brief description with one example. Skip concerns that don't exist in the project.

```
# Cross-Cutting Concerns

> Generated by project discovery. Last updated: {date}

## Logging

| Property | Value |
|----------|-------|
| Framework | |
| Config location | |
| Log levels used | |
| Log destination | |

<!-- Brief description of logging pattern with one example. -->

## Error Handling

| Property | Value |
|----------|-------|
| Strategy | |
| Global handler location | |
| Custom exception types | |
| Error response format | |

<!-- Brief description with example. -->

## Authentication & Authorization

| Property | Value |
|----------|-------|
| Approach | |
| Auth middleware/guard | |
| Token type | |
| Role/claims model | |

<!-- Brief description of auth flow. -->

## Configuration

| Property | Value |
|----------|-------|
| Config sources | |
| Secrets management | |
| Environment handling | |

<!-- How to add a new config value. -->

## Validation

| Property | Value |
|----------|-------|
| Library/approach | |
| Where validation runs | |
| Example location | |

<!-- Brief description of validation pattern. -->
```

### Guidelines
- For each concern, document: **what** (library/framework), **where** (file paths), **how** (brief pattern)
- Show one concrete example per concern
- If a concern doesn't apply, skip the section entirely
- Commit your changes before returning
````

---

### Template 5: Testing Patterns

````markdown
## Task: Document Testing Patterns

Discover and document how the project at `{project_path}` tests code, so agents can write tests that match existing patterns.

Read `docs/overview.md` for context.

### What to Discover

| Item | How to find it |
|------|---------------|
| Test frameworks | Read dev dependencies for `jest`, `vitest`, `xunit`, `nunit`, `pytest`, `go test`, `mocha`, `cypress`, `playwright` |
| Test file locations | Look for `__tests__/`, `*.test.*`, `*.spec.*`, `tests/`, `test/` directories |
| Test configuration | Find `jest.config.*`, `vitest.config.*`, `pytest.ini`, `xunit.runner.json`, `cypress.config.*` |
| Test types | Look for directories or naming suggesting `unit/`, `integration/`, `e2e/` separation |
| Mocking patterns | Search for `mock`, `stub`, `fake`, `spy`, `jest.mock`, `unittest.mock`, `Moq`, `NSubstitute` |
| Test utilities | Look for test helpers, factories, fixtures, builders in test directories |
| Coverage config | Check for `nyc`, `istanbul`, `coverlet`, `coverage` in config files |

### Output

**Create** the file `docs/testing.md` with the following content:

```
# Testing Patterns

> Generated by project discovery. Last updated: {date}

## Test Framework(s)

| Framework | Type | Config File |
|-----------|------|------------|
| | | |

## Test File Conventions
<!-- Where test files live, naming pattern (e.g., `*.test.ts` co-located with source). -->

## Running Tests

| Action | Command |
|--------|---------|
| All tests | |
| Single file | |
| Watch mode | |
| Coverage | |

## Test Patterns

### Unit Test Example
<!-- Show a representative unit test: file path, setup/arrange, act, assert pattern. -->

### Integration Test Example (if applicable)
<!-- Show a representative integration test. -->

## Mocking Patterns
<!-- What mocking library is used, how mocks are set up, any shared test utilities. -->
```

### Guidelines
- Show one representative unit test example with actual code snippets
- Document the exact commands to run tests
- Focus on patterns an agent needs to follow when adding tests for new features
- Commit your changes before returning
````

---

### Template 6: Conventions & Standards

````markdown
## Task: Document Conventions & Standards

Discover and document the coding conventions and standards in the project at `{project_path}`, so agents produce code that fits in.

Read `docs/overview.md` for context.

### What to Discover

| Item | How to find it |
|------|---------------|
| Naming conventions | Read 5–10 source files across different directories. Note casing for files, classes, functions, variables, constants |
| File organization | Look at how features/modules are organized — by layer, by feature, or mixed |
| Code formatter | Check for `.prettierrc`, `.editorconfig`, `biome.json`, `.clang-format`, `rustfmt.toml` |
| Linter | Check for `.eslintrc`, `tslint.json`, `.pylintrc`, `.rubocop.yml`, `golangci-lint` config |
| Git conventions | Read recent commit messages (`git log --oneline -20`), look for `.github/`, branch naming patterns |
| Import ordering | Check if imports follow a specific pattern (external → internal → relative) |
| Comment style | Note whether code has JSDoc, XML doc comments, docstrings, or minimal comments |

### Output

**Create** the file `docs/conventions.md` with the following content:

```
# Conventions & Standards

> Generated by project discovery. Last updated: {date}

## Naming Conventions

| What | Convention | Example |
|------|-----------|---------|
| Files | | |
| Classes | | |
| Functions/methods | | |
| Variables | | |
| Constants | | |
| Database tables | | |
| API endpoints | | |

## File Organization
<!-- By layer, by feature, or mixed? Describe the pattern. -->

## Code Style

| Tool | Config File |
|------|------------|
| Formatter | |
| Linter | |
| Editor config | |

## Git Conventions
<!-- Branch naming, commit message format, PR conventions if visible. -->

## Import Ordering
<!-- External → internal → relative, or other pattern. -->
```

### Guidelines
- Sample actual source files to determine conventions — don't guess
- Focus on conventions an agent must follow to write code that fits the codebase
- If formatting/linting tools are configured, mention how to run them
- Commit your changes before returning
````

---

## References

- [Output Template](./references/output-template.md) — Reference templates for each output file
