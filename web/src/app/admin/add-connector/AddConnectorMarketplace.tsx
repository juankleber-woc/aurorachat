"use client";

import * as SettingsLayouts from "@/layouts/settings-layouts";
import { SourceCategory, SourceMetadata } from "@/lib/search/interfaces";
import { listSourceMetadata } from "@/lib/sources";
import { Button } from "@opal/components";
import {
  useCallback,
  useContext,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useFederatedConnectors } from "@/lib/hooks";
import {
  ConnectorScope,
  FederatedConnectorDetail,
  federatedSourceToRegularSource,
  ValidSources,
} from "@/lib/types";
import useSWR from "swr";
import { errorHandlingFetcher } from "@/lib/fetcher";
import { buildSimilarCredentialInfoURL } from "@/app/admin/connector/[ccPairId]/lib";
import { Credential } from "@/lib/connectors/credentials";
import { SettingsContext } from "@/providers/SettingsProvider";
import SourceTile from "@/components/SourceTile";
import InputTypeIn from "@/refresh-components/inputs/InputTypeIn";
import Text from "@/refresh-components/texts/Text";
import { ADMIN_ROUTES } from "@/lib/admin-routes";

const route = ADMIN_ROUTES.ADD_CONNECTOR;

function buildConnectorNavigationUrl(
  sourceMetadata: SourceMetadata,
  scope: ConnectorScope
) {
  if (scope === "user") {
    return `/app/settings/connectors/${sourceMetadata.internalName}`;
  }
  return sourceMetadata.adminUrl;
}

function SourceTileTooltipWrapper({
  sourceMetadata,
  preSelect,
  federatedConnectors,
  slackCredentials,
  scope,
}: {
  sourceMetadata: SourceMetadata;
  preSelect?: boolean;
  federatedConnectors?: FederatedConnectorDetail[];
  slackCredentials?: Credential<any>[];
  scope: ConnectorScope;
}) {
  const existingFederatedConnector = useMemo(() => {
    if (!sourceMetadata.federated || !federatedConnectors) {
      return null;
    }

    return federatedConnectors.find(
      (connector) =>
        federatedSourceToRegularSource(connector.source) ===
        sourceMetadata.internalName
    );
  }, [sourceMetadata, federatedConnectors]);

  const isSlackTile = sourceMetadata.internalName === ValidSources.Slack;
  const hasExistingSlackCredentials = useMemo(() => {
    return isSlackTile && slackCredentials && slackCredentials.length > 0;
  }, [isSlackTile, slackCredentials]);

  const navigationUrl = useMemo(() => {
    if (existingFederatedConnector && scope === "organization") {
      return `/admin/federated/${existingFederatedConnector.id}`;
    }

    return buildConnectorNavigationUrl(sourceMetadata, scope);
  }, [existingFederatedConnector, sourceMetadata, scope]);

  const shouldHideTooltip =
    scope === "user" ||
    (!existingFederatedConnector &&
      !hasExistingSlackCredentials &&
      !sourceMetadata.federated);

  if (shouldHideTooltip) {
    return (
      <SourceTile
        sourceMetadata={sourceMetadata}
        preSelect={preSelect}
        navigationUrl={navigationUrl}
        hasExistingSlackCredentials={!!hasExistingSlackCredentials}
      />
    );
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div>
            <SourceTile
              sourceMetadata={sourceMetadata}
              preSelect={preSelect}
              navigationUrl={navigationUrl}
              hasExistingSlackCredentials={!!hasExistingSlackCredentials}
            />
          </div>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-sm">
          {existingFederatedConnector ? (
            <Text as="p" textLight05 secondaryBody>
              <strong>Federated connector already configured.</strong> Click to
              edit the existing connector.
            </Text>
          ) : hasExistingSlackCredentials ? (
            <Text as="p" textLight05 secondaryBody>
              <strong>Existing Slack credentials found.</strong> Click to manage
              your Slack connector.
            </Text>
          ) : null}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export function AddConnectorMarketplace({
  scope = "organization",
}: {
  scope?: ConnectorScope;
}) {
  const sources = useMemo(() => listSourceMetadata(), []);
  const [rawSearchTerm, setSearchTerm] = useState("");
  const searchTerm = useDeferredValue(rawSearchTerm);
  const { data: federatedConnectors } = useFederatedConnectors();
  const settings = useContext(SettingsContext);

  const { data: slackCredentials } = useSWR<Credential<any>[]>(
    buildSimilarCredentialInfoURL(ValidSources.Slack, false, scope),
    errorHandlingFetcher
  );

  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    searchInputRef.current?.focus();
  }, []);

  const filterSources = useCallback(
    (sources: SourceMetadata[]) => {
      if (!searchTerm) return sources;
      const lowerSearchTerm = searchTerm.toLowerCase();
      return sources.filter(
        (source) =>
          source.displayName.toLowerCase().includes(lowerSearchTerm) ||
          source.category.toLowerCase().includes(lowerSearchTerm)
      );
    },
    [searchTerm]
  );

  const scopedSources = useMemo(() => {
    if (scope === "organization") {
      return sources;
    }

    return sources.filter(
      (source) =>
        source.internalName !== ValidSources.File &&
        source.internalName !== ValidSources.GoogleSites
    );
  }, [scope, sources]);

  const popularSources = useMemo(() => {
    const filtered = filterSources(scopedSources);
    return scopedSources.filter(
      (source) =>
        source.isPopular &&
        (filtered.includes(source) ||
          source.displayName.toLowerCase().includes(searchTerm.toLowerCase()))
    );
  }, [scopedSources, filterSources, searchTerm]);

  const categorizedSources = useMemo(() => {
    const filtered = filterSources(scopedSources);
    const categories = Object.values(SourceCategory).reduce(
      (acc, category) => {
        acc[category] = scopedSources.filter(
          (source) =>
            source.category === category &&
            (filtered.includes(source) ||
              category.toLowerCase().includes(searchTerm.toLowerCase()))
        );
        return acc;
      },
      {} as Record<SourceCategory, SourceMetadata[]>
    );

    if (settings?.settings?.show_extra_connectors === false) {
      const filteredCategories = Object.entries(categories).filter(
        ([category]) => category !== SourceCategory.Other
      );
      return Object.fromEntries(filteredCategories) as Record<
        SourceCategory,
        SourceMetadata[]
      >;
    }
    return categories;
  }, [
    scopedSources,
    filterSources,
    searchTerm,
    settings?.settings?.show_extra_connectors,
  ]);

  const resultIds = useMemo(() => {
    if (!searchTerm) return new Set<string>();
    return new Set(
      Object.values(categorizedSources)
        .flat()
        .map((s) => s.internalName)
    );
  }, [categorizedSources, searchTerm]);

  const dedupedPopular = useMemo(() => {
    if (!searchTerm) return popularSources;
    return popularSources.filter((s) => !resultIds.has(s.internalName));
  }, [popularSources, resultIds, searchTerm]);

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== "Enter") {
      return;
    }

    const filteredCategories = Object.entries(categorizedSources).filter(
      ([_, sources]) => sources.length > 0
    );
    if (
      filteredCategories.length === 0 ||
      !filteredCategories[0] ||
      filteredCategories[0][1].length === 0
    ) {
      return;
    }

    const firstSource = filteredCategories[0][1][0];
    if (!firstSource) {
      return;
    }

    const existingFederatedConnector =
      scope === "organization" && firstSource.federated && federatedConnectors
        ? federatedConnectors.find(
            (connector) =>
              connector.source === `federated_${firstSource.internalName}`
          )
        : null;

    const url =
      existingFederatedConnector && scope === "organization"
        ? `/admin/federated/${existingFederatedConnector.id}`
        : buildConnectorNavigationUrl(firstSource, scope);

    window.open(url, "_self");
  };

  const title =
    scope === "user" ? "Add Personal Connector" : route.title;
  const seeConnectorsHref =
    scope === "user"
      ? "/app/settings/connectors"
      : "/admin/indexing/status";

  return (
    <SettingsLayouts.Root width="full">
      <SettingsLayouts.Header
        icon={route.icon}
        title={title}
        rightChildren={<Button href={seeConnectorsHref}>See Connectors</Button>}
        separator
      />
      <SettingsLayouts.Body>
        <InputTypeIn
          type="text"
          placeholder="Search Connectors"
          ref={searchInputRef}
          value={rawSearchTerm}
          onChange={(event) => setSearchTerm(event.target.value)}
          onKeyDown={handleKeyPress}
          className="w-full max-w-md flex-none"
        />

        {dedupedPopular.length > 0 && (
          <div className="pt-8">
            <Text as="p" headingH3>
              Popular
            </Text>
            <div className="grid grid-cols-2 gap-3 p-2 sm:flex sm:flex-wrap sm:gap-4 sm:p-4 lg:grid lg:grid-cols-4">
              {dedupedPopular.map((source) => (
                <SourceTileTooltipWrapper
                  preSelect={false}
                  key={source.internalName}
                  sourceMetadata={source}
                  federatedConnectors={federatedConnectors}
                  slackCredentials={slackCredentials}
                  scope={scope}
                />
              ))}
            </div>
          </div>
        )}

        {Object.entries(categorizedSources)
          .filter(([_, sources]) => sources.length > 0)
          .map(([category, sources], categoryInd) => (
            <div key={category} className="pt-8">
              <Text as="p" headingH3>
                {category}
              </Text>
              <div className="grid grid-cols-2 gap-3 p-2 sm:flex sm:flex-wrap sm:gap-4 sm:p-4 lg:grid lg:grid-cols-4">
                {sources.map((source, sourceInd) => (
                  <SourceTileTooltipWrapper
                    preSelect={
                      (searchTerm?.length ?? 0) > 0 &&
                      categoryInd === 0 &&
                      sourceInd === 0
                    }
                    key={source.internalName}
                    sourceMetadata={source}
                    federatedConnectors={federatedConnectors}
                    slackCredentials={slackCredentials}
                    scope={scope}
                  />
                ))}
              </div>
            </div>
          ))}
      </SettingsLayouts.Body>
    </SettingsLayouts.Root>
  );
}
