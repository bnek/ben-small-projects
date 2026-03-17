import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export function register(server: McpServer) {
  server.registerTool(
    "ask_user",
    {
      title: "Ask User",
      description:
        "Talk to the user and get their response. Use this when you need clarification, confirmation, or additional input from the user to proceed with a task - do not get back to the user unless you are done - always use this tool to intercact with them when you need additional input.",
      inputSchema: {
        question: z
          .string()
          .describe("The query for the user"),
      },
    },
    async ({ question }) => {
      const result = await server.server.elicitInput({
        mode: "form",
        message: question,
        requestedSchema: {
          type: "object",
          properties: {
            answer: {
              type: "string",
              title: "Your answer",
              description: question,
            },
          },
          required: ["answer"],
        },
      }, { timeout: 600_000 });

      if (result.action === "accept" && result.content) {
        return {
          content: [
            {
              type: "text" as const,
              text: `User responded: ${(result.content as Record<string, string>).answer}`,
            },
          ],
        };
      }

      if (result.action === "cancel") {
        return {
          content: [
            { type: "text" as const, text: "User cancelled the query." },
          ],
        };
      }

      return {
        content: [
          {
            type: "text" as const,
            text: "User dismissed the query without answering.",
          },
        ],
      };
    }
  );
}
