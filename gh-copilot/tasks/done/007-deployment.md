create a deployment powershell script for the orchestrator agents trio by copying them to the directory 'C:\Users\ben\.copilot\agents\' replacing the existing versions.

---
## Status
- **Attempt:** 1
- **Moved to in-progress:** 2026-04-27

## Completion Notes
- Completed: 2026-04-27
- Summary: Added `scripts/deploy-agent-trio.ps1` (commit 2cf7614). Script uses `$PSScriptRoot`-anchored source resolution, strict mode, `$ErrorActionPreference = 'Stop'`, `[CmdletBinding()]` with overridable `-DestinationPath` (default `C:\Users\ben\.copilot\agents\`), validates that all three trio files exist, creates the destination if missing, and copies `orchestrator.agent.md`, `supervisor.agent.md`, `worker.agent.md` with `-Force`. Script not executed, per task instructions.