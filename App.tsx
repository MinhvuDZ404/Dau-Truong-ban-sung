import { useEffect, useRef, useState } from 'react';
import { Game, type GameState } from './game/engine';
import { WEAPONS, UPGRADES } from './game/data';
import { sfx } from './game/audio';

const Bar = ({ v, max, color, label }: { v: number; max: number; color: string; label?: string }) => (
  <div className="w-full h-3 bg-black/60 rounded border border-white/20 overflow-hidden relative">
    <div className="h-full transition-all duration-150" style={{ width: `${Math.max(0, (v / max) * 100)}%`, background: color, boxShadow: `0 0 12px ${color}` }} />
    {label && <span className="absolute inset-0 text-[10px] text-white/90 font-mono flex items-center justify-center">{label}</span>}
  </div>
);

export default function App() {
  const ref = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<Game | null>(null);
  const [s, setS] = useState<GameState | null>(null);
  const [muted, setMuted] = useState(false);
  const [best, setBest] = useState(0);

  useEffect(() => {
    if (!ref.current) return;
    const g = new Game(ref.current, setS);
    gameRef.current = g;
    setS({ ...g.s });
    setBest(Number(localStorage.getItem('sn_best') || 0));
    return () => g.destroy();
  }, []);

  useEffect(() => {
    if (s?.status === 'gameover') setBest(Number(localStorage.getItem('sn_best') || 0));
  }, [s?.status]);

  const g = gameRef.current;
  const status = s?.status ?? 'menu';

  return (
    <div className="min-h-screen w-full bg-[#03040c] text-white flex flex-col items-center justify-center p-2 md:p-4 font-sans select-none"
      style={{ backgroundImage: 'radial-gradient(circle at 50% 0%, #1b1040 0%, #03040c 60%)' }}>
      <div className="relative w-full max-w-[960px] aspect-[4/3] rounded-xl overflow-hidden border border-cyan-500/30 shadow-[0_0_60px_rgba(34,211,238,0.25)]">
        <canvas ref={ref} width={960} height={720} className="w-full h-full block cursor-crosshair touch-none" />

        {/* HUD */}
        {s && (status === 'playing' || status === 'paused' || status === 'levelup') && (
          <div className="absolute inset-0 pointer-events-none p-3 flex flex-col gap-2">
            <div className="flex justify-between items-start gap-3 text-xs font-mono">
              <div className="w-56 space-y-1">
                <Bar v={s.hp} max={s.maxHp} color="#ef4444" label={`HP ${Math.ceil(s.hp)}/${s.maxHp}`} />
                <Bar v={s.xp} max={s.xpNeed} color="#22d3ee" label={`LV ${s.level}`} />
                <div className="flex gap-1">
                  {Array.from({ length: s.maxShield }).map((_, i) => (
                    <div key={i} className={`w-4 h-2 rounded-sm ${i < s.shield ? 'bg-blue-400 shadow-[0_0_8px_#60a5fa]' : 'bg-white/15'}`} />
                  ))}
                </div>
              </div>
              <div className="text-center">
                <div className="text-2xl md:text-3xl font-black tabular-nums text-yellow-300 drop-shadow-[0_0_10px_rgba(253,224,71,0.6)]">{s.score.toLocaleString()}</div>
                <div className="text-cyan-300">WAVE {s.wave} · x{s.combo.toFixed(2)}</div>
              </div>
              <div className="text-right space-y-1">
                <div className="text-fuchsia-300">{WEAPONS[s.weapon].icon} {WEAPONS[s.weapon].name}</div>
                <div className="text-amber-300">💣 {g?.player.bombs ?? 0} (E)</div>
                <div className="text-white/60">Kills {s.kills}</div>
              </div>
            </div>
            {s.bossName && (
              <div className="mx-auto w-[70%] mt-1">
                <div className="text-center text-red-400 font-bold tracking-widest text-sm animate-pulse">{s.bossName}</div>
                <Bar v={s.bossHp} max={s.bossMaxHp} color="#f43f5e" />
              </div>
            )}
            <div className="mt-auto flex gap-1 pointer-events-auto">
              {s.unlocked.map((w, i) => (
                <button key={w} onClick={() => { if (g) { g.s.weapon = w; g.emit(); } }}
                  className={`px-2 py-1 rounded text-xs font-mono border ${s.weapon === w ? 'bg-cyan-500/30 border-cyan-400' : 'bg-black/50 border-white/20'}`}>
                  {i + 1} {WEAPONS[w].icon}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* MENU */}
        {status === 'menu' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-5 bg-black/60 backdrop-blur-sm"
            style={{ backgroundImage: 'url(/assets/menu.jpg)', backgroundSize: 'cover', backgroundPosition: 'center' }}>
            <div className="bg-black/65 px-8 py-8 rounded-2xl border border-cyan-400/30 text-center max-w-lg">
              <h1 className="text-4xl md:text-5xl font-black tracking-tight bg-gradient-to-r from-cyan-300 via-fuchsia-400 to-amber-300 bg-clip-text text-transparent">STAR NEXUS</h1>
              <p className="text-cyan-200/80 mt-1 text-sm">Bắn phi thuyền vũ trụ · 5 boss khổng lồ · 6 vũ khí · 14 nâng cấp</p>
              <div className="mt-4 text-xs text-white/70 font-mono leading-6 text-left inline-block">
                <div>WASD / chuột — di chuyển</div>
                <div>SPACE / giữ chuột — bắn</div>
                <div>1-6 hoặc Q — đổi vũ khí · E — bom · SHIFT — lướt</div>
                <div>P / ESC — tạm dừng</div>
              </div>
              <div className="mt-5 flex gap-3 justify-center">
                <button onClick={() => { sfx.ensure(); g?.start(); }}
                  className="px-8 py-3 rounded-lg bg-gradient-to-r from-cyan-500 to-fuchsia-600 font-bold text-lg hover:scale-105 transition shadow-lg shadow-cyan-500/40">▶ BẮT ĐẦU</button>
              </div>
              {best > 0 && <div className="mt-3 text-amber-300 font-mono text-sm">Kỷ lục: {best.toLocaleString()}</div>}
            </div>
          </div>
        )}

        {/* LEVEL UP */}
        {s && status === 'levelup' && (
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center gap-4 p-4">
            <h2 className="text-3xl font-black text-cyan-300">LEVEL {s.level} — CHỌN NÂNG CẤP</h2>
            <div className="grid md:grid-cols-3 gap-3 w-full max-w-3xl">
              {s.choices.map((c) => (
                <button key={c.id} onClick={() => g?.choose(c.id)}
                  className="group p-4 rounded-xl border border-white/20 bg-gradient-to-b from-white/10 to-transparent hover:border-cyan-400 hover:scale-105 transition text-left">
                  <div className="text-3xl">{c.icon}</div>
                  <div className="font-bold mt-1 text-cyan-200">{c.name}</div>
                  <div className="text-xs text-white/70 mt-1">{c.desc}</div>
                  <div className="text-[10px] mt-2 uppercase tracking-widest text-fuchsia-400">
                    {c.kind === 'weapon' ? 'Vũ khí mới' : c.kind === 'perk' ? 'Đặc tính' : `Cấp ${(s.upgrades[c.id] || 0) + 1}/${UPGRADES.find((u) => u.id === c.id)?.max}`}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* PAUSE */}
        {status === 'paused' && (
          <div className="absolute inset-0 bg-black/75 flex flex-col items-center justify-center gap-4">
            <h2 className="text-4xl font-black text-white/90">TẠM DỪNG</h2>
            <button onClick={() => g?.togglePause()} className="px-6 py-2 rounded bg-cyan-500 font-bold">Tiếp tục</button>
            <button onClick={() => g?.start()} className="px-6 py-2 rounded bg-white/10 border border-white/30">Chơi lại</button>
          </div>
        )}

        {/* GAME OVER */}
        {s && status === 'gameover' && (
          <div className="absolute inset-0 bg-black/85 flex flex-col items-center justify-center gap-3 text-center">
            <h2 className="text-5xl font-black text-red-500 drop-shadow-[0_0_20px_rgba(239,68,68,0.6)]">GAME OVER</h2>
            <div className="font-mono text-white/80">Wave {s.wave} · {s.kills} kills · Level {s.level}</div>
            <div className="text-3xl font-black text-amber-300">{s.score.toLocaleString()}</div>
            <div className="text-sm text-cyan-300">Kỷ lục: {best.toLocaleString()}</div>
            <button onClick={() => g?.start()} className="mt-3 px-8 py-3 rounded-lg bg-gradient-to-r from-fuchsia-600 to-cyan-500 font-bold hover:scale-105 transition">CHƠI LẠI</button>
          </div>
        )}
      </div>

      <div className="mt-3 flex items-center gap-3 text-xs text-white/50 font-mono">
        <button onClick={() => { const m = !muted; setMuted(m); sfx.setMuted(m); }} className="px-3 py-1 rounded border border-white/20 hover:bg-white/10">
          {muted ? '🔇 Tắt tiếng' : '🔊 Âm thanh'}
        </button>
        <span>STAR NEXUS v1.0 — Canvas 60FPS, WebAudio synth, boss 5 tầng</span>
      </div>
    </div>
  );
}
