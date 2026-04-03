"use client";

import React, { useContext } from "react";
import { SettingsContext } from "@/providers/SettingsProvider";
import Text from "@/refresh-components/texts/Text";
import { useLocale } from "@/providers/LocaleProvider";

export default function LoginText() {
  const settings = useContext(SettingsContext);
  const { locale } = useLocale();
  return (
    <div className="w-full flex flex-col ">
      <Text as="p" headingH2 text05>
        {locale === "pt-BR" ? "Bem-vindo ao " : "Welcome to "}
        {(settings && settings?.enterpriseSettings?.application_name) || "AuroraChat"}
      </Text>
      <Text as="p" text03 mainUiMuted>
        {locale === "pt-BR"
          ? "Seu workspace de IA para o trabalho"
          : "Your AI workspace for work"}
      </Text>
    </div>
  );
}
