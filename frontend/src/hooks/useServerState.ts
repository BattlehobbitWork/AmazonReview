/**
 * Hook for syncing app state with the server.
 * On mount, loads state from the server and merges into localStorage.
 * Provides a `save` function that writes to both localStorage and server.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { apiClient } from '@/lib/api';

// Keys we sync with the server
const SYNC_KEYS = [
  'sampleReviews',
  'productList',
  'outputReviews',
  'productDrafts',
  'currentProductIndex',
  'llmSettings',
  'outputFormat',
] as const;

type SyncKey = (typeof SYNC_KEYS)[number];

interface ServerState {
  loaded: boolean;
  saving: boolean;
  error: string | null;
  save: (key: SyncKey, value: unknown) => void;
  saveMultiple: (updates: Partial<Record<SyncKey, unknown>>) => void;
  reload: () => Promise<void>;
}

export function useServerState(): ServerState {
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingRef = useRef<Record<string, unknown>>({});

  // Load from server on mount
  useEffect(() => {
    loadFromServer();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadFromServer = useCallback(async () => {
    try {
      const res = await apiClient.getState();
      const serverState = res.data;

      // Merge server state into localStorage
      for (const key of SYNC_KEYS) {
        if (serverState[key] !== undefined) {
          localStorage.setItem(key, JSON.stringify(serverState[key]));
        }
      }

      setLoaded(true);
      setError(null);

      // Trigger a storage event so useLocalStorage hooks pick up the changes
      window.dispatchEvent(new Event('server-state-loaded'));
    } catch (err) {
      console.warn('Failed to load state from server, using localStorage:', err);
      setLoaded(true); // Still mark as loaded so the app works offline
      setError('Server unreachable — using local data');
    }
  }, []);

  const flushToServer = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    debounceRef.current = setTimeout(async () => {
      const updates = { ...pendingRef.current };
      pendingRef.current = {};

      if (Object.keys(updates).length === 0) return;

      setSaving(true);
      try {
        await apiClient.patchState(updates);
        setError(null);
      } catch (err) {
        console.warn('Failed to save state to server:', err);
        setError('Save failed — data stored locally');
      } finally {
        setSaving(false);
      }
    }, 500); // Debounce 500ms
  }, []);

  const save = useCallback(
    (key: SyncKey, value: unknown) => {
      // Write to localStorage immediately
      localStorage.setItem(key, JSON.stringify(value));
      // Queue for server sync
      pendingRef.current[key] = value;
      flushToServer();
    },
    [flushToServer]
  );

  const saveMultiple = useCallback(
    (updates: Partial<Record<SyncKey, unknown>>) => {
      for (const [key, value] of Object.entries(updates)) {
        localStorage.setItem(key, JSON.stringify(value));
        pendingRef.current[key] = value;
      }
      flushToServer();
    },
    [flushToServer]
  );

  return { loaded, saving, error, save, saveMultiple, reload: loadFromServer };
}
