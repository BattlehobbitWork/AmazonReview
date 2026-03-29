import { useState, useCallback } from 'react';

export function useStorageUsage() {
  const [usage, setUsage] = useState({ used: 0, limit: 5 * 1024 * 1024 });

  const calculateUsage = useCallback(() => {
    let total = 0;
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key) {
        total += (localStorage.getItem(key) || '').length * 2;
      }
    }
    setUsage({ used: total, limit: 5 * 1024 * 1024 });
    return total;
  }, []);

  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  return { usage, calculateUsage, formatBytes };
}
