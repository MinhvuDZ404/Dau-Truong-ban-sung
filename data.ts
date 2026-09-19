export type WeaponId = 'blaster' | 'spread' | 'laser' | 'missile' | 'plasma' | 'railgun';

export interface WeaponDef {
  id: WeaponId;
  name: string;
  desc: string;
  color: string;
  cooldown: number;
  damage: number;
  speed: number;
  icon: string;
}

export const WEAPONS: Record<WeaponId, WeaponDef> = {
  blaster: { id: 'blaster', name: 'Blaster', desc: 'Súng bắn nhanh cơ bản', color: '#7dd3fc', cooldown: 0.16, damage: 10, speed: 760, icon: '🔫' },
  spread:  { id: 'spread',  name: 'Spread Gun', desc: 'Bắn 5 tia toả rộng', color: '#fbbf24', cooldown: 0.3, damage: 8, speed: 640, icon: '🌟' },
  laser:   { id: 'laser',   name: 'Laser Beam', desc: 'Tia xuyên thấu liên tục', color: '#f472b6', cooldown: 0.05, damage: 3.2, speed: 1400, icon: '⚡' },
  missile: { id: 'missile', name: 'Tên lửa dò', desc: 'Tự bám mục tiêu, nổ mạnh', color: '#fb7185', cooldown: 0.55, damage: 34, speed: 420, icon: '🚀' },
  plasma:  { id: 'plasma',  name: 'Plasma Orb', desc: 'Cầu plasma lớn, sát thương cao', color: '#a78bfa', cooldown: 0.5, damage: 40, speed: 420, icon: '🔮' },
  railgun: { id: 'railgun', name: 'Railgun', desc: 'Xuyên toàn bộ màn hình', color: '#22d3ee', cooldown: 0.9, damage: 90, speed: 2200, icon: '💥' },
};

export interface EnemyDef {
  key: string;
  name: string;
  hp: number;
  speed: number;
  radius: number;
  score: number;
  color: string;
  fireRate: number;
  behavior: 'dive' | 'sine' | 'chase' | 'orbit' | 'kamikaze' | 'turret';
}

export const ENEMIES: EnemyDef[] = [
  { key: 'scout',    name: 'Scout',     hp: 22,  speed: 110, radius: 15, score: 10,  color: '#4ade80', fireRate: 2.4, behavior: 'dive' },
  { key: 'weaver',   name: 'Weaver',    hp: 34,  speed: 95,  radius: 17, score: 18,  color: '#38bdf8', fireRate: 2.0, behavior: 'sine' },
  { key: 'hunter',   name: 'Hunter',    hp: 55,  speed: 80,  radius: 19, score: 28,  color: '#f59e0b', fireRate: 1.6, behavior: 'chase' },
  { key: 'orbiter',  name: 'Orbiter',   hp: 70,  speed: 70,  radius: 20, score: 36,  color: '#c084fc', fireRate: 1.3, behavior: 'orbit' },
  { key: 'kamikaze', name: 'Kamikaze',  hp: 26,  speed: 230, radius: 14, score: 30,  color: '#ef4444', fireRate: 99,  behavior: 'kamikaze' },
  { key: 'turret',   name: 'Gun Barge', hp: 130, speed: 35,  radius: 26, score: 60,  color: '#94a3b8', fireRate: 1.0, behavior: 'turret' },
];

export interface BossDef {
  name: string;
  hp: number;
  radius: number;
  patterns: string[];
  color: string;
}

export const BOSSES: BossDef[] = [
  { name: 'DREADNOUGHT ZERO', hp: 1400,  radius: 70, patterns: ['spiral', 'burst'], color: '#ef4444' },
  { name: 'VOID SERAPH',      hp: 2600,  radius: 80, patterns: ['spiral', 'aimed', 'wall'], color: '#a855f7' },
  { name: 'IRON LEVIATHAN',   hp: 4200,  radius: 92, patterns: ['wall', 'burst', 'laserSweep'], color: '#f59e0b' },
  { name: 'OMEGA NEXUS',      hp: 7000,  radius: 105, patterns: ['spiral', 'wall', 'aimed', 'laserSweep'], color: '#22d3ee' },
  { name: 'THE DEVOURER',     hp: 11000, radius: 120, patterns: ['spiral', 'wall', 'aimed', 'burst', 'laserSweep'], color: '#f43f5e' },
];

export interface UpgradeDef {
  id: string;
  name: string;
  desc: string;
  icon: string;
  max: number;
}

export const UPGRADES: UpgradeDef[] = [
  { id: 'damage',  name: 'Nòng cường hoá', desc: '+15% sát thương', icon: '🗡️', max: 12 },
  { id: 'rate',    name: 'Nạp đạn nhanh',  desc: '-10% hồi chiêu', icon: '⏱️', max: 10 },
  { id: 'speed',   name: 'Động cơ ion',    desc: '+12% tốc độ bay', icon: '🛞', max: 8 },
  { id: 'shield',  name: 'Khiên plasma',   desc: '+1 lớp khiên', icon: '🛡️', max: 6 },
  { id: 'hp',      name: 'Giáp titan',     desc: '+25 máu tối đa', icon: '❤️', max: 10 },
  { id: 'drone',   name: 'Drone hộ tống',  desc: '+1 drone bắn phụ', icon: '🛸', max: 4 },
  { id: 'magnet',  name: 'Nam châm',       desc: '+40% bán kính hút', icon: '🧲', max: 6 },
  { id: 'crit',    name: 'Ngắm chí mạng',  desc: '+8% tỉ lệ chí mạng', icon: '🎯', max: 8 },
];

export const PERKS = [
  { id: 'vampire', name: 'Hút máu', desc: 'Hồi 1 HP mỗi 12 địch tiêu diệt', icon: '🩸' },
  { id: 'thorns', name: 'Phản đòn', desc: 'Kẻ địch va chạm nhận 40 sát thương', icon: '🌵' },
  { id: 'nova', name: 'Nova nổ', desc: 'Kẻ địch chết phát nổ nhỏ', icon: '💫' },
  { id: 'timewarp', name: 'Bẻ cong thời gian', desc: 'Đạn địch chậm 25%', icon: '⏳' },
  { id: 'overload', name: 'Quá tải', desc: '+30% sát thương khi HP < 40%', icon: '🔥' },
  { id: 'fortune', name: 'May mắn', desc: '+50% vật phẩm rơi ra', icon: '🍀' },
];
