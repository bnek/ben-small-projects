the orchestrator sometimes does not call the "conversation finished" tool - it tries to ddelegate it to the supervisor, which is incorrect.
fix that.
also make sure it is instructed to repeat calling the tool until it gets a textual response from the user (as opposed to an empty response or error message, timeout etc).

---
## Status
- **Attempt:** 1
- **Completed:** 2026-04-27

## Completion Notes
- Updated agents/orchestrator.agent.md: clarified that only the orchestrator calls confirm_conversation_finished (never delegated to supervisor) and added retry rule requiring repeated calls until a real textual user reply is received.
