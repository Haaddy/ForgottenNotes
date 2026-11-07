import Dexie, { type Table } from 'dexie';
import { nanoid } from 'nanoid';
import type { Item, ItemStatus, ItemType, Tag } from './types';
import { parseUrl } from './url';
import { colorForName } from './tags';

class VideoLaterDb extends Dexie {
  items!: Table<Item, string>;
  tags!: Table<Tag, string>;

  constructor() {
    super('video-later');
    this.version(1).stores({
      items: 'id, url, type, status, createdAt, updatedAt, *tagIds',
      tags: 'id, &name',
    });
  }
}

export const db = new VideoLaterDb();

/* ------------------------------ синхронизация вкладок ------------------------------ */

const CHANGE_CHANNEL = 'video-later:changed';

function getChannel(): BroadcastChannel | null {
  try {
    return typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel(CHANGE_CHANNEL) : null;
  } catch {
    return null;
  }
}

const notifyChannel = getChannel();

export function notifyChange(): void {
  notifyChannel?.postMessage(Date.now());
}

/** Подписка на изменения из других контекстов (popup <-> библиотека). */
export function onLibraryChange(callback: () => void): () => void {
  const channel = getChannel();
  if (!channel) return () => {};
  const handler = () => callback();
  channel.addEventListener('message', handler);
  return () => {
    channel.removeEventListener('message', handler);
    channel.close();
  };
}

/* ------------------------------------ теги ------------------------------------ */

export async function ensureTags(rawNames: string[]): Promise<Tag[]> {
  const names = [...new Set(rawNames.map((name) => name.trim()).filter(Boolean))];
  if (!names.length) return [];

  const all = await db.tags.toArray();
  const byLower = new Map(all.map((tag) => [tag.name.toLowerCase(), tag] as const));
  const result: Tag[] = [];
  const toCreate: Tag[] = [];

  for (const name of names) {
    const existing = byLower.get(name.toLowerCase());
    if (existing) {
      result.push(existing);
      continue;
    }
    const tag: Tag = { id: nanoid(), name, color: colorForName(name) };
    byLower.set(name.toLowerCase(), tag);
    toCreate.push(tag);
    result.push(tag);
  }

  if (toCreate.length) await db.tags.bulkAdd(toCreate);
  return result;
}

export async function deleteTag(tagId: string): Promise<void> {
  await db.transaction('rw', db.tags, db.items, async () => {
    await db.tags.delete(tagId);
    await db.items
      .where('tagIds')
      .equals(tagId)
      .modify((item) => {
        item.tagIds = item.tagIds.filter((id) => id !== tagId);
        item.updatedAt = Date.now();
      });
  });
  notifyChange();
}

export async function renameTag(tagId: string, name: string): Promise<void> {
  const clean = name.trim();
  if (!clean) return;
  await db.tags.update(tagId, { name: clean, color: colorForName(clean) });
  notifyChange();
}

/* ----------------------------------- записи ----------------------------------- */

export async function findItemByUrl(url: string): Promise<Item | undefined> {
  if (!url.trim()) return undefined;
  const canonical = parseUrl(url).canonical;
  return db.items.where('url').equals(canonical).first();
}

export interface SaveInput {
  url: string;
  originalUrl?: string;
  title: string;
  note?: string;
  description?: string;
  type: ItemType;
  source?: string;
  thumbnailUrl?: string;
  author?: string;
  durationSec?: number;
  startAtSec?: number;
  tagNames?: string[];
  status?: ItemStatus;
}

export interface SaveResult {
  item: Item;
  created: boolean;
}

/**
 * Сохраняет запись. Если такая ссылка уже есть — обновляет её
 * (дописывает заметку и добавляет теги), а не создаёт дубль.
 */
export async function saveItem(input: SaveInput): Promise<SaveResult> {
  const parsed = input.url.trim() ? parseUrl(input.url) : { canonical: '', source: '' };
  const canonical = parsed.canonical;
  const tags = await ensureTags(input.tagNames ?? []);
  const tagIds = tags.map((tag) => tag.id);
  const now = Date.now();

  const existing = canonical ? await db.items.where('url').equals(canonical).first() : undefined;

  if (existing) {
    const note = input.note?.trim();
    const mergedTagIds = [...new Set([...existing.tagIds, ...tagIds])];
    const updated: Item = {
      ...existing,
      title: input.title.trim() || existing.title,
      note: note ? note : existing.note,
      description: input.description?.trim() || existing.description,
      type: input.type,
      thumbnailUrl: input.thumbnailUrl || existing.thumbnailUrl,
      author: input.author || existing.author,
      durationSec: input.durationSec ?? existing.durationSec,
      startAtSec: input.startAtSec ?? existing.startAtSec,
      tagIds: mergedTagIds,
      status: input.status ?? existing.status,
      updatedAt: now,
    };
    await db.items.put(updated);
    notifyChange();
    return { item: updated, created: false };
  }

  const item: Item = {
    id: nanoid(),
    url: canonical,
    originalUrl: input.originalUrl || input.url,
    title: input.title.trim() || canonical,
    note: input.note?.trim() ?? '',
    description: input.description?.trim() ?? '',
    type: input.type,
    source: input.source ?? parsed.source,
    thumbnailUrl: input.thumbnailUrl ?? '',
    author: input.author ?? '',
    durationSec: input.durationSec,
    startAtSec: input.startAtSec,
    tagIds,
    status: input.status ?? 'later',
    createdAt: now,
    updatedAt: now,
  };

  await db.items.add(item);
  notifyChange();
  return { item, created: true };
}

export async function updateItem(id: string, patch: Partial<Item>): Promise<void> {
  await db.items.update(id, { ...patch, updatedAt: Date.now() });
  notifyChange();
}

export async function updateItemTags(id: string, tagNames: string[]): Promise<void> {
  const tags = await ensureTags(tagNames);
  await updateItem(id, { tagIds: tags.map((tag) => tag.id) });
}

export async function deleteItems(ids: string[]): Promise<void> {
  await db.items.bulkDelete(ids);
  notifyChange();
}

export async function setItemsStatus(ids: string[], status: ItemStatus): Promise<void> {
  await db.transaction('rw', db.items, async () => {
    for (const id of ids) {
      await db.items.update(id, { status, updatedAt: Date.now() });
    }
  });
  notifyChange();
}

/* ----------------------------------- бэкап ----------------------------------- */

export async function exportBackup(): Promise<void> {
  const [items, tags] = await Promise.all([db.items.toArray(), db.tags.toArray()]);
  const payload = {
    app: 'video-later',
    version: 1,
    exportedAt: Date.now(),
    items,
    tags,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const date = new Date().toISOString().slice(0, 10);
  link.href = url;
  link.download = `video-later-${date}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function importBackup(file: File): Promise<{ items: number; tags: number }> {
  const text = await file.text();
  const data = JSON.parse(text) as {
    app?: string;
    items?: Item[];
    tags?: Tag[];
  };

  if (data.app !== 'video-later' || !Array.isArray(data.items)) {
    throw new Error('Это не файл резервной копии Video Later');
  }

  const items = data.items.filter(
    (item) => item && typeof item.id === 'string' && typeof item.url === 'string',
  );
  const tags = Array.isArray(data.tags)
    ? data.tags.filter((tag) => tag && typeof tag.id === 'string' && typeof tag.name === 'string')
    : [];

  await db.transaction('rw', db.items, db.tags, async () => {
    await db.items.clear();
    await db.tags.clear();
    if (tags.length) await db.tags.bulkAdd(tags);
    if (items.length) await db.items.bulkAdd(items);
  });

  notifyChange();
  return { items: items.length, tags: tags.length };
}

export async function clearLibrary(): Promise<void> {
  await db.transaction('rw', db.items, db.tags, async () => {
    await db.items.clear();
    await db.tags.clear();
  });
  notifyChange();
}
