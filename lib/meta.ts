import { browser } from 'wxt/browser';
import type { Draft, PageInfo } from './types';
import { detectType, getYouTubeId, hostnameOf, parseUrl } from './url';

/**
 * ВАЖНО: эта функция сериализуется и выполняется в контексте страницы
 * через browser.scripting.executeScript. Она не должна ссылаться на импорты
 * или переменные модуля — только на то, что есть внутри неё самой.
 */
export function collectPageInfo(): PageInfo {
  const content = (selector: string): string => {
    const el = document.querySelector(selector);
    if (!el) return '';
    const value = el.getAttribute('content');
    if (value) return value.trim();
    const text = (el as HTMLElement).textContent;
    return text ? text.trim() : '';
  };

  const first = (...selectors: string[]): string => {
    for (const selector of selectors) {
      const value = content(selector);
      if (value) return value;
    }
    return '';
  };

  const meta = (name: string): string =>
    first(`meta[property="${name}"]`, `meta[name="${name}"]`, `meta[itemprop="${name}"]`);

  const canonicalEl = document.querySelector('link[rel="canonical"]');
  const iconEl =
    document.querySelector('link[rel="icon"]') ||
    document.querySelector('link[rel="shortcut icon"]') ||
    document.querySelector('link[rel="apple-touch-icon"]');

  const video = document.querySelector('video');
  let duration = 0;
  let currentTime = 0;
  if (video) {
    if (Number.isFinite(video.duration)) duration = Math.round(video.duration);
    if (Number.isFinite(video.currentTime)) currentTime = Math.round(video.currentTime);
  }

  if (!duration) {
    const iso = document.querySelector('meta[itemprop="duration"]')?.getAttribute('content') ?? '';
    const match = iso.match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?$/i);
    if (match) {
      duration =
        Number(match[1] ?? 0) * 3600 + Number(match[2] ?? 0) * 60 + Math.round(Number(match[3] ?? 0));
    }
  }

  const author =
    first('#owner #channel-name a', '#owner a.yt-simple-endpoint', 'link[itemprop="name"]') ||
    meta('author') ||
    meta('article:author') ||
    meta('og:site_name');

  let title = meta('og:title') || meta('twitter:title') || document.title || '';
  title = title.replace(/\s*[-–—]\s*YouTube$/i, '').trim();

  const description = (meta('og:description') || meta('description') || '').slice(0, 600);

  return {
    url: location.href,
    title,
    description,
    image: meta('og:image') || meta('twitter:image') || meta('og:image:url'),
    siteName: meta('og:site_name'),
    ogType: meta('og:type'),
    author,
    canonical: canonicalEl ? (canonicalEl as HTMLLinkElement).href : '',
    favicon: iconEl ? (iconEl as HTMLLinkElement).href : '',
    durationSec: duration > 0 ? duration : undefined,
    currentTimeSec: currentTime > 0 ? currentTime : undefined,
    hasVideo: Boolean(video) || meta('og:type').startsWith('video'),
  };
}

export async function collectFromTab(tabId: number): Promise<PageInfo | null> {
  try {
    const [injection] = await browser.scripting.executeScript({
      target: { tabId },
      func: collectPageInfo,
    });
    return (injection?.result as PageInfo | undefined) ?? null;
  } catch {
    // chrome://, Web Store и прочие страницы, куда нельзя внедриться
    return null;
  }
}

export function draftFromInfo(
  info: PageInfo | null,
  fallback: { url: string; title?: string; faviconUrl?: string },
): Draft {
  const originalUrl = info?.url || fallback.url;
  const parsed = parseUrl(info?.canonical || originalUrl);
  const youtubeId = getYouTubeId(originalUrl) ?? parsed.youtubeId;

  const thumbnailUrl =
    info?.image || (youtubeId ? `https://i.ytimg.com/vi/${youtubeId}/hqdefault.jpg` : '');

  const title =
    (info?.title || fallback.title || '').trim() || hostnameOf(originalUrl) || originalUrl;

  const type = detectType({
    url: parsed.canonical,
    source: parsed.source,
    ogType: info?.ogType,
    hasVideo: info?.hasVideo,
    youtubeId,
    title,
  });

  const startAtSec =
    type === 'video' && info?.currentTimeSec && info.currentTimeSec > 10
      ? info.currentTimeSec
      : parsed.startAtSec;

  return {
    url: parsed.canonical,
    originalUrl,
    title,
    description: info?.description ?? '',
    type,
    source: parsed.source || hostnameOf(originalUrl),
    thumbnailUrl,
    author: info?.author ?? '',
    durationSec: info?.durationSec,
    startAtSec,
    favicon: info?.favicon || fallback.faviconUrl || '',
  };
}

export async function buildDraftForTab(tab: {
  id?: number;
  url?: string;
  title?: string;
  favIconUrl?: string;
}): Promise<Draft | null> {
  const url = tab.url ?? '';
  if (!/^https?:\/\//i.test(url)) return null;

  const info = tab.id != null ? await collectFromTab(tab.id) : null;
  return draftFromInfo(info, {
    url,
    title: tab.title,
    faviconUrl: tab.favIconUrl,
  });
}
