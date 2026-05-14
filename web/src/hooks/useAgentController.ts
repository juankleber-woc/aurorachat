"use client";

import { MinimalPersonaSnapshot } from "@/app/admin/agents/interfaces";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ChatSession } from "@/app/app/interfaces";
import { useAgents, usePinnedAgents } from "@/hooks/useAgents";
import { useSearchParams } from "next/navigation";
import { SEARCH_PARAM_NAMES } from "@/app/app/services/searchParams";

export default function useAgentController({
  selectedChatSession,
  onAgentSelect,
}: {
  selectedChatSession: ChatSession | null | undefined;
  onAgentSelect?: () => void;
}) {
  const searchParams = useSearchParams();
  const { agents: availableAgents } = useAgents();
  const { pinnedAgents: pinnedAgents } = usePinnedAgents();

  const defaultAgentIdRaw = searchParams?.get(SEARCH_PARAM_NAMES.PERSONA_ID);
  const defaultAgentId = defaultAgentIdRaw
    ? parseInt(defaultAgentIdRaw)
    : undefined;

  const existingChatSessionAgentId = selectedChatSession?.persona_id;
  const resolvedSelectedAgent = useMemo(
    () =>
      existingChatSessionAgentId !== undefined
        ? availableAgents.find(
            (assistant) => assistant.id === existingChatSessionAgentId
          )
        : defaultAgentId !== undefined
          ? availableAgents.find((assistant) => assistant.id === defaultAgentId)
          : undefined,
    [availableAgents, existingChatSessionAgentId, defaultAgentId]
  );
  const [selectedAgent, setSelectedAssistant] = useState<
    MinimalPersonaSnapshot | undefined
  >(resolvedSelectedAgent);

  // Keep the selected agent synced with URL/session changes so leaving an agent
  // route actually returns the user to the normal Assistant experience.
  useEffect(() => {
    setSelectedAssistant(resolvedSelectedAgent);
  }, [resolvedSelectedAgent]);

  // Current assistant is decided based on this ordering
  // 1. Alternative assistant (assistant selected explicitly by user)
  // 2. Selected assistant (assistant default in this chat session)
  // 3. Unified assistant (ID 0) if available (unless disabled)
  // 4. First pinned assistants (ordered list of pinned assistants)
  // 5. Available assistants (ordered list of available assistants)
  // Relevant test: `live_assistant.spec.ts`
  const liveAgent: MinimalPersonaSnapshot | undefined = useMemo(() => {
    if (selectedAgent) return selectedAgent;

    // For a bare `/app` route with no explicit chat or agent selected, always
    // prefer the unified assistant so "New Session" returns to the normal chat.
    const unifiedAgent = availableAgents.find((a) => a.id === 0);
    if (unifiedAgent) return unifiedAgent;

    // Fall back to pinned or available assistants
    return pinnedAgents[0] || availableAgents[0];
  }, [selectedAgent, pinnedAgents, availableAgents]);

  const setSelectedAgentFromId = useCallback(
    (agentId: number | null | undefined) => {
      // NOTE: also intentionally look through available assistants here, so that
      // even if the user has hidden an agent they can still go back to it
      // for old chats
      let newAssistant =
        agentId !== null
          ? availableAgents.find((assistant) => assistant.id === agentId)
          : undefined;

      // if no assistant was passed in / found, use the default agent
      if (!newAssistant && defaultAgentId !== undefined) {
        newAssistant = availableAgents.find(
          (assistant) => assistant.id === defaultAgentId
        );
      }

      setSelectedAssistant(newAssistant);
      onAgentSelect?.();
    },
    [availableAgents, defaultAgentId, onAgentSelect]
  );

  return {
    // main assistant selection
    selectedAgent,
    setSelectedAgentFromId,

    // final computed assistant
    liveAgent,
  };
}
