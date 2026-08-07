"use client";
import { useEffect, useRef, useState } from "react";
import {
  drawBar, drawChibi, drawEnemy, drawStar, rr, spawnBurst, updateDrawFloats, updateDrawParticles,
} from "@/game/draw";
import type { FloatText, Particle } from "@/game/draw";
import { addRes, expNeed, heroStats, kingdomScore, questProgress, store } from "@/lib/state";
import { heroDef, makeStage, RARITY_COLOR, rollItem } from "@/lib/types";
import type { EnemyDef, GameState, HeroInst, Item, Palette, SkillKind, StageDef, WeaponKind } from "@/lib/types";
import { sfx } from "@/lib/audio";

interface Fighter {
  key: string; name: string; sub: string;
  hp: number; maxHp: number; atk: number;
  x: number; y: number; baseX: number; baseY: number;
  pal: Palette; weapon: WeaponKind | "none"; face: 1 | -1;
  walk: number; hurt: number; swing: number; dying: number; dead: boolean;
  isHero: boolean; hero?: HeroInst; def?: EnemyDef;
  skillCd: number; aura?: string; scale: number;
}

interface Props {
  stageN: number;
  onEnd: (victory: boolean) => void;
}

const BIOME_BG: Record<string, [string, string, string]> = {
  "Emerald Forest": ["#1a3a2a", "#2a5a3a", "#12281c"],
  "Amber Plains": ["#3a3a20", "#6a6a38", "#242412"],
  "Echo Caves": ["#1c2030", "#343a52", "#101320"],
  "Sunken Ruins": ["#20303a", "#3a5a68", "#121c24"],
  "Storm Peak": ["#242434", "#4a4a68", "#14141f"],
};

export default function BattleScreen({ stageN, onEnd }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [phase, setPhase] = useState<"fight" | "victory" | "defeat">("fight");
  const [turnLabel, setTurnLabel] = useState("");
  const [activeHero, setActiveHero] = useState(-1);
  const [auto, setAuto] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [loot, setLoot] = useState<{ gold: number; crystal: number; exp: number; item: Item | null; levels: string[] } | null>(null);
  const resolveSkill = useRef<((k: "attack" | "skill") => void) | null>(null);
  const autoRef = useRef(auto); autoRef.current = auto;
  const speedRef = useRef(speed); speedRef.current = speed;
  const phaseRef = useRef(phase); phaseRef.current = phase;
  const endRef = useRef(onEnd); endRef.current = onEnd;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const stage = makeStage(stageN);
    const s = store.state;
    const party = s.heroes.filter((h) => h.deployed && !h.expedition).slice(0, 3);
    const fighters: Fighter[] = [];

    party.forEach((h, i) => {
      const d = heroDef(h.defId);
      const st = heroStats(h, s);
      fighters.push({
        key: `h${h.uid}`, name: d.name, sub: `Lv ${h.level}`,
        hp: st.hp, maxHp: st.hp, atk: st.atk,
        x: 0, y: 0, baseX: 240 + (i % 2) * 110, baseY: 430 + i * 115,
        pal: d.palette, weapon: d.weapon, face: 1,
        walk: Math.random() * 5, hurt: 0, swing: 0, dying: 0, dead: false,
        isHero: true, hero: h, skillCd: 0,
        aura: d.rarity === "legendary" ? "#f5b942" : d.rarity === "epic" ? "#b06ae0" : undefined,
        scale: 1.5,
      });
    });
    stage.enemies.forEach((e, i) => {
      const n = stage.enemies.length;
      fighters.push({
        key: `e${i}`, name: e.def.name, sub: stage.boss ? "BOSS" : "",
        hp: e.hp, maxHp: e.hp, atk: e.atk,
        x: 0, y: 0, baseX: 1250 - (i % 2) * 130, baseY: 420 + (n === 1 ? 130 : i * (260 / Math.max(1, n - 1))),
        pal: { hair: e.def.c1, skin: e.def.c1, outfit: e.def.c1, accent: e.def.c2 },
        weapon: "none", face: -1,
        walk: Math.random() * 5, hurt: 0, swing: 0, dying: 0, dead: false,
        isHero: false, def: e.def, skillCd: 0, scale: e.def.boss ? 2.1 : 1.5,
      });
    });
    fighters.forEach((f) => { f.x = f.baseX; f.y = f.baseY; });

    const parts: Particle[] = [];
    const floats: FloatText[] = [];
    let shake = 0;
    let hitstop = 0;
    let tGlobal = 0;
    let activeKey = "";
    let turnArrowT = 0;
    let ended = false;

    // tween engine
    const tweens: { t: number; dur: number; fn: (k: number) => void; done?: () => void }[] = [];
    const tween = (dur: number, fn: (k: number) => void) =>
      new Promise<void>((res) => tweens.push({ t: 0, dur: dur / speedRef.current, fn, done: res }));
    const wait = (d: number) => tween(d, () => {});

    const byKey = (k: string) => fighters.find((f) => f.key === k)!;
    const alive = (side: boolean) => fighters.filter((f) => f.isHero === side && !f.dead);

    const dmgFloat = (f: Fighter, txt: string, color: string, size = 30) => {
      floats.push({ x: f.x + (Math.random() - 0.5) * 30, y: f.y - 120 * f.scale, life: 0, max: 1, text: txt, color, size });
    };

    const doDamage = async (src: Fighter, tgt: Fighter, mult: number, isSkill: boolean) => {
      // lunge
      const dx = tgt.x - src.x;
      await tween(140, (k) => { src.x = src.baseX + dx * 0.55 * Math.sin(k * Math.PI); });
      src.swing = 0.0001;
      await tween(160, (k) => { src.swing = k; });
      src.swing = 0;
      const crit = Math.random() < 0.14;
      const raw = src.atk * mult * (0.9 + Math.random() * 0.2) * (crit ? 1.65 : 1);
      const dmg = Math.max(1, Math.round(raw));
      tgt.hp = Math.max(0, tgt.hp - dmg);
      tgt.hurt = 1;
      hitstop = crit ? 0.12 : 0.06;
      shake = Math.max(shake, crit ? 1 : 0.55);
      const hx = tgt.x, hy = tgt.y - 60 * tgt.scale;
      spawnBurst(parts, hx, hy, crit ? "#f5b942" : "#ff8a5a", crit ? 22 : 12, crit ? 260 : 190);
      if (isSkill) spawnBurst(parts, hx, hy, "#8adceb", 10, 220, "star");
      dmgFloat(tgt, `${dmg}${crit ? "!" : ""}`, crit ? "#f5b942" : "#ff6a4a", crit ? 40 : 30);
      if (crit) floats.push({ x: tgt.x, y: tgt.y - 170 * tgt.scale, life: 0, max: 0.9, text: "CRITICAL", color: "#f5b942", size: 22 });
      (crit ? sfx.crit : sfx.hit)();
      await wait(120);
      if (tgt.hp <= 0) {
        tgt.dying = 0.0001;
        sfx.slash();
        await tween(420, (k) => { tgt.dying = k; });
        tgt.dead = true;
        spawnBurst(parts, tgt.x, tgt.y - 40, "#c8c8d0", 16, 200, "smoke");
        if (!tgt.isHero && s) { /* count later on victory */ }
      }
    };

    const doHeal = async (src: Fighter, mult: number) => {
      const targets = alive(true).sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp).slice(0, mult > 2 ? 3 : 1);
      src.swing = 0.0001;
      await tween(300, (k) => { src.swing = k * 0.4; });
      src.swing = 0;
      for (const tgt of targets) {
        const amt = Math.round(src.atk * mult + tgt.maxHp * 0.08);
        tgt.hp = Math.min(tgt.maxHp, tgt.hp + amt);
        spawnBurst(parts, tgt.x, tgt.y - 70, "#7ae08a", 14, 150, "star");
        dmgFloat(tgt, `+${amt}`, "#7ae08a", 28);
      }
      sfx.heal();
      await wait(250);
    };

    const heroAction = async (f: Fighter, kind: "attack" | "skill") => {
      const d = heroDef(f.hero!.defId);
      activeKey = f.key;
      if (kind === "skill") f.skillCd = d.skill.cd;
      const sk = d.skill;
      if (sk.kind === "heal") {
        await doHeal(f, sk.mult);
      } else if (sk.kind === "aoe" && kind === "skill") {
        const targets = alive(false);
        floats.push({ x: 800, y: 300, life: 0, max: 1, text: sk.name.toUpperCase(), color: "#8adceb", size: 42 });
        sfx.whoosh();
        for (const tgt of targets) {
          await doDamage(f, tgt, sk.mult, true);
          if (tgt.dead && targets.length > 1) continue;
        }
      } else {
        const tgt = alive(false)[0];
        if (kind === "skill") floats.push({ x: tgt.x, y: tgt.y - 210, life: 0, max: 1, text: sk.name.toUpperCase(), color: "#8adceb", size: 30 });
        await doDamage(f, tgt, kind === "skill" ? sk.mult : 1, kind === "skill");
      }
      activeKey = "";
    };

    const enemyAction = async (f: Fighter) => {
      activeKey = f.key;
      const tgt = alive(true)[Math.floor(Math.random() * alive(true).length)];
      if (!tgt) return;
      const dx = tgt.x - f.x;
      await tween(160, (k) => { f.x = f.baseX + dx * 0.5 * Math.sin(k * Math.PI); });
      const dmg = Math.max(1, Math.round(f.atk * (0.9 + Math.random() * 0.2)));
      tgt.hp = Math.max(0, tgt.hp - dmg);
      tgt.hurt = 1;
      hitstop = 0.06; shake = Math.max(shake, 0.5);
      spawnBurst(parts, tgt.x, tgt.y - 70, "#ff6a4a", 12, 180);
      dmgFloat(tgt, `${dmg}`, "#ff8a5a", 30);
      sfx.hurt();
      await wait(140);
      if (tgt.hp <= 0) {
        tgt.dying = 0.0001;
        await tween(420, (k) => { tgt.dying = k; });
        tgt.dead = true;
        spawnBurst(parts, tgt.x, tgt.y - 40, "#c8c8d0", 16, 200, "smoke");
      }
      f.x = f.baseX;
      activeKey = "";
    };

    const grantVictory = () => {
      const st = store.state;
      const levels: string[] = [];
      let item: Item | null = null;
      const g = Math.round(stage.gold * (1 + (st.day <= st.buffs.goldUntil ? st.buffs.gold - 1 : 0)));
      store.mutate((m: GameState) => {
        addRes(m, { gold: g, crystal: stage.crystal });
        m.stats.battlesWon++;
        m.stats.slain += stage.enemies.length;
        if (stageN >= m.campaignStage) m.campaignStage = stageN + 1;
        for (const f of fighters.filter((x) => x.isHero && x.hero)) {
          const h = m.heroes.find((x) => x.uid === f.hero!.uid)!;
          h.exp += stage.exp;
          while (h.exp >= expNeed(h.level) && h.level < 60) {
            h.exp -= expNeed(h.level);
            h.level++;
            levels.push(`${f.name} Lv ${h.level}`);
          }
        }
        const dropChance = stage.boss ? 1 : 0.24;
        if (Math.random() < dropChance && m.inventory.length < 14) {
          item = rollItem(m.nextItemId++, m.castleLv, stage.boss ? 0.45 : 0);
          m.inventory.push(item);
        }
      });
      questProgress(store.state, "stage", stageN);
      store.bump();
      sfx.victory();
      setLoot({ gold: g, crystal: stage.crystal, exp: stage.exp, item, levels });
      setPhase("victory");
    };

    const run = async () => {
      setTurnLabel(`Stage ${stageN} — ${stage.biome}`);
      floats.push({ x: 800, y: 420, life: 0, max: 1.4, text: stage.boss ? "⚔ BOSS BATTLE ⚔" : `Stage ${stageN}`, color: stage.boss ? "#f5b942" : "#f0e2c4", size: 54 });
      await wait(1100);
      while (!ended) {
        // hero turns
        for (const f of fighters.filter((x) => x.isHero && !x.dead)) {
          if (alive(false).length === 0) break;
          setTurnLabel(`${f.name}'s turn`);
          setActiveHero(fighters.indexOf(f));
          const d = heroDef(f.hero!.defId);
          const canSkill = f.skillCd <= 0;
          let choice: "attack" | "skill" = "attack";
          if (autoRef.current) {
            await wait(520);
            if (canSkill && (d.skill.kind !== "heal" || alive(true).some((x) => x.hp < x.maxHp * 0.75))) choice = "skill";
          } else {
            choice = await new Promise<"attack" | "skill">((res) => { resolveSkill.current = res; });
            resolveSkill.current = null;
          }
          await heroAction(f, canSkill || choice === "attack" ? choice : "attack");
          if (alive(false).length === 0) break;
        }
        if (alive(false).length === 0) { ended = true; await wait(400); grantVictory(); break; }
        // enemy turns
        for (const f of fighters.filter((x) => !x.isHero && !x.dead)) {
          if (alive(true).length === 0) break;
          setTurnLabel(`${f.name} attacks`);
          setActiveHero(-1);
          await enemyAction(f);
        }
        if (alive(true).length === 0) {
          ended = true;
          sfx.defeat();
          shake = 1;
          await wait(900);
          setPhase("defeat");
          break;
        }
        // tick cooldowns
        for (const f of fighters) if (f.skillCd > 0) f.skillCd--;
      }
    };

    // ── render loop
    const biomeKey = stage.biome.split(" · ")[0];
    const bg = BIOME_BG[biomeKey] ?? BIOME_BG["Emerald Forest"];
    let raf = 0;
    let last = performance.now();
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      let dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      if (hitstop > 0) { hitstop -= dt; dt *= 0.12; }
      tGlobal += dt;
      shake = Math.max(0, shake - dt * 3);
      turnArrowT += dt;

      // tweens
      for (let i = tweens.length - 1; i >= 0; i--) {
        const tw = tweens[i];
        tw.t += dt * 1000;
        const k = Math.min(1, tw.t / tw.dur);
        tw.fn(k);
        if (k >= 1) { tweens.splice(i, 1); tw.done?.(); }
      }
      for (const f of fighters) {
        f.walk += dt;
        f.hurt = Math.max(0, f.hurt - dt * 4);
      }

      // draw
      const dpr = Math.min(window.devicePixelRatio || 1, 1.75);
      const w = canvas.clientWidth, h = canvas.clientHeight;
      if (canvas.width !== Math.round(w * dpr)) { canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr); }
      const sc = Math.min(w / 1600, h / 900);
      const ox = (w - 1600 * sc) / 2, oy = (h - 900 * sc) / 2;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = "#060404";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.setTransform(dpr * sc, 0, 0, dpr * sc, dpr * ox, dpr * oy);
      if (shake > 0) ctx.translate((Math.random() - 0.5) * shake * 22, (Math.random() - 0.5) * shake * 22);

      // bg
      const g = ctx.createLinearGradient(0, 0, 0, 900);
      g.addColorStop(0, bg[0]); g.addColorStop(0.62, bg[1]); g.addColorStop(1, bg[2]);
      ctx.fillStyle = g;
      ctx.fillRect(-40, -40, 1680, 980);
      // moon/sun
      ctx.fillStyle = "rgba(255,240,200,0.85)";
      ctx.beginPath(); ctx.arc(1280, 150, 46, 0, 6.3); ctx.fill();
      ctx.fillStyle = bg[0];
      ctx.beginPath(); ctx.arc(1264, 138, 40, 0, 6.3); ctx.fill();
      // silhouettes
      ctx.fillStyle = "rgba(0,0,0,0.3)";
      for (let i = 0; i < 9; i++) {
        const sx = i * 190 + 40, sh = 90 + ((i * 67) % 90);
        if (biomeKey === "Echo Caves" || biomeKey === "Sunken Ruins") {
          ctx.beginPath(); ctx.moveTo(sx, 560); ctx.lineTo(sx + 50, 560 - sh); ctx.lineTo(sx + 100, 560); ctx.closePath(); ctx.fill();
        } else {
          ctx.beginPath(); ctx.arc(sx + 40, 560 - sh, 42, Math.PI, 0); ctx.fillRect(sx + 32, 560 - sh, 16, sh); ctx.fill();
        }
      }
      // ground
      const gg = ctx.createLinearGradient(0, 540, 0, 900);
      gg.addColorStop(0, "rgba(0,0,0,0.25)"); gg.addColorStop(1, "rgba(0,0,0,0.55)");
      ctx.fillStyle = bg[2];
      ctx.fillRect(-40, 545, 1680, 360);
      ctx.fillStyle = gg;
      ctx.fillRect(-40, 545, 1680, 360);
      ctx.strokeStyle = "rgba(255,255,255,0.06)";
      ctx.lineWidth = 2;
      for (let i = 0; i < 5; i++) {
        ctx.beginPath(); ctx.moveTo(-40, 580 + i * 70); ctx.lineTo(1640, 580 + i * 70); ctx.stroke();
      }

      // fighters sorted by y
      const order = [...fighters].filter((f) => !f.dead).sort((a, b) => a.y - b.y);
      for (const f of order) {
        ctx.save();
        if (f.dying > 0) { ctx.globalAlpha = 1 - f.dying; ctx.translate(0, f.dying * 20); }
        if (f.isHero) {
          drawChibi(ctx, {
            x: f.x, y: f.y, s: f.scale, face: f.face, walk: f.walk, moving: false,
            pal: f.pal, weapon: f.weapon, blink: Math.sin(tGlobal * 0.9 + f.y) > 0.98,
            aura: f.aura, hurt: f.hurt, swing: f.swing, hat: "none",
          });
        } else {
          drawEnemy(ctx, f.def!, f.x, f.y, f.scale, tGlobal + f.y, f.hurt, f.swing);
        }
        ctx.restore();
        // hp bar
        const bw = 120 * f.scale * 0.8;
        const by = f.y - (f.isHero ? 128 : f.def!.boss ? 230 : 130) * f.scale * 0.72;
        drawBar(ctx, f.x - bw / 2, by, bw, 11, f.hp / f.maxHp, f.isHero ? "#6ac05a" : "#d0483a");
        ctx.font = '700 16px "Alegreya Sans", sans-serif';
        ctx.textAlign = "center";
        ctx.lineWidth = 3; ctx.strokeStyle = "rgba(10,6,4,0.8)";
        ctx.strokeText(`${f.name} ${f.sub}`, f.x, by - 8);
        ctx.fillStyle = f.isHero ? "#f0e2c4" : "#f0c0b0";
        ctx.fillText(`${f.name} ${f.sub}`, f.x, by - 8);
        // turn arrow
        if (f.key === activeKey || (activeHero >= 0 && fighters[activeHero] === f && phaseRef.current === "fight")) {
          const ay = by - 34 + Math.sin(turnArrowT * 6) * 6;
          ctx.fillStyle = "#f5b942";
          ctx.beginPath(); ctx.moveTo(f.x, ay + 12); ctx.lineTo(f.x - 10, ay); ctx.lineTo(f.x + 10, ay); ctx.closePath(); ctx.fill();
        }
      }

      updateDrawParticles(ctx, parts, dt);
      updateDrawFloats(ctx, floats, dt);

      // defeat desaturate veil
      if (phaseRef.current === "defeat") {
        ctx.fillStyle = "rgba(30,6,10,0.45)";
        ctx.fillRect(-40, -40, 1680, 980);
      }
      void drawStar; void rr;
    };
    raf = requestAnimationFrame(loop);
    void run();

    return () => { cancelAnimationFrame(raf); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stageN]);

  const s = store.state;
  const party = s.heroes.filter((h) => h.deployed && !h.expedition).slice(0, 3);
  const score = kingdomScore(s);

  const pick = (k: "attack" | "skill") => { resolveSkill.current?.(k); sfx.click(); };

  return (
    <div className="absolute inset-0 z-30 bg-[#060404]">
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />
      {/* top bar */}
      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-center justify-between px-4 pt-3">
        <div className="panel-wood px-4 py-1.5 text-sm font-bold text-[#f0e2c4]">
          Stage {stageN} <span className="text-[#f5b942]">·</span> <span id="turn-label">{turnLabel}</span>
        </div>
        <div className="flex gap-2">
          <button className="btn-royal px-3 py-1.5 text-xs" onClick={() => setSpeed(speed === 1 ? 2 : 1)}>×{speed} Speed</button>
          <button className={`btn-royal px-3 py-1.5 text-xs ${auto ? "!bg-[#7a2438]" : ""}`} onClick={() => setAuto(!auto)}>
            Auto: {auto ? "ON" : "OFF"}
          </button>
        </div>
      </div>
      {/* skill bar */}
      {phase === "fight" && activeHero >= 0 && (
        <div className="absolute inset-x-0 bottom-0 flex items-end justify-center gap-3 p-3 pb-4">
          {party.map((h, i) => {
            const d = heroDef(h.defId);
            const active = i === activeHero;
            return (
              <div key={h.uid} className={`panel-wood flex items-center gap-3 px-3 py-2 transition-all ${active ? "ring-2 ring-[#f5b942] scale-105" : "opacity-55"}`}>
                <div className="h-11 w-11 rounded-full border-2 flex items-center justify-center font-display font-black text-lg"
                  style={{ borderColor: RARITY_COLOR[d.rarity], background: `linear-gradient(160deg, ${d.palette.outfit}, #14100c)`, color: "#f0e2c4" }}>
                  {d.name[0]}
                </div>
                <div className="w-28">
                  <div className="text-xs font-extrabold text-[#f0e2c4]">{d.name} <span className="opacity-60">Lv{h.level}</span></div>
                  {active && (
                    <div className="mt-1 flex gap-1.5">
                      <button className="btn-royal px-2.5 py-1 text-[11px]" onClick={() => pick("attack")}>Attack</button>
                      <button className="btn-royal px-2.5 py-1 text-[11px]" disabled={!resolveSkill.current} onClick={() => pick("skill")}>
                        {d.skill.name}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
      {/* victory */}
      {phase === "victory" && loot && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/55">
          <div className="panel-wood w-[min(92vw,460px)] p-6 text-center animate-[slamIn_.45s_cubic-bezier(.2,1.4,.4,1)]">
            <div className="font-display text-4xl font-black tracking-wide text-[#f5b942] drop-shadow-[0_2px_0_rgba(0,0,0,.6)]">VICTORY</div>
            <div className="mt-1 text-sm text-[#c8b890]">Stage {stageN} cleared — the realm grows stronger.</div>
            <div className="mt-4 grid grid-cols-2 gap-2 text-sm font-bold text-[#f0e2c4]">
              <div className="rounded-lg bg-black/30 px-3 py-2">+{loot.gold} Gold</div>
              <div className="rounded-lg bg-black/30 px-3 py-2">+{loot.crystal} Crystals</div>
              <div className="col-span-2 rounded-lg bg-black/30 px-3 py-2">+{loot.exp} EXP to squad</div>
              {loot.item && (
                <div className="col-span-2 rounded-lg bg-black/30 px-3 py-2" style={{ color: RARITY_COLOR[loot.item.rarity] }}>
                  ◆ {loot.item.name} (+{loot.item.atk} ATK)
                </div>
              )}
              {loot.levels.map((l) => (
                <div key={l} className="col-span-2 rounded-lg bg-[#3a5a2a]/50 px-3 py-2 text-[#b8e8a0]">▲ {l}</div>
              ))}
            </div>
            <button className="btn-royal mt-5 w-full py-3 text-base font-black tracking-wider" onClick={() => endRef.current(true)}>
              RETURN TO THE KEEP
            </button>
          </div>
        </div>
      )}
      {/* defeat */}
      {phase === "defeat" && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/60">
          <div className="panel-wood w-[min(92vw,460px)] p-6 text-center animate-[slamIn_.45s_cubic-bezier(.2,1.4,.4,1)]">
            <div className="font-display text-4xl font-black tracking-wide text-[#d0483a]">THE LINE HAS FALLEN</div>
            <div className="mt-2 text-sm text-[#c8b890]">Your squad was defeated at Stage {stageN}. The kingdom's story ends here — but legends remember the score.</div>
            <div className="mt-4 rounded-lg bg-black/30 px-3 py-3">
              <div className="text-xs uppercase tracking-[0.2em] text-[#c8b890]">Final Prosperity</div>
              <div className="font-display text-4xl font-black text-[#f5b942]">{score.toLocaleString()}</div>
            </div>
            <button className="btn-royal mt-5 w-full py-3 text-base font-black tracking-wider" onClick={() => endRef.current(false)}>
              CONTINUE
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
