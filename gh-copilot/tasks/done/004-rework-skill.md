We have developed this project documentation skill and I tried it out and I have some feedback that we need to address:

It takes a good start - the skill works and is being used by the supervisor agent when asked to do so.

But then the supervisor produces the whole documentation in one go into one document 'docs\project-docs.md'

Instead, it should produce many individual documentation tasks _in the form of task files in the 'queue' folder_ for the different aspects outlined in the skill with a we-defined prompt with a focussed scope for the worker to handle - those tasks no longer involve the skill.

The skill should _only_ be used to break down the documentation tasks so that we have a very predictable outcome of the documentation.

---
## Status
- **Attempt:** 1
- **Moved to in-progress:** 2026-04-14

## Completion Notes
- Completed: 2026-04-14
- Summary: Rewrote `project-discovery` SKILL.md from 930 lines to 518 lines. Removed the duplicate "do-it-all-in-one-pass" workflow. The skill now serves one purpose: guiding the supervisor to create 6 individual task files in `tasks/queue/` (one per discovery area). Each task file template is self-contained with discovery instructions and output format. Workers no longer need the skill — they get everything from the task file. The supervisor workflow is: assess scope → determine numbering → create task files → return.
