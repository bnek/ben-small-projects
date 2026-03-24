# Multi-Level Agent Delegation System — Implementation Plan

## Overview

A three-tier agent delegation system where the top-level orchestrator runs indefinitely without consuming its own context window. All planning, reasoning, and execution happen in disposable sub-agent invocations.

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
│  • Loop: invoke supervisor → confirm → repeat       │
│  • Passes a static prompt every time                │
│  • Context window stays flat — runs indefinitely    │
└──────────────┬──────────────────────────────────────┘
               │ invokes
               ▼
┌─────────────────────────────────────────────────────┐
│  SUPERVISOR  (supervisor.agent.md)                  │
│  ─────────────────────────────────────────────────  │
│  • Reads next pending task from tasks/queue/        │
│  • Breaks it into ordered subtasks                  │
│  • Delegates each subtask to a worker agent         │
│  • Moves completed task .md to tasks/done/          │
│  • Reports summary back to orchestrator             │
└──────────────┬──────────────────────────────────────┘
               │ invokes (per subtask)
               ▼
┌─────────────────────────────────────────────────────┐
│  WORKER  (worker.agent.md)                          │
│  ─────────────────────────────────────────────────  │
│  • Full tool access (code, search, edit, terminal)  │
│  • Executes a single subtask                        │
│  • Returns result to supervisor                     │
└─────────────────────────────────────────────────────┘
```

## Task Queue — File-Based

Tasks are markdown files placed in a folder structure:

```
tasks/
  queue/         ← pending tasks (user adds .md files here)
  in-progress/   ← task currently being worked on (moved by supervisor)
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

**Purpose:** Infinite loop driver. Never thinks, never plans.

**Tools:** `agent`, `mcp-tools-win/confirm_conversation_finished`

**Behavior:**
1. Invoke `supervisor` with a fixed prompt: *"Process the next pending task from the tasks/queue/ folder."*
2. After supervisor returns, call `confirm_conversation_finished` with the supervisor's summary
3. If user provides new instructions, pass them as the next supervisor invocation
4. If user confirms done, stop
5. Repeat from step 1

**Key property:** The orchestrator's outgoing prompt is always roughly the same size. It never accumulates task details, plans, or history. Each loop iteration is identical in token cost.

### 2. Supervisor (`supervisor.agent.md`)

**Purpose:** Task planner and subtask delegator.

**Tools:** `agent`, `read`, `edit`, `execute`, `search`, `todo`, `mcp-tools-win/ask_user`

**Behavior:**
1. List files in `tasks/queue/`
2. Pick the first task file (alphabetical/priority)
3. Move it to `tasks/in-progress/`
4. Read the task file and break it into subtasks
5. For each subtask, invoke the `worker` agent with a detailed prompt
6. After all subtasks complete, move the task file to `tasks/done/`
7. Update the task file with completion notes
8. Return a summary to the orchestrator

### 3. Worker (`worker.agent.md`)

**Purpose:** Single-subtask executor with full tool access.

**Tools:** `vscode`, `execute`, `read`, `agent`, `edit`, `search`, `web`, `browser`, `mcp-tools-win/ask_user`, `todo`

**Model:** Claude Opus 4.6 (copilot)

**Behavior:**
1. Receive a subtask prompt from supervisor
2. Execute the subtask using all available tools
3. Return result summary to supervisor

## MCP Tool Addition: `pick_next_task`

A new MCP tool to atomically pick the next task from the queue:
- Lists `tasks/queue/`, picks first file alphabetically
- Moves it to `tasks/in-progress/`
- Returns the file content

This avoids race conditions and keeps the supervisor's logic simple. However, since this is a single-user local system, this is optional — the supervisor can use file tools directly.

**Decision:** Skip the MCP tool for now. The supervisor's `read` and `execute` tools can handle file listing and moving. Keep it simple.

## Implementation Steps

1. Create `tasks/queue/`, `tasks/in-progress/`, `tasks/done/` folder structure
2. Create `orchestrator.agent.md` — the infinite loop driver
3. Create `supervisor.agent.md` — the task planner and delegator
4. Create `worker.agent.md` — the single-subtask executor
5. Add an example task in `tasks/queue/` to demonstrate the system
6. Update `agents.txt` with new agent locations

## Context Window Analysis

| Agent        | Context per iteration | Grows over time? |
|-------------|----------------------|------------------|
| Orchestrator | ~fixed (same prompt) | No — each subagent call is independent |
| Supervisor   | Task file + subtask results | No — fresh per task |
| Worker       | Single subtask prompt | No — fresh per subtask |

The orchestrator's context is bounded because:
- It sends the same fixed prompt to the supervisor each time
- It only reads the supervisor's return summary (briefly) before discarding it via `confirm_conversation_finished`
- The `confirm_conversation_finished` tool resets the loop by getting fresh user input
