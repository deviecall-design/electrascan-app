import Link from "next/link";

const links = [
  { href: "/", label: "Dashboard" },
  { href: "/signals", label: "Signals" },
  { href: "/journal", label: "Journal" },
  { href: "/performance", label: "Performance" },
  { href: "/watchlist", label: "Watchlist" },
];

export function Nav() {
  return (
    <nav className="flex gap-4 text-sm">
      {links.map((l) => (
        <Link
          key={l.href}
          href={l.href}
          className="text-mute hover:text-ink transition-colors"
        >
          {l.label}
        </Link>
      ))}
    </nav>
  );
}
