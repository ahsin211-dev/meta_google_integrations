import { IntegrationSettings } from "@/components/integrations/IntegrationSettings";

export default function MetaIntegrationPage() {
  return (
    <IntegrationSettings
      provider="meta"
      title="Meta (Facebook & Instagram)"
      moduleLabels={{
        facebook_page: "Facebook Page",
        instagram_business: "Instagram Business",
      }}
    />
  );
}
