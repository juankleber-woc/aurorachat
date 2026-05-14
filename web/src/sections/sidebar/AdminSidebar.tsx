"use client";

import { useCallback } from "react";
import { usePathname } from "next/navigation";
import { useSettingsContext } from "@/providers/SettingsProvider";
import SidebarSection from "@/sections/sidebar/SidebarSection";
import SidebarWrapper from "@/sections/sidebar/SidebarWrapper";
import { useIsKGExposed } from "@/app/admin/kg/utils";
import { useCustomAnalyticsEnabled } from "@/lib/hooks/useCustomAnalyticsEnabled";
import { useUser } from "@/providers/UserProvider";
import { UserRole } from "@/lib/types";
import { usePaidEnterpriseFeaturesEnabled } from "@/components/settings/usePaidEnterpriseFeaturesEnabled";
import { CombinedSettings } from "@/interfaces/settings";
import { SidebarTab } from "@opal/components";
import SidebarBody from "@/sections/sidebar/SidebarBody";
import InputTypeIn from "@/refresh-components/inputs/InputTypeIn";
import { Disabled } from "@opal/core";
import { SvgArrowUpCircle, SvgUserManage, SvgX } from "@opal/icons";
import { Content } from "@opal/layouts";
import { ADMIN_ROUTES, sidebarItem } from "@/lib/admin-routes";
import useFilter from "@/hooks/useFilter";
import { IconFunctionComponent } from "@opal/types";
import { Section } from "@/layouts/general-layouts";
import Text from "@/refresh-components/texts/Text";
import { getUserDisplayName } from "@/lib/user";
import { APP_SLOGAN } from "@/lib/constants";
import { useLocale } from "@/providers/LocaleProvider";

interface SidebarItemEntry {
  section: string;
  name: string;
  icon: IconFunctionComponent;
  link: string;
  error?: boolean;
  disabled?: boolean;
}

interface SidebarSections {
  UNLABELED: string;
  AGENTS_AND_ACTIONS: string;
  DOCUMENTS_AND_KNOWLEDGE: string;
  INTEGRATIONS: string;
  PERMISSIONS: string;
  ORGANIZATION: string;
  USAGE: string;
}

function buildItems(
  isCurator: boolean,
  enableCloud: boolean,
  enableEnterprise: boolean,
  settings: CombinedSettings | null,
  kgExposed: boolean,
  customAnalyticsEnabled: boolean,
  hasSubscription: boolean,
  hooksEnabled: boolean,
  sections: SidebarSections
): SidebarItemEntry[] {
  const vectorDbEnabled = settings?.settings.vector_db_enabled !== false;
  const items: SidebarItemEntry[] = [];

  const add = (section: string, route: Parameters<typeof sidebarItem>[0]) => {
    items.push({ ...sidebarItem(route), section });
  };

  const addDisabled = (
    section: string,
    route: Parameters<typeof sidebarItem>[0],
    isDisabled: boolean
  ) => {
    items.push({ ...sidebarItem(route), section, disabled: isDisabled });
  };

  // 1. No header — core configuration (admin only)
  if (!isCurator) {
    add(sections.UNLABELED, ADMIN_ROUTES.LLM_MODELS);
    add(sections.UNLABELED, ADMIN_ROUTES.WEB_SEARCH);
    add(sections.UNLABELED, ADMIN_ROUTES.IMAGE_GENERATION);
    add(sections.UNLABELED, ADMIN_ROUTES.VOICE);
    add(sections.UNLABELED, ADMIN_ROUTES.CODE_INTERPRETER);
    add(sections.UNLABELED, ADMIN_ROUTES.CHAT_PREFERENCES);

    if (vectorDbEnabled && kgExposed) {
      add(sections.UNLABELED, ADMIN_ROUTES.KNOWLEDGE_GRAPH);
    }

    if (!enableCloud && customAnalyticsEnabled) {
      addDisabled(
        sections.UNLABELED,
        ADMIN_ROUTES.CUSTOM_ANALYTICS,
        !enableEnterprise
      );
    }
  }

  // 2. Agents & Actions
  add(sections.AGENTS_AND_ACTIONS, ADMIN_ROUTES.AGENTS);
  add(sections.AGENTS_AND_ACTIONS, ADMIN_ROUTES.MCP_ACTIONS);
  add(sections.AGENTS_AND_ACTIONS, ADMIN_ROUTES.OPENAPI_ACTIONS);

  // 3. Documents & Knowledge
  if (vectorDbEnabled) {
    add(sections.DOCUMENTS_AND_KNOWLEDGE, ADMIN_ROUTES.INDEXING_STATUS);
    add(sections.DOCUMENTS_AND_KNOWLEDGE, ADMIN_ROUTES.ADD_CONNECTOR);
    add(sections.DOCUMENTS_AND_KNOWLEDGE, ADMIN_ROUTES.DOCUMENT_SETS);
    if (!isCurator && !enableCloud) {
      items.push({
        ...sidebarItem(ADMIN_ROUTES.INDEX_SETTINGS),
        section: sections.DOCUMENTS_AND_KNOWLEDGE,
        error: settings?.settings.needs_reindexing,
      });
    }
    if (!isCurator && settings?.settings.opensearch_indexing_enabled) {
      add(sections.DOCUMENTS_AND_KNOWLEDGE, ADMIN_ROUTES.INDEX_MIGRATION);
    }
  }

  // 4. Integrations (admin only)
  if (!isCurator) {
    add(sections.INTEGRATIONS, ADMIN_ROUTES.API_KEYS);
    add(sections.INTEGRATIONS, ADMIN_ROUTES.SLACK_BOTS);
    add(sections.INTEGRATIONS, ADMIN_ROUTES.DISCORD_BOTS);
    if (hooksEnabled) {
      add(sections.INTEGRATIONS, ADMIN_ROUTES.HOOKS);
    }
  }

  // 5. Permissions
  if (!isCurator) {
    add(sections.PERMISSIONS, ADMIN_ROUTES.USERS);
    addDisabled(sections.PERMISSIONS, ADMIN_ROUTES.GROUPS, !enableEnterprise);
    addDisabled(sections.PERMISSIONS, ADMIN_ROUTES.SCIM, !enableEnterprise);
  } else if (enableEnterprise) {
    add(sections.PERMISSIONS, ADMIN_ROUTES.GROUPS);
  }

  // 6. Organization (admin only)
  if (!isCurator) {
    addDisabled(sections.ORGANIZATION, ADMIN_ROUTES.THEME, !enableEnterprise);
  }

  // 7. Usage (admin only)
  if (!isCurator) {
    addDisabled(sections.USAGE, ADMIN_ROUTES.USAGE, !enableEnterprise);
    if (settings?.settings.query_history_type !== "disabled") {
      addDisabled(
        sections.USAGE,
        ADMIN_ROUTES.QUERY_HISTORY,
        !enableEnterprise
      );
    }
  }

  return items;
}

/** Preserve section ordering while grouping consecutive items by section. */
function groupBySection(items: SidebarItemEntry[]) {
  const groups: { section: string; items: SidebarItemEntry[] }[] = [];
  for (const item of items) {
    const last = groups[groups.length - 1];
    if (last && last.section === item.section) {
      last.items.push(item);
    } else {
      groups.push({ section: item.section, items: [item] });
    }
  }
  return groups;
}

interface AdminSidebarProps {
  enableCloudSS: boolean;
}

export default function AdminSidebar({ enableCloudSS }: AdminSidebarProps) {
  const { kgExposed } = useIsKGExposed();
  const pathname = usePathname();
  const { customAnalyticsEnabled } = useCustomAnalyticsEnabled();
  const { user } = useUser();
  const settings = useSettingsContext();
  const enableEnterprise = usePaidEnterpriseFeaturesEnabled();
  const { t } = useLocale();
  const isCurator =
    user?.role === UserRole.CURATOR || user?.role === UserRole.GLOBAL_CURATOR;
  const hooksEnabled =
    enableEnterprise && (settings?.settings.hooks_enabled ?? false);
  const SECTIONS = {
    UNLABELED: "",
    AGENTS_AND_ACTIONS: t("agents_actions"),
    DOCUMENTS_AND_KNOWLEDGE: t("documents_knowledge"),
    INTEGRATIONS: t("integrations"),
    PERMISSIONS: t("permissions"),
    ORGANIZATION: t("organization"),
    USAGE: t("usage"),
  } as const;

  const allItems = buildItems(
    isCurator,
    enableCloudSS,
    enableEnterprise,
    settings,
    kgExposed,
    customAnalyticsEnabled,
    true,
    hooksEnabled,
    SECTIONS
  );

  const itemExtractor = useCallback((item: SidebarItemEntry) => item.name, []);

  const { query, setQuery, filtered } = useFilter(allItems, itemExtractor);

  const groups = groupBySection(filtered);

  return (
    <SidebarWrapper>
      <SidebarBody
        scrollKey="admin-sidebar"
        pinnedContent={
          <div className="flex flex-col w-full">
            <SidebarTab
              icon={({ className }) => <SvgX className={className} size={16} />}
              href="/app"
              variant="sidebar-light"
            >
              {t("exit_admin_panel")}
            </SidebarTab>
            <InputTypeIn
              variant="internal"
              leftSearchIcon
              placeholder={t("search_placeholder")}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
        }
        footer={
          <Section gap={0} height="fit" alignItems="start">
            <div className="p-[0.38rem] w-full">
              <Content
                icon={SvgUserManage}
                title={getUserDisplayName(user)}
                sizePreset="main-ui"
                variant="body"
                prominence="muted"
                widthVariant="full"
              />
            </div>
            <div className="flex flex-row gap-1 p-[0.38rem] w-full">
              <Text text03 secondaryAction>
                <a
                  className="underline"
                  href="https://inovachat.app"
                  target="_blank"
                >
                  InovaChat
                </a>
              </Text>
              <Text text03 secondaryBody>
                |
              </Text>
              {settings.webVersion ? (
                <Text text03 secondaryBody>
                  {settings.webVersion}
                </Text>
              ) : (
                <Text text03 secondaryBody>
                  {APP_SLOGAN}
                </Text>
              )}
            </div>
          </Section>
        }
      >
        {groups.map((group, groupIndex) => {
          const tabs = group.items.map(({ link, icon, name, disabled }) => (
            <Disabled key={link} disabled={disabled}>
              {/*
                # NOTE (@raunakab)
                We intentionally add a `div` intermediary here.
                Without it, the disabled styling that is default provided by the `Disabled` component (which we want here) would be overridden by the custom disabled styling provided by the `SidebarTab`.
                Therefore, in order to avoid that overriding, we add a layer of indirection.
              */}
              <div>
                <SidebarTab
                  disabled={disabled}
                  icon={icon}
                  href={disabled ? undefined : link}
                  selected={pathname.startsWith(link)}
                >
                  {name}
                </SidebarTab>
              </div>
            </Disabled>
          ));

          if (!group.section) {
            return <div key={groupIndex}>{tabs}</div>;
          }

          return (
            <SidebarSection key={groupIndex} title={group.section}>
              {tabs}
            </SidebarSection>
          );
        })}
      </SidebarBody>
    </SidebarWrapper>
  );
}
