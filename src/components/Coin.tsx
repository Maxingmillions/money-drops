export function Coin({ size = 28, className = "" }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      className={className}
      aria-hidden
      style={{ filter: "drop-shadow(0 6px 10px rgb(43 100 217 / 0.45))" }}
    >
      <defs>
        <radialGradient id="coinGrad" cx="35%" cy="30%" r="75%">
          <stop offset="0%" stopColor="#6fa8ff" />
          <stop offset="100%" stopColor="#2458c9" />
        </radialGradient>
      </defs>
      <circle cx="32" cy="32" r="30" fill="url(#coinGrad)" />
      <circle cx="32" cy="32" r="27" fill="none" stroke="rgba(255,255,255,0.75)" strokeWidth="2.5" strokeDasharray="60 20" strokeLinecap="round" transform="rotate(-30 32 32)" />
      <text
        x="32"
        y="42"
        textAnchor="middle"
        fontSize="30"
        fontWeight="800"
        fill="#fff"
        fontFamily="ui-sans-serif, system-ui, sans-serif"
      >
        $
      </text>
    </svg>
  );
}
