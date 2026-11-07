import { useEffect, useState } from 'react';
import { Modal } from './Modal';
import { TagInput } from './TagInput';
import { saveItem } from '../lib/db';
import { detectType, getYouTubeId, hostnameOf, parseUrl } from '../lib/url';
import type { Item } from '../lib/types';

interface AddItemDialogProps {
  open: boolean;
  tagSuggestions: string[];
  onClose: () => void;
  onSaved?: (item: Item) => void;
}

export function AddItemDialog({ open, tagSuggestions, onClose, onSaved }: AddItemDialogProps) {
  const [url, setUrl] = useState('');
  const [title, setTitle] = useState('');
  const [note, setNote] = useState('');
  const [tagNames, setTagNames] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setUrl('');
    setTitle('');
    setNote('');
    setTagNames([]);
    setError('');
    setSaving(false);
  }, [open]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const raw = url.trim();
    if (!/^https?:\/\//i.test(raw)) {
      setError('Ссылка должна начинаться с http:// или https://');
      return;
    }

    setSaving(true);
    setError('');
    try {
      const parsed = parseUrl(raw);
      const youtubeId = getYouTubeId(raw);
      const type = detectType({
        url: parsed.canonical,
        source: parsed.source,
        youtubeId,
        title,
      });

      const result = await saveItem({
        url: parsed.canonical,
        originalUrl: raw,
        title: title.trim() || hostnameOf(raw),
        type,
        source: parsed.source,
        thumbnailUrl: youtubeId ? `https://i.ytimg.com/vi/${youtubeId}/hqdefault.jpg` : '',
        startAtSec: parsed.startAtSec,
        note,
        tagNames,
      });
      onSaved?.(result.item);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось сохранить ссылку');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} title="Добавить ссылку" onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="mb-1 block text-xs font-medium text-neutral-500 dark:text-neutral-400">
            Ссылка
          </label>
          <input
            className="input"
            placeholder="https://…"
            value={url}
            autoFocus
            onChange={(event) => setUrl(event.target.value)}
          />
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-neutral-500 dark:text-neutral-400">
            Название <span className="font-normal">(необязательно)</span>
          </label>
          <input
            className="input"
            placeholder="Подставится из адреса"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
          />
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-neutral-500 dark:text-neutral-400">
            Заметка
          </label>
          <textarea
            className="input min-h-[70px] resize-y"
            placeholder="Зачем сохраняю, что посмотреть…"
            value={note}
            onChange={(event) => setNote(event.target.value)}
          />
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
