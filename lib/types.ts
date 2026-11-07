export type ItemType = 'video' | 'article' | 'repo' | 'other';
export type ItemStatus = 'later' | 'done' | 'archived';

export interface Item {
  id: string;
  /** Канонический адрес, по нему же ищем дубли. */
  url: string;
  /** Адрес, который был в браузере (без нормализации кроме t=). */
  originalUrl: string;
  title: string;
  /** Короткая заметка «зачем сохранил». */
  note: string;
  /** Описание страницы (og:description), если было. */
  description: string;
  type: ItemType;
  /** Домен-источник: youtube, vimeo, github, ... */
  source: string;
  thumbnailUrl: string;
  author: string;
  durationSec?: number;
  /** С какой секунды начинать просмотр. */
  startAtSec?: number;
  tagIds: string[];
  status: ItemStatus;
  favorite?: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface Tag {
  id: string;
  name: string;
  color: string;
}

/** Данные, которые content-скрипт собирает со страницы. */
export interface PageInfo {
  url: string;
  title: string;
  description: string;
  image: string;
  siteName: string;
  ogType: string;
  author: string;
  canonical: string;
  favicon: string;
  durationSec?: number;
  currentTimeSec?: number;
  hasVideo: boolean;
}

/** Черновик записи для формы в popup. */
export interface Draft {
  url: string;
  originalUrl: string;
  title: string;
  description: string;
  type: ItemType;
  source: string;
  thumbnailUrl: string;
  author: string;
  durationSec?: number;
  startAtSec?: number;
  favicon: string;
}

export interface BackupFile {
  app: 'video-later';
  version: number;
  exportedAt: number;
  items: Item[];
  tags: Tag[];
}
