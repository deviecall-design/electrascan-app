import React, { useState } from "react";
import { C, FONT } from "./tokens";

export default function RenameLabel({
  label,
  onSave,
}: {
  label: string;
  onSave: (next: string) => Promise<void> | void;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(label);
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    try {
      await onSave(value);
      setEditing(false);
    } finally {
      setBusy(false);
    }
  }

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => {
          setValue(label);
          setEditing(true);
        }}
        style={button}
      >
        Rename
      </button>
    );
  }

  return (
    <form
      onSubmit={event => {
        event.preventDefault();
        void save();
      }}
      style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", marginTop: 8 }}
    >
      <input
        aria-label="Plan name"
        value={value}
        onChange={event => setValue(event.target.value)}
        style={{
          minHeight: 44,
          flex: "1 1 220px",
          borderRadius: 10,
          border: `1px solid ${C.border}`,
          padding: "0 12px",
          fontSize: 16,
          fontFamily: FONT.body,
          color: C.text,
          background: C.bgCard,
        }}
      />
      <button type="submit" disabled={busy} style={{ ...button, background: C.orange, color: "#fff", borderColor: C.orange }}>
        {busy ? "Saving…" : "Save name"}
      </button>
      <button type="button" onClick={() => setEditing(false)} style={button}>Cancel</button>
    </form>
  );
}

const button: React.CSSProperties = {
  minHeight: 44,
  padding: "0 14px",
  borderRadius: 10,
  border: `1px solid ${C.border}`,
  background: C.bgCard,
  color: C.text,
  fontWeight: 700,
};
