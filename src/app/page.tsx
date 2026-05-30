import Link from "next/link";

export default function HomePage() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <h1 className="text-3xl font-semibold tracking-tight">CRM Integrations</h1>
      <p className="mt-2 text-neutral-600">
        Connect Meta (Facebook Pages, Instagram Business) and Google (Calendar, Meet) per
        workspace.
      </p>
      <Link
        href="/settings/integrations"
        className="mt-8 inline-block rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
      >
        Open integration settings
      </Link>
    </main>
  );
}
