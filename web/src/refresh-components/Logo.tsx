"use client";

import { useSettingsContext } from "@/providers/SettingsProvider";
import {
  DEFAULT_LOGO_SIZE_PX,
  NEXT_PUBLIC_DO_NOT_USE_TOGGLE_OFF_DANSWER_POWERED,
} from "@/lib/constants";
import { cn } from "@/lib/utils";
import Text from "@/refresh-components/texts/Text";
import Truncated from "@/refresh-components/texts/Truncated";
import { useMemo } from "react";
import Image from "next/image";
import auroraLogo from "@public/aurora-logo.png";

export interface LogoProps {
  folded?: boolean;
  size?: number;
  className?: string;
}

export default function Logo({ folded, size, className }: LogoProps) {
  const resolvedSize = size ?? DEFAULT_LOGO_SIZE_PX;
  const settings = useSettingsContext();
  const logoDisplayStyle = settings.enterpriseSettings?.logo_display_style;
  const applicationName =
    settings.enterpriseSettings?.application_name || "AuroraChat";

  // Cache-buster: the logo URL never changes (/api/enterprise-settings/logo)
  // so the browser serves the in-memory cached image even after an admin
  // uploads a new one. Generating a fresh timestamp each time enterprise
  // settings are revalidated by SWR appends a unique query param to force
  // the browser to re-fetch the image.
  const logoBuster = useMemo(
    () => Date.now(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [settings.enterpriseSettings]
  );

  const logo = (
    <div
      className={cn(
        "relative aspect-square overflow-hidden rounded-full ring-1 ring-[var(--border-02)] shadow-01 flex-shrink-0 bg-background-tint-00",
        className
      )}
      style={{ height: resolvedSize, width: resolvedSize }}
    >
      {settings.enterpriseSettings?.use_custom_logo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          alt="Logo"
          src={`/api/enterprise-settings/logo?v=${logoBuster}`}
          className="object-cover object-center w-full h-full"
        />
      ) : (
        <Image
          alt="AuroraChat logo"
          src={auroraLogo}
          fill
          sizes={`${resolvedSize}px`}
          className="object-cover object-center"
          priority
        />
      )}
    </div>
  );

  const renderNameAndPoweredBy = (opts: {
    includeLogo: boolean;
    includeName: boolean;
  }) => {
    return (
      <div className="flex min-w-0 gap-2">
        {opts.includeLogo && logo}
        {!folded && (
          /* H3 text is 4px larger (28px) than the Logo icon (24px), so negative margin hack. */
          <div className="flex flex-1 flex-col -mt-0.5">
            {opts.includeName && <Truncated headingH3>{applicationName}</Truncated>}
            {!NEXT_PUBLIC_DO_NOT_USE_TOGGLE_OFF_DANSWER_POWERED && (
              <Text
                secondaryBody
                text03
                className={"line-clamp-1 truncate"}
                nowrap
              >
                Powered by AuroraChat
              </Text>
            )}
          </div>
        )}
      </div>
    );
  };

  // Handle "logo_only" display style
  if (logoDisplayStyle === "logo_only") {
    return renderNameAndPoweredBy({ includeLogo: true, includeName: false });
  }

  // Handle "name_only" display style
  if (logoDisplayStyle === "name_only") {
    return renderNameAndPoweredBy({ includeLogo: false, includeName: true });
  }

  // Handle "logo_and_name" or default behavior
  return applicationName ? (
    renderNameAndPoweredBy({ includeLogo: true, includeName: true })
  ) : folded ? (
    logo
  ) : (
    renderNameAndPoweredBy({ includeLogo: true, includeName: true })
  );
}
