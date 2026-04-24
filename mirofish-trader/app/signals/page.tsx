import { Panel } from "@/components/Panel";

export default function SignalsPage() {
  return (
    <Panel title="Signal Feed">
      <p className="text-mute text-sm">
        Live signals from the scan cron will stream here. Approve / reject controls pending.
      </p>
    </Panel>
  );
}
