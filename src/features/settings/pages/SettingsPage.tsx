import { IconBell, IconDeviceDesktop, IconSettings } from '@tabler/icons-react';
import { NavLink, Outlet } from 'react-router';
import { ICON_SIZE, ICON_STROKE } from '@/shared/constants/icon.constants';

const settingsSections = [
  {
    icon: IconBell,
    label: 'Notifications',
    to: '/settings/notifications',
  },
  {
    icon: IconDeviceDesktop,
    label: 'Background & Startup',
    to: '/settings/background-startup',
  },
];

export function SettingsPage() {
  return (
    <section className="mx-auto w-full max-w-4xl space-y-6">
      <header className="border-b border-divider pb-3 space-y-1">
        <div className="flex items-center gap-2">
          <IconSettings
            aria-hidden="true"
            className="shrink-0 text-accent"
            size={ICON_SIZE.navigation}
            stroke={ICON_STROKE}
          />
          <h1 className="font-mono text-xl font-bold tracking-tight text-foreground sm:text-2xl">
            Settings
          </h1>
        </div>
        <p className="text-xs text-muted max-w-2xl">
          Global application configuration and preferences.
        </p>
      </header>

      <div className="flex flex-col gap-6 sm:flex-row">
        {/* Left Section Navigation */}
        <nav
          aria-label="Settings section navigation"
          className="w-full shrink-0 space-y-1 sm:w-52"
        >
          {settingsSections.map((section) => (
            <NavLink
              className={({ isActive }) =>
                `flex items-center gap-2.5 rounded-md px-3 py-2 text-xs font-medium transition-colors ${
                  isActive
                    ? 'bg-elevated text-accent font-semibold'
                    : 'text-muted hover:bg-surface hover:text-foreground'
                }`
              }
              key={section.to}
              to={section.to}
            >
              <section.icon aria-hidden="true" size={16} stroke={ICON_STROKE} />
              <span>{section.label}</span>
            </NavLink>
          ))}
        </nav>

        {/* Right Section Content View */}
        <div className="min-w-0 flex-1">
          <Outlet />
        </div>
      </div>
    </section>
  );
}
