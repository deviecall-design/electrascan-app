import { Panel } from "@/components/Panel";

export default function DashboardPage() {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      <Panel title="Open Positions">
        <p className="text-mute text-sm">No positions yet. Cron + engines land in the next commit.</p>
      </Panel>
      <Panel title="Today's P&L">
        <div className="num text-3xl">$0.00</div>
        <div className="num text-mute text-sm">0.00%</div>
      </Panel>
      <Panel title="Win Rate (30d)">
        <div className="num text-3xl">—</div>
      </Panel>
      <Panel title="Theme Heat Map">
        <p className="text-mute text-sm">Defence upstream · AI energy/nuclear · ASML supply chain</p>
      </Panel>
    </div>
  );
}
