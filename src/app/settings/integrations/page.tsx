import Link from "next/link";
import { MetaIntegrationPanel } from "@/components/integrations/MetaIntegrationPanel";
import { GoogleIntegrationPanel } from "@/components/integrations/GoogleIntegrationPanel";

export default function IntegrationsSettingsPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <Link href="/" className="text-sm text-blue-600 hover:underline">
        ← Home
      </Link>
      <h1 className="mt-4 text-2xl font-semibold">Integrations</h1>
      <p className="mt-1 text-sm text-neutral-600">
        Manage Meta and Google connections for this workspace. Tokens are stored encrypted and
        never exposed to the browser.
      </p>
      <div className="mt-8 space-y-6">
        <MetaIntegrationPanel />
        <GoogleIntegrationPanel />
      </div>
    </main>
  );
}
