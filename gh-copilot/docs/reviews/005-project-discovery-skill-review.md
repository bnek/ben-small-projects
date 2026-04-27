# Review: project-discovery Skill

> Reviewed: 2026-04-15  
> Skill path: `skills/project-discovery/SKILL.md`  
> Supporting file: `skills/project-discovery/references/output-template.md`

---

## 1. Strengths Analysis

### Well-Designed Task Decomposition
The 6-task decomposition is thoughtfully ordered with explicit dependency chains (later tasks read earlier output files). This is critical in a multi-agent workflow where workers are stateless — each task is self-contained yet builds on prior outputs through file-based context sharing.

### Excellent "How to Find It" Tables
Each template includes a practical lookup table mapping discovery targets to concrete search strategies (file names, import patterns, directory conventions). This is exactly what a coding agent needs — it converts vague goals ("find the architecture style") into actionable search operations.

### Template-Driven Output
The output templates enforce structured, consistent documentation. Tables and fixed headings make the output machine-parseable, which is essential since the primary consumers are other agents (workers reading `docs/overview.md` before doing architecture discovery).

### Scope Flexibility
The supervisor can select subsets of the 6 tasks based on need (architecture-only, full discovery, etc.), avoiding unnecessary work. The mapping table makes this easy to decide.

### Strong Vertical Slice Design
Template 3 (Vertical Slice) is the standout — it produces the most actionable output: a concrete "How to Add a Similar Feature" guide grounded in an actual traced request flow. This is the single most valuable artifact for a coding agent.

### Practical Task File Naming & Numbering
The guidance to check existing task numbers before creating new ones prevents collisions in the queue system.

---

## 2. Gaps & Weaknesses

### 2.1 Environment & Setup Complexity — MAJOR GAP
The overview template captures build/run/test commands but does **not** guide discovery of:
- **Docker/container requirements**: `docker-compose.yml`, `Dockerfile`, required services (databases, message queues, caches)
- **Environment variables**: What `.env` vars are required, which have defaults, which are secrets
- **Local service dependencies**: Does the project need Redis, PostgreSQL, Elasticsearch running locally?
- **Setup scripts**: `scripts/setup.sh`, database seeding, migration commands
- **Prerequisites**: Required CLI tools beyond the runtime (e.g., `protoc`, `terraform`, `az cli`)

For a coding agent trying to get a project running, missing environment setup is the #1 blocker. The cross-cutting template touches config briefly but doesn't capture the full "what do I need to get this running from scratch" picture.

### 2.2 API Contracts & Service Boundaries — MODERATE GAP
The architecture template asks about "API patterns" but doesn't guide discovery of:
- OpenAPI/Swagger specs and where they live
- GraphQL schemas
- gRPC proto definitions
- Inter-service communication patterns (REST calls, message queues, events)
- API versioning strategy
- Request/response DTOs and where they're defined

For agents adding new endpoints or modifying existing ones, knowing the API contract pattern is essential.

### 2.3 Deployment & CI/CD — MODERATE GAP
No template covers:
- CI/CD pipeline configuration (`.github/workflows/`, `.gitlab-ci.yml`, `azure-pipelines.yml`)
- Deployment targets (Kubernetes, App Service, Lambda, etc.)
- Infrastructure-as-code (`terraform/`, `bicep/`, `pulumi/`, CDK)
- Environment promotion (dev → staging → prod)
- Required CI checks before merge

Agents that need to modify CI pipelines or understand deployment constraints are left without context.

### 2.4 Observability Beyond Logging — MINOR GAP
Cross-cutting concerns cover logging but miss:
- Distributed tracing (OpenTelemetry, Jaeger, Application Insights)
- Metrics & dashboards (Prometheus, Grafana, custom metrics)
- Health check endpoints
- Alerting configuration

### 2.5 Security Patterns — MINOR GAP
Auth is covered, but broader security patterns are not:
- Input sanitization approach
- CORS configuration
- Content Security Policy
- Rate limiting
- Secrets rotation
- Dependency vulnerability scanning

### 2.6 Code Generation & Generated Files — MINOR GAP
No guidance on discovering:
- Generated code that should NOT be manually edited (protobuf output, OpenAPI client stubs, ORM migrations)
- Code generation commands and when to run them
- `.gitignore` patterns indicating generated artifacts

This matters because agents can waste time editing generated files or miss required codegen steps.

### 2.7 Error Recovery / Common Pitfalls — MISSING
None of the templates capture:
- Known gotchas or anti-patterns specific to the project
- Common setup failures and their solutions
- Patterns that look correct but break in subtle ways
- Decisions that were made for non-obvious reasons (ADRs / architecture decision records)

This is high-value institutional knowledge that prevents agents from making mistakes that humans learned to avoid.

---

## 3. Template Quality Assessment

### Template 1: Project Overview & Tech Stack — GOOD
- **Useful for agents?** Yes — foundational info every other task needs.
- **Issues**: Missing environment/setup complexity (see 2.1). The "Build, Run & Test Commands" table should include `setup/init` as a row. Missing monorepo sub-project enumeration guidance.

### Template 2: Architecture & Patterns — GOOD, COULD BE STRONGER
- **Useful for agents?** Yes, but the request flow section is too open-ended. 
- **Issues**: Should ask for a concrete sequence diagram or numbered flow, not just a comment prompt. "Dependency Injection" section feels narrow — should be broader "Wiring & Registration" covering DI, module registration, route registration, middleware ordering.

### Template 3: Vertical Slice — EXCELLENT
- **Useful for agents?** Most actionable template. The "How to Add a Similar Feature" section is exactly what agents need.
- **Issues**: Should suggest tracing more than one feature if the project has distinct feature shapes (e.g., CRUD endpoint vs. async event handler vs. scheduled job). One slice may not represent all patterns.

### Template 4: Cross-Cutting Concerns — GOOD
- **Useful for agents?** Yes — agents need to know how to add logging, handle errors, etc. in new code.
- **Issues**: Missing observability beyond logging (see 2.4). Missing security patterns (see 2.5). The "Configuration" section should explicitly ask for "how to add a new config value" as a step-by-step, not just a comment prompt.

### Template 5: Testing Patterns — GOOD
- **Useful for agents?** Yes — agents frequently need to write tests.
- **Issues**: Should ask for the test file creation checklist: where to put the file, what to name it, what imports to include, what test utilities to use. A "skeleton test file" output would be more actionable than just describing patterns.

### Template 6: Conventions & Standards — ADEQUATE
- **Useful for agents?** Moderately. Naming conventions and code style are useful; git conventions less so for agents.
- **Issues**: Weakest template in terms of ROI. Much of this can be inferred from linter/formatter configs. Could be merged into other templates or refocused on "patterns to follow when writing new code."

### Redundancy Check
- Some overlap between Template 2 (Architecture) and Template 3 (Vertical Slice) on describing patterns — but acceptable since Template 3 grounds them in a concrete example.
- Template 4 (Cross-Cutting) and Template 6 (Conventions) have slight overlap on "how to write code correctly" but at different levels of abstraction. Acceptable.

---

## 4. Agent-Centric Best Practices Assessment

### Structured over Prose — STRONG ✓
Templates use tables extensively, which is excellent for LLM parsing. Fixed headings provide consistent structure. The table-first approach in the "What to Discover" sections is best-in-class.

### Example-Driven — MODERATE ⚠
Templates ask for "one concrete example" per pattern, which is good but often insufficient. Modern agent documentation best practice suggests **2-3 examples** spanning different variants of a pattern (e.g., a simple endpoint AND one with auth + validation). The Vertical Slice is the strongest here by definition.

### Path-Centric — STRONG ✓
Templates consistently ask for file paths in tables. This is critical — agents navigate by file path, not by concept. The "Example File" column in Architecture patterns table is well-designed.

### Task-Oriented — MODERATE ⚠
The Vertical Slice template is task-oriented (ends with "How to Add a Similar Feature"). But other templates produce reference documentation rather than task-oriented guides. Modern best practice increasingly favors **runbook-style documentation**: "To add a new API endpoint, do X, Y, Z" rather than "The project uses pattern P."

Consider adding a "Common Agent Tasks" section to each template:
- Overview: "How to add a new dependency"
- Architecture: "How to add a new module/service"
- Cross-cutting: "How to add logging/error handling to a new feature"
- Testing: "How to add tests for a new feature"

### Freshness & Maintenance — WEAK ⚠
Each output file has a "Last updated: {date}" header, but there's no guidance on:
- When to re-run discovery (after major refactors? On a schedule?)
- How to update incrementally vs. regenerating from scratch
- How to detect drift between docs and code
- Partial re-discovery (just re-run Template 5 after test framework migration)

### Contextual Grounding — STRONG ✓
Templates ground findings in actual file paths and real code examples. The "How to find it" tables send workers to real artifacts, not abstract concepts. This is one of the skill's greatest strengths.

---

## 5. Specific Recommendations (Prioritized)

### R1: Add Environment Setup to Template 1 (HIGH PRIORITY)
**What**: Add a "Development Environment Setup" section to the Overview template covering Docker services, required env vars, setup scripts, and prerequisites.  
**Why**: This is the #1 blocker for agents trying to work on a project. Without it, agents can't build or run the project.  
**Implementation**: Add rows to the discovery table for `docker-compose.yml`, `.env.example`, `scripts/setup*`, and add an "Environment Setup" section to the output template with a prerequisites checklist and step-by-step setup guide.

### R2: Add "How to..." Runbook Sections to Each Template (HIGH PRIORITY)
**What**: Each template should end with a task-oriented "How to..." section specific to its domain.  
**Why**: Agents don't read documentation linearly — they search for "how do I do X?" Task-oriented sections directly answer these questions.  
**Implementation**: 
- Overview: "How to set up the dev environment from scratch"
- Architecture: "How to add a new module/service"
- Cross-cutting: "How to add logging/auth/validation to new code"
- Testing: "How to create a test file for a new feature"
- Conventions: "Pre-commit checklist"

### R3: Support Multiple Vertical Slices for Diverse Feature Shapes (HIGH PRIORITY)
**What**: Template 3 should guide the worker to identify distinct feature shapes and trace at least one of each, or note which shape to trace if only one is appropriate.  
**Why**: Projects often have 2-3 distinct feature types (sync API endpoint, async event handler, scheduled job, CLI command). One slice doesn't cover them all.  
**Implementation**: Add a "Feature Shape Inventory" step before the trace: list all distinct shapes (CRUD endpoint, background job, event handler, etc.) and trace the most common one. Note other shapes for potential future slices.

### R4: Add API Contract Discovery to Template 2 (MEDIUM PRIORITY)
**What**: Expand the Architecture template to discover API schemas, DTOs, service boundaries, and contract definitions.  
**Why**: Agents adding or modifying endpoints need to know where contracts are defined and how to follow the pattern.  
**Implementation**: Add rows for OpenAPI/Swagger files, GraphQL schemas, gRPC protos, DTO/model locations, and API versioning strategy. Add an "API Contracts" section to the output.

### R5: Add a "Generated Code" Section to Template 6 or Template 1 (MEDIUM PRIORITY)
**What**: Document code generation tools, their commands, and which files/directories are generated (not to be manually edited).  
**Why**: Agents editing generated files waste tokens and produce changes that get overwritten. This is a common and expensive mistake.  
**Implementation**: Add a "Generated Code" table: tool, command, output directory, trigger (manual/CI/pre-commit).

### R6: Expand Cross-Cutting Template to Include Observability (MEDIUM PRIORITY)
**What**: Add sections for distributed tracing, metrics, and health checks alongside the existing logging section.  
**Why**: Many modern projects use OpenTelemetry or similar. Agents adding new services/endpoints need to know how to instrument them.  
**Implementation**: Add "Observability" section with sub-sections for tracing (library, propagation format) and metrics (library, custom metrics pattern, dashboard location).

### R7: Add "Gotchas & Known Issues" Section (MEDIUM PRIORITY)
**What**: Add a template (or section in Overview) for capturing non-obvious project quirks, anti-patterns to avoid, and known issues.  
**Why**: This is institutional knowledge that prevents agents from repeating mistakes. It's often missing from any formal documentation but extremely high-value.  
**Implementation**: Add a "Gotchas" table in Overview output: issue, context, correct approach. Workers can populate this from README warnings, code comments with `HACK`/`TODO`/`WORKAROUND`, and CI configuration quirks.

### R8: Add Re-Discovery / Maintenance Guidance (LOW PRIORITY)
**What**: Add a section to the SKILL.md explaining when and how to re-run discovery.  
**Why**: Documentation drifts from code. Having a re-discovery strategy keeps the docs useful over time.  
**Implementation**: Add a "Maintaining Discovery Docs" section: recommended triggers for re-running (major dependency upgrade, architecture change, new team member onboarding), and how to do partial re-runs.

### R9: Add Test Skeleton to Template 5 (LOW PRIORITY)
**What**: Template 5 should produce an actual copy-pasteable test skeleton file in addition to the documentation.  
**Why**: Agents creating tests benefit more from a concrete skeleton than a description of patterns. A skeleton with the right imports, setup, and structure is immediately actionable.  
**Implementation**: Add "Test Skeleton" section to the output that includes a complete, runnable test file (with placeholder test name and body) showing the correct imports, setup/teardown, and assertion style.

### R10: Consider Merging Template 6 into Other Templates (LOW PRIORITY)
**What**: Conventions & Standards (Template 6) overlaps with other templates and has the lowest standalone ROI. Consider distributing its content into the templates where it's most actionable.  
**Why**: Naming conventions are best captured alongside the patterns that use them (Architecture). Code style tool config is best captured alongside build commands (Overview). Git conventions are low-value for agents.  
**Implementation**: Move naming conventions to Architecture, move formatter/linter to Overview's commands table, drop or minimize the standalone Conventions template.

---

## Summary

The project-discovery skill is **well-designed** for its core purpose. Its greatest strengths are the structured templates, practical "How to find it" guidance, and the task decomposition model that works well in stateless multi-agent workflows. 

The most impactful improvements would be:
1. **Environment setup coverage** (R1) — the biggest practical gap
2. **Task-oriented "How to..." sections** (R2) — shifts from reference docs to actionable guides
3. **Multiple vertical slices** (R3) — handles real-world project complexity

These three changes would meaningfully increase the utility of the discovery output for coding agents building features in unfamiliar codebases.
