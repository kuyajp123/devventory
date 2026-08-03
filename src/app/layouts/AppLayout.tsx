import { Button, useTheme } from '@heroui/react';
import {
  IconActivityHeartbeat,
  IconDeviceDesktop,
  IconFolders,
  IconHome,
  IconLayoutSidebarLeftCollapse,
  IconLayoutSidebarLeftExpand,
  IconMoon,
  IconSun,
} from '@tabler/icons-react';
import { NavLink, Outlet } from 'react-router';
import { ICON_SIZE, ICON_STROKE } from '@/shared/constants/icon.constants';
import { useAppUiStore } from '../stores/app-ui.store';

const navigationItems = [
  { icon: IconHome, label: 'Home', to: '/' },
  { icon: IconFolders, label: 'Projects', to: '/projects' },
  { icon: IconActivityHeartbeat, label: 'Diagnostics', to: '/diagnostics' },
];

const themeOptions = [
  { icon: IconDeviceDesktop, label: 'system', value: 'system' },
  { icon: IconSun, label: 'light', value: 'light' },
  { icon: IconMoon, label: 'dark', value: 'dark' },
] as const;

interface ThemeSelectorProps {
  onThemeChange: (theme: string) => void;
  theme: string;
}

function ThemeSelector({ onThemeChange, theme }: ThemeSelectorProps) {
  return (
    <div
      aria-label="Color theme"
      className="inline-flex w-full items-center justify-between rounded-full border border-divider bg-surface p-1 shadow-xs"
      role="group"
    >
      {themeOptions.map((option) => {
        const isActive = theme === option.value;
        return (
          <Button
            key={option.value}
            aria-label={`${option.label} theme`}
            aria-pressed={isActive}
            className={`flex-1 rounded-full py-1.5 transition-colors ${
              isActive
                ? 'bg-accent-soft text-accent-soft-foreground shadow-xs'
                : 'text-muted hover:bg-surface-secondary hover:text-foreground'
            }`}
            isIconOnly
            onPress={() => onThemeChange(option.value)}
            size="sm"
            variant="ghost"
          >
            <option.icon
              aria-hidden="true"
              size={ICON_SIZE.button}
              stroke={ICON_STROKE}
            />
          </Button>
        );
      })}
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
      <item.icon
        aria-hidden="true"
        className="shrink-0"
        size={ICON_SIZE.navigation}
        stroke={ICON_STROKE}
      />
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
        className="sticky top-0 hidden h-screen max-h-screen flex-col border-r border-divider bg-surface px-3 py-5 transition-[width] lg:flex"
      >
        <div className="flex min-h-11 shrink-0 items-center justify-between gap-2 px-2">
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
            {isNavigationCollapsed ? (
              <IconLayoutSidebarLeftExpand
                aria-hidden="true"
                size={ICON_SIZE.button}
                stroke={ICON_STROKE}
              />
            ) : (
              <IconLayoutSidebarLeftCollapse
                aria-hidden="true"
                size={ICON_SIZE.button}
                stroke={ICON_STROKE}
              />
            )}
          </Button>
        </div>

        <nav className="mt-6 flex-1 space-y-1 overflow-y-auto">
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
              ? 'mt-auto flex shrink-0 justify-center pt-4'
              : 'mt-auto shrink-0 px-1 pt-4'
          }
        >
          {isNavigationCollapsed ? (
            <Button
              aria-label={`Current theme: ${theme}. Click to change theme.`}
              isIconOnly
              onPress={() => {
                const nextTheme =
                  theme === 'light'
                    ? 'dark'
                    : theme === 'dark'
                      ? 'system'
                      : 'light';
                setTheme(nextTheme);
              }}
              size="sm"
              variant="ghost"
            >
              {theme === 'light' ? (
                <IconSun
                  aria-hidden="true"
                  size={ICON_SIZE.button}
                  stroke={ICON_STROKE}
                />
              ) : theme === 'dark' ? (
                <IconMoon
                  aria-hidden="true"
                  size={ICON_SIZE.button}
                  stroke={ICON_STROKE}
                />
              ) : (
                <IconDeviceDesktop
                  aria-hidden="true"
                  size={ICON_SIZE.button}
                  stroke={ICON_STROKE}
                />
              )}
            </Button>
          ) : (
            <ThemeSelector onThemeChange={setTheme} theme={theme ?? 'system'} />
          )}
        </div>
      </aside>

      <div className="min-w-0">
        <header className="border-b border-divider bg-surface px-4 py-3 lg:hidden">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="font-semibold tracking-tight">Devventory</span>
            <ThemeSelector onThemeChange={setTheme} theme={theme ?? 'system'} />
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
