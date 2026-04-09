# Multi-Level Agent Delegation System — Implementation Plan

## Overview

A three-tier agent delegation system where the top-level orchestrator runs indefinitely without consuming its own context window. The supervisor owns the full task lifecycle — picking tasks, spawning worker sub-agents with complete context, reviewing results, and moving completed tasks to done.

**Key capability:** Sub-agents can spawn nested sub-agents. The supervisor invokes workers directly, eliminating the need for file-based communication between supervisor and worker.

## Architecture

```
┌─────────────────────────────────────────────────────┐
│  User                                               │
│  (provides tasks as .md files in tasks/queue/)      │
└──────────────┬──────────────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────────────┐
│  ORCHESTRATOR  (orchestrator.agent.md)              │
│  ─────────────────────────────────────────────────  │
│  • Zero planning, zero analysis                     │
│  • Only tools: agent, confirm_conversation_finished │
│  • Fixed loop:                                      │
│      1. Invoke supervisor (one fixed prompt always) │
│      2. If ALL_DONE → stop                          │
│      3. Go to 1                                     │
│  • Context window stays flat — runs indefinitely    │
└──────────┬──────────────────────────────────────────┘
           │
     invokes (always same prompt)
           │
           ▼
┌─────────────────────────────────────────────────────┐
│  SUPERVISOR  (supervisor.agent.md)                  │
│  ─────────────────────────────────────────────────  │
│  • Picks task from queue, moves to in-progress      │
│  • Reads & understands the task fully               │
│  • Gathers all relevant context (docs, source, etc) │
│  • Spawns worker sub-agents with complete prompts   │
│  • Reviews worker responses                         │
│  • May run multiple worker rounds per task          │
│  • Moves completed task to done                     │
│  • Returns ALL_DONE when queue is empty             │
│  • NEVER does implementation work itself            │
└──────────┬──────────────────────────────────────────┘
           │
     invokes (with full context prompt)
           │
           ▼
┌─────────────────────────────────────────────────────┐
│  WORKER  (worker.agent.md)                          │
│  ─────────────────────────────────────────────────  │
│  • Full tool access                                 │
│  • Receives all instructions via prompt             │
│  • Executes entire task                             │
│  • Returns detailed summary as response             │
│  • No filesystem-based communication                │
└─────────────────────────────────────────────────────┘

Communication:
  Orchestrator → Supervisor: fixed prompt (always the same)
  Supervisor → Worker: detailed prompt with full task context
  Worker → Supervisor: response summary (return value)
  Supervisor → Orchestrator: brief status or ALL_DONE

File-based state:
  tasks/queue/001-task.md          ← user places tasks here
  tasks/in-progress/001-task.md    ← supervisor moves task here while working
  tasks/done/001-task.md           ← supervisor moves completed task here
```

## Execution Flow — Step by Step

```
Orchestrator invokes Supervisor:
  Supervisor: checks tasks/in-progress/ — nothing there
  Supervisor: picks first task from tasks/queue/, moves to in-progress/
  Supervisor: reads task file, gathers context (project docs, source files)
  Supervisor: invokes Worker with complete prompt including:
    - Task description & requirements
    - Relevant project context
    - Acceptance criteria
    - Specific instructions
  Worker: executes the task (edits code, runs commands, etc.)
  Worker: returns detailed summary as response
  Supervisor: evaluates worker's response against acceptance criteria
  Supervisor: if acceptable → appends completion notes, moves task to done/
  Supervisor: if needs fixes → invokes Worker again with fix instructions
  Supervisor: checks queue for more tasks
  Supervisor: picks next task or returns ALL_DONE

Orchestrator checks for ALL_DONE:
  If not ALL_DONE → invoke Supervisor again
  If ALL_DONE → prompt user, stop
```

**Expected overhead per task: 1 orchestrator invocation** (supervisor handles one task including worker rounds, then returns).

## Supervisor → Worker Prompt Design

The supervisor must provide the worker with a self-contained prompt. The worker has no memory and cannot discover its task from the filesystem. The prompt should include:

```markdown
## Task: {title}

{full task description and requirements}

## Context
{content from relevant project docs, existing source files, architectural decisions}

## Instructions
1. {specific step}
2. {specific step}
...

## Acceptance Criteria
- {criterion}
- {criterion}

## Notes
- Commit your changes before returning
- {any additional guidance}
```

For fix rounds, the supervisor includes:
- What was already done (from the worker's previous response)
- What specifically needs to be fixed
- Any additional context for the fix

## Task File Format

### As placed in queue by user

```markdown
---
title: "Implement user authentication"
priority: 1
---

## Description
Add JWT-based authentication to the API.

## Requirements
- Login endpoint at POST /auth/login
- Token refresh at POST /auth/refresh
- Middleware to protect routes

## Acceptance Criteria
- [ ] Login returns a JWT token
- [ ] Protected routes reject unauthenticated requests
- [ ] Tokens expire after 1 hour
```

### After supervisor moves to in-progress

The supervisor appends a status section:

```markdown
---
## Status
- **Attempt:** 1
- **Moved to in-progress:** 2026-04-08
```

### After a failed attempt — supervisor appends notes

```markdown
---
## Status
- **Attempt:** 2
- **Moved to in-progress:** 2026-04-08

## Notes from attempt 1
- Server starts but GET /health returns 404 — route was not registered
- Tests were not added
- Worker should check route registration order and add integration tests
```

## Task Queue — File-Based

```
tasks/
  queue/         ← pending tasks (user adds .md files here)
  in-progress/   ← exactly one task file (managed by supervisor)
  done/          ← completed task files (moved by supervisor)
```

Tasks are picked in alphabetical order. The supervisor moves the task file itself between folders. No copies, no backups.

## Agent Specifications

### 1. Orchestrator (`orchestrator.agent.md`)

**Purpose:** Loop driver. Never thinks, never plans. Invokes the supervisor in a fixed loop.

**Tools:** `agent`, `mcp-tools-win/confirm_conversation_finished`

**Behavior:**
1. Invoke `supervisor` with one fixed prompt: *"Process the next task. Pick a task from tasks/queue/, move it to in-progress, use worker sub-agents to complete it, then move it to done. If no tasks remain, respond with ALL_DONE."*
2. Check supervisor response for `ALL_DONE`:
   - If `ALL_DONE` found: Call `confirm_conversation_finished` and stop
   - Otherwise: Go to step 1

**Key property:** The orchestrator sends the same fixed prompt every time. Each loop iteration is identical in token cost. All state lives in files and in the supervisor's ephemeral context.

### 2. Supervisor (`supervisor.agent.md`)

**Purpose:** Task coordinator. Owns the full lifecycle of **one task per invocation**: picks it, understands it, gathers context, delegates to workers, reviews results, moves it to done, and returns. Never does implementation work. The orchestrator invokes it repeatedly for successive tasks.

**Tools:** `agent`, `read`, `execute`, `mcp-tools-win/ask_user`

**Note:** The supervisor deliberately lacks `edit` and `search` tools to prevent it from doing implementation work. It only reads files (for context) and runs terminal commands (for moving task files). All code editing, testing, and implementation is delegated to workers.

**Behavior:**
1. Check `tasks/in-progress/` for an existing task, or pick next from `tasks/queue/`
2. Read and understand the task fully — requirements, acceptance criteria, referenced files
3. Gather all relevant context the worker will need (project docs, source files, etc.)
4. Invoke `worker` with a detailed, self-contained prompt
5. Review the worker's response against acceptance criteria
6. If acceptable → move task to done, pick next task or return `ALL_DONE`
7. If needs fixes → invoke worker again with fix instructions (up to 3 attempts)

**Key property:** The supervisor spawns workers directly via the `agent` tool. Communication is prompt-based (supervisor → worker) and response-based (worker → supervisor). No `worker-result.md` file needed.

### 3. Worker (`worker.agent.md`)

**Purpose:** Full-task executor with full tool access. Receives complete instructions via the supervisor's prompt, executes the task, and returns a detailed summary as its response.

**Tools:** `vscode`, `execute`, `read`, `edit`, `search`, `web`, `browser`, `mcp-tools-win/ask_user`, `todo`

**Model:** Claude Opus 4.6 (copilot)

**Behavior:**
1. Read the instructions from the invoking prompt (NOT from the filesystem)
2. Execute the entire task using all available tools
3. Verify work against the provided acceptance criteria
4. Commit changes
5. Return a detailed summary as the response

**Key property:** The worker is stateless and self-contained. Its prompt IS its entire world — it does not search for tasks in the filesystem. Its response IS its deliverable — no file-based result reporting.

## Implementation Steps

1. Create `tasks/queue/`, `tasks/in-progress/`, `tasks/done/` folder structure
2. Create `orchestrator.agent.md` — the fixed loop driver (only calls supervisor)
3. Create `supervisor.agent.md` — the task coordinator (has `agent` tool, spawns workers)
4. Create `worker.agent.md` — the full-task executor (receives instructions via prompt)
5. Add an example task in `tasks/queue/` to demonstrate the system
6. Update `agents.txt` with new agent descriptions

## Context Window Analysis

| Agent | Context per iteration | Grows over time? |
|---|---|---|
| Orchestrator | ~fixed (same prompt + short response check) | No — each subagent call is independent |
| Supervisor | Task file + context files + worker responses | No — fresh invocation each round |
| Worker | Prompt contents only | No — fresh per invocation |

The orchestrator's context is bounded because:
- It sends the same fixed prompt to the supervisor every time
- It only checks for `ALL_DONE` in the supervisor's response
- The `confirm_conversation_finished` tool resets the loop by getting fresh user input
- All accumulated state lives in files, not in any agent's context

## Design Principles

| Aspect | Design Choice | Rationale |
|---|---|---|
| Signal protocol | Single stop-word (`ALL_DONE`), continue is implicit | Default path requires zero special output; only one failure mode |
| Orchestrator prompts | One fixed prompt always | Supervisor determines action from filesystem state |
| Worker invocation | Supervisor spawns workers directly | Nested sub-agents eliminate file-based communication overhead |
| Worker instructions | Self-contained prompt from supervisor | Worker needs no filesystem discovery; all context provided upfront |
| Communication | Prompt-based (down) and response-based (up) | Cleaner than file-based; supervisor sees worker result immediately |
| State management | Filesystem for task queue; prompt/response for execution | Queue state persists across invocations; execution state is ephemeral |
| Retry info | Supervisor includes in follow-up worker prompt | Worker gets specific fix instructions without reading prior result files |
| Overhead per task | 1 orchestrator invocation (supervisor handles worker rounds internally) | Reduced from 3+ to 1 orchestrator round-trip |
