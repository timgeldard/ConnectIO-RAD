import { useEffect, useState } from "react";
import { ApiError } from "./api";

export type LoadState<T> =
  | { kind: "loading" }
  | { kind: "error"; message: string; status?: number }
  | { kind: "ready"; data: T };

export function useBatchData<T>(
  fetcher: (materialId: string, batchId: string) => Promise<T>,
  materialId: string,
  batchId: string,
): LoadState<T> {
  const [state, setState] = useState<LoadState<T>>({ kind: "loading" });
  useEffect(() => {
    let cancelled = false;
    setState({ kind: "loading" });
    if (!materialId || !batchId) {
      setState({ kind: "error", message: "Material ID and Batch ID are required." });
      return () => {
        cancelled = true;
      };
    }
    fetcher(materialId, batchId)
      .then((data) => {
        if (!cancelled) setState({ kind: "ready", data });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        if (err instanceof ApiError) {
          setState({ kind: "error", message: err.message, status: err.status });
        } else {
          setState({ kind: "error", message: err instanceof Error ? err.message : "Request failed" });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [fetcher, materialId, batchId]);
  return state;
}
