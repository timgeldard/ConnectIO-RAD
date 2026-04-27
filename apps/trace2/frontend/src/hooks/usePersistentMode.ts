import { useCallback, useState } from "react";

/**
 * useState backed by localStorage. Used by the lineage pages to remember the
 * user's last-selected graph view (Lineage / Tree / Network / Blast radius)
 * across navigations and reloads. Falls back gracefully when storage is
 * unavailable (private browsing, quota errors).
 */
export function usePersistentMode<T extends string>(
  key: string,
  initial: T,
  allowed: readonly T[],
): [T, (next: T) => void] {
  const [value, setValue] = useState<T>(() => {
    if (typeof window === "undefined") return initial;
    try {
      const stored = window.localStorage.getItem(key);
      if (stored && (allowed as readonly string[]).includes(stored)) {
        return stored as T;
      }
    } catch {
      // ignore
    }
    return initial;
  });

  const set = useCallback(
    (next: T) => {
      setValue(next);
      if (typeof window === "undefined") return;
      try {
        window.localStorage.setItem(key, next);
      } catch {
        // storage is best-effort
      }
    },
    [key],
  );

  return [value, set];
}
