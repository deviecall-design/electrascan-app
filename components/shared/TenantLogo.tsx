import React from "react";
import { useTenant } from "../../contexts/TenantContext";

type Size = "sm" | "md" | "lg";

interface TenantLogoProps {
  size?: Size;
  className?: string;
}

const SIZE_PX: Record<Size, number> = { sm: 32, md: 48, lg: 64 };

function initialsFor(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "??";
  const first = words[0][0] ?? "";
  const second = (words[1]?.[0] ?? words[0][1] ?? "") as string;
  return (first + second).toUpperCase().slice(0, 2) || "??";
}

export default function TenantLogo({ size = "md", className }: TenantLogoProps) {
  const { tenant } = useTenant();
  const px = SIZE_PX[size];
  const fontSize = Math.round(px * 0.4);

  const baseStyle: React.CSSProperties = {
    width: px,
    height: px,
    borderRadius: px / 2,
    flexShrink: 0,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  };

  if (tenant.logoUrl) {
    return (
      <span className={className} style={{ ...baseStyle, background: "#fff" }}>
        <img
          src={tenant.logoUrl}
          alt={tenant.name}
          style={{ width: "100%", height: "100%", objectFit: "contain" }}
        />
      </span>
    );
  }

  return (
    <span
      className={className}
      style={{
        ...baseStyle,
        background: tenant.primaryColour || "#1E40AF",
        color: "#fff",
        fontWeight: 800,
        fontSize,
        letterSpacing: "0.02em",
      }}
      aria-label={tenant.name}
    >
      {initialsFor(tenant.name)}
    </span>
  );
}
