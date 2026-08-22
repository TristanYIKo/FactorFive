'use client';

/**
 * Route error boundary. Offers a retry, because the most common failure here
 * is a transient upstream rate limit rather than a permanent problem.
 */

import { useEffect } from 'react';
import Link from 'next/link';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[ticker] render failed:', error);
  }, [error]);

  return (
    <div
      className="flex min-h-screen items-center justify-center px-4"
      style={{ background: 'var(--bg-base)' }}
    >
      <div
        className="w-full max-w-md rounded-[var(--radius-lg)] border p-7 text-center"
        style={{ background: 'var(--surface)', borderColor: 'var(--border)', boxShadow: 'var(--shadow-md)' }}
      >
        <h1 className="text-[18px] font-semibold" style={{ color: 'var(--text-primary)' }}>
          Could not load this ticker
        </h1>
        <p className="mt-2 text-[13.5px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
          {error.message || 'Something went wrong while fetching market data.'}
        </p>

        <div className="mt-6 flex items-center justify-center gap-2.5">
          <button
            onClick={reset}
            className="rounded-[var(--radius-md)] px-4 py-2 text-[13.5px] font-medium transition-opacity hover:opacity-85"
            style={{ background: 'var(--accent)', color: '#fff' }}
          >
            Try again
          </button>
          <Link
            href="/"
            className="rounded-[var(--radius-md)] border px-4 py-2 text-[13.5px] font-medium transition-colors"
            style={{ borderColor: 'var(--border-strong)', color: 'var(--text-secondary)' }}
          >
            Back to search
          </Link>
        </div>
      </div>
    </div>
  );
}
