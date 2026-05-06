import React from 'react';

/**
 * ElectraScan logo lockup (Concept 5 — Dynamic Waveform).
 * Renders white strokes for use on dark backgrounds (sidebar).
 * Pass dark={false} for light backgrounds.
 */
const Logo: React.FC<{ className?: string; dark?: boolean }> = ({ className, dark = true }) => {
  const stroke = dark ? '#FFFFFF' : '#111111';
  const text = dark ? '#FFFFFF' : '#111111';

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 440 100"
      className={className}
      role="img"
      aria-label="ElectraScan"
    >
      {/* Wave 3 — lightest (back) */}
      <path
        d="M 16,50 C 22,32 28,32 34,50 C 40,68 46,68 52,50 C 58,32 64,32 70,50 C 73,59 75,62 76,58"
        fill="none"
        stroke={stroke}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.3"
      />
      {/* Wave 2 — medium */}
      <path
        d="M 16,50 C 22,28 28,28 34,50 C 40,72 46,72 52,50 C 58,28 64,28 70,50 C 73,61 75,64 76,58"
        fill="none"
        stroke={stroke}
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.6"
      />
      {/* Wave 1 — boldest (front) */}
      <path
        d="M 16,50 C 22,22 28,22 34,50 C 40,78 46,78 52,50 C 58,22 64,22 70,50"
        fill="none"
        stroke={stroke}
        strokeWidth="3.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Baseline */}
      <line x1="16" y1="50" x2="76" y2="50" stroke={stroke} strokeWidth="1" opacity="0.2" />
      {/* Wordmark */}
      <text
        x="92"
        y="58"
        fontFamily="'Segoe UI', 'Helvetica Neue', Arial, sans-serif"
        fontWeight="700"
        fontSize="32"
        letterSpacing="-0.5"
        fill={text}
      >
        ElectraScan
      </text>
    </svg>
  );
};

export default Logo;