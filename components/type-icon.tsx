import type { SVGProps } from 'react';
import type { ItemType } from '../lib/types';
import { BookIcon, CodeIcon, FilmIcon, LinkIcon } from './Icons';

type Props = SVGProps<SVGSVGElement> & { type: ItemType };

export function TypeIcon({ type, ...props }: Props) {
  if (type === 'video') return <FilmIcon {...props} />;
  if (type === 'article') return <BookIcon {...props} />;
  if (type === 'repo') return <CodeIcon {...props} />;
  return <LinkIcon {...props} />;
}

export const TYPE_LABELS: Record<ItemType, string> = {
  video: 'Видео',
  article: 'Статья',
  repo: 'Код',
  other: 'Ссылка',
};
