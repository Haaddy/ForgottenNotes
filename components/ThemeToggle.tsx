import { useState } from 'react';
import { getStoredTheme, nextTheme, setTheme, type ThemeMode } from '../lib/theme';
import { MonitorIcon, MoonIcon, SunIcon } from './Icons';

export function ThemeToggle({ className = '' }: { className?: string }) {
  const [mode, setMode] = useState<ThemeMode>(() => getStoredTheme());

  const labels: Record<ThemeMode, string> = {
    system: 'Тема: как в системе',
    light: 'Тема: светлая',
    dark: 'Тема: тёмная',
  };

  return (
    <button
      type="button"
      className={`btn-ghost rounded-lg p-2 ${className}`}
      title={`${labels[mode]} (нажмите, чтобы сменить)`}
      aria-label={labels[mode]}
      onClick={() => {
        const next = nextTheme(mode);
        setTheme(next);
        setMode(next);
      }}
    >
      {mode === 'system' ? (
        <MonitorIcon />
      ) : mode === 'light' ? (
        <SunIcon />
      ) : (
        <MoonIcon />
      )}
    </button>
  );
}
