# Multi-Level Agent Delegation System — Implementation Plan

## Overview

A three-tier agent delegation system where the top-level orchestrator runs indefinitely without consuming its own context window. All planning, reasoning, and execution happen in disposable sub-agent invocations.

**Key constraint:** Sub-agent recursion depth is limited to 1. The orchestrator can spawn the supervisor or the worker, but the supervisor **cannot** spawn the worker itself. This means the system must be **iterative** (orchestrator drives the loop) rather than **recursive** (supervisor delegates to worker).

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
│  • Fixed alternating loop:                          │
│      1. Invoke supervisor (one fixed prompt always) │
│      2. If ALL_DONE → stop                          │
│      3. Invoke worker (one fixed prompt always)     │
│      4. Go to 1                                     │
│  • Context window stays flat — runs indefinitely    │
└──────────┬──────────────────┬───────────────────────┘
           │                  │
     invokes (manage)   invokes (execute)
           │                  │
           ▼                  ▼
┌────────────────────┐ ┌─────────────────────────────┐
│  SUPERVISOR        │ │  WORKER                     │
│  (supervisor       │ │  (worker.agent.md)          │
│   .agent.md)       │ │                             │
│  ────────────────  │ │  ───────────────────────    │
│  • Manages task    │ │  • Full tool access         │
│    lifecycle       │ │  • Reads the task file      │
│  • Moves tasks     │ │    from tasks/in-progress/  │
│    between folders │ │  • Executes entire task     │
│  • Adds status &   │ │  • Writes worker-result.md  │
│    notes to task   │ │  • Returns summary          │
│    file            │ │                             │
│  • Reviews worker  │ └─────────────────────────────┘
│    results         │
│  • Decides next    │
│    step or ALL_DONE│
└────────────────────┘

Communication is file-based. The task file itself is the worker's instructions:

  tasks/queue/001-task.md          ← user places tasks here
  tasks/in-progress/001-task.md    ← supervisor moves task here (worker reads it)
  tasks/in-progress/worker-result.md  ← worker writes result here (supervisor reads it)
  tasks/done/001-task.md           ← supervisor moves completed task here
```

## Iterative Loop — Step by Step

```
Round 1 (supervisor call):
  Orchestrator ──invoke──► Supervisor
    Supervisor: checks tasks/in-progress/ for state
    Supervisor: no task in progress → picks from tasks/queue/, moves to in-progress/
    Supervisor: adds status section to task file (attempt: 1)
    Supervisor: deletes any stale worker-result.md
    Supervisor: returns (no ALL_DONE → orchestrator continues)

Round 1 (worker call):
  Orchestrator ──invoke──► Worker
    Worker: finds the task file in tasks/in-progress/ (the .md that isn't worker-result.md or README.md)
    Worker: reads the task file for instructions
    Worker: executes the entire task (code, terminal, search, etc.)
    Worker: writes result to tasks/in-progress/worker-result.md
    Worker: returns summary to orchestrator

Round 2 (supervisor call):
  Orchestrator ──invoke──► Supervisor
    Supervisor: finds worker-result.md → evaluates worker's output
    Supervisor: decides next step:
      a) Work acceptable → moves task file to done/, picks next task, moves it to in-progress/
      b) Work needs fixes → appends notes from worker-result to the task file, increments attempt, deletes worker-result.md
      c) All tasks complete → responds with ALL_DONE

Round 2 (worker call, if not ALL_DONE):
  Orchestrator ──invoke──► Worker
    ... (same pattern as above)

... loop continues until supervisor returns ALL_DONE ...
```

**Expected round-trips per task: 3 agent invocations** (supervisor→worker→supervisor for the happy path, plus an optional fix cycle adding 2 more).

## File-Based Communication

### Files in `tasks/in-progress/`

| File | Written by | Read by | Purpose |
|------|-----------|---------|---------|
| `*.md` (task file) | User (originally), Supervisor (adds status/notes) | Worker, Supervisor | The task itself IS the worker's instructions |
| `worker-result.md` | Worker | Supervisor | Worker's execution result/report |

**There is no `worker-prompt.md`.** The task file is the single source of truth. The supervisor enriches it with status tracking and notes from previous attempts directly.

### Task File Format (as placed in queue by user)

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

### Task File Format (after supervisor moves to in-progress)

The supervisor appends a status section:

```markdown
---
title: "Implement user authentication"
priority: 1
---

## Description
Add JWT-based authentication to the API.

## Requirements
- Login endpoint at POST /auth/login
- ...

## Acceptance Criteria
- [ ] Login returns a JWT token
- ...

---
## Status
- **Attempt:** 1
- **Moved to in-progress:** 2026-03-25
```

### Task File Format (after a failed attempt — supervisor appends notes)

```markdown
---
## Status
- **Attempt:** 2
- **Moved to in-progress:** 2026-03-25

## Notes from attempt 1
- Server starts but GET /health returns 404 — route was not registered
- Tests were not added
- Worker should check route registration order and add integration tests
```

### `worker-result.md` Format

```markdown
---
task: "001-hello-world-api"
status: "completed" | "failed" | "partial"
---

## Summary
Created Express server with health and greeting endpoints.

## Changes Made
- Created demo-api/package.json with express dependency
- Created demo-api/index.js with all endpoints
- Added start script

## Test Results
- Server starts successfully on port 3000
- All endpoints return expected responses

## Issues
None.
```

## Task Queue — File-Based

```
tasks/
  queue/         ← pending tasks (user adds .md files here)
  in-progress/   ← exactly one task file + optionally worker-result.md
  done/          ← completed task files (moved by supervisor)
```

Tasks are picked in alphabetical order. The supervisor moves the task file itself between folders. No copies, no backups.

## Agent Specifications

### 1. Orchestrator (`orchestrator.agent.md`)

**Purpose:** Iterative loop driver. Never thinks, never plans. Alternates between calling the supervisor and the worker in a fixed pattern.

**Tools:** `agent`, `mcp-tools-win/confirm_conversation_finished`

**Behavior:**
1. Invoke `supervisor` with one fixed prompt: *"Process tasks. Check tasks/in-progress/ for current state."*
2. Check supervisor response for `ALL_DONE`:
   - If `ALL_DONE` found: Call `confirm_conversation_finished` and stop
   - Otherwise: Invoke `worker` with fixed prompt to read the task file and execute
3. After worker returns, go to step 1

**Key property:** The orchestrator sends the same fixed prompt every time. No signal parsing, no differentiated prompts. The only check is whether the supervisor said `ALL_DONE`. Each loop iteration is identical in token cost.

### 2. Supervisor (`supervisor.agent.md`)

**Purpose:** Task lifecycle manager and progress evaluator. Manages the task queue, adds status information to task files, reviews worker results, and decides whether tasks are done or need another attempt.

**Tools:** `read`, `edit`, `execute`, `search`, `todo`, `mcp-tools-win/ask_user`

**Note:** The supervisor does NOT have the `agent` tool. It cannot spawn sub-agents. All delegation happens through file-based communication, with the orchestrator acting as the intermediary.

**Behavior (inferred from filesystem state each invocation):**
1. If `worker-result.md` exists in `tasks/in-progress/` → review the result, accept or request retry
2. If a task file is in `tasks/in-progress/` with no result → worker hasn't run yet, return and let the orchestrator invoke the worker
3. If nothing in `tasks/in-progress/` → pick next task from `tasks/queue/`, move it, add status section
4. If queue is empty and nothing in progress → respond with `ALL_DONE`

**On accepting work:** Move the task file to `tasks/done/`, delete `worker-result.md`, then pick next task if any.

**On requesting retry:** Append notes from `worker-result.md` to the task file (what failed, what to try differently), increment the attempt counter, delete `worker-result.md`. The worker will read the updated task file on its next invocation.

**Maximum 2 attempts per task.** If attempt 2 still fails, accept as-is and move on.

### 3. Worker (`worker.agent.md`)

**Purpose:** Full-task executor with full tool access. Reads the task file from `tasks/in-progress/`, executes the entire task in one pass, writes results to `worker-result.md`.

**Tools:** `vscode`, `execute`, `read`, `edit`, `search`, `web`, `browser`, `mcp-tools-win/ask_user`, `todo`

**Note:** The worker does NOT have the `agent` tool. It cannot spawn sub-agents.

**Model:** Claude Opus 4.6 (copilot)

**Behavior:**
1. Find the task file in `tasks/in-progress/` (the `.md` file that is NOT `worker-result.md` or `README.md`)
2. Read the task file for instructions, requirements, and acceptance criteria
3. If the task has a "Notes from attempt N" section, use that information to avoid repeating failed approaches
4. Execute the entire task using all available tools
5. Write result/report to `tasks/in-progress/worker-result.md`
6. Return a brief summary to the orchestrator

## Implementation Steps

1. Create `tasks/queue/`, `tasks/in-progress/`, `tasks/done/` folder structure
2. Create `orchestrator.agent.md` — the fixed alternating loop driver
3. Create `supervisor.agent.md` — the task lifecycle manager (no agent tool, no worker-prompt.md)
4. Create `worker.agent.md` — the full-task executor (reads task file directly, no agent tool)
5. Add an example task in `tasks/queue/` to demonstrate the system
6. Update `agents.txt` with new agent locations

## Context Window Analysis

| Agent        | Context per iteration | Grows over time? |
|-------------|----------------------|------------------|
| Orchestrator | ~fixed (same prompts + short response check) | No — each subagent call is independent |
| Supervisor   | Worker result + task file | No — fresh invocation each round, state inferred from filesystem |
| Worker       | Task file contents | No — fresh per invocation |

The orchestrator's context is bounded because:
- It sends the same fixed prompt to the supervisor and worker every time
- It only checks for `ALL_DONE` in the supervisor's response — no signal parsing needed
- The `confirm_conversation_finished` tool resets the loop by getting fresh user input
- All accumulated state (results, task progress) lives in files, not in any agent's context

## Design Principles

| Aspect | Design Choice | Rationale |
|--------|--------------|-----------|
| Signal protocol | Single stop-word (`ALL_DONE`), continue is implicit | Default path requires zero special output; only one failure mode |
| Orchestrator prompts | One fixed prompt always | Supervisor determines action from filesystem, not from orchestrator hints |
| Task decomposition | One worker turn per task, optional fix turn | Worker (Claude Opus 4.6) can handle complex multi-file tasks in one shot |
| Communication | Task file IS the instructions (no worker-prompt.md) | Eliminates an indirection layer; supervisor annotates the task file directly |
| State management | Filesystem-based, inferred from file presence | Supervisor checks what exists in tasks/in-progress/ each invocation |
| Retry info | Appended to task file as notes | Worker sees what failed previously and can try a different approach |
| Round trips per task | 3 agent invocations (happy path) | supervisor → worker → supervisor; optional fix adds 2 more |
