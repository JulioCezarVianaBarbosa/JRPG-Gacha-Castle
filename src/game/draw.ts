import type { EnemyDef, Palette, WeaponKind } from "@/lib/types";

// ─── small helpers ─────────────────────────────────────────────────────────

export function rr(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rad = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rad, y);
  ctx.arcTo(x + w, y, x + w, y + h, rad);
  ctx.arcTo(x + w, y + h, x, y + h, rad);
  ctx.arcTo(x, y + h, x, y, rad);
  ctx.arcTo(x, y, x + w, y, rad);
  ctx.closePath();
}

export function shade(hex: string, amt: number): string {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.max(0, Math.min(255, (n >> 16) + amt));
  const g = Math.max(0, Math.min(255, ((n >> 8) & 0xff) + amt));
  const b = Math.max(0, Math.min(255, (n & 0xff) + amt));
  return `rgb(${r},${g},${b})`;
}

export function lerp(a: number, b: number, t: number) { return a + (b - a) * t; }

// ─── Particles / floating text ─────────────────────────────────────────────

export interface Particle {
  x: number; y: number; vx: number; vy: number; g: number; drag: number;
  life: number; max: number; size: number; color: string;
  kind: "spark" | "confetti" | "smoke" | "star" | "ember";
  rot: number; vr: number;
}

export interface FloatText {
  x: number; y: number; life: number; max: number; text: string; color: string; size: number;
}

export function spawnBurst(parts: Particle[], x: number, y: number, color: string, n: number, speed = 180, kind: Particle["kind"] = "spark") {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2;
    const v = speed * (0.4 + Math.random() * 0.8);
    parts.push({
      x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - speed * 0.3,
      g: kind === "smoke" ? -60 : 420, drag: kind === "smoke" ? 0.92 : 0.985,
      life: 0, max: 0.5 + Math.random() * 0.5,
      size: kind === "confetti" ? 5 + Math.random() * 4 : 2.5 + Math.random() * 3,
      color, kind, rot: Math.random() * 6.3, vr: (Math.random() - 0.5) * 10,
    });
  }
}

export function updateDrawParticles(ctx: CanvasRenderingContext2D, parts: Particle[], dt: number) {
  for (let i = parts.length - 1; i >= 0; i--) {
    const p = parts[i];
    p.life += dt;
    if (p.life >= p.max) { parts.splice(i, 1); continue; }
    p.vx *= p.drag; p.vy *= p.drag; p.vy += p.g * dt;
    p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.vr * dt;
    const k = 1 - p.life / p.max;
    ctx.globalAlpha = k;
    if (p.kind === "confetti") {
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
      ctx.fillStyle = p.color; ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
      ctx.restore();
    } else if (p.kind === "smoke") {
      ctx.fillStyle = p.color;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.size * (1 + p.life * 2), 0, 6.3); ctx.fill();
    } else if (p.kind === "star") {
      drawStar(ctx, p.x, p.y, p.size * k * 2, p.color, p.rot);
    } else {
      ctx.fillStyle = p.color;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.size * k, 0, 6.3); ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
}

export function drawStar(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string, rot = 0) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
  ctx.fillStyle = color;
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const rad = i % 2 === 0 ? r : r * 0.4;
    const a = (i * Math.PI) / 4;
    ctx.lineTo(Math.cos(a) * rad, Math.sin(a) * rad);
  }
  ctx.closePath(); ctx.fill(); ctx.restore();
}

export function updateDrawFloats(ctx: CanvasRenderingContext2D, floats: FloatText[], dt: number) {
  for (let i = floats.length - 1; i >= 0; i--) {
    const f = floats[i];
    f.life += dt;
    if (f.life >= f.max) { floats.splice(i, 1); continue; }
    const k = f.life / f.max;
    f.y -= 46 * dt;
    ctx.globalAlpha = k < 0.2 ? k / 0.2 : 1 - Math.max(0, (k - 0.6)) / 0.4;
    ctx.font = `800 ${f.size}px "Alegreya Sans", sans-serif`;
    ctx.textAlign = "center";
    ctx.lineWidth = 4; ctx.strokeStyle = "rgba(20,12,6,0.85)";
    ctx.strokeText(f.text, f.x, f.y);
    ctx.fillStyle = f.color;
    ctx.fillText(f.text, f.x, f.y);
  }
  ctx.globalAlpha = 1;
}

// ─── Chibi hero / NPC ──────────────────────────────────────────────────────

export interface ChibiOpts {
  x: number; y: number; s: number; // s = overall scale (~1 => 60px tall)
  face: 1 | -1;
  walk: number; // 0..inf phase
  moving: boolean;
  pal: Palette;
  weapon: WeaponKind | "none" | "spear" | "broom";
  blink: boolean;
  aura?: string;
  hurt?: number; // 0..1 flash
  swing?: number; // 0..1 attack swing
  hat?: "helm" | "hood" | "crown" | "none";
}

export function drawChibi(ctx: CanvasRenderingContext2D, o: ChibiOpts) {
  const { x, y, s, face } = o;
  const bob = o.moving ? Math.sin(o.walk * 11) * 2.2 * s : Math.sin(o.walk * 2.2) * 1.1 * s;
  ctx.save();
  ctx.translate(x, y);
  if (o.aura) {
    const g = ctx.createRadialGradient(0, -30 * s, 4, 0, -30 * s, 55 * s);
    g.addColorStop(0, o.aura + "55"); g.addColorStop(1, o.aura + "00");
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(0, -30 * s, 55 * s, 0, 6.3); ctx.fill();
  }
  // shadow
  ctx.fillStyle = "rgba(10,6,2,0.35)";
  ctx.beginPath(); ctx.ellipse(0, 2, 20 * s, 6 * s, 0, 0, 6.3); ctx.fill();
  ctx.scale(face, 1);
  ctx.translate(0, bob);

  const legSwing = o.moving ? Math.sin(o.walk * 11) * 6 * s : 0;
  // legs
  ctx.fillStyle = shade(o.pal.outfit, -40);
  rr(ctx, -10 * s + legSwing * 0.4, -14 * s, 8 * s, 14 * s, 3 * s); ctx.fill();
  rr(ctx, 2 * s - legSwing * 0.4, -14 * s, 8 * s, 14 * s, 3 * s); ctx.fill();
  // body
  ctx.fillStyle = o.pal.outfit;
  rr(ctx, -14 * s, -38 * s, 28 * s, 26 * s, 9 * s); ctx.fill();
  ctx.fillStyle = o.pal.accent;
  rr(ctx, -14 * s, -20 * s, 28 * s, 5 * s, 2 * s); ctx.fill(); // belt
  // back arm
  ctx.fillStyle = shade(o.pal.outfit, -25);
  rr(ctx, -17 * s, -36 * s, 7 * s, 16 * s, 3.5 * s); ctx.fill();
  // head
  const hy = -52 * s;
  ctx.fillStyle = o.pal.skin;
  ctx.beginPath(); ctx.arc(0, hy, 16 * s, 0, 6.3); ctx.fill();
  // hair
  ctx.fillStyle = o.pal.hair;
  ctx.beginPath();
  ctx.arc(0, hy - 3 * s, 16.5 * s, Math.PI * 0.95, Math.PI * 2.05);
  ctx.lineTo(14 * s, hy - 2 * s);
  ctx.lineTo(8 * s, hy - 7 * s); ctx.lineTo(3 * s, hy - 1 * s); ctx.lineTo(-3 * s, hy - 8 * s);
  ctx.lineTo(-9 * s, hy - 1 * s); ctx.lineTo(-14 * s, hy - 5 * s);
  ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.arc(-13 * s, hy + 2 * s, 5 * s, 0, 6.3); ctx.fill(); // side tuft
  // helm / hood
  if (o.hat === "helm") {
    ctx.fillStyle = "#9aa6b4";
    ctx.beginPath(); ctx.arc(0, hy - 4 * s, 16 * s, Math.PI, 0); ctx.fill();
    ctx.fillStyle = o.pal.accent;
    rr(ctx, -2 * s, hy - 24 * s, 4 * s, 12 * s, 2 * s); ctx.fill();
  } else if (o.hat === "hood") {
    ctx.fillStyle = shade(o.pal.outfit, -15);
    ctx.beginPath(); ctx.arc(0, hy - 2 * s, 17 * s, Math.PI * 0.9, Math.PI * 2.1); ctx.fill();
  } else if (o.hat === "crown") {
    ctx.fillStyle = "#f5b942";
    ctx.beginPath();
    ctx.moveTo(-10 * s, hy - 13 * s); ctx.lineTo(-10 * s, hy - 22 * s); ctx.lineTo(-5 * s, hy - 16 * s);
    ctx.lineTo(0, hy - 24 * s); ctx.lineTo(5 * s, hy - 16 * s); ctx.lineTo(10 * s, hy - 22 * s);
    ctx.lineTo(10 * s, hy - 13 * s); ctx.closePath(); ctx.fill();
    ctx.fillStyle = "#c23b4e";
    ctx.beginPath(); ctx.arc(0, hy - 16 * s, 1.8 * s, 0, 6.3); ctx.fill();
  }
  // face
  if (o.blink) {
    ctx.strokeStyle = "#3a2418"; ctx.lineWidth = 1.6 * s;
    ctx.beginPath(); ctx.moveTo(3 * s, hy + 1); ctx.lineTo(9 * s, hy + 1); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-9 * s, hy + 1); ctx.lineTo(-3 * s, hy + 1); ctx.stroke();
  } else {
    ctx.fillStyle = "#2a1a10";
    ctx.beginPath(); ctx.arc(6 * s, hy, 2.2 * s, 0, 6.3); ctx.fill();
    ctx.beginPath(); ctx.arc(-6 * s, hy, 2.2 * s, 0, 6.3); ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.9)";
    ctx.beginPath(); ctx.arc(6.8 * s, hy - 0.8 * s, 0.8 * s, 0, 6.3); ctx.fill();
  }
  ctx.fillStyle = "#b06a50";
  ctx.beginPath(); ctx.arc(0, hy + 6 * s, 1.4 * s, 0, 6.3); ctx.fill();
  // front arm + weapon
  const swing = o.swing ? Math.sin(o.swing * Math.PI) : 0;
  const armA = -0.3 - swing * 1.9;
  ctx.save();
  ctx.translate(11 * s, -33 * s);
  ctx.rotate(armA);
  ctx.fillStyle = o.pal.outfit;
  rr(ctx, -3.5 * s, 0, 7 * s, 16 * s, 3.5 * s); ctx.fill();
  ctx.translate(0, 15 * s);
  drawWeapon(ctx, o.weapon, s);
  ctx.restore();

  if (o.hurt && o.hurt > 0) {
    ctx.globalAlpha = o.hurt * 0.7;
    ctx.fillStyle = "#fff";
    ctx.beginPath(); ctx.arc(0, -34 * s, 26 * s, 0, 6.3); ctx.fill();
    ctx.globalAlpha = 1;
  }
  ctx.restore();
}

function drawWeapon(ctx: CanvasRenderingContext2D, w: ChibiOpts["weapon"] | "broom", s: number) {
  ctx.save();
  ctx.rotate(-0.4);
  if (w === "sword" || w === "spear") {
    const len = w === "spear" ? 44 : 32;
    ctx.fillStyle = "#6a4a2a"; ctx.fillRect(-1.5 * s, -4 * s, 3 * s, 10 * s);
    ctx.fillStyle = "#c8d2dc";
    ctx.beginPath();
    ctx.moveTo(-3 * s, -4 * s); ctx.lineTo(3 * s, -4 * s); ctx.lineTo(0, (-4 - len) * s);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = "#f5b942"; ctx.fillRect(-5 * s, -5 * s, 10 * s, 2.5 * s);
  } else if (w === "axe") {
    ctx.fillStyle = "#6a4a2a"; ctx.fillRect(-1.5 * s, -34 * s, 3 * s, 38 * s);
    ctx.fillStyle = "#aab4c0";
    ctx.beginPath(); ctx.moveTo(0, -34 * s); ctx.quadraticCurveTo(16 * s, -30 * s, 12 * s, -16 * s); ctx.lineTo(0, -22 * s); ctx.closePath(); ctx.fill();
  } else if (w === "staff" || w === "lance") {
    ctx.fillStyle = "#7a5a38"; ctx.fillRect(-1.5 * s, -40 * s, 3 * s, 44 * s);
    if (w === "staff") {
      ctx.fillStyle = "#8ab8e8";
      ctx.beginPath(); ctx.arc(0, -44 * s, 5 * s, 0, 6.3); ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,0.8)";
      ctx.beginPath(); ctx.arc(-1.5 * s, -45.5 * s, 1.6 * s, 0, 6.3); ctx.fill();
    } else {
      ctx.fillStyle = "#d8e0e8";
      ctx.beginPath(); ctx.moveTo(-3 * s, -40 * s); ctx.lineTo(3 * s, -40 * s); ctx.lineTo(0, -50 * s); ctx.closePath(); ctx.fill();
    }
  } else if (w === "bow") {
    ctx.strokeStyle = "#7a5a38"; ctx.lineWidth = 2.4 * s;
    ctx.beginPath(); ctx.arc(6 * s, -18 * s, 17 * s, -1.2, 1.2); ctx.stroke();
    ctx.strokeStyle = "#e8e0d0"; ctx.lineWidth = 1 * s;
    ctx.beginPath();
    ctx.moveTo(6 * s + Math.cos(-1.2) * 17 * s, -18 * s + Math.sin(-1.2) * 17 * s);
    ctx.lineTo(6 * s + Math.cos(1.2) * 17 * s, -18 * s + Math.sin(1.2) * 17 * s);
    ctx.stroke();
  } else if (w === "dagger") {
    ctx.fillStyle = "#c8d2dc";
    ctx.beginPath(); ctx.moveTo(-2 * s, -4 * s); ctx.lineTo(2 * s, -4 * s); ctx.lineTo(0, -18 * s); ctx.closePath(); ctx.fill();
    ctx.fillStyle = "#6a4a2a"; ctx.fillRect(-1 * s, -4 * s, 2 * s, 7 * s);
  } else if (w === "book") {
    ctx.fillStyle = "#8a3a3a"; rr(ctx, -7 * s, -8 * s, 14 * s, 11 * s, 2 * s); ctx.fill();
    ctx.fillStyle = "#f0e8d0"; rr(ctx, -5.5 * s, -6.5 * s, 11 * s, 8 * s, 1.5 * s); ctx.fill();
  } else if (w === "broom") {
    ctx.fillStyle = "#7a5a38"; ctx.fillRect(-1.2 * s, -40 * s, 2.4 * s, 42 * s);
    ctx.fillStyle = "#c8a050";
    ctx.beginPath(); ctx.moveTo(-6 * s, -2 * s); ctx.lineTo(6 * s, -2 * s); ctx.lineTo(2 * s, -14 * s); ctx.lineTo(-2 * s, -14 * s); ctx.closePath(); ctx.fill();
  }
  ctx.restore();
}

// ─── Enemies ───────────────────────────────────────────────────────────────

export function drawEnemy(ctx: CanvasRenderingContext2D, def: EnemyDef, x: number, y: number, s: number, t: number, hurt: number, attacking: number) {
  const bob = Math.sin(t * 2.6 + x * 0.01) * 3 * s;
  const squash = 1 + Math.sin(t * 5.2 + x) * 0.03;
  ctx.save();
  ctx.translate(x + (attacking ? -Math.sin(attacking * Math.PI) * 40 * s : 0), y + bob);
  ctx.fillStyle = "rgba(10,6,2,0.35)";
  ctx.beginPath(); ctx.ellipse(0, 2 - bob, 30 * s, 8 * s, 0, 0, 6.3); ctx.fill();
  ctx.scale(s * squash, s / squash);
  const flash = hurt > 0;
  const c1 = flash ? "#ffffff" : def.c1;
  const c2 = flash ? "#ffe0e0" : def.c2;

  if (def.kind === "blob") {
    ctx.fillStyle = c2;
    ctx.beginPath(); ctx.ellipse(0, -14, 26, 22, 0, 0, 6.3); ctx.fill();
    ctx.fillStyle = c1;
    ctx.beginPath(); ctx.ellipse(0, -18, 22, 18, 0, 0, 6.3); ctx.fill();
    eyes(ctx, -8, -22, 7, flash);
    ctx.fillStyle = flash ? "#fff" : "#233a2a";
    ctx.beginPath(); ctx.arc(0, -12, 4, 0, Math.PI); ctx.fill();
  } else if (def.kind === "beast") {
    ctx.fillStyle = c2;
    ctx.beginPath(); ctx.ellipse(6, -16, 26, 16, 0, 0, 6.3); ctx.fill();
    ctx.fillStyle = c1;
    ctx.beginPath(); ctx.ellipse(-14, -22, 15, 13, -0.3, 0, 6.3); ctx.fill();
    // ears
    ctx.beginPath(); ctx.moveTo(-24, -32); ctx.lineTo(-18, -42); ctx.lineTo(-13, -31); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(-8, -34); ctx.lineTo(-2, -43); ctx.lineTo(0, -31); ctx.closePath(); ctx.fill();
    eyes(ctx, -18, -24, 6, flash);
    ctx.fillStyle = flash ? "#fff" : "#f0e8d0";
    ctx.beginPath(); ctx.moveTo(-26, -16); ctx.lineTo(-32, -12); ctx.lineTo(-25, -11); ctx.closePath(); ctx.fill(); // fang
    ctx.strokeStyle = c2; ctx.lineWidth = 5;
    ctx.beginPath(); ctx.moveTo(30, -20); ctx.quadraticCurveTo(42, -30, 38, -40); ctx.stroke(); // tail
  } else if (def.kind === "humanoid") {
    ctx.fillStyle = c2; rr(ctx, -14, -34, 28, 26, 8); ctx.fill();
    ctx.fillStyle = c1;
    ctx.beginPath(); ctx.arc(0, -44, 14, 0, 6.3); ctx.fill();
    ctx.fillStyle = flash ? "#fff" : "#4a3020";
    ctx.beginPath(); ctx.arc(0, -46, 14, Math.PI * 0.9, Math.PI * 2.1); ctx.fill();
    ctx.fillStyle = flash ? "#fff" : "#2a3a4a";
    rr(ctx, -14, -56, 28, 8, 3); ctx.fill(); // band
    eyes(ctx, -5, -44, 5.5, flash);
    ctx.fillStyle = "#c8d2dc";
    ctx.beginPath(); ctx.moveTo(16, -20); ctx.lineTo(22, -20); ctx.lineTo(19, -46); ctx.closePath(); ctx.fill();
  } else if (def.kind === "skeleton") {
    ctx.fillStyle = c1;
    ctx.beginPath(); ctx.arc(0, -40, 14, 0, 6.3); ctx.fill();
    rr(ctx, -11, -26, 22, 20, 6); ctx.fill();
    ctx.fillStyle = c2;
    for (let i = 0; i < 3; i++) rr(ctx, -9, -22 + i * 6, 18, 3, 1.5), ctx.fill();
    ctx.fillStyle = flash ? "#ddd" : "#1a1410";
    ctx.beginPath(); ctx.arc(-5, -42, 3.4, 0, 6.3); ctx.arc(5, -42, 3.4, 0, 6.3); ctx.fill();
    ctx.strokeStyle = c1; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(-11, -6); ctx.lineTo(-14, 0); ctx.moveTo(11, -6); ctx.lineTo(14, 0); ctx.stroke();
  } else if (def.kind === "imp") {
    ctx.fillStyle = c1;
    ctx.beginPath(); ctx.ellipse(0, -18, 18, 16, 0, 0, 6.3); ctx.fill();
    ctx.fillStyle = c2;
    // wings
    ctx.beginPath(); ctx.moveTo(-14, -24); ctx.quadraticCurveTo(-36, -38, -28, -12); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(14, -24); ctx.quadraticCurveTo(36, -38, 28, -12); ctx.closePath(); ctx.fill();
    // horns
    ctx.beginPath(); ctx.moveTo(-8, -32); ctx.lineTo(-12, -42); ctx.lineTo(-3, -34); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(8, -32); ctx.lineTo(12, -42); ctx.lineTo(3, -34); ctx.closePath(); ctx.fill();
    eyes(ctx, -6, -20, 5.5, flash, "#ffd23a");
  } else if (def.kind === "golem") {
    ctx.fillStyle = c2;
    rr(ctx, -24, -44, 48, 40, 10); ctx.fill();
    ctx.fillStyle = c1;
    rr(ctx, -18, -56, 36, 22, 8); ctx.fill();
    rr(ctx, -34, -40, 12, 26, 6); ctx.fill();
    rr(ctx, 22, -40, 12, 26, 6); ctx.fill();
    ctx.fillStyle = flash ? "#fff" : "#7fe0d0";
    ctx.beginPath(); ctx.arc(-8, -46, 3.4, 0, 6.3); ctx.arc(8, -46, 3.4, 0, 6.3); ctx.fill();
    ctx.strokeStyle = flash ? "#fff" : "#7fe0d0"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(-10, -30); ctx.lineTo(0, -22); ctx.lineTo(10, -30); ctx.stroke();
  } else if (def.kind === "dragon") {
    ctx.scale(1.6, 1.6);
    ctx.fillStyle = c2;
    // wings
    const flap = Math.sin(t * 4) * 0.25;
    ctx.save(); ctx.translate(-10, -40); ctx.rotate(-0.5 + flap);
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(-50, -34, -64, -4); ctx.quadraticCurveTo(-30, -10, 0, 8); ctx.closePath(); ctx.fill();
    ctx.restore();
    ctx.save(); ctx.translate(10, -40); ctx.rotate(0.5 - flap);
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(50, -34, 64, -4); ctx.quadraticCurveTo(30, -10, 0, 8); ctx.closePath(); ctx.fill();
    ctx.restore();
    ctx.fillStyle = c1;
    ctx.beginPath(); ctx.ellipse(0, -22, 30, 22, 0, 0, 6.3); ctx.fill();
    // neck + head
    ctx.beginPath(); ctx.ellipse(-20, -44, 12, 18, 0.5, 0, 6.3); ctx.fill();
    ctx.beginPath(); ctx.ellipse(-30, -58, 14, 11, -0.2, 0, 6.3); ctx.fill();
    ctx.fillStyle = c2;
    ctx.beginPath(); ctx.moveTo(-36, -66); ctx.lineTo(-42, -76); ctx.lineTo(-30, -68); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(-26, -68); ctx.lineTo(-28, -78); ctx.lineTo(-19, -68); ctx.closePath(); ctx.fill();
    eyes(ctx, -32, -58, 4.5, flash, "#ffd23a");
    // tail
    ctx.strokeStyle = c1; ctx.lineWidth = 9;
    ctx.beginPath(); ctx.moveTo(26, -18); ctx.quadraticCurveTo(48, -10, 52, -30); ctx.stroke();
  } else if (def.kind === "lich") {
    ctx.fillStyle = c2;
    ctx.beginPath(); ctx.moveTo(-22, 0); ctx.quadraticCurveTo(-26, -40, 0, -52); ctx.quadraticCurveTo(26, -40, 22, 0); ctx.closePath(); ctx.fill();
    ctx.fillStyle = c1;
    ctx.beginPath(); ctx.arc(0, -52, 13, 0, 6.3); ctx.fill();
    ctx.fillStyle = flash ? "#fff" : "#101820";
    ctx.beginPath(); ctx.arc(0, -52, 10, 0, 6.3); ctx.fill();
    eyes(ctx, -4, -53, 3.4, flash, "#7fe0ff");
    ctx.strokeStyle = "#7a5a38"; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(20, -2); ctx.lineTo(26, -58); ctx.stroke();
    ctx.fillStyle = "#8ab8e8";
    ctx.beginPath(); ctx.arc(27, -62, 5, 0, 6.3); ctx.fill();
  }
  ctx.restore();
}

function eyes(ctx: CanvasRenderingContext2D, xOff: number, y: number, r: number, flash: boolean, glow?: string) {
  ctx.fillStyle = flash ? "#fff" : "#fff";
  ctx.beginPath(); ctx.arc(xOff, y, r, 0, 6.3); ctx.arc(-xOff, y, r, 0, 6.3); ctx.fill();
  ctx.fillStyle = flash ? "#eee" : glow ?? "#20242c";
  ctx.beginPath(); ctx.arc(xOff - 1, y + 1, r * 0.5, 0, 6.3); ctx.arc(-xOff - 1, y + 1, r * 0.5, 0, 6.3); ctx.fill();
}

// ─── UI bars ───────────────────────────────────────────────────────────────

export function drawBar(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, ratio: number, fg: string, bg = "rgba(15,10,6,0.75)") {
  ctx.fillStyle = bg;
  rr(ctx, x, y, w, h, h / 2); ctx.fill();
  ctx.fillStyle = fg;
  if (ratio > 0.01) { rr(ctx, x + 1, y + 1, Math.max(h - 2, (w - 2) * Math.max(0, Math.min(1, ratio))), h - 2, (h - 2) / 2); ctx.fill(); }
  ctx.strokeStyle = "rgba(0,0,0,0.5)"; ctx.lineWidth = 1;
  rr(ctx, x, y, w, h, h / 2); ctx.stroke();
}
