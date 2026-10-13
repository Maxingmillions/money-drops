"use client";

import { useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";

const PURPLE = "#9945FF";
const GREEN = "#14F195";

/** Draws the Solana logo (three slanted bars) onto a canvas texture. */
function makeFaceTexture(size = 512) {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const ctx = c.getContext("2d")!;
  const r = size / 2;

  // Face: deep purple with a soft radial highlight.
  const bg = ctx.createRadialGradient(r * 0.7, r * 0.6, r * 0.1, r, r, r);
  bg.addColorStop(0, "#2a1458");
  bg.addColorStop(1, "#140a2e");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, size, size);

  // Inner ring.
  ctx.strokeStyle = "rgba(255,255,255,0.18)";
  ctx.lineWidth = size * 0.018;
  ctx.beginPath();
  ctx.arc(r, r, r * 0.86, 0, Math.PI * 2);
  ctx.stroke();

  // Logo bars.
  const w = size * 0.5;
  const h = size * 0.095;
  const gap = size * 0.06;
  const skew = size * 0.11;
  const x0 = r - w / 2;
  const y0 = r - (3 * h + 2 * gap) / 2;
  const grad = ctx.createLinearGradient(x0, y0 + 3 * h, x0 + w, y0);
  grad.addColorStop(0, GREEN);
  grad.addColorStop(1, PURPLE);
  ctx.fillStyle = grad;
  for (let i = 0; i < 3; i++) {
    const y = y0 + i * (h + gap);
    const flip = i === 1; // middle bar leans the other way
    ctx.beginPath();
    if (!flip) {
      ctx.moveTo(x0 + skew, y);
      ctx.lineTo(x0 + w, y);
      ctx.lineTo(x0 + w - skew, y + h);
      ctx.lineTo(x0, y + h);
    } else {
      ctx.moveTo(x0, y);
      ctx.lineTo(x0 + w - skew, y);
      ctx.lineTo(x0 + w, y + h);
      ctx.lineTo(x0 + skew, y + h);
    }
    ctx.closePath();
    ctx.fill();
  }

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

function Coin({ spin }: { spin: number }) {
  const group = useRef<THREE.Group>(null);
  const face = useMemo(() => makeFaceTexture(), []);
  const materials = useMemo(() => {
    const rim = new THREE.MeshStandardMaterial({ color: "#5b2bbf", metalness: 0.85, roughness: 0.3 });
    const top = new THREE.MeshStandardMaterial({ map: face, metalness: 0.6, roughness: 0.35 });
    return [rim, top, top];
  }, [face]);

  useFrame((state, dt) => {
    if (!group.current) return;
    group.current.rotation.y += dt * spin;
    group.current.position.y = Math.sin(state.clock.elapsedTime * 1.6) * 0.06;
  });

  return (
    <group ref={group} rotation={[Math.PI / 2 - 0.45, 0, 0.12]}>
      <mesh material={materials} castShadow>
        <cylinderGeometry args={[1, 1, 0.16, 96]} />
      </mesh>
      {/* Thin green bevel around the rim (torus lies in the cylinder's face plane). */}
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[1.0, 0.03, 16, 96]} />
        <meshStandardMaterial color={GREEN} metalness={0.9} roughness={0.25} />
      </mesh>
    </group>
  );
}

/**
 * Rotating 3D Solana coin. Renders on a transparent canvas so it can sit on
 * any background. `size` is the CSS box in px.
 */
export function SolCoin3D({ size = 160, spin = 0.9, className = "" }: { size?: number; spin?: number; className?: string }) {
  return (
    <div className={className} style={{ width: size, height: size }} aria-hidden>
      <Canvas
        dpr={[1, 2]}
        camera={{ position: [0, 0, 4.4], fov: 35 }}
        gl={{ alpha: true, antialias: true }}
        style={{ background: "transparent" }}
      >
        <ambientLight intensity={0.6} />
        <hemisphereLight args={["#ffffff", "#3b2a6a", 0.8]} />
        <directionalLight position={[3, 4, 5]} intensity={2.2} />
        <pointLight position={[-3, -2, 3]} intensity={1.2} color={GREEN} />
        <pointLight position={[2, 3, -3]} intensity={1.4} color={PURPLE} />
        <Coin spin={spin} />
      </Canvas>
    </div>
  );
}
