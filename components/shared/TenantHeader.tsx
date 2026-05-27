import React from "react";
import { useTenant } from "../../contexts/TenantContext";
import TenantLogo from "./TenantLogo";

type Variant = "full" | "compact";

interface TenantHeaderProps {
  showAddress?: boolean;
  showLicense?: boolean;
  variant?: Variant;
}

// Header used in PDFs, builder-facing reports and other external outputs.
// Intentionally carries no ElectraScan branding — only the tenant's details.
export default function TenantHeader({
  showAddress = true,
  showLicense = false,
  variant = "full",
}: TenantHeaderProps) {
  const { tenant } = useTenant();
  const compact = variant === "compact";
  const logoSize = compact ? "sm" : "lg";

  const nameSize = compact ? 14 : 18;
  const metaSize = compact ? 10 : 12;
  const gap = compact ? 10 : 14;
  const paddingBottom = compact ? 8 : 12;

  const metaLine = [tenant.contactPhone, tenant.contactEmail].filter(Boolean).join(" · ");

  // Licence number isn't on the current TenantConfig shape — kept as a prop for
  // API parity with the spec so callers don't need to change once it's added.
  void showLicense;

  return (
    <header
      className="tenant-header"
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap,
        paddingBottom,
        borderBottom: `1px solid ${tenant.primaryColour || "#E2E8F0"}`,
        color: tenant.accentColour || "#0F172A",
        background: "#FFFFFF",
      }}
    >
      <TenantLogo size={logoSize} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: nameSize,
            fontWeight: 800,
            letterSpacing: "-0.01em",
            color: tenant.primaryColour || "#0F172A",
            lineHeight: 1.2,
          }}
        >
          {tenant.name}
        </div>
        {tenant.abn && (
          <div style={{ fontSize: metaSize, color: "#475569", marginTop: 2 }}>
            ABN: {tenant.abn}
          </div>
        )}
        {showAddress && tenant.address && (
          <div style={{ fontSize: metaSize, color: "#475569", marginTop: 2 }}>
            {tenant.address}
          </div>
        )}
        {metaLine && (
          <div style={{ fontSize: metaSize, color: "#475569", marginTop: 2 }}>
            {metaLine}
          </div>
        )}
      </div>
    </header>
  );
}
