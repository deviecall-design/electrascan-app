import { Panel } from "@/components/Panel";
import { getSupabaseServer } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export default async function WatchlistPage() {
  const sb = getSupabaseServer();
  const { data, error } = await sb
    .from("watchlist")
    .select("ticker,name,asset_class,theme,active,last_price,last_checked")
    .order("asset_class", { ascending: true })
    .order("ticker", { ascending: true });

  return (
    <Panel title="Watchlist">
      {error ? (
        <p className="text-bear text-sm">Supabase not configured yet — set env vars and apply supabase/schema.sql.</p>
      ) : !data || data.length === 0 ? (
        <p className="text-mute text-sm">No rows. Run supabase/schema.sql to seed.</p>
      ) : (
        <table className="w-full text-sm">
          <thead className="text-mute text-xs uppercase tracking-wider">
            <tr>
              <th className="text-left py-2">Ticker</th>
              <th className="text-left">Name</th>
              <th className="text-left">Class</th>
              <th className="text-left">Theme</th>
              <th className="text-right">Last</th>
              <th className="text-right">Checked</th>
            </tr>
          </thead>
          <tbody>
            {data.map((r) => (
              <tr key={r.ticker} className="border-t border-border">
                <td className="py-2 font-medium">{r.ticker}</td>
                <td>{r.name}</td>
                <td className="text-mute">{r.asset_class}</td>
                <td className="text-mute">{r.theme ?? "—"}</td>
                <td className="text-right num">{r.last_price ?? "—"}</td>
                <td className="text-right num text-mute">
                  {r.last_checked ? new Date(r.last_checked).toLocaleTimeString() : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Panel>
  );
}
