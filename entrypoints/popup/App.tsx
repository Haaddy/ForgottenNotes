import { useEffect, useMemo, useState } from 'react';
import { browser } from 'wxt/browser';
import { db, findItemByUrl, saveItem } from '../../lib/db';
import { buildDraftForTab } from '../../lib/meta';
import { getYouTubeId, hostnameOf, isSavableUrl, urlForItem } from '../../lib/url';
import { formatDuration } from '../../lib/format';
import type { Draft, Item, ItemStatus, ItemType } from '../../lib/types';
import { TagInput } from '../../components/TagInput';
import { ThemeToggle } from '../../components/ThemeToggle';
import { TYPE_LABELS, TypeIcon } from '../../components/type-icon';
import { ArrowRightIcon, CheckIcon, ExternalIcon, SparkleIcon } from '../../components/Icons';

const STATUS_LABELS: Record<ItemStatus, string> = {
  later: 'Хочу посмотреть',
  done: 'Посмотрел',
  archived: 'В архиве',
};

type LoadState = 'loading' | 'ready' | 'blocked';

function openLibrary() {
  void browser.tabs.create({ url: browser.runtime.getURL('/library.html') });
  window.close();
}

export function App() {
  const [state, setState] = useState<LoadState>('loading');
  const [draft, setDraft] = useState<Draft | null>(null);
  const [title, setTitle] = useState('');
  const [note, setNote] = useState('');
  const [tagNames, setTagNames] = useState<string[]>([]);
  const [status, setStatus] = useState<ItemStatus>('later');
  const [type, setType] = useState<ItemType>('other');
  const [useStartAt, setUseStartAt] = useState(true);
  const [duplicate, setDuplicate] = useState<Item | null>(null);
  const [tagSuggestions, setTagSuggestions] = useState<string[]>([]);
  const [recent, setRecent] = useState<Item[]>([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
        if (!tab?.url || !isSavableUrl(tab.url)) {
          const [allTags, recentItems] = await Promise.all([
            db.tags.toArray(),
            db.items.orderBy('createdAt').reverse().limit(5).toArray(),
          ]);
          if (cancelled) return;
          setTagSuggestions(allTags.map((tag) => tag.name).sort((a, b) => a.localeCompare(b)));
          setRecent(recentItems);
          if (!cancelled) setState('blocked');
          return;
        }

        const result = await buildDraftForTab(tab);
        if (!result) {
          if (!cancelled) setState('blocked');
          return;
        }
        if (cancelled) return;

        setDraft(result);
        setTitle(result.title);
        setType(result.type);

        const existing = await findItemByUrl(result.url);
        const allTags = await db.tags.toArray();
        const recentItems = await db.items.orderBy('createdAt').reverse().limit(5).toArray();

        if (cancelled) return;

        setTagSuggestions(allTags.map((tag) => tag.name).sort((a, b) => a.localeCompare(b)));
        setRecent(recentItems);

        if (existing) {
          setDuplicate(existing);
          setNote(existing.note);
          setStatus(existing.status);
          setType(existing.type);
          setTagNames(
            existing.tagIds
              .map((id) => allTags.find((tag) => tag.id === id)?.name)
              .filter((name): name is string => Boolean(name)),
          );
        }

        setState('ready');
      } catch (err) {
        console.error(err);
        if (!cancelled) setState('blocked');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const youtubeId = useMemo(() => (draft ? getYouTubeId(draft.originalUrl) : undefined), [draft]);

  async function handleSave() {
    if (!draft || saving) return;
    setSaving(true);
    setError('');
    try {
      await saveItem({
        url: draft.url,
        originalUrl: draft.originalUrl,
        title,
        note,
        description: draft.description,
        type,
        source: draft.source,
        thumbnailUrl: draft.thumbnailUrl,
        author: draft.author,
        durationSec: draft.durationSec,
        startAtSec: useStartAt ? draft.startAtSec : undefined,
        tagNames,
        status,
      });
      setSaved(true);
      setTimeout(() => window.close(), 850);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось сохранить');
      setSaving(false);
    }
  }

  async function handleSaveNote() {
    if (saving) return;
    if (!note.trim() && !title.trim()) {
      setError('Добавьте текст заметки или название.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await saveItem({
        url: '',
        title: title.trim() || 'Заметка без ссылки',
        note: note.trim(),
        type: 'other',
        tagNames,
        status,
      });
      setSaved(true);
      setTimeout(() => window.close(), 850);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось сохранить заметку');
      setSaving(false);
    }
  }

  return (
    <div className="w-[400px] bg-neutral-50 text-sm dark:bg-neutral-950">
      <header className="flex items-center justify-between border-b border-neutral-200 px-4 py-2.5 dark:border-neutral-800">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-600 text-white shadow-sm">
            <SparkleIcon className="h-4 w-4" />
          </span>
          <div className="leading-tight">
            <p className="text-[13px] font-semibold">Video Later</p>
            <p className="text-[10px] text-neutral-500 dark:text-neutral-400">
              сохранить на потом
            </p>
          </div>
        </div>
        <ThemeToggle />
      </header>

      {state === 'loading' ? (
        <div className="space-y-3 p-4">
          <div className="h-10 animate-pulse rounded-lg bg-neutral-200 dark:bg-neutral-800" />
          <div className="h-20 animate-pulse rounded-lg bg-neutral-200 dark:bg-neutral-800" />
          <div className="h-9 animate-pulse rounded-lg bg-neutral-200 dark:bg-neutral-800" />
        </div>
      ) : null}

      {state === 'blocked' ? (
        <div className="space-y-3 border-b border-neutral-200 p-4 dark:border-neutral-800">
          <div className="text-center">
            <p className="text-sm font-medium">Страница недоступна для сохранения</p>
            <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
              Но здесь можно быстро записать мысль или напоминание.
            </p>
          </div>
          <input
            className="input text-[13px]"
            placeholder="Название заметки (необязательно)"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
          />
          <textarea
            className="input min-h-[84px] resize-y text-[13px]"
            placeholder="Напишите заметку…"
            value={note}
            onChange={(event) => setNote(event.target.value)}
          />
          <TagInput
            value={tagNames}
            onChange={setTagNames}
            suggestions={tagSuggestions}
            placeholder="Добавить теги…"
          />
          <select
            className="input py-1.5 text-[12px]"
            value={status}
            onChange={(event) => setStatus(event.target.value as ItemStatus)}
            title="Статус"
          >
            {(Object.keys(STATUS_LABELS) as ItemStatus[]).map((value) => (
              <option key={value} value={value}>{STATUS_LABELS[value]}</option>
            ))}
          </select>
          {error ? <p className="text-[11px] text-rose-600 dark:text-rose-400">{error}</p> : null}
          <button
            type="button"
            className="btn btn-primary w-full py-2.5"
            onClick={() => void handleSaveNote()}
            disabled={saving || saved}
          >
            {saved ? <><CheckIcon className="h-4 w-4" /> Сохранено</> : saving ? 'Сохраняю…' : 'Сохранить заметку'}
          </button>
          <p className="text-center text-[10px] text-neutral-400 dark:text-neutral-500">
            Ссылки можно сохранять из обычных вкладок по Alt+Shift+S.
          </p>
        </div>
      ) : null}

      {state === 'ready' && draft ? (
        <>
          <div className="space-y-3 border-b border-neutral-200 p-4 dark:border-neutral-800">
            <div className="flex items-start gap-2.5">
              {draft.thumbnailUrl ? (
                <img
                  src={draft.thumbnailUrl}
                  alt=""
                  referrerPolicy="no-referrer"
                  className="mt-0.5 h-12 w-20 shrink-0 rounded-md object-cover"
                  onError={(event) => {
                    event.currentTarget.style.display = 'none';
                  }}
                />
              ) : (
                <span className="mt-0.5 flex h-12 w-20 shrink-0 items-center justify-center rounded-md bg-indigo-500/10 text-indigo-500">
                  <TypeIcon type={type} className="h-5 w-5" />
                </span>
              )}
              <div className="min-w-0 flex-1">
                <input
                  className="input mb-1 py-1.5 text-[13px] font-medium"
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder="Название"
                />
                <div className="flex items-center gap-1.5 text-[10px] text-neutral-500 dark:text-neutral-400">
                  <span className="truncate">{hostnameOf(draft.originalUrl)}</span>
                  {draft.durationSec ? (
                    <span className="shrink-0 rounded bg-neutral-200 px-1 py-0.5 font-medium text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300">
                      {formatDuration(draft.durationSec)}
                    </span>
                  ) : null}
                  {youtubeId ? (
                    <span className="shrink-0 rounded bg-rose-100 px-1 py-0.5 text-[9px] font-semibold uppercase text-rose-600 dark:bg-rose-500/15 dark:text-rose-400">
                      youtube
                    </span>
                  ) : null}
                </div>
              </div>
            </div>

            {duplicate ? (
              <div className="flex items-start gap-2 rounded-lg border border-amber-300/70 bg-amber-50 px-2.5 py-2 text-[11px] text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
                <span className="font-semibold">Уже в библиотеке.</span>
                <span className="min-w-0 flex-1 truncate">
                  {duplicate.note || 'Сохранение обновит заметку, теги и статус.'}
                </span>
              </div>
            ) : null}

            <textarea
              className="input min-h-[64px] resize-y text-[13px]"
              placeholder="Заметка: зачем сохраняю, что тут важного…"
              value={note}
              onChange={(event) => setNote(event.target.value)}
            />

            {draft.startAtSec ? (
              <label className="flex cursor-pointer items-center gap-2 text-[11px] text-neutral-600 dark:text-neutral-300">
                <input
                  type="checkbox"
                  className="h-3.5 w-3.5 accent-indigo-600"
                  checked={useStartAt}
                  onChange={(event) => setUseStartAt(event.target.checked)}
                />
                Начинать с {formatDuration(draft.startAtSec)}
              </label>
            ) : null}

            <TagInput
              value={tagNames}
              onChange={setTagNames}
              suggestions={tagSuggestions}
              placeholder="Теги: видео, учёба, посмотреть…"
            />

            <div className="flex items-center gap-2">
              <select
                className="input min-w-0 flex-1 py-1.5 text-[12px]"
                value={status}
                onChange={(event) => setStatus(event.target.value as ItemStatus)}
                title="Статус"
              >
                {(Object.keys(STATUS_LABELS) as ItemStatus[]).map((value) => (
                  <option key={value} value={value}>
                    {STATUS_LABELS[value]}
                  </option>
                ))}
              </select>
              <select
                className="input min-w-0 flex-1 py-1.5 text-[12px]"
                value={type}
                onChange={(event) => setType(event.target.value as ItemType)}
                title="Тип"
              >
                {(Object.keys(TYPE_LABELS) as ItemType[]).map((value) => (
                  <option key={value} value={value}>
                    {TYPE_LABELS[value]}
                  </option>
                ))}
              </select>
            </div>

            {error ? <p className="text-[11px] text-rose-600 dark:text-rose-400">{error}</p> : null}

            <button
              type="button"
              className="btn btn-primary w-full py-2.5"
              onClick={handleSave}
              disabled={saving || saved}
            >
              {saved ? (
                <>
                  <CheckIcon className="h-4 w-4" /> Сохранено
                </>
              ) : saving ? (
                'Сохраняю…'
              ) : duplicate ? (
                'Обновить запись'
              ) : (
                'Сохранить'
              )}
            </button>
            <p className="text-center text-[10px] text-neutral-400 dark:text-neutral-500">
              Горячая клавиша: Alt+Shift+S
            </p>
          </div>

          {recent.length > 0 ? (
            <div className="p-3">
              <p className="mb-1.5 px-1 text-[10px] font-semibold uppercase tracking-wide text-neutral-400 dark:text-neutral-500">
                Недавнее
              </p>
              <ul className="space-y-0.5">
                {recent.map((item) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      className="flex w-full items-center gap-2 rounded-lg px-1.5 py-1.5 text-left transition hover:bg-neutral-100 dark:hover:bg-neutral-800"
                      onClick={() => {
                        void browser.tabs.create({
                          url: urlForItem(item.url, item.type, item.startAtSec),
                        });
                        window.close();
                      }}
                      title={item.title}
                    >
                      <span className="flex h-8 w-12 shrink-0 items-center justify-center overflow-hidden rounded bg-neutral-200 dark:bg-neutral-800">
                        {item.thumbnailUrl ? (
                          <img
                            src={item.thumbnailUrl}
                            alt=""
                            referrerPolicy="no-referrer"
                            className="h-full w-full object-cover"
                            onError={(event) => {
                              event.currentTarget.style.display = 'none';
                            }}
                          />
                        ) : (
                          <TypeIcon type={item.type} className="h-3.5 w-3.5 text-neutral-400" />
                        )}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[12px] font-medium">{item.title}</span>
                        <span className="block truncate text-[10px] text-neutral-500 dark:text-neutral-400">
                          {hostnameOf(item.url)}
                          {item.note ? ` · ${item.note}` : ''}
                        </span>
                      </span>
                      <ExternalIcon className="h-3.5 w-3.5 shrink-0 text-neutral-400" />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </>
      ) : null}

      <footer className="border-t border-neutral-200 px-4 py-2 dark:border-neutral-800">
        <button
          type="button"
          className="flex w-full items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-medium text-indigo-600 transition hover:bg-indigo-50 dark:text-indigo-400 dark:hover:bg-indigo-500/10"
          onClick={openLibrary}
        >
          Вся библиотека
          <ArrowRightIcon className="h-3.5 w-3.5" />
        </button>
      </footer>
    </div>
  );
}
