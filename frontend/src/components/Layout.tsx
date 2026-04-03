import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Menu, Upload, Star, Settings, Sun, Moon, Monitor, ClipboardCheck, DollarSign, ListChecks } from 'lucide-react';
import { useTheme } from '@/hooks/useTheme';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from '@/components/ui/sheet';
import { Separator } from '@/components/ui/separator';
import ThemePicker from '@/components/ThemePicker';

const navItems = [
  { path: '/', label: 'Upload', icon: Upload },
  { path: '/review', label: 'Review', icon: Star },
  { path: '/completed', label: 'Completed', icon: ClipboardCheck },
  { path: '/manage', label: 'Manage', icon: ListChecks },
  { path: '/prices', label: 'Prices', icon: DollarSign },
  { path: '/settings', label: 'Control Panel', icon: Settings },
];

export default function Layout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { theme, cycleTheme } = useTheme();

  const ThemeIcon = theme === 'dark' ? Moon : theme === 'light' ? Sun : Monitor;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex h-16 items-center px-4 md:px-6">
          {/* Mobile menu */}
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger
              className="md:hidden"
              render={<Button variant="ghost" size="icon" className="mr-2" />}
            >
              <Menu className="h-5 w-5" />
            </SheetTrigger>
            <SheetContent side="left" className="w-64">
              <SheetTitle className="sr-only">Navigation</SheetTitle>
              <nav className="flex flex-col gap-2 mt-8">
                {navItems.map((item) => (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={() => setMobileOpen(false)}
                    className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
                      location.pathname === item.path
                        ? 'bg-primary text-primary-foreground'
                        : 'hover:bg-muted'
                    }`}
                  >
                    <item.icon className="h-4 w-4" />
                    {item.label}
                  </Link>
                ))}
              </nav>
            </SheetContent>
          </Sheet>

          {/* Logo / Title */}
          <Link to="/" className="flex items-center gap-2 mr-6">
            <img src="/logoNoBG.png" alt="Logo" className="h-8 w-8 object-contain" />
            <span className="font-bold text-lg hidden sm:inline">
              Capitalism But Make It Hot
            </span>
            <span className="font-bold text-lg sm:hidden">CBMIH</span>
          </Link>

          <div className="flex-1" />

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-1">
            {navItems.map((item) => (
              <Link key={item.path} to={item.path}>
                <Button
                  variant={location.pathname === item.path ? 'default' : 'ghost'}
                  size="sm"
                  className="gap-2"
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </Button>
              </Link>
            ))}
          </nav>

          <ThemePicker />
          <Button
            variant="ghost"
            size="icon"
            onClick={cycleTheme}
            className="ml-1"
            aria-label={`Theme: ${theme}`}
          >
            <ThemeIcon className="h-4 w-4" />
          </Button>
        </div>
      </header>

      <Separator />

      {/* Main content */}
      <main className="container mx-auto px-3 py-4 sm:px-4 sm:py-6 md:px-6 md:py-8 max-w-6xl">
        {children}
      </main>
    </div>
  );
}
