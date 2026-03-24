# PLAN.md Review — Reliability Analysis

## 1. Critical Discrepancy: Plan vs Current Implementation

The PLAN.md describes a new **iterative, file-based** architecture where the supervisor **does NOT have the `agent` tool** and communicates with the worker via files. However, the current `supervisor.agent.md` still lists `agent` in its tools and directly invokes the worker. The `orchestrator.agent.md` also still sends a prompt that tells the supervisor to "delegate each subtask to the worker agent" — implying direct invocation.

**Before implementing the plan, either:**
- (a) Fully rewrite the agent files to match the plan's iterative model, or
- (b) Clearly mark what is "current state" vs "target state" in PLAN.md

As written, any developer (or agent) reading both PLAN.md and the existing agent files would be confused about which protocol to follow.

---

## 2. Loop Hang / Infinite Loop Risks

### 2.1 Supervisor returns an unrecognized signal

The orchestrator expects exactly three signals: `CALL_WORKER`, `TASK_DONE`, `ALL_DONE`. But the supervisor is an LLM — it may return free-form text, a slightly different spelling (`Call_Worker`, `CALL WORKER`, `call_worker`), or embed the signal inside a longer sentence.

**Risk:** Orchestrator doesn't match the signal and hangs, enters an undefined state, or loops endlessly re-invoking the supervisor.

**Recommendation:**
- Define a strict signal protocol. Use a structured return format (e.g., the signal must appear as the **first line** of the response, alone, in exact uppercase).
- Add a fallback: if the orchestrator doesn't recognize the signal after N attempts, invoke `ask_user` to surface the issue.
- Consider returning signals in a structured frontmatter block (YAML) rather than relying on free-text matching.

### 2.2 Supervisor always returns `CALL_WORKER` (stuck subtask loop)

If the supervisor's state file gets corrupted or the supervisor misjudges progress, it could keep emitting `CALL_WORKER` indefinitely for the same subtask, never advancing.

**Recommendation:**
- Add a `max_rounds_per_task` or `max_subtasks_per_task` limit. The orchestrator should count rounds and bail out after a threshold (e.g., 20 rounds for a single task).
- The supervisor-state.md should include a `round_count` field that the supervisor increments each invocation.

### 2.3 Empty queue but supervisor doesn't return `ALL_DONE`

If the supervisor fails to check the queue (e.g., it goes straight to reading a stale state file), it might not realize there are no tasks and return `CALL_WORKER` for a non-existent task.

**Recommendation:**
- The orchestrator's prompt to the supervisor should explicitly differentiate between "start new" and "continue in progress" modes. Currently the plan says the supervisor infers this from whether `supervisor-state.md` exists, which is fragile.

---

## 3. Worker Failure Mid-Task

### 3.1 Worker crashes or returns without writing `worker-result.md`

If the worker fails, times out, or returns without writing the result file, the next supervisor invocation will either:
- Read a stale `worker-result.md` from a previous round
- Fail to find the file at all

**Risk:** The supervisor interprets old results as current, silently skipping the actual subtask. Or the supervisor errors out trying to read a missing file.

**Recommendations:**
- **Sequence numbers or timestamps:** Include a `round` or `timestamp` field in both `worker-prompt.md` and `worker-result.md`. The supervisor must verify the result file's sequence matches the prompt it issued.
- **Stale detection:** Before writing a new prompt, the supervisor should delete any existing `worker-result.md` to make it impossible to read stale data. The supervisor should check for the result file's existence and recency.
- **Worker failure signal:** The orchestrator should inspect the worker's return value. If it's empty, an error, or indicates failure, the orchestrator should pass a hint to the supervisor (e.g., invoke supervisor with "Worker failed or returned empty. Check state and decide how to proceed.").

### 3.2 Worker writes partial result

The worker might write `worker-result.md` but crash before finishing execution. The result file would exist but be incomplete or describe partial work.

**Recommendation:**
- The worker should write to a temp file (e.g., `worker-result.tmp.md`) and rename it to `worker-result.md` only after it finishes. This gives an atomic write semantic. However, since these are LLM agents (not traditional programs), this may be hard to enforce. At minimum, the supervisor should be instructed to treat results skeptically and verify work (e.g., check if files mentioned in the result actually exist).

---

## 4. State File Management Issues

### 4.1 Stale `supervisor-state.md` across tasks

The plan says the supervisor deletes state files after completing a task. But if a crash occurs between "move task to done" and "delete state files," the next supervisor invocation will find a stale state file pointing to a completed task.

**Recommendation:**
- The supervisor-state.md should include the task filename. On startup, the supervisor should verify that the referenced task file actually exists in `tasks/in-progress/`. If it doesn't (e.g., it's already in `done/`), the supervisor should discard the state and start fresh from the queue.
- Define a clear ordering for cleanup: (1) delete communication files, (2) delete state file, (3) move task to done. This way, if a crash happens after step 2, the supervisor starts fresh and re-evaluates the task in `in-progress/`.

### 4.2 Multiple task files in `in-progress/`

The plan assumes at most one task is in `in-progress/` at a time, but nothing enforces this. If a crash leaves a task file in `in-progress/` and the supervisor picks a new one from the queue, there could be two tasks in `in-progress/`.

**Recommendation:**
- On startup, the supervisor should check if any task `.md` files exist in `in-progress/` (excluding the communication/state files). If one exists, it should resume that task rather than picking from the queue.
- Alternatively, the supervisor should refuse to pick a new task if `in-progress/` already has a task file.

### 4.3 State file format evolution

If the plan for `supervisor-state.md` changes over time (new fields, restructured format), older state files could be misinterpreted.

**Recommendation:**
- Include a `schema_version: 1` field in the state file frontmatter. The supervisor should check this and handle version mismatches (likely by discarding and re-planning).

---

## 5. Signal Protocol Robustness

### 5.1 No structured return format

The plan says the supervisor returns `{action: "CALL_WORKER"}` but this is pseudo-notation. In practice, the supervisor (an LLM) will return natural language. The orchestrator (also an LLM) needs to parse the signal from the response.

**Risk:** LLM-to-LLM signal parsing is inherently unreliable. The supervisor might say "I need you to CALL_WORKER now" or "Next action: CALL_WORKER. The subtask is..." — the orchestrator has to extract the signal.

**Recommendations:**
- Mandate the signal on a **dedicated line** with a clear prefix, e.g.: `SIGNAL: CALL_WORKER`
- The orchestrator's instructions should say: "Look for a line starting with `SIGNAL:` and extract the value."
- Document all valid signal values exhaustively in both agent files.
- Consider adding an `UNKNOWN` or `ERROR` signal the supervisor can return if it's confused — the orchestrator should route this to `ask_user`.

### 5.2 `TASK_DONE` vs `ALL_DONE` ambiguity

What happens if the supervisor returns `TASK_DONE` but there are no more tasks in the queue? The plan says the orchestrator calls `confirm_conversation_finished` and then loops back to step 1. Step 1 re-invokes the supervisor, which would then find an empty queue and return `ALL_DONE`.

This means every batch ends with an extra unnecessary supervisor invocation. Minor, but wasteful.

**Recommendation:**
- Consider having the supervisor return `ALL_DONE` directly when it completes the last task and the queue is empty (the plan already implies this in the supervisor behavior section but the orchestrator's loop doesn't optimize for it).

### 5.3 Should `TASK_DONE` trigger `confirm_conversation_finished`?

The plan says the orchestrator calls `confirm_conversation_finished` when it sees `TASK_DONE`. This pauses the loop and asks the user for input after each task. For a queue of 10 tasks, the user gets prompted 10 times.

**Question:** Is this intentional? If so, it's a feature (user can add instructions between tasks). If not, it's disruptive.

**Recommendation:**
- Clarify intended behavior. Options:
  - (a) Prompt user after every task (current plan) — good for oversight, bad for autonomy
  - (b) Only prompt at `ALL_DONE` — fully autonomous, user reviews at the end
  - (c) Make it configurable (a flag in the task file or a global setting)

---

## 6. Recovery After Crash

### 6.1 Orchestrator crash

If the orchestrator crashes mid-loop, the user must restart it. The system's crash recovery depends entirely on the file state:

| Crash point | Files left behind | Recovery |
|---|---|---|
| After supervisor wrote prompt, before worker runs | `supervisor-state.md`, `worker-prompt.md` exist | Supervisor re-reads state, sees status: `waiting_for_worker_result`, but no result file exists. **Undefined behavior.** |
| After worker wrote result, before supervisor reads | `worker-result.md` exists | Supervisor reads result on next invocation. **Clean recovery.** |
| After supervisor marked task done, before cleanup | Task in `done/`, state files may or may not exist | Supervisor finds stale state. **Needs defensive check.** |

**Recommendation:**
- Define the `status` field in `supervisor-state.md` as a mini state machine:
  - `planning` — supervisor is decomposing the task
  - `worker_prompted` — prompt written, waiting for worker execution
  - `worker_completed` — result received, supervisor evaluating
  - `task_completing` — cleanup in progress
- On restart, the supervisor checks the status and either:
  - `worker_prompted` + no result file → re-send the same prompt (idempotent retry)
  - `worker_prompted` + result file exists → proceed to evaluation
  - `task_completing` → finish the cleanup

### 6.2 No explicit idempotency guarantees

The worker may be re-invoked for the same subtask after a crash. If the subtask was "create a file" and the file already exists, the worker might fail or duplicate work.

**Recommendation:**
- Worker instructions should emphasize **idempotent execution**: check if work is already done before doing it. This is a general best practice for workers in any retry-capable system.
- The supervisor's prompt to the worker could include a note: "This subtask may have been partially completed in a prior run. Check existing state before executing."

---

## 7. Clarity and Ambiguity Issues

### 7.1 Orchestrator prompt to supervisor is underspecified

The plan says the orchestrator sends: *"Start or continue processing tasks. Read your state file if it exists."* This is vague. The supervisor doesn't know if the worker just ran, if this is a fresh start, or if a crash recovery is in progress.

**Recommendation:**
- The orchestrator should send a slightly more informative prompt based on context:
  - After supervisor returns `CALL_WORKER` → invoke worker → then invoke supervisor with: "The worker has completed. Read your state and the worker result."
  - Fresh start / after `TASK_DONE`: "Start processing the next task. Read your state file if it exists."
- This gives the supervisor a tiny bit of context without growing the orchestrator's prompt over time.

### 7.2 What constitutes "alphabetical/priority order"?

The plan mentions both alphabetical ordering and a `priority` field in task frontmatter. These could conflict. Tasks named `001-*` through `010-*` create numeric ordering via filename, but the `priority` field in YAML could differ.

**Recommendation:**
- Pick one: either the filename prefix determines order, or the `priority` YAML field does. Document the decision explicitly.
- Simplest approach: alphabetical by filename (the `001-` convention already encodes priority). Drop the `priority` field from the task format, or clarify it's informational only.

### 7.3 No defined behavior for task file format errors

What if a task file has invalid YAML frontmatter, missing required fields, or is empty?

**Recommendation:**
- The supervisor should validate task files before decomposition. If invalid, it should skip the task (move to a `tasks/failed/` folder) or ask the user.

---

## 8. Scalability Concerns

### 8.1 Single task at a time

The architecture is strictly serial: one task in progress, one subtask at a time. This is fine for the stated goal but doesn't scale if the queue grows large.

**Not necessarily a problem** — this is an inherent design choice given the depth-1 constraint. But worth noting that parallelism would require multiple orchestrator instances or a fundamentally different architecture.

### 8.2 Supervisor state file grows with completed subtask history

The `supervisor-state.md` example shows a "Completed Subtask Results" section that accumulates entries. For a task with many subtasks (e.g., 20+), this file could get large, consuming more of the supervisor's context window per invocation.

**Recommendation:**
- Cap the completed subtask history. Keep only the last 3-5 results, or summarize older ones into a single line.
- Alternatively, move completed subtask details to a separate log file and keep only a summary in the state file.

### 8.3 Large task files

If a task file is very detailed (e.g., multi-page spec), the supervisor needs to read the full task plus its state file plus the worker result — all in a single context window.

**Recommendation:**
- Add a note that task files should be kept concise (< 500 lines) or that large specs should be referenced by link rather than inlined.

---

## 9. File System Race Conditions

### 9.1 Windows file locking

On Windows, file operations can fail if another process (or VS Code) has a file open. Moving files with `Move-Item` while VS Code has them open in an editor tab could fail silently or throw.

**Recommendation:**
- Use `Copy-Item` + `Remove-Item` instead of `Move-Item` as a more reliable pattern.
- Or ensure agents close files before moving them.

### 9.2 Concurrent orchestrator instances

Nothing prevents a user from accidentally starting two orchestrator conversations. Both would compete for the same task files.

**Recommendation:**
- Add a lockfile mechanism: the supervisor creates a `tasks/in-progress/.lock` file on startup and deletes it on completion. If the lock exists, refuse to start.
- Or at minimum, document that only one orchestrator should run at a time.

---

## 10. Miscellaneous Issues

### 10.1 `confirm_conversation_finished` timeout

The tool has a 600-second (10-minute) timeout. If the user doesn't respond within 10 minutes, the result is likely a timeout/cancel. The orchestrator's behavior on timeout is undefined.

**Recommendation:**
- The orchestrator should treat a timeout or cancel as "continue with next task" (not "stop").

### 10.2 No logging or audit trail

Completed subtask results are ephemeral — deleted after each task completes. If something goes wrong, there's no history to debug.

**Recommendation:**
- Append a log entry to a `tasks/log.md` file after each subtask or task completion. This doesn't need to be detailed — just timestamp, task, subtask, status.

### 10.3 Worker's `ask_user` tool may block the loop

If the worker calls `ask_user` and the user doesn't respond, the entire pipeline stalls. Same for the supervisor.

**Recommendation:**
- Document this as a known limitation.
- Consider adding a timeout guideline: if no user response within X minutes, proceed with best judgment.

### 10.4 No mechanism for the user to cancel mid-task

Once the orchestrator loop is running, the user can only intervene at `confirm_conversation_finished` checkpoints. There's no way to abort a running subtask or skip a task.

**Recommendation:**
- Document the cancel mechanism (if any — e.g., deleting the task file from `in-progress/`, or using VS Code's stop button).
- Consider a `tasks/in-progress/.cancel` sentinel file that the supervisor checks at the start of each invocation.

---

## Summary of Highest-Priority Fixes

| # | Issue | Severity | Effort |
|---|---|---|---|
| 1 | Signal parsing robustness (Section 5.1) | **High** | Low |
| 2 | Stale `worker-result.md` detection (Section 3.1) | **High** | Low |
| 3 | Crash recovery state machine (Section 6.1) | **High** | Medium |
| 4 | Unrecognized signal fallback (Section 2.1) | **High** | Low |
| 5 | Stuck loop detection / max rounds (Section 2.2) | **Medium** | Low |
| 6 | Stale state file on task boundary (Section 4.1) | **Medium** | Low |
| 7 | Plan vs current impl discrepancy (Section 1) | **Medium** | Medium |
| 8 | Worker idempotency guidance (Section 6.2) | **Medium** | Low |
| 9 | Orchestrator prompt differentiation (Section 7.1) | **Low** | Low |
| 10 | Audit log (Section 10.2) | **Low** | Low |
