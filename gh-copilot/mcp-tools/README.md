# mcp-tools

Local MCP server exposing custom tools for GitHub Copilot.

## Setup

```bash
npm install
npm run build
```

## Usage

Add to your VS Code MCP settings (`.vscode/mcp.json` or user settings):

```json
{
  "servers": {
    "mcp-tools": {
      "type": "stdio",
      "command": "node",
      "args": ["c:/repos/ben-small-projects/gh-copilot/mcp-tools/dist/index.js"]
    }
  }
}
```

## Adding a new tool

1. Create a file in `src/tools/` (e.g. `src/tools/my-tool.ts`)
2. Export a `register(server: McpServer)` function that calls `server.registerTool(...)`
3. Import and call it in `src/index.ts`
4. `npm run build`

## Tools

| Tool | Description |
|------|-------------|
| `ask_user` | Ask the user a question via MCP elicitation and return their response |
