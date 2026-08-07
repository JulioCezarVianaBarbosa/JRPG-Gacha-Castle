import type { GameState, Palette, ResKey, WeaponKind } from "@/lib/types";
import { heroDef } from "@/lib/types";
import { cityLevel, expSlots, fmt, productionMult } from "@/lib/state";
import {
  drawChibi, drawEnemy, drawStar, lerp, rr, shade, spawnBurst, updateDrawFloats, updateDrawParticles,
} from "./draw";
import type { FloatText, Particle } from "./draw";

// drawEnemy is used for the pet dragon event decoration — re-export usage keeps bundler tree intact
void drawEnemy;

export const WORLD_W = 1600;
export const WORLD_H = 900;
export const DAY_LEN = 150; // seconds per in-game day

export interface Hotspot {
  id: string;
  x: number;
  y: number; // interact position (feet)
  label: string;
  panel: string;
}

export const HOTSPOTS: Hotspot[] = [
  { id: "throne", x: 800, y: 590, label: "Throne", panel: "throne" },
  { id: "gate", x: 1440, y: 630, label: "Castle Gate", panel: "gate" },
  { id: "circle", x: 880, y: 815, label: "Summoning Circle", panel: "summon" },
  { id: "board", x: 1245, y: 610, label: "Construction", panel: "build" },
  { id: "smithy", x: 320, y: 700, label: "Forge", panel: "smithy" },
  { id: "library", x: 545, y: 605, label: "Athenaeum", panel: "library" },
  { id: "map", x: 640, y: 745, label: "War Table", panel: "map" },
  { id: "market", x: 1130, y: 780, label: "Market", panel: "market" },
  { id: "mail", x: 1290, y: 700, label: "Mail Post", panel: "mail" },
];

export interface CollectNode {
  x: number; y: number; kind: ResKey; amount: number; bob: number;
}

export interface Npc {
  id: string; kind: string;
  x: number; y: number; tx: number; ty: number;
  speed: number; face: 1 | -1; walk: number; phase: number;
  state: "idle" | "walk" | "work" | "sleep";
  timer: number;
  pal: Palette;
  weapon: WeaponKind | "none" | "broom";
  hat?: "helm" | "hood" | "crown" | "none";
  scale: number;
  name?: string;
  aura?: string;
  zone: { x0: number; y0: number; x1: number; y1: number };
}

export interface HallScene {
  t: number;
  dayT: number;
  gov: { x: number; y: number; vx: number; vy: number; face: 1 | -1; walk: number; moving: boolean; blinkT: number; blink: boolean };
  npcs: Npc[];
  sig: string;
  nodes: CollectNode[];
  nodeT: number;
  parts: Particle[];
  floats: FloatText[];
  shake: number;
  flash: number;
  msgT: number;
  hover: string | null;
  moveTarget: { x: number; y: number } | null;
  pendingPanel: string | null;
  swapT: number;
}

const GUARD_PAL: Palette = { hair: "#5a4a3a", skin: "#e8c098", outfit: "#5a6a7a", accent: "#c8d2dc" };
const SERVANT_PAL: Palette = { hair: "#8a6a4a", skin: "#f0c8a8", outfit: "#7a6a5a", accent: "#a89880" };

export function rosterSig(s: GameState): string {
  return [
    s.castleLv,
    s.buildings.smithy.lv > 0 ? 1 : 0,
    s.buildings.library.lv > 0 ? 1 : 0,
    s.heroes.filter((h) => !h.expedition).map((h) => h.uid).join(","),
  ].join("|");
}

export function createScene(s: GameState): HallScene {
  const scene: HallScene = {
    t: 0, dayT: 0.12,
    gov: { x: 800, y: 760, vx: 0, vy: 0, face: 1, walk: 0, moving: false, blinkT: 2, blink: false },
    npcs: [], sig: "", nodes: [], nodeT: 1.5, parts: [], floats: [],
    shake: 0, flash: 0, msgT: 25, hover: null, moveTarget: null, pendingPanel: null, swapT: 9,
  };
  rebuildNpcs(scene, s);
  // seed the hall so the first decree ("gather wood") is instantly playable
  spawnNode(scene, s, "wood"); spawnNode(scene, s, "wood"); spawnNode(scene, s, "wood");
  return scene;
}

function mkNpc(id: string, kind: string, x: number, y: number, zone: Npc["zone"], pal: Palette, weapon: Npc["weapon"], opts?: Partial<Npc>): Npc {
  return {
    id, kind, x, y, tx: x, ty: y, speed: 60, face: 1, walk: Math.random() * 10,
    phase: Math.random() * 10, state: "idle", timer: 1 + Math.random() * 3,
    pal, weapon, scale: 1, zone, ...opts,
  };
}

export function rebuildNpcs(scene: HallScene, s: GameState) {
  scene.sig = rosterSig(s);
  const keepCat = scene.npcs.find((n) => n.kind === "cat");
  const keepDog = scene.npcs.find((n) => n.kind === "dog");
  const npcs: Npc[] = [];
  // guards
  npcs.push(mkNpc("g1", "guard", 1330, 640, { x0: 300, y0: 600, x1: 1500, y1: 850 }, GUARD_PAL, "spear", { hat: "helm", speed: 70 }));
  npcs.push(mkNpc("g2", "guard", 1450, 700, { x0: 300, y0: 600, x1: 1500, y1: 850 }, GUARD_PAL, "spear", { hat: "helm", speed: 70 }));
  // servant sweeping
  npcs.push(mkNpc("sv1", "servant", 700, 720, { x0: 560, y0: 640, x1: 1050, y1: 800 }, SERVANT_PAL, "broom", { speed: 55 }));
  if (s.castleLv >= 3) npcs.push(mkNpc("sv2", "servant", 980, 760, { x0: 560, y0: 640, x1: 1200, y1: 820 }, { hair: "#6a5a4a", skin: "#e8b890", outfit: "#6a5a6a", accent: "#98889a" }, "broom", { speed: 55 }));
  // cat & dog
  npcs.push(keepCat ?? mkNpc("cat", "cat", -60, 852, { x0: -80, y0: 845, x1: 1680, y1: 862 }, { hair: "#d8a050", skin: "#d8a050", outfit: "#d8a050", accent: "#f0c878" }, "none", { speed: 95 }));
  npcs.push(keepDog ?? mkNpc("dog", "dog", 285, 640, { x0: 285, y0: 640, x1: 285, y1: 640 }, { hair: "#8a705a", skin: "#8a705a", outfit: "#8a705a", accent: "#a89078" }, "none", { state: "sleep" as const }));
  // workers
  if (s.buildings.smithy.lv > 0) npcs.push(mkNpc("smith", "smith", 235, 705, { x0: 235, y0: 705, x1: 235, y1: 705 }, { hair: "#3a3a3a", skin: "#d8a880", outfit: "#6a4a3a", accent: "#8a6a4a" }, "axe", { state: "work" as const, scale: 1.05 }));
  if (s.buildings.library.lv > 0) npcs.push(mkNpc("mage", "mage", 520, 620, { x0: 520, y0: 620, x1: 520, y1: 620 }, { hair: "#c0c8e8", skin: "#f0d0b8", outfit: "#3a5a7a", accent: "#8ab8e8" }, "book", { state: "work" as const, hat: "hood" }));
  if (s.castleLv >= 5) npcs.push(mkNpc("bard", "bard", 1010, 705, { x0: 1010, y0: 705, x1: 1010, y1: 705 }, { hair: "#c04848", skin: "#e8c098", outfit: "#4a6a4a", accent: "#f5b942" }, "book", { state: "work" as const, hat: "hood" }));
  // wandering heroes
  const roamers = s.heroes.filter((h) => !h.expedition).slice(0, 6);
  roamers.forEach((h, i) => {
    const d = heroDef(h.defId);
    const spots = [
      { x0: 380, y0: 640, x1: 640, y1: 760 },
      { x0: 900, y0: 640, x1: 1150, y1: 760 },
      { x0: 420, y0: 760, x1: 700, y1: 850 },
      { x0: 950, y0: 760, x1: 1240, y1: 850 },
      { x0: 680, y0: 620, x1: 900, y1: 700 },
      { x0: 1150, y0: 640, x1: 1300, y1: 720 },
    ][i % 6];
    const x = spots.x0 + Math.random() * (spots.x1 - spots.x0);
    const y = spots.y0 + Math.random() * (spots.y1 - spots.y0);
    npcs.push(mkNpc(`hero${h.uid}`, "hero", x, y, spots, d.palette, d.weapon, {
      speed: 48 + Math.random() * 30, name: d.name,
      aura: d.rarity === "legendary" ? "#f5b942" : d.rarity === "epic" ? "#b06ae0" : undefined,
      hat: d.id === "kael" ? "hood" : "none", scale: 1,
    }));
  });
  scene.npcs = npcs;
}

function spawnNode(scene: HallScene, s: GameState, force?: ResKey) {
  if (scene.nodes.length >= 4) return;
  const r = Math.random();
  const kind: ResKey = force ?? (r < 0.38 ? "wood" : r < 0.7 ? "stone" : "food");
  const spots = [
    { x: 460, y: 810 }, { x: 1050, y: 840 }, { x: 560, y: 690 }, { x: 1210, y: 700 },
    { x: 420, y: 730 }, { x: 760, y: 850 }, { x: 980, y: 700 }, { x: 1320, y: 800 },
    { x: 250, y: 800 }, { x: 700, y: 660 },
  ];
  for (let tries = 0; tries < 12; tries++) {
    const p = spots[Math.floor(Math.random() * spots.length)];
    if (scene.nodes.some((n) => Math.hypot(n.x - p.x, n.y - p.y) < 90)) continue;
    if (Math.hypot(scene.gov.x - p.x, scene.gov.y - p.y) < 120) continue;
    const amount = 2 + Math.floor(Math.random() * 3) + Math.floor(s.castleLv / 2);
    scene.nodes.push({ x: p.x + (Math.random() - 0.5) * 40, y: p.y, kind, amount, bob: Math.random() * 6 });
    return;
  }
}

export interface HallHooks {
  collect: (kind: ResKey, amount: number, x: number, y: number) => void;
  openPanel: (id: string) => void;
  collectBuilding: (buildingId: string, x: number, y: number) => void;
}

// ─── Update ────────────────────────────────────────────────────────────────

export function updateScene(scene: HallScene, dt: number, s: GameState, hooks: HallHooks, input: { x: number; y: number }, interactPressed: boolean) {
  scene.t += dt;
  scene.shake = Math.max(0, scene.shake - dt * 3.2);
  scene.flash = Math.max(0, scene.flash - dt * 2.5);

  if (rosterSig(s) !== scene.sig) rebuildNpcs(scene, s);

  // governor
  const g = scene.gov;
  const sp = 300;
  let dx = input.x, dy = input.y;
  if (scene.moveTarget) {
    const ddx = scene.moveTarget.x - g.x, ddy = scene.moveTarget.y - g.y;
    const dist = Math.hypot(ddx, ddy);
    if (dist < 12) {
      const p = scene.pendingPanel;
      scene.moveTarget = null; scene.pendingPanel = null;
      if (p) hooks.openPanel(p);
    } else { dx = ddx / dist; dy = ddy / dist; }
  }
  const mag = Math.hypot(dx, dy);
  if (mag > 0.01) {
    g.vx = lerp(g.vx, (dx / Math.max(1, mag)) * sp, 1 - Math.pow(0.0001, dt));
    g.vy = lerp(g.vy, (dy / Math.max(1, mag)) * sp, 1 - Math.pow(0.0001, dt));
    g.moving = true;
    if (Math.abs(g.vx) > 12) g.face = g.vx > 0 ? 1 : -1;
  } else {
    g.vx *= Math.pow(0.0000001, dt); g.vy *= Math.pow(0.0000001, dt);
    g.moving = false;
  }
  g.x = Math.max(120, Math.min(1480, g.x + g.vx * dt));
  g.y = Math.max(590, Math.min(858, g.y + g.vy * dt));
  g.walk += dt * (g.moving ? 1.6 : 1);
  g.blinkT -= dt;
  if (g.blinkT < -0.12) { g.blink = false; g.blinkT = 2 + Math.random() * 3; }
  else if (g.blinkT < 0) g.blink = true;

  // nodes
  scene.nodeT -= dt;
  if (scene.nodeT <= 0) { scene.nodeT = 13; spawnNode(scene, s); }
  for (const n of scene.nodes) n.bob += dt;

  // messenger
  scene.msgT -= dt;
  if (scene.msgT <= 0 && !scene.npcs.some((n) => n.kind === "messenger")) {
    scene.msgT = 35 + Math.random() * 25;
    scene.npcs.push(mkNpc("msg", "messenger", 1470, 660, { x0: 700, y0: 600, x1: 1470, y1: 700 },
      { hair: "#6a5030", skin: "#e8c098", outfit: "#8a6a3a", accent: "#f0d890" }, "none", { speed: 150, hat: "hood" }));
    const m = scene.npcs[scene.npcs.length - 1];
    m.tx = 830; m.ty = 640; m.state = "walk";
  }

  // npcs
  scene.swapT -= dt;
  const guards = scene.npcs.filter((n) => n.kind === "guard");
  if (scene.swapT <= 0 && guards.length === 2) {
    scene.swapT = 11 + Math.random() * 6;
    const ax = guards[0].tx, ay = guards[0].ty;
    guards[0].tx = guards[1].x; guards[0].ty = guards[1].y;
    guards[1].tx = ax; guards[1].ty = ay;
    guards.forEach((gd) => { gd.state = "walk"; });
  }

  for (const n of scene.npcs) {
    n.walk += dt;
    n.phase += dt;
    if (n.kind === "dog") {
      if (Math.random() < dt * 0.08) {
        scene.floats.push({ x: n.x + 14, y: n.y - 30, life: 0, max: 1.6, text: "z", color: "rgba(240,230,210,0.8)", size: 15 });
      }
      continue;
    }
    if (n.kind === "cat") {
      if (n.state !== "walk") {
        n.timer -= dt;
        if (n.timer <= 0) {
          const fromLeft = Math.random() < 0.5;
          n.x = fromLeft ? -50 : 1650; n.y = 842 + Math.random() * 18;
          n.tx = fromLeft ? 1660 : -60; n.ty = n.y;
          n.state = "walk";
        }
      } else if ((n.tx > 800 && n.x > 1650) || (n.tx < 800 && n.x < -50)) {
        n.state = "idle"; n.timer = 8 + Math.random() * 14;
      }
    } else if (n.state === "work") {
      if (n.kind === "smith" && Math.sin(n.phase * 5) > 0.92) {
        spawnBurst(scene.parts, 320, 672, "#f5b942", 2, 120, "spark");
      }
      if (n.kind === "mage" && Math.random() < dt * 0.5) {
        spawnBurst(scene.parts, n.x + 10, n.y - 60, "#8ab8e8", 1, 40, "star");
      }
      if (n.kind === "bard" && Math.random() < dt * 1.2) {
        scene.floats.push({ x: n.x + (Math.random() - 0.5) * 30, y: n.y - 70, life: 0, max: 1.4, text: "♪", color: "#f5b942", size: 17 });
      }
      continue;
    } else if (n.state === "walk" || n.kind === "messenger") {
      const ddx = n.tx - n.x, ddy = n.ty - n.y;
      const dist = Math.hypot(ddx, ddy);
      if (dist > 6) {
        n.x += (ddx / dist) * n.speed * dt;
        n.y += (ddy / dist) * n.speed * dt;
        n.face = ddx > 0 ? 1 : -1;
      } else {
        if (n.kind === "messenger") {
          if (n.tx < 1000) {
            scene.floats.push({ x: n.x, y: n.y - 95, life: 0, max: 1.6, text: "News from the road!", color: "#f0d890", size: 16 });
            n.tx = 1470; n.ty = 660; n.ty = 660;
          } else {
            scene.npcs = scene.npcs.filter((x) => x !== n);
            continue;
          }
        } else {
          n.state = "idle";
          n.timer = 1.5 + Math.random() * 4;
        }
      }
    } else {
      n.timer -= dt;
      if (n.timer <= 0) {
        const z = n.zone;
        n.tx = z.x0 + Math.random() * (z.x1 - z.x0);
        n.ty = z.y0 + Math.random() * (z.y1 - z.y0);
        n.state = "walk";
      }
    }
  }

  // interact
  if (interactPressed) {
    // nearest node
    let bestN: CollectNode | null = null; let bd = 95;
    for (const n of scene.nodes) {
      const d = Math.hypot(n.x - g.x, n.y - g.y);
      if (d < bd) { bd = d; bestN = n; }
    }
    if (bestN) {
      hooks.collect(bestN.kind, bestN.amount, bestN.x, bestN.y);
      scene.nodes = scene.nodes.filter((n) => n !== bestN);
      scene.shake = Math.max(scene.shake, 0.25);
    } else {
      // nearest hotspot or building bubble
      let best: { id: string; d: number; bubble?: boolean } | null = null;
      for (const h of HOTSPOTS) {
        const d = Math.hypot(h.x - g.x, h.y - g.y);
        if (d < 135 && (!best || d < best.d)) best = { id: h.id, d };
      }
      const bub = nearestBubble(scene, s);
      if (bub && bub.d < 135 && (!best || bub.d < best.d)) best = { id: bub.id, d: bub.d, bubble: true };
      if (best) {
        if (best.bubble) hooks.collectBuilding(best.id.replace("bub:", ""), g.x, g.y);
        else {
          const hs = HOTSPOTS.find((h) => h.id === best!.id)!;
          hooks.openPanel(hs.panel);
        }
      }
    }
  }

  // hover detection for label drawing (nearest)
  let hover: string | null = null; let hd = 135;
  for (const h of HOTSPOTS) {
    const d = Math.hypot(h.x - g.x, h.y - g.y);
    if (d < hd) { hd = d; hover = h.id; }
  }
  scene.hover = hover;
}

export function nearestBubble(scene: HallScene, s: GameState): { id: string; d: number } | null {
  const g = scene.gov;
  let best: { id: string; d: number } | null = null;
  const cands: { id: string; x: number; y: number }[] = [];
  if (s.buildings.farm.acc >= 1) cands.push({ id: "bub:farm", x: 430, y: 650 });
  if (s.buildings.market.acc >= 1) cands.push({ id: "bub:market", x: 1180, y: 700 });
  if (s.buildings.smithy.pendingForge) cands.push({ id: "bub:smithy", x: 320, y: 640 });
  for (const c of cands) {
    const d = Math.hypot(c.x - g.x, c.y - g.y);
    if (!best || d < best.d) best = { id: c.id, d };
  }
  return best;
}

export function bubbleAt(id: string, s: GameState): string {
  if (id === "farm" && s.buildings.farm.acc >= 1) return `+${fmt(s.buildings.farm.acc)} food`;
  if (id === "market" && s.buildings.market.acc >= 1) return `+${fmt(s.buildings.market.acc)} gold`;
  if (id === "smithy" && s.buildings.smithy.pendingForge) return "Equipment ready!";
  return "";
}

// ─── Lighting / time of day ────────────────────────────────────────────────

const LIGHT_STOPS: [number, number, number, number, number][] = [
  // [t, r, g, b, alpha]
  [0.0, 255, 190, 120, 0.16],
  [0.1, 255, 220, 160, 0.05],
  [0.22, 255, 255, 255, 0.0],
  [0.45, 255, 255, 255, 0.0],
  [0.55, 255, 160, 90, 0.13],
  [0.65, 90, 90, 170, 0.22],
  [0.78, 25, 35, 85, 0.4],
  [0.95, 25, 35, 85, 0.4],
  [1.0, 255, 190, 120, 0.16],
];

export function lightAt(t: number): { r: number; g: number; b: number; a: number; night: number } {
  for (let i = 0; i < LIGHT_STOPS.length - 1; i++) {
    const [t0, r0, g0, b0, a0] = LIGHT_STOPS[i];
    const [t1, r1, g1, b1, a1] = LIGHT_STOPS[i + 1];
    if (t >= t0 && t <= t1) {
      const k = t1 === t0 ? 0 : (t - t0) / (t1 - t0);
      const a = lerp(a0, a1, k);
      return { r: lerp(r0, r1, k), g: lerp(g0, g1, k), b: lerp(b0, b1, k), a, night: Math.max(0, (a - 0.2) / 0.2) };
    }
  }
  return { r: 0, g: 0, b: 0, a: 0, night: 0 };
}

export function phaseName(t: number): string {
  if (t < 0.15) return "Morning";
  if (t < 0.5) return "Midday";
  if (t < 0.65) return "Dusk";
  return "Night";
}

// ─── Drawing ───────────────────────────────────────────────────────────────

export function drawScene(ctx: CanvasRenderingContext2D, scene: HallScene, s: GameState) {
  const t = scene.t;
  const lv = s.castleLv;
  const L = lightAt(scene.dayT);
  const city = cityLevel(s);

  ctx.save();
  if (scene.shake > 0) {
    const m = scene.shake * 14;
    ctx.translate((Math.random() - 0.5) * m, (Math.random() - 0.5) * m);
  }

  // ── back wall
  const stone = lv >= 2;
  const marble = lv >= 6;
  const wallTop = "#241a12", wallBot = stone ? "#3a3126" : "#4a3520";
  const wg = ctx.createLinearGradient(0, 0, 0, 570);
  wg.addColorStop(0, marble ? "#2c2a34" : wallTop);
  wg.addColorStop(1, marble ? "#4a4454" : wallBot);
  ctx.fillStyle = wg;
  ctx.fillRect(-40, -40, WORLD_W + 80, 610);
  // texture
  if (stone) {
    ctx.strokeStyle = "rgba(0,0,0,0.16)"; ctx.lineWidth = 2;
    for (let yy = 40; yy < 560; yy += 56) {
      ctx.beginPath(); ctx.moveTo(-20, yy); ctx.lineTo(WORLD_W + 20, yy); ctx.stroke();
      const off = (yy / 56) % 2 === 0 ? 0 : 60;
      for (let xx = off; xx < WORLD_W; xx += 120) {
        ctx.beginPath(); ctx.moveTo(xx, yy); ctx.lineTo(xx, yy + 56); ctx.stroke();
      }
    }
    if (marble) {
      ctx.strokeStyle = "rgba(245,185,66,0.1)"; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(-20, 90); ctx.lineTo(WORLD_W + 20, 90); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-20, 500); ctx.lineTo(WORLD_W + 20, 500); ctx.stroke();
    }
  } else {
    ctx.strokeStyle = "rgba(0,0,0,0.25)"; ctx.lineWidth = 3;
    for (let xx = 30; xx < WORLD_W; xx += 78) {
      ctx.beginPath(); ctx.moveTo(xx, 0); ctx.lineTo(xx, 565); ctx.stroke();
    }
  }

  // ── windows with city view
  drawWindow(ctx, 250, 120, 210, 260, city, scene, s);
  drawWindow(ctx, 1140, 120, 210, 260, city, scene, s);

  // ── banners
  const bannerXs = marble ? [90, 620, 980, 1510] : lv >= 4 ? [90, 700, 900, 1510] : [700, 900];
  for (const bx of bannerXs) drawBanner(ctx, bx, 110, t, lv);

  // ── torches
  for (const tx of [110, 545, 1055, 1490]) drawTorch(ctx, tx, 285, t);

  // ── bookshelf (library)
  drawBookshelf(ctx, 470, 300, s.buildings.library.lv, t);

  // ── construction board
  drawBoard(ctx, 1195, 380, lv);

  // ── gate
  drawGate(ctx, 1365, 190, lv, t);

  // ── fireplace
  drawFireplace(ctx, 90, 360, t, lv);

  // ── throne
  drawThrone(ctx, 800, 300, lv, t);

  // ── floor
  const fg = ctx.createLinearGradient(0, 560, 0, 900);
  fg.addColorStop(0, marble ? "#544a5c" : stone ? "#4a3c2c" : "#3a2a1a");
  fg.addColorStop(1, marble ? "#322a3a" : stone ? "#332a20" : "#241810");
  ctx.fillStyle = fg;
  ctx.fillRect(-40, 560, WORLD_W + 80, 360);
  ctx.strokeStyle = "rgba(0,0,0,0.22)"; ctx.lineWidth = 2;
  for (let i = 0; i < 7; i++) {
    const y = 560 + i * (340 / 6) * (1 + i * 0.12);
    if (y > 900) break;
    ctx.beginPath(); ctx.moveTo(-20, y); ctx.lineTo(WORLD_W + 20, y); ctx.stroke();
  }
  // carpet
  if (lv >= 2) {
    ctx.fillStyle = "#7a2434";
    ctx.beginPath();
    ctx.moveTo(700, 565); ctx.lineTo(900, 565); ctx.lineTo(1000, 900); ctx.lineTo(600, 900);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = "#f5b942"; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(712, 575); ctx.lineTo(888, 575); ctx.lineTo(982, 900); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(618, 900); ctx.lineTo(712, 575); ctx.stroke();
    if (lv >= 5) {
      ctx.strokeStyle = "rgba(245,185,66,0.5)";
      for (let i = 1; i < 5; i++) {
        const y = 575 + i * 65;
        const k = (y - 575) / 325;
        ctx.beginPath(); ctx.moveTo(712 - k * 90, y); ctx.lineTo(888 + k * 90, y); ctx.stroke();
      }
    }
  }

  // ── chandelier
  if (lv >= 4) drawChandelier(ctx, 800, 0, t, lv);

  // ── summon circle (floor)
  drawSummonCircle(ctx, 880, 818, t);

  // ── floor furniture + entities (sorted by y)
  type Drawable = { y: number; fn: () => void };
  const draws: Drawable[] = [];
  draws.push({ y: 690, fn: () => drawSmithyCorner(ctx, 250, 690, s.buildings.smithy.lv, t) });
  draws.push({ y: 745, fn: () => drawMapTable(ctx, 640, 745, lv) });
  draws.push({ y: 780, fn: () => drawMarketStall(ctx, 1150, 780, s.buildings.market.lv, t) });
  draws.push({ y: 700, fn: () => drawMailPost(ctx, 1300, 700, s.mail.some((m) => !m.claimed), t) });

  for (const n of scene.nodes) {
    draws.push({ y: n.y, fn: () => drawNode(ctx, n, t) });
  }
  for (const n of scene.npcs) {
    if (n.kind === "cat") draws.push({ y: n.y, fn: () => drawCat(ctx, n, t) });
    else if (n.kind === "dog") draws.push({ y: n.y, fn: () => drawDog(ctx, n, t) });
    else draws.push({ y: n.y, fn: () => drawNpc(ctx, n, t) });
  }
  draws.push({
    y: scene.gov.y, fn: () => drawChibi(ctx, {
      x: scene.gov.x, y: scene.gov.y, s: 1.12, face: scene.gov.face, walk: scene.gov.walk,
      moving: scene.gov.moving, blink: scene.gov.blink,
      pal: { hair: "#3a2a1a", skin: "#f0c8a0", outfit: "#8a2438", accent: "#f5b942" },
      weapon: "sword", hat: "crown", aura: "#f5b942",
    }),
  });
  draws.sort((a, b) => a.y - b.y);
  for (const d of draws) d.fn();

  // ── foreground pillars
  drawPillar(ctx, 60, 90, 570, stone);
  drawPillar(ctx, 1540, 90, 570, stone);

  // ── bubbles (production ready)
  drawBubble(ctx, 430, 620, bubbleAt("farm", s), t, s.buildings.farm.acc >= 1);
  drawBubble(ctx, 1215, 700, bubbleAt("market", s), t + 1, s.buildings.market.acc >= 1);
  drawBubble(ctx, 320, 615, bubbleAt("smithy", s), t + 2, !!s.buildings.smithy.pendingForge);

  // ── hotspot labels
  if (scene.hover) {
    const h = HOTSPOTS.find((x) => x.id === scene.hover)!;
    const pulse = 1 + Math.sin(t * 5) * 0.08;
    ctx.strokeStyle = "rgba(245,185,66,0.9)";
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.ellipse(h.x, h.y + 4, 42 * pulse, 14 * pulse, 0, 0, 6.3); ctx.stroke();
    ctx.fillStyle = "rgba(16,10,6,0.78)";
    ctx.font = '700 20px "Alegreya Sans", sans-serif';
    ctx.textAlign = "center";
    const label = `${h.label}  ·  E`;
    const w = ctx.measureText(label).width + 26;
    rr(ctx, h.x - w / 2, h.y - 74, w, 32, 16); ctx.fill();
    ctx.strokeStyle = "rgba(245,185,66,0.65)"; ctx.lineWidth = 1.5;
    rr(ctx, h.x - w / 2, h.y - 74, w, 32, 16); ctx.stroke();
    ctx.fillStyle = "#f0e2c4";
    ctx.fillText(label, h.x, h.y - 52);
  }

  // ── dust motes
  ctx.fillStyle = "rgba(255,235,190,0.14)";
  for (let i = 0; i < 14; i++) {
    const mx = ((i * 173 + t * 14) % (WORLD_W + 40)) - 20;
    const my = 200 + ((i * 97) % 500) + Math.sin(t * 0.8 + i) * 24;
    ctx.beginPath(); ctx.arc(mx, my, 1.6 + (i % 3), 0, 6.3); ctx.fill();
  }

  // ── particles & floats
  updateDrawParticles(ctx, scene.parts, 1 / 60);
  updateDrawFloats(ctx, scene.floats, 1 / 60);

  // ── weather inside (snow drift near windows)
  if (s.weather === "snow") {
    ctx.fillStyle = "rgba(240,245,255,0.5)";
    for (let i = 0; i < 26; i++) {
      const fx = (i * 211 + t * 40) % WORLD_W;
      const fy = (i * 151 + t * 70) % 620;
      ctx.beginPath(); ctx.arc(fx, fy, 2, 0, 6.3); ctx.fill();
    }
  }

  // ── lighting overlay
  if (L.a > 0.004) {
    ctx.fillStyle = `rgba(${L.r | 0},${L.g | 0},${L.b | 0},${L.a})`;
    ctx.fillRect(-40, -40, WORLD_W + 80, WORLD_H + 80);
  }
  // warm light pools at night
  if (L.night > 0.05) {
    const pools: [number, number, number][] = [[180, 560, 260], [800, 620, 300], [1440, 600, 240], [110, 520, 200], [1490, 430, 160]];
    for (const [px, py, pr] of pools) {
      const gg = ctx.createRadialGradient(px, py, 10, px, py, pr);
      gg.addColorStop(0, `rgba(255,180,90,${0.24 * L.night})`);
      gg.addColorStop(1, "rgba(255,180,90,0)");
      ctx.fillStyle = gg;
      ctx.fillRect(px - pr, py - pr, pr * 2, pr * 2);
    }
  }

  // ── vignette
  const vg = ctx.createRadialGradient(800, 480, 420, 800, 500, 1050);
  vg.addColorStop(0, "rgba(8,4,2,0)");
  vg.addColorStop(1, "rgba(8,4,2,0.5)");
  ctx.fillStyle = vg;
  ctx.fillRect(-40, -40, WORLD_W + 80, WORLD_H + 80);

  if (scene.flash > 0) {
    ctx.fillStyle = `rgba(255,240,200,${scene.flash * 0.5})`;
    ctx.fillRect(-40, -40, WORLD_W + 80, WORLD_H + 80);
  }
  ctx.restore();
}

// ── scene pieces ────────────────────────────────────────────────────────────

function drawWindow(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, city: number, scene: HallScene, s: GameState) {
  const t = scene.t;
  const dayT = scene.dayT;
  ctx.save();
  // frame
  ctx.fillStyle = "#1a120a";
  rr(ctx, x - 12, y - 12, w + 24, h + 24, 14); ctx.fill();
  ctx.beginPath();
  ctx.moveTo(x, y + h); ctx.lineTo(x, y + 40);
  ctx.arc(x + w / 2, y + 40, w / 2, Math.PI, 0);
  ctx.lineTo(x + w, y + h); ctx.closePath();
  ctx.clip();
  // sky
  const L = lightAt(dayT);
  const night = L.night;
  const sky = ctx.createLinearGradient(0, y, 0, y + h);
  if (night > 0.5) { sky.addColorStop(0, "#0c1630"); sky.addColorStop(1, "#22304e"); }
  else if (dayT > 0.5) { sky.addColorStop(0, "#3a4a7a"); sky.addColorStop(1, "#c07a4a"); }
  else if (dayT < 0.15) { sky.addColorStop(0, "#6a7ab0"); sky.addColorStop(1, "#f0c088"); }
  else { sky.addColorStop(0, "#4a8ac0"); sky.addColorStop(1, "#a8d0e8"); }
  ctx.fillStyle = sky;
  ctx.fillRect(x, y - 40, w, h + 60);
  // sun / moon
  const cel = dayT < 0.62;
  const cx = x + w * (0.15 + 0.7 * ((dayT < 0.62 ? dayT / 0.62 : (dayT - 0.62) / 0.38)));
  const cy = y + 70 + Math.sin(Math.PI * (dayT < 0.62 ? dayT / 0.62 : (dayT - 0.62) / 0.38)) * -30 + 30;
  ctx.fillStyle = cel ? "#ffe8a0" : "#e8ecf5";
  ctx.beginPath(); ctx.arc(cx, cy, cel ? 22 : 16, 0, 6.3); ctx.fill();
  if (!cel) { ctx.fillStyle = sky as unknown as string; ctx.beginPath(); ctx.arc(cx - 6, cy - 4, 13, 0, 6.3); ctx.fill(); }
  // stars
  if (night > 0.4) {
    ctx.fillStyle = `rgba(255,255,255,${night * 0.8})`;
    for (let i = 0; i < 12; i++) {
      const sx = x + ((i * 53) % w), sy = y + ((i * 37) % 120);
      ctx.fillRect(sx, sy, 2, 2);
    }
  }
  // hills
  ctx.fillStyle = night > 0.4 ? "#1a2438" : "#5a7a58";
  ctx.beginPath(); ctx.moveTo(x, y + h);
  ctx.quadraticCurveTo(x + w * 0.3, y + h - 110, x + w * 0.6, y + h - 70);
  ctx.quadraticCurveTo(x + w * 0.8, y + h - 95, x + w, y + h - 60);
  ctx.lineTo(x + w, y + h); ctx.closePath(); ctx.fill();
  // city
  const houses = Math.min(30, 3 + city * 2);
  const baseY = y + h - 30;
  for (let i = 0; i < houses; i++) {
    const hx = x + 8 + (i * (w - 16)) / houses + ((i * 29) % 7);
    const hw = 12 + ((i * 13) % 12);
    const hh = 16 + ((i * 31) % 26) + Math.min(18, city);
    const row = i % 3;
    const hy = baseY - row * 14;
    ctx.fillStyle = row === 0 ? (night > 0.4 ? "#242e44" : "#8a7a68") : row === 1 ? (night > 0.4 ? "#1e2840" : "#7a6a58") : (night > 0.4 ? "#182238" : "#6a5a48");
    ctx.fillRect(hx, hy - hh, hw, hh);
    ctx.fillStyle = row === 0 ? (night > 0.4 ? "#2c3854" : "#a05848") : (night > 0.4 ? "#28344e" : "#905040");
    ctx.beginPath(); ctx.moveTo(hx - 2, hy - hh); ctx.lineTo(hx + hw / 2, hy - hh - 9); ctx.lineTo(hx + hw + 2, hy - hh); ctx.closePath(); ctx.fill();
    if (night > 0.4 && (i * 7) % 5 < 3) {
      ctx.fillStyle = "#f5c868";
      ctx.fillRect(hx + hw / 2 - 2, hy - hh + 5, 4, 5);
    }
  }
  // windmill
  if (city >= 3) {
    const mx = x + w - 42, my = baseY - 40;
    ctx.fillStyle = night > 0.4 ? "#2c3854" : "#c8b8a0";
    ctx.beginPath(); ctx.moveTo(mx - 10, my + 40); ctx.lineTo(mx - 6, my); ctx.lineTo(mx + 6, my); ctx.lineTo(mx + 10, my + 40); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = night > 0.4 ? "#3a4a6a" : "#8a7a60"; ctx.lineWidth = 3;
    for (let i = 0; i < 4; i++) {
      const a = t * 1.2 + (i * Math.PI) / 2;
      ctx.beginPath(); ctx.moveTo(mx, my); ctx.lineTo(mx + Math.cos(a) * 20, my + Math.sin(a) * 20); ctx.stroke();
    }
  }
  // tower + keep
  if (city >= 5) {
    ctx.fillStyle = night > 0.4 ? "#2c3854" : "#9a8a78";
    ctx.fillRect(x + 24, baseY - 74, 16, 74);
    ctx.beginPath(); ctx.moveTo(x + 20, baseY - 74); ctx.lineTo(x + 32, baseY - 90); ctx.lineTo(x + 44, baseY - 74); ctx.closePath(); ctx.fill();
    ctx.fillStyle = "#c23b4e";
    ctx.fillRect(x + 31, baseY - 102, 2, 14);
    ctx.beginPath(); ctx.moveTo(x + 33, baseY - 102); ctx.lineTo(x + 44, baseY - 98); ctx.lineTo(x + 33, baseY - 94); ctx.closePath(); ctx.fill();
  }
  if (city >= 8) {
    ctx.fillStyle = night > 0.4 ? "#34405c" : "#aa9a88";
    ctx.fillRect(x + w / 2 - 22, baseY - 96, 44, 96);
    ctx.fillRect(x + w / 2 - 30, baseY - 70, 10, 70);
    ctx.fillRect(x + w / 2 + 20, baseY - 70, 10, 70);
    ctx.fillStyle = "#f5b942";
    ctx.fillRect(x + w / 2 - 3, baseY - 80, 6, 8);
  }
  // balloons (daytime)
  if (city >= 4 && night < 0.3) {
    const bx = x + ((t * 9) % (w + 60)) - 30;
    const by = y + 60 + Math.sin(t * 0.9) * 6;
    ctx.fillStyle = "#c23b4e";
    ctx.beginPath(); ctx.arc(bx, by, 11, 0, 6.3); ctx.fill();
    ctx.fillStyle = "#f5b942";
    ctx.beginPath(); ctx.moveTo(bx - 8, by + 7); ctx.lineTo(bx + 8, by + 7); ctx.lineTo(bx, by + 16); ctx.closePath(); ctx.fill();
    ctx.fillStyle = "#8a6a4a"; ctx.fillRect(bx - 4, by + 17, 8, 6);
  }
  // rain / snow through window
  if (s.weather === "rain") {
    ctx.strokeStyle = "rgba(180,200,230,0.4)"; ctx.lineWidth = 1.4;
    for (let i = 0; i < 16; i++) {
      const rx = x + ((i * 47 + t * 260) % w);
      const ry = y + ((i * 83 + t * 420) % (h + 40)) - 20;
      ctx.beginPath(); ctx.moveTo(rx, ry); ctx.lineTo(rx - 4, ry + 12); ctx.stroke();
    }
  }
  if (s.weather === "snow") {
    ctx.fillStyle = "rgba(245,250,255,0.8)";
    for (let i = 0; i < 14; i++) {
      const rx = x + ((i * 61 + t * 30) % w);
      const ry = y + ((i * 97 + t * 55) % h);
      ctx.beginPath(); ctx.arc(rx, ry, 2, 0, 6.3); ctx.fill();
    }
  }
  ctx.restore();
  // mullions + frame trim
  ctx.strokeStyle = "#1a120a"; ctx.lineWidth = 5;
  ctx.beginPath(); ctx.moveTo(x + w / 2, y + 4); ctx.lineTo(x + w / 2, y + h); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x, y + h * 0.55); ctx.lineTo(x + w, y + h * 0.55); ctx.stroke();
  ctx.strokeStyle = s.castleLv >= 3 ? "#f5b942" : "#5a4a38"; ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(x, y + h + 12); ctx.lineTo(x, y + 40);
  ctx.arc(x + w / 2, y + 40, w / 2, Math.PI, 0);
  ctx.lineTo(x + w, y + h + 12);
  ctx.stroke();
  // stained glass tint
  if (s.castleLv >= 3) {
    ctx.save();
    ctx.globalAlpha = 0.14;
    ctx.fillStyle = "#c23b4e";
    ctx.beginPath(); ctx.arc(x + w / 2, y + 42, w / 2 - 6, Math.PI, 0); ctx.fill();
    ctx.fillStyle = "#2e6e6a";
    ctx.fillRect(x + 4, y + 44, w / 2 - 8, 40);
    ctx.fillStyle = "#f5b942";
    ctx.fillRect(x + w / 2 + 4, y + 44, w / 2 - 8, 40);
    ctx.restore();
  }
}

function drawBanner(ctx: CanvasRenderingContext2D, x: number, y: number, t: number, lv: number) {
  const sway = Math.sin(t * 1.4 + x) * 4;
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = "#f5b942";
  ctx.fillRect(-26, -6, 52, 6);
  const g = ctx.createLinearGradient(0, 0, 0, 190);
  g.addColorStop(0, "#8a2438"); g.addColorStop(1, "#5a1424");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(-22, 0); ctx.lineTo(22, 0);
  ctx.lineTo(22 + sway * 0.4, 160);
  ctx.lineTo(sway * 0.6, 190);
  ctx.lineTo(-22 + sway * 0.4, 160);
  ctx.closePath(); ctx.fill();
  ctx.strokeStyle = "#f5b942"; ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(-16, 8); ctx.lineTo(16, 8); ctx.lineTo(16 + sway * 0.4, 154); ctx.lineTo(sway * 0.6, 178); ctx.lineTo(-16 + sway * 0.4, 154); ctx.closePath();
  ctx.stroke();
  // emblem: crown
  ctx.fillStyle = "#f5b942";
  ctx.beginPath();
  ctx.moveTo(-12, 78); ctx.lineTo(-12, 62); ctx.lineTo(-5, 70); ctx.lineTo(0, 58); ctx.lineTo(5, 70); ctx.lineTo(12, 62); ctx.lineTo(12, 78);
  ctx.closePath(); ctx.fill();
  if (lv >= 5) {
    ctx.beginPath(); ctx.arc(0, 100, 8, 0, 6.3); ctx.stroke();
  }
  ctx.restore();
}

function drawTorch(ctx: CanvasRenderingContext2D, x: number, y: number, t: number) {
  ctx.fillStyle = "#3a2a1a";
  ctx.fillRect(x - 4, y, 8, 26);
  ctx.fillStyle = "#5a4a38";
  ctx.fillRect(x - 7, y - 4, 14, 6);
  const fl = Math.sin(t * 13 + x) * 2;
  const g = ctx.createRadialGradient(x, y - 14, 2, x, y - 14, 46);
  g.addColorStop(0, "rgba(255,190,90,0.5)");
  g.addColorStop(1, "rgba(255,150,60,0)");
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(x, y - 14, 46, 0, 6.3); ctx.fill();
  ctx.fillStyle = "#f5a030";
  ctx.beginPath();
  ctx.moveTo(x - 5, y - 6);
  ctx.quadraticCurveTo(x - 7 + fl, y - 22, x + fl * 0.5, y - 30 - fl);
  ctx.quadraticCurveTo(x + 7 + fl, y - 20, x + 5, y - 6);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = "#ffe08a";
  ctx.beginPath(); ctx.ellipse(x + fl * 0.3, y - 13, 3, 6, 0, 0, 6.3); ctx.fill();
}

function drawBookshelf(ctx: CanvasRenderingContext2D, x: number, y: number, lv: number, t: number) {
  const w = 160, h = 260;
  ctx.fillStyle = lv > 0 ? "#4a3520" : "#3a2a1a";
  rr(ctx, x, y, w, h, 8); ctx.fill();
  ctx.strokeStyle = "rgba(0,0,0,0.4)"; ctx.lineWidth = 3;
  rr(ctx, x, y, w, h, 8); ctx.stroke();
  const colors = ["#8a3a3a", "#3a5a7a", "#4a6a3a", "#8a6a3a", "#5a3a6a"];
  for (let r = 0; r < 4; r++) {
    const sy = y + 16 + r * 60;
    ctx.fillStyle = "#2a1c10";
    ctx.fillRect(x + 8, sy, w - 16, 44);
    if (lv > 0 || r < 2) {
      for (let b = 0; b < 7; b++) {
        const bh = 30 + ((b * 17 + r * 11) % 10);
        ctx.fillStyle = colors[(b + r) % colors.length];
        ctx.fillRect(x + 12 + b * 19, sy + 44 - bh, 15, bh);
      }
    }
  }
  if (lv > 0) {
    // floating sparkle
    if (Math.sin(t * 2) > 0.6) {
      drawStar(ctx, x + w / 2, y - 14 + Math.sin(t * 3) * 4, 7, "#8ab8e8", t);
    }
    ctx.fillStyle = "#f5b942";
    ctx.font = '700 15px "Cinzel", serif';
    ctx.textAlign = "center";
    ctx.fillText(`Lv ${lv}`, x + w / 2, y + h + 22);
  }
}

function drawBoard(ctx: CanvasRenderingContext2D, x: number, y: number, lv: number) {
  ctx.fillStyle = "#5a4228";
  ctx.fillRect(x + 20, y + 90, 10, 90);
  ctx.fillRect(x + 110, y + 90, 10, 90);
  ctx.fillStyle = "#7a5a38";
  rr(ctx, x, y, 140, 100, 8); ctx.fill();
  ctx.strokeStyle = "#4a3418"; ctx.lineWidth = 4;
  rr(ctx, x, y, 140, 100, 8); ctx.stroke();
  ctx.strokeStyle = "#f0e2c4"; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(x + 18, y + 24); ctx.lineTo(x + 122, y + 24); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x + 18, y + 44); ctx.lineTo(x + 100, y + 44); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x + 18, y + 64); ctx.lineTo(x + 112, y + 64); ctx.stroke();
  // hammer icon
  ctx.fillStyle = "#c8d2dc";
  ctx.save(); ctx.translate(x + 112, y + 76); ctx.rotate(-0.6);
  ctx.fillRect(-3, -16, 6, 20); ctx.fillRect(-9, -22, 18, 8);
  ctx.restore();
  ctx.fillStyle = "#f5b942";
  ctx.font = '700 15px "Cinzel", serif';
  ctx.textAlign = "center";
  ctx.fillText(`Castle Lv ${lv}`, x + 70, y + 122);
}

function drawGate(ctx: CanvasRenderingContext2D, x: number, y: number, lv: number, t: number) {
  const w = 190, h = 370;
  // stone arch
  ctx.fillStyle = "#4a4038";
  rr(ctx, x - 18, y - 20, w + 36, h + 20, 10); ctx.fill();
  ctx.fillStyle = "#241a10";
  ctx.beginPath();
  ctx.moveTo(x, y + h); ctx.lineTo(x, y + 70);
  ctx.arc(x + w / 2, y + 70, w / 2, Math.PI, 0);
  ctx.lineTo(x + w, y + h); ctx.closePath(); ctx.fill();
  // doors
  const dg = ctx.createLinearGradient(x, 0, x + w, 0);
  dg.addColorStop(0, "#5a4228"); dg.addColorStop(0.5, "#7a5a38"); dg.addColorStop(1, "#4a3418");
  ctx.fillStyle = dg;
  ctx.beginPath();
  ctx.moveTo(x + 6, y + h); ctx.lineTo(x + 6, y + 74);
  ctx.arc(x + w / 2, y + 74, w / 2 - 6, Math.PI, 0);
  ctx.lineTo(x + w - 6, y + h); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = "#2a1c10"; ctx.lineWidth = 4;
  ctx.beginPath(); ctx.moveTo(x + w / 2, y + 12); ctx.lineTo(x + w / 2, y + h); ctx.stroke();
  ctx.strokeStyle = lv >= 4 ? "#f5b942" : "#3a3a3a"; ctx.lineWidth = 5;
  for (const by of [0.35, 0.6, 0.85]) {
    ctx.beginPath(); ctx.moveTo(x + 10, y + h * by); ctx.lineTo(x + w - 10, y + h * by); ctx.stroke();
  }
  // portcullis hint + light seep
  ctx.fillStyle = `rgba(255,200,120,${0.12 + Math.sin(t * 2) * 0.04})`;
  ctx.fillRect(x + w / 2 - 2, y + 70, 4, h - 70);
  // emblem above
  ctx.fillStyle = "#f5b942";
  drawStar(ctx, x + w / 2, y + 34, 14, "#f5b942", Math.PI / 8);
  ctx.fillStyle = "#f0e2c4";
  ctx.font = '700 16px "Cinzel", serif';
  ctx.textAlign = "center";
  ctx.fillText("CAMPAIGN", x + w / 2, y - 32);
}

function drawFireplace(ctx: CanvasRenderingContext2D, x: number, y: number, t: number, lv: number) {
  ctx.fillStyle = lv >= 2 ? "#5a5048" : "#4a3c30";
  rr(ctx, x, y, 190, 200, 10); ctx.fill();
  ctx.fillStyle = "#1a120a";
  ctx.beginPath();
  ctx.moveTo(x + 25, y + 200); ctx.lineTo(x + 25, y + 90);
  ctx.arc(x + 95, y + 90, 70, Math.PI, 0);
  ctx.lineTo(x + 165, y + 200); ctx.closePath(); ctx.fill();
  // logs
  ctx.fillStyle = "#4a3018";
  ctx.save(); ctx.translate(x + 95, y + 185); ctx.rotate(0.2);
  rr(ctx, -32, -6, 64, 12, 6); ctx.fill(); ctx.rotate(-0.4);
  rr(ctx, -32, -6, 64, 12, 6); ctx.fill(); ctx.restore();
  // fire
  for (let i = 0; i < 3; i++) {
    const fl = Math.sin(t * (11 + i * 3) + i * 2) * 5;
    const fh = 66 - i * 16;
    ctx.fillStyle = i === 0 ? "rgba(240,120,40,0.9)" : i === 1 ? "rgba(250,170,60,0.9)" : "rgba(255,225,130,0.95)";
    ctx.beginPath();
    ctx.moveTo(x + 95 - 26 + i * 8, y + 182);
    ctx.quadraticCurveTo(x + 95 - 30 + i * 10 + fl, y + 182 - fh * 0.7, x + 95 + fl, y + 182 - fh);
    ctx.quadraticCurveTo(x + 95 + 30 - i * 10 + fl, y + 182 - fh * 0.7, x + 95 + 26 - i * 8, y + 182);
    ctx.closePath(); ctx.fill();
  }
  const g = ctx.createRadialGradient(x + 95, y + 150, 10, x + 95, y + 150, 190);
  g.addColorStop(0, "rgba(255,170,80,0.3)");
  g.addColorStop(1, "rgba(255,170,80,0)");
  ctx.fillStyle = g;
  ctx.fillRect(x - 100, y - 40, 400, 340);
  if (lv >= 2) {
    ctx.fillStyle = "#8a93a0";
    ctx.fillRect(x + 60, y - 26, 70, 12); // mantle
    ctx.fillStyle = "#f5b942";
    ctx.fillRect(x + 88, y - 40, 14, 14); // candle
    ctx.fillStyle = "#ffd870";
    ctx.beginPath(); ctx.ellipse(x + 95, y - 46 + Math.sin(t * 15) * 1.5, 3, 5, 0, 0, 6.3); ctx.fill();
  }
}

function drawThrone(ctx: CanvasRenderingContext2D, cx: number, y: number, lv: number, t: number) {
  // platform
  ctx.fillStyle = lv >= 2 ? "#5a5048" : "#4a3a28";
  ctx.beginPath();
  ctx.moveTo(cx - 150, y + 260); ctx.lineTo(cx - 110, y + 200);
  ctx.lineTo(cx + 110, y + 200); ctx.lineTo(cx + 150, y + 260);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = "rgba(0,0,0,0.25)";
  ctx.fillRect(cx - 110, y + 200, 220, 8);
  const scale = 1 + Math.min(0.5, (lv - 1) * 0.07);
  ctx.save();
  ctx.translate(cx, y + 200);
  ctx.scale(scale, scale);
  // back panel
  const bg = ctx.createLinearGradient(0, -190, 0, 0);
  bg.addColorStop(0, "#a03040"); bg.addColorStop(1, "#6a1c2c");
  ctx.fillStyle = "#3a2a18";
  rr(ctx, -58, -186, 116, 190, 10); ctx.fill();
  ctx.fillStyle = bg;
  rr(ctx, -48, -176, 96, 180, 8); ctx.fill();
  // seat
  ctx.fillStyle = "#f5b942";
  rr(ctx, -50, -64, 100, 18, 6); ctx.fill();
  ctx.fillStyle = "#8a2438";
  rr(ctx, -46, -50, 92, 50, 8); ctx.fill();
  ctx.fillStyle = lv >= 3 ? "#f5b942" : "#8a7a58";
  rr(ctx, -56, -8, 112, 12, 4); ctx.fill();
  // crown ornament
  ctx.fillStyle = "#f5b942";
  ctx.beginPath();
  ctx.moveTo(-22, -186); ctx.lineTo(-22, -208); ctx.lineTo(-10, -194); ctx.lineTo(0, -214); ctx.lineTo(10, -194); ctx.lineTo(22, -208); ctx.lineTo(22, -186);
  ctx.closePath(); ctx.fill();
  if (lv >= 4) {
    ctx.fillStyle = "#c23b4e";
    ctx.beginPath(); ctx.arc(0, -196, 4, 0, 6.3); ctx.fill();
  }
  if (lv >= 3) {
    ctx.strokeStyle = "#f5b942"; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.arc(0, -120, 22, 0, 6.3); ctx.stroke();
    drawStar(ctx, 0, -120, 9, "#f5b942", t * 0.5);
  }
  // arm rests
  ctx.fillStyle = "#4a3418";
  rr(ctx, -64, -58, 14, 52, 5); ctx.fill();
  rr(ctx, 50, -58, 14, 52, 5); ctx.fill();
  ctx.restore();
  // statues at high level
  if (lv >= 5) {
    for (const sx of [-190, 190]) {
      ctx.fillStyle = "#8a8478";
      ctx.fillRect(cx + sx - 8, y + 120, 16, 80);
      ctx.beginPath(); ctx.arc(cx + sx, y + 110, 13, 0, 6.3); ctx.fill();
      ctx.fillStyle = "#5a5548";
      ctx.fillRect(cx + sx - 18, y + 198, 36, 12);
    }
  }
}

function drawChandelier(ctx: CanvasRenderingContext2D, cx: number, y: number, t: number, lv: number) {
  ctx.strokeStyle = "#3a2a1a"; ctx.lineWidth = 4;
  ctx.beginPath(); ctx.moveTo(cx, y); ctx.lineTo(cx, y + 70); ctx.stroke();
  const sway = Math.sin(t * 0.8) * 0.04;
  ctx.save();
  ctx.translate(cx, y + 70);
  ctx.rotate(sway);
  ctx.strokeStyle = "#f5b942"; ctx.lineWidth = 4;
  ctx.beginPath(); ctx.arc(0, 14, 70, 0.15, Math.PI - 0.15); ctx.stroke();
  for (let i = 0; i < 5; i++) {
    const a = 0.25 + (i * (Math.PI - 0.5)) / 4;
    const px = Math.cos(a) * 70, py = 14 + Math.sin(a) * 70;
    ctx.fillStyle = "#e8dcc0";
    ctx.fillRect(px - 3, py - 16, 6, 14);
    const fl = Math.sin(t * 12 + i * 2) * 1.6;
    ctx.fillStyle = "#ffd870";
    ctx.beginPath(); ctx.ellipse(px + fl * 0.4, py - 22, 3.4, 6, 0, 0, 6.3); ctx.fill();
  }
  if (lv >= 6) {
    ctx.fillStyle = "rgba(255,220,140,0.8)";
    for (let i = 0; i < 6; i++) {
      const a = (i * Math.PI * 2) / 6 + t * 0.2;
      drawStar(ctx, Math.cos(a) * 40, 30 + Math.sin(a) * 16, 4, "rgba(255,220,140,0.7)", a);
    }
  }
  ctx.restore();
}

function drawSummonCircle(ctx: CanvasRenderingContext2D, cx: number, cy: number, t: number) {
  ctx.save();
  ctx.translate(cx, cy);
  const g = ctx.createRadialGradient(0, 0, 8, 0, 0, 95);
  g.addColorStop(0, "rgba(120,200,220,0.28)");
  g.addColorStop(1, "rgba(120,200,220,0)");
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.ellipse(0, 0, 95, 34, 0, 0, 6.3); ctx.fill();
  ctx.strokeStyle = "rgba(140,220,235,0.8)"; ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.ellipse(0, 0, 78, 27, 0, 0, 6.3); ctx.stroke();
  ctx.save();
  ctx.rotate(t * 0.6);
  ctx.strokeStyle = "rgba(245,185,66,0.75)";
  ctx.beginPath(); ctx.ellipse(0, 0, 60, 21, 0, 0, 6.3); ctx.stroke();
  for (let i = 0; i < 6; i++) {
    const a = (i * Math.PI) / 3;
    drawStar(ctx, Math.cos(a) * 60, Math.sin(a) * 21, 6, "rgba(245,185,66,0.85)", t + i);
  }
  ctx.restore();
  // rising motes
  for (let i = 0; i < 5; i++) {
    const p = ((t * 0.5 + i * 0.2) % 1);
    const a = i * 1.9 + t * 0.3;
    ctx.globalAlpha = 1 - p;
    ctx.fillStyle = "#8adceb";
    ctx.beginPath(); ctx.arc(Math.cos(a) * 50, -p * 60 + Math.sin(a) * 14, 2.6, 0, 6.3); ctx.fill();
  }
  ctx.globalAlpha = 1;
  ctx.restore();
}

function drawSmithyCorner(ctx: CanvasRenderingContext2D, x: number, y: number, lv: number, t: number) {
  if (lv <= 0) return;
  // anvil
  ctx.fillStyle = "#3a3a40";
  ctx.save(); ctx.translate(x + 70, y - 14);
  ctx.beginPath();
  ctx.moveTo(-26, 0); ctx.lineTo(26, 0); ctx.lineTo(18, 10); ctx.lineTo(-14, 10); ctx.closePath(); ctx.fill();
  ctx.fillRect(-12, 10, 24, 12);
  ctx.fillRect(-18, 22, 36, 6);
  ctx.beginPath(); ctx.moveTo(26, 0); ctx.quadraticCurveTo(40, -4, 38, -12); ctx.lineTo(22, -8); ctx.closePath(); ctx.fill();
  ctx.restore();
  // forge brazier
  ctx.fillStyle = "#4a3c30";
  ctx.beginPath(); ctx.ellipse(x - 40, y - 8, 30, 12, 0, 0, 6.3); ctx.fill();
  ctx.fillRect(x - 66, y - 30, 52, 24);
  for (let i = 0; i < 3; i++) {
    const fl = Math.sin(t * (10 + i * 2) + i) * 4;
    ctx.fillStyle = i === 0 ? "rgba(240,110,40,0.9)" : "rgba(255,190,80,0.9)";
    ctx.beginPath();
    ctx.moveTo(x - 62 + i * 14, y - 28);
    ctx.quadraticCurveTo(x - 60 + i * 14 + fl, y - 52, x - 52 + i * 14 + fl, y - 30);
    ctx.closePath(); ctx.fill();
  }
  const g = ctx.createRadialGradient(x - 40, y - 30, 4, x - 40, y - 30, 80);
  g.addColorStop(0, "rgba(255,160,70,0.3)");
  g.addColorStop(1, "rgba(255,160,70,0)");
  ctx.fillStyle = g;
  ctx.fillRect(x - 120, y - 110, 170, 170);
}

function drawMapTable(ctx: CanvasRenderingContext2D, x: number, y: number, lv: number) {
  ctx.fillStyle = "#4a3418";
  ctx.fillRect(x - 52, y - 10, 10, 34);
  ctx.fillRect(x + 42, y - 10, 10, 34);
  ctx.fillStyle = "#6a4a28";
  ctx.beginPath(); ctx.ellipse(x, y - 18, 70, 26, 0, 0, 6.3); ctx.fill();
  ctx.strokeStyle = "#3a2a14"; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.ellipse(x, y - 18, 70, 26, 0, 0, 6.3); ctx.stroke();
  // map
  ctx.fillStyle = "#d8c8a0";
  ctx.save(); ctx.translate(x, y - 22); ctx.rotate(-0.06);
  ctx.fillRect(-44, -14, 88, 30);
  ctx.strokeStyle = "#8a6a4a"; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(-36, -4); ctx.quadraticCurveTo(-10, -14, 8, 2); ctx.quadraticCurveTo(22, 12, 38, 0); ctx.stroke();
  ctx.fillStyle = "#c23b4e";
  ctx.beginPath(); ctx.arc(-20, 4, 3, 0, 6.3); ctx.arc(24, -6, 3, 0, 6.3); ctx.fill();
  ctx.restore();
  ctx.fillStyle = "#f0e2c4";
  ctx.font = '700 15px "Cinzel", serif';
  ctx.textAlign = "center";
  ctx.fillText("War Table", x, y + 40);
  void lv;
}

function drawMarketStall(ctx: CanvasRenderingContext2D, x: number, y: number, lv: number, t: number) {
  const built = lv > 0;
  // posts
  ctx.fillStyle = "#5a4228";
  ctx.fillRect(x - 58, y - 78, 8, 78);
  ctx.fillRect(x + 50, y - 78, 8, 78);
  // awning stripes
  for (let i = 0; i < 6; i++) {
    ctx.fillStyle = i % 2 === 0 ? "#a03040" : "#e8dcc0";
    ctx.beginPath();
    const x0 = x - 66 + i * 22;
    ctx.moveTo(x0, y - 78); ctx.lineTo(x0 + 22, y - 78);
    ctx.lineTo(x0 + 18, y - 58 + Math.sin(t * 2 + i) * 2); ctx.lineTo(x0 + 4, y - 58 + Math.sin(t * 2 + i + 1) * 2);
    ctx.closePath(); ctx.fill();
  }
  // counter
  ctx.fillStyle = built ? "#7a5a38" : "#5a4530";
  rr(ctx, x - 62, y - 34, 124, 34, 6); ctx.fill();
  ctx.strokeStyle = "#3a2a14"; ctx.lineWidth = 2.5;
  rr(ctx, x - 62, y - 34, 124, 34, 6); ctx.stroke();
  if (built) {
    // crates & sacks
    ctx.fillStyle = "#8a6a3a"; ctx.fillRect(x - 50, y - 52, 22, 18);
    ctx.strokeStyle = "#5a4228"; ctx.strokeRect(x - 50, y - 52, 22, 18);
    ctx.fillStyle = "#c8b890";
    ctx.beginPath(); ctx.arc(x - 10, y - 42, 11, Math.PI, 0); ctx.fill();
    ctx.fillStyle = "#e0a040";
    ctx.beginPath(); ctx.arc(x + 22, y - 44, 7, 0, 6.3); ctx.arc(x + 34, y - 42, 6, 0, 6.3); ctx.arc(x + 27, y - 52, 6, 0, 6.3); ctx.fill();
    // hanging lantern
    ctx.strokeStyle = "#3a2a1a"; ctx.beginPath(); ctx.moveTo(x + 54, y - 78); ctx.lineTo(x + 54, y - 66); ctx.stroke();
    ctx.fillStyle = "#ffd870";
    ctx.beginPath(); ctx.arc(x + 54, y - 60 + Math.sin(t * 3) * 1.5, 5, 0, 6.3); ctx.fill();
  }
  ctx.fillStyle = "#f0e2c4";
  ctx.font = '700 15px "Cinzel", serif';
  ctx.textAlign = "center";
  ctx.fillText(built ? `Market Lv ${lv}` : "Market (build it)", x, y + 24);
}

function drawMailPost(ctx: CanvasRenderingContext2D, x: number, y: number, hasUnread: boolean, t: number) {
  ctx.fillStyle = "#5a4228";
  ctx.fillRect(x - 5, y - 40, 10, 44);
  ctx.fillStyle = "#7a5a38";
  rr(ctx, x - 24, y - 74, 48, 36, 6); ctx.fill();
  ctx.strokeStyle = "#3a2a14"; ctx.lineWidth = 2.5;
  rr(ctx, x - 24, y - 74, 48, 36, 6); ctx.stroke();
  ctx.fillStyle = "#3a2a14";
  ctx.fillRect(x - 18, y - 60, 36, 4);
  // flag
  ctx.fillStyle = hasUnread ? "#c23b4e" : "#6a5a48";
  ctx.fillRect(x + 22, y - 84, 3, 22);
  ctx.beginPath(); ctx.moveTo(x + 25, y - 84); ctx.lineTo(x + 40, y - 79); ctx.lineTo(x + 25, y - 74); ctx.closePath(); ctx.fill();
  if (hasUnread) {
    const by = y - 96 + Math.sin(t * 4) * 4;
    ctx.fillStyle = "#f5b942";
    ctx.font = '900 22px "Alegreya Sans", sans-serif';
    ctx.textAlign = "center";
    ctx.fillText("!", x, by);
  }
}

function drawPillar(ctx: CanvasRenderingContext2D, x: number, y0: number, y1: number, stone: boolean) {
  const g = ctx.createLinearGradient(x - 24, 0, x + 24, 0);
  g.addColorStop(0, stone ? "#2c2620" : "#241a10");
  g.addColorStop(0.5, stone ? "#5a5048" : "#4a3820");
  g.addColorStop(1, stone ? "#241e18" : "#1c1208");
  ctx.fillStyle = g;
  ctx.fillRect(x - 24, y0, 48, y1 - y0 + 40);
  ctx.fillStyle = stone ? "#6a6058" : "#5a4528";
  ctx.fillRect(x - 30, y1 + 16, 60, 26);
  ctx.fillRect(x - 30, y0 - 8, 60, 22);
}

function drawNode(ctx: CanvasRenderingContext2D, n: CollectNode, t: number) {
  const bob = Math.sin(n.bob * 2.4) * 3;
  ctx.save();
  ctx.translate(n.x, n.y + bob);
  ctx.fillStyle = "rgba(10,6,2,0.3)";
  ctx.beginPath(); ctx.ellipse(0, 6 - bob, 24, 7, 0, 0, 6.3); ctx.fill();
  if (n.kind === "wood") {
    ctx.fillStyle = "#7a5230";
    for (let i = 0; i < 3; i++) {
      rr(ctx, -20 + i * 4, -8 - i * 9, 40 - i * 8, 10, 5); ctx.fill();
    }
    ctx.fillStyle = "#a87848";
    ctx.beginPath(); ctx.arc(20, -3, 5, 0, 6.3); ctx.arc(16, -12, 5, 0, 6.3); ctx.fill();
  } else if (n.kind === "stone") {
    ctx.fillStyle = "#7a7a80";
    ctx.beginPath(); ctx.moveTo(-20, 0); ctx.lineTo(-12, -16); ctx.lineTo(4, -20); ctx.lineTo(18, -8); ctx.lineTo(14, 0); ctx.closePath(); ctx.fill();
    ctx.fillStyle = "#9a9aa0";
    ctx.beginPath(); ctx.moveTo(-6, 0); ctx.lineTo(0, -12); ctx.lineTo(12, -4); ctx.lineTo(8, 0); ctx.closePath(); ctx.fill();
  } else {
    ctx.fillStyle = "#c8b078";
    ctx.beginPath(); ctx.arc(0, -8, 15, Math.PI, 0); ctx.fill();
    ctx.fillRect(-15, -8, 30, 8);
    ctx.fillStyle = "#a89058";
    ctx.fillRect(-15, -10, 30, 3);
    ctx.fillStyle = "#e8c860";
    for (let i = 0; i < 4; i++) {
      ctx.beginPath(); ctx.moveTo(-8 + i * 5, -22); ctx.lineTo(-6 + i * 5, -30); ctx.lineTo(-4 + i * 5, -22); ctx.closePath(); ctx.fill();
    }
  }
  // sparkle
  const sp = (Math.sin(t * 4 + n.x) + 1) / 2;
  drawStar(ctx, 14, -26, 5 + sp * 4, `rgba(255,235,170,${0.4 + sp * 0.6})`, t * 2);
  ctx.font = '800 14px "Alegreya Sans", sans-serif';
  ctx.textAlign = "center";
  ctx.lineWidth = 3; ctx.strokeStyle = "rgba(20,12,6,0.8)";
  const label = `+${n.amount} ${n.kind}`;
  ctx.strokeText(label, 0, -34);
  ctx.fillStyle = n.kind === "wood" ? "#e8b878" : n.kind === "stone" ? "#d0d0d8" : "#f0d890";
  ctx.fillText(label, 0, -34);
  ctx.restore();
}

function drawCat(ctx: CanvasRenderingContext2D, n: Npc, t: number) {
  ctx.save();
  ctx.translate(n.x, n.y);
  ctx.scale(n.face, 1);
  const step = Math.sin(n.walk * 14) * 2;
  ctx.fillStyle = "rgba(10,6,2,0.3)";
  ctx.beginPath(); ctx.ellipse(0, 2, 16, 4, 0, 0, 6.3); ctx.fill();
  ctx.fillStyle = n.pal.outfit;
  ctx.beginPath(); ctx.ellipse(0, -8 + step * 0.3, 15, 8, 0, 0, 6.3); ctx.fill();
  ctx.beginPath(); ctx.arc(13, -14, 7, 0, 6.3); ctx.fill();
  // ears
  ctx.beginPath(); ctx.moveTo(9, -19); ctx.lineTo(10, -26); ctx.lineTo(14, -20); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(15, -20); ctx.lineTo(18, -26); ctx.lineTo(19, -18); ctx.closePath(); ctx.fill();
  // tail
  ctx.strokeStyle = n.pal.outfit; ctx.lineWidth = 3.5;
  ctx.beginPath(); ctx.moveTo(-14, -10); ctx.quadraticCurveTo(-24, -16 + Math.sin(t * 6) * 4, -20, -24); ctx.stroke();
  ctx.fillStyle = "#2a1a10";
  ctx.beginPath(); ctx.arc(16, -14, 1.2, 0, 6.3); ctx.fill();
  ctx.restore();
}

function drawDog(ctx: CanvasRenderingContext2D, n: Npc, t: number) {
  ctx.save();
  ctx.translate(n.x, n.y);
  const breathe = 1 + Math.sin(t * 2.2) * 0.05;
  ctx.fillStyle = "rgba(10,6,2,0.3)";
  ctx.beginPath(); ctx.ellipse(0, 2, 22, 5, 0, 0, 6.3); ctx.fill();
  ctx.scale(1, breathe);
  ctx.fillStyle = n.pal.outfit;
  ctx.beginPath(); ctx.ellipse(0, -9, 20, 10, 0, 0, 6.3); ctx.fill();
  ctx.beginPath(); ctx.arc(18, -13, 8, 0, 6.3); ctx.fill();
  ctx.fillStyle = shade(n.pal.outfit, -25);
  ctx.beginPath(); ctx.ellipse(24, -11, 5, 3.4, 0.3, 0, 6.3); ctx.fill();
  ctx.beginPath(); ctx.moveTo(12, -19); ctx.quadraticCurveTo(8, -26, 14, -24); ctx.closePath(); ctx.fill();
  // closed eyes
  ctx.strokeStyle = "#2a1a10"; ctx.lineWidth = 1.4;
  ctx.beginPath(); ctx.arc(18, -14, 2.4, 0.3, Math.PI - 0.3); ctx.stroke();
  // tail
  ctx.strokeStyle = n.pal.outfit; ctx.lineWidth = 4;
  ctx.beginPath(); ctx.moveTo(-19, -12); ctx.quadraticCurveTo(-28, -14 + Math.sin(t * 1.5) * 2, -26, -20); ctx.stroke();
  ctx.restore();
}

function drawNpc(ctx: CanvasRenderingContext2D, n: Npc, t: number) {
  const working = n.state === "work";
  const swing = n.kind === "smith" ? (Math.sin(n.phase * 5) > 0 ? Math.max(0, Math.sin(n.phase * 5)) : 0) : 0;
  drawChibi(ctx, {
    x: n.x, y: n.y, s: n.scale, face: working ? 1 : n.face, walk: n.walk,
    moving: n.state === "walk", pal: n.pal, weapon: n.weapon,
    blink: Math.sin(t * 0.7 + n.phase * 3) > 0.985, hat: n.hat ?? "none",
    aura: n.aura, swing,
  });
  if (n.name) {
    ctx.font = '700 13px "Alegreya Sans", sans-serif';
    ctx.textAlign = "center";
    ctx.lineWidth = 3; ctx.strokeStyle = "rgba(16,10,6,0.75)";
    ctx.strokeText(n.name, n.x, n.y - 92 * n.scale);
    ctx.fillStyle = n.aura ?? "#e8dcc0";
    ctx.fillText(n.name, n.x, n.y - 92 * n.scale);
  }
}

function drawBubble(ctx: CanvasRenderingContext2D, x: number, y: number, text: string, t: number, active: boolean) {
  if (!active || !text) return;
  const by = y + Math.sin(t * 3) * 5;
  ctx.font = '800 16px "Alegreya Sans", sans-serif';
  const w = ctx.measureText(text).width + 24;
  ctx.fillStyle = "rgba(20,14,8,0.85)";
  rr(ctx, x - w / 2, by - 44, w, 30, 15); ctx.fill();
  ctx.strokeStyle = "#f5b942"; ctx.lineWidth = 2;
  rr(ctx, x - w / 2, by - 44, w, 30, 15); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x - 6, by - 14); ctx.lineTo(x + 6, by - 14); ctx.lineTo(x, by - 4); ctx.closePath(); ctx.fill();
  ctx.fillStyle = "#f5e8c8";
  ctx.textAlign = "center";
  ctx.fillText(text, x, by - 23);
}

// helper for components to convert pointer → world coords
export function hotspotNear(x: number, y: number): Hotspot | null {
  let best: Hotspot | null = null; let bd = 90;
  for (const h of HOTSPOTS) {
    const d = Math.hypot(h.x - x, h.y - y);
    if (d < bd) { bd = d; best = h; }
  }
  return best;
}

export { productionMult, expSlots };
