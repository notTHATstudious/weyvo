import { useEffect, useState, type DependencyList } from 'react';
import { ApiError } from './api';

/** Loads data for a page; refetches when deps change and ignores responses that arrive after a newer request. */
export function useApi<T>(load: () => Promise<T>, deps: DependencyList) {
  const [state, setState] = useState<{ data: T | null; error: ApiError | null; loading: boolean }>({ data: null, error: null, loading: true });

  useEffect(() => {
    let current = true;
    setState((s) => ({ ...s, loading: true, error: null }));
    load().then(
      (data) => current && setState({ data, error: null, loading: false }),
      (error) => current && setState({ data: null, error: error instanceof ApiError ? error : new ApiError('Something went wrong', 0), loading: false }),
    );
    return () => {
      current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return state;
}
