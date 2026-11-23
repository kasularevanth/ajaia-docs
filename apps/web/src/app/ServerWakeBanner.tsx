import { useEffect, useState } from 'react';
import { Spinner } from '../components/ui';
import { API_URL } from '../lib/api';

type WakeState = 'checking' | 'slow' | 'ready' | 'down';

/**
 * The API runs on Render's free tier, which sleeps after 15 idle minutes and can take ~50s to wake.
 * Instead of a silent spinner, tell the reviewer what is happening.
 */
export function ServerWakeBanner() {
  const [state, setState] = useState<WakeState>('checking');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const slowTimer = window.setTimeout(() => !cancelled && setState((s) => (s === 'checking' ? 'slow' : s)), 2500);
    const controller = new AbortController();
    const giveUp = window.setTimeout(() => controller.abort(), 90_000);

    fetch(`${API_URL}/api/health`, { signal: controller.signal })
      .then((res) => !cancelled && setState(res.ok ? 'ready' : 'down'))
      .catch(() => !cancelled && setState('down'))
      .finally(() => {
        window.clearTimeout(slowTimer);
        window.clearTimeout(giveUp);
      });

    return () => {
      cancelled = true;
      controller.abort();
      window.clearTimeout(slowTimer);
      window.clearTimeout(giveUp);
    };
  }, [attempt]);

  if (state === 'checking' || state === 'ready') return null;

  return (
    <div role="status" className="no-print sticky top-0 z-30 border-b border-marker bg-marker-wash text-sm text-ink">
      <div className="mx-auto flex max-w-5xl items-center gap-3 px-5 py-2.5">
        {state === 'slow' ? (
          <>
            <Spinner className="size-4 shrink-0" />
            <span>
              Starting the server. The free hosting tier sleeps when idle, so the first load can take up to a minute.
            </span>
          </>
        ) : (
          <>
            <span>The server isn't responding right now.</span>
            <button
              type="button"
              className="font-semibold underline underline-offset-2"
              onClick={() => {
                setState('checking');
                setAttempt((n) => n + 1);
              }}
            >
              Try again
            </button>
          </>
        )}
      </div>
    </div>
  );
}
