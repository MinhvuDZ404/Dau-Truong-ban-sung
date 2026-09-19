import { sfx } from './audio';
import { WEAPONS, ENEMIES, BOSSES, UPGRADES, PERKS, type WeaponId } from './data';

export interface GameState {
  status: 'menu' | 'playing' | 'paused' | 'levelup' | 'gameover' | 'victory';
  wave: number;
  score: number;
  hp: number;
  maxHp: number;
  shield: number;
  maxShield: number;
  xp: number;
  xpNeed: number;
  level: number;
  weapon: WeaponId;
  unlocked: WeaponId[];
  combo: number;
  bossName: string | null;
  bossHp: number;
  bossMaxHp: number;
  kills: number;
  choices: { id: string; name: string; desc: string; icon: string; kind: 'up' | 'perk' | 'weapon' }[];
  perks: string[];
  upgrades: Record<string, number>;
  time: number;
}

interface V { x: number; y: number }

interface Bullet extends V { vx: number; vy: number; r: number; dmg: number; color: string; friendly: boolean; life: number; pierce: number; homing?: boolean; target?: Enemy | null; trail: V[]; big?: boolean }
interface Enemy extends V { vx: number; vy: number; hp: number; maxHp: number; def: typeof ENEMIES[number]; t: number; cd: number; flash: number; boss?: boolean; bossIdx?: number; patternT?: number; patternI?: number; angle: number }
interface Particle extends V { vx: number; vy: number; life: number; max: number; color: string; size: number }
interface Pickup extends V { vx: number; vy: number; kind: 'xp' | 'hp' | 'shield' | 'bomb' | 'weapon'; w?: WeaponId; t: number }
interface Star extends V { z: number; s: number }

const rand = (a: number, b: number) => a + Math.random() * (b - a);
const dist = (a: V, b: V) => Math.hypot(a.x - b.x, a.y - b.y);

export class Game {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  W = 960; H = 720;
  keys = new Set<string>();
  mouse = { x: 480, y: 600, down: false };
  useMouse = false;

  player = { x: 480, y: 600, r: 16, inv: 0, fireCd: 0, bombCd: 0, bombs: 3, dashCd: 0, angle: -Math.PI / 2 };
  bullets: Bullet[] = [];
  enemies: Enemy[] = [];
  parts: Particle[] = [];
  pickups: Pickup[] = [];
  stars: Star[] = [];
  drones: { a: number }[] = [];

  spawnTimer = 0;
  waveEnemiesLeft = 0;
  waveActive = false;
  shake = 0;
  killStreakTimer = 0;
  vampCount = 0;
  bgIndex = 0;
  images: Record<string, HTMLImageElement> = {};
  raf = 0;
  last = 0;
  onUpdate: (s: GameState) => void;

  s: GameState = {
    status: 'menu', wave: 0, score: 0, hp: 100, maxHp: 100, shield: 0, maxShield: 0,
    xp: 0, xpNeed: 60, level: 1, weapon: 'blaster', unlocked: ['blaster'], combo: 1,
    bossName: null, bossHp: 0, bossMaxHp: 0, kills: 0, choices: [], perks: [],
    upgrades: {}, time: 0,
  };

  constructor(canvas: HTMLCanvasElement, onUpdate: (s: GameState) => void) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.onUpdate = onUpdate;
    for (let i = 0; i < 260; i++) this.stars.push({ x: Math.random() * this.W, y: Math.random() * this.H, z: Math.random(), s: rand(0.4, 2.2) });
    ['nebula1.jpg', 'nebula2.jpg', 'menu.jpg', 'boss.png'].forEach((f) => {
      const img = new Image();
      img.src = '/assets/' + f;
      this.images[f] = img;
    });
    this.bind();
  }

  emit() { this.onUpdate({ ...this.s }); }

  bind() {
    window.addEventListener('keydown', this.kd);
    window.addEventListener('keyup', this.ku);
    this.canvas.addEventListener('mousemove', this.mm);
    this.canvas.addEventListener('mousedown', this.md);
    window.addEventListener('mouseup', this.mu);
    this.canvas.addEventListener('touchstart', this.ts, { passive: false });
    this.canvas.addEventListener('touchmove', this.ts, { passive: false });
    this.canvas.addEventListener('touchend', this.te);
  }
  destroy() {
    cancelAnimationFrame(this.raf);
    window.removeEventListener('keydown', this.kd);
    window.removeEventListener('keyup', this.ku);
    this.canvas.removeEventListener('mousemove', this.mm);
    this.canvas.removeEventListener('mousedown', this.md);
    window.removeEventListener('mouseup', this.mu);
  }
  private pos(cx: number, cy: number) {
    const r = this.canvas.getBoundingClientRect();
    this.mouse.x = ((cx - r.left) / r.width) * this.W;
    this.mouse.y = ((cy - r.top) / r.height) * this.H;
  }
  kd = (e: KeyboardEvent) => {
    if ([' ', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) e.preventDefault();
    this.keys.add(e.key.toLowerCase());
    if (e.key === 'Escape' || e.key.toLowerCase() === 'p') this.togglePause();
    if (e.key.toLowerCase() === 'q') this.cycleWeapon();
    if (e.key.toLowerCase() === 'e') this.bomb();
    if (e.key.toLowerCase() === 'shift') this.dash();
    if (/^[1-6]$/.test(e.key)) {
      const w = this.s.unlocked[parseInt(e.key) - 1];
      if (w) { this.s.weapon = w; this.emit(); }
    }
  };
  ku = (e: KeyboardEvent) => this.keys.delete(e.key.toLowerCase());
  mm = (e: MouseEvent) => { this.useMouse = true; this.pos(e.clientX, e.clientY); };
  md = () => { this.mouse.down = true; sfx.ensure(); };
  mu = () => { this.mouse.down = false; };
  ts = (e: TouchEvent) => { e.preventDefault(); this.useMouse = true; this.mouse.down = true; const t = e.touches[0]; if (t) this.pos(t.clientX, t.clientY); };
  te = () => { this.mouse.down = false; };

  cycleWeapon() {
    const i = this.s.unlocked.indexOf(this.s.weapon);
    this.s.weapon = this.s.unlocked[(i + 1) % this.s.unlocked.length];
    this.emit();
  }

  up(id: string) { return this.s.upgrades[id] || 0; }
  hasPerk(id: string) { return this.s.perks.includes(id); }

  start() {
    this.s = {
      status: 'playing', wave: 0, score: 0, hp: 100, maxHp: 100, shield: 0, maxShield: 0,
      xp: 0, xpNeed: 60, level: 1, weapon: 'blaster', unlocked: ['blaster'], combo: 1,
      bossName: null, bossHp: 0, bossMaxHp: 0, kills: 0, choices: [], perks: [],
      upgrades: {}, time: 0,
    };
    this.bullets = []; this.enemies = []; this.parts = []; this.pickups = []; this.drones = [];
    this.player = { x: this.W / 2, y: this.H - 110, r: 16, inv: 1.5, fireCd: 0, bombCd: 0, bombs: 3, dashCd: 0, angle: -Math.PI / 2 };
    this.nextWave();
    this.last = performance.now();
    cancelAnimationFrame(this.raf);
    this.loop(this.last);
    this.emit();
  }

  togglePause() {
    if (this.s.status === 'playing') this.s.status = 'paused';
    else if (this.s.status === 'paused') { this.s.status = 'playing'; this.last = performance.now(); }
    this.emit();
  }

  nextWave() {
    this.s.wave++;
    this.bgIndex = Math.floor((this.s.wave - 1) / 5) % 2;
    const isBoss = this.s.wave % 5 === 0;
    if (isBoss) {
      const idx = Math.min(BOSSES.length - 1, Math.floor(this.s.wave / 5) - 1);
      this.spawnBoss(idx);
      this.waveEnemiesLeft = 0;
    } else {
      this.waveEnemiesLeft = 6 + Math.floor(this.s.wave * 2.2);
    }
    this.waveActive = true;
    this.emit();
  }

  spawnBoss(idx: number) {
    const d = BOSSES[idx];
    const mult = 1 + Math.floor(this.s.wave / 25) * 0.8;
    const e: Enemy = {
      x: this.W / 2, y: -140, vx: 60, vy: 40, hp: d.hp * mult, maxHp: d.hp * mult,
      def: { key: 'boss', name: d.name, hp: d.hp, speed: 60, radius: d.radius, score: 1200, color: d.color, fireRate: 0.5, behavior: 'turret' },
      t: 0, cd: 2, flash: 0, boss: true, bossIdx: idx, patternT: 0, patternI: 0, angle: 0,
    };
    this.enemies.push(e);
    this.s.bossName = d.name; this.s.bossMaxHp = e.maxHp; this.s.bossHp = e.hp;
    sfx.bigExplode();
  }

  spawnEnemy() {
    const tier = Math.min(ENEMIES.length, 1 + Math.floor(this.s.wave / 2));
    const def = ENEMIES[Math.floor(Math.random() * tier)];
    const scale = 1 + (this.s.wave - 1) * 0.16;
    this.enemies.push({
      x: rand(50, this.W - 50), y: rand(-160, -40), vx: rand(-40, 40), vy: def.speed * rand(0.7, 1.1),
      hp: def.hp * scale, maxHp: def.hp * scale, def, t: rand(0, 10), cd: rand(0.5, def.fireRate), flash: 0, angle: Math.PI / 2,
    });
  }

  boom(x: number, y: number, n: number, color: string, spd = 220, size = 3) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, s = rand(30, spd);
      this.parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: rand(0.3, 0.9), max: 0.9, color, size: rand(1, size) });
    }
  }

  fire(dt: number) {
    const p = this.player;
    p.fireCd -= dt;
    const shooting = this.mouse.down || this.keys.has(' ') || this.keys.has('z') || this.useMouse;
    if (!shooting || p.fireCd > 0) return;
    const w = WEAPONS[this.s.weapon];
    const rate = w.cooldown * Math.pow(0.9, this.up('rate'));
    p.fireCd = rate;
    let dmg = w.damage * Math.pow(1.15, this.up('damage'));
    if (this.hasPerk('overload') && this.s.hp < this.s.maxHp * 0.4) dmg *= 1.3;
    const crit = Math.random() < this.up('crit') * 0.08;
    if (crit) dmg *= 2.2;
    const mk = (ang: number, spd: number, r: number, pierce = 0, homing = false, big = false): Bullet => ({
      x: p.x, y: p.y - 10, vx: Math.cos(ang) * spd, vy: Math.sin(ang) * spd, r, dmg,
      color: crit ? '#fff176' : w.color, friendly: true, life: 3, pierce, homing, target: null, trail: [], big,
    });
    const base = -Math.PI / 2;
    switch (this.s.weapon) {
      case 'blaster':
        this.bullets.push(mk(base, w.speed, 4), mk(base, w.speed, 4));
        this.bullets[this.bullets.length - 1].x -= 12;
        this.bullets[this.bullets.length - 2].x += 12;
        sfx.shoot(); break;
      case 'spread':
        for (let i = -2; i <= 2; i++) this.bullets.push(mk(base + i * 0.17, w.speed, 5));
        sfx.shoot(); break;
      case 'laser':
        this.bullets.push(mk(base, w.speed, 3, 99));
        sfx.laser(); break;
      case 'missile': {
        const b1 = mk(base - 0.35, w.speed, 6, 0, true); const b2 = mk(base + 0.35, w.speed, 6, 0, true);
        b1.x -= 14; b2.x += 14; this.bullets.push(b1, b2); sfx.shoot(); break;
      }
      case 'plasma':
        this.bullets.push(mk(base, w.speed, 14, 2, false, true)); sfx.laser(); break;
      case 'railgun':
        this.bullets.push(mk(base, w.speed, 8, 99, false, true)); sfx.bigExplode(); this.shake = 8; break;
    }
    // drones
    this.drones.forEach((d) => {
      const dx = p.x + Math.cos(d.a) * 52, dy = p.y + Math.sin(d.a) * 52;
      this.bullets.push({ x: dx, y: dy, vx: 0, vy: -680, r: 3, dmg: dmg * 0.35, color: '#86efac', friendly: true, life: 2, pierce: 0, trail: [] });
    });
  }

  bomb() {
    if (this.s.status !== 'playing' || this.player.bombs <= 0) return;
    this.player.bombs--;
    this.shake = 22;
    sfx.bigExplode();
    this.boom(this.player.x, this.player.y, 160, '#fef08a', 520, 6);
    this.enemies.forEach((e) => this.damage(e, 260));
    this.bullets = this.bullets.filter((b) => b.friendly);
    this.emit();
  }

  dash() {
    if (this.player.dashCd > 0 || this.s.status !== 'playing') return;
    this.player.dashCd = 2.2;
    this.player.inv = Math.max(this.player.inv, 0.55);
    const sp = 260;
    const dx = (this.keys.has('d') || this.keys.has('arrowright') ? 1 : 0) - (this.keys.has('a') || this.keys.has('arrowleft') ? 1 : 0);
    this.player.x += dx * sp;
    this.boom(this.player.x, this.player.y, 20, '#67e8f9', 160, 2);
  }

  damage(e: Enemy, d: number) {
    e.hp -= d; e.flash = 0.12;
    if (e.boss) this.s.bossHp = Math.max(0, e.hp);
    if (e.hp <= 0) this.kill(e);
  }

  kill(e: Enemy) {
    const i = this.enemies.indexOf(e);
    if (i < 0) return;
    this.enemies.splice(i, 1);
    this.s.kills++;
    this.s.score += Math.round(e.def.score * this.s.combo);
    this.killStreakTimer = 2.5;
    this.s.combo = Math.min(9.9, this.s.combo + 0.05);
    if (e.boss) {
      sfx.bigExplode(); this.shake = 30;
      this.boom(e.x, e.y, 320, e.def.color, 480, 7);
      this.s.bossName = null;
      this.s.score += 2000;
      for (let i = 0; i < 12; i++) this.dropPickup(e.x + rand(-60, 60), e.y + rand(-60, 60), true);
      this.addXp(400);
      setTimeout(() => { if (this.s.status === 'playing' || this.s.status === 'levelup') this.nextWave(); }, 1600);
    } else {
      sfx.explode();
      this.boom(e.x, e.y, 26, e.def.color, 240, 4);
      this.addXp(8 + e.def.score * 0.4);
      if (this.hasPerk('nova')) {
        this.enemies.forEach((o) => { if (dist(o, e) < 110) this.damage(o, 45); });
        this.boom(e.x, e.y, 24, '#fca5a5', 300, 3);
      }
      if (this.hasPerk('vampire')) {
        this.vampCount++;
        if (this.vampCount >= 12) { this.vampCount = 0; this.s.hp = Math.min(this.s.maxHp, this.s.hp + 1); }
      }
      const chance = 0.18 * (this.hasPerk('fortune') ? 1.5 : 1);
      if (Math.random() < chance) this.dropPickup(e.x, e.y, false);
    }
    this.emit();
  }

  dropPickup(x: number, y: number, rich: boolean) {
    const r = Math.random();
    let kind: Pickup['kind'] = 'xp';
    if (r < 0.32) kind = 'hp';
    else if (r < 0.6) kind = 'shield';
    else if (r < 0.72) kind = 'bomb';
    else if (r < (rich ? 0.86 : 0.78)) kind = 'weapon';
    const locked = (Object.keys(WEAPONS) as WeaponId[]).filter((w) => !this.s.unlocked.includes(w));
    if (kind === 'weapon' && locked.length === 0) kind = 'hp';
    this.pickups.push({ x, y, vx: rand(-40, 40), vy: rand(-60, 20), kind, t: 0, w: locked[Math.floor(Math.random() * locked.length)] });
  }

  addXp(n: number) {
    this.s.xp += n;
    while (this.s.xp >= this.s.xpNeed) {
      this.s.xp -= this.s.xpNeed;
      this.s.level++;
      this.s.xpNeed = Math.round(this.s.xpNeed * 1.28 + 20);
      this.offerChoices();
    }
  }

  offerChoices() {
    const pool: GameState['choices'] = [];
    UPGRADES.forEach((u) => { if (this.up(u.id) < u.max) pool.push({ ...u, kind: 'up' }); });
    PERKS.forEach((p) => { if (!this.hasPerk(p.id)) pool.push({ ...p, kind: 'perk' }); });
    (Object.keys(WEAPONS) as WeaponId[]).forEach((w) => {
      if (!this.s.unlocked.includes(w)) pool.push({ id: w, name: 'VŨ KHÍ: ' + WEAPONS[w].name, desc: WEAPONS[w].desc, icon: WEAPONS[w].icon, kind: 'weapon' });
    });
    const picks: typeof pool = [];
    while (picks.length < 3 && pool.length) picks.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
    this.s.choices = picks;
    this.s.status = 'levelup';
    sfx.levelUp();
    this.emit();
  }

  choose(id: string) {
    const c = this.s.choices.find((x) => x.id === id);
    if (!c) return;
    if (c.kind === 'weapon') { this.s.unlocked.push(id as WeaponId); this.s.weapon = id as WeaponId; }
    else if (c.kind === 'perk') this.s.perks.push(id);
    else {
      this.s.upgrades[id] = (this.s.upgrades[id] || 0) + 1;
      if (id === 'hp') { this.s.maxHp += 25; this.s.hp += 25; }
      if (id === 'shield') { this.s.maxShield += 1; this.s.shield = this.s.maxShield; }
      if (id === 'drone') this.drones.push({ a: Math.random() * 6.28 });
    }
    this.s.choices = [];
    this.s.status = 'playing';
    this.last = performance.now();
    this.emit();
  }

  hurt(n: number) {
    if (this.player.inv > 0) return;
    if (this.s.shield > 0) { this.s.shield--; this.player.inv = 1.2; sfx.hit(); this.shake = 10; this.emit(); return; }
    this.s.hp -= n;
    this.s.combo = 1;
    this.player.inv = 1.0;
    this.shake = 14;
    sfx.hit();
    if (this.s.hp <= 0) {
      this.s.hp = 0;
      this.s.status = 'gameover';
      sfx.gameOver();
      this.boom(this.player.x, this.player.y, 200, '#fb923c', 400, 6);
      const best = Math.max(this.s.score, Number(localStorage.getItem('sn_best') || 0));
      localStorage.setItem('sn_best', String(best));
    }
    this.emit();
  }

  enemyShoot(e: Enemy, ang: number, spd: number, r = 6, color?: string) {
    const m = this.hasPerk('timewarp') ? 0.75 : 1;
    this.bullets.push({ x: e.x, y: e.y, vx: Math.cos(ang) * spd * m, vy: Math.sin(ang) * spd * m, r, dmg: e.boss ? 16 : 10, color: color || e.def.color, friendly: false, life: 6, pierce: 0, trail: [] });
  }

  updateBoss(e: Enemy, dt: number) {
    e.patternT! += dt;
    e.y += (140 - e.y) * dt * 0.8;
    e.x += e.vx * dt;
    if (e.x < 120 || e.x > this.W - 120) e.vx *= -1;
    const d = BOSSES[e.bossIdx!];
    const pat = d.patterns[e.patternI! % d.patterns.length];
    e.cd -= dt;
    const phase = e.hp / e.maxHp;
    const rate = phase < 0.35 ? 0.55 : phase < 0.7 ? 0.75 : 1;
    if (e.cd <= 0) {
      e.cd = 1.1 * rate;
      if (pat === 'spiral') {
        for (let i = 0; i < 10; i++) this.enemyShoot(e, e.t * 2.2 + (i * Math.PI * 2) / 10, 190, 7);
        e.cd = 0.24 * rate;
      } else if (pat === 'burst') {
        for (let i = 0; i < 22; i++) this.enemyShoot(e, (i * Math.PI * 2) / 22, 230, 6);
      } else if (pat === 'aimed') {
        const a = Math.atan2(this.player.y - e.y, this.player.x - e.x);
        for (let i = -3; i <= 3; i++) this.enemyShoot(e, a + i * 0.12, 330, 6, '#fde047');
        e.cd = 0.7 * rate;
      } else if (pat === 'wall') {
        const gap = Math.floor(rand(1, 11));
        for (let i = 0; i < 13; i++) if (Math.abs(i - gap) > 1) this.bullets.push({ x: (i / 12) * this.W, y: e.y, vx: 0, vy: 200, r: 9, dmg: 16, color: '#f97316', friendly: false, life: 8, pierce: 0, trail: [] });
        e.cd = 1.5 * rate;
      } else if (pat === 'laserSweep') {
        for (let i = 0; i < 6; i++) {
          const a = Math.PI / 2 + Math.sin(e.t * 1.5) * 0.9 + i * 0.05;
          this.enemyShoot(e, a, 420, 5, '#f472b6');
        }
        e.cd = 0.12 * rate;
      }
    }
    if (e.patternT! > 6) { e.patternT = 0; e.patternI!++; }
  }

  update(dt: number) {
    const s = this.s;
    s.time += dt;
    const p = this.player;
    // movement
    let mx = 0, my = 0;
    if (this.keys.has('a') || this.keys.has('arrowleft')) mx -= 1;
    if (this.keys.has('d') || this.keys.has('arrowright')) mx += 1;
    if (this.keys.has('w') || this.keys.has('arrowup')) my -= 1;
    if (this.keys.has('s') || this.keys.has('arrowdown')) my += 1;
    const spd = 330 * Math.pow(1.12, this.up('speed'));
    if (mx || my) {
      this.useMouse = false;
      const l = Math.hypot(mx, my);
      p.x += (mx / l) * spd * dt; p.y += (my / l) * spd * dt;
    } else if (this.useMouse) {
      p.x += (this.mouse.x - p.x) * Math.min(1, dt * 12);
      p.y += (this.mouse.y - p.y) * Math.min(1, dt * 12);
    }
    p.x = Math.max(20, Math.min(this.W - 20, p.x));
    p.y = Math.max(20, Math.min(this.H - 20, p.y));
    p.inv -= dt; p.dashCd -= dt;
    this.fire(dt);
    this.drones.forEach((d, i) => { d.a = s.time * 1.6 + (i * Math.PI * 2) / this.drones.length; });

    // combo decay
    this.killStreakTimer -= dt;
    if (this.killStreakTimer <= 0 && s.combo > 1) s.combo = Math.max(1, s.combo - dt * 0.4);

    // spawning
    if (this.waveEnemiesLeft > 0) {
      this.spawnTimer -= dt;
      if (this.spawnTimer <= 0 && this.enemies.length < 22) {
        this.spawnTimer = Math.max(0.18, 0.9 - s.wave * 0.02);
        this.spawnEnemy();
        this.waveEnemiesLeft--;
      }
    } else if (this.enemies.length === 0 && this.waveActive && !s.bossName) {
      this.waveActive = false;
      setTimeout(() => { if (this.s.status !== 'gameover') this.nextWave(); }, 900);
    }

    // enemies
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      e.t += dt; e.flash -= dt;
      if (e.boss) { this.updateBoss(e, dt); }
      else {
        switch (e.def.behavior) {
          case 'dive': e.y += e.vy * dt; e.x += Math.sin(e.t * 1.3) * 40 * dt; break;
          case 'sine': e.y += e.vy * 0.7 * dt; e.x += Math.sin(e.t * 3) * 140 * dt; break;
          case 'chase': {
            const a = Math.atan2(this.player.y - e.y, this.player.x - e.x);
            e.x += Math.cos(a) * e.def.speed * dt; e.y += Math.sin(a) * e.def.speed * 0.8 * dt; break;
          }
          case 'orbit': {
            const tx = this.W / 2 + Math.cos(e.t * 0.8) * 250, ty = 170 + Math.sin(e.t * 1.1) * 90;
            e.x += (tx - e.x) * dt * 0.9; e.y += (ty - e.y) * dt * 0.9; break;
          }
          case 'kamikaze': {
            const a = Math.atan2(this.player.y - e.y, this.player.x - e.x);
            e.vx += Math.cos(a) * 320 * dt; e.vy += Math.sin(a) * 320 * dt;
            const l = Math.hypot(e.vx, e.vy);
            if (l > e.def.speed) { e.vx = (e.vx / l) * e.def.speed; e.vy = (e.vy / l) * e.def.speed; }
            e.x += e.vx * dt; e.y += e.vy * dt; break;
          }
          case 'turret': e.y += e.vy * 0.35 * dt; e.x += Math.sin(e.t) * 30 * dt; break;
        }
        e.cd -= dt;
        if (e.cd <= 0 && e.y > 0 && e.def.behavior !== 'kamikaze') {
          e.cd = e.def.fireRate * rand(0.7, 1.3);
          const a = Math.atan2(this.player.y - e.y, this.player.x - e.x);
          if (e.def.behavior === 'turret') { for (let k = -1; k <= 1; k++) this.enemyShoot(e, a + k * 0.22, 250); }
          else this.enemyShoot(e, a, 230);
        }
      }
      if (e.y > this.H + 120 || e.x < -200 || e.x > this.W + 200) { if (!e.boss) this.enemies.splice(i, 1); continue; }
      if (dist(e, p) < e.def.radius + p.r) {
        if (this.hasPerk('thorns')) this.damage(e, 40);
        this.hurt(e.boss ? 25 : 14);
        if (!e.boss && e.def.behavior === 'kamikaze') this.kill(e);
      }
    }

    // bullets
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const b = this.bullets[i];
      if (b.homing) {
        if (!b.target || !this.enemies.includes(b.target)) {
          let best: Enemy | null = null, bd = 1e9;
          this.enemies.forEach((e) => { const d = dist(e, b); if (d < bd) { bd = d; best = e; } });
          b.target = best;
        }
        if (b.target) {
          const a = Math.atan2(b.target.y - b.y, b.target.x - b.x);
          const sp = Math.hypot(b.vx, b.vy);
          b.vx += Math.cos(a) * sp * 3.5 * dt; b.vy += Math.sin(a) * sp * 3.5 * dt;
          const l = Math.hypot(b.vx, b.vy);
          b.vx = (b.vx / l) * sp; b.vy = (b.vy / l) * sp;
        }
      }
      b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;
      b.trail.push({ x: b.x, y: b.y });
      if (b.trail.length > 6) b.trail.shift();
      if (b.life <= 0 || b.x < -40 || b.x > this.W + 40 || b.y < -40 || b.y > this.H + 40) { this.bullets.splice(i, 1); continue; }
      if (b.friendly) {
        for (const e of this.enemies) {
          if (dist(e, b) < e.def.radius + b.r) {
            this.damage(e, b.dmg);
            this.parts.push({ x: b.x, y: b.y, vx: 0, vy: 0, life: 0.2, max: 0.2, color: '#fff', size: 4 });
            if (b.pierce > 0) b.pierce--; else { this.bullets.splice(i, 1); }
            break;
          }
        }
      } else if (dist(b, p) < p.r + b.r) {
        this.bullets.splice(i, 1);
        this.hurt(b.dmg);
      }
    }

    // pickups
    const magnet = 90 * (1 + this.up('magnet') * 0.4);
    for (let i = this.pickups.length - 1; i >= 0; i--) {
      const k = this.pickups[i];
      k.t += dt;
      const d = dist(k, p);
      if (d < magnet) {
        const a = Math.atan2(p.y - k.y, p.x - k.x);
        k.vx += Math.cos(a) * 900 * dt; k.vy += Math.sin(a) * 900 * dt;
      }
      k.vy += 30 * dt;
      k.vx *= 0.99; k.vy *= 0.99;
      k.x += k.vx * dt; k.y += k.vy * dt;
      if (k.y > this.H + 40) { this.pickups.splice(i, 1); continue; }
      if (d < p.r + 14) {
        this.pickups.splice(i, 1);
        sfx.pickup();
        if (k.kind === 'hp') s.hp = Math.min(s.maxHp, s.hp + 22);
        else if (k.kind === 'shield') s.shield = Math.min(Math.max(1, s.maxShield), s.shield + 1);
        else if (k.kind === 'bomb') this.player.bombs++;
        else if (k.kind === 'xp') this.addXp(30);
        else if (k.kind === 'weapon' && k.w && !s.unlocked.includes(k.w)) { s.unlocked.push(k.w); s.weapon = k.w; }
        this.emit();
      }
    }

    // particles
    for (let i = this.parts.length - 1; i >= 0; i--) {
      const q = this.parts[i];
      q.life -= dt; q.x += q.vx * dt; q.y += q.vy * dt; q.vx *= 0.96; q.vy *= 0.96;
      if (q.life <= 0) this.parts.splice(i, 1);
    }
    // stars
    this.stars.forEach((st) => {
      st.y += (30 + st.z * 180) * dt;
      if (st.y > this.H) { st.y = -4; st.x = Math.random() * this.W; }
    });
    if (this.shake > 0) this.shake = Math.max(0, this.shake - dt * 45);
  }

  draw() {
    const c = this.ctx, { W, H } = this;
    c.save();
    if (this.shake > 0) c.translate(rand(-this.shake, this.shake), rand(-this.shake, this.shake));
    const bg = this.images[this.bgIndex === 0 ? 'nebula1.jpg' : 'nebula2.jpg'];
    c.fillStyle = '#05060f'; c.fillRect(-40, -40, W + 80, H + 80);
    if (bg && bg.complete) { c.globalAlpha = 0.5; c.drawImage(bg, 0, 0, W, H); c.globalAlpha = 1; }
    this.stars.forEach((st) => {
      c.fillStyle = `rgba(255,255,255,${0.2 + st.z * 0.8})`;
      c.fillRect(st.x, st.y, st.s, st.s * 2.5);
    });

    // pickups
    this.pickups.forEach((k) => {
      const col = k.kind === 'hp' ? '#f87171' : k.kind === 'shield' ? '#60a5fa' : k.kind === 'bomb' ? '#fbbf24' : k.kind === 'weapon' ? '#a78bfa' : '#4ade80';
      c.save(); c.translate(k.x, k.y); c.rotate(k.t * 2);
      c.shadowBlur = 18; c.shadowColor = col; c.fillStyle = col;
      c.fillRect(-7, -7, 14, 14);
      c.restore();
      c.fillStyle = '#000'; c.font = '10px monospace'; c.textAlign = 'center';
      c.fillText(k.kind === 'hp' ? '+' : k.kind === 'shield' ? 'S' : k.kind === 'bomb' ? 'B' : k.kind === 'weapon' ? 'W' : 'X', k.x, k.y + 3.5);
    });

    // enemies
    this.enemies.forEach((e) => {
      c.save(); c.translate(e.x, e.y);
      if (e.boss) {
        const img = this.images['boss.png'];
        const r = e.def.radius;
        c.shadowBlur = 40; c.shadowColor = e.def.color;
        if (img && img.complete) {
          c.globalCompositeOperation = 'lighter';
          c.drawImage(img, -r * 1.8, -r * 1.8, r * 3.6, r * 3.6);
          c.globalCompositeOperation = 'source-over';
        } else { c.fillStyle = e.def.color; c.beginPath(); c.arc(0, 0, r, 0, 7); c.fill(); }
        c.shadowBlur = 0;
        c.strokeStyle = e.flash > 0 ? '#fff' : e.def.color;
        c.lineWidth = 3; c.beginPath(); c.arc(0, 0, r, 0, 7); c.stroke();
      } else {
        c.rotate(Math.PI);
        c.shadowBlur = 14; c.shadowColor = e.def.color;
        c.fillStyle = e.flash > 0 ? '#ffffff' : e.def.color;
        const r = e.def.radius;
        c.beginPath();
        c.moveTo(0, r); c.lineTo(r * 0.85, -r * 0.6); c.lineTo(0, -r * 0.2); c.lineTo(-r * 0.85, -r * 0.6);
        c.closePath(); c.fill();
        c.shadowBlur = 0;
        if (e.hp < e.maxHp) {
          c.rotate(Math.PI);
          c.fillStyle = '#00000088'; c.fillRect(-r, -r - 10, r * 2, 4);
          c.fillStyle = '#4ade80'; c.fillRect(-r, -r - 10, r * 2 * (e.hp / e.maxHp), 4);
        }
      }
      c.restore();
    });

    // bullets
    this.bullets.forEach((b) => {
      c.save();
      c.shadowBlur = b.big ? 26 : 12; c.shadowColor = b.color;
      c.strokeStyle = b.color; c.lineWidth = b.r;
      if (b.trail.length > 1) {
        c.globalAlpha = 0.45; c.beginPath();
        c.moveTo(b.trail[0].x, b.trail[0].y);
        b.trail.forEach((t) => c.lineTo(t.x, t.y));
        c.stroke(); c.globalAlpha = 1;
      }
      c.fillStyle = b.color;
      c.beginPath(); c.arc(b.x, b.y, b.r, 0, 7); c.fill();
      if (!b.friendly) { c.fillStyle = '#ffffffaa'; c.beginPath(); c.arc(b.x, b.y, b.r * 0.4, 0, 7); c.fill(); }
      c.restore();
    });

    // particles
    this.parts.forEach((q) => {
      c.globalAlpha = Math.max(0, q.life / q.max);
      c.fillStyle = q.color;
      c.fillRect(q.x - q.size / 2, q.y - q.size / 2, q.size, q.size);
    });
    c.globalAlpha = 1;

    // player
    if (this.s.status !== 'gameover') {
      const p = this.player;
      c.save(); c.translate(p.x, p.y);
      if (p.inv > 0 && Math.floor(p.inv * 20) % 2 === 0) c.globalAlpha = 0.35;
      // thruster
      c.fillStyle = '#38bdf8';
      c.shadowBlur = 20; c.shadowColor = '#0ea5e9';
      c.beginPath();
      c.moveTo(0, -22); c.lineTo(15, 16); c.lineTo(0, 9); c.lineTo(-15, 16);
      c.closePath(); c.fill();
      c.fillStyle = '#e0f2fe';
      c.beginPath(); c.moveTo(0, -16); c.lineTo(6, 6); c.lineTo(-6, 6); c.closePath(); c.fill();
      const fl = rand(8, 20);
      c.shadowColor = '#f59e0b'; c.fillStyle = '#fbbf24';
      c.beginPath(); c.moveTo(-6, 12); c.lineTo(0, 12 + fl); c.lineTo(6, 12); c.closePath(); c.fill();
      c.shadowBlur = 0;
      if (this.s.shield > 0) {
        c.strokeStyle = `rgba(96,165,250,${0.4 + 0.2 * Math.sin(this.s.time * 6)})`;
        c.lineWidth = 3; c.beginPath(); c.arc(0, 0, 30, 0, 7); c.stroke();
      }
      c.restore();
      this.drones.forEach((d) => {
        const dx = p.x + Math.cos(d.a) * 52, dy = p.y + Math.sin(d.a) * 52;
        c.fillStyle = '#86efac'; c.shadowBlur = 12; c.shadowColor = '#22c55e';
        c.beginPath(); c.arc(dx, dy, 7, 0, 7); c.fill(); c.shadowBlur = 0;
      });
    }
    c.restore();
  }

  loop = (t: number) => {
    this.raf = requestAnimationFrame(this.loop);
    const dt = Math.min(0.05, (t - this.last) / 1000);
    this.last = t;
    if (this.s.status === 'playing') this.update(dt);
    this.draw();
  };
}
