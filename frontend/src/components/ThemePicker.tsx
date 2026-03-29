import { useState, useRef, useEffect } from 'react';
import { Palette } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { COLOR_THEMES } from '@/lib/themes';
import { useTheme } from '@/hooks/useTheme';

export default function ThemePicker() {
  const { colorTheme, setColorTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <Button
        variant="ghost"
        size="icon"
        aria-label="Color theme"
        onClick={() => setOpen((v) => !v)}
      >
        <Palette className="h-4 w-4" />
      </Button>

      {open && (
        <div className="absolute right-0 top-full mt-1 z-50 w-52 rounded-lg border bg-popover p-2 shadow-md">
          <p className="text-xs font-medium text-muted-foreground px-1 pb-1.5">Color Theme</p>
          <div className="grid grid-cols-2 gap-1">
            {COLOR_THEMES.map((t) => (
              <button
                key={t.id}
                onClick={() => { setColorTheme(t.id); setOpen(false); }}
                className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-xs transition-colors hover:bg-accent text-left ${
                  colorTheme === t.id ? 'bg-accent ring-1 ring-primary' : ''
                }`}
              >
                <span className="flex gap-0.5 flex-shrink-0">
                  <span
                    className="h-3 w-3 rounded-full border border-border"
                    style={{ backgroundColor: t.preview.primary }}
                  />
                  <span
                    className="h-3 w-3 rounded-full border border-border"
                    style={{ backgroundColor: t.preview.accent }}
                  />
                </span>
                <span className="truncate">{t.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
