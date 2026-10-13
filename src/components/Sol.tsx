import { formatSol } from "@/lib/geo";

/** The Solana logo as an inline glyph; scales with the surrounding font size. */
export function SolMark({ className = "", size }: { className?: string; size?: number | string }) {
  const id = "solmark";
  return (
    <svg
      viewBox="0 0 398 312"
      className={`inline-block shrink-0 align-[-0.08em] ${className}`}
      style={{ width: size ?? "0.78em", height: size ?? "0.78em" }}
      aria-label="SOL"
      role="img"
    >
      <defs>
        <linearGradient id={`${id}-g`} x1="0" y1="1" x2="1" y2="0">
          <stop offset="0%" stopColor="#14F195" />
          <stop offset="100%" stopColor="#9945FF" />
        </linearGradient>
      </defs>
      <g fill={`url(#${id}-g)`}>
        <path d="M64.6 237.9c2.4-2.4 5.7-3.8 9.2-3.8h317.4c5.8 0 8.7 7 4.6 11.1l-62.7 62.7c-2.4 2.4-5.7 3.8-9.2 3.8H6.5c-5.8 0-8.7-7-4.6-11.1l62.7-62.7z" />
        <path d="M64.6 3.8C67.1 1.4 70.4 0 73.8 0h317.4c5.8 0 8.7 7 4.6 11.1l-62.7 62.7c-2.4 2.4-5.7 3.8-9.2 3.8H6.5c-5.8 0-8.7-7-4.6-11.1L64.6 3.8z" />
        <path d="M333.1 120.1c-2.4-2.4-5.7-3.8-9.2-3.8H6.5c-5.8 0-8.7 7-4.6 11.1l62.7 62.7c2.4 2.4 5.7 3.8 9.2 3.8h317.4c5.8 0 8.7-7 4.6-11.1l-62.7-62.7z" />
      </g>
    </svg>
  );
}

/** "◎ 0.5" style amount with the real Solana mark instead of a unicode circle. */
export function SolAmount({ lamports, className = "", unit = false }: { lamports: number; className?: string; unit?: boolean }) {
  return (
    <span className={`inline-flex items-baseline gap-[0.22em] whitespace-nowrap ${className}`}>
      <SolMark />
      <span>{formatSol(lamports, { compact: true })}</span>
      {unit && <span className="text-[0.45em] font-semibold opacity-60">SOL</span>}
    </span>
  );
}

/** Same glyph as an HTML string, for DOM-built map markers. */
export const SOL_MARK_HTML =
  '<svg viewBox="0 0 398 312" style="width:.8em;height:.8em;vertical-align:-0.08em;margin-right:.2em" aria-hidden><defs><linearGradient id="solmk" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stop-color="#14F195"/><stop offset="1" stop-color="#9945FF"/></linearGradient></defs><g fill="url(#solmk)"><path d="M64.6 237.9c2.4-2.4 5.7-3.8 9.2-3.8h317.4c5.8 0 8.7 7 4.6 11.1l-62.7 62.7c-2.4 2.4-5.7 3.8-9.2 3.8H6.5c-5.8 0-8.7-7-4.6-11.1l62.7-62.7z"/><path d="M64.6 3.8C67.1 1.4 70.4 0 73.8 0h317.4c5.8 0 8.7 7 4.6 11.1l-62.7 62.7c-2.4 2.4-5.7 3.8-9.2 3.8H6.5c-5.8 0-8.7-7-4.6-11.1L64.6 3.8z"/><path d="M333.1 120.1c-2.4-2.4-5.7-3.8-9.2-3.8H6.5c-5.8 0-8.7 7-4.6 11.1l62.7 62.7c2.4 2.4 5.7 3.8 9.2 3.8h317.4c5.8 0 8.7-7 4.6-11.1l-62.7-62.7z"/></g></svg>';
