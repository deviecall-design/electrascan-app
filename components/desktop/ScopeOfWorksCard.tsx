import React from "react";
import { C, FONT } from "./tokens";
import { GhostButton } from "../ui/anthropic/Button";
import { linesFromText, textFromLines, type ScopeOfWorks, type ScopeSection } from "../../lib/scopeOfWorks";

const fieldStyle = (paper: boolean): React.CSSProperties => ({
  display: "block",
  width: "100%",
  minHeight: 44,
  marginTop: 6,
  borderRadius: 10,
  border: `1px solid ${paper ? "#cbd5e1" : C.border}`,
  padding: "10px 12px",
  fontSize: 16,
  fontFamily: FONT.body,
  background: paper ? "#fff" : C.bg,
  color: paper ? "#1E293B" : C.text,
  boxSizing: "border-box",
});

export function ScopePreview({ scope, paper = false }: { scope: ScopeOfWorks; paper?: boolean }) {
  const muted = paper ? "#5C7A9E" : C.textMuted;
  const text = paper ? "#1E293B" : C.text;
  return (
    <section aria-label="Scope of works" style={{ marginTop: 22, color: text }}>
      <h3 style={{ margin: "0 0 8px", fontFamily: FONT.heading, fontSize: 14, letterSpacing: "0.04em", textTransform: "uppercase" }}>Scope of works</h3>
      {scope.inclusions.map(section => (
        <div key={section.heading} style={{ marginBottom: 10 }}>
          <div style={{ fontWeight: 700, fontSize: 13 }}>{section.heading}</div>
          {section.lines.map(line => (
            <div key={`${section.heading}-${line}`} style={{ fontSize: 13, padding: "2px 0 2px 8px" }}>{line}</div>
          ))}
        </div>
      ))}
      <ScopeList title="Exclusions" lines={scope.exclusions} muted={muted} />
      <ScopeList title="Assumptions" lines={scope.assumptions} muted={muted} />
      <div style={{ marginTop: 10 }}>
        <div style={{ fontWeight: 700, fontSize: 13 }}>Compliance</div>
        <p style={{ margin: "4px 0 0", fontSize: 13, color: muted }}>{scope.compliance}</p>
      </div>
      <ScopeList title="Clarifications" lines={scope.clarifications.length ? scope.clarifications : ["None from this takeoff."]} muted={muted} />
    </section>
  );
}

function ScopeList({ title, lines, muted }: { title: string; lines: string[]; muted: string }) {
  return (
    <div style={{ marginTop: 10 }}>
      <div style={{ fontWeight: 700, fontSize: 13 }}>{title}</div>
      {lines.map(line => (
        <div key={line} style={{ fontSize: 13, color: muted, padding: "2px 0 2px 8px" }}>{line}</div>
      ))}
    </div>
  );
}

export default function ScopeOfWorksCard({
  scope,
  onChange,
  onRebuild,
}: {
  scope: ScopeOfWorks;
  onChange: (scope: ScopeOfWorks) => void;
  onRebuild: () => void;
}) {
  function updateSection(index: number, patch: Partial<ScopeSection>) {
    onChange({
      ...scope,
      inclusions: scope.inclusions.map((section, sectionIndex) => sectionIndex === index ? { ...section, ...patch } : section),
    });
  }

  return (
    <section aria-label="Edit scope of works" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <h3 style={{ margin: 0, fontFamily: FONT.heading, fontSize: 16 }}>Edit scope of works</h3>
        <GhostButton onClick={onRebuild}>Rebuild from the takeoff</GhostButton>
      </div>
      <p style={{ margin: 0, color: C.textMuted, fontSize: 13 }}>
        Included on the quote and the PDF. Exclusions start from the usual Australian electrical allowances. Edit any line before you save.
      </p>
      {scope.inclusions.map((section, index) => (
        <div key={`${section.heading}-${index}`}>
          <label style={{ fontSize: 13, color: C.textMuted }}>
            Inclusion group
            <input
              aria-label={`Inclusion heading ${index + 1}`}
              value={section.heading}
              onChange={event => updateSection(index, { heading: event.target.value })}
              style={fieldStyle(false)}
            />
          </label>
          <label style={{ fontSize: 13, color: C.textMuted }}>
            Lines
            <textarea
              aria-label={`Inclusion lines ${index + 1}`}
              value={textFromLines(section.lines)}
              onChange={event => updateSection(index, { lines: linesFromText(event.target.value) })}
              style={{ ...fieldStyle(false), minHeight: 88 }}
            />
          </label>
        </div>
      ))}
      <label style={{ fontSize: 13, color: C.textMuted }}>
        Exclusions
        <textarea aria-label="Scope exclusions" value={textFromLines(scope.exclusions)} onChange={event => onChange({ ...scope, exclusions: linesFromText(event.target.value) })} style={{ ...fieldStyle(false), minHeight: 120 }} />
      </label>
      <label style={{ fontSize: 13, color: C.textMuted }}>
        Assumptions
        <textarea aria-label="Scope assumptions" value={textFromLines(scope.assumptions)} onChange={event => onChange({ ...scope, assumptions: linesFromText(event.target.value) })} style={{ ...fieldStyle(false), minHeight: 120 }} />
      </label>
      <label style={{ fontSize: 13, color: C.textMuted }}>
        AS/NZS 3000
        <textarea aria-label="Compliance note" value={scope.compliance} onChange={event => onChange({ ...scope, compliance: event.target.value })} style={{ ...fieldStyle(false), minHeight: 88 }} />
      </label>
      <label style={{ fontSize: 13, color: C.textMuted }}>
        Clarifications
        <textarea aria-label="Scope clarifications" value={textFromLines(scope.clarifications)} onChange={event => onChange({ ...scope, clarifications: linesFromText(event.target.value) })} style={{ ...fieldStyle(false), minHeight: 88 }} />
      </label>
    </section>
  );
}
