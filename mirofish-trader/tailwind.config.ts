import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "#0b0d10",
        panel: "#13171c",
        border: "#1f252c",
        ink: "#e6e8eb",
        mute: "#8a94a2",
        bull: "#22c55e",
        bear: "#ef4444",
        gold: "#f5b544",
      },
      fontFamily: {
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
    },
  },
  plugins: [],
};

export default config;
