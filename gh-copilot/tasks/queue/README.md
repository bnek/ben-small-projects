# Task Queue

Place `.md` task files here for the orchestrator to process.

## Task File Format

```markdown
---
title: "Short task title"
priority: 1
---

## Description
What needs to be done.

## Requirements
- Requirement 1
- Requirement 2

## Acceptance Criteria
- [ ] Criterion 1
- [ ] Criterion 2
```

Tasks are picked in alphabetical order. Name them with numeric prefixes for ordering:
`001-first-task.md`, `002-second-task.md`, etc.
