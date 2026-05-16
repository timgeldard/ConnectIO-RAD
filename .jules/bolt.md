## 2023-11-09 - [Optimizing Array Operations]
**Learning:** Found multiple chained array operations (like `.filter().map()` or successive `.filter()` calls) inside `useMemo` hooks for large datasets. This causes unnecessary allocations and garbage collection for intermediate arrays.
**Action:** Replaced these chained calls with a single `for...of` loop to minimize time complexity (O(N)) and prevent unnecessary intermediate object allocations.
