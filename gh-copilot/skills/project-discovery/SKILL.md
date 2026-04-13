---
name: project-discovery
description: >-
  Systematically discover and document an existing software project for coding agent context.
  Produces structured documentation covering architecture, patterns, conventions, and vertical slices.
  USE FOR: project onboarding, codebase documentation, discovering project patterns, documenting architecture for agents.
  DO NOT USE FOR: generating API docs from code comments, creating user-facing documentation.
---

# Project Discovery & Documentation

Systematically explore and document an existing codebase so that coding agents have the context they need to work effectively on tasks within the project. This skill produces structured documentation covering architecture, patterns, conventions, and a vertical slice walkthrough.

**Primary use cases:**
- Onboarding to a new codebase for agent-assisted development
- Producing structured project documentation that agents consume as context
- Discovering patterns and conventions before making changes
- Creating a "how to add a feature" reference via vertical slice documentation

**Output location:** Save completed documentation to `/memories/repo/project-docs.md` using the [output template](./references/output-template.md).

---

## Quick Reference

| Property | Value |
|----------|-------|
| Output file | `/memories/repo/project-docs.md` |
| Template | `references/output-template.md` |
| Scope | Per-project — run once per codebase, update as needed |
| Approach | Incremental — can document one area at a time |

## Discovery Workflow

Follow the steps below in order. Each step explains **what to look for**, **how to find it**, and **what to record**. Use the output template to structure your findings.

For large projects, each step can be run as a separate task. For smaller projects, run the full workflow in one pass.

---

### Step 1: Project Overview & Tech Stack

**Goal:** Understand what the project is, what technologies it uses, and how to build/run/test it.

#### What to look for

| Item | How to find it |
|------|---------------|
| Languages & frameworks | Read `package.json`, `*.csproj`, `requirements.txt`, `go.mod`, `Cargo.toml`, `pom.xml`, `build.gradle`, or equivalent |
| Runtime versions | Check `.nvmrc`, `.python-version`, `.tool-versions`, `global.json`, Dockerfiles, CI config |
| Package manager | Look for `package-lock.json` (npm), `yarn.lock` (yarn), `pnpm-lock.yaml` (pnpm), `poetry.lock`, `Pipfile.lock` |
| Build tools | Read build scripts in `package.json`, `Makefile`, `Taskfile`, `Justfile`, CI/CD configs |
| Entry points | Search for `main`, `index`, `Program.cs`, `app.py`, `server.ts`, startup files |
| Directory structure | Run `Get-ChildItem -Recurse -Depth 2 -Directory` or `find . -type d -maxdepth 3` to map top-level layout |
| Build & run commands | Read `README.md`, `package.json` scripts, `Makefile` targets, `docker-compose.yml` |
| Test commands | Look for `test` scripts in package manager config, `Makefile` test targets |

#### Discovery commands

```bash
# List top-level directory structure
Get-ChildItem -Depth 2 -Directory | Select-Object FullName

# Find dependency/project files
Get-ChildItem -Recurse -Include "package.json","*.csproj","requirements.txt","go.mod","Cargo.toml","pom.xml" -Depth 3

# Read README for build/run instructions
read_file README.md
```

#### What to record

- Project name and one-line description
- Complete tech stack table (language, framework, version)
- Directory tree with purpose annotations for each key directory
- Exact commands to build, run, test, and lint

---

### Step 2: Architecture & Patterns

**Goal:** Understand how the codebase is structured and what design patterns it follows.

#### What to look for

| Pattern area | How to find it |
|-------------|---------------|
| Architecture style | Look at top-level directories — `src/services/`, `apps/`, `packages/` suggest monorepo; single `src/` with layers suggests monolith; separate deployable dirs suggest microservices |
| Backend patterns | Search for `Repository`, `Service`, `Handler`, `Controller`, `Command`, `Query`, `Mediator` class/file names |
| Frontend patterns | Look for state management imports (`redux`, `zustand`, `@ngrx`, `signals`), component directories, routing config |
| Data access | Search for ORM imports (`prisma`, `typeorm`, `entity-framework`, `sqlalchemy`, `gorm`), migration dirs, model/entity files |
| API patterns | Look for route/controller definitions, OpenAPI/Swagger files, GraphQL schemas, gRPC proto files |
| Dependency injection | Search for DI container setup (`services.Add*`, `@Injectable`, `container.register`, `wire`, `inject`) |

#### Discovery commands

```bash
# Find controllers/handlers/services
rg -l "Controller|Handler|Service" --type-add "code:*.{ts,js,cs,py,go,java}" -t code

# Find route definitions
rg "(app\.(get|post|put|delete|patch)|@(Get|Post|Put|Delete|Patch|Route|Controller)|MapGet|MapPost|router\.|@app\.route)" --type-add "code:*.{ts,js,cs,py,go,java}" -t code -l

# Find ORM/data models
rg -l "(Entity|Model|Schema|Table|@Column|@Entity|Base\.metadata|db\.Model)" --type-add "code:*.{ts,js,cs,py,go,java}" -t code

# Find DI registration
rg "(AddScoped|AddTransient|AddSingleton|@Injectable|@Inject|container\.register|services\.Add)" -l
```

#### What to record

- Architecture style with justification
- Table of patterns found (pattern name → where it's used → example file)
- How requests flow through the system at a high level (e.g., Controller → Service → Repository → DB)
- DI/IoC approach and where it's configured

---

### Step 3: Vertical Slice — One Feature End-to-End

**Goal:** Trace one representative feature through every layer of the system, from entry point to data store. This becomes the reference for "how to add a new feature."

#### How to pick a feature

Choose a simple CRUD operation that touches all layers. Good candidates:
- "Create a new [entity]" (e.g., create a new user, order, item)
- "List all [entities]" with filtering

#### What to trace

Follow the request through each layer and document file paths:

| Layer | What to find | Example |
|-------|-------------|---------|
| **Entry point** | Route/endpoint definition | `src/controllers/items.controller.ts` |
| **Validation** | Input validation logic | `src/dtos/create-item.dto.ts` |
| **Business logic** | Service/handler that processes the request | `src/services/items.service.ts` |
| **Data access** | Repository/query that persists data | `src/repositories/items.repository.ts` |
| **Data model** | Entity/model definition | `src/entities/item.entity.ts` |
| **Database** | Migration or schema definition | `migrations/001_create_items.sql` |
| **Response** | How the response is shaped and returned | DTO mapping, serialization |

#### Discovery approach

1. Find an endpoint definition (e.g., `POST /items`)
2. Read the handler — note what service/function it calls
3. Follow that call into the service layer — note validation, business rules
4. Follow to the data access layer — note ORM calls, queries
5. Find the entity/model definition
6. Look for related tests at each layer

#### What to record

- Feature name and description
- Table mapping each layer to its file path and key code
- The request/response flow as a numbered sequence
- Which patterns from Step 2 are visible in this slice
- Any middleware or cross-cutting concerns that intercept the request

---

### Step 4: Cross-Cutting Concerns

**Goal:** Document the shared infrastructure that applies across features — logging, errors, auth, config, validation.

#### What to look for

| Concern | How to find it |
|---------|---------------|
| **Logging** | Search for `logger`, `log`, `ILogger`, `winston`, `pino`, `serilog`, `logging` imports. Check for a logging config or middleware. |
| **Error handling** | Search for global error handlers, exception filters, `try/catch` patterns, custom exception classes, error middleware. Look for `ExceptionHandler`, `ErrorBoundary`, `error-handler`, `@Catch`. |
| **Auth/AuthZ** | Search for `auth`, `jwt`, `bearer`, `[Authorize]`, `@UseGuards`, `middleware`, `passport`, `claims`, `roles`. Look for auth middleware registration. |
| **Configuration** | Look for `.env`, `appsettings.json`, `config/`, `process.env`, `IConfiguration`, `ConfigService` usage. Check how secrets are managed. |
| **Validation** | Search for validation libraries (`class-validator`, `joi`, `zod`, `FluentValidation`, `pydantic`), validation decorators, middleware. |

#### Discovery commands

```bash
# Find logging setup
rg -l "(logger|Logger|ILogger|winston|pino|serilog|log4)" --type-add "code:*.{ts,js,cs,py,go,java}" -t code

# Find error handling
rg -l "(ExceptionHandler|ExceptionFilter|ErrorBoundary|error.handler|GlobalExceptionHandler|@Catch)" -l

# Find auth middleware/guards
rg -l "(Authorize|UseGuards|auth.middleware|passport|jwt.verify|RequireAuth)" -l

# Find config loading
rg -l "(ConfigService|IConfiguration|process\.env\.|os\.environ|config\.get)" -l

# Find validation
rg -l "(class-validator|zod|joi|FluentValidation|pydantic|@IsString|@IsNotEmpty|\.validate\()" -l
```

#### What to record

For each concern, document:
- **What**: Library/framework used
- **Where**: File path of configuration or registration
- **How**: Brief description of the pattern (e.g., "Global exception filter catches all unhandled exceptions and returns a standardized error JSON")
- **Example**: One concrete example of usage

---

### Step 5: Testing Patterns

**Goal:** Understand how the project tests code so agents can write tests that match existing patterns.

#### What to look for

| Item | How to find it |
|------|---------------|
| Test frameworks | Read dev dependencies for `jest`, `vitest`, `xunit`, `nunit`, `pytest`, `go test`, `mocha`, `cypress`, `playwright` |
| Test file locations | Look for `__tests__/`, `*.test.*`, `*.spec.*`, `tests/`, `test/` directories |
| Test configuration | Find `jest.config.*`, `vitest.config.*`, `pytest.ini`, `xunit.runner.json`, `cypress.config.*` |
| Test types | Look for directories or naming suggesting `unit/`, `integration/`, `e2e/` separation |
| Mocking patterns | Search for `mock`, `stub`, `fake`, `spy`, `jest.mock`, `unittest.mock`, `Moq`, `NSubstitute` |
| Test utilities | Look for test helpers, factories, fixtures, builders in test directories |
| Coverage config | Check for `nyc`, `istanbul`, `coverlet`, `coverage` in config files |

#### Discovery commands

```bash
# Find test files
Get-ChildItem -Recurse -Include "*.test.*","*.spec.*","*_test.*","*Tests.cs","test_*.py" | Select-Object FullName

# Find test config
Get-ChildItem -Recurse -Include "jest.config.*","vitest.config.*","pytest.ini",".nunitrc","cypress.config.*" | Select-Object FullName

# Find mocking patterns
rg "(jest\.mock|vi\.mock|Mock<|mock\(|@patch|unittest\.mock|Moq|NSubstitute)" --type-add "test:*.{test.*,spec.*}" -l

# Check for test scripts
rg "\"test" package.json
```

#### What to record

- Test framework(s) and where they're configured
- File naming convention for tests (e.g., `*.test.ts` next to source vs. `tests/` mirror directory)
- Example of a unit test — show one representative test with setup, act, assert
- Example of an integration test if present
- How to run all tests, specific tests, and watch mode
- Mocking approach and patterns

---

### Step 6: Conventions & Standards

**Goal:** Document the unwritten rules of the codebase so agents produce code that fits in.

#### What to look for

| Item | How to find it |
|------|---------------|
| Naming conventions | Read 5–10 source files across different directories. Note casing for files (`kebab-case`, `PascalCase`, `camelCase`), classes, functions, variables, constants |
| File organization | Look at how features/modules are organized — by layer (`controllers/`, `services/`), by feature (`users/`, `orders/`), or mixed |
| Code formatter | Check for `.prettierrc`, `.editorconfig`, `biome.json`, `.clang-format`, `rustfmt.toml` |
| Linter | Check for `.eslintrc`, `tslint.json`, `.pylintrc`, `.rubocop.yml`, `golangci-lint` config |
| Git conventions | Read recent commit messages (`git log --oneline -20`), look for `.github/`, branch naming patterns |
| Import ordering | Check if imports follow a specific pattern (external → internal → relative) |
| Comment style | Note whether code has JSDoc, XML doc comments, docstrings, or minimal comments |

#### Discovery commands

```bash
# Find formatter/linter configs
Get-ChildItem -Recurse -Include ".prettierrc*",".eslintrc*","biome.json",".editorconfig","tslint.json",".pylintrc" -Depth 2

# Check recent git history for conventions
git log --oneline -20

# Check for commit convention config
Get-ChildItem -Recurse -Include ".commitlintrc*","commitlint.config.*",".czrc" -Depth 2

# Sample file names for naming convention detection
Get-ChildItem -Recurse -Include "*.ts","*.js","*.cs","*.py" -Depth 3 | Select-Object Name -First 30
```

#### What to record

- Naming conventions table (what → convention → example)
- File organization pattern with justification
- Formatter and linter in use, and how to run them
- Any Git/commit conventions observed
- Import ordering pattern if consistent

---

## Workflow Guidance

### Depth of Documentation

The goal is **enough documentation for a coding agent to work confidently**, not exhaustive API documentation. For each area:
- Document the **pattern**, not every instance
- Show **one concrete example** rather than listing all occurrences
- Focus on **what an agent needs to know to add a new feature or fix a bug**

### Incremental Approach

For large projects, break discovery into separate tasks:
1. **Task 1:** Steps 1–2 (Overview + Architecture) — foundational context
2. **Task 2:** Step 3 (Vertical Slice) — how features work end-to-end
3. **Task 3:** Steps 4–6 (Cross-cutting + Testing + Conventions) — operational details

Each task appends its findings to the same output file (`/memories/repo/project-docs.md`).

### Tools to Use

| Tool | Use for |
|------|---------|
| `read_file` | Reading source files, config files, READMEs |
| `run_in_terminal` | Running build/test commands, directory listings, git log |
| `rg` (ripgrep) | Searching for patterns, imports, class names across the codebase |
| `Get-ChildItem` | Listing directory structure, finding files by name pattern |

### Output

After completing discovery (all steps or a subset), compile your findings into the output template and save to `/memories/repo/project-docs.md`. If updating an existing document, merge your new findings into the existing sections rather than overwriting.

## References

- [Output Template](./references/output-template.md) — Template for structuring project documentation
