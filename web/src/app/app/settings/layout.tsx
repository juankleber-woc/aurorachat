"use client";

import { usePathname } from "next/navigation";
import * as AppLayouts from "@/layouts/app-layouts";
import * as SettingsLayouts from "@/layouts/settings-layouts";
import { SidebarTab } from "@opal/components";
import { SvgSliders } from "@opal/icons";
import { useUser } from "@/providers/UserProvider";
import { useAuthType } from "@/lib/hooks";
import { Section } from "@/layouts/general-layouts";
import { useLocale } from "@/providers/LocaleProvider";

interface LayoutProps {
  children: React.ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const pathname = usePathname();
  const { user } = useUser();
  const authType = useAuthType();
  const { t } = useLocale();

  const showPasswordSection = Boolean(user?.password_configured);
  const showTokensSection = authType !== null;
  const showAccountsAccessTab = showPasswordSection || showTokensSection;

  return (
    <AppLayouts.Root>
      <SettingsLayouts.Root width="lg">
        <SettingsLayouts.Header
          icon={SvgSliders}
          title={t("settings")}
          separator
        />

        <SettingsLayouts.Body>
          <Section
            flexDirection="column"
            justifyContent="start"
            alignItems="start"
            gap={1.5}
          >
            {/* Left: Tab Navigation */}
            <div
              data-testid="settings-left-tab-navigation"
              className="grid w-full grid-cols-2 gap-2 px-0 sm:grid-cols-2 md:min-w-[12.5rem] md:max-w-[12.5rem] md:grid-cols-1 md:px-2"
            >
              <SidebarTab
                href="/app/settings/general"
                selected={pathname === "/app/settings/general"}
              >
                {t("general")}
              </SidebarTab>
              <SidebarTab
                href="/app/settings/chat-preferences"
                selected={pathname === "/app/settings/chat-preferences"}
              >
                {t("chat_preferences")}
              </SidebarTab>
              {showAccountsAccessTab && (
                <SidebarTab
                  href="/app/settings/accounts-access"
                  selected={pathname === "/app/settings/accounts-access"}
                >
                  {t("accounts_access")}
                </SidebarTab>
              )}
              <SidebarTab
                href="/app/settings/connectors"
                selected={pathname.startsWith("/app/settings/connectors")}
              >
                {t("connectors")}
              </SidebarTab>
            </div>

            {/* Right: Tab Content */}
            <div className="w-full min-w-0">{children}</div>
          </Section>
        </SettingsLayouts.Body>
      </SettingsLayouts.Root>
    </AppLayouts.Root>
  );
}
