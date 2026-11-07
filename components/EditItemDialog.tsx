import { useState } from 'react';
import { Modal } from './Modal';
import { TagInput } from './TagInput';
import { ensureTags, updateItem } from '../lib/db';
import { parseUrl } from '../lib/url';
import type { Item, ItemStatus, ItemType } from '../lib/types';

interface EditItemDialogProps {
  item: Item;
  allTags: { id: string; name: string }[];
  tagSuggestions: string[];
  onClose: () => void;
}

const STATUS_OPTIONS: { value: ItemStatus; label: string }[] = [
  { value: 'later', label: 'Хочу посмотреть' },
  { value: 'done', label: 'Посмотрел' },
  { value: 'archived', label: 'В архиве' },
];

const TYPE_OPTIONS: { value: ItemType; label: string }[] = [
  { value: 'video', label: 'Видео' },
  { value: 'article', label: 'Статья' },
  { value: 'repo', label: 'Код' },
  { value: 'other', label: 'Ссылка' },
];

export function EditItemDialog({
  item,
  allTags,
  tagSuggestions,
  onClose,
}: EditItemDialogProps) {
  const [title, setTitle] = useState(item.title);
  const [url, setUrl] = useState(item.url);
  const [note, setNote] = useState(item.note);
  const [type, setType] = useState<ItemType>(item.type);
  const [status, setStatus] = useState<ItemStatus>(item.status);
  const [tagNames, setTagNames] = useState<string[]>(
    item.tagIds
      .map((id) => allTags.find((tag) => tag.id === id)?.name)
      .filter((name): name is string => Boolean(name)),
  );
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!title.trim()) {
      setError('Название не может быть пустым');
      return;
    }

    setSaving(true);
    setError('');
    try {
      const parsed = parseUrl(url.trim());
      const tags = await ensureTags(tagNames);
      await updateItem(item.id, {
        title: title.trim(),
        url: parsed.canonical,
        note: note.trim(),
        type,
        status,
        tagIds: tags.map((tag) => tag.id),
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось сохранить изменения');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open title="Редактировать запись" onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="mb-1 block text-xs font-medium text-neutral-500 dark:text-neutral-400">
            Название
          </label>
          <input className="input" value={title} autoFocus onChange={(e) => setTitle(e.target.value)} />
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-neutral-500 dark:text-neutral-400">
            Ссылка
          </label>
          <input className="input" value={url} onChange={(e) => setUrl(e.target.value)} />
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-neutral-500 dark:text-neutral-400">
            Заметка
          </label>
          <textarea
            className="input min-h-[80px] resize-y"
            value={note}
            placeholder="Зачем сохранил, что посмотреть…"
            onChange={(e) => setNote(e.target.value)}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-neutral-500 dark:text-neutral-400">
              Тип
            </label>
            <select className="input" value={type} onChange={(e) => setType(e.target.value as ItemType)}>
              {TYPE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-neutral-500 dark:text-neutral-400">
              Статус
            </label>
            <select
              className="input"
              value={status}
              onChange={(e) => setStatus(e.target.value as ItemStatus)}
            >
              {STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-neutral-500 dark:text-neutral-400">
            Теги
          </label>
          <TagInput value={tagNames} onChange={setTagNames} suggestions={tagSuggestions} />
        </div>

        {error ? <p className="text-xs text-rose-600 dark:text-rose-400">{error}</p> : null}

        <div className="flex justify-end gap-2 pt-1">
          <button type="button" className="btn" onClick={onClose}>
            Отмена
          </button>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? 'Сохраняю…' : 'Сохранить'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
