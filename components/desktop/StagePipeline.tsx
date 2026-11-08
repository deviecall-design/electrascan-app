import React from "react";
import { C, FONT } from "./tokens";
import { WORKFLOW_STAGES } from "../../lib/workflowStage";

export default function StagePipeline({ index, label }: { index: number; label?: string }) {
  return (
    <ol aria-label={label || "Job stage"} style={{ display: "flex", gap: 6, listStyle: "none", padding: 0, margin: "8px 0 0", flexWrap: "wrap" }}>
      {WORKFLOW_STAGES.map((stage, stageIndex) => {
        const state = stageIndex < index ? "done" : stageIndex === index ? "current" : "later";
        return (
          <li
            key={stage.id}
            aria-current={state === "current" ? "step" : undefined}
            style={{
              minHeight: 32,
              padding: "4px 10px",
              borderRadius: 999,
              fontFamily: FONT.heading,
              fontSize: 12,
              fontWeight: 700,
              background: state === "current" ? C.orange : state === "done" ? C.orangeSoft : C.bgSoft,
              color: state === "current" ? "#fff" : state === "done" ? C.orangeDark : C.textMuted,
            }}
          >
            {stage.label}
          </li>
        );
      })}
    </ol>
  );
}
