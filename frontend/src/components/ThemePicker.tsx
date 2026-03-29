import { Palette } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { COLOR_THEMES } from '@/lib/themes';
import { useTheme } from '@/hooks/useTheme';

export default function ThemePicker() {
  const { colorTheme, setColorTheme } = useTheme();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={
        <Button variant="ghost" size="icon" aria-label="Color theme">
          <Palette className="h-4 w-4" />
        </Button>
      } />
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuLabel>Color Theme</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {COLOR_THEMES.map((t) => (
          <DropdownMenuItem
            key={t.id}
            onSelect={() => setColorTheme(t.id)}
            className={colorTheme === t.id ? 'bg-accent' : ''}
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
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
