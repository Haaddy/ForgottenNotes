import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import {
  clearLibrary,
  db,
  deleteItems,
  deleteTag,
  exportBackup,
  importBackup,
  onLibraryChange,
  setItemsStatus,
  setItemFavorite,
} from '../../lib/db';
import { pluralize } from '../../lib/format';
import type { Item, ItemStatus, Tag } from '../../lib/types';
import { ItemCard } from '../../components/ItemCard';
import { AddItemDialog } from '../../components/AddItemDialog';
import { EditItemDialog } from '../../components/EditItemDialog';
import { ThemeToggle } from '../../components/ThemeToggle';
import { TypeIcon } from '../../components/type-icon';
import {
  ArchiveIcon,
  CheckIcon,
  ClockIcon,
  DownloadIcon,
  GridIcon,
  InboxIcon,
  ListIcon,
  PlusIcon,
  SearchIcon,
  SparkleIcon,
  StarIcon,
  TagIcon,
  TrashIcon,
  UploadIcon,
  XIcon,
} from '../../components/Icons';

type StatusFilter = 'all' | ItemStatus;
type FavoriteFilter = 'all' | 'favorite';
type SortMode = 'new' | 'old' | 'updated' | 'title' | 'duration';
type ViewMode = 'grid' | 'list';

const SORT_LABELS: Record<SortMode, string> = {
  new: 'Сначала новые',
  old: 'Сначала старые',
  updated: 'Недавно изменённые',
  title: 'По названию',
  duration: 'По длительности',
};

const STATUS_LABELS: Record<ItemStatus, string> = {
  later: 'Хочу посмотреть',
  done: 'Посмотрел',
  archived: 'В архиве',
};

function FilterButton({
  active,
  onClick,
  icon,
  label,
  count,
}: {
  active: boolean;
  onClick: () => void;
  icon: ReactNode;
  label: string;
  count: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[13px] transition ${
        active
          ? 'bg-indigo-50 font-medium text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300'
          : 'text-neutral-600 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800'
      }`}
    >
      <span className="shrink-0 opacity-70">{icon}</span>
      <span className="min-w-0 flex-1 truncate">{label}</span>
      <span className="shrink-0 text-[10px] tabular-nums opacity-60">{count}</span>
    </button>
  );
}

export function App() {
  const [items, setItems] = useState<Item[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);

  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<StatusFilter>('all');
  const [favoriteFilter, setFavoriteFilter] = useState<FavoriteFilter>('all');
  const [activeTagIds, setActiveTagIds] = useState<string[]>([]);
  const [sort, setSort] = useState<SortMode>('new');
  const [view, setView] = useState<ViewMode>('grid');

  const [selected, setSelected] = useState<string[]>([]);
  const [editing, setEditing] = useState<Item | null>(null);
  const [adding, setAdding] = useState(false);
  const [notice, setNotice] = useState('');

  const searchRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    const [nextItems, nextTags] = await Promise.all([db.items.toArray(), db.tags.toArray()]);
    setItems(nextItems);
    setTags(nextTags);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
    return onLibraryChange(() => {
      void load();
    });
  }, [load]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const isTyping =
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable);

      if (event.key === '/' && !isTyping) {
        event.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(''), 3000);
    return () => clearTimeout(timer);
  }, [notice]);

  const tagById = useMemo(() => new Map(tags.map((tag) => [tag.id, tag])), [tags]);
  const tagSuggestions = useMemo(
    () => tags.map((tag) => tag.name).sort((a, b) => a.localeCompare(b, 'ru')),
    [tags],
  );

  const tagCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const item of items) {
      for (const id of item.tagIds) counts.set(id, (counts.get(id) ?? 0) + 1);
    }
    return counts;
  }, [items]);

  const statusCounts = useMemo(() => {
    const counts: Record<ItemStatus, number> = { later: 0, done: 0, archived: 0 };
    for (const item of items) counts[item.status] += 1;
    return counts;
  }, [items]);

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();

    const result = items.filter((item) => {
      if (status !== 'all' && item.status !== status) return false;
      if (favoriteFilter === 'favorite' && !item.favorite) return false;
      if (activeTagIds.length && !activeTagIds.every((id) => item.tagIds.includes(id))) return false;
      if (!normalized) return true;

      const haystack = [
        item.title,
        item.url,
        item.note,
        item.description,
        item.author,
        ...item.tagIds.map((id) => tagById.get(id)?.name ?? ''),
      ]
        .join(' ')
        .toLowerCase();

      return haystack.includes(normalized);
    });

    const sorters: Record<SortMode, (a: Item, b: Item) => number> = {
      new: (a, b) => b.createdAt - a.createdAt,
      old: (a, b) => a.createdAt - b.createdAt,
      updated: (a, b) => b.updatedAt - a.updatedAt,
      title: (a, b) => a.title.localeCompare(b.title, 'ru'),
      duration: (a, b) => (b.durationSec ?? 0) - (a.durationSec ?? 0),
    };

    return [...result].sort(sorters[sort]);
  }, [items, status, favoriteFilter, activeTagIds, query, sort, tagById]);

  const hasFilters =
    status !== 'all' || favoriteFilter !== 'all' || activeTagIds.length > 0 || query.trim().length > 0;

  function resetFilters() {
    setStatus('all');
    setFavoriteFilter('all');
    setActiveTagIds([]);
    setQuery('');
  }

  function toggleTag(id: string) {
    setActiveTagIds((current) =>
      current.includes(id) ? current.filter((tagId) => tagId !== id) : [...current, id],
    );
  }

  function toggleSelected(id: string) {
    setSelected((current) =>
      current.includes(id) ? current.filter((itemId) => itemId !== id) : [...current, id],
    );
  }

  async function handleDelete(item: Item) {
    if (!window.confirm(`Удалить «${item.title}»?`)) return;
    await deleteItems([item.id]);
    setSelected((current) => current.filter((id) => id !== item.id));
  }

  async function handleBulkDelete() {
    if (!selected.length) return;
    if (!window.confirm(`Удалить ${pluralize(selected.length, ['запись', 'записи', 'записей'])}?`)) {
      return;
    }
    await deleteItems(selected);
    setSelected([]);
  }

  async function handleBulkStatus(next: ItemStatus) {
    await setItemsStatus(selected, next);
    setSelected([]);
    setNotice('Статус обновлён');
  }

  async function handleToggleFavorite(item: Item) {
    const favorite = !item.favorite;
    await setItemFavorite(item.id, favorite);
    await load();
    setNotice(favorite ? 'Добавлено в избранное' : 'Убрано из избранного');
  }

  async function handleTagDelete(tag: Tag) {
    if (!window.confirm(`Удалить тег «${tag.name}»? Он исчезнет у всех записей.`)) return;
    await deleteTag(tag.id);
    setActiveTagIds((current) => current.filter((id) => id !== tag.id));
  }

  async function handleImport(file: File) {
    if (!window.confirm('Импорт заменит все текущие записи. Продолжить?')) return;
    try {
      const result = await importBackup(file);
      setNotice(`Импортировано: ${pluralize(result.items, ['запись', 'записи', 'записей'])}`);
      setSelected([]);
    } catch (err) {
      setNotice(err instanceof Error ? err.message : 'Не удалось импортировать файл');
    }
  }

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-neutral-200 bg-white/85 backdrop-blur dark:border-neutral-800 dark:bg-neutral-950/85">
        <div className="mx-auto flex max-w-[1440px] flex-wrap items-center gap-2 px-4 py-2.5">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-white shadow-sm">
              <SparkleIcon className="h-4 w-4" />
            </span>
            <div className="leading-tight">
              <p className="text-sm font-semibold">Video Later</p>
              <p className="text-[10px] text-neutral-500 dark:text-neutral-400">
                {pluralize(items.length, ['запись', 'записи', 'записей'])} в библиотеке
              </p>
            </div>
          </div>

          <div className="relative order-last w-full sm:order-none sm:ml-6 sm:w-auto sm:flex-1">
            <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
            <input
              ref={searchRef}
              className="input pl-9"
              placeholder="Поиск по названию, заметке, тегам…  (/)"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
            {query ? (
              <button
                type="button"
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200"
                onClick={() => setQuery('')}
                aria-label="Очистить поиск"
              >
                <XIcon className="h-3.5 w-3.5" />
              </button>
            ) : null}
          </div>

          <div className="ml-auto flex items-center gap-1">
            <button
              type="button"
              className="btn btn-outline py-1.5 text-xs"
              onClick={() => fileRef.current?.click()}
              title="Импорт из JSON"
            >
              <UploadIcon className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Импорт</span>
            </button>
            <button
              type="button"
              className="btn btn-outline py-1.5 text-xs"
              onClick={() => void exportBackup()}
              title="Экспорт в JSON"
            >
              <DownloadIcon className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Экспорт</span>
            </button>
            <ThemeToggle />
            <button
              type="button"
              className="btn btn-primary py-1.5 text-xs"
              onClick={() => setAdding(true)}
            >
              <PlusIcon className="h-4 w-4" />
              Добавить
            </button>
          </div>

          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void handleImport(file);
              event.target.value = '';
            }}
          />
        </div>
      </header>

      <div className="mx-auto flex max-w-[1440px] gap-6 px-4 py-5">
        <aside className="hidden w-60 shrink-0 lg:block">
          <div className="sticky top-[68px] space-y-4">
            <nav className="space-y-0.5">
              <FilterButton
                active={status === 'all' && activeTagIds.length === 0}
                onClick={resetFilters}
                icon={<InboxIcon className="h-4 w-4" />}
                label="Все записи"
                count={items.length}
              />

              <p className="px-2 pb-1 pt-3 text-[10px] font-semibold uppercase tracking-wide text-neutral-400 dark:text-neutral-500">
                Статус
              </p>
              {(Object.keys(STATUS_LABELS) as ItemStatus[]).map((value) => (
                <FilterButton
                  key={value}
                  active={status === value}
                  onClick={() => setStatus(status === value ? 'all' : value)}
                  icon={
                    value === 'later' ? (
                      <ClockIcon className="h-4 w-4" />
                    ) : value === 'done' ? (
                      <CheckIcon className="h-4 w-4" />
                    ) : (
                      <ArchiveIcon className="h-4 w-4" />
                    )
                  }
                  label={STATUS_LABELS[value]}
                  count={statusCounts[value]}
                />
              ))}

              <FilterButton
                active={favoriteFilter === 'favorite'}
                onClick={() => setFavoriteFilter(favoriteFilter === 'favorite' ? 'all' : 'favorite')}
                icon={<StarIcon className="h-4 w-4" fill="currentColor" />}
                label="Избранное"
                count={items.filter((item) => item.favorite).length}
              />

            </nav>

            <div>
              <p className="flex items-center gap-1.5 px-2 pb-1 text-[10px] font-semibold uppercase tracking-wide text-neutral-400 dark:text-neutral-500">
                <TagIcon className="h-3 w-3" /> Теги
              </p>
              {tags.length === 0 ? (
                <p className="px-2 py-1 text-[11px] leading-relaxed text-neutral-400 dark:text-neutral-500">
                  Пока нет тегов. Добавьте их при сохранении — они появятся здесь.
                </p>
              ) : (
                <div className="space-y-0.5">
                  {tags
                    .slice()
                    .sort(
                      (a, b) =>
                        (tagCounts.get(b.id) ?? 0) - (tagCounts.get(a.id) ?? 0) ||
                        a.name.localeCompare(b.name, 'ru'),
                    )
                    .map((tag) => (
                      <div
                        key={tag.id}
                        className={`group flex items-center gap-2 rounded-lg px-2 py-1.5 text-[13px] transition ${
                          activeTagIds.includes(tag.id)
                            ? 'bg-indigo-50 font-medium text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300'
                            : 'text-neutral-600 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800'
                        }`}
                      >
                        <button
                          type="button"
                          className="flex min-w-0 flex-1 items-center gap-2 text-left"
                          onClick={() => toggleTag(tag.id)}
                          title={tag.name}
                        >
                          <span
                            className="h-2 w-2 shrink-0 rounded-full"
                            style={{ backgroundColor: tag.color }}
                          />
                          <span className="min-w-0 flex-1 truncate">{tag.name}</span>
                          <span className="shrink-0 text-[10px] tabular-nums opacity-60">
                            {tagCounts.get(tag.id) ?? 0}
                          </span>
                        </button>
                        <button
                          type="button"
                          className="shrink-0 rounded p-0.5 text-neutral-400 opacity-0 transition hover:text-rose-600 group-hover:opacity-100"
                          onClick={() => void handleTagDelete(tag)}
                          title="Удалить тег"
                        >
                          <TrashIcon className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                </div>
              )}
            </div>

            {items.length > 0 ? (
              <button
                type="button"
                className="px-2 text-[11px] text-neutral-400 underline-offset-2 hover:text-rose-600 hover:underline dark:text-neutral-500"
                onClick={() => {
                  if (window.confirm('Удалить все записи и теги без возможности отмены?')) {
                    void clearLibrary().then(() => setNotice('Библиотека очищена'));
                  }
                }}
              >
                Очистить библиотеку
              </button>
            ) : null}
          </div>
        </aside>

        <main className="min-w-0 flex-1">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <p className="text-sm text-neutral-500 dark:text-neutral-400">
              {loading ? 'Загружаю…' : pluralize(filtered.length, ['запись', 'записи', 'записей'])}
              {hasFilters && !loading ? ' по фильтрам' : ''}
            </p>

            {hasFilters ? (
              <button
                type="button"
                className="rounded-md px-1.5 py-0.5 text-[11px] text-indigo-600 hover:bg-indigo-50 dark:text-indigo-400 dark:hover:bg-indigo-500/10"
                onClick={resetFilters}
              >
                сбросить
              </button>
            ) : null}

            <div className="ml-auto flex items-center gap-2">
              <select
                className="input w-auto py-1.5 text-xs"
                value={sort}
                onChange={(event) => setSort(event.target.value as SortMode)}
              >
                {(Object.keys(SORT_LABELS) as SortMode[]).map((value) => (
                  <option key={value} value={value}>
                    {SORT_LABELS[value]}
                  </option>
                ))}
              </select>
              <div className="flex rounded-lg border border-neutral-300 p-0.5 dark:border-neutral-700">
                <button
                  type="button"
                  className={`rounded-md p-1.5 ${
                    view === 'grid'
                      ? 'bg-neutral-200 text-neutral-900 dark:bg-neutral-700 dark:text-white'
                      : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-white'
                  }`}
                  onClick={() => setView('grid')}
                  title="Сетка"
                  aria-label="Сетка"
                >
                  <GridIcon className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  className={`rounded-md p-1.5 ${
                    view === 'list'
                      ? 'bg-neutral-200 text-neutral-900 dark:bg-neutral-700 dark:text-white'
                      : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-white'
                  }`}
                  onClick={() => setView('list')}
                  title="Список"
                  aria-label="Список"
                >
                  <ListIcon className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>

          {activeTagIds.length > 0 ? (
            <div className="mb-3 flex flex-wrap items-center gap-1.5">
              {activeTagIds.map((id) => {
                const tag = tagById.get(id);
                if (!tag) return null;
                return (
                  <span
                    key={id}
                    className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium"
                    style={{
                      backgroundColor: `${tag.color}1f`,
                      borderColor: `${tag.color}55`,
                      color: tag.color,
                    }}
                  >
                    {tag.name}
                    <button
                      type="button"
                      className="rounded-full p-0.5 opacity-60 hover:opacity-100"
                      onClick={() => toggleTag(id)}
                      aria-label={`Убрать фильтр ${tag.name}`}
                    >
                      <XIcon className="h-3 w-3" />
                    </button>
                  </span>
                );
              })}
            </div>
          ) : null}

          {selected.length > 0 ? (
            <div className="sticky top-[64px] z-20 mb-3 flex flex-wrap items-center gap-2 rounded-xl border border-indigo-200 bg-indigo-50/95 px-3 py-2 text-xs shadow-sm backdrop-blur dark:border-indigo-500/30 dark:bg-indigo-500/15">
              <span className="font-medium text-indigo-700 dark:text-indigo-200">
                Выбрано: {selected.length}
              </span>
              <div className="ml-auto flex flex-wrap items-center gap-1">
                <button
                  type="button"
                  className="btn btn-ghost py-1 text-[11px]"
                  onClick={() => void handleBulkStatus('done')}
                >
                  <CheckIcon className="h-3.5 w-3.5" /> Посмотрел
                </button>
                <button
                  type="button"
                  className="btn btn-ghost py-1 text-[11px]"
                  onClick={() => void handleBulkStatus('later')}
                >
                  <ClockIcon className="h-3.5 w-3.5" /> Позже
                </button>
                <button
                  type="button"
                  className="btn btn-ghost py-1 text-[11px]"
                  onClick={() => void handleBulkStatus('archived')}
                >
                  <ArchiveIcon className="h-3.5 w-3.5" /> В архив
                </button>
                <button
                  type="button"
                  className="btn btn-ghost py-1 text-[11px] hover:text-rose-600"
                  onClick={() => void handleBulkDelete()}
                >
                  <TrashIcon className="h-3.5 w-3.5" /> Удалить
                </button>
                <button
                  type="button"
                  className="btn btn-ghost py-1 text-[11px]"
                  onClick={() => setSelected([])}
                >
                  Снять
                </button>
              </div>
            </div>
          ) : null}

          {!loading && items.length === 0 ? (
            <div className="mt-10 flex flex-col items-center gap-3 rounded-2xl border border-dashed border-neutral-300 px-6 py-16 text-center dark:border-neutral-700">
              <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-500/10 text-indigo-500">
                <SparkleIcon className="h-7 w-7" />
              </span>
              <h2 className="text-base font-semibold">Библиотека пока пуста</h2>
              <p className="max-w-md text-sm text-neutral-500 dark:text-neutral-400">
                Откройте любое видео или статью и нажмите{' '}
                <kbd className="rounded border border-neutral-300 bg-neutral-100 px-1.5 py-0.5 font-mono text-[11px] dark:border-neutral-600 dark:bg-neutral-800">
                  Alt+Shift+S
                </kbd>
                , либо добавьте ссылку вручную.
              </p>
              <button
                type="button"
                className="btn btn-primary mt-1"
                onClick={() => setAdding(true)}
              >
                <PlusIcon className="h-4 w-4" /> Добавить ссылку
              </button>
            </div>
          ) : null}

          {!loading && items.length > 0 && filtered.length === 0 ? (
            <div className="mt-10 flex flex-col items-center gap-3 rounded-2xl border border-dashed border-neutral-300 px-6 py-14 text-center dark:border-neutral-700">
              <SearchIcon className="h-7 w-7 text-neutral-400" />
              <p className="text-sm text-neutral-500 dark:text-neutral-400">
                По этим фильтрам ничего не найдено.
              </p>
              <button type="button" className="btn btn-outline text-xs" onClick={resetFilters}>
                Сбросить фильтры
              </button>
            </div>
          ) : null}

          <div
            className={
              view === 'grid'
                ? 'grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4'
                : 'space-y-2'
            }
          >
            {filtered.map((item) => (
              <ItemCard
                key={item.id}
                item={item}
                tags={tags}
                selected={selected.includes(item.id)}
                layout={view}
                onToggleSelect={toggleSelected}
                onEdit={setEditing}
                onDelete={(target) => void handleDelete(target)}
                onStatus={(target, next) =>
                  void setItemsStatus([target.id], next).then(() => setNotice('Статус обновлён'))
                }
                onToggleFavorite={(target) => void handleToggleFavorite(target)}
              />
            ))}
          </div>
        </main>
      </div>

      {notice ? (
        <div className="fixed bottom-4 left-1/2 z-50 -translate-x-1/2 rounded-lg bg-neutral-900 px-4 py-2 text-xs text-white shadow-lg dark:bg-white dark:text-neutral-900">
          {notice}
        </div>
      ) : null}

      {adding ? (
        <AddItemDialog
          open={adding}
          tagSuggestions={tagSuggestions}
          onClose={() => setAdding(false)}
          onSaved={() => setNotice('Ссылка добавлена')}
        />
      ) : null}

      {editing ? (
        <EditItemDialog
          key={editing.id}
          item={editing}
          allTags={tags}
          tagSuggestions={tagSuggestions}
          onClose={() => setEditing(null)}
        />
      ) : null}
    </div>
  );
}
