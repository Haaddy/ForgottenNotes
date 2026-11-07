import { useState } from 'react';
import type { Item, ItemStatus, Tag } from '../lib/types';
import { formatDate, formatDuration } from '../lib/format';
import { hostnameOf, urlForItem } from '../lib/url';
import { TYPE_LABELS, TypeIcon } from './type-icon';
import { TagChip } from './TagChip';
import {
  ArchiveIcon,
  CheckIcon,
  ExternalIcon,
  PencilIcon,
  RotateIcon,
  StarIcon,
  TrashIcon,
} from './Icons';

interface ItemCardProps {
  item: Item;
  tags: Tag[];
  selected: boolean;
  layout: 'grid' | 'list';
  onToggleSelect: (id: string) => void;
  onEdit: (item: Item) => void;
  onDelete: (item: Item) => void;
  onStatus: (item: Item, status: ItemStatus) => void;
  onToggleFavorite: (item: Item) => void;
}

function sourceLabel(item: Item): string {
  const source = item.source.toLowerCase();
  if (source.includes('youtube')) return 'YouTube';
  if (source.includes('vimeo')) return 'Vimeo';
  if (source.includes('rutube')) return 'Rutube';
  if (source === 'github.com' || source === 'gitlab.com') return 'Код';
  return TYPE_LABELS[item.type];
}

export function ItemCard({
  item,
  tags,
  selected,
  layout,
  onToggleSelect,
  onEdit,
  onDelete,
  onStatus,
  onToggleFavorite,
}: ItemCardProps) {
  const [thumbFailed, setThumbFailed] = useState(false);
  const href = urlForItem(item.url, item.type, item.startAtSec);
  const itemTags = item.tagIds
    .map((id) => tags.find((tag) => tag.id === id))
    .filter((tag): tag is Tag => Boolean(tag));

  const thumb = (
    <div
      className={`relative overflow-hidden bg-neutral-100 dark:bg-neutral-800 ${
        layout === 'grid' ? 'aspect-video w-full rounded-t-xl' : 'h-[74px] w-[130px] shrink-0 rounded-lg'
      }`}
    >
      {item.thumbnailUrl && !thumbFailed ? (
        <img
          src={item.thumbnailUrl}
          alt=""
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={() => setThumbFailed(true)}
          className="h-full w-full object-cover"
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-indigo-500/15 via-violet-500/10 to-sky-500/15 text-indigo-500 dark:text-indigo-300">
          <TypeIcon type={item.type} className={layout === 'grid' ? 'h-9 w-9' : 'h-6 w-6'} />
        </div>
      )}

      <span className="absolute left-1.5 top-1.5 rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
        {sourceLabel(item)}
      </span>

      {item.durationSec ? (
        <span className="absolute bottom-1.5 right-1.5 rounded bg-black/75 px-1.5 py-0.5 text-[10px] font-medium text-white">
          {formatDuration(item.durationSec)}
        </span>
      ) : null}

      {item.startAtSec ? (
        <span className="absolute bottom-1.5 left-1.5 rounded bg-black/60 px-1.5 py-0.5 text-[10px] text-white">
          с {formatDuration(item.startAtSec)}
        </span>
      ) : null}
    </div>
  );

  const actions = (
    <div className="flex items-center gap-0.5">
      <button
        type="button"
        className={`btn-ghost rounded-md p-1.5 ${item.favorite ? 'text-amber-500 hover:text-amber-600' : ''}`}
        title={item.favorite ? 'Убрать из избранного' : 'В избранное'}
        aria-label={item.favorite ? 'Убрать из избранного' : 'В избранное'}
        aria-pressed={Boolean(item.favorite)}
        onClick={() => onToggleFavorite(item)}
      >
        <StarIcon className="h-4 w-4" fill={item.favorite ? 'currentColor' : 'none'} />
      </button>
      <a
        href={href}
        target="_blank"
        rel="noreferrer"
        className="btn-ghost rounded-md p-1.5"
        title="Открыть ссылку"
        onClick={(event) => event.stopPropagation()}
      >
        <ExternalIcon className="h-4 w-4" />
      </a>
      <button
        type="button"
        className="btn-ghost rounded-md p-1.5"
        title="Редактировать"
        onClick={() => onEdit(item)}
      >
        <PencilIcon className="h-4 w-4" />
      </button>
      {item.status === 'done' ? (
        <button
          type="button"
          className="btn-ghost rounded-md p-1.5"
          title="Вернуть в «посмотреть»"
          onClick={() => onStatus(item, 'later')}
        >
          <RotateIcon className="h-4 w-4" />
        </button>
      ) : (
        <button
          type="button"
          className="btn-ghost rounded-md p-1.5"
          title="Отметить просмотренным"
          onClick={() => onStatus(item, 'done')}
        >
          <CheckIcon className="h-4 w-4" />
        </button>
      )}
      <button
        type="button"
        className="btn-ghost rounded-md p-1.5"
        title={item.status === 'archived' ? 'Вернуть из архива' : 'В архив'}
        onClick={() => onStatus(item, item.status === 'archived' ? 'later' : 'archived')}
      >
        <ArchiveIcon className="h-4 w-4" />
      </button>
      <button
        type="button"
        className="btn-ghost rounded-md p-1.5 hover:text-rose-600 dark:hover:text-rose-400"
        title="Удалить"
        onClick={() => onDelete(item)}
      >
        <TrashIcon className="h-4 w-4" />
      </button>
    </div>
  );

  const title = (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      title={item.title}
      className={`font-medium leading-snug text-neutral-900 transition hover:text-indigo-600 dark:text-neutral-100 dark:hover:text-indigo-400 ${
        item.status === 'done' ? 'line-through decoration-neutral-400/70' : ''
      } ${layout === 'grid' ? 'line-clamp-2 text-sm' : 'line-clamp-1 text-sm'}`}
    >
      {item.title}
    </a>
  );

  const meta = (
    <div className="flex items-center gap-1.5 text-[11px] text-neutral-500 dark:text-neutral-400">
      <span className="truncate">{item.author || hostnameOf(item.url)}</span>
      <span className="text-neutral-300 dark:text-neutral-600">•</span>
      <span className="shrink-0">{formatDate(item.updatedAt)}</span>
    </div>
  );

  const tagRow =
    itemTags.length > 0 ? (
      <div className="flex flex-wrap gap-1">
        {itemTags.slice(0, 4).map((tag) => (
          <TagChip key={tag.id} tag={tag} />
        ))}
        {itemTags.length > 4 ? (
          <span className="self-center text-[10px] text-neutral-400">+{itemTags.length - 4}</span>
        ) : null}
      </div>
    ) : null;

  const checkbox = (
    <label
      className={`flex h-6 w-6 cursor-pointer items-center justify-center rounded-md border bg-white/90 transition dark:bg-neutral-900/90 ${
        layout === 'grid' ? 'absolute right-2 top-2 z-10' : 'mt-1 shrink-0'
      } ${
        selected
          ? 'border-indigo-500 opacity-100'
          : 'border-neutral-300 opacity-0 group-hover:opacity-100 dark:border-neutral-600'
      }`}
      onClick={(event) => event.stopPropagation()}
      title="Выбрать"
    >
      <input
        type="checkbox"
        checked={selected}
        onChange={() => onToggleSelect(item.id)}
        className="h-4 w-4 cursor-pointer accent-indigo-600"
      />
    </label>
  );

  if (layout === 'list') {
    return (
      <div
        className={`group relative flex items-start gap-3 rounded-xl border bg-white p-2 transition hover:shadow-md dark:bg-neutral-900 ${
          selected
            ? 'border-indigo-400 ring-1 ring-indigo-400/40'
            : 'border-neutral-200 dark:border-neutral-800'
        }`}
      >
        {checkbox}
        {thumb}
        <div className="min-w-0 flex-1 space-y-1 py-0.5 pr-1">
          {title}
          {item.note ? (
            <p className="line-clamp-1 text-[11px] text-neutral-500 dark:text-neutral-400">
              {item.note}
            </p>
          ) : null}
          {tagRow}
          {meta}
        </div>
        <div className="shrink-0 self-start pt-0.5 opacity-60 transition group-hover:opacity-100">
          {actions}
        </div>
      </div>
    );
  }

  return (
    <div
      className={`group relative flex flex-col overflow-hidden rounded-xl border bg-white transition hover:shadow-lg dark:bg-neutral-900 ${
        selected
          ? 'border-indigo-400 ring-1 ring-indigo-400/40'
          : 'border-neutral-200 dark:border-neutral-800'
      }`}
    >
      {checkbox}
      {thumb}
      <div className="flex flex-1 flex-col gap-1.5 p-3">
        {title}
        {item.note ? (
          <p className="line-clamp-2 text-[11px] leading-relaxed text-neutral-500 dark:text-neutral-400">
            {item.note}
          </p>
        ) : null}
        {tagRow}
        <div className="mt-auto flex items-end justify-between gap-2 pt-1">
          <div className="min-w-0 flex-1">{meta}</div>
          <div className="opacity-70 transition group-hover:opacity-100">{actions}</div>
        </div>
      </div>
    </div>
  );
}
