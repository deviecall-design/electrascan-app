/** Time-of-day greeting for the dashboard. Name is the signed-in user or the tenant brand. */
export function timeGreeting(name: string, now = new Date()): string {
  const hour = now.getHours();
  const part = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const who = name.trim() || "there";
  return `${part}, ${who}`;
}
