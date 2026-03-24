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
│  • Iterative loop driver:                           │
│      1. Invoke supervisor → gets worker prompt      │
│      2. Invoke worker → pointing at prompt file     │
│      3. Invoke supervisor → reads result, decides   │
│      4. Repeat until supervisor says "ALL_DONE"     │
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
│  • Plans subtasks  │ │  • Reads worker-prompt.md   │
│  • Writes worker   │ │  • Executes the subtask     │
│    prompt file     │ │  • Writes worker-result.md  │
│  • Writes own      │ │  • Returns summary          │
│    state file      │ │                             │
│  • Reads worker    │ └─────────────────────────────┘
│    results         │
│  • Decides next    │
│    step            │
└────────────────────┘

Communication between supervisor and worker is file-based:

  Supervisor writes  ──►  tasks/in-progress/worker-prompt.md
  Worker reads       ◄──  tasks/in-progress/worker-prompt.md
  Worker writes      ──►  tasks/in-progress/worker-result.md
  Supervisor reads   ◄──  tasks/in-progress/worker-result.md

Supervisor persists its own state across rounds:

  Supervisor writes/reads ◄──► tasks/in-progress/supervisor-state.md
```

## Iterative Loop — Step by Step

```
Round 1 (first supervisor call):
  Orchestrator ──invoke──► Supervisor
    Supervisor: reads tasks/queue/, picks task, moves to in-progress/
    Supervisor: breaks task into subtasks, writes plan to supervisor-state.md
    Supervisor: writes first subtask prompt to worker-prompt.md
    Supervisor: returns {action: "CALL_WORKER"} to orchestrator

Round 1 (worker call):
  Orchestrator ──invoke──► Worker
    Worker: reads worker-prompt.md
    Worker: executes the subtask (code, terminal, search, etc.)
    Worker: writes result to worker-result.md
    Worker: returns summary to orchestrator

Round 2 (supervisor call):
  Orchestrator ──invoke──► Supervisor
    Supervisor: reads supervisor-state.md (picks up where it left off)
    Supervisor: reads worker-result.md (evaluates worker's output)
    Supervisor: decides next step:
      a) More subtasks remain → writes next worker-prompt.md, returns {action: "CALL_WORKER"}
      b) Task complete → moves task to done/, cleans up state files, returns {action: "TASK_DONE"}
      c) All tasks complete → returns {action: "ALL_DONE"}

Round 2 (worker call, if needed):
  Orchestrator ──invoke──► Worker
    ... (same pattern as above)

... loop continues until supervisor returns ALL_DONE ...
```

## File-Based Communication Mechanism

### Communication Files (in `tasks/in-progress/`)

| File | Written by | Read by | Purpose |
|------|-----------|---------|---------|
| `worker-prompt.md` | Supervisor | Worker | Contains the subtask instructions for the worker |
| `worker-result.md` | Worker | Supervisor | Contains the worker's execution result/report |
| `supervisor-state.md` | Supervisor | Supervisor | Supervisor's persistent state across rounds |

### `worker-prompt.md` Format

```markdown
---
task: "001-hello-world-api"
subtask: 2
total_subtasks: 4
title: "Create Express server with health endpoint"
---

## Instructions
Create a basic Express.js server in src/index.ts with:
- Listen on port 3000
- GET /health returns { status: "ok" }

## Context
- We are building a Hello World REST API
- Previous subtask created the project scaffolding and package.json
- TypeScript is already configured

## Acceptance Criteria
- [ ] Server starts without errors
- [ ] GET /health returns 200 with JSON body
```

### `worker-result.md` Format

```markdown
---
task: "001-hello-world-api"
subtask: 2
status: "completed"
---

## Summary
Created Express server in src/index.ts with health endpoint.

## Changes Made
- Created src/index.ts with Express app
- Added GET /health route returning { status: "ok" }
- Server listens on port 3000

## Test Results
- Server starts successfully
- GET /health returns 200 with { status: "ok" }

## Issues
None.
```

### `supervisor-state.md` Format

```markdown
---
current_task: "001-hello-world-api"
current_task_file: "tasks/in-progress/001-hello-world-api.md"
current_subtask_index: 2
total_subtasks: 4
status: "waiting_for_worker_result"
---

## Task Plan
1. [x] Initialize project scaffolding (npm init, tsconfig, dependencies)
2. [ ] Create Express server with health endpoint ← CURRENT (sent to worker)
3. [ ] Add greeting endpoints (GET /hello, GET /hello/:name)
4. [ ] Add tests and verify all acceptance criteria

## Completed Subtask Results
### Subtask 1: Initialize project scaffolding
- Status: completed
- Created package.json, tsconfig.json, installed express + typescript
```

## Task Queue — File-Based

Tasks are markdown files placed in a folder structure:

```
tasks/
  queue/         ← pending tasks (user adds .md files here)
  in-progress/   ← task currently being worked on (moved by supervisor)
                   also contains: worker-prompt.md, worker-result.md, supervisor-state.md
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

**Purpose:** Iterative loop driver. Never thinks, never plans. Alternates between calling the supervisor and the worker based on the supervisor's return signal.

**Tools:** `agent`, `mcp-tools-win/confirm_conversation_finished`

**Behavior:**
1. Invoke `supervisor` with: *"Start or continue processing tasks. Read your state file if it exists."*
2. Read the supervisor's return value:
   - If `CALL_WORKER`: Invoke `worker` with: *"Read tasks/in-progress/worker-prompt.md and execute the subtask. Write your result to tasks/in-progress/worker-result.md."*
   - If `TASK_DONE`: Loop back to step 1 for the next task
   - If `ALL_DONE`: Call `confirm_conversation_finished` with final summary and stop
3. After worker returns, loop back to step 1 (supervisor reads the result next round)

**Key property:** The orchestrator's outgoing prompts are always roughly the same size. It never accumulates task details, plans, or history. Each loop iteration is identical in token cost. It acts purely as a dispatcher based on the supervisor's signal.

### 2. Supervisor (`supervisor.agent.md`)

**Purpose:** Task planner, progress evaluator, and decision-maker. Communicates with the worker exclusively through files.

**Tools:** `read`, `edit`, `execute`, `search`, `todo`, `mcp-tools-win/ask_user`

**Note:** The supervisor does NOT have the `agent` tool. It cannot spawn sub-agents. All delegation happens through file-based communication, with the orchestrator acting as the intermediary.

**Behavior (first call — no state file exists):**
1. List files in `tasks/queue/`
2. If no tasks remain, return `ALL_DONE`
3. Pick the first task file (alphabetical/priority)
4. Move it to `tasks/in-progress/`
5. Read the task file and break it into ordered subtasks
6. Write the plan and current position to `tasks/in-progress/supervisor-state.md`
7. Write the first subtask instructions to `tasks/in-progress/worker-prompt.md`
8. Return `CALL_WORKER` to the orchestrator

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
2. Create `orchestrator.agent.md` — the iterative loop driver
3. Create `supervisor.agent.md` — the task planner and progress evaluator (no agent tool)
4. Create `worker.agent.md` — the single-subtask executor (no agent tool)
5. Add an example task in `tasks/queue/` to demonstrate the system
6. Update `agents.txt` with new agent locations

## Context Window Analysis

| Agent        | Context per iteration | Grows over time? |
|-------------|----------------------|------------------|
| Orchestrator | ~fixed (same prompts + short signal) | No — each subagent call is independent |
| Supervisor   | State file + worker result + task file | No — fresh invocation each round, state restored from file |
| Worker       | worker-prompt.md contents | No — fresh per subtask |

The orchestrator's context is bounded because:
- It sends the same fixed prompts to the supervisor and worker each time
- It only reads the supervisor's short return signal (`CALL_WORKER`, `TASK_DONE`, `ALL_DONE`)
- The `confirm_conversation_finished` tool resets the loop by getting fresh user input
- All accumulated state (plans, subtask history, results) lives in files, not in any agent's context

## Comparison: Recursive vs Iterative

| Aspect | Recursive (old) | Iterative (current) |
|--------|-----------------|---------------------|
| Sub-agent depth | 2 (orchestrator→supervisor→worker) | 1 (orchestrator→supervisor OR orchestrator→worker) |
| Supervisor↔Worker communication | Direct invocation + return values | File-based (worker-prompt.md / worker-result.md) |
| Supervisor state across subtasks | Held in context (single long-running call) | Persisted to supervisor-state.md, restored each round |
| Orchestrator role | Simple loop (call supervisor, confirm) | Dispatcher loop (alternate supervisor↔worker based on signal) |
| Compatibility | Requires depth-2 recursion | Works within depth-1 recursion limit |
