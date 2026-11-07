import type { Tag } from '../lib/types';
import { XIcon } from './Icons';

interface TagChipProps {
  tag: Tag;
  onRemove?: () => void;
  onClick?: () => void;
  active?: boolean;
  className?: string;
}

export function TagChip({ tag, onRemove, onClick, active, className = '' }: TagChipProps) {
  return (
    <span
      className={`inline-flex max-w-full items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium leading-5 ${
        onClick ? 'cursor-pointer' : ''
      } ${active ? 'ring-2 ring-offset-1 ring-offset-white dark:ring-offset-neutral-900' : ''} ${className}`}
      style={{
        backgroundColor: `${tag.color}1f`,
        borderColor: `${tag.color}55`,
        color: tag.color,
      }}
      onClick={onClick}
      title={tag.name}
    >
      <span className="truncate">{tag.name}</span>
      {onRemove ? (
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onRemove();
          }}
          className="rounded-full p-0.5 opacity-60 transition hover:bg-black/10 hover:opacity-100 dark:hover:bg-white/10"
          aria-label={`Убрать тег ${tag.name}`}
        >
          <XIcon className="h-3 w-3" />
        </button>
      ) : null}
    </span>
  );
}
