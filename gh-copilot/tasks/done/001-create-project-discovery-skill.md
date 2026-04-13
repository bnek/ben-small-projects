# Task: Build the "Project Discovery & Documentation" Agent Skill

## Description

Create a reusable agent skill called `project-discovery` that guides supervisor and worker agents through systematically discovering and documenting an existing software project. The documentation produced by this skill provides coding agents with the context they need to work effectively on tasks within the project.

This skill is used **per-project** — the supervisor loads it when onboarding to a new codebase, then runs the discovery workflow to produce structured documentation stored in repo memory or context files.

## Why

Coding agents working on tasks in an existing project need to understand architecture, patterns, conventions, and how features flow through the system. Without this, agents make assumptions that conflict with the codebase. A standardized discovery skill ensures consistent, thorough documentation that any agent can consume.

## Requirements

### 1. Skill File Structure

Create the skill at `c:\Users\ben\.agents\skills\project-discovery\` following the existing skill pattern:

```
project-discovery/
  SKILL.md              ← Main skill with frontmatter and discovery workflow
  references/
    output-template.md  ← Template for the project documentation output
```

### 2. SKILL.md Content

The SKILL.md must include YAML frontmatter:

```yaml
---
name: project-discovery
description: >-
  Systematically discover and document an existing software project for coding agent context.
  Produces structured documentation covering architecture, patterns, conventions, and vertical slices.
  USE FOR: project onboarding, codebase documentation, discovering project patterns, documenting architecture for agents.
  DO NOT USE FOR: generating API docs from code comments, creating user-facing documentation.
---
```

The body of SKILL.md must define a **step-by-step discovery workflow** that an agent follows. Each step should explain what to look for, how to find it, and how to document it. The workflow must cover these areas:

#### a) Project Overview & Tech Stack
- Languages, frameworks, runtime versions
- Package managers and build tools
- Entry points (main files, startup scripts)
- Project layout / directory structure with purpose of each key directory
- How to build, run, and test the project

#### b) Architecture & Patterns
- Overall architecture style (monolith, microservices, modular monolith, etc.)
- Backend patterns: CQRS, repository pattern, service layer, mediator, etc.
- Frontend/UI patterns: state management (Redux, Zustand, signals, etc.), component patterns, routing
- Data access patterns: ORM usage, raw queries, data models
- API patterns: REST, GraphQL, gRPC — how endpoints are defined and organized
- Dependency injection / IoC approach

#### c) Vertical Slice Documentation
- Pick one representative feature (e.g., "create a new item") and trace it from UI → API → business logic → data layer → database
- Document the request/response flow with file paths at each layer
- Note which patterns from (b) are visible in this slice
- This serves as the "how to add a new feature" reference

#### d) Cross-Cutting Concerns
- **Logging**: Framework, patterns, log levels, where logs go
- **Error handling**: Strategy, custom exception types, error response format
- **Authentication/Authorization**: Approach, middleware, role/claims model
- **Configuration**: How config is loaded (env vars, config files, secrets)
- **Validation**: Where and how input validation happens

#### e) Testing Patterns
- Test frameworks in use
- Test file location conventions
- Unit vs integration vs e2e test patterns
- How to run tests, what test commands exist
- Mocking/stubbing patterns

#### f) Conventions & Standards
- Naming conventions (files, classes, functions, variables)
- File organization patterns
- Code style (formatter, linter configs)
- Git workflow (branch naming, commit conventions if visible)

### 3. Output Template

Create `references/output-template.md` — a markdown template that defines the structure of the documentation the agent produces after running the discovery workflow. The agent fills in this template for the specific project. The template should have sections matching the workflow areas above, with placeholder guidance for what to write in each section.

### 4. Workflow Guidance in SKILL.md

The SKILL.md should include practical guidance for the agent running the workflow:
- **How to discover** each area (e.g., "read package.json for dependencies", "search for logger/logging imports", "look for middleware registration")
- **What tools to use**: `read_file` for source files, `run_in_terminal` for build/test commands, `grep`/`rg` for pattern searching
- **How much depth**: The goal is enough documentation for a coding agent to work confidently, not exhaustive API documentation
- **Output location**: The completed documentation should be saved to the project's repo memory at `/docs/project-docs.md` or a similar conventional path
- **Incremental approach**: If the project is large, the skill should support documenting one area/module at a time (one task per project area, as the original idea suggests)

### 5. Loadability

The skill must be loadable by both the supervisor (for planning discovery tasks) and the worker (for executing discovery). The supervisor uses it to understand what documentation to request; the worker uses it as the step-by-step guide while exploring the codebase.

## Acceptance Criteria

- [ ] `c:\Users\ben\.agents\skills\project-discovery\SKILL.md` exists with correct frontmatter and complete discovery workflow
- [ ] `c:\Users\ben\.agents\skills\project-discovery\references\output-template.md` exists with a usable documentation template
- [ ] The SKILL.md workflow covers all six areas listed above (project overview, architecture, vertical slice, cross-cutting, testing, conventions)
- [ ] Each workflow step includes concrete guidance on **what to look for** and **how to find it**
- [ ] The output template has clear sections with placeholder guidance
- [ ] The skill follows the same format as existing skills at `c:\Users\ben\.agents\skills\` (reference `azure-postgres` and `azure-observability` for style)
- [ ] The skill is practical and actionable — an agent reading it can immediately start discovering a project without further guidance

## References

- Existing skill examples: `c:\Users\ben\.agents\skills\azure-postgres\SKILL.md` and `c:\Users\ben\.agents\skills\azure-observability\SKILL.md`
- Agent system plan: `c:\repos\ben-small-projects\gh-copilot\PLAN.md`
- Agent definitions: `c:\repos\ben-small-projects\gh-copilot\agents\supervisor.agent.md` and `c:\repos\ben-small-projects\gh-copilot\agents\worker.agent.md`

---
## Status
- **Attempt:** 1
- **Moved to in-progress:** 2026-04-14

## Completion Notes
- Completed: 2026-04-14
- Summary: Created `project-discovery` skill with SKILL.md (frontmatter + 6-step discovery workflow with tables, discovery commands, and guidance for each area) and references/output-template.md (structured template with sections for all 6 areas, tables, and placeholder guidance). Follows existing skill format conventions.
