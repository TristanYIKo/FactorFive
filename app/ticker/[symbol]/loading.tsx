/**
 * Route-level loading state, shown while Next resolves the server component
 * during a client-side navigation. The page itself also has a Suspense
 * boundary for streaming; this covers the transition before that begins.
 */
export default function Loading() {
  return (
    <div className="min-h-screen" style={{ background: 'var(--bg-base)' }}>
      <div
        className="sticky top-0 z-30 border-b"
        style={{ borderColor: 'var(--border)', background: 'var(--bg-base)' }}
      >
        <div className="mx-auto flex w-full max-w-5xl items-center gap-4 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-2">
            <span
              className="flex h-6 w-6 items-center justify-center rounded-[7px] text-[12px] font-bold"
              style={{ background: 'var(--accent)', color: '#fff' }}
            >
              F5
            </span>
            <span
              className="hidden text-[15px] font-semibold tracking-tight sm:inline"
              style={{ color: 'var(--text-primary)' }}
            >
              FactorFive
            </span>
          </div>
          <div className="ff-skeleton ml-auto h-9 w-full max-w-sm rounded-[var(--radius-lg)]" />
        </div>
      </div>

      <main className="mx-auto w-full max-w-5xl space-y-5 px-4 pt-6 pb-20 sm:px-6">
        <div
          className="rounded-[var(--radius-lg)] border p-5 sm:p-6"
          style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
        >
          <div className="flex items-start gap-4">
            <div className="ff-skeleton h-13 w-13 rounded-[var(--radius-md)]" style={{ height: 52, width: 52 }} />
            <div className="flex-1 space-y-2">
              <div className="ff-skeleton h-6 w-56" />
              <div className="ff-skeleton h-3.5 w-40" />
            </div>
          </div>
        </div>

        <div className="grid gap-5 lg:grid-cols-[1.35fr_1fr]">
          <div
            className="rounded-[var(--radius-lg)] border p-5 sm:p-6"
            style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
          >
            <div className="ff-skeleton mb-5 h-4 w-40" />
            <div className="ff-skeleton mx-auto h-44 w-44 rounded-full" />
          </div>
          <div
            className="rounded-[var(--radius-lg)] border p-5 sm:p-6"
            style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
          >
            <div className="ff-skeleton mb-4 h-4 w-32" />
            <div className="space-y-2.5">
              <div className="ff-skeleton h-3 w-full" />
              <div className="ff-skeleton h-3 w-11/12" />
              <div className="ff-skeleton h-3 w-4/5" />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
