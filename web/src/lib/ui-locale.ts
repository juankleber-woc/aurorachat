"use client";

export const DEFAULT_UI_LOCALE = "pt-BR" as const;
export const UI_LOCALE_STORAGE_KEY = "aurorachat.ui-locale";
export const UI_LOCALE_COOKIE_KEY = "aurorachat_ui_locale";

export const SUPPORTED_UI_LOCALES = ["pt-BR", "en-US"] as const;

export type SupportedUILocale = (typeof SUPPORTED_UI_LOCALES)[number];

function isSupportedLocale(value: string | null | undefined): value is SupportedUILocale {
  return !!value && SUPPORTED_UI_LOCALES.includes(value as SupportedUILocale);
}

export function getStoredUILocale(): SupportedUILocale {
  if (typeof window === "undefined") {
    return DEFAULT_UI_LOCALE;
  }

  const fromStorage = window.localStorage.getItem(UI_LOCALE_STORAGE_KEY);
  if (isSupportedLocale(fromStorage)) {
    return fromStorage;
  }

  const cookieMatch = document.cookie.match(
    new RegExp(`(?:^|; )${UI_LOCALE_COOKIE_KEY}=([^;]+)`)
  );
  const fromCookie = cookieMatch
    ? decodeURIComponent(cookieMatch[1] || "")
    : null;

  if (isSupportedLocale(fromCookie)) {
    return fromCookie;
  }

  return DEFAULT_UI_LOCALE;
}

export function persistUILocale(locale: SupportedUILocale) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(UI_LOCALE_STORAGE_KEY, locale);
  document.cookie = `${UI_LOCALE_COOKIE_KEY}=${encodeURIComponent(
    locale
  )}; path=/; max-age=31536000; SameSite=Lax`;
  document.documentElement.lang = locale;
}

export function getCurrentUILocale(): SupportedUILocale {
  if (typeof window === "undefined") {
    return DEFAULT_UI_LOCALE;
  }

  return getStoredUILocale();
}

export function isPortugueseLocale(locale: SupportedUILocale): boolean {
  return locale === "pt-BR";
}
