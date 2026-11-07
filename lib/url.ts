import type { ItemType } from './types';

const TRACKING_PARAMS = [
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_term',
  'utm_content',
  'utm_id',
  'utm_name',
  'si',
  'feature',
  'fbclid',
  'gclid',
  'dclid',
  'msclkid',
  'igshid',
  'mc_cid',
  'mc_eid',
  'yclid',
  'spm',
  '_hsenc',
  '_hsmi',
];

const YOUTUBE_HOSTS = new Set([
  'youtube.com',
  'm.youtube.com',
  'music.youtube.com',
  'youtu.be',
  'www.youtube.com',
  'www.youtu.be',
]);

export interface ParsedUrl {
  canonical: string;
  source: string;
  youtubeId?: string;
  startAtSec?: number;
  isVideoHost: boolean;
}

/** Достаёт ID видео из любого вида ссылки YouTube. */
export function getYouTubeId(raw: string): string | undefined {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return undefined;
  }
  const host = u.hostname.toLowerCase();
  if (!YOUTUBE_HOSTS.has(host)) return undefined;

  if (host.endsWith('youtu.be')) {
    const id = u.pathname.split('/').filter(Boolean)[0];
    return id && /^[\w-]{6,}$/.test(id) ? id : undefined;
  }

  const v = u.searchParams.get('v');
  if (v) return v;

  const m = u.pathname.match(/^\/(?:shorts|embed|live|v)\/([\w-]{6,})/);
  return m?.[1];
}

/** "1h2m3s", "90", "1:30" -> секунды */
export function parseTime(value: string | null | undefined): number | undefined {
  if (!value) return undefined;
  const clean = value.trim().toLowerCase();
  if (!clean) return undefined;

  if (/^\d+$/.test(clean)) {
    const n = Number(clean);
    return Number.isFinite(n) && n >= 0 ? n : undefined;
  }

  if (/^\d{1,2}(:\d{1,2}){1,2}$/.test(clean)) {
    const parts = clean.split(':').map(Number);
    return parts.reduce((acc, part) => acc * 60 + part, 0);
  }

  const match = clean.match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/);
  if (!match) return undefined;
  const [, h, m, s] = match;
  if (!h && !m && !s) return undefined;
  return Number(h ?? 0) * 3600 + Number(m ?? 0) * 60 + Number(s ?? 0);
}

/** ISO-8601 (PT1H2M3S) -> секунды */
export function parseIsoDuration(value: string | null | undefined): number | undefined {
  if (!value) return undefined;
  const match = value.match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?$/i);
  if (!match) return undefined;
  const [, h, m, s] = match;
  return Math.round(Number(h ?? 0) * 3600 + Number(m ?? 0) * 60 + Number(s ?? 0));
}

/**
 * Приводит ссылку к стабильному виду:
 * - выбрасывает utm-метки и прочий мусор;
 * - сортирует параметры, чтобы `?a=1&b=2` и `?b=2&a=1` совпадали;
 * - для YouTube оставляет только `v`, `list`, `index`.
 */
export function parseUrl(raw: string): ParsedUrl {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return { canonical: raw, source: '', isVideoHost: false };
  }

  const youtubeId = getYouTubeId(raw);
  const startAtSec =
    parseTime(u.searchParams.get('t')) ?? parseTime(u.searchParams.get('start'));

  if (youtubeId) {
    const params = new URLSearchParams();
    params.set('v', youtubeId);
    const list = u.searchParams.get('list');
    if (list) {
      params.set('list', list);
      const index = u.searchParams.get('index');
      if (index) params.set('index', index);
    }
    const canonical = `https://www.youtube.com/watch?${params.toString()}`;
    return {
      canonical,
      source: 'youtube',
      youtubeId,
      startAtSec,
      isVideoHost: true,
    };
  }

  const host = u.hostname.replace(/^www\./, '').toLowerCase();
  const params = new URLSearchParams();
  const entries = [...u.searchParams.entries()]
    .filter(([key]) => !TRACKING_PARAMS.includes(key.toLowerCase()))
    .sort(([a], [b]) => a.localeCompare(b));
  for (const [key, value] of entries) params.append(key, value);

  u.search = params.toString();
  u.hash = u.hash === '#' ? '' : u.hash;

  const isVideoHost =
    host === 'vimeo.com' ||
    host.endsWith('rutube.ru') ||
    host.endsWith('dailymotion.com') ||
    host.endsWith('twitch.tv') ||
    host.endsWith('tiktok.com');

  const source = host === 'vimeo.com' ? 'vimeo' : host.endsWith('rutube.ru') ? 'rutube' : host;

  return {
    canonical: u.toString(),
    source,
    isVideoHost,
    startAtSec,
  };
}

/** Ссылка для открытия: с учётом сохранённого таймкода. */
export function urlForItem(url: string, type: ItemType, startAtSec?: number): string {
  if (type !== 'video' || !startAtSec || startAtSec < 1) return url;
  try {
    const u = new URL(url);
    if (getYouTubeId(url)) {
      u.searchParams.set('t', `${Math.floor(startAtSec)}s`);
    } else {
      u.hash = `t=${Math.floor(startAtSec)}`;
    }
    return u.toString();
  } catch {
    return url;
  }
}

export function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

export function detectType(options: {
  url: string;
  source: string;
  ogType?: string;
  hasVideo?: boolean;
  youtubeId?: string;
  title?: string;
}): ItemType {
  const { url, source, ogType = '', hasVideo, youtubeId } = options;
  const host = hostnameOf(url);

  if (youtubeId || hasVideo || ogType.startsWith('video') || source === 'vimeo' || source === 'rutube') {
    return 'video';
  }
  if (host === 'github.com' || host === 'gitlab.com' || host === 'bitbucket.org' || host === 'codeberg.org') {
    return 'repo';
  }
  if (ogType === 'article' || /(^|\.)(habr\.com|medium\.com|dev\.to|substack\.com|reddit\.com|news\.ycombinator\.com)$/.test(host)) {
    return 'article';
  }
  return 'other';
}

/** Можно ли сохранять этот адрес. */
export function isSavableUrl(raw: string): boolean {
  return /^https?:\/\//i.test(raw);
}
