import { useEffect, useState } from 'react';

export interface AsyncDataState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

/**
 * Runs an async loader against the repository (backend API) and tracks
 * loading/error/data state. `refetch` re-runs the same loader, for an
 * error state's "Try again" action.
 */
export function useAsyncData<T>(loader: () => Promise<T>, deps: unknown[] = []): AsyncDataState<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    loader()
      .then((result) => {
        if (!cancelled) {
          setData(result);
          setLoading(false);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Something went wrong.');
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, attempt]);

  return { data, loading, error, refetch: () => setAttempt((n) => n + 1) };
}
