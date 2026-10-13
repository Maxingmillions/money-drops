"use client";

import dynamic from "next/dynamic";
import { Coin } from "./Coin";

// The WebGL coin is loaded on the client only; the flat SVG coin stands in
// until it's ready (and on devices without WebGL).
const SolCoin3D = dynamic(() => import("./SolCoin3D").then((m) => m.SolCoin3D), {
  ssr: false,
  loading: () => null,
});

export function SolCoin({ size = 160, className = "" }: { size?: number; className?: string }) {
  return (
    <div className={`relative ${className}`} style={{ width: size, height: size }}>
      <div className="absolute inset-0 grid place-items-center opacity-0">
        <Coin size={size * 0.8} />
      </div>
      <SolCoin3D size={size} className="absolute inset-0" />
    </div>
  );
}
