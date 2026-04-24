import { Panel } from "@/components/Panel";

export default function PerformancePage() {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Panel title="Win Rate"><div className="num text-3xl">—</div></Panel>
      <Panel title="Avg R"><div className="num text-3xl">—</div></Panel>
      <Panel title="Expectancy"><div className="num text-3xl">—</div></Panel>
      <Panel title="Equity Curve"><p className="text-mute text-sm">Chart lands with first closed trades.</p></Panel>
    </div>
  );
}
