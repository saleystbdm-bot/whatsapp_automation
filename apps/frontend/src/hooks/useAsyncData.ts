import { useEffect, useState } from 'react';

export interface AsyncDataState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

/**
 * Runs an async loader (currently backed by the mock repository) and tracks
 * loading/error/data state. Once real API calls replace the repository
 * functions, pages using this hook require no changes.
 */
export function useAsyncData<T>(loader: () => Promise<T>, deps: unknown[] = []): AsyncDataState<T> {
  const [state, setState] = useState<AsyncDataState<T>>({
    data: null,
    loading: true,
    error: null,
  });

  useEffect(() => {
    let cancelled = false;
    setState((prev) => ({ ...prev, loading: true, error: null }));

    loader()
      .then((data) => {
        if (!cancelled) {
          setState({ data, loading: false, error: null });
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          const message = error instanceof Error ? error.message : 'Something went wrong.';
          setState({ data: null, loading: false, error: message });
        }
      });

    return () => {
      cancelled = true;
    };
  }, deps);

  return state;
}
