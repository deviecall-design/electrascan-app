/**
 * CommandPalette — real ⌘K search over scans, estimates, and pages.
 *
 * Opens from the shell search field. Navigates; it does not invent results.
 */

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, ArrowRight } from "lucide-react";
import { C, FONT, RADIUS } from "./tokens";
import {
  filterPaletteItems,
  PALETTE_GROUP_ORDER,
  type PaletteItem,
} from "../../lib/commandPalette";

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  items: PaletteItem[];
}

export default function CommandPalette({ open, onClose, items }: CommandPaletteProps) {
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);

  const results = useMemo(() => filterPaletteItems(items, query), [items, query]);

  const go = (item: PaletteItem) => {
    onClose();
    navigate(item.to);
  };

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setActive(0);
    const id = window.setTimeout(() => inputRef.current?.focus(), 0);
    return () => window.clearTimeout(id);
  }, [open]);

  useEffect(() => {
    setActive(0);
  }, [query]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        setActive(i => Math.min(i + 1, Math.max(results.length - 1, 0)));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setActive(i => Math.max(i - 1, 0));
      } else if (e.key === "Enter") {
        e.preventDefault();
        const item = results[active];
        if (item) go(item);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, results, active, onClose, navigate]);

  if (!open) return null;

  const groups = PALETTE_GROUP_ORDER
    .map(group => ({ group, items: results.filter(i => i.group === group) }))
    .filter(g => g.items.length > 0);

  let running = 0;

  return (
    <div
      role="presentation"
      onMouseDown={e => {
        if (e.target === e.currentTarget) onClose();
      }}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 80,
        backgroundColor: "rgba(10, 22, 40, 0.72)",
        display: "flex",
        justifyContent: "center",
        paddingTop: 96,
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Search scans, estimates, and pages"
        style={{
          width: "min(560px, calc(100vw - 32px))",
          maxHeight: "min(560px, calc(100vh - 120px))",
          backgroundColor: C.bgCard,
          border: `1px solid ${C.border}`,
          borderRadius: RADIUS.xl,
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          boxShadow: "0 24px 64px rgba(0, 0, 0, 0.45)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "14px 16px",
            borderBottom: `1px solid ${C.border}`,
          }}
        >
          <Search size={16} color={C.textSubtle} />
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search scans, estimates, plans…"
            aria-label="Search scans, estimates, plans"
            style={{
              flex: 1,
              fontFamily: FONT.body,
              fontSize: 15,
              color: C.text,
              background: "transparent",
              border: "none",
              outline: "none",
            }}
          />
          <kbd
            style={{
              fontFamily: FONT.heading,
              fontSize: 11,
              color: C.textSubtle,
              padding: "2px 6px",
              border: `1px solid ${C.border}`,
              borderRadius: 4,
            }}
          >
            ESC
          </kbd>
        </div>

        <div style={{ overflowY: "auto", padding: "8px 0" }}>
          {results.length === 0 ? (
            <div
              style={{
                padding: "28px 20px",
                textAlign: "center",
                color: C.textMuted,
                fontSize: 14,
              }}
            >
              No matching scans, estimates, or pages.
            </div>
          ) : (
            groups.map(({ group, items: groupItems }) => (
              <div key={group} style={{ marginBottom: 8 }}>
                <div
                  style={{
                    fontFamily: FONT.heading,
                    fontSize: 11,
                    fontWeight: 600,
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                    color: C.textSubtle,
                    padding: "8px 16px 4px",
                  }}
                >
                  {group}
                </div>
                {groupItems.map(item => {
                  const index = running++;
                  const isActive = index === active;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onMouseEnter={() => setActive(index)}
                      onClick={() => go(item)}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        width: "100%",
                        textAlign: "left",
                        padding: "9px 16px",
                        backgroundColor: isActive ? C.orangeSoft : "transparent",
                        color: C.text,
                        fontFamily: FONT.heading,
                        fontSize: 14,
                      }}
                    >
                      <span style={{ flex: 1, minWidth: 0 }}>
                        <span style={{ display: "block", fontWeight: 500 }}>{item.label}</span>
                        {item.hint && (
                          <span
                            style={{
                              display: "block",
                              fontSize: 12,
                              color: C.textMuted,
                              fontFamily: FONT.body,
                              fontStyle: "italic",
                            }}
                          >
                            {item.hint}
                          </span>
                        )}
                      </span>
                      <ArrowRight size={14} color={isActive ? C.orange : C.textSubtle} />
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
