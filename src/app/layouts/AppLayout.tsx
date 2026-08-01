import { Button, useTheme } from '@heroui/react';
import { NavLink, Outlet } from 'react-router';
import { useAppUiStore } from '../stores/app-ui.store';

const navigationItems = [
  { label: 'Home', marker: 'H', to: '/' },
  { label: 'Diagnostics', marker: 'D', to: '/diagnostics' },
];

const themeOptions = ['light', 'dark', 'system'] as const;

interface ThemeSelectorProps {
  onThemeChange: (theme: string) => void;
  theme: string;
}

function ThemeSelector({ onThemeChange, theme }: ThemeSelectorProps) {
  return (
    <div aria-label="Color theme" className="flex flex-wrap gap-1" role="group">
      {themeOptions.map((option) => (
        <Button
          key={option}
          aria-pressed={theme === option}
          className="capitalize"
          onPress={() => onThemeChange(option)}
          size="sm"
          variant={theme === option ? 'secondary' : 'ghost'}
        >
          {option}
        </Button>
      ))}
    </div>
  );
}

function NavigationLink({
  isCollapsed,
  item,
}: {
  isCollapsed: boolean;
  item: (typeof navigationItems)[number];
}) {
  return (
    <NavLink
      className={({ isActive }) =>
        [
          'flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium transition-colors',
          isActive
            ? 'bg-accent-soft text-accent-soft-foreground'
            : 'text-muted hover:bg-surface-secondary hover:text-foreground',
        ].join(' ')
      }
      end={item.to === '/'}
      to={item.to}
    >
      <span
        aria-hidden="true"
        className="flex size-7 shrink-0 items-center justify-center rounded-lg border border-divider bg-surface text-xs font-semibold"
      >
        {item.marker}
      </span>
      <span className={isCollapsed ? 'sr-only' : undefined}>{item.label}</span>
    </NavLink>
  );
}

export function AppLayout() {
  const isNavigationCollapsed = useAppUiStore(
    (state) => state.isNavigationCollapsed,
  );
  const toggleNavigation = useAppUiStore((state) => state.toggleNavigation);
  const { setTheme, theme } = useTheme();

  return (
    <div
      className={`min-h-screen bg-background text-foreground lg:grid ${
        isNavigationCollapsed
          ? 'lg:grid-cols-[5.5rem_1fr]'
          : 'lg:grid-cols-[17rem_1fr]'
      }`}
    >
      <aside
        aria-label="Primary navigation"
        className="hidden border-r border-divider bg-surface px-3 py-5 transition-[width] lg:flex lg:flex-col"
      >
        <div className="flex min-h-11 items-center justify-between gap-2 px-2">
          <span
            className={
              isNavigationCollapsed ? 'sr-only' : 'font-semibold tracking-tight'
            }
          >
            Devventory
          </span>
          <Button
            aria-label={
              isNavigationCollapsed
                ? 'Expand navigation'
                : 'Collapse navigation'
            }
            isIconOnly
            onPress={toggleNavigation}
            size="sm"
            variant="ghost"
          >
            <span aria-hidden="true">{isNavigationCollapsed ? '›' : '‹'}</span>
          </Button>
        </div>

        <nav className="mt-6 space-y-1">
          {navigationItems.map((item) => (
            <NavigationLink
              isCollapsed={isNavigationCollapsed}
              item={item}
              key={item.to}
            />
          ))}
        </nav>

        <div
          className={
            isNavigationCollapsed
              ? 'mt-auto flex justify-center'
              : 'mt-auto px-1'
          }
        >
          {isNavigationCollapsed ? (
            <Button
              aria-label="Use system theme"
              isIconOnly
              onPress={() => setTheme('system')}
              size="sm"
              variant="ghost"
            >
              <span aria-hidden="true">◐</span>
            </Button>
          ) : (
            <ThemeSelector onThemeChange={setTheme} theme={theme} />
          )}
        </div>
      </aside>

      <div className="min-w-0">
        <header className="border-b border-divider bg-surface px-4 py-3 lg:hidden">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="font-semibold tracking-tight">Devventory</span>
            <ThemeSelector onThemeChange={setTheme} theme={theme} />
          </div>
          <nav aria-label="Primary navigation" className="mt-3 flex gap-2">
            {navigationItems.map((item) => (
              <NavLink
                className={({ isActive }) =>
                  `rounded-lg px-3 py-2 text-sm font-medium ${
                    isActive
                      ? 'bg-accent-soft text-accent-soft-foreground'
                      : 'text-muted'
                  }`
                }
                end={item.to === '/'}
                key={item.to}
                to={item.to}
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
        </header>

        <main className="px-5 py-10 sm:px-8 lg:px-12 lg:py-14">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
