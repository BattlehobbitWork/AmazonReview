import { useEffect, useRef } from 'react';
import { apiClient } from '@/lib/api';

const SYNC_KEYS = new Set([
  'sampleReviews',
  'productList',
  'outputReviews',
  'productDrafts',
  'currentProductIndex',
  'llmSettings',
  'outputFormat',
]);

/**
 * Invisible component that:
 * 1. On mount, loads state from the server into localStorage
 * 2. Listens for localStorage writes and debounce-syncs dirty keys to the server
 */
export default function ServerSync() {
  const dirtyKeys = useRef<Set<string>>(new Set());
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load server state on mount
  useEffect(() => {
    apiClient
      .getState()
      .then((res) => {
        const state = res.data as Record<string, unknown>;
        for (const key of SYNC_KEYS) {
          if (state[key] !== undefined) {
            localStorage.setItem(key, JSON.stringify(state[key]));
          }
        }
        window.dispatchEvent(new Event('server-state-loaded'));
      })
      .catch((err) => {
        console.warn('ServerSync: failed to load, using localStorage', err);
      });
  }, []);

  // Listen for ls-write events from useLocalStorage
  useEffect(() => {
    const handler = (e: Event) => {
      const key = (e as CustomEvent).detail?.key;
      if (key && SYNC_KEYS.has(key)) {
        dirtyKeys.current.add(key);
        scheduleFlush();
      }
    };
    window.addEventListener('ls-write', handler);
    return () => window.removeEventListener('ls-write', handler);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function scheduleFlush() {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(flush, 800);
  }

  function flush() {
    const keys = [...dirtyKeys.current];
    dirtyKeys.current.clear();
    if (keys.length === 0) return;

    const patch: Record<string, unknown> = {};
    for (const key of keys) {
      try {
        const raw = localStorage.getItem(key);
        if (raw !== null) patch[key] = JSON.parse(raw);
      } catch { /* skip unparseable */ }
    }

    if (Object.keys(patch).length > 0) {
      apiClient.patchState(patch).catch((err) => {
        console.warn('ServerSync: patch failed', err);
      });
    }
  }

  return null; // renders nothing
}
