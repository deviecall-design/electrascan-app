import React from "react";
import { useTenant } from "../../contexts/TenantContext";

type Variant = "pdf" | "email";

interface TenantHeaderProps {
  variant: Variant;
}

export default function TenantHeader({ variant }: TenantHeaderProps) {
  const { tenant } = useTenant();
  const isPdf = variant === "pdf";

  const nameSize = isPdf ? 20 : 16;
  const metaSize = isPdf ? 11 : 12;
  const padding = isPdf ? "0 0 14px" : "0 0 12px";
  const gap = isPdf ? 14 : 12;
  const logoHeight = isPdf ? 56 : 44;

  const contactLine = [tenant.contactPhone, tenant.contactEmail].filter(Boolean).join(" · ");

  return (
    <header
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap,
        padding,
        borderBottom: `2px solid ${tenant.primaryColour}`,
        background: "#FFFFFF",
        color: tenant.accentColour,
        fontFamily: isPdf ? "Helvetica, Arial, sans-serif" : "-apple-system, BlinkMacSystemFont, Segoe UI, sans-serif",
      }}
    >
      {tenant.logoUrl ? (
        <img
          src={tenant.logoUrl}
          alt={tenant.name}
          style={{ height: logoHeight, width: "auto", objectFit: "contain", flexShrink: 0 }}
        />
      ) : (
        <div
          style={{
            fontSize: nameSize + 4,
            fontWeight: 800,
            color: tenant.primaryColour,
            letterSpacing: "-0.01em",
            lineHeight: 1,
          }}
        >
          {tenant.name}
        </div>
      )}
      <div style={{ flex: 1, minWidth: 0, textAlign: isPdf ? "right" : "left" }}>
        {tenant.logoUrl && (
          <div
            style={{
              fontSize: nameSize,
              fontWeight: 700,
              color: tenant.accentColour,
              lineHeight: 1.2,
            }}
          >
            {tenant.name}
          </div>
        )}
        {contactLine && (
          <div style={{ fontSize: metaSize, color: "#475569", marginTop: 4 }}>{contactLine}</div>
        )}
        {tenant.abn && (
          <div style={{ fontSize: metaSize, color: "#475569", marginTop: 2 }}>ABN: {tenant.abn}</div>
        )}
      </div>
    </header>
  );
}
