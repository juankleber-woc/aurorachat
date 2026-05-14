import { MinimalPersonaSnapshot } from "@/app/admin/agents/interfaces";
import { ToolSnapshot } from "@/lib/tools/interfaces";

export function getEffectiveAgentTools(
  agent: Pick<MinimalPersonaSnapshot, "builtin_persona" | "tools"> | null | undefined,
  availableTools: ToolSnapshot[]
): ToolSnapshot[] {
  if (!agent) {
    return [];
  }

  if (agent.tools.length > 0) {
    return agent.tools;
  }

  // All agents without tools (both builtin and custom) fall back to globally
  // available enabled tools so chat capabilities are always surfaced.
  return availableTools.filter((tool) => tool.enabled);
}
