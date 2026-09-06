import { useState, useCallback, useEffect, useRef } from 'react';

export function useLocalStorage<T>(key: string, initialValue: T) {
  const [storedValue, setStoredValue] = useState<T>(() => {
    try {
      const item = window.localStorage.getItem(key);
      return item ? (JSON.parse(item) as T) : initialValue;
    } catch {
      return initialValue;
    }
  });

  // Ref always holds the latest value so functional updaters called in rapid
  // succession (e.g. the auto-generate loop) see accumulated state instead of
  // a stale closure value.
  const ref = useRef(storedValue);
  useEffect(() => { ref.current = storedValue; }, [storedValue]);

  // Re-read from localStorage when server state is loaded
  useEffect(() => {
    const handler = () => {
      try {
        const item = window.localStorage.getItem(key);
        if (item) {
          const parsed = JSON.parse(item) as T;
          ref.current = parsed;
          setStoredValue(parsed);
        }
      } catch { /* ignore */ }
    };
    window.addEventListener('server-state-loaded', handler);
    return () => window.removeEventListener('server-state-loaded', handler);
  }, [key]);

  const setValue = useCallback(
    (value: T | ((val: T) => T)) => {
      try {
        const valueToStore = value instanceof Function ? value(ref.current) : value;
        ref.current = valueToStore;
        setStoredValue(valueToStore);
        window.localStorage.setItem(key, JSON.stringify(valueToStore));
        // Notify ServerSync to queue this key for server save
        window.dispatchEvent(new CustomEvent('ls-write', { detail: { key } }));
      } catch (error) {
        console.error(`Error setting localStorage key "${key}":`, error);
      }
    },
    [key]
  );

  const removeValue = useCallback(() => {
    try {
      window.localStorage.removeItem(key);
      ref.current = initialValue;
      setStoredValue(initialValue);
    } catch (error) {
      console.error(`Error removing localStorage key "${key}":`, error);
    }
  }, [key, initialValue]);

  return [storedValue, setValue, removeValue] as const;
}
