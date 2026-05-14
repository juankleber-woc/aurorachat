"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  DEFAULT_UI_LOCALE,
  getStoredUILocale,
  isPortugueseLocale,
  persistUILocale,
  SupportedUILocale,
} from "@/lib/ui-locale";

type LocaleMessages = Record<string, string>;

const PT_BR_MESSAGES: LocaleMessages = {
  settings: "Configurações",
  general: "Geral",
  chat_preferences: "Preferências de chat",
  accounts_access: "Contas e acesso",
  connectors: "Conectores",
  search_chats: "Buscar conversas",
  agents: "Agentes",
  explore_agents: "Explorar agentes",
  more_agents: "Mais agentes",
  projects: "Projetos",
  new_project: "Novo projeto",
  recents: "Recentes",
  recents_empty:
    "Envie uma mensagem para começar. Seu histórico de chats vai aparecer aqui.",
  admin_panel: "Painel admin",
  curator_panel: "Painel do curador",
  craft: "Studio",
  build_intro_title: "InovaChat Studio",
  build_intro_description:
    "Crie dashboards, apresentações, documentos e muito mais com seus dados conectados.",
  return_home: "Voltar para o início",
  start_crafting: "Começar agora",
  auth_error_title: "Erro de autenticação",
  auth_error_description: "Houve um problema na sua tentativa de login.",
  auth_return_to_login: "Voltar para a página de login",
  auth_support:
    "Se o problema continuar, entre em contato com a equipe InovaChat em support@inovachat.app.",
  user_settings: "Configurações do usuário",
  notifications: "Notificações",
  help_faq: "Ajuda e FAQ",
  log_in: "Entrar",
  log_out: "Sair",
  no_notifications: "Sem notificações",
  dismiss: "Fechar",
  exit_admin_panel: "Sair do painel admin",
  search_placeholder: "Buscar...",
  agents_actions: "Agentes e ações",
  documents_knowledge: "Documentos e conhecimento",
  integrations: "Integrações",
  permissions: "Permissões",
  organization: "Organização",
  usage: "Uso",
  app_language: "Idioma do aplicativo",
  app_language_description:
    "Português do Brasil é o padrão, mas você pode trocar para inglês quando quiser.",
  language_portuguese: "Português (Brasil)",
  language_english: "English",
  release_available: "InovaChat {version} está disponível!",
  release_description: "Veja as novidades da versão {version}",
  feature_available: "Novo recurso disponível",
  feature_description:
    "Confira as novidades que acabaram de chegar no InovaChat.",
};

const EN_US_MESSAGES: LocaleMessages = {
  settings: "Settings",
  general: "General",
  chat_preferences: "Chat Preferences",
  accounts_access: "Accounts & Access",
  connectors: "Connectors",
  search_chats: "Search Chats",
  agents: "Agents",
  explore_agents: "Explore Agents",
  more_agents: "More Agents",
  projects: "Projects",
  new_project: "New Project",
  recents: "Recents",
  recents_empty: "Try sending a message! Your chat history will appear here.",
  admin_panel: "Admin Panel",
  curator_panel: "Curator Panel",
  craft: "Studio",
  build_intro_title: "InovaChat Studio",
  build_intro_description:
    "Create dashboards, slide decks, documents, and more with your connected data.",
  return_home: "Return Home",
  start_crafting: "Start Building",
  auth_error_title: "Authentication Error",
  auth_error_description: "There was a problem with your login attempt.",
  auth_return_to_login: "Return to Login Page",
  auth_support:
    "If you continue to experience problems, please reach out to the InovaChat team at support@inovachat.app.",
  user_settings: "User Settings",
  notifications: "Notifications",
  help_faq: "Help & FAQ",
  log_in: "Log in",
  log_out: "Log out",
  no_notifications: "No notifications",
  dismiss: "Dismiss",
  exit_admin_panel: "Exit Admin Panel",
  search_placeholder: "Search...",
  agents_actions: "Agents & Actions",
  documents_knowledge: "Documents & Knowledge",
  integrations: "Integrations",
  permissions: "Permissions",
  organization: "Organization",
  usage: "Usage",
  app_language: "App language",
  app_language_description:
    "Portuguese (Brazil) is the default, but you can switch back to English anytime.",
  language_portuguese: "Português (Brasil)",
  language_english: "English",
  release_available: "InovaChat {version} is available!",
  release_description: "Check out what's new in {version}",
  feature_available: "New feature available",
  feature_description: "Check out the latest InovaChat improvements.",
};

const MESSAGES: Record<SupportedUILocale, LocaleMessages> = {
  "pt-BR": PT_BR_MESSAGES,
  "en-US": EN_US_MESSAGES,
};

interface LocaleContextValue {
  locale: SupportedUILocale;
  setLocale: (locale: SupportedUILocale) => void;
  t: (key: keyof typeof PT_BR_MESSAGES, vars?: Record<string, string>) => string;
}

const LocaleContext = createContext<LocaleContextValue | null>(null);

export function LocaleProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] =
    useState<SupportedUILocale>(DEFAULT_UI_LOCALE);

  useEffect(() => {
    const storedLocale = getStoredUILocale();
    setLocaleState(storedLocale);
    persistUILocale(storedLocale);
  }, []);

  const value = useMemo<LocaleContextValue>(() => {
    const messages = MESSAGES[locale];

    return {
      locale,
      setLocale: (nextLocale) => {
        setLocaleState(nextLocale);
        persistUILocale(nextLocale);
      },
      t: (key, vars) => {
        let message = messages[key] ?? PT_BR_MESSAGES[key] ?? key;

        if (vars) {
          Object.entries(vars).forEach(([varKey, value]) => {
            message = message.replaceAll(`{${varKey}}`, value);
          });
        }

        return message;
      },
    };
  }, [locale]);

  return (
    <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>
  );
}

export function useLocale() {
  const context = useContext(LocaleContext);
  if (!context) {
    throw new Error("useLocale must be used within LocaleProvider");
  }
  return context;
}

export function useIsPortuguese() {
  const { locale } = useLocale();
  return isPortugueseLocale(locale);
}
