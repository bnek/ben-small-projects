#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

// Import tool registrations
import { register as registerAskUser } from "./tools/ask-user.js";
import { register as registerConfirmConversationFinished } from "./tools/confirm-conversation-finished.js";

const server = new McpServer({
  name: "mcp-tools",
  version: "1.0.0",
});

// Register all tools — add new ones here
registerAskUser(server);
registerConfirmConversationFinished(server);

const transport = new StdioServerTransport();
await server.connect(transport);
