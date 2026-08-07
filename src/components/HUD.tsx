"use client";
import { useEffect, useRef, useState } from "react";
import { clock, touchInput } from "./GameCanvas";
import { fmt, kingdomScore, questProgressLabel, store, useGame } from "@/lib/state";
import { sfx } from "@/lib/audio";
import { phaseName } from "@/game/hall";

const isTouch = () => typeof window !== "undefined" && (navigator.maxTouchPoints > 0 || "ontouchstart" in window);

function ResIcon({ k }: { k: string }) {
  const c = { gold: "#f5b942", wood: "#c89058", stone: "#b8b8c0", food: "#e8c860", crystal: "#8adceb" }[k] ?? "#fff";
  if (k === "gold") return <svg viewBox="0 0 16 16" className="h-4 w-4"><circle cx="8" cy="8" r="6.5" fill={c} stroke="#8a6420" strokeWidth="1.4" /><circle cx="8" cy="8" r="3" fill="none" stroke="#8a6420" strokeWidth="1.2" /></svg>;
  if (k === "wood") return <svg viewBox="0 0 16 16" className="h-4 w-4"><rect x="1.5" y="5" width="13" height="6" rx="3" fill={c} stroke="#6a4828" strokeWidth="1.2" /><circle cx="12" cy="8" r="1.8" fill="#8a6838" /></svg>;
  if (k === "stone") return <svg viewBox="0 0 16 16" className="h-4 w-4"><path d="M3 12 L5 5 L10 3 L14 8 L12 13 Z" fill={c} stroke="#6a6a74" strokeWidth="1.2" /></svg>;
  if (k === "food") return <svg viewBox="0 0 16 16" className="h-4 w-4"><path d="M4 13 Q3 7 8 6 Q13 7 12 13 Z" fill={c} stroke="#8a7030" strokeWidth="1.2" /><path d="M7 6 L7 3 M9 6 L10 3" stroke="#8a7030" strokeWidth="1.2" /></svg>;
  return <svg viewBox="0 0 16 16" className="h-4 w-4"><path d="M8 1 L13 6 L8 15 L3 6 Z" fill={c} stroke="#4a8a9a" strokeWidth="1.2" /><path d="M8 1 L8 15 M3 6 L13 6" stroke="#dff5fa" strokeWidth="0.8" /></svg>;
}

function WeatherIcon() {
  const night = clock.dayT >= 0.65 || clock.dayT < 0.05;
  if (clock.weather === "rain") return <svg viewBox="0 0 16 16" className="h-4 w-4"><path d="M8 2 Q12 7 8 13 Q4 7 8 2Z" fill="#8ab8e8" /></svg>;
  if (clock.weather === "snow") return <svg viewBox="0 0 16 16" className="h-4 w-4"><path d="M8 1 V15 M2 4.5 L14 11.5 M14 4.5 L2 11.5" stroke="#e8f0fa" strokeWidth="1.5" /></svg>;
  if (night) return <svg viewBox="0 0 16 16" className="h-4 w-4"><path d="M11 2 A6.5 6.5 0 1 0 14 9 A5.5 5.5 0 0 1 11 2Z" fill="#e8ecf5" /></svg>;
  return <svg viewBox="0 0 16 16" className="h-4 w-4"><circle cx="8" cy="8" r="4" fill="#ffd870" /><g stroke="#ffd870" strokeWidth="1.4"><path d="M8 0.8 V3 M8 13 V15.2 M0.8 8 H3 M13 8 H15.2 M2.9 2.9 L4.5 4.5 M11.5 11.5 L13.1 13.1 M13.1 2.9 L11.5 4.5 M4.5 11.5 L2.9 13.1" /></g></svg>;
}

function Joystick() {
  const baseRef = useRef<HTMLDivElement>(null);
  const [knob, setKnob] = useState({ x: 0, y: 0, active: false });
  const pid = useRef<number | null>(null);

  const move = (e: React.PointerEvent) => {
    const el = baseRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    let dx = e.clientX - (r.left + r.width / 2);
    let dy = e.clientY - (r.top + r.height / 2);
    const d = Math.hypot(dx, dy);
    const max = r.width / 2 - 14;
    if (d > max) { dx = (dx / d) * max; dy = (dy / d) * max; }
    touchInput.joyX = dx / max;
    touchInput.joyY = dy / max;
    setKnob({ x: dx, y: dy, active: true });
  };

  return (
    <div
      ref={baseRef}
      className="pointer-events-auto absolute bottom-6 left-6 z-40 h-32 w-32 rounded-full border-2 border-[#f5b94266] bg-[#14100c99] backdrop-blur-[2px]"
      style={{ touchAction: "none" }}
      onPointerDown={(e) => { pid.current = e.pointerId; (e.target as HTMLElement).setPointerCapture?.(e.pointerId); move(e); }}
      onPointerMove={(e) => { if (pid.current === e.pointerId) move(e); }}
      onPointerUp={() => { pid.current = null; touchInput.joyX = 0; touchInput.joyY = 0; setKnob({ x: 0, y: 0, active: false }); }}
      onPointerCancel={() => { pid.current = null; touchInput.joyX = 0; touchInput.joyY = 0; setKnob({ x: 0, y: 0, active: false }); }}
    >
      <div
        className={`absolute left-1/2 top-1/2 h-14 w-14 rounded-full border-2 transition-colors ${knob.active ? "border-[#f5b942] bg-[#f5b94255]" : "border-[#f5b94288] bg-[#f5b94233]"}`}
        style={{ transform: `translate(calc(-50% + ${knob.x}px), calc(-50% + ${knob.y}px))` }}
      />
    </div>
  );
}

export default function HUD({ onPause, onOpenPanel }: { onPause: () => void; onOpenPanel: (id: string) => void }) {
  useGame();
  const [, setTick] = useState(0);
  useEffect(() => {
    const iv = setInterval(() => setTick((t) => t + 1), 250);
    return () => clearInterval(iv);
  }, []);
  const [touch] = useState(isTouch);
  const s = store.state;
  const score = kingdomScore(s);
  const q = questProgressLabel(s);
  const unread = s.mail.filter((m) => !m.claimed).length;

  return (
    <div className="pointer-events-none absolute inset-0 z-20">
      {/* top bar */}
      <div className="absolute inset-x-0 top-0 flex items-start justify-between gap-2 p-2 sm:p-3">
        <div className="flex flex-col gap-1.5">
          <div className="panel-wood pointer-events-auto flex items-center gap-2 px-3 py-1.5">
            {(["gold", "wood", "stone", "food", "crystal"] as const).map((k) => (
              <span key={k} className="flex items-center gap-1 text-[13px] font-extrabold text-[#f0e2c4]">
                <ResIcon k={k} />{fmt(s.res[k])}
              </span>
            ))}
          </div>
          <div className="panel-wood pointer-events-auto flex items-center gap-2 px-3 py-1 text-[12px] font-bold text-[#c8b890]">
            <span className="text-[#f5b942]">❖</span> Prosperity <span className="font-display text-sm text-[#f0e2c4]">{score.toLocaleString()}</span>
            <span className="opacity-40">|</span>
            <span>Day {clock.day}</span>
            <WeatherIcon />
            <span>{phaseName(clock.dayT)}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            className="panel-wood pointer-events-auto relative flex h-10 items-center gap-2 px-3 font-display text-sm font-bold text-[#f0e2c4] hover:brightness-125"
            onClick={() => { sfx.click(); onOpenPanel("heroes"); }}
          >
            <svg viewBox="0 0 16 16" className="h-4 w-4"><circle cx="8" cy="5" r="3" fill="#f5b942" /><path d="M2 14 Q8 8.5 14 14 Z" fill="#f5b942" /></svg>
            Heroes
          </button>
          <button
            className="panel-wood pointer-events-auto flex h-10 w-10 items-center justify-center hover:brightness-125"
            onClick={() => {
              sfx.click();
              store.mutate((st) => { st.muted = !st.muted; });
              sfx.setMuted(store.state.muted);
            }}
            aria-label="toggle sound"
          >
            {s.muted ? (
              <svg viewBox="0 0 16 16" className="h-4 w-4"><path d="M2 6 H5 L9 2 V14 L5 10 H2 Z" fill="#c8b890" /><path d="M11 6 L15 10 M15 6 L11 10" stroke="#d0483a" strokeWidth="1.6" /></svg>
            ) : (
              <svg viewBox="0 0 16 16" className="h-4 w-4"><path d="M2 6 H5 L9 2 V14 L5 10 H2 Z" fill="#f0e2c4" /><path d="M11 5 Q13.5 8 11 11 M12.5 3 Q16 8 12.5 13" stroke="#f0e2c4" strokeWidth="1.4" fill="none" /></svg>
            )}
          </button>
          <button className="panel-wood pointer-events-auto flex h-10 w-10 items-center justify-center hover:brightness-125" onClick={() => { sfx.click(); onPause(); }} aria-label="pause">
            <svg viewBox="0 0 16 16" className="h-4 w-4"><rect x="3.5" y="2.5" width="3.4" height="11" rx="1" fill="#f0e2c4" /><rect x="9" y="2.5" width="3.4" height="11" rx="1" fill="#f0e2c4" /></svg>
          </button>
        </div>
      </div>

      {/* quest tracker */}
      <div className="panel-wood pointer-events-auto absolute left-2 top-24 w-[min(78vw,300px)] p-3 sm:left-3 sm:top-28">
        <div className="font-display text-[11px] font-bold uppercase tracking-[0.18em] text-[#f5b942]">Royal Decree · {q.idx + 1}</div>
        <div className="mt-1 text-[13px] font-bold leading-snug text-[#f0e2c4]">{q.text}</div>
        <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-black/50">
          <div className="h-full rounded-full bg-gradient-to-r from-[#a03040] to-[#f5b942] transition-all duration-500" style={{ width: `${Math.min(100, (q.prog / q.target) * 100)}%` }} />
        </div>
        <div className="mt-1 text-right text-[11px] font-bold text-[#c8b890]">{Math.min(q.prog, q.target)}/{q.target} · {q.reward}</div>
      </div>

      {/* mail badge shortcut */}
      {unread > 0 && (
        <button className="panel-wood pointer-events-auto absolute right-2 top-16 flex items-center gap-2 px-3 py-1.5 text-xs font-extrabold text-[#f0e2c4] hover:brightness-125 sm:right-3 sm:top-[4.6rem]" onClick={() => { sfx.click(); onOpenPanel("mail"); }}>
          <svg viewBox="0 0 16 16" className="h-4 w-4"><rect x="1.5" y="3.5" width="13" height="9" rx="1.5" fill="none" stroke="#f5b942" strokeWidth="1.4" /><path d="M2 4.5 L8 9 L14 4.5" stroke="#f5b942" strokeWidth="1.4" fill="none" /></svg>
          {unread} letter{unread > 1 ? "s" : ""}
        </button>
      )}

      {/* touch controls */}
      {touch && (
        <>
          <Joystick />
          <button
            className="pointer-events-auto absolute bottom-8 right-6 z-40 flex h-20 w-20 items-center justify-center rounded-full border-[3px] border-[#f5b942] bg-[#7a243899] font-display text-2xl font-black text-[#f5e8c8] shadow-[0_0_24px_rgba(245,185,66,0.35)] active:scale-90"
            style={{ touchAction: "none" }}
            onPointerDown={(e) => { e.preventDefault(); touchInput.interactQueued = true; }}
          >
            E
          </button>
        </>
      )}

      {/* bottom hint (desktop) */}
      {!touch && (
        <div className="absolute inset-x-0 bottom-2 flex justify-center">
          <div className="rounded-full bg-black/45 px-4 py-1 text-[11px] font-bold tracking-wide text-[#c8b890]">
            WASD / Arrows — walk · E / Click — interact · Esc — pause
          </div>
        </div>
      )}
    </div>
  );
}
