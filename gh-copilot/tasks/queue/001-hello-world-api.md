---
title: "Create a hello world Express.js API"
priority: 1
---

## Description

Create a minimal Express.js REST API as a demonstration project in a `demo-api/` folder at the workspace root.

## Requirements

- Initialize a new Node.js project with `package.json`
- Install Express.js as a dependency
- Create a single `index.js` entry point
- Implement two endpoints:
  - `GET /` — returns `{ "message": "Hello, world!" }`
  - `GET /health` — returns `{ "status": "ok", "timestamp": "<ISO date>" }`
- Add a `start` script in `package.json`

## Acceptance Criteria

- [ ] `demo-api/package.json` exists with express dependency
- [ ] `demo-api/index.js` implements both endpoints
- [ ] Running `npm start` in `demo-api/` starts the server on port 3000
