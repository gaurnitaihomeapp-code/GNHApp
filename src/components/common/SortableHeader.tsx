import React from 'react';
import { ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';

export interface SortableHeaderProps {
  label: React.ReactNode;
  sortKey?: string;
  currentSortKey?: string | null;
  currentDirection?: 'asc' | 'desc' | null;
  onSort?: (key: string) => void;
  align?: 'left' | 'center' | 'right';
  className?: string;
  title?: string;
}

export const SortableHeader: React.FC<SortableHeaderProps> = ({
  label,
  sortKey,
  currentSortKey,
  currentDirection,
  onSort,
  align = 'left',
  className = '',
  title,
}) => {
  const isSortable = Boolean(sortKey && onSort);
  const isActive = isSortable && currentSortKey === sortKey;

  const alignClass =
    align === 'right'
      ? 'justify-end text-right'
      : align === 'center'
      ? 'justify-center text-center'
      : 'justify-start text-left';

  const defaultTitle = isSortable
    ? isActive
      ? `Sorted ${currentDirection === 'asc' ? 'ascending' : 'descending'}. Click to reverse sort.`
      : `Click to sort by ${typeof label === 'string' ? label : 'this column'}`
    : undefined;

  return (
    <th
      scope="col"
      className={`py-3 px-3 transition-colors ${
        isSortable ? 'cursor-pointer select-none group' : ''
      } ${
        isActive
          ? 'text-amber-700 dark:text-amber-400 bg-amber-500/10 dark:bg-amber-500/15'
          : ''
      } ${className}`}
      onClick={isSortable ? () => onSort?.(sortKey!) : undefined}
      title={title || defaultTitle}
    >
      <div className={`flex items-center gap-1.5 ${alignClass}`}>
        <span className={`truncate ${isActive ? 'font-bold' : ''}`}>{label}</span>
        {isSortable && (
          <span className="shrink-0 flex items-center">
            {isActive ? (
              currentDirection === 'asc' ? (
                <ArrowUp className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
              ) : (
                <ArrowDown className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
              )
            ) : (
              <ArrowUpDown className="w-3 h-3 text-slate-400/60 group-hover:text-slate-600 dark:group-hover:text-slate-300 opacity-60 group-hover:opacity-100 transition-opacity" />
            )}
          </span>
        )}
      </div>
    </th>
  );
};
