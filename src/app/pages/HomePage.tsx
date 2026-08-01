const foundationItems = [
  {
    title: 'Desktop shell',
    detail: 'Tauri 2 hosts the React application in a native Windows window.',
  },
  {
    title: 'Local command boundary',
    detail:
      'Typed feature gateways keep Rust invocation details outside the interface layer.',
  },
  {
    title: 'Quality baseline',
    detail:
      'Unit, browser, lint, type, build, and Rust checks protect the foundation.',
  },
];

export function HomePage() {
  return (
    <section className="mx-auto w-full max-w-5xl space-y-10">
      <header className="max-w-3xl space-y-3">
        <p className="text-sm font-medium text-muted">Devventory</p>
        <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
          Project foundation
        </h1>
        <p className="text-base leading-7 text-muted sm:text-lg">
          The offline-first desktop shell is ready for future inventory
          features. This phase keeps the boundary intentionally small:
          application structure, local diagnostics, and reliable development
          checks.
        </p>
      </header>

      <div className="grid gap-4 md:grid-cols-3">
        {foundationItems.map((item) => (
          <article
            key={item.title}
            className="rounded-2xl border border-divider bg-surface p-5"
          >
            <h2 className="font-semibold">{item.title}</h2>
            <p className="mt-2 text-sm leading-6 text-muted">{item.detail}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
