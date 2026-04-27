# Agent Trio: Orchestrator, Supervisor, Worker

## Overview

The trio is a three-tier delegation system for processing a queue of tasks autonomously without blowing up any single agent's context window. Tasks are placed as Markdown files in `tasks/queue/`. The **orchestrator** runs a fixed loop that simply re-invokes the **supervisor**, which picks one task at a time and delegates execution to a **worker** sub-agent. Because each tier spawns the next as a fresh sub-agent, no agent accumulates context across tasks — long task queues can be processed indefinitely.

## Architecture

```
       user drops .md files
              │
              ▼
      ┌───────────────┐
      │  tasks/queue/ │
      └───────────────┘
              ▲ ▼ (move)
┌─────────────┴─┴────────────────┐
│ ORCHESTRATOR                   │
│  • fixed loop, no reasoning    │
│  • tools: agent, confirm_…     │
└──────────────┬─────────────────┘
       invokes │ (same prompt every time)
               ▼
┌────────────────────────────────┐         ┌──────────────────┐
│ SUPERVISOR                     │ ◄──────►│ tasks/in-progress│
│  • one task per invocation     │  moves  │ tasks/done       │
│  • coordinator, never codes    │  files  └──────────────────┘
│  • tools: agent, read, edit,   │
│    execute, ask_user           │
└──────────────┬─────────────────┘
       invokes │ (self-contained prompt with full context)
               ▼
┌────────────────────────────────┐
│ WORKER                         │
│  • full tool access            │
│  • executes the task           │
│  • returns summary as response │
└────────────────────────────────┘
```

## Orchestrator

Source: [agents/orchestrator.agent.md](agents/orchestrator.agent.md)

| Aspect | Detail |
|---|---|
| Purpose | Pure loop driver: re-invokes the supervisor until the queue is empty. |
| Tools | `agent`, `mcp-tools-win/confirm_conversation_finished` |
| Tools withheld | Everything else — no `read`, `edit`, `search`, `execute`. The orchestrator must not reason about tasks; it only loops. |
| Inputs | None beyond the user's initial trigger. Does NOT read task files. |
| Outputs | No filesystem side effects. Calls `confirm_conversation_finished` when done. |

**Loop steps:**

1. Invoke the `supervisor` with a single fixed prompt: *"Process the next task — and ONE task only. Pick a task from `tasks/queue/`, move it to in-progress, use worker sub-agents to complete it, then move it to done and return. If there are no tasks in the 'queue' folder, respond with ALL_DONE."*
2. If the supervisor's response contains `ALL_DONE` on its own line, call `confirm_conversation_finished`. If the user provides further instructions, forward them to the supervisor; otherwise stop.
3. Otherwise, increment `round_count` and go to step 1. Hard cap: `max_rounds = 30` — beyond which the loop stops via `confirm_conversation_finished`.

**Hard rules:**

- Must not read, analyze, or summarize task files.
- Must not modify or enrich the supervisor prompt.
- Must never invoke the worker directly — only the supervisor.
- Each iteration is identical in token cost; all state lives in files.

## Supervisor

Source: [agents/supervisor.agent.md](agents/supervisor.agent.md)

| Aspect | Detail |
|---|---|
| Purpose | Task coordinator that owns the full lifecycle of exactly one task per invocation. |
| Tools | `agent`, `read`, `edit`, `execute`, `mcp-tools-win/ask_user` |
| Tools withheld | `search`, `web`, `browser`, `vscode`, `todo` — to discourage implementation work. |
| Model | Claude Opus 4.7 (copilot) |
| Inputs | Files in `tasks/in-progress/` and `tasks/queue/`; project context files (e.g. `PLAN.md`, `README.md`, source files) read on demand. |
| Outputs | Moves task files between `tasks/queue/` → `tasks/in-progress/` → `tasks/done/`; appends Status / Notes / Completion sections to the task file; returns a brief summary (or `ALL_DONE`) to the orchestrator. |

**Loop steps (one task per invocation):**

1. Check `tasks/in-progress/` for an existing `.md` task (ignoring `README.md`); resume it if present.
2. Otherwise pick the first `.md` from `tasks/queue/` (alphabetical) and move it to `tasks/in-progress/` using `Copy-Item` + `Remove-Item`. If the queue is empty, respond with `ALL_DONE`.
3. Append a Status section (attempt number, date) to the task file.
4. Read the task fully and gather any context the worker will need (referenced files, project docs).
5. Invoke `worker` with a self-contained prompt: objective, full task content, relevant context, instructions, acceptance criteria, file paths.
6. Review the worker's returned summary against the acceptance criteria.
   - **Accept:** append a Completion Notes section, move task to `tasks/done/`, return a brief summary to the orchestrator.
   - **Reject (attempt < 3):** append "Notes from attempt N" to the task file, bump the attempt count, re-invoke the worker with a new prompt explaining what to fix.
   - **Attempt limit (3) reached:** accept as-is with a note and move to done.
7. Return immediately to the orchestrator. Only emit `ALL_DONE` if both queue and in-progress are empty.

**Hard rules:**

- ONE TASK PER INVOCATION — never picks up the next task in the same call.
- NEVER writes project source code, creates project files, runs builds, or executes tests. All such work is delegated to a worker.
- The only files the supervisor may create or edit are the task files in `tasks/in-progress/` (Status, Notes, Completion sections).
- Worker prompts must be fully self-contained — no instructions like "check the task file" allowed.
- Use `Copy-Item` + `Remove-Item` instead of `Move-Item` for Windows reliability.
- May run multiple worker rounds per task (e.g. research → implement → verify).

> **Note: differs from PLAN.md** — the plan stated the supervisor would "deliberately lack `edit`" tools, but the implemented agent does grant `edit`. Its scope is constrained by the hard rule that the supervisor may only edit task files in `tasks/in-progress/`.

## Worker

Source: [agents/worker.agent.md](agents/worker.agent.md)

| Aspect | Detail |
|---|---|
| Purpose | Stateless executor that performs the task described in its prompt and returns a summary. |
| Tools | `agent`, `vscode`, `execute`, `read`, `edit`, `search`, `web`, `browser`, `mcp-tools-win/ask_user`, `todo` |
| Model | Claude Opus 4.7 (copilot) |
| User-invocable | `false` — only the supervisor may spawn it. |
| Inputs | The supervisor's prompt only. The worker does NOT search the filesystem for the task. |
| Outputs | Whatever filesystem changes the task requires (code edits, new files, commits) plus a structured summary as its response. |

**Workflow:**

1. Read instructions from the invoking prompt — not from `tasks/in-progress/`.
2. Execute the task end-to-end with available tools.
3. Verify against the acceptance criteria.
4. Commit changes before returning.
5. Return a summary in this format:

   ```
   ## Summary
   ## Changes Made
   ## Test Results
   ## Issues
   ```

**Constraints:**

- Stay within the scope described in the prompt.
- If blocked or ambiguous, use `ask_user` or return an explanation.

## Task Lifecycle

A single task's journey through the system:

| Step | Folder | Done by | Action |
|---|---|---|---|
| 1 | `tasks/queue/` | user | Drops a `.md` task file. |
| 2 | `tasks/queue/` → `tasks/in-progress/` | supervisor | Picks first alphabetically, moves via `Copy-Item` + `Remove-Item`, appends Status section. |
| 3 | (in-progress) | supervisor | Reads task and gathers context. |
| 4 | (in-progress) | worker (spawned by supervisor) | Executes the task, edits code, runs tests, commits, returns summary. |
| 5 | (in-progress) | supervisor | Reviews summary. On failure, appends "Notes from attempt N" and re-invokes worker (up to 3 attempts). |
| 6 | `tasks/in-progress/` → `tasks/done/` | supervisor | Appends Completion Notes, moves the file. |
| 7 | — | supervisor | Returns brief summary to orchestrator. |
| 8 | — | orchestrator | Re-invokes supervisor for the next task, or stops on `ALL_DONE`. |

## The `ALL_DONE` Signal

`ALL_DONE` is the only stop signal the orchestrator recognizes. The supervisor emits it on its own line **only when** `tasks/queue/` is empty AND `tasks/in-progress/` is empty. Any other supervisor response — including a normal completion summary — is treated as "loop again." When the orchestrator sees `ALL_DONE`, it calls `confirm_conversation_finished` to either gather new user instructions or stop the loop.

## Communication Model

| Channel | Mechanism |
|---|---|
| Orchestrator → Supervisor | Prompt (always the same fixed string) |
| Supervisor → Orchestrator | Response text; `ALL_DONE` line is the stop sentinel |
| Supervisor → Worker | Prompt (detailed, self-contained, includes all needed context) |
| Worker → Supervisor | Response text (structured summary) |
| Task state across invocations | Filesystem (`tasks/queue/`, `tasks/in-progress/`, `tasks/done/`) |

There is **no file-based handoff between supervisor and worker** — the worker's prompt is its entire world, and its response is its entire deliverable. Persistent state (which tasks exist, what's in progress, what's done, retry notes) lives on disk so that fresh sub-agent invocations can pick up where the previous one left off.

## Deployment
run /scripts/deploy-agent-trio.ps1 to deploy the agents