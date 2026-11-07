import { useEffect, useMemo, useRef, useState } from 'react';
import { XIcon } from './Icons';

interface TagInputProps {
  value: string[];
  onChange: (names: string[]) => void;
  suggestions: string[];
  placeholder?: string;
  autoFocus?: boolean;
}

export function TagInput({
  value,
  onChange,
  suggestions,
  placeholder = 'Добавить тег…',
  autoFocus,
}: TagInputProps) {
  const [text, setText] = useState('');
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const selectedLower = useMemo(
    () => new Set(value.map((name) => name.toLowerCase())),
    [value],
  );

  const options = useMemo(() => {
    const query = text.trim().toLowerCase();
    const matches = suggestions
      .filter((name) => !selectedLower.has(name.toLowerCase()))
      .filter((name) => !query || name.toLowerCase().includes(query))
      .slice(0, 8);

    const exact = suggestions.some((name) => name.toLowerCase() === query);
    if (query && !exact && !selectedLower.has(query)) {
      return [...matches, text.trim()];
    }
    return matches;
  }, [text, suggestions, selectedLower]);

  useEffect(() => {
    setHighlight(0);
  }, [text]);

  function add(name: string) {
    const clean = name.trim();
    if (!clean) return;
    if (selectedLower.has(clean.toLowerCase())) {
      setText('');
      return;
    }
    onChange([...value, clean]);
    setText('');
    setOpen(false);
    inputRef.current?.focus();
  }

  function remove(index: number) {
    onChange(value.filter((_, i) => i !== index));
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault();
      const option = options[highlight];
      if (option) add(option);
      else if (text.trim()) add(text);
      return;
    }
    if (event.key === 'Backspace' && !text && value.length) {
      remove(value.length - 1);
      return;
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setOpen(true);
      setHighlight((current) => Math.min(current + 1, Math.max(options.length - 1, 0)));
      return;
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setHighlight((current) => Math.max(current - 1, 0));
      return;
    }
    if (event.key === 'Escape') {
      setOpen(false);
    }
  }

  const isNewOption = (name: string) =>
    !suggestions.some((suggestion) => suggestion.toLowerCase() === name.toLowerCase());

  return (
    <div className="relative">
      <div
        className="flex min-h-[38px] w-full flex-wrap items-center gap-1.5 rounded-lg border border-neutral-300 bg-white px-2 py-1.5 text-sm transition focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-500/20 dark:border-neutral-700 dark:bg-neutral-900"
        onClick={() => inputRef.current?.focus()}
      >
        {value.map((name, index) => (
          <span
            key={`${name}-${index}`}
            className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2 py-0.5 text-[11px] font-medium text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300"
          >
            {name}
            <button
              type="button"
              className="rounded-full p-0.5 opacity-60 hover:bg-indigo-500/15 hover:opacity-100"
              onClick={(event) => {
                event.stopPropagation();
                remove(index);
              }}
              aria-label={`Убрать тег ${name}`}
            >
              <XIcon className="h-3 w-3" />
            </button>
          </span>
        ))}
        <input
          ref={inputRef}
          value={text}
          autoFocus={autoFocus}
          placeholder={value.length ? '' : placeholder}
          className="min-w-[80px] flex-1 bg-transparent px-1 py-0.5 text-sm outline-none placeholder:text-neutral-400"
          onChange={(event) => {
            setText(event.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 120)}
          onKeyDown={onKeyDown}
        />
      </div>

      {open && options.length > 0 ? (
        <div className="absolute z-30 mt-1 max-h-48 w-full overflow-auto rounded-lg border border-neutral-200 bg-white p-1 shadow-lg dark:border-neutral-700 dark:bg-neutral-900">
          {options.map((name, index) => (
            <button
              key={`${name}-${index}`}
              type="button"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => add(name)}
              className={`flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-sm ${
                index === highlight
                  ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300'
                  : 'text-neutral-700 hover:bg-neutral-100 dark:text-neutral-200 dark:hover:bg-neutral-800'
              }`}
            >
              <span className="truncate">{name}</span>
              {isNewOption(name) ? (
                <span className="shrink-0 text-[10px] uppercase tracking-wide text-neutral-400">
                  создать
                </span>
              ) : null}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
