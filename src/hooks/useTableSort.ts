import { useState, useMemo } from 'react';

export type SortDirection = 'asc' | 'desc';

export interface SortConfig<K extends string = string> {
  key: K;
  direction: SortDirection;
}

export interface UseTableSortOptions<T, K extends string = string> {
  initialConfig?: SortConfig<K> | null;
  getSortValue?: (item: T, key: K) => any;
}

export function useTableSort<T, K extends string = string>(
  items: T[],
  options?: UseTableSortOptions<T, K>
) {
  const [sortConfig, setSortConfig] = useState<SortConfig<K> | null>(
    options?.initialConfig ?? null
  );

  const requestSort = (key: string, defaultDirection: SortDirection = 'asc') => {
    setSortConfig(current => {
      if (!current || current.key !== key) {
        return { key: key as K, direction: defaultDirection };
      }
      return {
        key: current.key,
        direction: current.direction === 'asc' ? 'desc' : 'asc',
      };
    });
  };

  const sortedData = useMemo(() => {
    if (!sortConfig) return items;

    const { key, direction } = sortConfig;
    const modifier = direction === 'asc' ? 1 : -1;

    return [...items].sort((a, b) => {
      const valA = options?.getSortValue ? options.getSortValue(a, key) : (a as any)?.[key];
      const valB = options?.getSortValue ? options.getSortValue(b, key) : (b as any)?.[key];

      // Handle null or undefined values gracefully
      if (valA === valB) return 0;
      if (valA === undefined || valA === null) return 1;
      if (valB === undefined || valB === null) return -1;

      // Numbers
      if (typeof valA === 'number' && typeof valB === 'number') {
        return (valA - valB) * modifier;
      }

      // Check if both strings are parseable as numbers
      const numA = Number(valA);
      const numB = Number(valB);
      if (!isNaN(numA) && !isNaN(numB) && typeof valA !== 'boolean' && typeof valB !== 'boolean' && String(valA).trim() !== '' && String(valB).trim() !== '') {
        return (numA - numB) * modifier;
      }

      // Dates (or ISO date strings)
      const dateA = valA instanceof Date ? valA.getTime() : typeof valA === 'string' && /^\d{4}-\d{2}-\d{2}/.test(valA) ? new Date(valA).getTime() : NaN;
      const dateB = valB instanceof Date ? valB.getTime() : typeof valB === 'string' && /^\d{4}-\d{2}-\d{2}/.test(valB) ? new Date(valB).getTime() : NaN;
      if (!isNaN(dateA) && !isNaN(dateB)) {
        return (dateA - dateB) * modifier;
      }

      // Default string comparison
      return String(valA).localeCompare(String(valB), undefined, { numeric: true, sensitivity: 'base' }) * modifier;
    });
  }, [items, sortConfig, options?.getSortValue]);

  return {
    sortedData,
    sortConfig,
    requestSort,
    setSortConfig,
  };
}
