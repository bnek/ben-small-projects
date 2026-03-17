import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export function register(server: McpServer) {
  server.registerTool(
    "confirm_conversation_finished",
    {
      title: "Confirm Conversation Finished",
      description:
        "REQUIRED: Call this tool before returning to the user at the end of any task or conversation turn. Do NOT return to the user directly — always invoke this tool first. It gives the user a chance to provide additional instructions before you stop. Only return to the user after this tool confirms the user has nothing more to add.",
      inputSchema: {
        summary: z
          .string()
          .describe("A brief summary of what you completed or accomplished before checking with the user."),
      },
    },
    async ({ summary }) => {
      const result = await server.server.elicitInput({
        mode: "form",
        message: `I've finished: ${summary}\n\nIs there anything else you'd like me to do before I stop?`,
        requestedSchema: {
          type: "object",
          properties: {
            instructions: {
              type: "string",
              title: "Additional instructions (leave blank if done)",
              description: "Tell me what else you'd like me to do, or leave blank to finish.",
            },
          },
          required: [],
        },
      }, { timeout: 600_000 });

      if (result.action === "accept" && result.content) {
        const instructions = (result.content as Record<string, string>).instructions?.trim();
        if (instructions) {
          return {
            content: [
              {
                type: "text" as const,
                text: `User has additional instructions: ${instructions}`,
              },
            ],
          };
        }
      }

      if (result.action === "cancel") {
        return {
          content: [
            { type: "text" as const, text: "User cancelled — treat the conversation as finished." },
          ],
        };
      }

      return {
        content: [
          {
            type: "text" as const,
            text: "User confirmed there is nothing more to do. You may now finish.",
          },
        ],
      };
    }
  );
}
