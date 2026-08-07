"use client";
import { useEffect, useRef } from "react";
import {
  createScene, DAY_LEN, drawScene, hotspotNear, updateScene, WORLD_H, WORLD_W,
} from "@/game/hall";
import type { HallScene } from "@/game/hall";
import { spawnBurst } from "@/game/draw";
import {
  addRes, goldMult, newDay, productionMult, questProgress, scheduleSave, store,
} from "@/lib/state";
import { rollItem } from "@/lib/types";
import type { ResKey } from "@/lib/types";
import { sfx } from "@/lib/audio";

// shared input channel (HUD joystick / buttons write here)
export const touchInput = { joyX: 0, joyY: 0, interactQueued: false };

export const clock = { dayT: 0.12, day: 1, weather: "clear" as string, phase: "Morning" };

interface Props {
  runId: number;
  paused: boolean;
  onOpenPanel: (id: string) => void;
  onTogglePause: () => void;
}

export default function GameCanvas({ runId, paused, onOpenPanel, onTogglePause }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cbRef = useRef({ onOpenPanel, onTogglePause });
  cbRef.current = { onOpenPanel, onTogglePause };
  const pausedRef = useRef(paused);
  pausedRef.current = paused;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let scene: HallScene = createScene(store.state);
    const keys = new Set<string>();
    let raf = 0;
    let last = performance.now();
    let saveAcc = 0;
    let notifiedExp = new Set<number>();
    const view = { s: 1, ox: 0, oy: 0, dpr: 1 };

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 1.75);
      const w = canvas.clientWidth, h = canvas.clientHeight;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      const s = Math.min(w / WORLD_W, h / WORLD_H);
      view.s = s; view.dpr = dpr;
      view.ox = (w - WORLD_W * s) / 2;
      view.oy = (h - WORLD_H * s) / 2;
    };
    resize();
    window.addEventListener("resize", resize);

    const toWorld = (clientX: number, clientY: number) => {
      const r = canvas.getBoundingClientRect();
      return { x: (clientX - r.left - view.ox) / view.s, y: (clientY - r.top - view.oy) / view.s };
    };

    // ── keyboard
    const kd = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (["arrowup", "arrowdown", "arrowleft", "arrowright", " "].includes(k)) e.preventDefault();
      if (k === "escape" || k === "p") { cbRef.current.onTogglePause(); return; }
      if (k === "e" || k === " ") { touchInput.interactQueued = true; return; }
      keys.add(k);
    };
    const ku = (e: KeyboardEvent) => keys.delete(e.key.toLowerCase());
    const onBlur = () => { if (!pausedRef.current) cbRef.current.onTogglePause(); };
    window.addEventListener("keydown", kd);
    window.addEventListener("keyup", ku);
    window.addEventListener("blur", onBlur);

    // ── pointer (tap to move / tap hotspot)
    let downAt: { x: number; y: number; t: number } | null = null;
    const pd = (e: PointerEvent) => { downAt = { x: e.clientX, y: e.clientY, t: performance.now() }; };
    const pu = (e: PointerEvent) => {
      if (!downAt) return;
      const moved = Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y);
      const dt = performance.now() - downAt.t;
      downAt = null;
      if (moved > 14 || dt > 350) return;
      const p = toWorld(e.clientX, e.clientY);
      if (p.x < 0 || p.x > WORLD_W || p.y < 0 || p.y > WORLD_H) return;
      const hs = hotspotNear(p.x, p.y);
      const g = scene.gov;
      if (hs) {
        if (Math.hypot(hs.x - g.x, hs.y - g.y) < 150) {
          cbRef.current.onOpenPanel(hs.panel);
          sfx.click();
        } else {
          scene.moveTarget = { x: hs.x, y: Math.min(855, hs.y + 26) };
          scene.pendingPanel = hs.panel;
          sfx.whoosh();
        }
      } else {
        scene.moveTarget = { x: Math.max(120, Math.min(1480, p.x)), y: Math.max(590, Math.min(858, p.y)) };
        scene.pendingPanel = null;
      }
    };
    canvas.addEventListener("pointerdown", pd);
    canvas.addEventListener("pointerup", pu);

    // ── hooks from scene
    const hooks = {
      collect: (kind: ResKey, amount: number, x: number, y: number) => {
        const s = store.state;
        store.mutate((st) => {
          addRes(st, { [kind]: amount } as Record<ResKey, number>);
          st.stats.collected += amount;
          questProgress(st, "collect", amount, kind);
        });
        const col = kind === "wood" ? "#e8b878" : kind === "stone" ? "#d0d0d8" : "#f0d890";
        spawnBurst(scene.parts, x, y - 10, col, 14, 190, "spark");
        spawnBurst(scene.parts, x, y - 10, "#f5b942", 5, 140, "star");
        scene.floats.push({ x, y: y - 40, life: 0, max: 1.1, text: `+${amount} ${kind}`, color: col, size: 20 });
        sfx.collect();
        void s;
      },
      openPanel: (id: string) => {
        sfx.click();
        cbRef.current.onOpenPanel(id);
      },
      collectBuilding: (id: string, x: number, y: number) => {
        const s = store.state;
        if (id === "farm" && s.buildings.farm.acc >= 1) {
          const amt = Math.floor(s.buildings.farm.acc);
          store.mutate((st) => { st.buildings.farm.acc -= amt; addRes(st, { food: amt }); });
          spawnBurst(scene.parts, x, y - 30, "#f0d890", 12, 170);
          scene.floats.push({ x, y: y - 50, life: 0, max: 1.1, text: `+${amt} food`, color: "#f0d890", size: 19 });
          sfx.coin();
        } else if (id === "market" && s.buildings.market.acc >= 1) {
          const amt = Math.floor(s.buildings.market.acc);
          store.mutate((st) => { st.buildings.market.acc -= amt; addRes(st, { gold: amt }); });
          spawnBurst(scene.parts, x, y - 30, "#f5b942", 12, 170);
          scene.floats.push({ x, y: y - 50, life: 0, max: 1.1, text: `+${amt} gold`, color: "#f5b942", size: 19 });
          sfx.coin();
        } else if (id === "smithy" && s.buildings.smithy.pendingForge) {
          const item = s.buildings.smithy.pendingForge;
          store.mutate((st) => {
            st.buildings.smithy.pendingForge = null;
            if (st.inventory.length < 14) st.inventory.push(item);
            else addRes(st, { gold: 40 });
          });
          spawnBurst(scene.parts, x, y - 30, "#8ab8e8", 16, 200, "star");
          scene.floats.push({ x, y: y - 50, life: 0, max: 1.3, text: item.name, color: "#8ab8e8", size: 19 });
          sfx.levelup();
          store.toast(`Forged: ${item.name} (+${item.atk} ATK)`, "good");
        }
      },
    };

    // ── main loop
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      let dt = (now - last) / 1000;
      last = now;
      if (pausedRef.current) { return; }
      dt = Math.min(dt, 0.05);
      const s = store.state;

      // production
      let dirty = false;
      const pm = productionMult(s);
      if (s.buildings.farm.lv > 0) {
        s.buildings.farm.acc = Math.min(999, s.buildings.farm.acc + 0.7 * s.buildings.farm.lv * pm * dt);
        dirty = true;
      }
      if (s.buildings.market.lv > 0) {
        s.buildings.market.acc = Math.min(999, s.buildings.market.acc + 1.1 * s.buildings.market.lv * goldMult(s) * dt);
        dirty = true;
      }
      if (s.buildings.smithy.lv > 0) {
        s.buildings.smithy.forgeT -= dt;
        dirty = true;
        if (s.buildings.smithy.forgeT <= 0) {
          if (!s.buildings.smithy.pendingForge) {
            s.buildings.smithy.pendingForge = rollItem(s.nextItemId++, s.castleLv, 0.06 * s.buildings.smithy.lv);
            s.stats.forged++;
            store.bump();
          }
          s.buildings.smithy.forgeT = 70 / (1 + 0.25 * (s.buildings.smithy.lv - 1));
        }
      }
      // passive castle gold
      s.res.gold += 0.25 * s.castleLv * dt;
      // expedition notifications
      for (const h of s.heroes) {
        if (h.expedition && h.expedition.endsAt <= Date.now() && !notifiedExp.has(h.uid)) {
          notifiedExp.add(h.uid);
          store.toast("An expedition has returned — collect at the War Table", "quest");
        }
      }
      if (dirty && Math.floor(now / 1000) % 2 === 0) store.dirty = true;

      // day cycle
      scene.dayT += dt / DAY_LEN;
      if (scene.dayT >= 1) {
        scene.dayT -= 1;
        store.mutate((st) => newDay(st));
      }
      clock.dayT = scene.dayT;
      clock.day = s.day;
      clock.weather = s.weather;

      // input vector
      let ix = 0, iy = 0;
      if (keys.has("a") || keys.has("arrowleft")) ix -= 1;
      if (keys.has("d") || keys.has("arrowright")) ix += 1;
      if (keys.has("w") || keys.has("arrowup")) iy -= 1;
      if (keys.has("s") || keys.has("arrowdown")) iy += 1;
      ix += touchInput.joyX; iy += touchInput.joyY;
      const m = Math.hypot(ix, iy);
      if (m > 1) { ix /= m; iy /= m; }
      const interact = touchInput.interactQueued;
      touchInput.interactQueued = false;

      updateScene(scene, dt, s, hooks, { x: ix, y: iy }, interact);

      // autosave
      saveAcc += dt;
      if (saveAcc > 8) { saveAcc = 0; scheduleSave(); }

      // draw
      const dpr = view.dpr;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = "#0a0705";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.setTransform(dpr * view.s, 0, 0, dpr * view.s, dpr * view.ox, dpr * view.oy);
      drawScene(ctx, scene, s);
    };
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      window.removeEventListener("keydown", kd);
      window.removeEventListener("keyup", ku);
      window.removeEventListener("blur", onBlur);
      canvas.removeEventListener("pointerdown", pd);
      canvas.removeEventListener("pointerup", pu);
    };
  }, [runId]);

  return <canvas ref={canvasRef} className="absolute inset-0 h-full w-full touch-none select-none" style={{ cursor: "pointer" }} />;
}
