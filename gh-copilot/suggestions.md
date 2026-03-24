# Suggestions: Agent System Improvements

Based on testing feedback, two core problems were identified:

1. **Unreliable signal protocol** — Both supervisor and worker frequently failed to return the expected `SIGNAL: ...` line, confusing the orchestrator.
2. **Multi-turn subtask sprawl** — The supervisor decomposed tasks into many small subtasks, each requiring a supervisor↔worker round trip. This caused confusion about progress and wasted turns.

---

## Suggestion 1: Eliminate the Signal Protocol — Use Implicit Alternation

### Problem

The orchestrator relies on the supervisor returning an exact `SIGNAL: CALL_WORKER`, `SIGNAL: TASK_DONE`, or `SIGNAL: ALL_DONE` line. In practice, LLMs frequently omit, rephrase, or bury these signals, causing the orchestrator to enter error-recovery loops or stall.

### Root Cause

The orchestrator already knows who to call next — it always alternates between supervisor and worker. Three distinct signals are unnecessary overhead that creates failure modes.

### Proposed Change

**Replace the three-signal protocol with a single stop-word approach:**

- The orchestrator **always** alternates: supervisor → worker → supervisor → worker → ...
- The supervisor's response is assumed to mean "call the worker next" **unless** it contains the exact phrase `ALL_DONE` (on its own line).
- `TASK_DONE` is eliminated as a separate signal. When a task finishes but more remain in the queue, the supervisor prepares the next worker-prompt and the orchestrator calls the worker as usual.
- `CALL_WORKER` is eliminated entirely — it's the implicit default.

**Impact on each agent:**

| Agent | Change |
|-------|--------|
| **Orchestrator** | Simplify loop: call supervisor, check for `ALL_DONE`, if not found call worker, repeat. Remove all signal-parsing logic and unrecognized-signal recovery. |
| **Supervisor** | Remove the `SIGNAL:` protocol section. Only instruction needed: "When all tasks in the queue are complete and no work remains, respond with `ALL_DONE` on its own line." |
| **Worker** | No change needed — the worker never produced signals; it just writes `worker-result.md` and returns a summary. |

**Why this is more reliable:**

- The default path (continue working) requires **zero special output** from the supervisor.
- Only **one** special case to remember: say `ALL_DONE` when the queue is empty.
- The orchestrator's logic collapses to: `if "ALL_DONE" in response → stop, else → call worker`.
- No error-recovery for unrecognized signals needed — the only failure mode is a false `ALL_DONE`, which is extremely unlikely.

---

## Suggestion 2: One-Turn Worker Tasks — No Multi-Step Decomposition

### Problem

The supervisor broke tasks into 3–5 subtasks (e.g., "init project", "create server", "add endpoints", "add tests"), each requiring a full supervisor→worker round trip. The worker would complete one subtask and return, then the supervisor would have to restore context, evaluate the result, and issue the next subtask. This led to:

- Confusion about which step was current
- Redundant context loading each round
- State drift between `supervisor-state.md` and actual file system state
- A simple "hello world API" task taking 8+ agent invocations

### Proposed Change

**Each worker invocation handles a complete task, not a subtask.**

The supervisor's role changes from "decompose into N subtasks and manage N round-trips" to:

1. **Pick the task** from the queue.
2. **Write a single, comprehensive worker-prompt** that contains the full task brief — all requirements, context, and acceptance criteria in one document.
3. **Let the worker execute the entire task** in one turn.
4. **Review the result** and either:
   - **Accept** → move task to `done/`, pick next task (or `ALL_DONE`)
   - **Request fixes** → write a new worker-prompt with specific corrections, get one more worker turn

The maximum expected round-trips per task becomes **2** (one for the main work, one optional for fixes) instead of **N** (one per subtask).

**Impact on the flow:**

```
BEFORE (multi-subtask):
  supervisor → worker(subtask 1) → supervisor → worker(subtask 2) → supervisor → worker(subtask 3) → supervisor → worker(subtask 4) → supervisor
  = 9 agent invocations for a simple task

AFTER (single-turn):
  supervisor → worker(full task) → supervisor [→ worker(fixes) → supervisor]
  = 3–5 agent invocations for a simple task
```

**Impact on file-based communication:**

| File | Change |
|------|--------|
| `worker-prompt.md` | Contains the **full task brief** instead of a subtask slice. No more `subtask: 2, total_subtasks: 4` metadata — just `task` and `title`. |
| `worker-result.md` | No change — still a report of what was done. |
| `supervisor-state.md` | **Drastically simplified or eliminated.** No subtask index or plan tracking needed. If retained, it only tracks: current task name, status (`worker_prompted` / `reviewing_result` / `fix_requested`), and attempt count. |

**Revised worker-prompt.md format:**

```markdown
---
task: "001-hello-world-api"
title: "Create a hello world Express.js API"
attempt: 1
---

## Instructions
Create a minimal Express.js REST API in a `demo-api/` folder at the workspace root.

## Requirements
- Initialize a new Node.js project with package.json
- Install Express.js as a dependency
- Create a single index.js entry point
- GET / returns { "message": "Hello, world!" }
- GET /health returns { "status": "ok", "timestamp": "<ISO date>" }
- Add a start script in package.json

## Acceptance Criteria
- [ ] demo-api/package.json exists with express dependency
- [ ] demo-api/index.js implements both endpoints
- [ ] Running npm start in demo-api/ starts the server on port 3000
```

**Revised supervisor-state.md format (if kept):**

```markdown
---
current_task: "001-hello-world-api"
current_task_file: "tasks/in-progress/001-hello-world-api.md"
status: "worker_prompted"
attempt: 1
---
```

Or consider **eliminating `supervisor-state.md` entirely** — the supervisor can infer state by checking what files exist in `tasks/in-progress/`:
- Task `.md` exists + no `worker-result.md` → worker hasn't run yet, re-prompt
- Task `.md` exists + `worker-result.md` exists → evaluate the result
- No task `.md` → pick from queue

---

## Suggestion 3: Revised Orchestrator Loop (Incorporating Both Changes)

The orchestrator becomes radically simpler:

```
loop:
  1. Invoke supervisor:
       "Process the next task or review the worker's result.
        Check tasks/in-progress/ for current state."
  2. If supervisor response contains "ALL_DONE" → finish
  3. Invoke worker:
       "Read tasks/in-progress/worker-prompt.md and execute the task.
        Write your result to tasks/in-progress/worker-result.md."
  4. Go to 1
```

**Orchestrator prompt changes:**
- Remove all signal-parsing logic (the three-signal protocol, unrecognized signal counters, etc.)
- Remove differentiated supervisor prompts (first-call vs. post-worker vs. post-failure). Use **one fixed prompt** for the supervisor every time — the supervisor infers what to do from the file state.
- Keep `round_count` and `max_rounds` as a safety valve, but simplify: just count total loop iterations.

---

## Suggestion 4: Supervisor Prompt — Key Wording Changes

To prevent the supervisor from over-decomposing:

**Add explicitly to `supervisor.agent.md`:**

> **CRITICAL: One task = one worker turn.** Do NOT break tasks into multiple subtasks. Write a single, comprehensive worker-prompt that the worker can complete in one invocation. The worker is a powerful coding agent (Claude Opus 4.6) capable of handling complex multi-file tasks in one shot.
>
> The ONLY reason to require a second worker turn is if the first attempt had specific failures that need targeted fixes. Even then, the fix prompt should be self-contained.

**Remove from `supervisor.agent.md`:**
- All subtask decomposition instructions (steps about "break into subtasks", subtask indexing, etc.)
- The `current_subtask_index` / `total_subtasks` tracking in state file
- The "Completed Subtask Results" section
- References to "subtask" in the worker-prompt format

---

## Suggestion 5: Unified Supervisor Prompt from Orchestrator

Instead of three different prompts depending on context (first call, post-worker, post-failure), use a **single fixed prompt** every time. The supervisor determines what to do by examining the filesystem:

> "Process tasks. Check tasks/in-progress/ for current state."

The supervisor's logic:
1. Check if `worker-result.md` exists → review the result
2. Check if a task `.md` exists in `in-progress/` with no result → re-write the worker prompt (retry)
3. No task in progress → pick from `tasks/queue/`
4. Nothing in queue → `ALL_DONE`

This eliminates the problem of the orchestrator needing to track and convey state — the supervisor reads it from disk every time.

---

## Summary of Changes

| Aspect | Current | Proposed |
|--------|---------|----------|
| Signal protocol | 3 signals (`CALL_WORKER`, `TASK_DONE`, `ALL_DONE`) | 1 stop-word (`ALL_DONE`), continue is implicit |
| Orchestrator prompts | 3 different prompts depending on context | 1 fixed prompt always |
| Task decomposition | N subtasks per task (3–5 typical) | 1 worker turn per task, optional fix turn |
| Round trips per task | 2N+1 agent invocations | 3–5 agent invocations |
| `supervisor-state.md` | Tracks subtask index, plan, results history | Minimal or eliminated — state inferred from files |
| Orchestrator complexity | Signal parsing, error recovery, differentiated prompts | Simple alternation loop with ALL_DONE check |
| Worker changes | None needed | None needed |

---

## Files to Modify

1. **`agents/orchestrator.agent.md`** — Simplify loop, remove signal parsing, use single fixed prompt
2. **`agents/supervisor.agent.md`** — Remove subtask decomposition, add one-turn-per-task rule, simplify state management, reduce signal protocol to ALL_DONE only
3. **`agents/worker.agent.md`** — No changes needed (already correct)
4. **`PLAN.md`** — Update architecture description, loop diagram, file formats, and agent specs to reflect the simplified design
