import { useMemo } from "react";

/** Builds a Map from `item.id` to `item`, memoized on `items`. */
export function useByIdMap<T extends { id: string }>(items: T[]): Map<string, T> {
  return useMemo(() => {
    const map = new Map<string, T>();
    items.forEach((item) => map.set(item.id, item));
    return map;
  }, [items]);
}
