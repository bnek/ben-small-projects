We have developed a skill.
Review the implelmentation and assess how it can fit into the orchestrator/suporvisor/worker model and if it needs to be revised.
Remember we intent to have the supervisor use the skill to create the relevant tasks that the worker then can pick up and do the documentation task _without_ the skill.
The skill should only be used to break down the documentation tasks and to create the instructions for the workers so that their scope of work is well defined and not too open.

---
## Status
- **Attempt:** 1
- **Moved to in-progress:** 2026-04-14

## Completion Notes
- Completed: 2026-04-14
- Summary: Revised the project-discovery SKILL.md from a generic workflow guide into a supervisor planning tool. Key changes: (1) Reframed frontmatter and intro as supervisor-only tool, (2) Added supervisor workflow section explaining when/how to use the skill and task ordering, (3) Converted all 6 discovery steps into self-contained worker prompt templates with inline output format guidance, discovery commands, and search patterns, (4) Each worker prompt template is copy-paste ready — workers do NOT need to load the skill. Updated both the project copy and the global ~/.agents/skills copy.