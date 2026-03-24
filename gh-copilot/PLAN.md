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
│      3. Invoke worker → pointing at prompt file     │
│      4. Go to 1                                     │
│  • Context window stays flat — runs indefinitely    │
└──────────┬──────────────────┬───────────────────────┘
           │                  │
     invokes (plan)     invokes (execute)
           │                  │
           ▼                  ▼
┌────────────────────┐ ┌─────────────────────────────┐
│  SUPERVISOR        │ │  WORKER                     │
│  (supervisor       │ │  (worker.agent.md)          │
│   .agent.md)       │ │                             │
│  ────────────────  │ │  ───────────────────────    │
│  • Reads task queue│ │  • Full tool access         │
│  • Writes one      │ │  • Reads worker-prompt.md   │
│    comprehensive   │ │  • Executes entire task     │
│    worker prompt   │ │  • Writes worker-result.md  │
│  • Reviews worker  │ │  • Returns summary          │
│    results         │ │                             │
│  • Decides next    │ └─────────────────────────────┘
│    step or ALL_DONE│
└────────────────────┘

Communication between supervisor and worker is file-based:

  Supervisor writes  ──►  tasks/in-progress/worker-prompt.md
  Worker reads       ◄──  tasks/in-progress/worker-prompt.md
  Worker writes      ──►  tasks/in-progress/worker-result.md
  Supervisor reads   ◄──  tasks/in-progress/worker-result.md
```

## Iterative Loop — Step by Step

```
Round 1 (supervisor call):
  Orchestrator ──invoke──► Supervisor
    Supervisor: checks tasks/in-progress/ for state
    Supervisor: no task in progress → picks from tasks/queue/, moves to in-progress/
    Supervisor: writes comprehensive worker-prompt.md for the full task
    Supervisor: returns (no ALL_DONE → orchestrator continues)

Round 1 (worker call):
  Orchestrator ──invoke──► Worker
    Worker: reads worker-prompt.md
    Worker: executes the entire task (code, terminal, search, etc.)
    Worker: writes result to worker-result.md
    Worker: returns summary to orchestrator

Round 2 (supervisor call):
  Orchestrator ──invoke──► Supervisor
    Supervisor: finds worker-result.md → evaluates worker's output
    Supervisor: decides next step:
      a) Work acceptable → moves task to done/, picks next task, writes worker-prompt.md
      b) Work needs fixes → writes new worker-prompt.md with corrections (attempt 2)
      c) All tasks complete → responds with ALL_DONE

Round 2 (worker call, if not ALL_DONE):
  Orchestrator ──invoke──► Worker
    ... (same pattern as above)

... loop continues until supervisor returns ALL_DONE ...
```

**Expected round-trips per task: 3–5 agent invocations** (supervisor→worker→supervisor for the happy path, plus an optional fix cycle).

## File-Based Communication Mechanism

### Communication Files (in `tasks/in-progress/`)

| File | Written by | Read by | Purpose |
|------|-----------|---------|---------|
| `worker-prompt.md` | Supervisor | Worker | Contains the full task instructions for the worker |
| `worker-result.md` | Worker | Supervisor | Contains the worker's execution result/report |

Note: No `supervisor-state.md` is needed. The supervisor infers its state from the filesystem each time it is invoked.

### `worker-prompt.md` Format

```markdown
---
task: "001-hello-world-api"
title: "Create a hello world Express.js API"
attempt: 1
---

## Instructions
Full, detailed instructions for the entire task.

## Requirements
- All requirements, concrete and actionable
- The worker should be able to complete everything in one pass

## Acceptance Criteria
- [ ] Specific verifiable criteria
```

### `worker-result.md` Format

```markdown
---
task: "001-hello-world-api"
status: "completed"
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

Tasks are markdown files placed in a folder structure:

```
tasks/
  queue/         ← pending tasks (user adds .md files here)
  in-progress/   ← task currently being worked on (moved by supervisor)
                   also contains: worker-prompt.md, worker-result.md
  done/          ← completed tasks (moved by supervisor)
```

### Task File Format

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

Tasks are picked in alphabetical/priority order. The supervisor moves them between folders to track state.

## Agent Specifications

### 1. Orchestrator (`orchestrator.agent.md`)

**Purpose:** Iterative loop driver. Never thinks, never plans. Alternates between calling the supervisor and the worker in a fixed pattern.

**Tools:** `agent`, `mcp-tools-win/confirm_conversation_finished`

**Behavior:**
1. Invoke `supervisor` with one fixed prompt: *"Process tasks. Check tasks/in-progress/ for current state."*
2. Check supervisor response for `ALL_DONE`:
   - If `ALL_DONE` found: Call `confirm_conversation_finished` and stop
   - Otherwise: Invoke `worker` with fixed prompt to execute the task
3. After worker returns, go to step 1

**Key property:** The orchestrator sends the same fixed prompt every time. No signal parsing, no differentiated prompts. The only check is whether the supervisor said `ALL_DONE`. Each loop iteration is identical in token cost.

### 2. Supervisor (`supervisor.agent.md`)

**Purpose:** Task planner, progress evaluator, and decision-maker. Communicates with the worker exclusively through files. Writes one comprehensive worker prompt per task (no subtask decomposition).

**Tools:** `read`, `edit`, `execute`, `search`, `todo`, `mcp-tools-win/ask_user`

**Note:** The supervisor does NOT have the `agent` tool. It cannot spawn sub-agents. All delegation happens through file-based communication, with the orchestrator acting as the intermediary.

**Behavior (inferred from filesystem state each invocation):**
1. If `worker-result.md` exists → review the result, accept or request fixes
2. If a task file is in `tasks/in-progress/` with no result → re-write the worker prompt
3. If nothing in progress → pick next task from `tasks/queue/`, write comprehensive worker prompt
4. If queue is empty and nothing in progress → respond with `ALL_DONE`

### 3. Worker (`worker.agent.md`)

**Purpose:** Full-task executor with full tool access. Reads instructions from a file, executes the entire task in one pass, writes results to a file.

**Tools:** `vscode`, `execute`, `read`, `edit`, `search`, `web`, `browser`, `mcp-tools-win/ask_user`, `todo`

**Note:** The worker does NOT have the `agent` tool. It cannot spawn sub-agents.

**Model:** Claude Opus 4.6 (copilot)

**Behavior:**
1. Read `tasks/in-progress/worker-prompt.md` for task instructions
2. Execute the entire task using all available tools
3. Write result/report to `tasks/in-progress/worker-result.md`
4. Return a brief summary to the orchestrator

**Behavior (subsequent calls — state file exists):**
1. Read `tasks/in-progress/supervisor-state.md` to restore context
2. Read `tasks/in-progress/worker-result.md` to evaluate the worker's output
3. Update state file with the subtask result
4. Decide next step:
   - **More subtasks remain:** Write next subtask to `worker-prompt.md`, update state, return `CALL_WORKER`
   - **All subtasks done:** Move task file to `tasks/done/`, update task file with completion notes, delete state/prompt/result files, check if more tasks in queue:
     - More tasks in queue → pick next task, write plan and first subtask, return `CALL_WORKER`
     - No more tasks → return `ALL_DONE`

### 3. Worker (`worker.agent.md`)

**Purpose:** Single-subtask executor with full tool access. Reads instructions from a file, executes, writes results to a file.

**Tools:** `vscode`, `execute`, `read`, `edit`, `search`, `web`, `browser`, `mcp-tools-win/ask_user`, `todo`

**Note:** The worker does NOT have the `agent` tool. It cannot spawn sub-agents.

**Model:** Claude Opus 4.6 (copilot)

**Behavior:**
1. Read `tasks/in-progress/worker-prompt.md` for subtask instructions
2. Execute the subtask using all available tools
3. Write result/report to `tasks/in-progress/worker-result.md`
4. Return a brief summary to the orchestrator

## Implementation Steps

1. Create `tasks/queue/`, `tasks/in-progress/`, `tasks/done/` folder structure
2. Create `orchestrator.agent.md` — the fixed alternating loop driver
3. Create `supervisor.agent.md` — the task planner and progress evaluator (no agent tool, no subtask decomposition)
4. Create `worker.agent.md` — the full-task executor (no agent tool)
5. Add an example task in `tasks/queue/` to demonstrate the system
6. Update `agents.txt` with new agent locations

## Context Window Analysis

| Agent        | Context per iteration | Grows over time? |
|-------------|----------------------|------------------|
| Orchestrator | ~fixed (same prompts + short response check) | No — each subagent call is independent |
| Supervisor   | Worker result + task file | No — fresh invocation each round, state inferred from filesystem |
| Worker       | worker-prompt.md contents | No — fresh per task |

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
| State management | Filesystem-based (no supervisor-state.md) | Supervisor infers state from what files exist in tasks/in-progress/ |
| Round trips per task | 3–5 agent invocations | Down from 9+ with multi-subtask approach |
