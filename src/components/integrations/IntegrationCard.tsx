interface IntegrationCardProps {
  title: string;
  description: string;
  children: React.ReactNode;
}

export function IntegrationCard({ title, description, children }: IntegrationCardProps) {
  return (
    <section className="rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
      <header className="mb-4">
        <h2 className="text-lg font-semibold">{title}</h2>
        <p className="mt-1 text-sm text-neutral-600">{description}</p>
      </header>
      {children}
    </section>
  );
}
