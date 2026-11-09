import React from "react";
import { C, FONT } from "./desktop/tokens";

export type ListLoad = "loading" | "ready" | "empty" | "error";

/**
 * Distinguishes a failed list from a list that loaded with no rows.
 * The message is fixed. Callers log the raw error themselves.
 */
export default function ListQueryNotice({
  status,
  noun,
  emptyText,
  onRetry,
  showEmpty = true,
  listKey,
}: {
  status: ListLoad;
  noun: string;
  emptyText: string;
  onRetry: () => void;
  showEmpty?: boolean;
  listKey?: string;
}) {
  if (status === "loading" || status === "ready") return null;
  if (status === "empty" && !showEmpty) return null;
  if (status === "empty") {
    return (
      <p
        role="status"
        data-list={listKey}
        data-list-state="empty"
        style={{ margin: "8px 0", color: C.textMuted, fontFamily: FONT.body, fontSize: 14 }}
      >
        {emptyText}
      </p>
    );
  }
  return (
    <div
      role="alert"
      data-list={listKey}
      data-list-state="error"
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        flexWrap: "wrap",
        margin: "8px 0",
        padding: "10px 14px",
        borderRadius: 10,
        background: "#FEF2F2",
        border: "1px solid #FECACA",
        color: "#9F1239",
        fontFamily: FONT.body,
        fontSize: 14,
      }}
    >
      <span>Could not load {noun}.</span>
      <button
        type="button"
        onClick={onRetry}
        style={{
          minHeight: 44,
          padding: "0 14px",
          borderRadius: 8,
          border: "1px solid #9F1239",
          background: "#fff",
          color: "#9F1239",
          fontWeight: 700,
        }}
      >
        Retry
      </button>
    </div>
  );
}
