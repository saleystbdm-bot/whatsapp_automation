import { useEffect, useState, type Dispatch, type SetStateAction } from 'react';

export interface EditableAsyncDataState<T> {
  items: T | null;
  setItems: Dispatch<SetStateAction<T | null>>;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

/**
 * Like useAsyncData, but exposes a setter so the loaded collection can be
 * mutated locally (monitor/remove a group, change an issue's status, etc.)
 * without re-fetching. `refetch` re-runs the same loader against the
 * backend, for an error state's "Try again" action.
 */
export function useEditableAsyncData<T>(
  loader: () => Promise<T>,
  deps: unknown[] = [],
): EditableAsyncDataState<T> {
  const [items, setItems] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    loader()
      .then((data) => {
        if (!cancelled) {
          setItems(data);
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

  return { items, setItems, loading, error, refetch: () => setAttempt((n) => n + 1) };
}
