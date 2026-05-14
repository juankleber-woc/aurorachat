import { getEffectiveAgentTools } from "./getEffectiveAgentTools";
import { MinimalPersonaSnapshot } from "@/app/admin/agents/interfaces";
import { ToolSnapshot } from "@/lib/tools/interfaces";

const buildTool = (overrides: Partial<ToolSnapshot> = {}): ToolSnapshot => ({
  id: overrides.id ?? 1,
  name: overrides.name ?? "tool",
  description: overrides.description ?? "",
  definition: overrides.definition ?? null,
  display_name: overrides.display_name ?? "Tool",
  in_code_tool_id: overrides.in_code_tool_id ?? "SearchTool",
  custom_headers: overrides.custom_headers ?? null,
  passthrough_auth: overrides.passthrough_auth ?? false,
  mcp_server_id: overrides.mcp_server_id ?? null,
  user_id: overrides.user_id ?? null,
  oauth_config_id: overrides.oauth_config_id ?? null,
  oauth_config_name: overrides.oauth_config_name ?? null,
  enabled: overrides.enabled ?? true,
  chat_selectable: overrides.chat_selectable ?? true,
  agent_creation_selectable: overrides.agent_creation_selectable ?? true,
  default_enabled: overrides.default_enabled ?? false,
});

const buildAgent = (
  overrides: Partial<MinimalPersonaSnapshot> = {}
): MinimalPersonaSnapshot => ({
  id: overrides.id ?? 0,
  name: overrides.name ?? "InovaChat-Agent",
  description: overrides.description ?? "",
  tools: overrides.tools ?? [],
  starter_messages: overrides.starter_messages ?? null,
  document_sets: overrides.document_sets ?? [],
  hierarchy_node_count: overrides.hierarchy_node_count ?? 0,
  attached_document_count: overrides.attached_document_count ?? 0,
  knowledge_sources: overrides.knowledge_sources ?? [],
  llm_model_version_override:
    overrides.llm_model_version_override ?? undefined,
  llm_model_provider_override:
    overrides.llm_model_provider_override ?? undefined,
  uploaded_image_id: overrides.uploaded_image_id ?? undefined,
  icon_name: overrides.icon_name ?? undefined,
  is_public: overrides.is_public ?? true,
  is_listed: overrides.is_listed ?? true,
  display_priority: overrides.display_priority ?? null,
  is_featured: overrides.is_featured ?? false,
  builtin_persona: overrides.builtin_persona ?? true,
  labels: overrides.labels ?? [],
  owner: overrides.owner ?? null,
});

describe("getEffectiveAgentTools", () => {
  test("returns persona tools when the agent already has explicit tools", () => {
    const personaTool = buildTool({ id: 10, name: "persona-tool" });
    const fallbackTool = buildTool({ id: 20, name: "fallback-tool" });

    const result = getEffectiveAgentTools(
      buildAgent({ tools: [personaTool] }),
      [fallbackTool]
    );

    expect(result).toEqual([personaTool]);
  });

  test("falls back to enabled global tools for builtin agents with empty tools", () => {
    const enabledTool = buildTool({ id: 10, name: "enabled-tool", enabled: true });
    const disabledTool = buildTool({
      id: 20,
      name: "disabled-tool",
      enabled: false,
    });

    const result = getEffectiveAgentTools(buildAgent({ tools: [] }), [
      enabledTool,
      disabledTool,
    ]);

    expect(result).toEqual([enabledTool]);
  });

  test("does not fall back for non-builtin agents", () => {
    const globalTool = buildTool({ id: 10, name: "global-tool" });

    const result = getEffectiveAgentTools(
      buildAgent({ builtin_persona: false, tools: [] }),
      [globalTool]
    );

    expect(result).toEqual([]);
  });
});
