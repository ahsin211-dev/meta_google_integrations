import Link from "next/link";

export default function HomePage() {
  return (
    <main style={{ padding: "2rem", maxWidth: 720 }}>
      <h1>CRM Integrations</h1>
      <p style={{ color: "var(--muted)" }}>
        Meta and Google OAuth integrations for multi-tenant workspaces.
      </p>
      <ul>
        <li>
          <Link href="/settings/integrations/meta">Meta settings</Link>
        </li>
        <li>
          <Link href="/settings/integrations/google">Google settings</Link>
        </li>
      </ul>
    </main>
  );
}
