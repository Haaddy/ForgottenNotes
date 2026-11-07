import { defineBackground } from 'wxt/utils/define-background';
import { browser } from 'wxt/browser';
import { buildDraftForTab } from '../lib/meta';
import { findItemByUrl, saveItem } from '../lib/db';
import { detectType, getYouTubeId, hostnameOf, isSavableUrl, parseUrl } from '../lib/url';

type TabLike = {
  id?: number;
  url?: string;
  title?: string;
  favIconUrl?: string;
};

let badgeTimer: ReturnType<typeof setTimeout> | undefined;

async function flashBadge(text: string, color: string): Promise<void> {
  try {
    await browser.action.setBadgeBackgroundColor({ color });
    await browser.action.setBadgeText({ text });
    if (badgeTimer) clearTimeout(badgeTimer);
    badgeTimer = setTimeout(() => {
      void browser.action.setBadgeText({ text: '' });
    }, 2500);
  } catch {
    // badge не критичен
  }
}

async function saveTab(tab: TabLike): Promise<boolean> {
  if (!tab.url || !isSavableUrl(tab.url)) {
    await flashBadge('!', '#f59e0b');
    return false;
  }

  const draft = await buildDraftForTab(tab);
  if (!draft) {
    await flashBadge('!', '#f59e0b');
    return false;
  }

  const existing = await findItemByUrl(draft.url);
  await saveItem({
    ...draft,
    status: existing?.status ?? 'later',
  });

  await flashBadge(existing ? '↻' : '✓', existing ? '#6366f1' : '#10b981');
  return true;
}

async function saveLink(rawUrl: string): Promise<void> {
  if (!isSavableUrl(rawUrl)) {
    await flashBadge('!', '#f59e0b');
    return;
  }

  const parsed = parseUrl(rawUrl);
  const youtubeId = getYouTubeId(rawUrl);
  const existing = await findItemByUrl(parsed.canonical);

  await saveItem({
    url: parsed.canonical,
    originalUrl: rawUrl,
    title: hostnameOf(rawUrl),
    type: detectType({ url: parsed.canonical, source: parsed.source, youtubeId }),
    source: parsed.source,
    thumbnailUrl: youtubeId ? `https://i.ytimg.com/vi/${youtubeId}/hqdefault.jpg` : '',
    startAtSec: parsed.startAtSec,
    status: existing?.status ?? 'later',
  });

  await flashBadge(existing ? '↻' : '✓', existing ? '#6366f1' : '#10b981');
}

async function setupContextMenus(): Promise<void> {
  await browser.contextMenus.removeAll();

  browser.contextMenus.create({
    id: 'vl-save-page',
    title: 'Сохранить в Video Later',
    contexts: ['page'],
    documentUrlPatterns: ['http://*/*', 'https://*/*'],
  });

  browser.contextMenus.create({
    id: 'vl-save-link',
    title: 'Сохранить ссылку в Video Later',
    contexts: ['link'],
    targetUrlPatterns: ['http://*/*', 'https://*/*'],
  });
}

export default defineBackground(() => {
  browser.runtime.onInstalled.addListener((details) => {
    void setupContextMenus();
    if (details.reason === 'install') {
      void browser.tabs.create({ url: browser.runtime.getURL('/library.html') });
    }
  });

  browser.runtime.onStartup.addListener(() => {
    void setupContextMenus();
  });

  browser.commands.onCommand.addListener((command) => {
    if (command !== 'save-current-tab') return;
    void (async () => {
      const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
      if (tab) await saveTab(tab);
    })();
  });

  browser.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId === 'vl-save-page') {
      void saveTab(tab ?? {});
      return;
    }
    if (info.menuItemId === 'vl-save-link' && info.linkUrl) {
      void saveLink(info.linkUrl);
    }
  });
});
