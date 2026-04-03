import { ConfigurableSources } from "@/lib/types";
import ConnectorWrapper from "@/app/admin/connectors/[connector]/ConnectorWrapper";

export default async function PersonalConnectorPage(props: {
  params: Promise<{ connector: string }>;
}) {
  const params = await props.params;
  return (
    <ConnectorWrapper
      connector={params.connector.replace("-", "_") as ConfigurableSources}
      scope="user"
    />
  );
}
