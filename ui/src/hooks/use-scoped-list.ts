import { useMemo } from "react";

/**
 * Filters `items` down to the active company scope: unfiltered when
 * `isOverall`, otherwise kept only if `getKey(item)` is in `idSet`.
 */
export function useScopedList<T>(
  items: T[],
  isOverall: boolean,
  idSet: Set<string>,
  getKey: (item: T) => string,
): T[] {
  return useMemo(
    () => (isOverall ? items : items.filter((item) => idSet.has(getKey(item)))),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- getKey is a stable/inline accessor, not a changing dependency
    [items, isOverall, idSet],
  );
}
