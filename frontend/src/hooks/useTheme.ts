import { useState, useEffect, useCallback } from 'react';
import { applyColorTheme } from '@/lib/themes';

type Theme = 'light' | 'dark' | 'system';

function getSystemTheme(): 'light' | 'dark' {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function resolveTheme(theme: Theme): 'light' | 'dark' {
  return theme === 'system' ? getSystemTheme() : theme;
}

function applyTheme(theme: Theme, colorThemeId: string) {
  const resolved = resolveTheme(theme);
  document.documentElement.classList.toggle('dark', resolved === 'dark');
  applyColorTheme(colorThemeId, resolved === 'dark');
}

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(() => {
    const stored = localStorage.getItem('theme') as Theme | null;
    return stored || 'system';
  });

  const [colorTheme, setColorThemeState] = useState<string>(() => {
    return localStorage.getItem('colorTheme') || 'default';
  });

  const setTheme = useCallback((newTheme: Theme) => {
    setThemeState(newTheme);
    localStorage.setItem('theme', newTheme);
    applyTheme(newTheme, colorTheme);
  }, [colorTheme]);

  const setColorTheme = useCallback((id: string) => {
    setColorThemeState(id);
    localStorage.setItem('colorTheme', id);
    applyTheme(theme, id);
  }, [theme]);

  useEffect(() => {
    applyTheme(theme, colorTheme);

    if (theme === 'system') {
      const mq = window.matchMedia('(prefers-color-scheme: dark)');
      const handler = () => applyTheme('system', colorTheme);
      mq.addEventListener('change', handler);
      return () => mq.removeEventListener('change', handler);
    }
  }, [theme, colorTheme]);

  const cycleTheme = useCallback(() => {
    const order: Theme[] = ['light', 'dark', 'system'];
    const next = order[(order.indexOf(theme) + 1) % order.length];
    setTheme(next);
  }, [theme, setTheme]);

  return { theme, setTheme, cycleTheme, colorTheme, setColorTheme };
}
