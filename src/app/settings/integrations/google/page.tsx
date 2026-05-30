import { IntegrationSettings } from "@/components/integrations/IntegrationSettings";

export default function GoogleIntegrationPage() {
  return (
    <IntegrationSettings
      provider="google"
      title="Google (Calendar, Meet, Gmail)"
      moduleLabels={{
        calendar: "Calendar",
        meet: "Google Meet",
        gmail: "Gmail",
      }}
    />
  );
}
