const setupSteps = [
  'Next.js App Router and TypeScript',
  'Tailwind CSS styling pipeline',
  'Neon Postgres connection helpers',
  'Drizzle schema and migration workflow',
];

export default function HomePage() {
  return (
    <main className="min-h-screen px-6 py-12 sm:px-10">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-8">
        <section className="rounded-[2rem] border border-[var(--line)] bg-[var(--surface)] p-8 shadow-[0_24px_80px_rgba(31,42,42,0.08)] sm:p-10">
          <p className="text-sm uppercase tracking-[0.28em] text-[var(--muted)]">
            Nadi / Phase 1
          </p>
          <div className="mt-5 grid gap-8 lg:grid-cols-[1.4fr_0.8fr]">
            <div>
              <h1 className="max-w-2xl text-4xl font-semibold tracking-tight sm:text-5xl">
                A calm foundation for personal life-signal tracking.
              </h1>
              <p className="mt-4 max-w-2xl text-base leading-7 text-[var(--muted)] sm:text-lg">
                This scaffold focuses on the platform surface only: app shell,
                schema source of truth, and local development workflow.
              </p>
            </div>
            <div className="rounded-[1.5rem] border border-[var(--line)] bg-[var(--accent-soft)] p-6">
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[var(--accent)]">
                Principle
              </p>
              <p className="mt-3 text-2xl font-medium leading-8">
                Observe yourself, not optimize yourself.
              </p>
            </div>
          </div>
        </section>

        <section className="grid gap-5 md:grid-cols-2">
          {setupSteps.map((step, index) => (
            <article
              key={step}
              className="rounded-[1.5rem] border border-[var(--line)] bg-white/70 p-6 backdrop-blur"
            >
              <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                Step {index + 1}
              </p>
              <h2 className="mt-3 text-xl font-semibold">{step}</h2>
            </article>
          ))}
        </section>
      </div>
    </main>
  );
}
