/**
 * Placeholder panel for screens that haven't been built yet. Used during
 * the reskin so routing is verifiable end-to-end before each screen gets
 * its real content in Step 2 onwards.
 *
 * Uses the full Anthropic design system — warm-cream surface, Poppins
 * heading, Lora-italic subtitle, orange sparkle — so the shell looks
 * intentional even before real content exists.
 */

import React from "react";
import { Sparkles } from "lucide-react";
import { C, FONT, RADIUS } from "../components/desktop/tokens";
import { PageHeader, Card, Footer } from "../components/ui/anthropic";

interface ScreenPlaceholderProps {
  title: string;
  phase: string;
  description?: string;
}

export default function ScreenPlaceholder({ title, phase, description }: ScreenPlaceholderProps) {
  return (
    <div className="anim-in">
      <PageHeader
        title={title}
        sub={`${phase} — the real content lands in the next commit on this screen.`}
      />
      <Card
        style={{
          padding: "64px 40px",
          border: `1px dashed ${C.border}`,
          textAlign: "center",
        }}
      >
        <div
          style={{
            width: 48,
            height: 48,
            borderRadius: RADIUS.lg,
            backgroundColor: C.orangeSoft,
            color: C.orange,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: 16,
          }}
        >
          <Sparkles size={22} />
        </div>
        <h3
          style={{
            fontFamily: FONT.heading,
            fontSize: 18,
            fontWeight: 600,
            color: C.text,
            margin: "0 0 8px 0",
          }}
        >
          {title} — arrives in {phase}
        </h3>
        {description && (
          <p
            style={{
              fontSize: 14,
              color: C.textMuted,
              maxWidth: 560,
              margin: "0 auto",
              lineHeight: 1.6,
              fontStyle: "italic",
            }}
          >
            {description}
          </p>
        )}
      </Card>
      <Footer />
    </div>
  );
}
