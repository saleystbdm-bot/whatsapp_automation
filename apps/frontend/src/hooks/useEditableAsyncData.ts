import { useEffect, useState, type Dispatch, type SetStateAction } from 'react';

export interface EditableAsyncDataState<T> {
  items: T | null;
  setItems: Dispatch<SetStateAction<T | null>>;
  loading: boolean;
  error: string | null;
}

/**
 * Like useAsyncData, but exposes a setter so the loaded collection can be
 * mutated locally (monitor/remove a group, change an issue's status, etc.)
 * without re-fetching. Once real API calls replace the repository
 * functions, this hook's contract does not need to change.
 */
export function useEditableAsyncData<T>(
  loader: () => Promise<T>,
  deps: unknown[] = [],
): EditableAsyncDataState<T> {
  const [items, setItems] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
  }, deps);

  return { items, setItems, loading, error };
}
