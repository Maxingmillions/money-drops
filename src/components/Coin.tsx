/** Flat Solana coin for markers, rows and anywhere small. */
export function Coin({ size = 28, className = "" }: { size?: number; className?: string }) {
  const id = `sol-${size}`;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      className={className}
      aria-hidden
      style={{ filter: "drop-shadow(0 6px 10px rgb(80 30 160 / 0.4))" }}
    >
      <defs>
        <radialGradient id={`${id}-bg`} cx="35%" cy="30%" r="80%">
          <stop offset="0%" stopColor="#3b1d7a" />
          <stop offset="100%" stopColor="#15092f" />
        </radialGradient>
        <linearGradient id={`${id}-bar`} x1="0" y1="1" x2="1" y2="0">
          <stop offset="0%" stopColor="#14F195" />
          <stop offset="100%" stopColor="#9945FF" />
        </linearGradient>
      </defs>
      <circle cx="32" cy="32" r="30" fill={`url(#${id}-bg)`} />
      <circle cx="32" cy="32" r="30" fill="none" stroke="#9945FF" strokeWidth="2.5" />
      <circle cx="32" cy="32" r="26" fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth="1" />
      <g fill={`url(#${id}-bar)`}>
        <path d="M22 21h22l-5 5H17z" />
        <path d="M17 29h22l5 5H22z" />
        <path d="M22 37h22l-5 5H17z" />
      </g>
    </svg>
  );
}
