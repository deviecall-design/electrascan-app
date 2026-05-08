/**
 * Barrel export for the Anthropic-system primitives.
 *
 * Import everything UI-facing from here:
 *   import { Card, PageHeader, Kpi, PrimaryButton } from '@/components/ui/anthropic';
 *
 * The underlying files have JSDoc on every component — treat this file as
 * the catalogue rather than a place to add new logic.
 */

export { default as Card }        from "./Card";
export { default as B }           from "./B";
export { default as PageHeader }  from "./PageHeader";
export { default as SectionHead } from "./SectionHead";
export { default as Footer }      from "./Footer";
export { PrimaryButton, GhostButton } from "./Button";
export { default as Kpi }         from "./Kpi";
export { default as MiniStat }    from "./MiniStat";
export { default as StatusPill }  from "./StatusPill";
export type { EstimateStatus }    from "./StatusPill";
export { default as ConfPill }    from "./ConfPill";
export { default as SymbolBadge } from "./SymbolBadge";
export { default as NavItem }     from "./NavItem";
export { default as ScanRow }     from "./ScanRow";
export { default as Dots }        from "./Dots";
export { Th, Td }                 from "./Table";
