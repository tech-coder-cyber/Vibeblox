import { useState, useEffect, useRef, useMemo, type FormEvent, type ChangeEvent, type MouseEvent as ReactMouseEvent, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from 'react';
import { SKINS, CAPES, type PlayerLook } from '@/cosmetics';
import { CAN_LINK_OUT, CAN_SELL_RANKS, ADS_POSSIBLE, PLATFORM, initAds, triggerRewardedAd, setGameplayActive, reportLoadingFinished } from '@/adEconomy';
import {
  getProgress, subscribeProgress, onLevelUp, addActiveSeconds, rewardAdCoins, rewardAdBooster, buyCosmetic, equipCosmetic, currentLook, reloadProgress,
  xpForLevel, DISCORD_INVITE_URL, TEBEX_STORE_URL, AD_COINS, LEVEL_UP_COINS, XP_PER_PERIOD, SECONDS_PER_PERIOD, BOOSTER_SECONDS, IDLE_AFTER_SECONDS,
} from '@/progression';
import { ModBuilder } from '@/ModBuilder';
import { parseModCode } from '@/modBuilderLogic';
import { createVoxelGame, type GameWorldMode, type GraphicsQuality, type Recipe, type PlayMode, type DebugInfo, type WorldType, type Slots, type ItemStack, type SaveData, isWater, isLava, BLOCK_WATER, BLOCK_LAVA, BLOCK_GRASS, BLOCK_DIRT, BLOCK_STONE, ARMOR, ARMOR_PIECES, CUSTOM_ITEMS, CUSTOM_BLOCKS, customIdForKey, registerCustomItem, registerCustomBlock, createPlayerPreview, drawLookPreview, getTexturePreviews, setTextureResolution, type TextureRes, type DimensionSpec, type TextureSpec, maxStack, addToSlots, countInSlots, emptySlots, INVENTORY_SIZE, ITEM_INFO, RECIPES, getItemIconURL, matchRecipe, SMELTING, FUEL_SECONDS, isBlockId } from '@/voxelGame';
import * as THREE from 'three';
import { ScriptRunner, OFFICIAL_MODS, SCRIPT_EXAMPLES, SCRIPT_API_HELP, AI_MODELS, checkApiUsage, type Mod, type AiMode, type AiTurn } from '@/scripting';
import { requestAssistant, parseSearchReplace, applySearchReplace, type AiMeta } from '@/aiAssistant';

// Multiplayer is optional: Vite only includes src/multiplayer.ts if the file
// exists, so deleting it (or the server folder) never breaks the game.
const multiplayerModules = import.meta.glob('./multiplayer.ts');
const multiplayerAvailable = Object.keys(multiplayerModules).length > 0;
type NetBlock = [number, number, number, number];
type NetPlayerInfo = { id: number; name: string; x: number; y: number; z: number; yaw: number; pitch: number; mode: string; look?: PlayerLook };
type Welcome = { id: number; name: string; seed: number; worldType: 'default' | 'superflat'; mode: string; time: number; changes: NetBlock[]; players: NetPlayerInfo[] };
type MpEvents = {
  onWelcome?: (w: Welcome) => void;
  onBlocks?: (list: NetBlock[]) => void;
  onMoves?: (list: Array<[number, number, number, number, number, number, string, number, number]>) => void;
  onJoin?: (id: number, name: string) => void;
  onLeave?: (id: number, name: string) => void;
  onLook?: (id: number, look: PlayerLook) => void;
  onChat?: (name: string, text: string) => void;
  onSystem?: (text: string) => void;
  onTime?: (time: number) => void;
  onClose?: (reason: string) => void;
};
type MpClient = {
  events: MpEvents;
  connected: boolean;
  connect(url: string, name: string): void;
  sendMove(x: number, y: number, z: number, yaw: number, pitch: number, mode: string, held?: number, act?: number): void;
  sendBlocks(list: NetBlock[]): void;
  sendChat(text: string): void;
  sendLook(look: PlayerLook): void;
  disconnect(): void;
};

// ---------------- Remembered settings ----------------
type SavedSettings = {
  renderDistance?: number; graphicsQuality?: GraphicsQuality; fov?: number; sfxVolume?: number;
  hudPrefs?: HudPrefs; craftMode?: 'grid' | 'quick'; volume?: number; textureRes?: TextureRes;
};
const savedSettings: SavedSettings = (() => {
  try { return JSON.parse(localStorage.getItem('vb-settings') ?? '{}') as SavedSettings; } catch { return {}; }
})();
// Textures must be set before anything is drawn, so this runs right away
setTextureResolution(savedSettings.textureRes === 32 ? 32 : 16);
import {
  Settings,
  Users,
  MessageSquare,
  Globe,
  Trophy,
  ShoppingBag,
  BarChart3,
  Play,
  Coins,
  ChevronRight,
  ChevronLeft,
  User,
  Mail,
  Lock,
  Gamepad2,
  Home,
  Check,
  Crown,
  Shield,
  Zap,
  Plus,
  Swords,
  Palette,
  Map,
  Music,
  Pause,
  Heart,
  Drumstick,
  ScrollText,
  Package,
  LogOut,
  Tv,
  Shirt,
  Sparkles,
} from 'lucide-react';

type View = 'home' | 'shop' | 'settings' | 'create-world' | 'servers' | 'planets';
type GameMode = 'menu' | 'playing';

type NavItem = {
  label: string;
  icon: typeof Settings;
  view?: View;
  href?: 'discord'; // opens our Discord invite instead of a page
};

const navItems: NavItem[] = [
  { label: 'Home', icon: Home, view: 'home' },
  { label: 'Servers', icon: Gamepad2, view: 'servers' },
  { label: 'Settings', icon: Settings, view: 'settings' },
  { label: 'Social', icon: Users },
  { label: 'Messages', icon: MessageSquare },
  { label: 'Planets', icon: Globe, view: 'planets' },
  { label: 'Achievements', icon: Trophy },
  { label: 'Shop', icon: ShoppingBag, view: 'shop' },
  { label: 'Discord', icon: MessageSquare, href: 'discord' },
];

type GameCard = {
  title: string;
  players: string;
  image: string;
  tag: string;
  accent: string;
};

const games: GameCard[] = [
  {
    title: 'Survival',
    players: '4,290 playing',
    image: '/images/survival-bg.jpg',
    tag: 'PvE',
    accent: 'from-orange-500 to-red-500',
  },
  {
    title: 'EggWars',
    players: '2,140 playing',
    image: '/images/eggwars-bg.jpg',
    tag: 'Team',
    accent: 'from-pink-500 to-purple-500',
  },
  {
    title: 'Superflat',
    players: '890 playing',
    image: '/images/superflat-bg.jpg',
    tag: 'Build',
    accent: 'from-sky-500 to-cyan-500',
  },
  {
    title: 'Creative',
    players: '5,672 playing',
    image: '/images/creative-bg.jpg',
    tag: 'Sandbox',
    accent: 'from-emerald-500 to-teal-500',
  },
  {
    title: 'OneBlock',
    players: '3,501 playing',
    image: '/images/oneblock-bg.jpg',
    tag: 'Solo',
    accent: 'from-amber-500 to-orange-500',
  },
  {
    title: 'Bridge Duels',
    players: '1,220 playing',
    image: '/images/bridgeduels-bg.jpg',
    tag: 'PvP',
    accent: 'from-blue-500 to-indigo-500',
  },
];

const xpCurrent = 7400;
const xpNext = 10000;
const xpPercent = (xpCurrent / xpNext) * 100;

const STORAGE_KEY = 'vibeblox_username';

function getInitialUsername(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

type RankTier = {
  name: string;
  price: string;
  priceValue: number;
  icon: typeof Shield;
  perks: string[];
  borderClass: string;
  accentText: string;
  iconBg: string;
  featured?: boolean;
};

const rankTiers: RankTier[] = [
  {
    name: 'VANGUARD',
    price: '$5',
    priceValue: 5,
    icon: Shield,
    perks: ['Custom Chat Tag', '2ms CPU script budget framework'],
    borderClass: 'vb-border-copper border-2',
    accentText: 'text-[#e8a87c]',
    iconBg: 'from-[#b87333] to-[#8b5a2b]',
  },
  {
    name: 'ELITE',
    price: '$15',
    priceValue: 15,
    icon: Zap,
    perks: ['Reflective linear gradient text colors', '25ms CPU script budget', '+100 daily AI terminal calls'],
    borderClass: 'vb-border-neon-cyan border-2',
    accentText: 'text-[#00e5ff]',
    iconBg: 'from-[#00e5ff] to-[#00b8d4]',
    featured: true,
  },
  {
    name: 'CHAMPION',
    price: '$30',
    priceValue: 30,
    icon: Crown,
    perks: ['Animated molten magma chat tags', 'Cosmic floating chat tags', '75ms CPU script budget', 'Unlimited AI terminal access'],
    borderClass: 'vb-border-plasma',
    accentText: 'text-[#ffd700]',
    iconBg: 'from-[#ffd700] to-[#ff8c00]',
  },
];
function AuthModal({ onClose }: { onClose: (username: string) => void }) {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!username.trim() || !email.trim() || !password.trim()) {
      setError('All fields are required.');
      return;
    }
    if (!email.includes('@') || password.length < 4) {
      setError('Invalid email or short password.');
      return;
    }
    try { localStorage.setItem(STORAGE_KEY, username.trim()); } catch {}
    onClose(username.trim());
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="relative w-full max-w-md mx-4 bg-[#121822] rounded-2xl border border-[#243044] shadow-2xl p-6">
        <h2 className="font-[var(--font-retro)] text-sm text-white mb-4">VibeBlox Sign In</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Username" className="w-full bg-[#0a0e14] border border-[#243044] rounded-xl p-3 text-white text-sm" />
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" className="w-full bg-[#0a0e14] border border-[#243044] rounded-xl p-3 text-white text-sm" />
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" className="w-full bg-[#0a0e14] border border-[#243044] rounded-xl p-3 text-white text-sm" />
          {error && <p className="text-red-400 text-xs">{error}</p>}
          <button type="submit" className="w-full py-3 rounded-xl bg-[#00e676] text-[#0a0e14] font-bold">START PLAYING</button>
        </form>
      </div>
    </div>
  );
}

function DiscordIcon({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
      <path d="M20.3 4.4A19.6 19.6 0 0 0 15.4 3l-.6 1.3a18.2 18.2 0 0 0-5.6 0L8.6 3a19.6 19.6 0 0 0-4.9 1.4C.6 9 0 13.5.3 18a19.8 19.8 0 0 0 6 3l1.3-2.1c-.7-.3-1.4-.6-2-1l.5-.4a14 14 0 0 0 11.8 0l.5.4c-.6.4-1.3.7-2 1l1.3 2.1a19.7 19.7 0 0 0 6-3c.4-5.2-.7-9.7-3.4-13.6ZM8.7 15.3c-1.2 0-2.1-1.1-2.1-2.4s.9-2.4 2.1-2.4 2.1 1.1 2.1 2.4-.9 2.4-2.1 2.4Zm6.6 0c-1.2 0-2.1-1.1-2.1-2.4s.9-2.4 2.1-2.4 2.1 1.1 2.1 2.4-.9 2.4-2.1 2.4Z" />
    </svg>
  );
}

/** Big "Join our Discord" banner on the home screen. Hidden on Poki, which forbids outgoing links. */
function DiscordBanner() {
  if (!CAN_LINK_OUT) return null;
  return (
    <a
      href={DISCORD_INVITE_URL}
      target="_blank"
      rel="noopener noreferrer"
      className="group mb-6 flex items-center gap-4 rounded-2xl px-5 py-4 bg-gradient-to-r from-[#5865F2] to-[#7983f5] text-white shadow-[0_0_30px_rgba(88,101,242,0.45)] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_0_45px_rgba(88,101,242,0.7)]"
    >
      <span className="relative flex h-12 w-12 items-center justify-center rounded-xl bg-white/15">
        <span className="absolute inset-0 rounded-xl bg-white/20 animate-ping" />
        <DiscordIcon className="relative w-7 h-7" />
      </span>
      <span className="flex-1">
        <span className="block font-[var(--font-display)] text-lg leading-tight">Join Our Discord Community!</span>
        <span className="block text-white/80 text-sm">Show off your builds, share scripts and mods, and get update news first.</span>
      </span>
      <span className="rounded-xl bg-white text-[#5865F2] font-bold text-sm px-4 py-2 transition-transform group-hover:scale-105">Join</span>
    </a>
  );
}

function Sidebar({ username, view, onNavClick }: { username: string; view: View; onNavClick: (v: View) => void }) {
  const initial = username ? username.charAt(0).toUpperCase() : 'P';
  return (
    <nav className="w-20 shrink-0 bg-[#0d131b] border-r border-[#243044] flex flex-col items-center py-6 gap-2">
      <div className="mb-6"><img src="/images/logo.png" alt="VibeBlox" className="w-11 h-11 rounded-xl" /></div>
      <div className="flex flex-col gap-1.5 flex-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = item.view ? item.view === view : false;
          return (
            <button
              key={item.label}
              onClick={() => { if (item.href === 'discord') window.open(DISCORD_INVITE_URL, '_blank', 'noopener,noreferrer'); else if (item.view) onNavClick(item.view); }}
              className={`relative w-12 h-12 rounded-xl flex flex-col items-center justify-center text-[8px] transition-all duration-200 ease-out hover:scale-110 active:scale-95 ${
                isActive
                  ? 'bg-[#00e676]/15 text-[#00e676]'
                  : 'text-[#5a6b80] hover:text-white hover:bg-[#1a2230]'
              }`}
            >
              <Icon className="w-5 h-5 mb-0.5 transition-transform duration-200" />{item.label}
            </button>
          );
        })}
      </div>
      {CAN_LINK_OUT && (
        <a
          href={DISCORD_INVITE_URL}
          target="_blank"
          rel="noopener noreferrer"
          title="Join Our Discord Community!"
          className="relative mb-3 w-14 h-14 rounded-2xl bg-[#5865F2] text-white flex flex-col items-center justify-center text-[8px] font-bold shadow-[0_0_18px_rgba(88,101,242,0.75)] transition-all duration-200 hover:scale-110 active:scale-95"
        >
          <span className="absolute inset-0 rounded-2xl ring-2 ring-[#8f98ff] animate-pulse" />
          <DiscordIcon className="w-6 h-6 mb-0.5" />
          DISCORD
        </a>
      )}
      <div className="w-10 h-10 rounded-full bg-[#00e676] flex items-center justify-center text-[#0a0e14] font-bold">{initial}</div>
    </nav>
  );
}

function ThreeDLogo() {
  const containerRef = useRef<HTMLDivElement>(null);
  const isHovered = useRef(false);

  useEffect(() => {
    if (!containerRef.current) return;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 10);
    camera.position.z = 2.0;

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setSize(52, 52);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setClearColor(0x000000, 0); 
    containerRef.current.appendChild(renderer.domElement);

    const ambientLight = new THREE.AmbientLight(0xffffff, 1.0);
    scene.add(ambientLight);

    const textureLoader = new THREE.TextureLoader();
    const logoTexture = textureLoader.load('/images/logo.png', 
      (tex) => {
        tex.colorSpace = THREE.SRGBColorSpace;
        
        // 💎 CRYSTAL CLEAR FIX: Stops the blurriness and makes the voxel artwork razor sharp!
        tex.magFilter = THREE.NearestFilter;
        tex.minFilter = THREE.NearestFilter;
        
        tex.needsUpdate = true;
      },
      undefined,
      () => {
        logoTexture.image = textureLoader.load('/logo.png').image;
      }
    );

    const material = new THREE.SpriteMaterial({ 
      map: logoTexture,
      transparent: true,
      color: 0xffffff
    });
    
    const sprite = new THREE.Sprite(material);
    sprite.scale.set(1.1, 1.1, 1);
    scene.add(sprite);

    let animationFrameId: number;
    let targetRotationY = 0;
    let currentRotationY = 0;

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      
      if (isHovered.current) {
        targetRotationY += 0.04; // Earth-style rotation speed on hover
      } else {
        targetRotationY += 0.002; 
      }

      currentRotationY += (targetRotationY - currentRotationY) * 0.1;
      sprite.rotation.z = -currentRotationY;

      renderer.render(scene, camera);
    };
    animate();

    const handleMouseEnter = () => { isHovered.current = true; };
    const handleMouseLeave = () => { isHovered.current = false; };

    const el = containerRef.current;
    el.addEventListener('mouseenter', handleMouseEnter);
    el.addEventListener('mouseleave', handleMouseLeave);

    return () => {
      cancelAnimationFrame(animationFrameId);
      if (el) {
        el.removeEventListener('mouseenter', handleMouseEnter);
        el.removeEventListener('mouseleave', handleMouseLeave);
        if (renderer.domElement && el.contains(renderer.domElement)) {
          el.removeChild(renderer.domElement);
        }
      }
      material.dispose();
      renderer.dispose();
    };
  }, []);

  return (
    <div 
      ref={containerRef} 
      className="w-12 h-12 flex items-center justify-center transition-transform duration-300 hover:scale-110 cursor-pointer" 
    />
  );
}

function GameCardItem({ game, onPlay }: { game: GameCard; onPlay?: () => void }) {
  return (
    <button
      onClick={onPlay}
      className="group relative bg-[#121822] rounded-2xl overflow-hidden border border-[#243044] hover:border-[#364860] transition-all duration-300 text-left hover:-translate-y-1 hover:shadow-2xl hover:shadow-black/50"
    >
      <div className="relative h-36 overflow-hidden">
        <img
          src={game.image}
          alt={game.title}
          loading="lazy"
          className="w-full h-full object-cover opacity-60 group-hover:opacity-80 group-hover:scale-105 transition-all duration-500"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#121822] via-[#121822]/40 to-transparent" />
        <span className={`absolute top-3 left-3 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-gradient-to-r ${game.accent} text-white shadow-lg`}>
          {game.tag}
        </span>
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
          <div className="w-12 h-12 rounded-full bg-[#00e676] flex items-center justify-center text-[#0a0e14] shadow-lg vb-glow">
            <Play className="w-5 h-5 fill-current ml-0.5" />
          </div>
        </div>
      </div>

      <div className="p-3.5 flex items-center justify-between">
        <div>
          <h3 className="font-[var(--font-display)] text-white text-base tracking-wide">{game.title}</h3>
          <p className="text-[#5a6b80] text-xs mt-0.5 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-[#00e676] animate-pulse" />
            {game.players}
          </p>
        </div>
        <ChevronRight className="w-5 h-5 text-[#364860] group-hover:text-[#00e676] group-hover:translate-x-1 transition-all" />
      </div>
    </button>
  );
}
function RankTierCard({ tier }: { tier: RankTier }) {
  const Icon = tier.icon;
  return (
    <div className={`relative bg-[#121822] rounded-2xl overflow-visible border ${tier.borderClass} transition-all duration-300 hover:-translate-y-1 ${tier.featured ? 'lg:scale-105' : ''}`}>
      {tier.featured && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-[#00e5ff] text-[#0a0e14] text-[10px] font-bold uppercase tracking-wider whitespace-nowrap z-10">
          Most Popular
        </div>
      )}

      <div className="p-6">
        <div className="flex flex-col items-center mb-5">
          <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${tier.iconBg} flex items-center justify-center mb-3 shadow-lg`}>
            <Icon className="w-8 h-8 text-[#0a0e14]" />
          </div>
          <h3 className={`font-[var(--font-retro)] text-sm tracking-wider ${tier.accentText}`}>
            {tier.name}
          </h3>
        </div>

        <div className="text-center mb-5">
          <span className="font-[var(--font-display)] text-white text-4xl tracking-wide">{tier.price}</span>
          <span className="text-[#5a6b80] text-xs ml-1">/month</span>
        </div>

        <ul className="space-y-3 mb-6">
          {tier.perks.map((perk) => (
            <li key={perk} className="flex items-start gap-2.5">
              <span className={`mt-0.5 w-4 h-4 rounded-full bg-gradient-to-br ${tier.iconBg} flex items-center justify-center shrink-0`}>
                <Check className="w-2.5 h-2.5 text-[#0a0e14]" />
              </span>
              <span className="text-[#8ea0b8] text-sm leading-snug">{perk}</span>
            </li>
          ))}
        </ul>

        <button
          disabled
          data-testid="rank-coming-soon"
          className={`w-full py-3 rounded-xl font-[var(--font-display)] text-sm tracking-wide flex items-center justify-center gap-2 cursor-not-allowed opacity-80 bg-gradient-to-r ${tier.iconBg} text-[#0a0e14]`}
        >
          Coming Soon!
        </button>
      </div>
    </div>
  );
}

function SavedWorldsDashboard({ savedWorlds, onPlayWorld }: { savedWorlds: any[]; onPlayWorld: (config: any) => void }) {
  return (
    <div className="mt-8 bg-[#121822] rounded-2xl border border-[#243044] p-6">
      <div className="flex items-center gap-2 mb-4">
        <span className="text-[#00e676] font-bold font-mono">📂</span>
        <h2 className="font-[var(--font-display)] text-white text-sm tracking-wide uppercase">YOUR SAVED PLANETS</h2>
      </div>

      {savedWorlds.length === 0 ? (
        <div className="text-center py-8 border border-dashed border-[#243044]/50 rounded-xl">
          <p className="text-[#5a6b80] text-xs">No local worlds found. Go to 'Create' to map your first planet!</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {savedWorlds.map((world, idx) => (
            <button
              key={idx}
              onClick={() => onPlayWorld(world)}
              className="group flex items-center justify-between p-4 bg-[#0a0e14] border border-[#243044] hover:border-[#00e676] rounded-xl transition-all text-left"
            >
              <div>
                <h4 className="text-white text-sm font-medium font-mono group-hover:text-[#00e676] transition-colors">{world.name}</h4>
                <p className="text-[#5a6b80] text-[10px] mt-0.5 uppercase tracking-wider font-semibold">
                  Mode: <span className="text-gray-300">{world.mode}</span>
                </p>
              </div>
              <div className="w-8 h-8 rounded-lg bg-[#243044] group-hover:bg-[#00e676]/20 flex items-center justify-center text-[#5a6b80] group-hover:text-[#00e676] transition-all">
                <span className="text-xs">▶</span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
/** Your planets (worlds): create a new one, play one, or delete one. */
function PlanetsView({ savedWorlds, onPlayWorld, onCreate, onDelete }: { savedWorlds: any[]; onPlayWorld: (config: any) => void; onCreate: () => void; onDelete: (world: any) => void }) {
  const [confirm, setConfirm] = useState<string | null>(null);
  return (
    <div className="vb-fade-in" data-testid="planets">
      <header className="mb-6 flex items-end justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2 mb-2"><Globe className="w-5 h-5 text-[#00e676]" /><span className="font-[var(--font-retro)] text-[10px] text-[#00e676]">PLANETS</span></div>
          <h1 className="font-[var(--font-retro)] text-xl text-white leading-relaxed tracking-wider">YOUR PLANETS</h1>
        </div>
        <button onClick={onCreate} data-testid="create-planet" className="flex items-center gap-2 px-5 py-3 rounded-xl bg-[#00e676] text-[#0a0e14] font-bold text-sm transition-all duration-200 hover:scale-105 active:scale-95">
          <Plus className="w-4 h-4" /> Create Planet
        </button>
      </header>
      {savedWorlds.length === 0 ? (
        <div className="text-center py-16 border border-dashed border-[#243044] rounded-2xl">
          <Globe className="w-10 h-10 text-[#243044] mx-auto mb-3" />
          <p className="text-[#8ea0b8] text-sm mb-1">No planets yet</p>
          <p className="text-[#5a6b80] text-xs">Press <b className="text-white">Create Planet</b> to make your first world.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {savedWorlds.map((world, idx) => {
            const key = String(world.id ?? idx);
            return (
              <div key={key} className="group rounded-2xl border border-[#243044] bg-[#121822] overflow-hidden hover:border-[#00e676]/60 transition-all" data-testid="planet-card">
                <div className="h-28 bg-cover bg-center relative" style={{ backgroundImage: `url(${world.image || '/images/survival-bg.jpg'})` }}>
                  <div className="absolute inset-0 bg-gradient-to-t from-[#121822] to-transparent" />
                  <span className="absolute top-2 left-2 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-black/60 text-white">{world.mode}{world.worldType === 'superflat' ? ' · flat' : ''}</span>
                </div>
                <div className="p-4">
                  <h3 className="text-white font-medium truncate" title={world.name}>{world.name}</h3>
                  <p className="text-[#5a6b80] text-[10px] mt-0.5 font-mono">Seed {world.seed ?? '?'}</p>
                  {confirm === key ? (
                    <div className="mt-3 flex items-center gap-2">
                      <span className="text-[#ff8a8a] text-xs flex-1">Delete forever?</span>
                      <button onClick={() => { onDelete(world); setConfirm(null); }} data-testid="confirm-delete" className="px-3 py-1.5 rounded-lg bg-[#ff5555] text-white text-xs font-bold active:scale-95">Delete</button>
                      <button onClick={() => setConfirm(null)} className="px-3 py-1.5 rounded-lg bg-[#1a2230] text-[#8ea0b8] text-xs">Cancel</button>
                    </div>
                  ) : (
                    <div className="mt-3 flex items-center gap-2">
                      <button onClick={() => onPlayWorld(world)} data-testid="play-planet" className="flex-1 py-2 rounded-lg bg-[#00e676] text-[#0a0e14] text-xs font-bold transition-all hover:brightness-110 active:scale-95">▶ Play</button>
                      <button onClick={() => setConfirm(key)} data-testid="delete-planet" title="Delete this planet" className="px-3 py-2 rounded-lg bg-[#1a2230] text-[#8ea0b8] text-xs hover:text-[#ff8a8a] hover:bg-[#ff5555]/10">🗑</button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function HomeView({ username, onPlaySurvival, savedWorlds, onPlayWorld, onCreatePreset }: { username: string; onPlaySurvival: () => void; savedWorlds: any[]; onPlayWorld: (config: any) => void; onCreatePreset: (mode: WorldMode, worldType: WorldType) => void }) {
  const displayName = username.toUpperCase() || 'PLAYER';
  return (
    <div className="vb-fade-in">
      <header className="mb-8">
        <div className="vb-logo-wrapper inline-block mb-4 cursor-pointer">
          <img src="/images/logo.png" alt="VibeBlox" className="vb-logo-img w-12 h-12 rounded-xl" />
        </div>
        <h1 className="font-[var(--font-retro)] text-2xl text-white leading-relaxed tracking-wider">
          <span className="text-[#00e676]">WELCOME</span> BACK, {displayName}!
        </h1>
        <p className="font-[var(--font-display)] text-[#5a6b80] mt-3 text-sm tracking-wide">
          Block, build, battle — let's go
        </p>
      </header>

      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-[var(--font-display)] text-white text-lg tracking-wide flex items-center gap-2">
            <Trophy className="w-4 h-4 text-[#00e676]" />
            TOP GAMES
          </h2>
          <button className="text-[#5a6b80] hover:text-[#00e676] text-xs font-medium transition-colors">
            View All
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {games.map((game) => (
            <GameCardItem
              key={game.title}
              game={game}
              onPlay={() => {
                // Survival / Creative / Superflat open Create World with that option picked
                if (game.title === 'Survival') onCreatePreset('survival', 'default');
                else if (game.title === 'Creative') onCreatePreset('creative', 'default');
                else if (game.title === 'Superflat') onCreatePreset('creative', 'superflat');
                else onPlaySurvival();
              }}
            />
          ))}
        </div>
      </section>

    </div>
  );
}

type WorldMode = 'survival' | 'creative' | 'adventure';

function newWorldId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function randomSeed(): number {
  return 1 + Math.floor(Math.random() * 2_000_000_000);
}

// Blank = random. Numbers are used as-is; any other text is hashed (like Minecraft)
function seedFromText(text: string): number {
  const t = text.trim();
  if (!t) return randomSeed();
  if (/^-?\d+$/.test(t)) return Number(t) || 1;
  let h = 0;
  for (let i = 0; i < t.length; i++) h = (Math.imul(31, h) + t.charCodeAt(i)) | 0;
  return h || 1;
}

type WorldConfig = {
  name: string;
  mode: WorldMode;
  image: string;
  tag: string;
  accent: string;
  worldType?: WorldType;
  seed?: number;
  id?: string;
};

const modeConfig: Record<WorldMode, { image: string; tag: string; accent: string; icon: typeof Swords; description: string }> = {
  survival: {
    image: '/images/survival-bg.jpg',
    tag: 'PvE',
    accent: 'from-orange-500 to-red-500',
    icon: Swords,
    description: 'Gather resources, craft tools, survive the night',
  },
  creative: {
    image: '/images/creative-bg.jpg',
    tag: 'Sandbox',
    accent: 'from-sky-500 to-cyan-500',
    icon: Palette,
    description: 'Unlimited blocks, fly freely, build anything you imagine',
  },
  adventure: {
    image: '/images/adventure-bg.jpg',
    tag: 'Quest',
    accent: 'from-purple-500 to-pink-500',
    icon: Map,
    description: 'Explore dungeons, complete quests, find hidden treasure',
  },
};

const modeLabels: Record<WorldMode, string> = {
  survival: 'Survival',
  creative: 'Creative',
  adventure: 'Adventure',
};
function CreateWorldView({ onSave, onBack, initialMode = 'survival', initialType = 'default' }: {
  onSave: (config: WorldConfig) => void;
  onBack: () => void;
  initialMode?: WorldMode;
  initialType?: WorldType;
}) {
  const [worldName, setWorldName] = useState('');
  const [selectedMode, setSelectedMode] = useState<WorldMode>(initialMode);
  const [selectedType, setSelectedType] = useState<WorldType>(initialType);
  const [seedText, setSeedText] = useState('');
  const [customImage, setCustomImage] = useState<string | null>(null);

  function onImagePick(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      // Shrink to a small thumbnail so lots of worlds still fit in browser storage
      const c = document.createElement('canvas');
      c.width = 480; c.height = 270;
      const ctx = c.getContext('2d')!;
      const scale = Math.max(480 / img.width, 270 / img.height);
      const w = img.width * scale, h = img.height * scale;
      ctx.drawImage(img, (480 - w) / 2, (270 - h) / 2, w, h);
      setCustomImage(c.toDataURL('image/jpeg', 0.8));
      URL.revokeObjectURL(url);
    };
    img.src = url;
  }

  const modes: WorldMode[] = ['survival', 'creative', 'adventure'];
  const currentMode = modeConfig[selectedMode];
  const previewName = worldName.trim() || 'Untitled World';

  function handleSave() {
    onSave({
      name: worldName.trim() || 'Untitled World',
      mode: selectedMode,
      image: customImage ?? (selectedType === 'superflat' ? '/images/superflat-bg.jpg' : currentMode.image),
      tag: currentMode.tag,
      accent: currentMode.accent,
      worldType: selectedType,
      seed: seedFromText(seedText),
      id: newWorldId(),
    });
  }

  return (
    <div className="vb-fade-in">
      <header className="mb-8 flex items-center gap-4">
        <button
          onClick={onBack}
          className="w-10 h-10 rounded-xl bg-[#121822] border border-[#243044] flex items-center justify-center text-[#8ea0b8] hover:text-white hover:bg-[#1a2230] transition-all"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Plus className="w-4 h-4 text-[#00e676]" />
            <span className="font-[var(--font-retro)] text-[10px] text-[#00e676]">CREATE WORLD</span>
          </div>
          <h1 className="font-[var(--font-retro)] text-xl text-white leading-relaxed tracking-wider">
            NEW WORLD
          </h1>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-8 max-w-5xl">
        <div className="space-y-8">
          <section className="bg-[#121822] rounded-2xl border border-[#243044] p-6">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-7 h-7 rounded-lg bg-[#00e676] text-[#0a0e14] font-bold text-sm flex items-center justify-center">1</div>
              <h2 className="font-[var(--font-display)] text-white text-sm tracking-wide">NAME YOUR WORLD</h2>
            </div>
            <input
              type="text"
              value={worldName}
              onChange={(e) => setWorldName(e.target.value)}
              placeholder="Enter world name..."
              maxLength={32}
              className="w-full bg-[#0a0e14] border border-[#243044] rounded-xl px-4 py-3.5 text-white text-sm placeholder-[#364860] focus:border-[#00e676] focus:outline-none focus:ring-1 focus:ring-[#00e676] transition-colors"
              autoFocus
            />
            <p className="text-[#364860] text-[10px] mt-2">{worldName.length}/32 characters</p>
          </section>

          <section className="bg-[#121822] rounded-2xl border border-[#243044] p-6">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-7 h-7 rounded-lg bg-[#00e676] text-[#0a0e14] font-bold text-sm flex items-center justify-center">2</div>
              <h2 className="font-[var(--font-display)] text-white text-sm tracking-wide">SELECT GAME MODE</h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {modes.map((mode) => {
                const cfg = modeConfig[mode];
                const isSelected = selectedMode === mode;
                return (
                  <button
                    key={mode}
                    onClick={() => setSelectedMode(mode)}
                    className={`vb-mode-card group relative rounded-xl overflow-hidden border-2 text-left ${
                      isSelected
                        ? 'border-[#00e676] ring-2 ring-[#00e676]/30 scale-[1.02]'
                        : 'border-[#243044] hover:border-[#364860]'
                    }`}
                  >
                    <div className="relative h-28 overflow-hidden">
                      <img
                        src={cfg.image}
                        alt={`${modeLabels[mode]} background`}
                        className={`w-full h-full object-cover transition-all duration-300 ${
                          isSelected ? 'opacity-90' : 'opacity-50 group-hover:opacity-70'
                        }`}
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-[#121822] via-[#121822]/30 to-transparent" />
                      {isSelected && (
                        <div className="absolute top-2 right-2 w-6 h-6 rounded-full bg-[#00e676] flex items-center justify-center">
                          <Check className="w-3.5 h-3.5 text-[#0a0e14]" />
                        </div>
                      )}
                    </div>

                    <div className="p-3">
                      <h3 className={`font-[var(--font-display)] text-sm tracking-wide ${isSelected ? 'text-[#00e676]' : 'text-white'}`}>
                        {modeLabels[mode]}
                      </h3>
                      <p className="text-[#5a6b80] text-[10px] mt-1 leading-snug">{cfg.description}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </section>

          <section className="bg-[#121822] rounded-2xl border border-[#243044] p-6">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-7 h-7 rounded-lg bg-[#00e676] text-[#0a0e14] font-bold text-sm flex items-center justify-center">3</div>
              <h2 className="font-[var(--font-display)] text-white text-sm tracking-wide">WORLD TYPE</h2>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {([
                ['default', 'Default', 'Hills, biomes, caves, ores and trees'],
                ['superflat', 'Superflat', 'Completely flat grass, perfect for building'],
              ] as const).map(([value, label, desc]) => {
                const isSelected = selectedType === value;
                return (
                  <button
                    key={value}
                    onClick={() => setSelectedType(value)}
                    className={`rounded-xl border-2 p-4 text-left transition-all duration-200 ${
                      isSelected
                        ? 'border-[#00e676] ring-2 ring-[#00e676]/30 scale-[1.02] bg-[#00e676]/5'
                        : 'border-[#243044] hover:border-[#364860] hover:scale-[1.01]'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <h3 className={`font-[var(--font-display)] text-sm tracking-wide ${isSelected ? 'text-[#00e676]' : 'text-white'}`}>{label}</h3>
                      {isSelected && <Check className="w-4 h-4 text-[#00e676]" />}
                    </div>
                    <p className="text-[#5a6b80] text-[10px] mt-1 leading-snug">{desc}</p>
                  </button>
                );
              })}
            </div>
            <div className="mt-4">
              <label className="text-[#8ea0b8] text-xs">Seed (optional)</label>
              <input
                type="text"
                value={seedText}
                onChange={(e) => setSeedText(e.target.value)}
                placeholder="Leave blank for a random world"
                maxLength={32}
                className="mt-1.5 w-full bg-[#0a0e14] border border-[#243044] rounded-xl px-4 py-2.5 text-white text-sm placeholder-[#364860] focus:border-[#00e676] focus:outline-none transition-colors"
              />
              <p className="text-[#364860] text-[10px] mt-1.5">Same seed = same world. Every new planet gets a random one otherwise.</p>
            </div>
            <div className="mt-4">
              <label className="text-[#8ea0b8] text-xs">World image (optional)</label>
              <div className="flex items-center gap-3 mt-1.5">
                <label className="cursor-pointer px-4 py-2.5 rounded-xl bg-[#0a0e14] border border-[#243044] text-white text-sm transition-all duration-200 hover:border-[#00e676] hover:text-[#00e676]">
                  Choose image
                  <input type="file" accept="image/*" onChange={onImagePick} className="hidden" />
                </label>
                {customImage && (
                  <button onClick={() => setCustomImage(null)} className="text-[#5a6b80] text-xs hover:text-white transition-colors">Remove</button>
                )}
              </div>
              <p className="text-[#364860] text-[10px] mt-1.5">Shown on your world's card. Works for every world type, superflat included.</p>
            </div>
          </section>

          <button
            onClick={handleSave}
            className="w-full py-4 rounded-2xl bg-gradient-to-r from-[#00e676] to-[#00b248] text-[#0a0e14] font-[var(--font-display)] text-base tracking-wide flex items-center justify-center gap-2 hover:from-[#00ff88] hover:to-[#00c853] transition-all duration-300 hover:scale-[1.01] active:scale-95 vb-glow"
          >
            <Check className="w-5 h-5" />
            CREATE WORLD
          </button>
        </div>

        <div className="lg:sticky lg:top-6 h-fit">
          <div className="bg-[#121822] rounded-2xl border border-[#243044] p-5">
            <div className="flex items-center gap-2 mb-4">
              <Globe className="w-4 h-4 text-[#00e676]" />
              <span className="font-[var(--font-display)] text-[#8ea0b8] text-xs tracking-wide">HOW IT'LL LOOK IN DISCOVER</span>
            </div>

            <div className="relative bg-[#0a0e14] rounded-xl overflow-hidden border border-[#243044]">
              <div className="relative h-40 overflow-hidden">
                <img
                  src={customImage ?? (selectedType === 'superflat' ? '/images/superflat-bg.jpg' : currentMode.image)}
                  alt="World preview"
                  className="w-full h-full object-cover opacity-70"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#0a0e14] via-[#0a0e14]/40 to-transparent" />
                <span className={`absolute top-3 left-3 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-gradient-to-r ${currentMode.accent} text-white shadow-lg`}>
                  {currentMode.tag}
                </span>
              </div>
              <div className="p-4">
                <h3 className="font-[var(--font-display)] text-white text-base tracking-wide truncate">
                  {previewName}
                </h3>
                <p className="text-[#5a6b80] text-xs mt-1 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#00e676] animate-pulse" />
                  {modeLabels[selectedMode]}{selectedType === 'superflat' ? ' · Superflat' : ''} · Just created
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/** A few real textures drawn at the given resolution, so you can see the difference before choosing. */
function TexturePreviewStrip({ res, activeRes }: { res: TextureRes; activeRes: TextureRes }) {
  const previews = useMemo(() => getTexturePreviews(res), [res, activeRes]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="flex gap-1.5 mt-2">
      {previews.map((p) => (
        <canvas
          key={p.name}
          title={p.name}
          width={64}
          height={64}
          className="w-9 h-9 rounded-[3px]"
          style={{ imageRendering: 'pixelated' }}
          ref={(el) => {
            if (!el) return;
            const ctx = el.getContext('2d')!;
            ctx.imageSmoothingEnabled = false;
            ctx.clearRect(0, 0, 64, 64);
            ctx.drawImage(p.canvas, 0, 0, 64, 64);
          }}
        />
      ))}
    </div>
  );
}

function SettingsView({
  compact = false,
  renderDistance,
  onRenderDistanceChange,
  fov,
  onFovChange,
  trackName,
  builtInTrack,
  isPlaying,
  volume,
  onTrackChange,
  onPlayBuiltIn,
  onTogglePlay,
  onVolumeChange,
  graphicsQuality,
  onGraphicsQualityChange,
  textureRes,
  onTextureResChange,
  hudPrefs,
  onHudPrefsChange,
  sfxVolume,
  onSfxVolumeChange,
}: {
  renderDistance: number;
  onRenderDistanceChange: (rd: number) => void;
  fov: number;
  onFovChange: (fov: number) => void;
  trackName: string | null;
  builtInTrack: 'overworld' | 'phonk' | 'arcade' | null;
  isPlaying: boolean;
  volume: number;
  onTrackChange: (e: ChangeEvent<HTMLInputElement>) => void;
  onPlayBuiltIn: (style: 'overworld' | 'phonk' | 'arcade') => void;
  onTogglePlay: () => void;
  onVolumeChange: (e: ChangeEvent<HTMLInputElement>) => void;
  graphicsQuality: GraphicsQuality;
  onGraphicsQualityChange: (q: GraphicsQuality) => void;
  textureRes: TextureRes;
  onTextureResChange: (res: TextureRes) => void;
  hudPrefs: HudPrefs;
  onHudPrefsChange: (p: HudPrefs) => void;
  sfxVolume: number;
  onSfxVolumeChange: (v: number) => void;
  compact?: boolean;
}) {
  const [showPrivacy, setShowPrivacy] = useState(false);
  const [showCredits, setShowCredits] = useState(false);
  const builtInTracks: { value: 'overworld' | 'phonk' | 'arcade'; label: string }[] = [
    { value: 'overworld', label: 'Overworld' },
    { value: 'phonk', label: 'Phonk' },
    { value: 'arcade', label: 'Arcade' },
  ];
  const graphicsTiers: { value: GraphicsQuality; label: string; blurb: string }[] = [
    { value: 'low', label: 'Low', blurb: 'No shadows, fastest' },
    { value: 'medium', label: 'Medium', blurb: 'Basic shadows' },
    { value: 'high', label: 'High', blurb: 'Soft shadows, swaying plants, wavy water' },
    { value: 'max', label: 'Max', blurb: 'Sharpest shadows, full wind + detailed shader water' },
  ];

  const renderDistanceLabel =
    renderDistance <= 4 ? 'High FPS — optimized for performance' :
    renderDistance <= 8 ? 'Balanced — good visuals and performance' :
    'Best Visuals — maximum draw distance';
  // Green = light on your computer, orange = balanced, red = heavy
  const rdColor = renderDistance <= 4 ? '#00e676' : renderDistance <= 8 ? '#f59e0b' : '#ef4444';

  return (
    <div className="vb-fade-in max-w-2xl">
      {!compact && (
      <header className="mb-8">
        <div className="flex items-center gap-2 mb-2">
          <Settings className="w-5 h-5 text-[#00e676]" />
          <span className="font-[var(--font-retro)] text-[10px] text-[#00e676]">SETTINGS</span>
        </div>
        <h1 className="font-[var(--font-retro)] text-xl text-white leading-relaxed tracking-wider">
          GAME SETTINGS
        </h1>
      </header>
      )}

      <section className="bg-[#121822] rounded-2xl border border-[#243044] p-6">
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <div>
              <label className="text-white text-sm font-medium">Render Distance</label>
              <p className="text-[#5a6b80] text-xs mt-0.5">Controls how many chunks are visible</p>
            </div>
            <div className="bg-[#00e676]/15 border border-[#00e676]/30 rounded-lg px-3 py-1.5">
              <span className="font-[var(--font-display)] text-[#00e676] text-lg">{renderDistance}</span>
              <span className="text-[#5a6b80] text-xs ml-1">chunks</span>
            </div>
          </div>

          <input
            type="range"
            min={2}
            max={12}
            step={1}
            value={renderDistance}
            onChange={(e) => onRenderDistanceChange(parseInt(e.target.value))}
            className="w-full h-2 bg-[#0a0e14] rounded-full appearance-none cursor-pointer"
          />
          <p className="text-white text-xs mt-2 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full shrink-0 transition-colors duration-300" style={{ backgroundColor: rdColor, boxShadow: `0 0 6px ${rdColor}` }} />
            {renderDistanceLabel}
          </p>
        </div>

        <div className="pt-5 mt-5 border-t border-[#243044]">
          <div className="flex items-center justify-between mb-3">
            <div>
              <label className="text-white text-sm font-medium">FOV</label>
              <p className="text-[#5a6b80] text-xs mt-0.5">Field of view</p>
            </div>
            <div className="bg-[#00e676]/15 border border-[#00e676]/30 rounded-lg px-3 py-1.5">
              <span className="font-[var(--font-display)] text-[#00e676] text-lg">{fov}</span>
              <span className="text-[#5a6b80] text-xs ml-1">°</span>
            </div>
          </div>
          <input
            type="range"
            min={60}
            max={110}
            step={1}
            value={fov}
            onChange={(e) => onFovChange(parseInt(e.target.value))}
            className="w-full h-2 bg-[#0a0e14] rounded-full appearance-none cursor-pointer"
          />
        </div>
      </section>

      <section className="bg-[#121822] rounded-2xl border border-[#243044] p-6 mt-6">
        <div className="mb-4">
          <label className="text-white text-sm font-medium">Graphics Quality</label>
          <p className="text-[#5a6b80] text-xs mt-0.5">Higher tiers add softer, bigger shadows, sharper textures, swaying plants and moving water</p>
        </div>
        <div className="grid grid-cols-4 gap-2">
          {graphicsTiers.map((tier) => {
            const active = graphicsQuality === tier.value;
            return (
              <button
                key={tier.value}
                onClick={() => onGraphicsQualityChange(tier.value)}
                className={`flex flex-col items-center gap-1 py-3 rounded-xl border text-center transition-all duration-200 hover:scale-[1.04] active:scale-95 ${
                  active
                    ? 'bg-[#00e676]/15 border-[#00e676] text-[#00e676]'
                    : 'bg-[#0a0e14] border-[#243044] text-[#8ea0b8] hover:border-[#364860] hover:text-white'
                }`}
              >
                <span className="font-[var(--font-display)] text-sm font-bold">{tier.label}</span>
                <span className="text-[9px] leading-tight opacity-80 px-1">{tier.blurb}</span>
              </button>
            );
          })}
        </div>
      </section>

      <section className="bg-[#121822] rounded-2xl border border-[#243044] p-6 mt-6">
        <div className="mb-4">
          <label className="text-white text-sm font-medium">Textures</label>
          <p className="text-[#5a6b80] text-xs mt-0.5">Changes every block, item and mob instantly, even in the middle of a game</p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {([
            { value: 16 as TextureRes, label: '16×16', name: 'Classic', blurb: 'The original blocky look' },
            { value: 32 as TextureRes, label: '32×32', name: 'Detailed', blurb: 'Double the detail, smoother edges' },
          ]).map((opt) => {
            const active = textureRes === opt.value;
            return (
              <button
                key={opt.value}
                onClick={() => onTextureResChange(opt.value)}
                className={`flex flex-col items-center gap-1 py-3 px-2 rounded-xl border text-center transition-all duration-200 hover:scale-[1.02] active:scale-95 ${
                  active ? 'bg-[#00e676]/15 border-[#00e676] text-[#00e676]' : 'bg-[#0a0e14] border-[#243044] text-[#8ea0b8] hover:border-[#364860] hover:text-white'
                }`}
              >
                <span className="font-[var(--font-display)] text-base font-bold">{opt.label} <span className="text-xs font-medium opacity-80">{opt.name}</span></span>
                <span className="text-[10px] opacity-80">{opt.blurb}</span>
                <TexturePreviewStrip res={opt.value} activeRes={textureRes} />
              </button>
            );
          })}
        </div>
      </section>

      <section className="bg-[#121822] rounded-2xl border border-[#243044] p-6 mt-6">
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Zap className="w-4 h-4 text-[#00e676]" />
              <h2 className="text-white text-sm font-medium">Sound Effects</h2>
            </div>
            <p className="text-[#5a6b80] text-xs">Breaking, placing, footsteps, mobs and explosions</p>
          </div>
          <div className="bg-[#00e676]/15 border border-[#00e676]/30 rounded-lg px-3 py-1.5">
            <span className="font-[var(--font-display)] text-[#00e676] text-lg">{Math.round(sfxVolume * 100)}</span>
            <span className="text-[#5a6b80] text-xs ml-1">%</span>
          </div>
        </div>
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={sfxVolume}
          onChange={(e) => onSfxVolumeChange(parseFloat(e.target.value))}
          className="w-full h-2 bg-[#0a0e14] rounded-full appearance-none cursor-pointer"
        />
      </section>

      <section className="bg-[#121822] rounded-2xl border border-[#243044] p-6 mt-6">
        <div className="flex items-center gap-2 mb-1">
          <BarChart3 className="w-4 h-4 text-[#00e676]" />
          <h2 className="text-white text-sm font-medium">HUD Overlays</h2>
        </div>
        <p className="text-[#5a6b80] text-xs mb-4">Extra info on screen while you play. Press F3 in game for the full debug screen.</p>
        <div className="flex flex-col gap-2">
          {([
            ['keystrokes', 'Keystrokes', 'WASD, mouse buttons and Space light up as you press them'],
            ['cps', 'CPS', 'Clicks per second for left and right mouse'],
            ['fps', 'FPS', 'Frames per second'],
          ] as const).map(([k, label, desc]) => {
            const on = hudPrefs[k];
            return (
              <button
                key={k}
                onClick={() => onHudPrefsChange({ ...hudPrefs, [k]: !on })}
                className="flex items-center justify-between px-4 py-3 rounded-xl bg-[#0a0e14] border border-[#243044] text-left transition-all duration-200 hover:border-[#364860] hover:scale-[1.01] active:scale-[0.99]"
              >
                <div>
                  <div className="text-white text-sm font-medium">{label}</div>
                  <div className="text-[#5a6b80] text-xs">{desc}</div>
                </div>
                <div className={`w-10 h-6 shrink-0 rounded-full p-0.5 transition-colors duration-200 ${on ? 'bg-[#00e676]' : 'bg-[#243044]'}`}>
                  <div className={`w-5 h-5 rounded-full bg-white shadow transition-transform duration-200 ${on ? 'translate-x-4' : ''}`} />
                </div>
              </button>
            );
          })}
        </div>
      </section>

      <section className="bg-[#121822] rounded-2xl border border-[#243044] p-6 mt-6">
        <div className="flex items-center gap-2 mb-1">
          <Music className="w-4 h-4 text-[#00e676]" />
          <h2 className="text-white text-sm font-medium">Soundtrack</h2>
        </div>
        <p className="text-[#5a6b80] text-xs mb-4">Pick a built-in track, or upload your own — it keeps playing while you browse or play.</p>

        <div className="grid grid-cols-3 gap-2 mb-4">
          {builtInTracks.map((t) => {
            const active = builtInTrack === t.value;
            return (
              <button
                key={t.value}
                onClick={() => onPlayBuiltIn(t.value)}
                className={`py-2.5 rounded-xl border text-sm font-medium transition-all duration-200 hover:scale-[1.03] active:scale-95 ${
                  active
                    ? 'bg-[#00e676]/15 border-[#00e676] text-[#00e676]'
                    : 'bg-[#0a0e14] border-[#243044] text-[#8ea0b8] hover:border-[#364860] hover:text-white'
                }`}
              >
                {t.label}
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-3 mb-4">
          <label className="cursor-pointer px-4 py-2.5 rounded-xl bg-[#0a0e14] border border-[#243044] text-white text-sm font-medium transition-all duration-200 hover:border-[#00e676] hover:text-[#00e676] hover:scale-[1.03] active:scale-95">
            Choose File
            <input type="file" accept="audio/*,.mp3,.m4a,.aac,.wav,.ogg,.oga,.flac,.webm,.mp4" onChange={onTrackChange} className="hidden" />
          </label>
          <span className="text-[#8ea0b8] text-xs truncate max-w-[220px]">
            {trackName ?? (builtInTrack ? builtInTracks.find((t) => t.value === builtInTrack)?.label : 'No track selected')}
          </span>
        </div>

        {(trackName || builtInTrack) && (
          <div className="flex items-center gap-4">
            <button
              onClick={onTogglePlay}
              className="w-10 h-10 shrink-0 rounded-full bg-[#00e676] flex items-center justify-center text-[#0a0e14] transition-transform duration-200 hover:scale-110 active:scale-95"
            >
              {isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current ml-0.5" />}
            </button>
            <div className="flex-1 flex items-center gap-2">
              <span className="text-[#5a6b80] text-xs">Vol</span>
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={volume}
                onChange={onVolumeChange}
                className="flex-1 h-1.5 bg-[#0a0e14] rounded-full appearance-none cursor-pointer"
              />
            </div>
          </div>
        )}
      </section>

      <section className="bg-[#121822] rounded-2xl border border-[#243044] p-6 mt-6">
        <h2 className="text-white text-sm font-medium mb-4">About</h2>
        <div className="flex flex-col gap-2">
          <button
            onClick={() => setShowPrivacy((v) => !v)}
            className="flex items-center justify-between px-4 py-2.5 rounded-xl bg-[#0a0e14] border border-[#243044] text-[#8ea0b8] text-sm transition-all duration-200 hover:border-[#364860] hover:text-white"
          >
            Privacy Policy
            <span className="text-xs">{showPrivacy ? '▲' : '▼'}</span>
          </button>
          {showPrivacy && (
            <div className="px-4 py-3 rounded-xl bg-[#0a0e14] border border-[#243044] text-[#5a6b80] text-xs leading-relaxed">
              VibeBlox stores your username, world saves, and settings locally in your browser — nothing is sent to
              an external server. Any soundtrack file you upload stays in memory for the session and is never
              transmitted anywhere. This is a hobby/indie project, not a commercial product, and this notice is a
              placeholder — replace it with real terms before any public launch.
            </div>
          )}

          <button
            onClick={() => setShowCredits((v) => !v)}
            className="flex items-center justify-between px-4 py-2.5 rounded-xl bg-[#0a0e14] border border-[#243044] text-[#8ea0b8] text-sm transition-all duration-200 hover:border-[#364860] hover:text-white"
          >
            Credits
            <span className="text-xs">{showCredits ? '▲' : '▼'}</span>
          </button>
          {showCredits && (
            <div className="px-4 py-3 rounded-xl bg-[#0a0e14] border border-[#243044] text-[#5a6b80] text-xs leading-relaxed">
              Built with React, TypeScript, Vite, and Three.js. Inspired by Minecraft and Miniblox. Made by an
              independent creator — thanks for playing!
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

/** The player's coins, XP and cosmetics; re-renders whenever they change. */
function useProgress() {
  const [p, setP] = useState(getProgress);
  useEffect(() => subscribeProgress(() => setP(getProgress())), []);
  return p;
}

function LookPicture({ look, view, size = 96 }: { look: PlayerLook; view: 'front' | 'back'; size?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => { if (ref.current) drawLookPreview(ref.current, look, view); }, [look.skin, look.cape, view]);
  return <canvas ref={ref} width={size} height={Math.round(size * 1.25)} className="[image-rendering:pixelated]" />;
}

function fmtTime(sec: number): string {
  const s = Math.max(0, Math.ceil(sec));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), r = s % 60;
  return h ? `${h}h ${m}m` : `${m}:${String(r).padStart(2, '0')}`;
}

/**
 * Two tabs: Ranks (real money via Tebex, only on vibeblox.online) and Cosmetics (coins
 * from levelling up and rewarded ads). Also used inside the in-game menu.
 */
function ShopView({ compact = false }: { compact?: boolean }) {
  const p = useProgress();
  const [tab, setTab] = useState<'ranks' | 'cosmetics'>(CAN_SELL_RANKS ? 'ranks' : 'cosmetics');
  const [sub, setSub] = useState<'skins' | 'capes'>('skins');
  const [adBusy, setAdBusy] = useState<null | 'coins' | 'booster'>(null);
  const [adsOk, setAdsOk] = useState<boolean>(false);
  const [note, setNote] = useState<string | null>(null);
  useEffect(() => { if (ADS_POSSIBLE) void initAds().then(setAdsOk); }, []);
  useEffect(() => { if (!note) return; const t = setTimeout(() => setNote(null), 3500); return () => clearTimeout(t); }, [note]);

  const curXp = xpForLevel(p.level), nextXp = xpForLevel(p.level + 1);
  const pct = Math.max(0, Math.min(1, (p.xp - curXp) / (nextXp - curXp)));
  const boosted = p.boosterSeconds > 0;
  const untilXp = (SECONDS_PER_PERIOD - p.activeSeconds) / (boosted ? 2 : 1);

  async function watch(kind: 'coins' | 'booster') {
    setAdBusy(kind);
    const ok = await triggerRewardedAd({
      onStart: () => window.dispatchEvent(new CustomEvent('vb-ad', { detail: true })),
      onEnd: () => window.dispatchEvent(new CustomEvent('vb-ad', { detail: false })),
    });
    setAdBusy(null);
    if (!ok) { setNote("The ad didn't finish, so there's no reward this time."); return; }
    if (kind === 'coins') { rewardAdCoins(); setNote(`+${AD_COINS} coins!`); }
    else { rewardAdBooster(); setNote(`2x XP for the next ${BOOSTER_SECONDS / 60} minutes of play!`); }
  }
  function buyOrEquip(kind: 'skin' | 'cape', id: string) {
    const owned = kind === 'skin' ? p.ownedSkins.includes(id) : p.ownedCapes.includes(id);
    if (owned) { equipCosmetic(kind, id); return; }
    const r = buyCosmetic(kind, id);
    if (r === 'poor') setNote('Not enough coins yet. Level up or watch an ad to earn more.');
    else if (r === 'ok') setNote(`Unlocked and equipped ${(kind === 'skin' ? SKINS[id] : CAPES[id]).name}!`);
  }

  const look: PlayerLook = { skin: p.currentSkin, cape: p.currentCape };
  const tabBtn = (active: boolean) => `px-4 py-2 rounded-xl text-sm font-bold transition-all duration-200 active:scale-95 ${active ? 'bg-[#00e676] text-[#0a0e14]' : 'bg-[#121822] text-[#8ea0b8] border border-[#243044] hover:text-white'}`;

  return (
    <div className="vb-fade-in">
      {!compact && (
        <header className="mb-5">
          <div className="flex items-center gap-2 mb-2">
            <ShoppingBag className="w-5 h-5 text-[#00e676]" />
            <span className="font-[var(--font-retro)] text-[10px] text-[#00e676]">STORE</span>
          </div>
          <h1 className="font-[var(--font-retro)] text-xl text-white leading-relaxed tracking-wider">VIBEBLOX STORE</h1>
        </header>
      )}

      {/* Your progress */}
      <div className="mb-5 grid gap-3 sm:grid-cols-[auto_1fr_auto] items-center bg-[#121822] border border-[#243044] rounded-2xl p-4">
        <div className="flex items-center gap-2 rounded-xl bg-[#1a2230] px-3 py-2">
          <Coins className="w-5 h-5 text-[#ffd23a]" />
          <span className="text-white font-bold text-lg tabular-nums" data-testid="coins">{p.coins.toLocaleString()}</span>
          <span className="text-[#8ea0b8] text-xs">coins</span>
        </div>
        <div>
          <div className="flex justify-between text-xs mb-1">
            <span className="text-white font-bold">Level {p.level}</span>
            <span className="text-[#8ea0b8]">{p.xp - curXp} / {nextXp - curXp} XP · next +{XP_PER_PERIOD} XP in {fmtTime(untilXp)} of play</span>
          </div>
          <div className="h-2.5 rounded-full bg-[#0a0e14] overflow-hidden"><div className="h-full bg-gradient-to-r from-[#00e676] to-[#00e5ff]" style={{ width: `${pct * 100}%` }} /></div>
        </div>
        {boosted
          ? <span className="rounded-xl bg-[#ffd23a]/15 text-[#ffd23a] text-xs font-bold px-3 py-2"><Sparkles className="inline w-4 h-4 mr-1" />2x XP · {fmtTime(p.boosterSeconds)} left</span>
          : <span className="text-[#5a6b80] text-xs">Level up: +{LEVEL_UP_COINS} coins</span>}
      </div>

      <div className="flex gap-2 mb-5">
        {CAN_SELL_RANKS && <button className={tabBtn(tab === 'ranks')} onClick={() => setTab('ranks')}><Crown className="inline w-4 h-4 mr-1" />Ranks</button>}
        <button className={tabBtn(tab === 'cosmetics')} onClick={() => setTab('cosmetics')}><Shirt className="inline w-4 h-4 mr-1" />Cosmetics</button>
      </div>

      {note && <div className="mb-4 rounded-xl bg-[#00e676]/10 border border-[#00e676]/40 text-[#00e676] text-sm px-4 py-2 vb-fade-in">{note}</div>}

      {tab === 'ranks' && CAN_SELL_RANKS ? (
        <>
          <section className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start pt-2">
            {rankTiers.map((tier) => <RankTierCard key={tier.name} tier={tier} />)}
          </section>
          <p className="text-center text-[#5a6b80] text-xs mt-8">Ranks are coming soon. Keep an eye on our Discord for the launch!</p>
        </>
      ) : (
        <>
          {/* Earn coins */}
          <div className="grid sm:grid-cols-2 gap-3 mb-5">
            <button
              disabled={!adsOk || adBusy !== null}
              onClick={() => watch('coins')}
              className="flex items-center justify-center gap-2 rounded-xl py-3 font-bold text-sm bg-gradient-to-r from-[#ffd23a] to-[#ff9a1a] text-[#0a0e14] transition-all duration-200 hover:scale-[1.02] active:scale-95 disabled:opacity-40 disabled:hover:scale-100"
            >
              <Tv className="w-4 h-4" />{adBusy === 'coins' ? 'Playing ad…' : `Watch Ad for ${AD_COINS} Coins`}
            </button>
            <button
              disabled={!adsOk || adBusy !== null}
              onClick={() => watch('booster')}
              className="flex items-center justify-center gap-2 rounded-xl py-3 font-bold text-sm bg-gradient-to-r from-[#00e5ff] to-[#7c4dff] text-[#0a0e14] transition-all duration-200 hover:scale-[1.02] active:scale-95 disabled:opacity-40 disabled:hover:scale-100"
            >
              <Sparkles className="w-4 h-4" />{adBusy === 'booster' ? 'Playing ad…' : 'Watch Ad for a 2x XP Playtime Booster'}
            </button>
          </div>
          {!adsOk && <p className="-mt-3 mb-5 text-[#5a6b80] text-xs">{ADS_POSSIBLE ? 'No ads are available right now. Try again in a moment.' : 'Ads are available when you play VibeBlox on CrazyGames or Poki. Here you earn coins by levelling up.'}</p>}

          <div className="flex gap-2 mb-4">
            <button className={tabBtn(sub === 'skins')} onClick={() => setSub('skins')}>Skins / Characters</button>
            <button className={tabBtn(sub === 'capes')} onClick={() => setSub('capes')}>Capes</button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {(sub === 'skins' ? Object.entries(SKINS) : Object.entries(CAPES)).map(([id, def]) => {
              const kind = sub === 'skins' ? 'skin' : 'cape';
              const owned = kind === 'skin' ? p.ownedSkins.includes(id) : p.ownedCapes.includes(id);
              const equipped = kind === 'skin' ? p.currentSkin === id : p.currentCape === id;
              const afford = p.coins >= def.price;
              return (
                <div key={id} className={`rounded-2xl border p-3 flex flex-col items-center gap-2 bg-[#121822] ${equipped ? 'border-[#00e676]' : 'border-[#243044]'}`}>
                  <div className="h-[120px] flex items-center">
                    <LookPicture look={kind === 'skin' ? { skin: id, cape: 'none' } : { skin: look.skin, cape: id }} view={kind === 'skin' ? 'front' : 'back'} />
                  </div>
                  <div className="text-white text-sm font-bold text-center">{def.name}</div>
                  <button
                    disabled={equipped || (!owned && !afford)}
                    onClick={() => buyOrEquip(kind, id)}
                    className={`w-full rounded-lg py-1.5 text-xs font-bold transition-all duration-200 active:scale-95 ${equipped ? 'bg-[#00e676]/15 text-[#00e676]' : owned ? 'bg-[#1a2230] text-white hover:bg-[#243044]' : afford ? 'bg-[#ffd23a] text-[#0a0e14] hover:scale-[1.03]' : 'bg-[#1a2230] text-[#5a6b80]'}`}
                  >
                    {equipped ? 'Equipped' : owned ? 'Equip' : def.price === 0 ? 'Free' : <span className="inline-flex items-center gap-1"><Coins className="w-3.5 h-3.5" />{def.price}</span>}
                  </button>
                </div>
              );
            })}
          </div>
          <p className="text-[#5a6b80] text-xs mt-5">You earn {XP_PER_PERIOD} XP for every {SECONDS_PER_PERIOD / 60} minutes you actively play (the clock pauses in menus and when you're away). Other players see your skin and cape in multiplayer.</p>
        </>
      )}
    </div>
  );
}
function MainContent({
  username,
  view,
  onPlaySurvival,
  renderDistance,
  onRenderDistanceChange,
  fov,
  onFovChange,
  onSaveWorld,
  onBackToWorlds,
  onPlayWorld,
  onCreatePreset,
  onNavClick,
  onDeleteWorld,
  createPreset,
  serverUrl,
  onServerUrlChange,
  onJoinServer,
  netStatus,
  netError,
  trackName,
  builtInTrack,
  isPlaying,
  volume,
  onTrackChange,
  onPlayBuiltIn,
  onTogglePlay,
  onVolumeChange,
  graphicsQuality,
  onGraphicsQualityChange,
  textureRes,
  onTextureResChange,
  hudPrefs,
  onHudPrefsChange,
  sfxVolume,
  onSfxVolumeChange,
}: {
  username: string;
  view: View;
  onPlaySurvival: () => void;
  renderDistance: number;
  onRenderDistanceChange: (rd: number) => void;
  fov: number;
  onFovChange: (fov: number) => void;
  onSaveWorld: (config: WorldConfig) => void;
  onBackToWorlds: () => void;
  onPlayWorld: (config: WorldConfig) => void;
  onCreatePreset: (mode: WorldMode, worldType: WorldType) => void;
  onNavClick: (v: View) => void;
  onDeleteWorld: (world: any) => void;
  createPreset: { mode: WorldMode; worldType: WorldType; nonce: number };
  serverUrl: string;
  onServerUrlChange: (v: string) => void;
  onJoinServer: () => void;
  netStatus: NetStatus;
  netError: string | null;
  trackName: string | null;
  builtInTrack: 'overworld' | 'phonk' | 'arcade' | null;
  isPlaying: boolean;
  volume: number;
  onTrackChange: (e: ChangeEvent<HTMLInputElement>) => void;
  onPlayBuiltIn: (style: 'overworld' | 'phonk' | 'arcade') => void;
  onTogglePlay: () => void;
  onVolumeChange: (e: ChangeEvent<HTMLInputElement>) => void;
  graphicsQuality: GraphicsQuality;
  onGraphicsQualityChange: (q: GraphicsQuality) => void;
  textureRes: TextureRes;
  onTextureResChange: (res: TextureRes) => void;
  hudPrefs: HudPrefs;
  onHudPrefsChange: (p: HudPrefs) => void;
  sfxVolume: number;
  onSfxVolumeChange: (v: number) => void;
}) {
  return (
    <main className="flex-1 overflow-y-auto vb-scroll bg-[#0a0e14]">
      <div className="px-8 py-6">
        {view === 'home' && <DiscordBanner />}
        {view === 'home' && <HomeView username={username} onPlaySurvival={onPlaySurvival} savedWorlds={(window as any).savedWorldsGlobal || []} onPlayWorld={onPlayWorld} onCreatePreset={onCreatePreset} />}
        {view === 'shop' && <ShopView />}
        {view === 'planets' && <PlanetsView savedWorlds={(window as any).savedWorldsGlobal || []} onPlayWorld={onPlayWorld} onCreate={() => onNavClick('create-world')} onDelete={onDeleteWorld} />}
        {view === 'settings' && (
          <SettingsView
            renderDistance={renderDistance}
            onRenderDistanceChange={onRenderDistanceChange}
            fov={fov}
            onFovChange={onFovChange}
            trackName={trackName}
            builtInTrack={builtInTrack}
            isPlaying={isPlaying}
            volume={volume}
            onTrackChange={onTrackChange}
            onPlayBuiltIn={onPlayBuiltIn}
            onTogglePlay={onTogglePlay}
            onVolumeChange={onVolumeChange}
            graphicsQuality={graphicsQuality}
            onGraphicsQualityChange={onGraphicsQualityChange}
            textureRes={textureRes}
            onTextureResChange={onTextureResChange}
            hudPrefs={hudPrefs}
            onHudPrefsChange={onHudPrefsChange}
            sfxVolume={sfxVolume}
            onSfxVolumeChange={onSfxVolumeChange}
          />
        )}
        {view === 'servers' && (
          <ServersView serverUrl={serverUrl} onServerUrlChange={onServerUrlChange} onJoin={onJoinServer} status={netStatus} error={netError} available={multiplayerAvailable} />
        )}
        {view === 'create-world' && <CreateWorldView key={createPreset.nonce} initialMode={createPreset.mode} initialType={createPreset.worldType} onSave={onSaveWorld} onBack={onBackToWorlds} />}
      </div>
    </main>
  );
}

function ProfilePanel({ username, onPlayNow }: { username: string; onPlayNow: () => void }) {
  const displayName = username || 'PlayerOne';
  const initial = username ? username.charAt(0).toUpperCase() : 'P';
  return (
    <aside className="w-[280px] shrink-0 bg-[#0d131b] border-l border-[#243044] flex flex-col p-5 gap-5">
      <div className="bg-[#121822] rounded-2xl border border-[#243044] p-4">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#3b5998] to-[#00e676] ring-2 ring-[#243044] flex items-center justify-center text-white font-[var(--font-display)] text-xl">
            {initial}
          </div>
          <div>
            <p className="font-[var(--font-display)] text-white text-sm truncate max-w-[160px]">{displayName}</p>
            <p className="text-[#5a6b80] text-xs">Online</p>
          </div>
        </div>
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[#8ea0b8] text-xs font-medium">Level 24</span>
            <span className="text-[#5a6b80] text-xs">{xpCurrent.toLocaleString()} / {xpNext.toLocaleString()} XP</span>
          </div>
          <div className="h-2 bg-[#0a0e14] rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-[#00e676] to-[#00b248] rounded-full transition-all duration-500" style={{ width: `${xpPercent}%` }} />
          </div>
        </div>
      </div>

      <div className="bg-[#121822] rounded-2xl border border-[#243044] p-4">
        <h3 className="font-[var(--font-display)] text-white text-sm tracking-wide mb-3 flex items-center gap-2">
          <Play className="w-4 h-4 text-[#00e676] fill-current" /> QUICK PLAY
        </h3>
        <button onClick={onPlayNow} className="w-full py-3 rounded-xl bg-gradient-to-r from-[#00e676] to-[#00b248] text-[#0a0e14] font-[var(--font-display)] text-sm tracking-wide flex items-center justify-center gap-2 hover:from-[#00ff88] hover:to-[#00c853] transition-all duration-300 hover:scale-[1.02] active:scale-95 vb-glow">
          <Play className="w-4 h-4 fill-current" /> PLAY NOW
        </button>
      </div>

      <div className="bg-[#121822] rounded-2xl border border-[#243044] p-4">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#ffd700] to-[#ff8c00] flex items-center justify-center">
            <Coins className="w-4 h-4 text-[#0a0e14]" />
          </div>
          <span className="font-[var(--font-display)] text-white text-sm tracking-wide">CURRENCY</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[#8ea0b8] text-xs">Coins</span>
          <span className="font-[var(--font-display)] text-[#ffd700] text-lg">12,450</span>
        </div>
        <div className="flex items-center justify-between mt-2">
          <span className="text-[#8ea0b8] text-xs">Gems</span>
          <span className="font-[var(--font-display)] text-[#00e5ff] text-lg">320</span>
        </div>
      </div>
    </aside>
  );
}

function GameOverlay() {
  return (
    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10 pointer-events-none">
      <div className="relative w-6 h-6">
        <div className="absolute top-1/2 left-0 w-full h-0.5 bg-white/50 -translate-y-1/2" />
        <div className="absolute left-1/2 top-0 h-full w-0.5 bg-white/50 -translate-x-1/2" />
      </div>
    </div>
  );
}

function ItemIcon({ id, className = 'w-7 h-7' }: { id: number; className?: string }) {
  return (
    <img
      src={getItemIconURL(id)}
      alt={ITEM_INFO[id]?.name ?? ''}
      draggable={false}
      className={`${className} pointer-events-none select-none`}
      style={{ imageRendering: 'pixelated' }}
    />
  );
}

function GameHUD({ inventory, offhand, armor, health, hunger, selectedSlot, mode }: {
  inventory: Slots;
  offhand: ItemStack | null;
  armor: Slots;
  health: number;
  hunger: number;
  selectedSlot: number;
  mode: PlayMode;
}) {
  const heldId = inventory[selectedSlot]?.id ?? null;

  // Item name pops up above the hotbar when you switch to it, then fades
  const [nameVisible, setNameVisible] = useState(false);
  useEffect(() => {
    if (heldId === null) { setNameVisible(false); return; }
    setNameVisible(true);
    const t = setTimeout(() => setNameVisible(false), 2000);
    return () => clearTimeout(t);
  }, [selectedSlot, heldId]);

  const pips = (value: number) => Array.from({ length: 10 }, (_, i) => {
    const remaining = value - i * 2;
    return remaining >= 2 ? 'full' : remaining === 1 ? 'half' : 'empty';
  });

  if (mode === 'spectator') return null; // spectators get no hotbar, like Minecraft

  return (
    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center gap-1.5 pointer-events-none">
      <div
        className={`text-white text-sm font-bold h-5 transition-opacity duration-500 drop-shadow-[0_2px_0_rgba(0,0,0,0.8)] ${
          nameVisible ? 'opacity-100' : 'opacity-0'
        }`}
      >
        {heldId !== null ? ITEM_INFO[heldId]?.name : ''}
      </div>

      {(() => {
        const pts = armor.reduce((n, a) => n + (a && ARMOR[a.id] ? ARMOR[a.id].points : 0), 0);
        if (pts <= 0 || !(mode === 'survival' || mode === 'adventure')) return null;
        return (
          <div className="flex gap-0.5 self-start px-0.5">
            {pips(pts).map((state, i) => (
              <Shield key={i} className={`w-4 h-4 ${state === 'empty' ? 'text-white/20 fill-white/10' : 'text-slate-100 fill-slate-300'} ${state === 'half' ? 'opacity-50' : ''}`} />
            ))}
          </div>
        );
      })()}
      <div className={`flex items-center justify-between w-full px-0.5 ${mode === 'survival' || mode === 'adventure' ? '' : 'invisible'}`}>
        <div className="flex gap-0.5">
          {pips(health).map((state, i) => (
            <Heart
              key={i}
              className={`w-4 h-4 transition-colors duration-300 ${
                state === 'empty' ? 'text-white/20 fill-white/10' : 'text-red-500 fill-red-500'
              } ${state === 'half' ? 'opacity-50' : ''}`}
            />
          ))}
        </div>
        <div className="flex gap-0.5">
          {pips(hunger).map((state, i) => (
            <Drumstick
              key={i}
              className={`w-4 h-4 transition-colors duration-300 ${
                state === 'empty' ? 'text-white/20 fill-white/10' : 'text-amber-500 fill-amber-500'
              } ${state === 'half' ? 'opacity-50' : ''}`}
            />
          ))}
        </div>
      </div>

      {offhand && (
        <div
          className="absolute bottom-1 -left-14 w-11 h-11 flex items-center justify-center bg-[#8b8b8b] border-2 border-[#3d3d3d]"
          style={{ boxShadow: 'inset -2px -2px 0 rgba(0,0,0,0.25), inset 2px 2px 0 rgba(255,255,255,0.15)' }}
          title="Off-hand (F to swap)"
        >
          <ItemIcon id={offhand.id} className="w-8 h-8" />
        </div>
      )}
      <div className="flex gap-0.5 bg-black/40 p-1 rounded-md">
        {Array.from({ length: 9 }).map((_, i) => {
          const st = inventory[i];
          const id = st ? st.id : null;
          const count = st ? st.count : 0;
          const isSelected = i === selectedSlot;
          return (
            <div
              key={i}
              className={`w-11 h-11 flex items-center justify-center relative transition-all duration-150 ${
                isSelected ? 'bg-[#5a5a5a] border-2 border-white scale-110' : 'bg-[#8b8b8b] border-2 border-[#3d3d3d]'
              }`}
              style={{ boxShadow: isSelected ? '0 0 0 1px rgba(255,255,255,0.6)' : 'inset -2px -2px 0 rgba(0,0,0,0.25), inset 2px 2px 0 rgba(255,255,255,0.15)' }}
            >
              {id !== null && <ItemIcon id={id} className="w-8 h-8" />}
              {id !== null && count > 1 && (
                <span className="absolute bottom-0 right-0.5 text-[10px] text-white font-bold drop-shadow-[0_1px_0_black]">{count}</span>
              )}
              <span className="absolute -top-4 left-0.5 text-[9px] text-white/70 font-bold drop-shadow">{i + 1}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Computed when needed, so items added by mods show up in creative too
const allItemIds = () => Object.keys(ITEM_INFO).map(Number).filter((id) => !ITEM_INFO[id].hidden).sort((a, b) => a - b);

function ItemSlot({ id, count, onMouseDown, onMouseEnter, highlight = false, size = 'md' }: {
  id: number | null;
  count?: number;
  onMouseDown?: (e: ReactMouseEvent) => void;
  onMouseEnter?: (e: ReactMouseEvent) => void;
  highlight?: boolean;
  size?: 'sm' | 'md';
}) {
  const box = size === 'sm' ? 'w-9 h-9' : 'w-11 h-11';
  return (
    <div
      onMouseDown={onMouseDown}
      onMouseEnter={onMouseEnter}
      onContextMenu={(e) => e.preventDefault()}
      data-item-id={id !== null ? id : undefined}
      className={`${box} border-2 flex items-center justify-center relative cursor-pointer select-none transition-colors duration-100 ${
        highlight ? 'bg-[#a8a8a8] border-white' : 'bg-[#8b8b8b] border-[#3d3d3d] hover:bg-[#a0a0a0]'
      }`}
      style={{ boxShadow: 'inset -2px -2px 0 rgba(0,0,0,0.25), inset 2px 2px 0 rgba(255,255,255,0.15)' }}
    >
      {id !== null && <ItemIcon id={id} className={size === 'sm' ? 'w-6 h-6' : 'w-8 h-8'} />}
      {id !== null && count !== undefined && count > 1 && (
        <span className="absolute bottom-0 right-0.5 text-[10px] text-white font-bold drop-shadow-[0_1px_0_black]">{count}</span>
      )}
    </div>
  );
}

type HeldStack = ItemStack;
type Container = 'inv' | 'chest' | 'grid' | 'offhand' | 'armor' | 'furnace';

/** The little 3D player in the inventory. Its head follows your cursor. */
function PlayerPreview({ armor, mouse }: { armor: Slots; mouse: { x: number; y: number } }) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  const previewRef = useRef<ReturnType<typeof createPlayerPreview> | null>(null);
  useEffect(() => {
    if (!ref.current) return;
    try { previewRef.current = createPlayerPreview(ref.current); previewRef.current.setAppearance(currentLook()); } catch { previewRef.current = null; }
    return () => { previewRef.current?.dispose(); previewRef.current = null; };
  }, []);
  useEffect(() => { previewRef.current?.setArmor(armor.map((a) => (a ? a.id : null))); }, [armor]);
  useEffect(() => {
    const c = ref.current;
    if (!c || !previewRef.current) return;
    const r = c.getBoundingClientRect();
    previewRef.current.setLook((mouse.x - (r.left + r.width / 2)) / 250, (mouse.y - (r.top + r.height * 0.22)) / 250);
  }, [mouse]);
  return <canvas ref={ref} width={112} height={160} className="w-[112px] h-[160px] rounded-xl bg-black/35 border border-[#243044] shrink-0" />;
}

function ingredientsOf(r: Recipe): HeldStack[] {
  const need: Record<number, number> = {};
  for (const p of r.pattern) if (p !== null) need[p] = (need[p] || 0) + 1;
  return Object.entries(need).map(([id, count]) => ({ id: Number(id), count }));
}

/**
 * Minecraft-style inventory: left-click picks up the whole stack, right-click
 * half; with something held, left-click drops it all and right-click drops one
 * (hold right and drag to lay 1 into each slot). Shift-click quick-moves.
 */
function InventoryOverlay({
  inventory, offhand, armor, atCraftingTable, chestKey, furnaceKey = null, isCreative, craftMode, onCraftModeChange,
  onQuickCraft, onSlotsChange, onOffhandChange, onArmorChange, getChest, onChestChange, getFurnace, onFurnaceChange, onDropItems,
}: {
  armor: Slots;
  onArmorChange: (armor: Slots) => void;
  inventory: Slots;
  offhand: ItemStack | null;
  onOffhandChange: (st: ItemStack | null) => void;
  atCraftingTable: boolean;
  chestKey: string | null;
  furnaceKey?: string | null;
  getFurnace?: (key: string) => { slots: Slots; cook: number; burn: number };
  onFurnaceChange?: (key: string, slots: Slots) => void;
  isCreative: boolean;
  craftMode: 'grid' | 'quick';
  onCraftModeChange: (m: 'grid' | 'quick') => void;
  onQuickCraft: (recipeId: string) => void;
  onSlotsChange: (slots: Slots) => void;
  getChest: (key: string) => Slots;
  onChestChange: (key: string, slots: Slots) => void;
  onDropItems: (items: HeldStack[]) => void;
}) {
  const gridSize = atCraftingTable ? 3 : 2;
  const [inv, setInv] = useState<Slots>(inventory);
  const [grid, setGrid] = useState<Slots>(() => emptySlots(gridSize * gridSize));
  const [chest, setChestState] = useState<Slots>(() => (chestKey ? getChest(chestKey) : []));
  const [furnace, setFurnaceState] = useState<Slots>(() => (furnaceKey && getFurnace ? getFurnace(furnaceKey).slots : []));
  const [furnaceProgress, setFurnaceProgress] = useState({ cook: 0, burn: 0 });
  const [cursor, setCursor] = useState<HeldStack | null>(null);
  const [mouse, setMouse] = useState({ x: -100, y: -100 });
  const [recipePreview, setRecipePreview] = useState<number | null>(null);
  const [hoverId, setHoverId] = useState<number | null>(null);

  // Refs always hold the newest values, so fast clicks and drags never act on stale state
  const invRef = useRef(inv);
  const [arm, setArm] = useState<Slots>(armor);
  const armRef = useRef(arm);
  useEffect(() => { armRef.current = armor; setArm(armor); }, [armor]);
  function commitArm(next: Slots) { armRef.current = next; setArm(next); onArmorChange(next); }
  const [off, setOff] = useState<ItemStack | null>(offhand);
  const offRef = useRef(off);
  useEffect(() => { offRef.current = offhand; setOff(offhand); }, [offhand]);
  function commitOff(next: ItemStack | null) { offRef.current = next; setOff(next); onOffhandChange(next); }
  const gridRef = useRef(grid);
  const chestRef = useRef(chest);
  const cursorRef = useRef(cursor);
  const dropRef = useRef(onDropItems);
  dropRef.current = onDropItems;
  const spreadingRef = useRef(false);

  // Items picked up from the ground while the inventory is open still show up
  useEffect(() => { invRef.current = inventory; setInv(inventory); }, [inventory]);

  function commitInv(next: Slots) { invRef.current = next; setInv(next); onSlotsChange(next); }
  function commitGrid(next: Slots) { gridRef.current = next; setGrid(next); }
  function commitChest(next: Slots) { chestRef.current = next; setChestState(next); if (chestKey) onChestChange(chestKey, next); }
  const furnaceRef = useRef(furnace);
  function commitFurnace(next: Slots) { furnaceRef.current = next; setFurnaceState(next); if (furnaceKey) onFurnaceChange?.(furnaceKey, next); }
  // The furnace keeps cooking while it's open: refresh its slots and progress bars
  useEffect(() => {
    if (!furnaceKey || !getFurnace) return;
    const t = setInterval(() => {
      const f = getFurnace(furnaceKey);
      setFurnaceProgress({ cook: f.cook, burn: f.burn });
      if (JSON.stringify(f.slots) !== JSON.stringify(furnaceRef.current)) { furnaceRef.current = f.slots; setFurnaceState(f.slots); }
    }, 150);
    return () => clearInterval(t);
  }, [furnaceKey, getFurnace]);
  function commitCursor(next: HeldStack | null) { cursorRef.current = next; setCursor(next); }
  const arrOf = (c: Container): Slots => (c === 'inv' ? invRef.current : c === 'furnace' ? furnaceRef.current : c === 'chest' ? chestRef.current : c === 'offhand' ? [offRef.current] : c === 'armor' ? armRef.current : gridRef.current);
  const commit = (c: Container, next: Slots) => (c === 'inv' ? commitInv(next) : c === 'furnace' ? commitFurnace(next) : c === 'chest' ? commitChest(next) : c === 'offhand' ? commitOff(next[0] ?? null) : c === 'armor' ? commitArm(next) : commitGrid(next));

  useEffect(() => {
    const up = () => { spreadingRef.current = false; };
    window.addEventListener('mouseup', up);
    return () => window.removeEventListener('mouseup', up);
  }, []);

  // Closing drops whatever is left in the crafting grid or on your cursor
  useEffect(() => () => {
    const counts: Record<number, number> = {};
    for (const st of gridRef.current) if (st) counts[st.id] = (counts[st.id] || 0) + st.count;
    const h = cursorRef.current;
    if (h) counts[h.id] = (counts[h.id] || 0) + h.count;
    const items = Object.entries(counts).map(([id, count]) => ({ id: Number(id), count }));
    if (items.length) dropRef.current(items);
  }, []);

  function onSlotDown(e: ReactMouseEvent, c: Container, i: number) {
    e.preventDefault();
    const arr = arrOf(c).slice();
    const slot = arr[i];
    // Armor slots only take the matching piece (a helmet on your head, and so on)
    if (c === 'armor' && cursorRef.current && ARMOR[cursorRef.current.id]?.slot !== i) return;
    if (e.button === 1) { if (slot) setRecipePreview(slot.id); return; }
    if (e.shiftKey && e.button === 0) { if (slot) quickMove(c, i); return; }
    const cur = cursorRef.current;
    // The furnace's output slot is take-only (you can scoop more onto a matching stack in your hand)
    if (c === 'furnace' && i === 2) {
      if (!slot) return;
      if (!cur) { commitCursor(slot); arr[2] = null; }
      else if (cur.id === slot.id && cur.count + slot.count <= maxStack(slot.id)) { commitCursor({ id: cur.id, count: cur.count + slot.count }); arr[2] = null; }
      else return;
      commit(c, arr);
      return;
    }
    if (e.button === 0) {
      if (!cur) {
        if (!slot) return;
        commitCursor(slot); // the whole stack, whatever its size
        arr[i] = null;
      } else if (!slot) {
        arr[i] = cur;
        commitCursor(null);
      } else if (slot.id === cur.id && slot.count < maxStack(slot.id)) {
        const move = Math.min(maxStack(slot.id) - slot.count, cur.count);
        arr[i] = { id: slot.id, count: slot.count + move };
        commitCursor(cur.count - move > 0 ? { id: cur.id, count: cur.count - move } : null);
      } else {
        arr[i] = cur; // different item: swap
        commitCursor(slot);
      }
    } else if (e.button === 2) {
      if (!cur) {
        if (!slot) return;
        const half = Math.ceil(slot.count / 2);
        commitCursor({ id: slot.id, count: half });
        arr[i] = slot.count - half > 0 ? { id: slot.id, count: slot.count - half } : null;
      } else if (!slot || (slot.id === cur.id && slot.count < maxStack(slot.id))) {
        arr[i] = { id: cur.id, count: (slot ? slot.count : 0) + 1 };
        commitCursor(cur.count > 1 ? { id: cur.id, count: cur.count - 1 } : null);
        spreadingRef.current = true; // keep holding right-click and drag: 1 per slot
      } else {
        arr[i] = cur;
        commitCursor(slot);
      }
    } else {
      return;
    }
    commit(c, arr);
  }

  function onSlotEnter(e: ReactMouseEvent, c: Container, i: number) {
    if (c === 'armor' || (c === 'furnace' && i === 2)) return;
    if (!spreadingRef.current || !(e.buttons & 2)) return;
    const cur = cursorRef.current;
    if (!cur) return;
    const arr = arrOf(c).slice();
    const slot = arr[i];
    if (slot && (slot.id !== cur.id || slot.count >= maxStack(cur.id))) return;
    arr[i] = { id: cur.id, count: (slot ? slot.count : 0) + 1 };
    commitCursor(cur.count > 1 ? { id: cur.id, count: cur.count - 1 } : null);
    commit(c, arr);
  }

  // Shift-click: chest <-> inventory, grid -> inventory, hotbar <-> main inventory
  function quickMove(c: Container, i: number) {
    const src = arrOf(c).slice();
    const st = src[i];
    if (!st) return;
    // Shift-clicking armor puts it on (and shift-clicking worn armor takes it off)
    const piece = ARMOR[st.id];
    if (c === 'inv' && piece && !armRef.current[piece.slot] && !chestKey && !furnaceKey) {
      src[i] = null;
      const nextArm = armRef.current.slice();
      nextArm[piece.slot] = { id: st.id, count: 1 };
      commit('inv', src);
      commit('armor', nextArm);
      return;
    }
    if (c === 'inv' && furnaceKey) {
      const target = SMELTING[st.id] !== undefined ? 0 : FUEL_SECONDS[st.id] ? 1 : -1;
      if (target < 0) return; // it can't go in a furnace
      const f = furnaceRef.current.slice();
      const have = f[target];
      if (have && have.id !== st.id) return;
      const room = maxStack(st.id) - (have?.count ?? 0);
      const move = Math.min(room, st.count);
      if (move <= 0) return;
      f[target] = { id: st.id, count: (have?.count ?? 0) + move };
      src[i] = st.count - move > 0 ? { id: st.id, count: st.count - move } : null;
      commit('inv', src);
      commit('furnace', f);
      return;
    }
    src[i] = null;
    const dstC: Container = c === 'inv' && chestKey ? 'chest' : 'inv';
    const dst = dstC === c ? src : arrOf(dstC).slice();
    let range: [number, number] = [0, dst.length];
    if (c === 'inv' && dstC === 'inv') range = i < 9 ? [9, INVENTORY_SIZE] : [0, 9];
    const part = dst.slice(range[0], range[1]);
    const left = addToSlots(part, st.id, st.count);
    for (let k = 0; k < part.length; k++) dst[range[0] + k] = part[k];
    if (left > 0) src[i] = { id: st.id, count: left };
    commit(c, src);
    if (dstC !== c) commit(dstC, dst);
  }

  const gridIds = (g: Slots) => g.map((st) => (st ? st.id : null));
  const consumeGrid = () => commitGrid(gridRef.current.map((st) => (st && st.count > 1 ? { id: st.id, count: st.count - 1 } : null)));
  const result = craftMode === 'grid' && !chestKey && !furnaceKey ? matchRecipe(gridIds(grid), gridSize, atCraftingTable) : null;

  function onResult(e: ReactMouseEvent) {
    e.preventDefault();
    if (!result) return;
    if (e.shiftKey) {
      // Craft as many as possible straight into the inventory
      let next = invRef.current.slice();
      for (let n = 0; n < 64; n++) {
        const r = matchRecipe(gridIds(gridRef.current), gridSize, atCraftingTable);
        if (!r) break;
        const test = next.slice();
        if (addToSlots(test, r.output.id, r.output.count) > 0) break;
        next = test;
        consumeGrid();
      }
      commitInv(next);
      return;
    }
    const cur = cursorRef.current;
    const out = result.output;
    if (cur && (cur.id !== out.id || cur.count + out.count > maxStack(out.id))) return;
    consumeGrid();
    commitCursor({ id: out.id, count: (cur ? cur.count : 0) + out.count });
  }

  // Creative palette: left-click = a full stack, right-click = one, shift = straight into your inventory
  function onCreativeSlot(e: ReactMouseEvent, id: number) {
    e.preventDefault();
    if (e.button === 1) { setRecipePreview(id); return; }
    if (e.shiftKey) {
      const next = invRef.current.slice();
      addToSlots(next, id, maxStack(id));
      commitInv(next);
      return;
    }
    const cur = cursorRef.current;
    if (cur && cur.id !== id) { commitCursor(null); return; } // like Minecraft, this deletes what you held
    if (e.button === 0) commitCursor({ id, count: maxStack(id) });
    else commitCursor({ id, count: Math.min(maxStack(id), (cur ? cur.count : 0) + 1) });
  }

  // Clicking outside the panels throws the held stack into the world
  function onBackdrop(e: ReactMouseEvent) {
    if (e.target !== e.currentTarget) return;
    const h = cursorRef.current;
    if (!h) return;
    if (e.button === 2) {
      onDropItems([{ id: h.id, count: 1 }]);
      commitCursor(h.count > 1 ? { id: h.id, count: h.count - 1 } : null);
    } else {
      onDropItems([h]);
      commitCursor(null);
    }
  }

  // Switching to Quick Craft hands anything in the grid back to you first
  function switchCraftMode(m: 'grid' | 'quick') {
    if (m === craftMode) return;
    if (m === 'quick') {
      const next = invRef.current.slice();
      for (const st of gridRef.current) if (st) addToSlots(next, st.id, st.count);
      commitInv(next);
      commitGrid(emptySlots(gridSize * gridSize));
    }
    onCraftModeChange(m);
  }

  const slotRow = (c: Container, arr: Slots, from: number, to: number) =>
    arr.slice(from, to).map((st, k) => (
      <ItemSlot
        key={`${c}-${from + k}`}
        id={st ? st.id : null}
        count={st ? st.count : undefined}
        onMouseDown={(e) => onSlotDown(e, c, from + k)}
        onMouseEnter={(e) => onSlotEnter(e, c, from + k)}
      />
    ));

  const previewRecipe = recipePreview !== null ? RECIPES.find((r) => r.output.id === recipePreview) ?? null : null;
  const title = furnaceKey ? 'Furnace' : chestKey ? 'Chest' : atCraftingTable ? 'Crafting Table' : 'Inventory';

  return (
    <div
      className="absolute inset-0 z-30 bg-black/70 backdrop-blur-sm flex items-center justify-center gap-4 vb-fade-in"
      onMouseMove={(e) => setMouse({ x: e.clientX, y: e.clientY })}
      onMouseOver={(e) => {
        const el = (e.target as HTMLElement).closest('[data-item-id]');
        setHoverId(el ? Number(el.getAttribute('data-item-id')) : null);
      }}
      onMouseDown={onBackdrop}
      onContextMenu={(e) => e.preventDefault()}
    >
      <div className="w-[640px] max-w-[64vw] bg-[#0d131b] border border-[#243044] rounded-2xl p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-[var(--font-retro)] text-white text-sm tracking-wider uppercase">{title}</h3>
          <div className="flex items-center gap-3">
            {!chestKey && !furnaceKey && (
              <div className="flex bg-[#121822] border border-[#243044] rounded-lg p-0.5">
                {(['grid', 'quick'] as const).map((m) => (
                  <button
                    key={m}
                    onClick={() => switchCraftMode(m)}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-all duration-200 ${
                      craftMode === m ? 'bg-[#00e676] text-[#0a0e14]' : 'text-[#8ea0b8] hover:text-white'
                    }`}
                  >
                    {m === 'grid' ? 'Grid' : 'Quick Craft'}
                  </button>
                ))}
              </div>
            )}

          </div>
        </div>

        <div className={!chestKey && !furnaceKey && !atCraftingTable ? 'flex gap-4 items-start mb-5' : ''}>
        {!chestKey && !furnaceKey && !atCraftingTable && (
          <>
            <div className="flex flex-col gap-1">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="relative" title={ARMOR_PIECES[i]}>
                  <ItemSlot id={arm[i] ? arm[i]!.id : null} onMouseDown={(e) => onSlotDown(e, 'armor', i)} />
                  {!arm[i] && <span className="absolute inset-0 flex items-center justify-center text-[8px] font-bold text-black/35 pointer-events-none">{['HEAD', 'CHEST', 'LEGS', 'FEET'][i]}</span>}
                </div>
              ))}
            </div>
            <PlayerPreview armor={arm} mouse={mouse} />
            <div className="flex flex-col items-center self-end" title="Off-hand (F swaps)">
              <ItemSlot id={off ? off.id : null} count={off?.count} onMouseDown={(e) => onSlotDown(e, 'offhand', 0)} onMouseEnter={(e) => onSlotEnter(e, 'offhand', 0)} />
              <span className="text-[#5a6b80] text-[9px] mt-0.5">Off-hand</span>
            </div>
          </>
        )}
        <div className="flex-1 min-w-0">
        {furnaceKey ? (
          <div className="flex items-center gap-6 mb-5" data-testid="furnace">
            <div className="flex flex-col items-center gap-1.5">
              <span className="text-[10px] text-[#8ea0b8]">Smelt</span>
              {slotRow('furnace', furnace, 0, 1)}
              <div className="w-7 h-7 rounded bg-[#1a1a1a] overflow-hidden flex items-end" title="Fuel left">
                <div className="w-full bg-gradient-to-t from-[#ff5a1a] to-[#ffd23a]" style={{ height: `${Math.round(furnaceProgress.burn * 100)}%` }} />
              </div>
              {slotRow('furnace', furnace, 1, 2)}
              <span className="text-[10px] text-[#8ea0b8]">Fuel</span>
            </div>
            <div className="w-20 h-4 rounded-full bg-[#1a1a1a] overflow-hidden" title="Cooking">
              <div className="h-full bg-[#e9ecec]" style={{ width: `${Math.round(furnaceProgress.cook * 100)}%` }} />
            </div>
            <div className="flex flex-col items-center gap-1.5">
              {slotRow('furnace', furnace, 2, 3)}
              <span className="text-[10px] text-[#8ea0b8]">Result</span>
            </div>
          </div>
        ) : chestKey ? (
          <div className="grid grid-cols-9 gap-1 mb-5 w-fit">{slotRow('chest', chest, 0, chest.length)}</div>
        ) : craftMode === 'quick' ? (
          <div className="flex flex-col gap-1.5 mb-5 max-h-64 overflow-y-auto vb-scroll pr-1">
            {RECIPES.filter((r) => {
              const tableOk = !r.needsTable || atCraftingTable;
              return tableOk && ingredientsOf(r).every((x) => countInSlots(inv, x.id) >= x.count);
            }).length === 0 && (
              <p className="text-[#5a6b80] text-xs py-2">
                Nothing craftable with what you're carrying yet{atCraftingTable ? '' : ' — some recipes also need a crafting table'}.
              </p>
            )}
            {RECIPES.filter((r) => {
              const tableOk = !r.needsTable || atCraftingTable;
              return tableOk && ingredientsOf(r).every((x) => countInSlots(inv, x.id) >= x.count);
            }).map((r) => {
              const ing = ingredientsOf(r);
              return (
                <button
                  key={r.id}
                  onClick={() => onQuickCraft(r.id)}
                  className="flex items-center justify-between px-3 py-2 rounded-xl border transition-all duration-200 bg-[#00e676]/10 border-[#00e676]/30 hover:bg-[#00e676]/20 hover:scale-[1.01] active:scale-[0.98]"
                >
                  <div className="flex items-center gap-1.5">
                    {ing.map((x) => (
                      <span key={x.id} className="flex items-center gap-0.5 text-xs">
                        <span className="text-white">{x.count}</span>
                        <ItemIcon id={x.id} className="w-6 h-6" />
                      </span>
                    ))}
                    <span className="text-[#5a6b80] mx-1">→</span>
                    <span className="text-xs text-white">{r.output.count}</span>
                    <ItemIcon id={r.output.id} className="w-6 h-6" />
                    <span className="text-white text-xs font-medium ml-1">{r.name}</span>
                  </div>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="flex items-center gap-5 mb-5">
            <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${gridSize}, minmax(0, 1fr))` }}>
              {slotRow('grid', grid, 0, grid.length)}
            </div>
            <span className="text-[#5a6b80] text-2xl">→</span>
            <ItemSlot id={result ? result.output.id : null} count={result?.output.count} highlight={!!result} onMouseDown={onResult} />
            {result && <span className="text-white text-xs">{result.name}</span>}
          </div>
        )}
        </div>
        </div>

        <h4 className="text-white text-xs font-medium mb-2">Inventory</h4>
        <div className="grid grid-cols-9 gap-1 w-fit">{slotRow('inv', inv, 9, INVENTORY_SIZE)}</div>
        <div className="flex items-end gap-3 mt-2.5">
          <div className="grid grid-cols-9 gap-1 w-fit">{slotRow('inv', inv, 0, 9)}</div>
        </div>

        {previewRecipe && (
          <div className="mt-4 p-3 rounded-xl bg-[#121822] border border-[#243044] vb-fade-in">
            <div className="flex items-center justify-between mb-2">
              <span className="text-white text-xs font-medium">{previewRecipe.name} recipe</span>
              <button onClick={() => setRecipePreview(null)} className="text-[#5a6b80] text-xs hover:text-white">close</button>
            </div>
            <div className="flex items-center gap-3">
              <div className="grid gap-1 w-fit" style={{ gridTemplateColumns: `repeat(${previewRecipe.width}, minmax(0, 1fr))` }}>
                {previewRecipe.pattern.map((pid, i) => <ItemSlot key={i} id={pid} size="sm" />)}
              </div>
              <span className="text-[#5a6b80]">→</span>
              <ItemSlot id={previewRecipe.output.id} count={previewRecipe.output.count} size="sm" />
            </div>
            {previewRecipe.needsTable && <p className="text-amber-500 text-[10px] mt-2">Requires a crafting table</p>}
          </div>
        )}
        {recipePreview !== null && !previewRecipe && (
          <p className="text-[#5a6b80] text-[10px] mt-2">{ITEM_INFO[recipePreview]?.name} can't be crafted. You find it in the world.</p>
        )}
      </div>

      {isCreative && (
        <div className="w-[230px] max-h-[70vh] bg-[#0d131b] border border-[#243044] rounded-2xl p-4 shadow-2xl overflow-y-auto vb-scroll">
          <h4 className="text-white text-xs font-medium mb-2">All Items (Creative)</h4>
          <div className="grid grid-cols-4 gap-1">
            {allItemIds().map((id) => (
              <ItemSlot key={id} id={id} size="sm" onMouseDown={(e) => onCreativeSlot(e, id)} />
            ))}
          </div>
          <p className="text-[#5a6b80] text-[10px] mt-2">Free. Click = full stack, right-click = 1, shift = into inventory</p>
        </div>
      )}

      {hoverId !== null && !cursor && ITEM_INFO[hoverId] && (
        <div className="fixed z-50 pointer-events-none max-w-[260px] px-2.5 py-1.5 bg-[#12001c]/95 border-2 border-[#2c0a63] rounded" style={{ left: mouse.x + 16, top: mouse.y - 12 }}>
          <div className="text-white text-sm">{ITEM_INFO[hoverId].name}</div>
          {(ITEM_INFO[hoverId].lore ?? []).map((l, i) => <div key={i} className="text-xs leading-5"><ColorText text={l} color="#aaaaaa" /></div>)}
        </div>
      )}
      {cursor && (
        <div className="fixed z-50 pointer-events-none" style={{ left: mouse.x - 18, top: mouse.y - 18 }}>
          <ItemIcon id={cursor.id} className="w-9 h-9" />
          {cursor.count > 1 && (
            <span className="absolute bottom-0 right-0 text-[11px] text-white font-bold drop-shadow-[0_1px_0_black]">{cursor.count}</span>
          )}
        </div>
      )}
    </div>
  );
}

// ===================================================================
//  Chat, commands, /help, F3 debug screen, and HUD overlays
// ===================================================================

type ChatMessage = { id: number; text: string; color: string; time: number };
type HudPrefs = { keystrokes: boolean; cps: boolean; fps: boolean };

const COMMANDS: Array<{ names: string[]; usage: string; desc: string }> = [
  { names: ['help', '?'], usage: '/help', desc: 'Show this list of commands.' },
  { names: ['gamemode', 'mode', 'gm'], usage: '/gamemode <mode>', desc: 'Change your game mode: survival (s, 0), creative (c, 1), adventure (a, 2) or spectator (sp, 3).' },
  { names: ['tp', 'teleport'], usage: '/tp <x> <y> <z>', desc: 'Teleport. Use ~ for "where I am now", e.g. /tp ~ ~20 ~ goes 20 blocks up.' },
  { names: ['give'], usage: '/give <item> [count]', desc: 'Give yourself an item, e.g. /give diamond 5 or /give stone_pickaxe.' },
  { names: ['clear'], usage: '/clear', desc: 'Empty your inventory.' },
  { names: ['kill'], usage: '/kill', desc: 'Die and respawn at spawn.' },
  { names: ['time'], usage: '/time set <day|noon|sunset|night|midnight|0-24000>', desc: 'Change the time of day. Monsters only spawn at night.' },
  { names: ['list'], usage: '/list', desc: 'Show who is online (multiplayer). You can also hold Tab.' },
  { names: ['seed'], usage: '/seed', desc: 'Show this world\'s seed.' },
  { names: ['summon'], usage: '/summon <mob>', desc: 'Spawn a mob in front of you: pig, cow, chicken, zombie, skeleton, creeper, spider, ghast, piglin, villager or iron golem.' },
  { names: ['locate'], usage: '/locate village', desc: 'Find the closest village. Villages are rare, so this tells you which way to walk.' },
];

const MODE_ALIASES: Record<string, PlayMode> = {
  s: 'survival', survival: 'survival', '0': 'survival',
  c: 'creative', creative: 'creative', '1': 'creative',
  a: 'adventure', adventure: 'adventure', '2': 'adventure',
  sp: 'spectator', spectator: 'spectator', '3': 'spectator',
};

const MODE_INFO: Array<{ mode: PlayMode; aliases: string; desc: string }> = [
  { mode: 'survival', aliases: 's, 0', desc: 'Health, hunger, fall damage. Mine and craft to progress.' },
  { mode: 'creative', aliases: 'c, 1', desc: 'Can\'t die, free items, instant breaking. Double-tap Space to fly (you still collide with blocks).' },
  { mode: 'adventure', aliases: 'a, 2', desc: 'Like survival, but you can\'t break or place blocks.' },
  { mode: 'spectator', aliases: 'sp, 3', desc: 'Invisible, always flying, and you pass through blocks. Can\'t interact with anything.' },
];

function normalizeItemName(n: string): string {
  return n.toLowerCase().replace(/[\s_-]/g, '');
}

function itemIdFromName(name: string): number | null {
  if (name.includes(':')) return customIdForKey(name.toLowerCase().trim());
  if (/^\d+$/.test(name)) {
    const id = Number(name);
    return ITEM_INFO[id] ? id : null;
  }
  const n = normalizeItemName(name);
  for (const [id, info] of Object.entries(ITEM_INFO)) {
    if (normalizeItemName(info.name) === n) return Number(id);
  }
  return null;
}

/** Script block names: "stone", "white_concrete", "air", "water", "lava". */
function blockIdFromName(name: unknown): number {
  if (String(name).includes(':')) {
    const id = customIdForKey(String(name).toLowerCase());
    if (id === null || !isBlockId(id)) throw new Error(`"${String(name)}" isn't a block`);
    return id;
  }
  const n = normalizeItemName(String(name));
  if (n === 'air') return 0;
  if (n === 'water') return BLOCK_WATER;
  if (n === 'lava') return BLOCK_LAVA;
  const id = itemIdFromName(String(name));
  if (id === null || !isBlockId(id)) throw new Error(`"${String(name)}" isn't a block`);
  return id;
}

function blockNameOf(id: number): string {
  if (id === 0) return 'air';
  if (isWater(id)) return 'water';
  if (isLava(id)) return 'lava';
  const custom = CUSTOM_BLOCKS.get(id) ?? CUSTOM_ITEMS.get(id);
  if (custom) return custom.key;
  const info = ITEM_INFO[id];
  return info ? info.name.toLowerCase().replace(/ /g, '_') : 'unknown';
}

const MC_COLORS: Record<string, string> = {
  black: '#000000', dark_blue: '#0000aa', dark_green: '#00aa00', dark_aqua: '#00aaaa', dark_red: '#aa0000', dark_purple: '#aa00aa',
  gold: '#ffaa00', gray: '#aaaaaa', dark_gray: '#555555', blue: '#5555ff', green: '#55ff55', lime: '#55ff55', aqua: '#55ffff',
  red: '#ff5555', light_purple: '#ff55ff', pink: '#ff77cc', yellow: '#ffff55', white: '#ffffff', orange: '#ff9933',
};

/** Shows Miniblox/Minecraft-style color codes like \red\, \gold\, \bold\ (unknown codes stay as typed). */
function ColorText({ text, color }: { text: string; color?: string }) {
  type St = { color?: string; bold: boolean; italic: boolean; flair: boolean };
  const base: St = { color, bold: false, italic: false, flair: false };
  const style = (st: St) => (st.flair
    ? { backgroundImage: 'linear-gradient(90deg,#ff5f6d,#ffc371,#5fe05f,#4dd2ff,#b070ff)', WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent', fontWeight: 700 }
    : { color: st.color, fontWeight: st.bold ? 700 : undefined, fontStyle: st.italic ? 'italic' : undefined });
  const parts: ReactNode[] = [];
  let st = base;
  let last = 0;
  const re = /\\([a-z_]+)\\/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    if (m.index > last) parts.push(<span key={parts.length} style={style(st)}>{text.slice(last, m.index)}</span>);
    const code = m[1];
    if (MC_COLORS[code]) st = { ...st, color: MC_COLORS[code], flair: false };
    else if (code === 'bold') st = { ...st, bold: true };
    else if (code === 'italic') st = { ...st, italic: true };
    else if (code === 'flair') st = { ...st, flair: true };
    else if (code === 'reset') st = base;
    else parts.push(<span key={parts.length} style={style(st)}>{m[0]}</span>);
    last = re.lastIndex;
  }
  if (last < text.length) parts.push(<span key={parts.length} style={style(st)}>{text.slice(last)}</span>);
  return <>{parts}</>;
}

/** Mob names from commands and scripts: "iron golem", "iron-golem" and "iron_golem" are all the same. */
const mobName = (v: unknown) => String(v ?? '').toLowerCase().trim().replace(/[\s-]+/g, '_');

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function ChatBox({ open, initialText, messages, history, onSubmit }: {
  open: boolean;
  initialText: string;
  messages: ChatMessage[];
  history: string[];
  onSubmit: (text: string) => void;
}) {
  const [text, setText] = useState(initialText);
  const [histIdx, setHistIdx] = useState(-1);
  const [, setTick] = useState(0);
  const listRef = useRef<HTMLDivElement | null>(null);

  // Re-render twice a second so old messages fade out on time
  useEffect(() => {
    const t = setInterval(() => setTick((v) => v + 1), 500);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (open && listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [open, messages.length]);

  const now = Date.now();
  const shown = open ? messages.slice(-50) : messages.slice(-10);
  const typedCmd = text.startsWith('/') && !text.includes(' ') ? text.slice(1).toLowerCase() : null;
  const suggestions = open && typedCmd !== null
    ? COMMANDS.filter((c) => c.names.some((n) => n.startsWith(typedCmd))).slice(0, 6)
    : [];

  function onKeyDown(e: ReactKeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault();
      e.stopPropagation(); // don't let this same Enter re-open chat
      onSubmit(text);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const i = Math.min(history.length - 1, histIdx + 1);
      if (i >= 0) { setHistIdx(i); setText(history[history.length - 1 - i]); }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      const i = histIdx - 1;
      setHistIdx(Math.max(-1, i));
      setText(i >= 0 ? history[history.length - 1 - i] : '');
    } else if (e.key === 'Tab') {
      e.preventDefault();
      if (suggestions[0]) setText('/' + suggestions[0].names[0] + ' ');
    }
  }

  return (
    <div className="absolute left-3 bottom-32 z-30 w-[420px] max-w-[60vw] flex flex-col gap-1">
      <div
        ref={listRef}
        className={`flex flex-col gap-0.5 ${open ? 'max-h-[40vh] overflow-y-auto vb-scroll pointer-events-auto' : 'pointer-events-none'}`}
      >
        {shown.map((m) => (
          <div
            key={m.id}
            className="px-2 py-0.5 text-sm bg-black/45 break-words transition-opacity duration-700"
            style={{ color: m.color, opacity: open || now - m.time < 8000 ? 1 : 0 }}
          >
            <ColorText text={m.text} color={m.color} />
          </div>
        ))}
      </div>
      {open && suggestions.length > 0 && (
        <div className="bg-black/75 border border-white/10 rounded-md py-1 vb-fade-in">
          {suggestions.map((c, i) => (
            <div key={c.usage} className={`px-2 py-0.5 text-xs font-mono ${i === 0 ? 'text-[#ffe066]' : 'text-[#c8c8c8]'}`}>
              {c.usage}
              {c.names.length > 1 && <span className="text-[#7a7a7a]"> (also /{c.names.slice(1).join(', /')})</span>}
            </div>
          ))}
          <div className="px-2 pt-0.5 text-[10px] text-[#7a7a7a]">Tab to autocomplete</div>
        </div>
      )}
      {open && (
        <input
          autoFocus
          value={text}
          maxLength={256}
          onChange={(e) => { setText(e.target.value); setHistIdx(-1); }}
          onKeyDown={onKeyDown}
          className="w-full px-2 py-1.5 bg-black/65 text-white text-sm font-mono outline-none border border-white/20 focus:border-white/50 rounded-sm transition-colors"
          placeholder="Type a message, or / for commands"
        />
      )}
    </div>
  );
}

function HelpPanel({ onClose, extra = [] }: { onClose: () => void; extra?: Array<{ usage: string; desc: string }> }) {
  return (
    <div
      className="absolute inset-0 z-40 bg-black/60 backdrop-blur-sm flex items-center justify-center vb-fade-in"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-[600px] max-w-[92vw] max-h-[82vh] overflow-y-auto vb-scroll bg-[#0d131b] border border-[#243044] rounded-2xl p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-[var(--font-retro)] text-white text-sm tracking-wider uppercase">Commands</h3>
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded-lg bg-[#121822] border border-[#243044] text-[#8ea0b8] text-xs transition-all duration-200 hover:text-white hover:border-[#364860] active:scale-95"
          >
            Close (Esc)
          </button>
        </div>

        <div className="flex flex-col gap-2 mb-6">
          {COMMANDS.map((c) => (
            <div key={c.usage} className="p-3 rounded-xl bg-[#121822] border border-[#243044]">
              <div className="flex items-baseline gap-2 flex-wrap">
                <span className="font-mono text-sm text-[#00e676]">{c.usage}</span>
                {c.names.length > 1 && (
                  <span className="text-[11px] text-[#5a6b80]">also {c.names.slice(1).map((n) => '/' + n).join(', ')}</span>
                )}
              </div>
              <p className="text-[#8ea0b8] text-xs mt-1">{c.desc}</p>
            </div>
          ))}
        </div>

        {extra.length > 0 && (
          <>
            <h4 className="text-white text-xs font-medium mb-2 uppercase tracking-wide">From your mods &amp; scripts</h4>
            <div className="flex flex-col gap-2 mb-6">
              {extra.map((c) => (
                <div key={c.usage} className="p-3 rounded-xl bg-[#121822] border border-[#243044]">
                  <span className="font-mono text-sm text-[#7dd3fc]">{c.usage}</span>
                  <p className="text-[#8ea0b8] text-xs mt-1">{c.desc}</p>
                </div>
              ))}
            </div>
          </>
        )}

        <h4 className="text-white text-xs font-medium mb-2 uppercase tracking-wide">Game modes</h4>
        <div className="flex flex-col gap-1.5 mb-6">
          {MODE_INFO.map((m) => (
            <div key={m.mode} className="flex gap-3 text-xs">
              <span className="w-24 shrink-0 text-white font-medium">{capitalize(m.mode)}</span>
              <span className="w-12 shrink-0 font-mono text-[#5a6b80]">{m.aliases}</span>
              <span className="text-[#8ea0b8]">{m.desc}</span>
            </div>
          ))}
        </div>

        <h4 className="text-white text-xs font-medium mb-2 uppercase tracking-wide">Controls</h4>
        <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs text-[#8ea0b8]">
          <span><b className="text-white">T</b> / <b className="text-white">Enter</b> open chat</span>
          <span><b className="text-white">/</b> open chat with a command</span>
          <span><b className="text-white">Tab</b> autocomplete a command</span>
          <span><b className="text-white">↑ / ↓</b> previous messages</span>
          <span><b className="text-white">F3</b> debug screen</span>
          <span><b className="text-white">E</b> inventory · <b className="text-white">Q</b> drop</span>
          <span><b className="text-white">F5</b> change camera view</span>
          <span><b className="text-white">Esc</b> game menu</span>
          <span><b className="text-white">Right-click</b> with food to eat</span>
          <span><b className="text-white">Hold right-click</b> to draw a bow</span>
          <span><b className="text-white">Right-click</b> buckets / ender pearls</span>
        </div>
      </div>
    </div>
  );
}

function DebugOverlay({ getInfo }: { getInfo: () => DebugInfo | null }) {
  const [info, setInfo] = useState<DebugInfo | null>(null);
  useEffect(() => {
    const tick = () => setInfo(getInfo());
    tick();
    const t = setInterval(tick, 200);
    return () => clearInterval(t);
  }, []);
  if (!info) return null;
  const inChunk = `${((info.blockX % 16) + 16) % 16} ${((info.blockZ % 16) + 16) % 16}`;
  const lines = [
    `VibeBlox  (${info.fps} fps)`,
    `XYZ: ${info.x.toFixed(3)} / ${info.y.toFixed(3)} / ${info.z.toFixed(3)}`,
    `Block: ${info.blockX} ${info.blockY} ${info.blockZ}`,
    `Chunk: ${info.chunkX} ${info.chunkZ}  (block ${inChunk} in chunk)`,
    `Facing: ${info.facing}  (${info.yaw.toFixed(1)} / ${info.pitch.toFixed(1)})`,
    `Dimension: ${info.dimension}`,
    `Biome: ${info.biome}`,
    `Mode: ${info.mode}${info.flying ? ' (flying)' : ''}`,
    `Chunks: ${info.loadedChunks} loaded, render distance ${info.renderDistance}`,
    `Graphics: ${info.graphics}`,
    `Camera: ${info.camera} (F5)`,
    `Mobs nearby: ${info.mobs}`,
    `Time: ${info.clock}${info.night ? ' (night)' : ''}`,
    `Seed: ${info.seed}`,
    info.target ? `Looking at: ${info.target.name} @ ${info.target.x} ${info.target.y} ${info.target.z}` : 'Looking at: nothing',
  ];
  return (
    <div className="absolute top-3 left-3 z-20 pointer-events-none font-mono text-[12px] leading-[18px] text-white flex flex-col items-start gap-0.5">
      {lines.map((t, i) => (
        <div key={i} className={`bg-black/45 px-1.5 ${i === 0 ? 'text-[#ffe066]' : ''}`}>{t}</div>
      ))}
    </div>
  );
}

function HudOverlays({ prefs, getFps, paused }: { prefs: HudPrefs; getFps: () => number; paused: boolean }) {
  const [pressed, setPressed] = useState<Record<string, boolean>>({});
  const [, setTick] = useState(0);
  const clicksRef = useRef<{ left: number[]; right: number[] }>({ left: [], right: [] });
  const pausedRef = useRef(paused);
  pausedRef.current = paused;
  const anyOn = prefs.keystrokes || prefs.cps || prefs.fps;

  useEffect(() => {
    if (!anyOn) return;
    const down = (e: KeyboardEvent) => {
      if (pausedRef.current) return; // don't light up keys while typing in chat
      setPressed((p) => (p[e.code] ? p : { ...p, [e.code]: true }));
    };
    const up = (e: KeyboardEvent) => setPressed((p) => (p[e.code] ? { ...p, [e.code]: false } : p));
    const mdown = (e: MouseEvent) => {
      if (pausedRef.current) return;
      const now = performance.now();
      if (e.button === 0) clicksRef.current.left.push(now);
      if (e.button === 2) clicksRef.current.right.push(now);
      setPressed((p) => ({ ...p, [`Mouse${e.button}`]: true }));
    };
    const mup = (e: MouseEvent) => setPressed((p) => ({ ...p, [`Mouse${e.button}`]: false }));
    const t = setInterval(() => setTick((v) => v + 1), 100);
    window.addEventListener('keydown', down, true);
    window.addEventListener('keyup', up, true);
    window.addEventListener('mousedown', mdown, true);
    window.addEventListener('mouseup', mup, true);
    return () => {
      clearInterval(t);
      window.removeEventListener('keydown', down, true);
      window.removeEventListener('keyup', up, true);
      window.removeEventListener('mousedown', mdown, true);
      window.removeEventListener('mouseup', mup, true);
    };
  }, [anyOn]);

  if (!anyOn) return null;
  const now = performance.now();
  const countCps = (arr: number[]) => {
    while (arr.length && now - arr[0] > 1000) arr.shift();
    return arr.length;
  };
  const lcps = countCps(clicksRef.current.left);
  const rcps = countCps(clicksRef.current.right);

  const keyBox = (code: string, label: string, sub?: string, wide = false) => (
    <div
      className={`${wide ? 'col-span-3 h-7' : 'h-11'} flex flex-col items-center justify-center rounded-md text-xs font-bold transition-colors duration-75 ${
        pressed[code] ? 'bg-white/85 text-black' : 'bg-black/45 text-white'
      }`}
    >
      <span>{label}</span>
      {sub && <span className="text-[9px] font-normal opacity-80">{sub}</span>}
    </div>
  );

  return (
    <div className="absolute top-3 right-3 z-20 flex flex-col gap-1 items-end pointer-events-none">
      {prefs.fps && <div className="bg-black/45 text-white text-xs font-bold px-2 py-1 rounded-md">{getFps()} FPS</div>}
      {prefs.keystrokes && (
        <div className="grid grid-cols-3 gap-1 w-[144px]">
          <div />
          {keyBox('KeyW', 'W')}
          <div />
          {keyBox('KeyA', 'A')}
          {keyBox('KeyS', 'S')}
          {keyBox('KeyD', 'D')}
          <div className="col-span-3 grid grid-cols-2 gap-1">
            {keyBox('Mouse0', 'LMB', prefs.cps ? `${lcps} CPS` : undefined)}
            {keyBox('Mouse2', 'RMB', prefs.cps ? `${rcps} CPS` : undefined)}
          </div>
          {keyBox('Space', '———', undefined, true)}
        </div>
      )}
      {prefs.cps && !prefs.keystrokes && (
        <div className="bg-black/45 text-white text-xs font-bold px-2 py-1 rounded-md">{lcps} | {rcps} CPS</div>
      )}
    </div>
  );
}

const MENU_COLORS = {
  green: 'bg-[#2e7d32] border-[#66bb6a]',
  gray: 'bg-[#3a3a3a] border-[#6e6e6e]',
  blue: 'bg-[#2a5d9c] border-[#5b8fd1]',
  teal: 'bg-[#0f7a6e] border-[#45a99d]',
  red: 'bg-[#8b2a2a] border-[#c25a5a]',
} as const;

function MenuButton({ color, label, icon: Icon, onClick, soon = false, disabled = false }: {
  color: keyof typeof MENU_COLORS;
  label: string;
  icon: typeof Play;
  onClick?: () => void;
  soon?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={soon || disabled ? undefined : onClick}
      disabled={soon || disabled}
      className={`relative w-full py-3 border-2 ${MENU_COLORS[color]} text-white font-[var(--font-retro)] text-xs tracking-wide flex items-center justify-center gap-2 transition-all duration-150 ${
        soon || disabled ? 'opacity-60 cursor-not-allowed' : 'hover:brightness-125 hover:scale-[1.02] active:scale-[0.98]'
      }`}
      style={{ boxShadow: 'inset 0 -3px 0 rgba(0,0,0,0.25)' }}
    >
      <Icon className="w-4 h-4" />
      {label}
      {soon && <span className="absolute top-1 right-1.5 text-[8px] px-1 rounded bg-black/40 font-sans">SOON</span>}
    </button>
  );
}

/** Esc menu. The game keeps running behind it (nothing is paused). */
type MenuPage = 'main' | 'settings' | 'scripts' | 'mods' | 'shop';

function GameMenu({ page, onResume, onOpenSettings, onOpenScripts, onOpenMods, onOpenShop, onBack, onExit, children }: {
  page: MenuPage;
  onOpenShop: () => void;
  onOpenScripts: () => void;
  onOpenMods: () => void;
  onResume: () => void;
  onOpenSettings: () => void;
  onBack: () => void;
  onExit: () => void;
  children?: ReactNode;
}) {
  return (
    <div className="absolute inset-0 z-40 bg-black/55 flex items-center justify-center vb-fade-in" onContextMenu={(e) => e.preventDefault()}>
      {page === 'main' ? (
        <div className="w-[400px] max-w-[90vw] flex flex-col gap-2.5">
          <h2 className="font-[var(--font-retro)] text-white text-2xl text-center mb-4 drop-shadow-[0_3px_0_rgba(0,0,0,0.6)]">Game Menu</h2>
          <MenuButton color="green" icon={Play} label="Resume" onClick={onResume} />
          <MenuButton color="gray" icon={Settings} label="Settings" onClick={onOpenSettings} />
          <div className="grid grid-cols-2 gap-2.5">
            <MenuButton color="blue" icon={ScrollText} label="Scripts" onClick={onOpenScripts} />
            <MenuButton color="teal" icon={Package} label="Mods" onClick={onOpenMods} />
          </div>
          <MenuButton color="green" icon={ShoppingBag} label="Shop" onClick={onOpenShop} />
          <MenuButton color="red" icon={LogOut} label="Exit Game" onClick={onExit} />
          <p className="text-center text-white/50 text-[11px] mt-2">The world keeps running while this menu is open · Esc to resume</p>
        </div>
      ) : (
        <div className={`${page === 'settings' ? 'w-[640px]' : page === 'scripts' ? 'w-[1180px]' : 'w-[820px]'} max-w-[96vw] max-h-[86vh] flex flex-col bg-[#0a0e14]/95 border border-[#243044] rounded-2xl shadow-2xl overflow-hidden vb-fade-in`}>
          <div className="flex items-center gap-3 px-5 py-3 border-b border-[#243044]">
            <button
              onClick={onBack}
              className="w-8 h-8 rounded-lg bg-[#121822] border border-[#243044] flex items-center justify-center text-[#8ea0b8] transition-all duration-200 hover:text-white hover:border-[#364860] active:scale-95"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="font-[var(--font-retro)] text-white text-xs tracking-wider">{page.toUpperCase()}</span>
          </div>
          <div className="overflow-y-auto vb-scroll p-5">{children}</div>
        </div>
      )}
    </div>
  );
}

/** Minecraft-style death screen: no automatic respawn. */
function DeathScreen({ reason, onRespawn, onExit }: { reason: string; onRespawn: () => void; onExit: () => void }) {
  // The buttons unlock after a moment so a panicked click doesn't respawn you instantly
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setReady(true), 1000);
    return () => clearTimeout(t);
  }, []);
  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center vb-fade-in" style={{ background: 'rgba(110, 0, 0, 0.5)' }} onContextMenu={(e) => e.preventDefault()}>
      <div className="w-[400px] max-w-[90vw] flex flex-col items-center gap-2.5">
        <h2 className="font-[var(--font-retro)] text-white text-3xl mb-3 drop-shadow-[0_3px_0_rgba(0,0,0,0.6)]">You Died!</h2>
        <p className="text-white text-sm mb-5 text-center">
          You have died by: <span className="font-semibold text-[#ffd0d0]">{reason}</span>
        </p>
        <MenuButton color="green" icon={Heart} label="Respawn" onClick={onRespawn} disabled={!ready} />
        <MenuButton color="gray" icon={LogOut} label="Exit to Menu" onClick={onExit} disabled={!ready} />
      </div>
    </div>
  );
}

type NetStatus = 'offline' | 'connecting' | 'online';

function ServersView({ serverUrl, onServerUrlChange, onJoin, status, error, available }: {
  serverUrl: string;
  onServerUrlChange: (v: string) => void;
  onJoin: () => void;
  status: NetStatus;
  error: string | null;
  available: boolean;
}) {
  const connecting = status === 'connecting';
  return (
    <div className="vb-fade-in max-w-2xl">
      <header className="mb-8">
        <div className="flex items-center gap-2 mb-2">
          <Globe className="w-5 h-5 text-[#00e676]" />
          <span className="font-[var(--font-retro)] text-[10px] text-[#00e676]">MULTIPLAYER</span>
        </div>
        <h1 className="font-[var(--font-retro)] text-xl text-white leading-relaxed tracking-wider">PLAY WITH FRIENDS</h1>
        <p className="text-[#5a6b80] text-sm mt-1">Join a VibeBlox server by its address.</p>
      </header>

      <section className="bg-[#121822] rounded-2xl border border-[#243044] p-6">
        <label className="text-white text-sm font-medium">Server address</label>
        <div className="flex gap-2 mt-2">
          <input
            type="text"
            value={serverUrl}
            onChange={(e) => onServerUrlChange(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !connecting) onJoin(); }}
            placeholder="play.vibeblox.online"
            className="flex-1 bg-[#0a0e14] border border-[#243044] rounded-xl px-4 py-3 text-white text-sm placeholder-[#364860] focus:border-[#00e676] focus:outline-none transition-colors"
          />
          <button
            onClick={onJoin}
            disabled={connecting || !available}
            className={`px-6 rounded-xl font-[var(--font-display)] text-sm tracking-wide transition-all duration-200 ${
              connecting
                ? 'bg-[#243044] text-[#8ea0b8] cursor-wait'
                : 'bg-gradient-to-r from-[#00e676] to-[#00b248] text-[#0a0e14] hover:scale-[1.03] active:scale-95'
            }`}
          >
            {connecting ? 'Connecting…' : 'Join'}
          </button>
        </div>
        {error && <p className="text-red-400 text-xs mt-3 vb-fade-in">{error}</p>}
        {!available && (
          <p className="text-amber-500 text-xs mt-3">Multiplayer isn't installed in this copy of the game (src/multiplayer.ts is missing). Add the file back to play online.</p>
        )}
        <p className="text-[#5a6b80] text-xs mt-4">
          Uses a secure <span className="font-mono text-[#8ea0b8]">wss://</span> connection. Just the domain is fine, e.g.{' '}
          <span className="font-mono text-[#8ea0b8]">play.vibeblox.online</span>.
        </p>
      </section>

      <section className="bg-[#121822] rounded-2xl border border-[#243044] p-6 mt-6">
        <h2 className="text-white text-sm font-medium mb-2">What's shared between players</h2>
        <p className="text-[#8ea0b8] text-xs leading-relaxed">
          The world (same seed for everyone), every block broken or placed, players moving around with name tags, chat,
          and the time of day. Spectators are invisible to everyone else. Mobs and dropped items are still separate for
          each player for now.
        </p>
        <p className="text-[#5a6b80] text-xs mt-3">In game: hold <b className="text-white">Tab</b> for the player list, or type <span className="font-mono">/list</span>.</p>
      </section>
    </div>
  );
}

function PlayerList({ players, myId }: { players: Record<number, string>; myId: number | null }) {
  const entries = Object.entries(players).sort((a, b) => a[1].localeCompare(b[1]));
  return (
    <div className="absolute top-8 left-1/2 -translate-x-1/2 z-30 w-[300px] bg-black/60 rounded-lg p-3 pointer-events-none vb-fade-in">
      <div className="text-center text-white text-xs font-bold mb-2">Players online ({entries.length})</div>
      <div className="flex flex-col gap-0.5">
        {entries.map(([id, name]) => (
          <div key={id} className={`px-2 py-0.5 text-sm bg-white/10 ${Number(id) === myId ? 'text-[#ffe066]' : 'text-white'}`}>{name}</div>
        ))}
      </div>
    </div>
  );
}

function DisconnectedScreen({ reason, onExit }: { reason: string; onExit: () => void }) {
  return (
    <div className="absolute inset-0 z-50 bg-black/70 flex items-center justify-center vb-fade-in" onContextMenu={(e) => e.preventDefault()}>
      <div className="w-[420px] max-w-[90vw] flex flex-col items-center gap-3">
        <h2 className="font-[var(--font-retro)] text-white text-xl mb-2">Disconnected</h2>
        <p className="text-[#c8c8c8] text-sm text-center mb-4">{reason}</p>
        <MenuButton color="gray" icon={LogOut} label="Back to Menu" onClick={onExit} />
      </div>
    </div>
  );
}

// ===================================================================
//  Scripts & Mods panels (Esc menu)
// ===================================================================

type LogLine = { id: number; text: string; kind: 'log' | 'error' | 'chat' };

type ScriptDoc = { id: string; name: string; code: string };

/** Several scripts at once: a list on the left, the editor in the middle, the AI on the right. */
/** Scripts | Mod Builder, at the top of the Scripts page */
function ScriptsTabs({ tab, onTab }: { tab: 'scripts' | 'builder'; onTab?: (t: 'scripts' | 'builder') => void }) {
  const btn = (t: 'scripts' | 'builder', label: string) => (
    <button onClick={() => onTab?.(t)} data-testid={`scripts-tab-${t}`}
      className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${tab === t ? 'bg-[#00e676] text-[#0a0e14]' : 'bg-[#121822] border border-[#243044] text-[#8ea0b8] hover:text-white'}`}>{label}</button>
  );
  return <div className="flex gap-2 col-span-full">{btn('scripts', 'Scripts')}{btn('builder', 'Mod Builder')}</div>;
}

function ScriptsWorkspace({ scripts, activeId, onSelect, onChange, onRename, onNew, onDelete, running, onRun, onStop, log, onClearLog, names, tab = 'scripts', onTab, builder }: {
  tab?: 'scripts' | 'builder';
  onTab?: (t: 'scripts' | 'builder') => void;
  builder?: ReactNode;
  scripts: ScriptDoc[];
  activeId: string;
  onSelect: (id: string) => void;
  onChange: (id: string, code: string) => void;
  onRename: (id: string, name: string) => void;
  onNew: (name?: string, code?: string) => void;
  onDelete: (id: string) => void;
  running: string[];
  onRun: (sc: ScriptDoc) => void;
  onStop: (id: string) => void;
  log: LogLine[];
  onClearLog: () => void;
  names: { blocks: string[]; items: string[] };
}) {
  const [showHelp, setShowHelp] = useState(false);
  const active = scripts.find((x) => x.id === activeId) ?? scripts[0];
  const isRunning = running.includes(active.id);
  const codeRef = useRef(active.code);
  codeRef.current = active.code;
  if (tab === 'builder' && builder) {
    return (
      <div className="flex flex-col gap-3">
        <ScriptsTabs tab={tab} onTab={onTab} />
        {builder}
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-3">
    {onTab && <ScriptsTabs tab={tab} onTab={onTab} />}
    <div className="grid grid-cols-[150px_minmax(0,1fr)_340px] gap-3 h-[560px]">
      <div className="flex flex-col gap-1 min-h-0">
        <button onClick={() => onNew()} className="px-3 py-2 rounded-lg bg-[#00e676] text-[#0a0e14] text-xs font-bold active:scale-95">+ New script</button>

        <select onChange={(e) => { const ex = SCRIPT_EXAMPLES.find((x) => x.name === e.target.value); if (ex) onNew(ex.name, ex.code); e.target.value = ''; }} defaultValue=""
          className="bg-[#121822] border border-[#243044] rounded-lg px-2 py-2 text-white text-xs focus:outline-none">
          <option value="" disabled>+ From example…</option>
          {SCRIPT_EXAMPLES.map((ex) => <option key={ex.name} value={ex.name}>{ex.name}</option>)}
        </select>
        <div className="flex-1 min-h-0 overflow-y-auto vb-scroll flex flex-col gap-1 mt-1">
          {scripts.map((sc) => (
            <button key={sc.id} onClick={() => onSelect(sc.id)}
              className={`text-left px-2.5 py-2 rounded-lg text-xs truncate transition-colors ${sc.id === active.id ? 'bg-[#1c2634] text-white' : 'text-[#8ea0b8] hover:bg-[#121822]'}`}>
              <span className={running.includes(sc.id) ? 'text-[#00e676]' : 'text-[#364860]'}>●</span> {sc.name}
            </button>
          ))}
        </div>
        <p className="text-[#364860] text-[10px]">Any number of scripts can run at once.</p>
      </div>

      <div className="flex flex-col gap-2 min-h-0">
        <div className="flex items-center gap-2">
          <input value={active.name} onChange={(e) => onRename(active.id, e.target.value.slice(0, 40))}
            className="flex-1 min-w-0 bg-[#121822] border border-[#243044] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#00e676]" />
          <button onClick={() => setShowHelp((v) => !v)} className="px-3 py-2 rounded-lg bg-[#121822] border border-[#243044] text-[#8ea0b8] text-xs hover:text-white">API</button>
          {isRunning && <button onClick={() => onStop(active.id)} className="px-3 py-2 rounded-lg bg-red-500/15 border border-red-500/40 text-red-300 text-xs font-medium active:scale-95">Stop</button>}
          <button onClick={() => onRun(active)} className="px-4 py-2 rounded-lg bg-[#00e676] text-[#0a0e14] text-xs font-bold active:scale-95">{isRunning ? 'Restart' : 'Run'}</button>
          <button onClick={() => onDelete(active.id)} title="Delete this script" className="px-2.5 py-2 rounded-lg bg-[#121822] border border-[#243044] text-red-300/70 text-xs hover:text-red-300">✕</button>
        </div>
        {showHelp ? (
          <pre className="flex-1 min-h-0 overflow-auto vb-scroll text-[11px] leading-5 text-[#8ea0b8] bg-[#121822] border border-[#243044] rounded-xl p-3">{SCRIPT_API_HELP}</pre>
        ) : (
          <textarea value={active.code} onChange={(e) => onChange(active.id, e.target.value)} spellCheck={false}
            className="flex-1 min-h-0 w-full bg-[#05080c] border border-[#243044] rounded-xl p-3 text-[#d6e2f0] text-xs font-mono leading-5 resize-none focus:outline-none focus:border-[#00e676]" />
        )}
        <div className="flex items-center justify-between">
          <span className="text-[#5a6b80] text-xs">Output</span>
          <button onClick={onClearLog} className="text-[#5a6b80] text-xs hover:text-white">Clear</button>
        </div>
        <div className="h-24 shrink-0 overflow-y-auto vb-scroll bg-[#05080c] border border-[#243044] rounded-xl p-2 font-mono text-[11px]">
          {log.length === 0 && <span className="text-[#364860]">Nothing yet. Run a script to see its output here.</span>}
          {log.map((l) => <div key={l.id} className={l.kind === 'error' ? 'text-red-400' : l.kind === 'chat' ? 'text-white' : 'text-[#8ea0b8]'}><ColorText text={l.text} /></div>)}
        </div>
      </div>

      <AiSidePanel scriptName={active.name} getCode={() => codeRef.current} onApply={(code) => onChange(active.id, code)} names={names} />
    </div>
    </div>
  );
}

/**
 * The AI assistant: answers with SEARCH/REPLACE edits for the script that's
 * open, which Apply patches straight into the editor. Requests go to your
 * server (/api/ai), so players don't need a key.
 */
function AiSidePanel({ scriptName, getCode, onApply, names }: {
  scriptName: string;
  getCode: () => string;
  onApply: (code: string) => void;
  names: { blocks: string[]; items: string[] };
}) {
  type Msg = AiTurn & { result?: string };
  const [mode, setMode] = useState<AiMode>(() => (localStorage.getItem('vb-ai-mode') === 'high-effort' ? 'high-effort' : 'normal'));
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [devKey, setDevKey] = useState<string>(() => { try { return localStorage.getItem('vb-ai-dev-key') ?? ''; } catch { return ''; } });
  const [showDev, setShowDev] = useState(false);
  const [meta, setMeta] = useState<AiMeta | null | undefined>(undefined); // undefined = nothing asked yet, null = old server
  const abortRef = useRef<AbortController | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => { try { localStorage.setItem('vb-ai-mode', mode); } catch { /* storage blocked */ } }, [mode]);
  useEffect(() => { listRef.current?.scrollTo({ top: listRef.current.scrollHeight }); }, [messages]);
  useEffect(() => () => abortRef.current?.abort(), []);

  async function send(text: string) {
    const q = text.trim();
    if (!q || streaming) return;
    const history: AiTurn[] = [...messages.map((m) => ({ role: m.role, text: m.text })), { role: 'user', text: q }];
    setMessages([...history, { role: 'assistant', text: '' }]);
    setInput('');
    setError(null);
    setStreaming(true);
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    let got = '';
    try {
      await requestAssistant({
        mode, history, code: getCode(), names, devKey: devKey || undefined, signal: ctrl.signal, onMeta: setMeta,
        onText: (t) => { got = t; setMessages((ms) => { const c = ms.slice(); c[c.length - 1] = { role: 'assistant', text: t }; return c; }); },
      });
    } catch (e) {
      if ((e as Error).name !== 'AbortError') setError((e as Error).message || 'Something went wrong');
    } finally {
      if (!got) setMessages((ms) => (ms.length && ms[ms.length - 1].role === 'assistant' && !ms[ms.length - 1].text ? ms.slice(0, -1) : ms));
      setStreaming(false);
      abortRef.current = null;
    }
  }

  function apply(i: number) {
    const blocks = parseSearchReplace(messages[i].text);
    const res = applySearchReplace(getCode(), blocks);
    if (res.applied > 0) onApply(res.code);
    const note = res.failed.length === 0
      ? `Applied ${res.applied} change${res.applied === 1 ? '' : 's'} ✓`
      : `Applied ${res.applied} of ${blocks.length}. ${res.failed.length} didn't match the code (it may have changed). Ask again.`;
    setMessages((ms) => ms.map((m, k) => (k === i ? { ...m, result: note } : m)));
  }

  return (
    <div className="flex flex-col gap-2 min-h-0 bg-[#0d131b] border border-[#243044] rounded-xl p-2.5">
      <div className="flex items-center gap-2">
        <span className="text-white text-xs font-bold">✦ AI</span>
        <div className="flex bg-[#121822] border border-[#243044] rounded-lg p-0.5 ml-auto">
          {(['normal', 'high-effort'] as const).map((k) => (
            <button key={k} onClick={() => setMode(k)} title={AI_MODELS[k].note}
              className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-all ${mode === k ? 'bg-[#00e676] text-[#0a0e14]' : 'text-[#8ea0b8] hover:text-white'}`}>
              {AI_MODELS[k].label}
            </button>
          ))}
        </div>
      </div>
      {meta === null && (
        <p className="text-amber-400 text-[10px] leading-4">
          ⚠ This AI server is an old version that doesn't know the VibeBlox API. Redeploy <span className="font-mono">functions/api/ai.ts</span> and delete
          any other AI function (like gemini-proxy.js), then try again.
        </p>
      )}
      {meta && <p className="text-[#00e676]/80 text-[10px]">✓ Knows the VibeBlox API · {meta.apiFunctions} functions · {meta.model}</p>}
      <div ref={listRef} className="flex-1 min-h-0 overflow-y-auto vb-scroll flex flex-col gap-2">
        {messages.length === 0 && (
          <p className="text-[#5a6b80] text-[11px] leading-5">
            Ask for changes to <span className="text-white">{scriptName}</span>. The AI answers with exact edits; press Apply to put them in the editor.
            Try: "add a /kit command", "make zombies drop diamonds", "add a kill counter to the sidebar".
          </p>
        )}
        {messages.map((m, i) => {
          if (m.role === 'user') return <div key={i} className="self-end max-w-[90%] px-2.5 py-1.5 rounded-lg bg-[#00e676]/15 border border-[#00e676]/30 text-white text-[11px] whitespace-pre-wrap">{m.text}</div>;
          const writing = streaming && i === messages.length - 1;
          const blocks = parseSearchReplace(m.text);
          const issues = writing ? [] : checkApiUsage(blocks.map((b) => b.replace).join('\n'));
          return (
            <div key={i} className="flex flex-col gap-1">
              <pre className="max-h-64 overflow-auto vb-scroll bg-[#05080c] border border-[#243044] rounded-lg p-2 text-[10.5px] leading-4 font-mono whitespace-pre">
                {(m.text || 'Thinking…').split('\n').map((line, k) => {
                  const marker = /^\s*(<{4,9}\s*SEARCH|={4,9}|>{4,9}\s*REPLACE)\s*$/i.test(line);
                  return <div key={k} className={marker ? 'text-[#5a6b80]' : 'text-[#d6e2f0]'}>{line || ' '}</div>;
                })}
              </pre>
              {!writing && (
                <div className="flex items-center gap-2">
                  <button onClick={() => navigator.clipboard?.writeText(m.text)} className="px-2.5 py-1 rounded-md bg-[#121822] border border-[#243044] text-white text-[11px] hover:border-[#00e676]">Copy</button>
                  <button onClick={() => apply(i)} disabled={blocks.length === 0}
                    className="px-3 py-1 rounded-md bg-[#00e676] text-[#0a0e14] text-[11px] font-bold disabled:opacity-40 active:scale-95">Apply</button>
                  <span className="text-[10px] text-[#8ea0b8]">{m.result ?? (blocks.length ? `${blocks.length} change${blocks.length === 1 ? '' : 's'}` : 'No edits found in this answer')}</span>
                </div>
              )}
              {issues.length > 0 && (
                <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/30 text-[10px] leading-4 text-amber-200">
                  <div className="font-bold mb-0.5">⚠ This code uses things that don't exist in VibeBlox:</div>
                  {issues.map((it) => <div key={it.call}>• <span className="font-mono">{it.call}</span>{it.suggestion ? <> (did you mean <span className="font-mono">{it.suggestion}</span>?)</> : null}</div>)}
                  <button
                    onClick={() => send(`Your last answer uses functions that don't exist in the VibeBlox API:\n${issues.map((it) => `- ${it.call}${it.suggestion ? ` (maybe ${it.suggestion})` : ''}`).join('\n')}\nRewrite the affected code using only functions from the API reference.`)}
                    disabled={streaming}
                    className="mt-1.5 px-2.5 py-1 rounded-md bg-amber-500/20 border border-amber-500/40 text-amber-100 font-bold disabled:opacity-40 active:scale-95"
                  >Ask the AI to fix it</button>
                </div>
              )}
            </div>
          );
        })}
        {error && <p className="text-red-400 text-[11px]">{error}</p>}
      </div>
      <div className="flex gap-1.5">
        <textarea value={input} onChange={(e) => setInput(e.target.value)} rows={2} placeholder="What should the script do?"
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(input); } }}
          className="flex-1 resize-none bg-[#121822] border border-[#243044] rounded-lg px-2.5 py-1.5 text-white text-[11px] focus:outline-none focus:border-[#00e676]" />
        {streaming
          ? <button onClick={() => abortRef.current?.abort()} className="px-3 rounded-lg bg-red-500/15 border border-red-500/40 text-red-300 text-[11px]">Stop</button>
          : <button onClick={() => send(input)} className="px-3 rounded-lg bg-[#00e676] text-[#0a0e14] text-[11px] font-bold active:scale-95">Send</button>}
      </div>
      <button onClick={() => setShowDev((v) => !v)} className="text-left text-[10px] text-[#364860] hover:text-[#8ea0b8]">
        {devKey ? '● Using a developer key (this browser only)' : 'Testing in Bolt? Use a developer key'}
      </button>
      {showDev && (
        <div className="flex gap-1.5">
          <input type="password" value={devKey} placeholder="Gemini key, for testing only"
            onChange={(e) => { setDevKey(e.target.value.trim()); try { localStorage.setItem('vb-ai-dev-key', e.target.value.trim()); } catch { /* storage blocked */ } }}
            className="flex-1 bg-[#05080c] border border-[#243044] rounded-lg px-2 py-1 text-white text-[10px] font-mono focus:outline-none" />
          {devKey && <button onClick={() => { setDevKey(''); try { localStorage.removeItem('vb-ai-dev-key'); } catch { /* storage blocked */ } }} className="text-[10px] text-red-300">Remove</button>}
        </div>
      )}
    </div>
  );
}

function ModsPanel({ official, custom, enabled, starred, onToggle, onStar, onFork, onSave, onDelete, onImport, onOpenBuilder, author }: {
  onOpenBuilder: (m: Mod | null) => void;
  official: Mod[];
  custom: Mod[];
  enabled: string[];
  starred: string[];
  onToggle: (m: Mod) => void;
  onStar: (m: Mod) => void;
  onFork: (m: Mod) => void;
  onSave: (m: Mod) => void;
  onDelete: (m: Mod) => void;
  onImport: (json: string) => string | null;
  author: string;
}) {
  const [tab, setTab] = useState<'official' | 'community'>('official');
  const [editing, setEditing] = useState<Mod | null>(null);
  const [importText, setImportText] = useState('');
  const [importMsg, setImportMsg] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const list = (tab === 'official' ? official : custom).slice().sort((a, b) => Number(starred.includes(b.id)) - Number(starred.includes(a.id)));

  function exportMod(m: Mod) {
    const json = JSON.stringify({ name: m.name, author: m.author, description: m.description, code: m.code });
    navigator.clipboard?.writeText(json).then(() => setCopied(m.id), () => setCopied(null));
    setTimeout(() => setCopied(null), 1500);
  }

  if (editing) {
    return (
      <div className="flex flex-col gap-3 vb-fade-in">
        <input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} placeholder="Mod name" maxLength={40}
          className="bg-[#121822] border border-[#243044] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#00e676]" />
        <input value={editing.description} onChange={(e) => setEditing({ ...editing, description: e.target.value })} placeholder="What does it do?" maxLength={120}
          className="bg-[#121822] border border-[#243044] rounded-lg px-3 py-2 text-white text-xs focus:outline-none focus:border-[#00e676]" />
        <textarea value={editing.code} onChange={(e) => setEditing({ ...editing, code: e.target.value })} spellCheck={false}
          className="w-full h-72 bg-[#05080c] border border-[#243044] rounded-xl p-3 text-[#d6e2f0] text-xs font-mono leading-5 resize-y focus:outline-none focus:border-[#00e676]" />
        <div className="flex gap-2 justify-end">
          <button onClick={() => setEditing(null)} className="px-4 py-2 rounded-lg bg-[#121822] border border-[#243044] text-[#8ea0b8] text-xs hover:text-white">Cancel</button>
          <button onClick={() => { onSave({ ...editing, name: editing.name.trim() || 'Untitled Mod' }); setEditing(null); }}
            className="px-4 py-2 rounded-lg bg-[#00e676] text-[#0a0e14] text-xs font-bold active:scale-95">Save</button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        {(['official', 'community'] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-lg text-xs font-medium transition-all ${tab === t ? 'bg-[#00e676] text-[#0a0e14]' : 'bg-[#121822] border border-[#243044] text-[#8ea0b8] hover:text-white'}`}>
            {t === 'official' ? 'Official Mods' : `Community Mods (${custom.length})`}
          </button>
        ))}
        <div className="flex-1" />
        <button onClick={() => onOpenBuilder(null)} data-testid="open-builder"
          className="px-3 py-2 rounded-lg bg-[#3a6ad8] text-white text-xs font-bold hover:brightness-110 active:scale-95">Mod Builder</button>
        {tab === 'community' && (
          <button onClick={() => setEditing({ id: '', name: 'My Mod', author, description: '', official: false, code: "// Your mod's code. It runs every time you join a world while switched on.\ngame.chat('My mod is running!');\n" })}
            className="px-3 py-2 rounded-lg bg-[#121822] border border-[#243044] text-white text-xs hover:border-[#00e676]">+ New mod</button>
        )}
      </div>

      {list.length === 0 && (
        <p className="text-[#5a6b80] text-xs py-4 text-center">No community mods yet. Make one, fork an official mod, or import one below.</p>
      )}
      {list.map((m) => {
        const on = enabled.includes(m.id);
        const star = starred.includes(m.id);
        return (
          <div key={m.id} className="p-4 rounded-xl bg-[#121822] border border-[#243044] flex items-start gap-3 transition-colors hover:border-[#364860]">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-white text-sm font-medium">{m.name}</span>
                <span className="text-[#5a6b80] text-[10px]">by {m.author}</span>
                {on && <span className="text-[#00e676] text-[10px] font-bold">✓ Installed</span>}
              </div>
              <p className="text-[#8ea0b8] text-xs mt-1">{m.description || 'No description'}</p>
              <div className="flex gap-3 mt-2 text-[11px]">
                <button onClick={() => onStar(m)} className={star ? 'text-amber-400' : 'text-[#5a6b80] hover:text-white'}>{star ? '★ Starred' : '☆ Star'}</button>
                <button onClick={() => onFork(m)} className="text-[#5a6b80] hover:text-white">⑂ Fork</button>
                <button onClick={() => exportMod(m)} className="text-[#5a6b80] hover:text-white">{copied === m.id ? '✓ Copied' : '⇪ Export'}</button>
                {!m.official && parseModCode(m.code) && <button onClick={() => onOpenBuilder(m)} data-testid="edit-in-builder" className="text-[#3a8aff] hover:text-white">🛠 Builder</button>}
                {!m.official && <button onClick={() => setEditing(m)} className="text-[#5a6b80] hover:text-white">✎ Edit</button>}
                {!m.official && <button onClick={() => onDelete(m)} className="text-red-400/70 hover:text-red-300">Delete</button>}
              </div>
            </div>
            <button onClick={() => onToggle(m)}
              className={`shrink-0 px-4 py-2 rounded-lg text-xs font-bold transition-all active:scale-95 ${
                on ? 'bg-[#121822] border border-[#243044] text-[#8ea0b8] hover:text-red-300 hover:border-red-500/40' : 'bg-[#00e676] text-[#0a0e14] hover:brightness-110'
              }`}>
              {on ? 'Uninstall' : 'Install'}
            </button>
          </div>
        );
      })}

      {tab === 'community' && (
        <div className="p-3 rounded-xl border border-dashed border-[#243044]">
          <span className="text-[#8ea0b8] text-xs">Import a mod someone shared (paste what their Export button copied)</span>
          <div className="flex gap-2 mt-2">
            <input value={importText} onChange={(e) => setImportText(e.target.value)} placeholder='{"name": ..., "code": ...}'
              className="flex-1 bg-[#05080c] border border-[#243044] rounded-lg px-3 py-2 text-white text-xs font-mono focus:outline-none focus:border-[#00e676]" />
            <button onClick={() => { const err = onImport(importText); setImportMsg(err ?? 'Imported! It starts switched off.'); if (!err) setImportText(''); }}
              className="px-3 py-2 rounded-lg bg-[#121822] border border-[#243044] text-white text-xs hover:border-[#00e676]">Import</button>
          </div>
          {importMsg && <p className="text-[#8ea0b8] text-[11px] mt-2">{importMsg}</p>}
          <p className="text-amber-500/80 text-[10px] mt-2">Only import mods from people you trust. Mods run sandboxed, but they can still build, break and teleport in your world.</p>
        </div>
      )}
    </div>
  );
}

export default function App() {
  const [username, setUsername] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [ready, setReady] = useState(false);
  const [view, setView] = useState<View>('home');
  const [gameMode, setGameMode] = useState<GameMode>('menu');
  const [renderDistance, setRenderDistance] = useState(savedSettings.renderDistance ?? 6);
  const [graphicsQuality, setGraphicsQuality] = useState<GraphicsQuality>(savedSettings.graphicsQuality ?? 'medium');
  const [textureRes, setTextureRes] = useState<TextureRes>(savedSettings.textureRes === 32 ? 32 : 16);

  /** Switch textures right now, even in the middle of a game. */
  function changeTextureRes(res: TextureRes) {
    setTextureResolution(res); // clears every cached texture
    setTextureRes(res); // saves the choice and redraws the hotbar and inventory icons
    gameHandleRef.current?.reloadTextures(); // re-skins the running world
  }
  const [fov, setFov] = useState(savedSettings.fov ?? 75);
  // Your worlds list survives closing the tab
  const [savedWorlds, setSavedWorlds] = useState<WorldConfig[]>(() => {
    try { return JSON.parse(localStorage.getItem('vb-worlds') ?? '[]') as WorldConfig[]; } catch { return []; }
  });
  const activeWorldIdRef = useRef<string | null>(null);
  const [activeWorldMode, setActiveWorldMode] = useState<GameWorldMode>('survival');
  const [activeWorldType, setActiveWorldType] = useState<WorldType>('default');
  const [activeSeed, setActiveSeed] = useState<number>(() => randomSeed());
  const [deathReason, setDeathReason] = useState<string | null>(null);
  const deadRef = useRef(false);
  const [serverUrl, setServerUrl] = useState<string>(() => {
    try { return localStorage.getItem('vb-server') ?? ''; } catch { return ''; }
  });
  const [netStatus, setNetStatus] = useState<NetStatus>('offline');
  const [netError, setNetError] = useState<string | null>(null);
  const [disconnectReason, setDisconnectReason] = useState<string | null>(null);
  const [onlinePlayers, setOnlinePlayers] = useState<Record<number, string>>({});
  const [showPlayerList, setShowPlayerList] = useState(false);
  const mpRef = useRef<MpClient | null>(null);
  const myNetIdRef = useRef<number | null>(null);
  const onlineNamesRef = useRef<Record<number, string>>({});
  const pendingWelcomeRef = useRef<Welcome | null>(null);
  const earlyBlocksRef = useRef<NetBlock[]>([]);
  const disconnectedRef = useRef(false);
  const gameModeRef = useRef<GameMode>('menu');
  gameModeRef.current = gameMode;
  const [createPreset, setCreatePreset] = useState<{ mode: WorldMode; worldType: WorldType; nonce: number }>({ mode: 'survival', worldType: 'default', nonce: 0 });
  const [sfxVolume, setSfxVolume] = useState(savedSettings.sfxVolume ?? 0.6);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuOpenedAtRef = useRef(0);
  const menuClosedAtRef = useRef(0);
  const hadLockRef = useRef(false);
  const [menuPage, setMenuPage] = useState<MenuPage>('main');
  const [builderMod, setBuilderMod] = useState<Mod | null>(null);
  const [scriptsTab, setScriptsTab] = useState<'scripts' | 'builder'>('scripts');
  const [hurtFlash, setHurtFlash] = useState(false);
  const menuOpenRef = useRef(false);
  const menuPageRef = useRef<MenuPage>('main');
  menuPageRef.current = menuPage;
  const hurtTimerRef = useRef<number | undefined>(undefined);
  const [inventory, setInventory] = useState<Slots>(() => emptySlots(INVENTORY_SIZE));
  const [offhand, setOffhand] = useState<ItemStack | null>(null);
  const [armor, setArmor] = useState<Slots>(() => emptySlots(4));
  const [titleCard, setTitleCard] = useState<{ text: string; sub: string; id: number } | null>(null);
  const titleTimerRef = useRef<number | undefined>(undefined);
  const [sidebar, setSidebar] = useState<{ title: string; lines: string[] } | null>(null);


  // ---- Scripts & mods ----
  type ModsState = { enabled: string[]; custom: Mod[]; starred: string[] };
  const [modsState, setModsState] = useState<ModsState>(() => {
    try { return { enabled: [], custom: [], starred: [], ...JSON.parse(localStorage.getItem('vb-mods') ?? '{}') } as ModsState; }
    catch { return { enabled: [], custom: [], starred: [] }; }
  });
  const modsStateRef = useRef(modsState);
  modsStateRef.current = modsState;
  useEffect(() => { try { localStorage.setItem('vb-mods', JSON.stringify(modsState)); } catch { /* storage blocked */ } }, [modsState]);
  const [scripts, setScripts] = useState<ScriptDoc[]>(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('vb-scripts') ?? 'null') as ScriptDoc[] | null;
      if (Array.isArray(saved) && saved.length) return saved;
    } catch { /* fall through */ }
    let old: string | null = null;
    try { old = localStorage.getItem('vb-script-code'); } catch { /* storage blocked */ }
    return [{ id: newWorldId(), name: 'My Script', code: old ?? SCRIPT_EXAMPLES[0].code }];
  });
  useEffect(() => { try { localStorage.setItem('vb-scripts', JSON.stringify(scripts)); } catch { /* storage blocked */ } }, [scripts]);
  const [activeScriptId, setActiveScriptId] = useState('');
  const [runningScripts, setRunningScripts] = useState<string[]>([]);
  const [scoped, setScoped] = useState(false);
  const playtimeRef = useRef<number>((() => { try { return Number(localStorage.getItem('vb-playtime')) || 0; } catch { return 0; } })());
  const [scriptLog, setScriptLog] = useState<LogLine[]>([]);
  const logIdRef = useRef(0);
  const runnerRef = useRef<ScriptRunner | null>(null);
  const selectedSlotRef = useRef(0);
  const usernameRef = useRef('Player');
  const [health, setHealth] = useState(20);
  const [hunger, setHunger] = useState(20);
  const [inventoryOpen, setInventoryOpen] = useState(false);
  const [atCraftingTable, setAtCraftingTable] = useState(false);
  const [openChest, setOpenChest] = useState<string | null>(null);
  const [openFurnace, setOpenFurnace] = useState<string | null>(null);
  const getFurnaceForUi = useMemo(() => (key: string) => gameHandleRef.current?.getFurnace(key) ?? { slots: emptySlots(3), cook: 0, burn: 0 }, []);
  const [hint, setHint] = useState<string | null>(null);
  const hintTimerRef = useRef<number | undefined>(undefined);
  const [craftMode, setCraftMode] = useState<'grid' | 'quick'>(savedSettings.craftMode ?? 'grid');
  const [playMode, setPlayMode] = useState<PlayMode>('survival');
  const [hudPrefs, setHudPrefs] = useState<HudPrefs>(savedSettings.hudPrefs ?? { keystrokes: false, cps: false, fps: false });
  const [chatOpen, setChatOpen] = useState(false);
  const [chatSession, setChatSession] = useState(0);
  const [chatInitial, setChatInitial] = useState('');
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatHistory, setChatHistory] = useState<string[]>([]);
  const [helpOpen, setHelpOpen] = useState(false);
  const [showDebug, setShowDebug] = useState(false);
  // Refs mirror UI state for the window key listeners (they'd see stale state otherwise)
  const chatOpenRef = useRef(false);
  const helpOpenRef = useRef(false);
  const inventoryOpenRef = useRef(false);
  inventoryOpenRef.current = inventoryOpen;
  const msgIdRef = useRef(0);
  const [selectedSlot, setSelectedSlot] = useState(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameHandleRef = useRef<ReturnType<typeof createVoxelGame> | null>(null);

  // ---- Progression: XP for active play, level-ups, ads, cosmetics ----
  const progress = useProgress();
  const lastInputRef = useRef(Date.now());
  const [levelToast, setLevelToast] = useState<{ level: number; coins: number } | null>(null);
  useEffect(() => {
    // "Active" means you've touched the keyboard, mouse or screen in the last 2 minutes
    const poke = () => { lastInputRef.current = Date.now(); };
    const evs = ['keydown', 'mousedown', 'mousemove', 'wheel', 'touchstart'] as const;
    for (const e of evs) window.addEventListener(e, poke, { passive: true });
    return () => { for (const e of evs) window.removeEventListener(e, poke); };
  }, []);
  useEffect(() => onLevelUp((level, coins) => {
    gameHandleRef.current?.script.playSound('ding');
    setLevelToast({ level, coins });
  }), []);
  useEffect(() => {
    if (!levelToast) return;
    const t = setTimeout(() => setLevelToast(null), 4000);
    return () => clearTimeout(t);
  }, [levelToast]);
  // Portals want to know when the game is loaded and when you're actually playing
  useEffect(() => {
    reportLoadingFinished();
    if (PLATFORM === 'crazygames') void initAds().then((ok) => { if (ok) reloadProgress(); }); // progress lives in the CrazyGames account
  }, []);
  useEffect(() => { setGameplayActive(gameMode === 'playing' && !menuOpen && deathReason === null); }, [gameMode, menuOpen, deathReason]);
  // Mute everything while an ad plays
  useEffect(() => {
    let musicWasPlaying = false;
    const onAd = (e: Event) => {
      const playing = (e as CustomEvent<boolean>).detail;
      const h = gameHandleRef.current;
      if (playing) {
        h?.setSfxVolume(0);
        musicWasPlaying = !!audioRef.current && !audioRef.current.paused;
        audioRef.current?.pause();
      } else {
        h?.setSfxVolume(sfxVolume);
        if (musicWasPlaying) void audioRef.current?.play().catch(() => {});
      }
    };
    window.addEventListener('vb-ad', onAd);
    return () => window.removeEventListener('vb-ad', onAd);
  }, [sfxVolume]);
  // Wear your skin and cape, and show it to everyone online
  useEffect(() => {
    if (gameMode !== 'playing') return;
    const look = { skin: progress.currentSkin, cape: progress.currentCape };
    gameHandleRef.current?.setPlayerLook(look);
    mpRef.current?.sendLook(look);
  }, [progress.currentSkin, progress.currentCape, gameMode]);

  // Soundtrack — lifted up to App level (rather than living inside
  // SettingsView) so playback survives navigating to other sidebar panels
  // and continues even while actually playing the game, since this <audio>
  // element itself never unmounts.
  const [trackName, setTrackName] = useState<string | null>(null);
  const [builtInTrack, setBuiltInTrack] = useState<'overworld' | 'phonk' | 'arcade' | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(savedSettings.volume ?? 0.5);

  // Remember settings between visits
  useEffect(() => {
    const settings: SavedSettings = { renderDistance, graphicsQuality, fov, sfxVolume, hudPrefs, craftMode, volume, textureRes };
    try { localStorage.setItem('vb-settings', JSON.stringify(settings)); } catch { /* storage blocked */ }
  }, [renderDistance, graphicsQuality, fov, sfxVolume, hudPrefs, craftMode, volume, textureRes]);
  const audioRef = useRef<HTMLAudioElement>(null);
  const objectUrlRef = useRef<string | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const sourceNodeRef = useRef<AudioBufferSourceNode | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const bufferCacheRef = useRef<Record<string, AudioBuffer>>({});

  useEffect(() => {
    return () => {
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
      try { sourceNodeRef.current?.stop(); } catch { /* already stopped */ }
      audioCtxRef.current?.close();
    };
  }, []);

  function midiToFreq(m: number) {
    return 440 * Math.pow(2, (m - 69) / 12);
  }

  // Synthesizes a short, seamlessly-loopable instrumental — no audio
  // assets needed. Each style uses a distinct waveform, tempo and note
  // pattern so the three built-in tracks actually sound different.
  function synthesizeTrack(style: 'overworld' | 'phonk' | 'arcade', sampleRate: number): Float32Array {
    let notes: number[];
    let beatDur: number;
    let wave: (t: number, freq: number) => number;
    let noiseAmount = 0;

    if (style === 'overworld') {
      notes = [60, 64, 67, 72, 67, 64, 60, -1]; // calm major arpeggio
      beatDur = 0.5;
      wave = (t, f) => Math.sin(2 * Math.PI * f * t);
    } else if (style === 'phonk') {
      notes = [36, -1, 36, 43, -1, 36, -1, 41]; // dark, low, sparse
      beatDur = 0.4;
      wave = (t, f) => {
        const phase = (f * t) % 1;
        return 2 * Math.abs(2 * phase - 1) - 1; // triangle-ish
      };
      noiseAmount = 0.05;
    } else {
      notes = [72, 76, 79, 76, 72, 76, 79, 84]; // bright, fast chiptune
      beatDur = 0.18;
      wave = (t, f) => (Math.sin(2 * Math.PI * f * t) > 0 ? 0.6 : -0.6); // square wave
    }

    const length = Math.floor(notes.length * beatDur * sampleRate);
    const data = new Float32Array(length);
    for (let i = 0; i < notes.length; i++) {
      const note = notes[i];
      if (note < 0) continue;
      const freq = midiToFreq(note);
      const startSample = Math.floor(i * beatDur * sampleRate);
      const endSample = Math.floor((i + 1) * beatDur * sampleRate);
      for (let s = startSample; s < endSample && s < length; s++) {
        const t = (s - startSample) / sampleRate;
        const env = Math.min(1, t / 0.02) * Math.max(0, 1 - t / beatDur);
        let sample = wave(t, freq) * env * 0.3;
        if (noiseAmount > 0) sample += (Math.random() * 2 - 1) * noiseAmount * env;
        data[s] += sample;
      }
    }
    return data;
  }

  function getAudioCtx(): AudioContext {
    if (!audioCtxRef.current) {
      audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    return audioCtxRef.current;
  }

  function stopBuiltInSource() {
    try { sourceNodeRef.current?.stop(); } catch { /* already stopped */ }
    sourceNodeRef.current = null;
  }

  function playBuiltInTrack(style: 'overworld' | 'phonk' | 'arcade') {
    audioRef.current?.pause(); // stop any uploaded file first
    const ctx = getAudioCtx();
    if (ctx.state === 'suspended') ctx.resume();
    let buffer = bufferCacheRef.current[style];
    if (!buffer) {
      const data = synthesizeTrack(style, ctx.sampleRate);
      buffer = ctx.createBuffer(1, data.length, ctx.sampleRate);
      buffer.getChannelData(0).set(data);
      bufferCacheRef.current[style] = buffer;
    }
    stopBuiltInSource();
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    const gain = ctx.createGain();
    gain.gain.value = volume;
    source.connect(gain).connect(ctx.destination);
    source.start();
    sourceNodeRef.current = source;
    gainNodeRef.current = gain;
    setTrackName(null);
    setBuiltInTrack(style);
    setIsPlaying(true);
  }

  function handleTrackChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    stopBuiltInSource();
    setBuiltInTrack(null);
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    const url = URL.createObjectURL(file);
    objectUrlRef.current = url;
    setTrackName(file.name);
    if (audioRef.current) {
      audioRef.current.src = url;
      audioRef.current.volume = volume;
      audioRef.current.play();
      setIsPlaying(true);
    }
  }

  function togglePlay() {
    if (builtInTrack) {
      const ctx = audioCtxRef.current;
      if (!ctx) return;
      if (isPlaying) ctx.suspend(); else ctx.resume();
      setIsPlaying((p) => !p);
      return;
    }
    if (!audioRef.current || !trackName) return;
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setIsPlaying((p) => !p);
  }

  function handleVolumeChange(e: ChangeEvent<HTMLInputElement>) {
    const v = parseFloat(e.target.value);
    setVolume(v);
    if (audioRef.current) audioRef.current.volume = v;
    if (gainNodeRef.current) gainNodeRef.current.gain.value = v;
  }

  useEffect(() => {
    const saved = getInitialUsername();
    if (saved) {
      setUsername(saved);
      setShowModal(false);
    } else {
      setShowModal(true);
    }
    setReady(true);
  }, []);

  useEffect(() => {
    (window as any).savedWorldsGlobal = savedWorlds;
    try { localStorage.setItem('vb-worlds', JSON.stringify(savedWorlds)); } catch { /* storage blocked */ }
  }, [savedWorlds]);

  // 💎 ESC / P — exit the game straight back to the Home menu
  useEffect(() => {
    const handleEscKey = (e: KeyboardEvent) => {
      if (chatOpenRef.current || helpOpenRef.current) {
        if (e.key === 'Escape') {
          e.preventDefault();
          e.stopPropagation(); // keep the engine from treating this Esc as "leave game"
          if (chatOpenRef.current) closeChat();
          else closeHelp();
        }
        return;
      }
      if (e.key === 'Escape' && gameMode === 'playing') {
        e.preventDefault();
        e.stopPropagation();
        if (deadRef.current || disconnectedRef.current) return; // must use the on-screen buttons
        if (menuOpenRef.current) {
          // Some browsers deliver the Esc key AFTER the "mouse unlocked" event that opened the menu;
          // that same key press must not close it again straight away
          if (performance.now() - menuOpenedAtRef.current < 450) return;
          if (menuPageRef.current !== 'main') setMenuPage('main');
          else resumeGame();
        } else if (inventoryOpenRef.current) {
          gameHandleRef.current?.closeInventory();
        } else {
          openGameMenu();
        }
      }
    };
    window.addEventListener('keydown', handleEscKey, true);
    return () => window.removeEventListener('keydown', handleEscKey, true);
  }, [gameMode]);

  // Hotbar selection: number keys 1-9, and mouse scroll wheel (Minecraft-style)
  useEffect(() => {
    if (gameMode !== 'playing') return;
    const handleHotbarKey = (e: KeyboardEvent) => {
      if (chatOpenRef.current || helpOpenRef.current || menuOpenRef.current) return; // typing numbers in chat
      const match = e.code.match(/^Digit([1-9])$/);
      if (match) setSelectedSlot(parseInt(match[1], 10) - 1);
    };
    const handleWheel = (e: WheelEvent) => {
      if (chatOpenRef.current || helpOpenRef.current) return;
      setSelectedSlot((prev) => {
        const dir = e.deltaY > 0 ? 1 : -1;
        return (prev + dir + 9) % 9;
      });
    };
    window.addEventListener('keydown', handleHotbarKey);
    window.addEventListener('wheel', handleWheel);
    return () => {
      window.removeEventListener('keydown', handleHotbarKey);
      window.removeEventListener('wheel', handleWheel);
    };
  }, [gameMode]);

  useEffect(() => {
    if (gameMode === 'playing' && canvasRef.current) {
      hadLockRef.current = false;
      const handle = createVoxelGame(canvasRef.current, renderDistance, activeWorldMode, graphicsQuality, fov, activeWorldType, sfxVolume, activeSeed);
      gameHandleRef.current = handle;
      handle.setPlayerLook(currentLook());
      handle.onInventoryChange((inv, off, arm) => { setInventory(inv); setOffhand(off); setArmor(arm); });
      handle.onStatsChange((h, hu) => {
        setHealth(h);
        setHunger(hu);
      });
      handle.onInventoryToggle((open, atTable, chestKey, furnaceKey) => {
        setOpenChest(chestKey);
        setOpenFurnace(furnaceKey ?? null);
        inventoryOpenRef.current = open; // set now: the pointer-unlock event can arrive before React re-renders
        setInventoryOpen(open);
        setAtCraftingTable(atTable);
      });
      setInventory(handle.getInventory());
      setHealth(handle.getHealth());
      setHunger(handle.getHunger());
      setInventoryOpen(false);
      setPlayMode(activeWorldMode);
      deadRef.current = false;
      setDeathReason(null);
      handle.onPlayerDeath((reason) => {
        deadRef.current = true; // set now: the pointer-unlock event can arrive before React re-renders
        setDeathReason(reason);
      });
      menuOpenRef.current = false;
      setMenuOpen(false);
      setMenuPage('main');
      handle.onPlayerHurt(() => {
        setHurtFlash(true);
        window.clearTimeout(hurtTimerRef.current);
        hurtTimerRef.current = window.setTimeout(() => setHurtFlash(false), 200);
      });
      chatOpenRef.current = false;
      helpOpenRef.current = false;
      setChatOpen(false);
      setHelpOpen(false);
      setShowDebug(false);
      pushMessage('Press T or Enter to chat, / for commands. Type /help for the full list.', '#aaaaaa');
      disconnectedRef.current = false;
      setDisconnectReason(null);
      const welcome = pendingWelcomeRef.current;
      if (mpRef.current && welcome) {
        pendingWelcomeRef.current = null;
        handle.setNetEnabled(true);
        handle.applyRemoteBlocks(welcome.changes);
        if (earlyBlocksRef.current.length) {
          handle.applyRemoteBlocks(earlyBlocksRef.current);
          earlyBlocksRef.current = [];
        }
        handle.setTime(welcome.time);
        for (const p of welcome.players) {
          handle.setRemotePlayer(p.id, p.name, p.x, p.y, p.z, p.yaw, p.pitch, p.mode);
          if (p.look) handle.setRemoteLook(p.id, p.look);
        }
        pushMessage(`Connected as ${welcome.name}. ${welcome.players.length} other player${welcome.players.length === 1 ? '' : 's'} online.`, '#ffe066');
      }
      handle.onHint((text) => {
        setHint(text);
        window.clearTimeout(hintTimerRef.current);
        hintTimerRef.current = window.setTimeout(() => setHint(null), 1800);
      });
      // Pick up exactly where you left off in this world
      const worldId = activeWorldIdRef.current;
      if (worldId && !mpRef.current) {
        try {
          const raw = localStorage.getItem(`vb-save-${worldId}`);
          if (raw) {
            const save = JSON.parse(raw) as SaveData;
            handle.loadSaveData(save);
            setPlayMode(save.player.mode);
            setSelectedSlot(save.player.selected ?? 0);
            setInventory(handle.getInventory());
            setOffhand(handle.getOffhand());
            setArmor(handle.getArmor());
            pushMessage('Welcome back! Your progress was restored.', '#ffe066');
          }
        } catch { /* a broken save just starts fresh */ }
      }
      handle.onEngineEvent((name, data) => {
        if (name === 'zoomChange') { setScoped(Number(data.zoom) < 0.5); return; }
        const r = runnerRef.current;
        if (!r) return;
        const out: Record<string, unknown> = { ...data };
        if (typeof data.item === 'number') out.item = blockNameOf(data.item);
        if (name === 'itemUse') {
          const hit = data.hit as { x: number; y: number; z: number; block: number; placeX: number; placeY: number; placeZ: number } | null;
          delete out.hit;
          Object.assign(out, {
            x: hit ? hit.x : null, y: hit ? hit.y : null, z: hit ? hit.z : null, block: hit ? blockNameOf(hit.block) : null,
            placeX: hit ? hit.placeX : null, placeY: hit ? hit.placeY : null, placeZ: hit ? hit.placeZ : null,
          });
        }
        r.emit(name, out);
      });
      handle.onBlockEvent((type, x, y, z, block) => {
        runnerRef.current?.emit(type === 'break' ? 'blockBreak' : 'blockPlace', { x, y, z, block: blockNameOf(block) });
      });
      startEnabledMods();
      return () => {
        handle.dispose();
        gameHandleRef.current = null;
      };
    }
  }, [gameMode, activeWorldMode, activeWorldType, activeSeed]);

  useEffect(() => {
    if (gameHandleRef.current) {
      gameHandleRef.current.setRenderDistance(renderDistance);
    }
  }, [renderDistance]);

  useEffect(() => {
    if (gameHandleRef.current) {
      gameHandleRef.current.setGraphicsQuality(graphicsQuality);
    }
  }, [graphicsQuality]);

  useEffect(() => {
    if (gameHandleRef.current) {
      gameHandleRef.current.setFov(fov);
    }
  }, [fov]);

  useEffect(() => {
    gameHandleRef.current?.setSfxVolume(sfxVolume);
  }, [sfxVolume]);

  // Tell the engine which hotbar slot is selected (it holds the real inventory)
  useEffect(() => {
    gameHandleRef.current?.setSelectedSlot(selectedSlot);
  }, [selectedSlot]);

  function handleCraftGrid(grid: (number | null)[], size: number) {
    gameHandleRef.current?.craftFromGrid(grid, size, atCraftingTable);
  }

  function handleAddItem(id: number, count: number) {
    gameHandleRef.current?.addItem(id, count);
  }

  // T / Enter / "/" open chat, F3 toggles the debug screen
  useEffect(() => {
    if (gameMode !== 'playing') return;
    const onKey = (e: KeyboardEvent) => {
      if (chatOpenRef.current || helpOpenRef.current || inventoryOpenRef.current || menuOpenRef.current || deadRef.current || disconnectedRef.current) return;
      if (e.code === 'F3') {
        e.preventDefault(); // F3 is "find" in some browsers
        setShowDebug((v) => !v);
        return;
      }
      if (e.code === 'Enter' || e.code === 'KeyT' || e.key === '/') {
        e.preventDefault(); // so the key doesn't get typed into the new chat box
        openChat(e.key === '/' ? '/' : '');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [gameMode]);

  // Keep F1 / F3 / F5 / Tab away from the browser while playing (F5 would reload the page)
  useEffect(() => {
    if (gameMode !== 'playing') return;
    const block = (e: KeyboardEvent) => {
      if (e.code === 'F1' || e.code === 'F3' || e.code === 'F5' || (e.code === 'Tab' && !chatOpenRef.current)) e.preventDefault();
    };
    window.addEventListener('keydown', block, true);
    return () => window.removeEventListener('keydown', block, true);
  }, [gameMode]);

  // While the mouse is locked, browsers swallow the Esc key and only report
  // "mouse unlocked". So losing the lock (Esc, alt-tab) is what opens the menu.
  useEffect(() => {
    if (gameMode !== 'playing') return;
    const onLockChange = () => {
      if (document.pointerLockElement) { hadLockRef.current = true; return; }
      if (chatOpenRef.current || helpOpenRef.current || inventoryOpenRef.current || menuOpenRef.current || deadRef.current || disconnectedRef.current) return;
      if (!hadLockRef.current) return; // the mouse was never captured yet (e.g. still joining): nothing to pause
      if (performance.now() - menuClosedAtRef.current < 400) return; // a re-lock that the browser refused right after closing the menu
      openGameMenu();
    };
    document.addEventListener('pointerlockchange', onLockChange);
    return () => document.removeEventListener('pointerlockchange', onLockChange);
  }, [gameMode]);

  function openGameMenu() {
    if (menuOpenRef.current) return; // already open: never stack a second one
    menuOpenedAtRef.current = performance.now();
    menuOpenRef.current = true;
    setMenuPage('main');
    setMenuOpen(true);
    gameHandleRef.current?.setChatOpen(true); // stop walking; the world itself keeps running
    if (document.pointerLockElement) document.exitPointerLock();
  }

  function resumeGame() {
    menuClosedAtRef.current = performance.now();
    menuOpenRef.current = false;
    setMenuOpen(false);
    gameHandleRef.current?.setChatOpen(false);
    gameHandleRef.current?.relock();
  }

  function handleRespawn() {
    deadRef.current = false;
    setDeathReason(null);
    gameHandleRef.current?.respawn();
  }

  function exitToHome() {
    menuOpenRef.current = false;
    setMenuOpen(false);
    deadRef.current = false;
    setDeathReason(null);
    handleExitGame();
    setView('home');
  }

  function saveWorldNow() {
    const id = activeWorldIdRef.current;
    const h = gameHandleRef.current;
    if (!id || !h) return;
    try {
      localStorage.setItem(`vb-save-${id}`, JSON.stringify(h.getSaveData()));
    } catch {
      setHint("Couldn't save: your browser's storage is full");
    }
  }

  // Autosave every 10 seconds, and whenever the tab is hidden or closed
  useEffect(() => {
    if (gameMode !== 'playing') return;
    const t = setInterval(saveWorldNow, 10_000);
    const onHide = () => { if (document.visibilityState === 'hidden') saveWorldNow(); };
    window.addEventListener('beforeunload', saveWorldNow);
    document.addEventListener('visibilitychange', onHide);
    return () => {
      clearInterval(t);
      window.removeEventListener('beforeunload', saveWorldNow);
      document.removeEventListener('visibilitychange', onHide);
    };
  }, [gameMode]);

  function joinServer() {
    const load = Object.values(multiplayerModules)[0];
    if (!load) {
      setNetError("Multiplayer isn't installed in this copy of the game (src/multiplayer.ts is missing).");
      return;
    }
    load()
      .then((m) => connectWith((m as { MultiplayerClient: new () => MpClient }).MultiplayerClient))
      .catch(() => setNetError('Could not load the multiplayer module.'));
  }

  function connectWith(MP: new () => MpClient) {
    const url = serverUrl.trim();
    if (!url) { setNetError('Type a server address first'); return; }
    try { localStorage.setItem('vb-server', url); } catch { /* storage may be blocked */ }
    mpRef.current?.disconnect();
    const mp = new MP();
    mpRef.current = mp;
    setNetStatus('connecting');
    setNetError(null);
    earlyBlocksRef.current = [];
    mp.events = {
      onWelcome: (w) => {
        myNetIdRef.current = w.id;
        mp.sendLook(currentLook());
        pendingWelcomeRef.current = w;
        const names: Record<number, string> = { [w.id]: w.name };
        for (const p of w.players) names[p.id] = p.name;
        onlineNamesRef.current = names;
        setOnlinePlayers(names);
        setNetStatus('online');
        activeWorldIdRef.current = null; // the server keeps multiplayer worlds
        // Everyone on a server shares its seed, world type and game mode
        const m = w.mode === 'creative' || w.mode === 'adventure' ? w.mode : 'survival';
        setActiveWorldMode(m);
        setActiveWorldType(w.worldType === 'superflat' ? 'superflat' : 'default');
        setActiveSeed(w.seed);
        setGameMode('playing');
      },
      onBlocks: (list) => {
        const h = gameHandleRef.current;
        if (h && !pendingWelcomeRef.current) h.applyRemoteBlocks(list);
        else earlyBlocksRef.current.push(...list); // arrived while the world was still loading
      },
      onMoves: (list) => {
        const h = gameHandleRef.current;
        if (!h) return;
        for (const [id, x, y, z, yaw, pitch, mode, held, act] of list) {
          if (id === myNetIdRef.current) continue;
          h.setRemotePlayer(id, onlineNamesRef.current[id] ?? 'Player', x, y, z, yaw, pitch, mode, held, act);
        }
      },
      onLook: (id, look) => { gameHandleRef.current?.setRemoteLook(id, look); },
      onJoin: (id, name) => {
        onlineNamesRef.current = { ...onlineNamesRef.current, [id]: name };
        setOnlinePlayers(onlineNamesRef.current);
      },
      onLeave: (id) => {
        gameHandleRef.current?.removeRemotePlayer(id);
        const next = { ...onlineNamesRef.current };
        delete next[id];
        onlineNamesRef.current = next;
        setOnlinePlayers(next);
      },
      onChat: (name, text) => pushMessage(`<${name}> ${text}`),
      onSystem: (text) => pushMessage(text, '#ffe066'),
      onTime: (t) => gameHandleRef.current?.setTime(t),
      onClose: (reason) => {
        mpRef.current = null;
        setNetStatus('offline');
        onlineNamesRef.current = {};
        setOnlinePlayers({});
        if (gameModeRef.current === 'playing') {
          disconnectedRef.current = true;
          setDisconnectReason(reason);
          if (document.pointerLockElement) document.exitPointerLock();
        } else {
          setNetError(reason);
        }
      },
    };
    mp.connect(url, username ?? 'Player');
  }

  // Online: send our position ~10 times a second, plus any blocks we changed
  useEffect(() => {
    if (gameMode !== 'playing' || netStatus !== 'online') return;
    let last = '';
    const t = setInterval(() => {
      const h = gameHandleRef.current;
      const mp = mpRef.current;
      if (!h || !mp || !mp.connected) return;
      const st = h.getNetState();
      const key = `${st.x.toFixed(2)},${st.y.toFixed(2)},${st.z.toFixed(2)},${st.yaw.toFixed(2)},${st.pitch.toFixed(2)},${st.mode},${st.held},${st.act}`;
      if (key !== last) {
        last = key;
        mp.sendMove(st.x, st.y, st.z, st.yaw, st.pitch, st.mode, st.held, st.act);
      }
      const blocks = h.takeBlockChanges();
      if (blocks.length) mp.sendBlocks(blocks);
    }, 100);
    return () => clearInterval(t);
  }, [gameMode, netStatus]);

  // Hold Tab to see who's online
  useEffect(() => {
    if (gameMode !== 'playing') return;
    const down = (e: KeyboardEvent) => { if (e.code === 'Tab' && !chatOpenRef.current) setShowPlayerList(true); };
    const up = (e: KeyboardEvent) => { if (e.code === 'Tab') setShowPlayerList(false); };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); };
  }, [gameMode]);

  function leaveDisconnected() {
    disconnectedRef.current = false;
    setDisconnectReason(null);
    exitToHome();
    setView('servers');
  }

  function addScriptLog(text: string, kind: LogLine['kind']) {
    logIdRef.current += 1;
    const line: LogLine = { id: logIdRef.current, text, kind };
    setScriptLog((l) => [...l.slice(-80), line]);
  }

  function readStore(scriptId: string): Record<string, unknown> {
    try { return JSON.parse(localStorage.getItem(`vb-store-${scriptId}`) ?? '{}') as Record<string, unknown>; } catch { return {}; }
  }

  // Everything a script can do goes through here, and every argument is checked
  function scriptCall(method: string, args: unknown[], scriptId: string): unknown {
    const h = gameHandleRef.current;
    if (!h) throw new Error('No world is running');
    const S = h.script;
    const num = (v: unknown, what: string) => {
      const n = Number(v);
      if (v === null || v === undefined || !Number.isFinite(n)) throw new Error(`${what} must be a number`);
      return n;
    };
    const opt = (v: unknown, fallback: number, what: string) => (v === null || v === undefined ? fallback : num(v, what));
    const xyz = (v: unknown, what: string): [number, number, number] | null => {
      if (v === null || v === undefined) return null;
      if (Array.isArray(v)) return [num(v[0], what), num(v[1], what), num(v[2], what)];
      const o = v as Record<string, unknown>;
      return [num(o.x, `${what}.x`), num(o.y, `${what}.y`), num(o.z, `${what}.z`)];
    };
    const item = (v: unknown): number => {
      const id = typeof v === 'number' ? (ITEM_INFO[v] ? v : null) : itemIdFromName(String(v));
      if (id === null) throw new Error(`Unknown item "${String(v)}"`);
      return id;
    };
    const color = (v: unknown, fallback: string) => (typeof v === 'string' && /^#[0-9a-fA-F]{6}$/.test(v) ? v : fallback);
    const obj = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' ? (v as Record<string, unknown>) : {});
    const stack = (st: ItemStack | null) => (st ? { item: blockNameOf(st.id), count: st.count } : null);
    const texture = (v: unknown, c: unknown): TextureSpec => {
      const t = obj(v);
      if (Array.isArray(t.pixels) && t.palette && typeof t.palette === 'object') {
        const palette: Record<string, string> = {};
        for (const [k, val] of Object.entries(t.palette as Record<string, unknown>).slice(0, 128)) palette[k.slice(0, 1)] = color(val, '#ff00ff');
        return { pixels: (t.pixels as unknown[]).slice(0, 64).map((r) => String(r).slice(0, 64)), palette };
      }
      return { color: color(t.color ?? c, '#9a9a9a') };
    };
    const blockList = (list: unknown): NetBlock[] => {
      if (!Array.isArray(list)) throw new Error('setBlocks needs a list of [x, y, z, block]');
      if (list.length > 32768) throw new Error('Too many blocks at once (the limit is 32768)');
      const out: NetBlock[] = [];
      for (const e of list) {
        if (!Array.isArray(e) || e.length < 4) continue;
        out.push([Math.floor(num(e[0], 'x')), Math.floor(num(e[1], 'y')), Math.floor(num(e[2], 'z')), blockIdFromName(e[3])]);
      }
      return out;
    };
    switch (method) {
      case 'chat': {
        const text = String(args[0]).slice(0, 256);
        pushMessage(text, color(args[1], '#ffffff'));
        addScriptLog(text, 'chat');
        return null;
      }
      // ---- player ----
      case 'player.get':
      case 'getPlayer': {
        const d = h.getDebugInfo();
        const inv = h.getInventory();
        return {
          name: usernameRef.current, x: d.x, y: d.y, z: d.z, eye: S.getEye(), look: S.getLook(),
          yaw: (-d.yaw * Math.PI) / 180, pitch: (-d.pitch * Math.PI) / 180,
          health: h.getHealth(), maxHealth: 20, hunger: h.getHunger(), mode: d.mode, dimension: S.getDimension(), onGround: S.isOnGround(),
          heldItem: stack(inv[selectedSlotRef.current] ?? null), offhandItem: stack(h.getOffhand()),
          armor: h.getArmor().map((a) => (a ? blockNameOf(a.id) : null)), effects: S.getEffects(),
        };
      }
      case 'player.teleport':
      case 'teleport':
        h.teleport(num(args[0], 'x'), num(args[1], 'y'), num(args[2], 'z'));
        return null;
      case 'player.damage': S.damagePlayer(num(args[0], 'amount'), String(args[1] ?? 'Magic')); return null;
      case 'player.heal': S.heal(num(args[0], 'amount')); return null;
      case 'player.setHealth': S.setPlayerStats(num(args[0], 'health'), null); return null;
      case 'player.setHunger': S.setPlayerStats(null, num(args[0], 'hunger')); return null;
      case 'player.launch': S.launch(num(args[0], 'x'), num(args[1], 'y'), num(args[2], 'z')); return null;
      case 'player.give':
      case 'give':
        return h.addItem(item(args[0]), Math.max(1, Math.min(2304, Math.floor(opt(args[1], 1, 'count')))));
      case 'player.removeItem':
        return h.removeItem(item(args[0]), Math.max(1, Math.min(2304, Math.floor(opt(args[1], 1, 'count')))));
      case 'player.countItem': {
        const id = item(args[0]);
        const off = h.getOffhand();
        return h.getInventory().reduce((n, st) => n + (st && st.id === id ? st.count : 0), off && off.id === id ? off.count : 0);
      }
      case 'player.getInventory':
        return h.getInventory().map((st, slot) => (st ? { slot, item: blockNameOf(st.id), count: st.count } : null)).filter(Boolean);
      case 'player.setSlot': {
        const slot = Math.floor(num(args[0], 'slot'));
        if (slot < 0 || slot >= INVENTORY_SIZE) throw new Error(`Slots go from 0 to ${INVENTORY_SIZE - 1}`);
        const next = h.getInventory();
        const empty = args[1] === null || args[1] === 'air' || opt(args[2], 1, 'count') <= 0;
        if (empty) next[slot] = null;
        else { const id = item(args[1]); next[slot] = { id, count: Math.max(1, Math.min(maxStack(id), Math.floor(opt(args[2], 1, 'count')))) }; }
        h.setSlots(next);
        return null;
      }
      case 'player.setGameMode': {
        const m = String(args[0]) as PlayMode;
        if (!['survival', 'creative', 'adventure', 'spectator'].includes(m)) throw new Error('Mode must be survival, creative, adventure or spectator');
        h.setGameMode(m);
        setPlayMode(m);
        return null;
      }
      case 'player.applyEffect': S.applyEffect(String(args[0]), opt(args[1], 30, 'seconds'), opt(args[2], 1, 'level')); return null;
      case 'player.removeEffect': S.removeEffect(String(args[0])); return null;
      case 'player.getEffects': return S.getEffects();
      case 'player.recoil': S.recoil(num(args[0], 'amount')); return null;
      case 'player.setZoom': S.setZoom(num(args[0], 'zoom')); return null;
      case 'player.setAiming': S.setAiming(!!args[0]); return null;
      // ---- world ----
      case 'world.getBlock':
      case 'getBlock':
        return blockNameOf(h.getBlock(num(args[0], 'x'), num(args[1], 'y'), num(args[2], 'z')));
      case 'world.setBlocks':
      case 'setBlocks':
        return h.setBlocks(blockList(args[0]));
      case 'world.fill':
      case 'fill': {
        const [x1, y1, z1, x2, y2, z2] = args.slice(0, 6).map((v) => Math.floor(num(v, 'Coordinate')));
        const id = blockIdFromName(args[6]);
        const volume = (Math.abs(x2 - x1) + 1) * (Math.abs(y2 - y1) + 1) * (Math.abs(z2 - z1) + 1);
        if (volume > 32768) throw new Error(`That's ${volume} blocks; the limit is 32768`);
        const out: NetBlock[] = [];
        for (let x = Math.min(x1, x2); x <= Math.max(x1, x2); x++)
          for (let y = Math.min(y1, y2); y <= Math.max(y1, y2); y++)
            for (let z = Math.min(z1, z2); z <= Math.max(z1, z2); z++) out.push([x, y, z, id]);
        return h.setBlocks(out);
      }
      case 'world.explode': S.explode(num(args[0], 'x'), num(args[1], 'y'), num(args[2], 'z'), opt(args[3], 3, 'power')); return null;
      case 'world.dropItem': S.dropItem(num(args[0], 'x'), num(args[1], 'y'), num(args[2], 'z'), item(args[3]), opt(args[4], 1, 'count')); return null;
      case 'world.getTime': return Math.round(S.getTime() * 24000);
      case 'world.setTime':
      case 'setTime': {
        const named: Record<string, number> = { day: 1000, noon: 6000, sunset: 12000, night: 13000, midnight: 18000, sunrise: 23000 };
        const ticks = typeof args[0] === 'string' ? named[args[0].toLowerCase()] : Number(args[0]);
        if (ticks === undefined || !Number.isFinite(ticks)) throw new Error('setTime needs day, noon, sunset, night, midnight or 0-24000');
        h.setTime((((ticks % 24000) + 24000) % 24000) / 24000);
        return null;
      }
      case 'world.raycast': {
        const o = obj(args[3]);
        const hit = S.raycast(xyz(args[0], 'origin'), xyz(args[1], 'direction'), opt(args[2], 50, 'maxDistance'), o.entities !== false, o.blocks !== false);
        if (!hit) return null;
        return { type: hit.type, point: hit.point, distance: hit.distance, entity: hit.entity ?? null,
          block: hit.block ? { x: hit.block.x, y: hit.block.y, z: hit.block.z, name: blockNameOf(hit.block.id) } : null };
      }
      case 'world.spawnProjectile': {
        const o = obj(args[0]);
        return S.spawnProjectile({
          x: num(o.x, 'x'), y: num(o.y, 'y'), z: num(o.z, 'z'), vx: opt(o.vx, 0, 'vx'), vy: opt(o.vy, 0, 'vy'), vz: opt(o.vz, 0, 'vz'),
          gravity: opt(o.gravity, 0, 'gravity'), damage: opt(o.damage, 4, 'damage'), color: color(o.color, '#ffe08a'), size: opt(o.size, 0.15, 'size'),
          lifetime: opt(o.lifetime, 5, 'lifetime'), explosion: opt(o.explosion, 0, 'explosion'), knockback: opt(o.knockback, 2, 'knockback'),
        });
      }
      case 'world.removeProjectile': return S.removeProjectile(num(args[0], 'id'));
      // ---- entities ----
      case 'entities.list': return S.listEntities();
      case 'entities.spawn': return S.spawnEntity(mobName(args[0]), num(args[1], 'x'), num(args[2], 'y'), num(args[3], 'z'));
      case 'entities.spawnNear':
      case 'summon':
        return h.summonMob(mobName(args[0]));
      case 'entities.remove': return S.removeEntity(num(args[0], 'id'));
      case 'entities.damage': return S.damageEntity(num(args[0], 'id'), num(args[1], 'amount'), opt(args[2], 1, 'knockback'));
      case 'entities.knockback': return S.knockEntity(num(args[0], 'id'), num(args[1], 'x'), num(args[2], 'y'), num(args[3], 'z'));
      // ---- items, blocks, recipes ----
      case 'items.register': {
        const o = obj(args[0]);
        const key = String(o.id ?? '').toLowerCase();
        registerCustomItem({
          key, name: String(o.name ?? key), texture: texture(o.icon ?? o.texture, o.color), maxStack: opt(o.maxStack, 64, 'maxStack'), food: opt(o.food, 0, 'food'),
          hold: o.hold === 'one_hand' || o.hold === 'two_hands' ? o.hold : 'item',
          lore: Array.isArray(o.lore) ? (o.lore as unknown[]).map(String) : [],
          leftClickUse: o.leftClick === 'use',
        });
        return key;
      }
      case 'blocks.register': {
        const o = obj(args[0]);
        const key = String(o.id ?? '').toLowerCase();
        const drops = o.drops === null ? null : o.drops === undefined || o.drops === 'self' ? undefined : item(o.drops);
        registerCustomBlock({
          key, name: String(o.name ?? key), texture: texture(o.texture ?? o.icon, o.color), shape: o.shape === 'cross' ? 'cross' : 'cube',
          solid: o.solid !== false, drops, hardness: opt(o.hardness, 0.6, 'hardness'), tier: opt(o.tier, 0, 'tier'), hidden: !!o.hidden,
        });
        S.refreshCustomBlocks();
        return key;
      }
      case 'recipes.register': {
        const o = obj(args[0]);
        const rows = Array.isArray(o.pattern) ? (o.pattern as unknown[]).map(String) : [];
        if (!rows.length || rows.length > 3 || rows.some((r) => r.length === 0 || r.length > 3)) throw new Error('pattern needs 1-3 rows of 1-3 characters');
        const width = Math.max(...rows.map((r) => r.length));
        const key = obj(o.key);
        const pattern: (number | null)[] = [];
        for (const r of rows) {
          for (let x = 0; x < width; x++) {
            const ch = r[x] ?? ' ';
            if (ch === ' ' || ch === '.') pattern.push(null);
            else if (!(ch in key)) throw new Error(`pattern uses "${ch}" but key doesn't say what it is`);
            else pattern.push(item(key[ch]));
          }
        }
        const outId = item(o.output);
        const id = `mod_${scriptId}_${String(o.id ?? outId)}`;
        const recipe: Recipe = {
          id, name: ITEM_INFO[outId]?.name ?? 'Item', pattern, width, height: rows.length,
          output: { id: outId, count: Math.max(1, Math.min(64, Math.floor(opt(o.count, 1, 'count')))) },
          needsTable: o.table === undefined ? width > 2 || rows.length > 2 : !!o.table,
        };
        const at = RECIPES.findIndex((r) => r.id === id);
        if (at >= 0) RECIPES[at] = recipe;
        else RECIPES.push(recipe);
        return id;
      }
      // ---- effects, sound, gui ----
      case 'particles.spawn': {
        const o = obj(args[3]);
        S.particles(num(args[0], 'x'), num(args[1], 'y'), num(args[2], 'z'), color(o.color, '#ffffff'), opt(o.count, 8, 'count'), opt(o.speed, 2, 'speed'), opt(o.size, 0.1, 'size'), opt(o.life, 0.8, 'life'));
        return null;
      }
      case 'particles.line':
        S.particleLine(num(args[0], 'x1'), num(args[1], 'y1'), num(args[2], 'z1'), num(args[3], 'x2'), num(args[4], 'y2'), num(args[5], 'z2'), color(obj(args[6]).color, '#ffffff'));
        return null;
      case 'sounds.play':
        return S.playSound(String(args[0]), args[1] == null ? undefined : num(args[1], 'x'), args[2] == null ? undefined : num(args[2], 'y'), args[3] == null ? undefined : num(args[3], 'z'));
      case 'gui.toast':
        setHint(String(args[0]).slice(0, 120));
        window.clearTimeout(hintTimerRef.current);
        hintTimerRef.current = window.setTimeout(() => setHint(null), 2200);
        return null;
      case 'gui.title':
        setTitleCard({ text: String(args[0]).slice(0, 60), sub: String(args[1] ?? '').slice(0, 80), id: Date.now() });
        window.clearTimeout(titleTimerRef.current);
        titleTimerRef.current = window.setTimeout(() => setTitleCard(null), 3000);
        return null;
      case 'gui.sidebar': {
        const lines = Array.isArray(args[1]) ? (args[1] as unknown[]).slice(0, 15).map((l) => String(l).slice(0, 40)) : [];
        setSidebar({ title: String(args[0]).slice(0, 30), lines });
        return null;
      }
      case 'gui.clearSidebar': setSidebar(null); return null;
      // ---- storage ----
      case 'storage.get':
      case 'storeGet':
        return readStore(scriptId)[String(args[0])] ?? null;
      case 'storage.set':
      case 'storeSet': {
        const store = readStore(scriptId);
        store[String(args[0])] = args[1];
        const json = JSON.stringify(store);
        if (json.length > 20000) throw new Error('Storage is full (20 KB per script)');
        localStorage.setItem(`vb-store-${scriptId}`, json);
        return null;
      }
      // ---- dimensions ----
      case 'dimensions.create': {
        const o = obj(args[0]);
        const id = String(o.id ?? '');
        if (!/^[a-z0-9_]{1,24}$/.test(id) || id === 'overworld' || id === 'nether') throw new Error('Dimension ids use lowercase letters, numbers and _ (and can\'t be overworld or nether)');
        const type = String(o.type ?? 'flat');
        if (!['flat', 'void', 'islands', 'caves'].includes(type)) throw new Error('type must be flat, void, islands or caves');
        const blk = (v: unknown, fallback: number) => (v === undefined || v === null ? fallback : blockIdFromName(v));
        S.createDimension({
          id, name: String(o.name ?? id).slice(0, 30), type: type as DimensionSpec['type'],
          top: blk(o.top, BLOCK_GRASS), filler: blk(o.filler, BLOCK_DIRT), base: blk(o.base, BLOCK_STONE), liquid: blk(o.liquid, 0),
          sky: color(o.sky, '#87ceeb'), fog: color(o.fog, '#b8dcf0'), light: Math.max(0, Math.min(1, opt(o.light, 1, 'light'))),
        });
        return id;
      }
      case 'dimensions.travel': {
        const id = String(args[0]);
        if (!S.travel(id, args[1] == null ? undefined : num(args[1], 'x'), args[2] == null ? undefined : num(args[2], 'z'))) {
          throw new Error(`There's no dimension "${id}". Create it first with game.dimensions.create`);
        }
        return null;
      }
      case 'dimensions.current': return S.getDimension();
      case 'dimensions.list': return S.listDimensions();
      default:
        throw new Error(`game.${method} doesn't exist`);
    }
  }

  // What Miniblox-style scripts read instantly: you, your items, nearby mobs
  function scriptSnapshot() {
    const h = gameHandleRef.current;
    if (!h) return { player: null, entities: [], items: [] };
    const S = h.script;
    const d = h.getDebugInfo();
    const inv = h.getInventory();
    const counts: Record<string, number> = {};
    for (const st of [...inv, h.getOffhand()]) if (st) { const n = blockNameOf(st.id); counts[n] = (counts[n] || 0) + st.count; }
    const held = inv[selectedSlotRef.current];
    return {
      player: {
        id: 1, uuid: 'local-player', name: usernameRef.current, pos: { x: d.x, y: d.y, z: d.z }, look: S.getLook(), eye: S.getEye(),
        health: h.getHealth(), hunger: h.getHunger(), mode: d.mode, onGround: S.isOnGround(), dimension: S.getDimension(),
        heldItem: held ? { item: blockNameOf(held.id), count: held.count } : null, counts, playtimeSec: Math.floor(playtimeRef.current),
      },
      entities: S.listEntities().slice(0, 200),
      items: allItemIds().map(blockNameOf),
    };
  }

  function getRunner(): ScriptRunner {
    if (!runnerRef.current) {
      runnerRef.current = new ScriptRunner({
        reservedCommands: new Set(COMMANDS.flatMap((c) => c.names)),
        snapshot: scriptSnapshot,
        log: (text, kind) => {
          pushMessage(text, kind === 'error' ? '#ff6b6b' : '#c8c8c8');
          addScriptLog(text, kind);
        },
        call: (method, args, scriptId) => scriptCall(method, args, scriptId),
      });
    }
    return runnerRef.current;
  }

  const allMods = () => [...OFFICIAL_MODS, ...modsStateRef.current.custom];

  function startEnabledMods() {
    const runner = getRunner();
    for (const m of allMods()) if (modsStateRef.current.enabled.includes(m.id)) runner.run(`mod:${m.id}`, m.name, m.code);
  }

  function toggleMod(m: Mod) {
    const on = !modsStateRef.current.enabled.includes(m.id);
    setModsState((st) => ({ ...st, enabled: on ? [...st.enabled, m.id] : st.enabled.filter((x) => x !== m.id) }));
    if (gameModeRef.current === 'playing') {
      if (on) getRunner().run(`mod:${m.id}`, m.name, m.code);
      else getRunner().stop(`mod:${m.id}`);
    }
  }

  function saveMod(m: Mod) {
    const mod: Mod = { ...m, id: m.id || `c-${newWorldId()}`, official: false };
    setModsState((st) => ({ ...st, custom: st.custom.some((x) => x.id === mod.id) ? st.custom.map((x) => (x.id === mod.id ? mod : x)) : [...st.custom, mod] }));
    // Restart it so edits take effect right away
    if (gameModeRef.current === 'playing' && modsStateRef.current.enabled.includes(mod.id)) getRunner().run(`mod:${mod.id}`, mod.name, mod.code);
  }

  /** Saves a Builder mod and switches it on, so it works straight away. */
  function saveBuilderMod(m: Mod) {
    const id = m.id || `c-${newWorldId()}`;
    const mod: Mod = { ...m, id, official: false };
    setBuilderMod(mod); // later saves update this same mod instead of making copies
    setModsState((st) => ({
      ...st,
      custom: st.custom.some((x) => x.id === id) ? st.custom.map((x) => (x.id === id ? mod : x)) : [...st.custom, mod],
      enabled: st.enabled.includes(id) ? st.enabled : [...st.enabled, id],
    }));
    if (gameModeRef.current === 'playing') getRunner().run(`mod:${id}`, mod.name, mod.code);
  }

  function forkMod(m: Mod) {
    saveMod({ ...m, id: '', name: `${m.name} (fork)`, author: username ?? 'You', official: false });
  }

  function deleteMod(m: Mod) {
    getRunner().stop(`mod:${m.id}`);
    setModsState((st) => ({ ...st, custom: st.custom.filter((x) => x.id !== m.id), enabled: st.enabled.filter((x) => x !== m.id), starred: st.starred.filter((x) => x !== m.id) }));
  }

  function importMod(json: string): string | null {
    try {
      const d = JSON.parse(json) as Partial<Mod>;
      if (typeof d.name !== 'string' || typeof d.code !== 'string') return 'That doesn\'t look like a mod (it needs a name and code).';
      if (d.code.length > 100_000) return 'That mod is too big.';
      saveMod({ id: '', name: d.name.slice(0, 40), author: String(d.author ?? 'Unknown').slice(0, 30), description: String(d.description ?? '').slice(0, 120), code: d.code, official: false });
      return null;
    } catch {
      return 'Couldn\'t read that. Paste exactly what the Export button copied.';
    }
  }

  function updateScript(id: string, patch: Partial<ScriptDoc>) {
    setScripts((list) => list.map((sc) => (sc.id === id ? { ...sc, ...patch } : sc)));
  }

  function runScript(sc: ScriptDoc) {
    const ok = getRunner().run(`script:${sc.id}`, sc.name, sc.code);
    setRunningScripts((r) => (ok ? [...r.filter((x) => x !== sc.id), sc.id] : r.filter((x) => x !== sc.id)));
  }

  function stopScript(id: string) {
    getRunner().stop(`script:${id}`);
    setRunningScripts((r) => r.filter((x) => x !== id));
  }

  function newScript(name = 'New Script', code = '// Write your script here, or ask the AI on the right.\n') {
    const sc: ScriptDoc = { id: newWorldId(), name, code };
    setScripts((l) => [...l, sc]);
    setActiveScriptId(sc.id);
  }

  function deleteScript(id: string) {
    stopScript(id);
    setScripts((l) => {
      const next = l.filter((sc) => sc.id !== id);
      return next.length ? next : [{ id: newWorldId(), name: 'My Script', code: '' }];
    });
  }

  // Scripts get a "tick" event 4 times a second while you play
  useEffect(() => {
    if (gameMode !== 'playing') return;
    const t = setInterval(() => {
      playtimeRef.current += 0.25;
      if (document.visibilityState === 'visible' && !menuOpenRef.current && !deadRef.current && Date.now() - lastInputRef.current < IDLE_AFTER_SECONDS * 1000) addActiveSeconds(0.25);
      if (Math.round(playtimeRef.current * 4) % 40 === 0) { try { localStorage.setItem('vb-playtime', String(Math.floor(playtimeRef.current))); } catch { /* storage blocked */ } }
      runnerRef.current?.pushSnapshot();
      runnerRef.current?.emit('tick');
    }, 250);
    return () => clearInterval(t);
  }, [gameMode]);

  function pushMessage(text: string, color = '#ffffff') {
    msgIdRef.current += 1;
    const msg: ChatMessage = { id: msgIdRef.current, text, color, time: Date.now() };
    setChatMessages((m) => [...m.slice(-99), msg]);
  }

  function openChat(prefix: string) {
    chatOpenRef.current = true;
    setChatInitial(prefix);
    setChatSession((n) => n + 1);
    setChatOpen(true);
    gameHandleRef.current?.setChatOpen(true);
    if (document.pointerLockElement) document.exitPointerLock();
  }

  function closeChat(relock = true) {
    chatOpenRef.current = false;
    setChatOpen(false);
    if (!helpOpenRef.current) {
      gameHandleRef.current?.setChatOpen(false);
      if (relock) gameHandleRef.current?.relock();
    }
  }

  function openHelp() {
    helpOpenRef.current = true;
    setHelpOpen(true);
    gameHandleRef.current?.setChatOpen(true);
    if (document.pointerLockElement) document.exitPointerLock();
  }

  function closeHelp() {
    helpOpenRef.current = false;
    setHelpOpen(false);
    gameHandleRef.current?.setChatOpen(false);
    gameHandleRef.current?.relock();
  }

  function submitChat(raw: string) {
    const text = raw.trim();
    if (text) setChatHistory((h) => [...h.slice(-49), text]);
    if (text.startsWith('/')) {
      if (runCommand(text) === 'help') {
        closeChat(false);
        openHelp();
        return;
      }
    } else if (text) {
      runnerRef.current?.emit('chat', { text });
      // Online, the server echoes chat back to everyone (you included)
      if (mpRef.current?.connected) mpRef.current.sendChat(text);
      else pushMessage(`<${username ?? 'Player'}> ${text}`);
    }
    closeChat();
  }

  function runCommand(raw: string): 'help' | void {
    const parts = raw.slice(1).trim().split(/\s+/).filter(Boolean);
    const cmd = (parts[0] ?? '').toLowerCase();
    const args = parts.slice(1);
    const h = gameHandleRef.current;
    const info = (t: string) => pushMessage(t, '#aaaaaa');
    const err = (t: string) => pushMessage(t, '#ff6b6b');
    if (!h) return;

    switch (cmd) {
      case 'help':
      case '?':
        return 'help';
      case 'gamemode':
      case 'mode':
      case 'gm': {
        const m = MODE_ALIASES[(args[0] ?? '').toLowerCase()];
        if (!m) {
          err(`Usage: /${cmd} <survival|creative|adventure|spectator>  (or s, c, a, sp)`);
          return;
        }
        h.setGameMode(m);
        setPlayMode(m);
        info(`Set own game mode to ${capitalize(m)} Mode`);
        return;
      }
      case 'tp':
      case 'teleport': {
        if (args.length !== 3) {
          err('Usage: /tp <x> <y> <z>   (use ~ for relative, e.g. /tp ~ ~20 ~)');
          return;
        }
        const d = h.getDebugInfo();
        const base = [d.x, d.y, d.z];
        const vals = args.map((a, i) => (a.startsWith('~') ? base[i] + (a.length > 1 ? Number(a.slice(1)) : 0) : Number(a)));
        if (vals.some((v) => !Number.isFinite(v))) {
          err('Coordinates must be numbers or ~ (like ~5)');
          return;
        }
        h.teleport(vals[0], vals[1], vals[2]);
        info(`Teleported to ${vals.map((v) => v.toFixed(1)).join(', ')}`);
        return;
      }
      case 'give': {
        if (!args[0]) {
          err('Usage: /give <item> [count]   e.g. /give diamond 5');
          return;
        }
        const id = itemIdFromName(args[0]);
        if (id === null) {
          err(`Unknown item "${args[0]}". Names look like: dirt, planks, stone_pickaxe, diamond`);
          return;
        }
        const count = Math.max(1, Math.min(64 * 36, parseInt(args[1] ?? '1', 10) || 1));
        const given = h.addItem(id, count);
        if (given === 0) err('Your inventory is full');
        else info(`Gave ${given} [${ITEM_INFO[id].name}]`);
        return;
      }
      case 'clear':
        h.clearInventory();
        info('Cleared your inventory');
        return;
      case 'kill':
        h.kill();
        info('You died. Respawning...');
        return;
      case 'time': {
        const named: Record<string, number> = { day: 1000, noon: 6000, sunset: 12000, night: 13000, midnight: 18000, sunrise: 23000 };
        const v = (args[1] ?? '').toLowerCase();
        const ticks = named[v] ?? Number(v);
        if ((args[0] ?? '').toLowerCase() !== 'set' || !v || !Number.isFinite(ticks)) {
          err('Usage: /time set <day|noon|sunset|night|midnight|0-24000>');
          return;
        }
        h.setTime((((ticks % 24000) + 24000) % 24000) / 24000);
        info(`Set the time to ${named[v] !== undefined ? v : Math.round(ticks)}`);
        return;
      }
      case 'list': {
        const names = Object.values(onlineNamesRef.current);
        if (!mpRef.current?.connected) info('You are playing offline. Join a server from the Servers page.');
        else info(`Players online (${names.length}): ${names.join(', ')}`);
        return;
      }
      case 'seed':
        info(`Seed: ${h.getDebugInfo().seed}`);
        return;
      case 'locate': {
        if ((args[0] ?? '').toLowerCase() !== 'village') {
          err('Usage: /locate village');
          return;
        }
        const found = h.locateVillage();
        if (!found) err('No village found. They only generate in the Overworld, in plains, deserts and snowy lands.');
        else info(`The nearest village is at ${found.x}, ${found.z}, about ${found.distance} blocks away. Use /tp ${found.x} ~ ${found.z} to go there.`);
        return;
      }
      case 'summon': {
        const kind = mobName(args.join(' '));
        if (!h.summonMob(kind)) {
          err('Usage: /summon <pig|cow|chicken|zombie|skeleton|creeper|spider|ghast|piglin|villager|iron golem>');
          return;
        }
        info(`Summoned a ${kind}`);
        return;
      }
      default:
        if (runnerRef.current?.hasCommand(cmd)) {
          runnerRef.current.runCommand(cmd, args, parts.slice(1).join(' '));
          return;
        }
        err(`Unknown command "/${cmd}". Type /help for a list of commands.`);
    }
  }

  function handleDropItems(items: Array<{ id: number; count: number }>) {
    gameHandleRef.current?.dropItems(items);
  }

  function handleQuickCraft(recipeId: string) {
    gameHandleRef.current?.quickCraft(recipeId, atCraftingTable);
  }

  function handleRemoveItem(id: number, count: number) {
    gameHandleRef.current?.removeItem(id, count);
  }

  function handleAuthClose(name: string) {
    if (name) {
      setUsername(name);
    }
    setShowModal(false);
  }

  /** Deletes a planet and its saved blocks from this device. */
  function handleDeleteWorld(world: { id?: string; name?: string }) {
    setSavedWorlds((prev) => prev.filter((w) => (world.id ? w.id !== world.id : w !== world)));
    if (world.id) { try { localStorage.removeItem(`vb-save-${world.id}`); } catch { /* storage blocked */ } }
  }

  function handleNavClick(v: View) {
    if (v === 'create-world') setCreatePreset({ mode: 'survival', worldType: 'default', nonce: Date.now() });
    setView(v);
  }

  function handleRenderDistanceChange(rd: number) {
    setRenderDistance(rd);
  }

  function handleSaveWorld(config: WorldConfig) {
    setSavedWorlds((prev) => [...prev, config]);
    setActiveWorldMode(config.mode as GameWorldMode);
    setActiveWorldType(config.worldType ?? 'default');
    setActiveSeed(config.seed ?? randomSeed());
    activeWorldIdRef.current = config.id ?? null;
    setGameMode('playing');
  }

  // Play a saved world with its own mode and world type (it used to always start Survival)
  function launchWorld(config: WorldConfig) {
    setActiveWorldMode(config.mode as GameWorldMode);
    setActiveWorldType(config.worldType ?? 'default');
    setActiveSeed(config.seed ?? randomSeed());
    activeWorldIdRef.current = config.id ?? null;
    setGameMode('playing');
  }

  // Home cards open Create World with the mode / world type already picked
  function handleCreatePreset(mode: WorldMode, worldType: WorldType) {
    setCreatePreset({ mode, worldType, nonce: Date.now() });
    setView('create-world');
  }

  function handleBackToWorlds() {
    setView('home');
  }

  function handlePlayNow() {
    setActiveWorldMode('survival');
    setActiveWorldType('default');
    setActiveSeed(randomSeed());
    activeWorldIdRef.current = null; // quick play isn't saved
    setGameMode('playing');
  }

  function handleExitGame() {
    saveWorldNow(); // save before the world is thrown away
    runnerRef.current?.stopAll(); // mods and scripts stop with the world
    setSidebar(null);
    setTitleCard(null);
    setRunningScripts([]);
    setScoped(false);
    // Leaving the game also leaves the server
    if (mpRef.current) {
      mpRef.current.disconnect();
      mpRef.current = null;
    }
    setNetStatus('offline');
    onlineNamesRef.current = {};
    setOnlinePlayers({});
    pendingWelcomeRef.current = null;
    if (gameHandleRef.current) {
      gameHandleRef.current.dispose();
      gameHandleRef.current = null;
    }
    setGameMode('menu');
  }

  if (!ready) {
    return <div className="h-screen w-screen bg-[#0a0e14]" />;
  }

  const currentUsername = username ?? '';
  selectedSlotRef.current = selectedSlot;
  usernameRef.current = currentUsername || 'Player';
  const showMenu = gameMode === 'menu';

  return (
    <>
      {/* Persistent soundtrack element — lives at the App level (not inside
          any view) so it keeps playing across sidebar navigation and while
          the game itself is running. */}
      <audio ref={audioRef} loop onEnded={() => setIsPlaying(false)} className="hidden" />

      <div
        className={`h-screen w-screen flex overflow-hidden bg-[#0a0e14] transition-opacity duration-300 ${
          showMenu ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      >
        <Sidebar username={currentUsername} view={view} onNavClick={handleNavClick} />
        <MainContent
          username={currentUsername}
          view={view}
          onPlaySurvival={handlePlayNow}
          renderDistance={renderDistance}
          onRenderDistanceChange={handleRenderDistanceChange}
          fov={fov}
          onFovChange={setFov}
          onSaveWorld={handleSaveWorld}
          onBackToWorlds={handleBackToWorlds}
          trackName={trackName}
          builtInTrack={builtInTrack}
          isPlaying={isPlaying}
          volume={volume}
          onTrackChange={handleTrackChange}
          onPlayBuiltIn={playBuiltInTrack}
          onTogglePlay={togglePlay}
          onVolumeChange={handleVolumeChange}
          graphicsQuality={graphicsQuality}
          onGraphicsQualityChange={setGraphicsQuality}
          textureRes={textureRes}
          onTextureResChange={changeTextureRes}
          hudPrefs={hudPrefs}
          onHudPrefsChange={setHudPrefs}
          sfxVolume={sfxVolume}
          onSfxVolumeChange={setSfxVolume}
          onPlayWorld={launchWorld}
          onCreatePreset={handleCreatePreset}
          onNavClick={handleNavClick}
          onDeleteWorld={handleDeleteWorld}
          createPreset={createPreset}
          serverUrl={serverUrl}
          onServerUrlChange={setServerUrl}
          onJoinServer={joinServer}
          netStatus={netStatus}
          netError={netError}
        />
        <ProfilePanel username={currentUsername} onPlayNow={handlePlayNow} />
        {showModal && <AuthModal onClose={handleAuthClose} />}
      </div>

      <div
        className={`fixed inset-0 z-40 bg-black transition-opacity duration-300 ${
          showMenu ? 'opacity-0 pointer-events-none' : 'opacity-100'
        }`}
      >
        <canvas
          id="gameCanvas"
          ref={canvasRef}
          className={`w-full h-full ${showMenu ? 'hidden' : 'block'}`}
        />
        {!showMenu && <GameOverlay />}
        {!showMenu && <GameHUD inventory={inventory} offhand={offhand} armor={armor} health={health} hunger={hunger} selectedSlot={selectedSlot} mode={playMode} />}
        {!showMenu && inventoryOpen && (
          <InventoryOverlay
            key={`${atCraftingTable}-${openChest}-${openFurnace}`}
            inventory={inventory}
            offhand={offhand}
            onOffhandChange={(st) => gameHandleRef.current?.setOffhand(st)}
            armor={armor}
            onArmorChange={(next) => gameHandleRef.current?.setArmor(next)}
            atCraftingTable={atCraftingTable}
            chestKey={openChest}
            furnaceKey={openFurnace}
            getFurnace={getFurnaceForUi}
            onFurnaceChange={(key, next) => gameHandleRef.current?.setFurnace(key, next)}
            isCreative={playMode === 'creative'}
            onSlotsChange={(next) => gameHandleRef.current?.setSlots(next)}
            getChest={(key) => gameHandleRef.current?.getChest(key) ?? emptySlots(27)}
            onChestChange={(key, next) => gameHandleRef.current?.setChest(key, next)}
            craftMode={craftMode}
            onCraftModeChange={setCraftMode}
            onQuickCraft={handleQuickCraft}
            onDropItems={handleDropItems}
          />
        )}
        {!showMenu && (
          <HudOverlays prefs={hudPrefs} getFps={() => gameHandleRef.current?.getFps() ?? 0} paused={chatOpen || helpOpen} />
        )}
        {!showMenu && showDebug && <DebugOverlay getInfo={() => gameHandleRef.current?.getDebugInfo() ?? null} />}
        {!showMenu && (
          <ChatBox
            key={chatSession}
            open={chatOpen}
            initialText={chatInitial}
            messages={chatMessages}
            history={chatHistory}
            onSubmit={submitChat}
          />
        )}
        {!showMenu && helpOpen && (
          <HelpPanel
            onClose={closeHelp}
            extra={[...(runnerRef.current?.commands.values() ?? [])].map((c) => ({ usage: '/' + c.name, desc: c.description || 'Added by a mod or script' }))}
          />
        )}
        {!showMenu && (
          <div
            className="absolute inset-0 z-[15] pointer-events-none transition-opacity duration-300"
            style={{ opacity: hurtFlash ? 1 : 0, background: 'radial-gradient(ellipse at center, rgba(0,0,0,0) 45%, rgba(200,0,0,0.55) 100%)' }}
          />
        )}
        {!showMenu && scoped && (
          <div className="absolute inset-0 z-10 pointer-events-none" style={{ background: 'radial-gradient(circle at center, transparent 0, transparent 36vh, rgba(0,0,0,0.97) calc(36vh + 2px))' }}>
            <div className="absolute left-1/2 top-[14vh] bottom-[14vh] w-px bg-black/85 -translate-x-1/2" />
            <div className="absolute top-1/2 left-[calc(50%-36vh)] right-[calc(50%-36vh)] h-px bg-black/85 -translate-y-1/2" />
          </div>
        )}
        {!showMenu && titleCard && (
          <div key={titleCard.id} className="absolute inset-x-0 top-[26%] z-20 flex flex-col items-center pointer-events-none vb-fade-in">
            <div className="font-[var(--font-retro)] text-white text-3xl text-center px-6 drop-shadow-[0_3px_0_rgba(0,0,0,0.8)]">{titleCard.text}</div>
            {titleCard.sub && <div className="text-white/90 text-lg mt-3 drop-shadow-[0_2px_0_rgba(0,0,0,0.8)]">{titleCard.sub}</div>}
          </div>
        )}
        {!showMenu && sidebar && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2 z-20 min-w-[150px] bg-black/45 px-3 py-2 pointer-events-none">
            <div className="text-[#ffe066] text-sm font-bold text-center mb-1"><ColorText text={sidebar.title} /></div>
            {sidebar.lines.map((l, i) => <div key={i} className="text-white text-xs leading-5 min-h-[1.25rem]"><ColorText text={l} color="#ffffff" /></div>)}
          </div>
        )}
        {!showMenu && levelToast && (
          <div className="absolute top-24 left-1/2 -translate-x-1/2 z-30 pointer-events-none vb-fade-in text-center">
            <div className="font-[var(--font-retro)] text-[#ffd23a] text-2xl drop-shadow-[0_3px_0_rgba(0,0,0,0.7)]">LEVEL UP!</div>
            <div className="mt-1 inline-flex items-center gap-2 rounded-full bg-black/60 px-4 py-1.5 text-white text-sm font-bold">
              Level {levelToast.level} <Coins className="w-4 h-4 text-[#ffd23a]" /> +{levelToast.coins} coins
            </div>
          </div>
        )}
        {!showMenu && hint && (
          <div className="absolute bottom-36 left-1/2 -translate-x-1/2 z-20 px-3 py-1.5 rounded-md bg-black/60 text-white text-sm pointer-events-none vb-fade-in">{hint}</div>
        )}
        {!showMenu && showPlayerList && netStatus === 'online' && <PlayerList players={onlinePlayers} myId={myNetIdRef.current} />}
        {!showMenu && disconnectReason !== null && <DisconnectedScreen reason={disconnectReason} onExit={leaveDisconnected} />}
        {!showMenu && deathReason !== null && (
          <DeathScreen reason={deathReason} onRespawn={handleRespawn} onExit={exitToHome} />
        )}
        {!showMenu && menuOpen && (
          <GameMenu
            page={menuPage}
            onResume={resumeGame}
            onOpenSettings={() => setMenuPage('settings')}
            onOpenScripts={() => setMenuPage('scripts')}
            onOpenMods={() => setMenuPage('mods')}
            onOpenShop={() => setMenuPage('shop')}
            onBack={() => setMenuPage('main')}
            onExit={exitToHome}
          >
            {menuPage === 'scripts' ? (
              <ScriptsWorkspace
                tab={scriptsTab}
                onTab={(t) => { if (t === 'builder') setBuilderMod(null); setScriptsTab(t); }}
                builder={
                  <ModBuilder
                    key={builderMod?.id ?? 'new'}
                    author={username ?? 'You'}
                    itemNames={allItemIds().map(blockNameOf)}
                    initial={builderMod}
                    onSave={saveBuilderMod}
                    onClose={() => setScriptsTab('scripts')}
                  />
                }
                scripts={scripts}
                activeId={activeScriptId || scripts[0].id}
                onSelect={setActiveScriptId}
                onChange={(id, code) => updateScript(id, { code })}
                onRename={(id, name) => updateScript(id, { name })}
                onNew={newScript}
                onDelete={deleteScript}
                running={runningScripts}
                onRun={runScript}
                onStop={stopScript}
                log={scriptLog}
                onClearLog={() => setScriptLog([])}
                names={{
                  blocks: ['air', 'water', 'lava', ...allItemIds().filter((id) => isBlockId(id)).map(blockNameOf)],
                  items: allItemIds().filter((id) => !isBlockId(id)).map(blockNameOf),
                }}
              />
            ) : menuPage === 'shop' ? (
              <ShopView compact />
            ) : menuPage === 'mods' ? (
              <ModsPanel
                official={OFFICIAL_MODS}
                custom={modsState.custom}
                enabled={modsState.enabled}
                starred={modsState.starred}
                author={username ?? 'You'}
                onToggle={toggleMod}
                onStar={(m) => setModsState((st) => ({ ...st, starred: st.starred.includes(m.id) ? st.starred.filter((x) => x !== m.id) : [...st.starred, m.id] }))}
                onFork={forkMod}
                onSave={saveMod}
                onDelete={deleteMod}
                onImport={importMod}
                onOpenBuilder={(m) => { setBuilderMod(m); setScriptsTab('builder'); setMenuPage('scripts'); }}
              />
            ) : (
              <SettingsView
                compact
                renderDistance={renderDistance}
                onRenderDistanceChange={handleRenderDistanceChange}
                fov={fov}
                onFovChange={setFov}
                trackName={trackName}
                builtInTrack={builtInTrack}
                isPlaying={isPlaying}
                volume={volume}
                onTrackChange={handleTrackChange}
                onPlayBuiltIn={playBuiltInTrack}
                onTogglePlay={togglePlay}
                onVolumeChange={handleVolumeChange}
                graphicsQuality={graphicsQuality}
                onGraphicsQualityChange={setGraphicsQuality}
                textureRes={textureRes}
                onTextureResChange={changeTextureRes}
                hudPrefs={hudPrefs}
                onHudPrefsChange={setHudPrefs}
                sfxVolume={sfxVolume}
                onSfxVolumeChange={setSfxVolume}
              />
            )}
          </GameMenu>
        )}
      </div>
    </>
  );
}
