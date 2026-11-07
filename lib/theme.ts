export type ThemeMode = 'light' | 'dark' | 'system';

const STORAGE_KEY = 'video-later:theme';

export function getStoredTheme(): ThemeMode {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    if (value === 'light' || value === 'dark' || value === 'system') return value;
  } catch {
    // ignore
  }
  return 'system';
}

function prefersDark(): boolean {
  return typeof matchMedia !== 'undefined' && matchMedia('(prefers-color-scheme: dark)').matches;
}

export function resolveDark(mode: ThemeMode): boolean {
  return mode === 'dark' || (mode === 'system' && prefersDark());
}

export function applyTheme(mode: ThemeMode): void {
  const dark = resolveDark(mode);
  const root = document.documentElement;
  root.classList.toggle('dark', dark);
  root.style.colorScheme = dark ? 'dark' : 'light';
}

export function setTheme(mode: ThemeMode): void {
  try {
    localStorage.setItem(STORAGE_KEY, mode);
  } catch {
    // ignore
  }
  applyTheme(mode);
}

/** Применяет тему и следит за системной темой. Возвращает функцию очистки. */
export function initTheme(): () => void {
  applyTheme(getStoredTheme());
  const media = matchMedia('(prefers-color-scheme: dark)');
  const onChange = () => {
    if (getStoredTheme() === 'system') applyTheme('system');
  };
  media.addEventListener('change', onChange);
  return () => media.removeEventListener('change', onChange);
}

export function nextTheme(mode: ThemeMode): ThemeMode {
  if (mode === 'system') return 'light';
  if (mode === 'light') return 'dark';
  return 'system';
}
