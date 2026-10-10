import { useState, useEffect, useRef, useMemo, type FormEvent, type ChangeEvent, type MouseEvent as ReactMouseEvent, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from 'react';
import { ADVANCEMENT_TABS, advancementsFor, checkItems, checkEvent, loadAdvancements, saveAdvancements, clearAdvancements, type Advancement, type AdvancementTab } from './advancements';
import { SKINS, CAPES, type PlayerLook } from '@/cosmetics';
import { CAN_LINK_OUT, CAN_SELL_RANKS, ADS_POSSIBLE, PLATFORM, initAds, triggerRewardedAd, setGameplayActive, reportLoadingFinished } from '@/adEconomy';
import {
  getProgress, subscribeProgress, onLevelUp, addActiveSeconds, rewardAdCoins, rewardAdBooster, buyCosmetic, equipCosmetic, currentLook, reloadProgress,
  xpForLevel, DISCORD_INVITE_URL, TEBEX_STORE_URL, AD_COINS, LEVEL_UP_COINS, XP_PER_PERIOD, SECONDS_PER_PERIOD, BOOSTER_SECONDS, IDLE_AFTER_SECONDS,
} from '@/progression';
import { ModBuilder } from '@/ModBuilder';
import { parseModCode } from '@/modBuilderLogic';
import { readRank, worldLimit, WORLD_LIMITS, RANK_NAMES } from '@/ranks';
import { createVoxelGame, type GameWorldMode, type GraphicsQuality, type Recipe, type PlayMode, type DebugInfo, type WorldType, type Slots, type ItemStack, type SaveData, type WeatherKind, EXPERIMENTAL_IDS, experimentalEnabled, isWater, isLava, BLOCK_WATER, BLOCK_LAVA, BLOCK_GRASS, BLOCK_DIRT, BLOCK_STONE, ARMOR, ARMOR_PIECES, CUSTOM_ITEMS, CUSTOM_BLOCKS, customIdForKey, registerCustomItem, registerCustomBlock, createPlayerPreview, drawLookPreview, getTexturePreviews, setTextureResolution, type TextureRes, type DimensionSpec, type TextureSpec, maxStack, addToSlots, countInSlots, emptySlots, INVENTORY_SIZE, ITEM_INFO, RECIPES, getItemIconURL, matchRecipe, SMELTING, FUEL_SECONDS, isBlockId, type Trade, type Difficulty, ITEM_WAND, CHUNK_SIZE, CHUNK_HEIGHT } from '@/voxelGame';
import * as THREE from 'three';
import {
  withCount, addStackToSlots, maxDurability, itemDisplayName, enchantLabel, ENCHANTMENTS, enchantFits, enchantsConflict, ITEM_LAPIS, ITEM_BOOK, ITEM_ENCHANTED_BOOK, type Station,
  COMMAND_TYPES, type CommandBlockInfo, type CommandType,
} from '@/voxelGame';
import { enchantOffers, applyEnchants, anvilResult, canEnchant } from '@/enchanting';
import { ScriptRunner, OFFICIAL_MODS, SCRIPT_EXAMPLES, SCRIPT_API_HELP, AI_MODELS, checkApiUsage, type Mod, type AiMode, type AiTurn } from '@/scripting';
import { requestAssistant, parseSearchReplace, applySearchReplace, type AiMeta } from '@/aiAssistant';
import LoginOverlay from './LoginOverlay';
import SocialView from './SocialView';
import AdminPanel, { type PanelPlayer } from './AdminPanel';
import { useAccount } from './useAccount';
import { addFriend, unfriendByName, loadFriends, sendDM, startPolling, isGuestName, type DM } from './social';

// Multiplayer is optional: Vite only includes src/multiplayer.ts if the file
// exists, so deleting it (or the server folder) never breaks the game.
const multiplayerModules = import.meta.glob('./multiplayer.ts');
const multiplayerAvailable = Object.keys(multiplayerModules).length > 0;
type NetBlock = [number, number, number, number];
type NetPlayerInfo = { id: number; name: string; x: number; y: number; z: number; yaw: number; pitch: number; mode: string; look?: PlayerLook };
type ServerSettings = { difficulty: Difficulty; keepInventory: boolean; scripts: boolean; mods: boolean; commands: boolean };
const DEFAULT_SERVER: ServerSettings = { difficulty: 'normal', keepInventory: false, scripts: true, mods: true, commands: true };
type Welcome = { id: number; name: string; seed: number; worldType: 'default' | 'superflat'; mode: string; time: number; changes: NetBlock[]; players: NetPlayerInfo[]; hostId?: number | null; settings?: ServerSettings; weather?: WeatherKind; experimental?: boolean };
type MpEvents = {
  onWelcome?: (w: Welcome) => void;
  onHost?: (id: number) => void;
  onSettings?: (s: ServerSettings) => void;
  onBlocks?: (list: NetBlock[]) => void;
  onMoves?: (list: Array<[number, number, number, number, number, number, string, number, number]>) => void;
  onJoin?: (id: number, name: string) => void;
  onLeave?: (id: number, name: string) => void;
  onLook?: (id: number, look: PlayerLook) => void;
  onChat?: (name: string, text: string) => void;
  onSystem?: (text: string) => void;
  onTime?: (time: number) => void;
  onWeather?: (kind: WeatherKind) => void;
  onWhisper?: (from: string, text: string) => void;
  onWhispered?: (to: string, text: string) => void;
  onWhisperFail?: (to: string) => void;
  onSetMode?: (mode: string, by: string) => void;
  onAdminPlayers?: (list: Array<{ id: number; name: string; mode: string }>) => void;
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
  sendSettings(s: Partial<ServerSettings>): void;
  sendTime(time: number): void;
  sendWeather(kind: WeatherKind): void;
  kick(id: number): void;
  ban(id: number): void;
  sendSleep(on: boolean): void;
  sendWhisper(to: string, text: string): void;
  sendAdmin(token: string, action: 'check' | 'players' | 'kick' | 'ban' | 'gamemode', extra?: { name?: string; mode?: string }): void;
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

type View = 'home' | 'shop' | 'settings' | 'create-world' | 'servers' | 'planets' | 'social';
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
  { label: 'Social', icon: Users, view: 'social' },
  { label: 'Planets', icon: Globe, view: 'planets' },
  { label: 'Shop', icon: ShoppingBag, view: 'shop' },
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
    perks: [`${WORLD_LIMITS.vanguard} planets (instead of ${WORLD_LIMITS.none})`, 'Custom Chat Tag', '2ms CPU script budget framework'],
    borderClass: 'vb-border-copper border-2',
    accentText: 'text-[#e8a87c]',
    iconBg: 'from-[#b87333] to-[#8b5a2b]',
  },
  {
    name: 'ELITE',
    price: '$15',
    priceValue: 15,
    icon: Zap,
    perks: [`${WORLD_LIMITS.elite} planets`, 'Reflective linear gradient text colors', '25ms CPU script budget', '+100 daily AI terminal calls'],
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
    perks: [`${WORLD_LIMITS.champion} planets`, 'Animated molten magma chat tags', 'Cosmic floating chat tags', '75ms CPU script budget', 'Unlimited AI terminal access'],
    borderClass: 'vb-border-plasma',
    accentText: 'text-[#ffd700]',
    iconBg: 'from-[#ffd700] to-[#ff8c00]',
  },
];

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

function Sidebar({ username, view, onNavClick, socialBadge = 0 }: { username: string; view: View; onNavClick: (v: View) => void; socialBadge?: number }) {
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
              {item.view === 'social' && socialBadge > 0 && (
                <span data-testid="social-badge" className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-[#ff5252] text-white text-[10px] font-bold flex items-center justify-center">{socialBadge > 9 ? '9+' : socialBadge}</span>
              )}
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
function fmtPlayTime(sec: number): string {
  if (sec < 60) return sec < 5 ? 'New' : `${Math.floor(sec)}s`;
  const m = Math.floor(sec / 60);
  return m < 60 ? `${m} min` : `${Math.floor(m / 60)}h ${m % 60}m`;
}
function fmtDate(ms: number): string {
  const d = new Date(ms), now = new Date();
  const days = Math.floor((now.setHours(0, 0, 0, 0) - new Date(ms).setHours(0, 0, 0, 0)) / 86_400_000);
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: d.getFullYear() === new Date().getFullYear() ? undefined : 'numeric' });
}

/** Your planets (worlds): create a new one, play one, or delete one. */
function PlanetsView({ savedWorlds, limit, onPlayWorld, onCreate, onDelete }: { savedWorlds: any[]; limit: number; onPlayWorld: (config: any) => void; onCreate: () => void; onDelete: (world: any) => void }) {
  const full = savedWorlds.length >= limit;
  const [confirm, setConfirm] = useState<string | null>(null);
  return (
    <div className="vb-fade-in" data-testid="planets">
      <header className="mb-6 flex items-end justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2 mb-2"><Globe className="w-5 h-5 text-[#00e676]" /><span className="font-[var(--font-retro)] text-[10px] text-[#00e676]">PLANETS</span></div>
          <h1 className="font-[var(--font-retro)] text-xl text-white leading-relaxed tracking-wider">YOUR PLANETS</h1>
        </div>
        <div className="flex flex-col items-end gap-1.5">
          <button onClick={onCreate} disabled={full} data-testid="create-planet" title={full ? `You've reached your limit of ${limit} planets` : 'Create a new planet'}
            className={`flex items-center gap-2 px-5 py-3 rounded-xl font-bold text-sm transition-all duration-200 ${full ? 'bg-[#1a2230] text-[#5a6b80] cursor-not-allowed' : 'bg-[#00e676] text-[#0a0e14] hover:scale-105 active:scale-95'}`}>
            <Plus className="w-4 h-4" /> Create Planet
          </button>
          <span className={`text-[11px] ${full ? 'text-[#ffb347]' : 'text-[#5a6b80]'}`} data-testid="planet-count">{savedWorlds.length} / {limit} planets</span>
        </div>
      </header>
      {full && (
        <p className="text-[#ffb347] text-xs mb-4 rounded-xl border border-[#ffb347]/30 bg-[#ffb347]/5 px-4 py-2.5" data-testid="planet-limit-note">
          {savedWorlds.length > limit ? `You have more planets than your limit of ${limit}. They all still work, but delete some to make new ones.` : `You've reached your limit of ${limit} planets. Delete one to make room.`}
          {' '}Ranks give more: Vanguard {WORLD_LIMITS.vanguard}, Elite {WORLD_LIMITS.elite}, Champion {WORLD_LIMITS.champion}.
        </p>
      )}
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
                  {world.experimental && <span className="absolute top-2 right-2 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-[#ffb347] text-[#0a0e14]" data-testid="experimental-badge">Experimental</span>}
                </div>
                <div className="p-4">
                  <h3 className="text-white font-medium truncate" title={world.name}>{world.name}</h3>
                  <p className="text-[#5a6b80] text-[11px] mt-0.5" data-testid="planet-creator">By {world.creator ?? 'Unknown'}{world.createdAt ? ` · created ${fmtDate(world.createdAt)}` : ''}</p>
                  <div className="grid grid-cols-3 gap-1.5 mt-2.5" data-testid="planet-stats">
                    {([['Played', fmtPlayTime(world.playSeconds ?? 0)], ['Last', world.lastPlayed ? fmtDate(world.lastPlayed) : 'Never'], ['Level', world.mode === 'hardcore' ? 'Hard' : (world.difficulty ?? 'normal')]] as Array<[string, string]>).map(([k, v]) => (
                      <div key={k} className="rounded-lg bg-[#0d131b] border border-[#1a2230] px-2 py-1.5 text-center">
                        <div className="text-[9px] uppercase tracking-wider text-[#5a6b80]">{k}</div>
                        <div className="text-white text-[11px] font-medium capitalize truncate">{v}</div>
                      </div>
                    ))}
                  </div>
                  <p className="text-[#364860] text-[10px] mt-1.5 font-mono">Seed {world.seed ?? '?'}</p>
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

type WorldMode = 'survival' | 'creative' | 'adventure' | 'hardcore';

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
  difficulty?: Difficulty;
  keepInventory?: boolean;
  creator?: string;      // who made the planet
  createdAt?: number;    // when (ms since 1970)
  lastPlayed?: number;
  playSeconds?: number;  // time spent playing it
  experimental?: boolean; // early-access features, chosen at creation and fixed after
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
  hardcore: {
    image: '/images/survival-bg.jpg',
    tag: 'One Life',
    accent: 'from-red-600 to-rose-900',
    icon: Heart,
    description: 'Survival locked on Hard, and you only get one life',
  },
};

const modeLabels: Record<WorldMode, string> = {
  survival: 'Survival',
  creative: 'Creative',
  adventure: 'Adventure',
  hardcore: 'Hardcore',
};
function CreateWorldView({ onSave, onBack, used, limit, initialMode = 'survival', initialType = 'default' }: {
  onSave: (config: WorldConfig) => void;
  onBack: () => void;
  used: number;
  limit: number;
  initialMode?: WorldMode;
  initialType?: WorldType;
}) {
  const [worldName, setWorldName] = useState('');
  const [selectedMode, setSelectedMode] = useState<WorldMode>(initialMode);
  const [selectedType, setSelectedType] = useState<WorldType>(initialType);
  const [seedText, setSeedText] = useState('');
  const [customImage, setCustomImage] = useState<string | null>(null);
  const [difficulty, setDifficulty] = useState<Difficulty>('normal');
  const [experimental, setExperimental] = useState(false);

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

  const modes: WorldMode[] = ['survival', 'creative', 'adventure', 'hardcore'];
  const currentMode = modeConfig[selectedMode];
  const previewName = worldName.trim() || 'Untitled World';

  const [creating, setCreating] = useState(false);
  const full = used >= limit;
  function handleSave() {
    if (full || creating) return; // one click makes one planet
    setCreating(true);
    (document.activeElement as HTMLElement | null)?.blur?.(); // the button must not keep focus (Space would press it again while you play)
    onSave({
      name: worldName.trim() || 'Untitled World',
      mode: selectedMode,
      image: customImage ?? (selectedType === 'superflat' ? '/images/superflat-bg.jpg' : currentMode.image),
      tag: currentMode.tag,
      accent: currentMode.accent,
      worldType: selectedType,
      seed: seedFromText(seedText),
      id: newWorldId(),
      difficulty: selectedMode === 'hardcore' ? 'hard' : difficulty,
      keepInventory: false,
      experimental,
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

      {full && (
        <p className="text-[#ffb347] text-sm mb-6 max-w-5xl rounded-xl border border-[#ffb347]/30 bg-[#ffb347]/5 px-5 py-3" data-testid="create-limit-banner">
          You've reached your limit of {limit} planets, so you can't create another one right now. Delete a planet on the Planets page, or get a rank for more (Vanguard {WORLD_LIMITS.vanguard}, Elite {WORLD_LIMITS.elite}, Champion {WORLD_LIMITS.champion}).
        </p>
      )}

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

            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
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
            <div className="mt-4" data-testid="difficulty">
              <label className="text-[#8ea0b8] text-xs">Difficulty{selectedMode === 'hardcore' ? ' (Hardcore is always Hard)' : ''}</label>
              <div className="grid grid-cols-4 gap-2 mt-1.5">
                {(['peaceful', 'easy', 'normal', 'hard'] as Difficulty[]).map((d) => {
                  const on = (selectedMode === 'hardcore' ? 'hard' : difficulty) === d;
                  return (
                    <button key={d} type="button" disabled={selectedMode === 'hardcore'} onClick={() => setDifficulty(d)} data-testid={`difficulty-${d}`}
                      className={`py-2 rounded-xl text-xs font-bold capitalize transition-all ${on ? 'bg-[#00e676] text-[#0a0e14]' : 'bg-[#0a0e14] border border-[#243044] text-[#8ea0b8] hover:text-white'} ${selectedMode === 'hardcore' && !on ? 'opacity-40 cursor-not-allowed' : ''}`}>{d}</button>
                  );
                })}
              </div>
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
            <button type="button" onClick={() => setExperimental((v) => !v)} data-testid="toggle-experimental"
              className={`mt-4 w-full flex items-center justify-between gap-3 rounded-xl px-4 py-3 text-left border transition-all ${experimental ? 'bg-[#ffb347]/10 border-[#ffb347]/60' : 'bg-[#0a0e14] border-[#243044] hover:border-[#3a4a60]'}`}>
              <span>
                <span className="block text-white text-sm">Experimental features <span className="ml-1 text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-[#ffb347] text-[#0a0e14]">Early access</span></span>
                <span className="block text-[#5a6b80] text-[11px] mt-0.5">New biomes, blocks and items before everyone gets them: the Badlands, terracotta, red sand and the spyglass. Things may change or break. This can't be changed after the planet is made.</span>
              </span>
              <span className={`shrink-0 w-11 h-6 rounded-full p-0.5 transition-colors ${experimental ? 'bg-[#ffb347]' : 'bg-[#2a3444]'}`}><span className={`block w-5 h-5 rounded-full bg-white transition-transform ${experimental ? 'translate-x-5' : ''}`} /></span>
            </button>
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

          {full && (
            <p className="text-[#ffb347] text-xs rounded-xl border border-[#ffb347]/30 bg-[#ffb347]/5 px-4 py-2.5" data-testid="create-limit-note">
              You've reached your limit of {limit} planets. Delete one on the Planets page, or get a rank for more (Vanguard {WORLD_LIMITS.vanguard}, Elite {WORLD_LIMITS.elite}, Champion {WORLD_LIMITS.champion}).
            </p>
          )}
          <button
            onClick={handleSave}
            disabled={full || creating}
            data-testid="create-world"
            className="w-full py-4 rounded-2xl bg-gradient-to-r from-[#00e676] to-[#00b248] text-[#0a0e14] font-[var(--font-display)] text-base tracking-wide flex items-center justify-center gap-2 hover:from-[#00ff88] hover:to-[#00c853] transition-all duration-300 hover:scale-[1.01] active:scale-95 vb-glow"
          >
            <Check className="w-5 h-5" />
            {full ? `PLANET LIMIT REACHED (${used}/${limit})` : 'CREATE WORLD'}
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
  savedWorlds,
  planetLimit,
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
  socialView,
}: {
  socialView?: ReactNode;
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
  savedWorlds: WorldConfig[];
  planetLimit: number;
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
  if (view === 'social') {
    return <main className="flex-1 flex flex-col overflow-hidden bg-[#0a0e14] min-w-0">{socialView}</main>;
  }
  return (
    <main className="flex-1 overflow-y-auto vb-scroll bg-[#0a0e14]">
      <div className="px-8 py-6">
        {view === 'home' && <DiscordBanner />}
        {view === 'home' && <HomeView username={username} onPlaySurvival={onPlaySurvival} savedWorlds={savedWorlds} onPlayWorld={onPlayWorld} onCreatePreset={onCreatePreset} />}
        {view === 'shop' && <ShopView />}
        {view === 'planets' && <PlanetsView savedWorlds={savedWorlds} limit={planetLimit} onPlayWorld={onPlayWorld} onCreate={() => onNavClick('create-world')} onDelete={onDeleteWorld} />}
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
        {view === 'create-world' && <CreateWorldView key={createPreset.nonce} initialMode={createPreset.mode} initialType={createPreset.worldType} onSave={onSaveWorld} onBack={onBackToWorlds} used={savedWorlds.length} limit={planetLimit} />}
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

function GameHUD({ inventory, offhand, armor, health, hunger, selectedSlot, mode, xp }: {
  xp: { level: number; progress: number };
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
        {inventory[selectedSlot] ? itemDisplayName(inventory[selectedSlot]!) : ''}
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
          <ItemExtras st={offhand} />
        </div>
      )}
      {(mode === 'survival' || mode === 'adventure') && (
        <div className="relative w-full h-2 px-0.5 mt-1" data-testid="xp-bar" title={`Level ${xp.level}`}>
          <div className="w-full h-full bg-black/60 border border-black/80 rounded-[1px] overflow-hidden">
            <div className="h-full bg-gradient-to-b from-[#b4ff5a] to-[#5fc81e]" style={{ width: `${Math.round(xp.progress * 100)}%` }} />
          </div>
          {xp.level > 0 && (
            <span className="absolute left-1/2 -translate-x-1/2 -top-3.5 text-[13px] font-bold text-[#80ff20] drop-shadow-[0_0_2px_black] [text-shadow:1px_1px_0_#000,-1px_-1px_0_#000,1px_-1px_0_#000,-1px_1px_0_#000]" data-testid="xp-level">{xp.level}</span>
          )}
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
              <ItemExtras st={st} />
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

// The purple shimmer on enchanted items, added to the page once
function ensureGlintCss() {
  if (typeof document === 'undefined' || document.getElementById('vb-glint-css')) return;
  const st = document.createElement('style');
  st.id = 'vb-glint-css';
  st.textContent = `.vb-glint{position:absolute;inset:2px;pointer-events:none;mix-blend-mode:screen;opacity:.55;
background:linear-gradient(115deg,transparent 30%,rgba(190,110,255,.9) 45%,rgba(140,80,255,.4) 55%,transparent 70%);background-size:300% 300%;animation:vbGlint 2.6s linear infinite}
@keyframes vbGlint{from{background-position:120% 0}to{background-position:-120% 0}}`;
  document.head.appendChild(st);
}
/** Wear bar (green to red) and the enchantment shimmer drawn over an item icon. */
function ItemExtras({ st }: { st?: ItemStack | null }) {
  if (!st) return null;
  ensureGlintCss();
  const max = maxDurability(st.id);
  const left = max > 0 && st.damage ? Math.max(0, 1 - st.damage / max) : null;
  const glint = !!st.ench && Object.keys(st.ench).length > 0;
  return (
    <>
      {glint && <span className="vb-glint" />}
      {left !== null && (
        <span className="absolute left-1 right-1 bottom-0.5 h-[3px] bg-black/80 pointer-events-none" data-testid="durability-bar">
          <span className="block h-full" style={{ width: `${Math.max(4, left * 100)}%`, background: `hsl(${Math.round(120 * left)}, 90%, 45%)` }} />
        </span>
      )}
    </>
  );
}
/** The tooltip lines for a stack: its name, enchantments, wear and lore (like Minecraft). */
function ItemTooltip({ st, x, y }: { st: ItemStack; x: number; y: number }) {
  const info = ITEM_INFO[st.id];
  if (!info) return null;
  const max = maxDurability(st.id);
  return (
    <div className="fixed z-50 pointer-events-none max-w-[280px] px-2.5 py-1.5 bg-[#12001c]/95 border-2 border-[#2c0a63] rounded" style={{ left: x + 16, top: y - 12 }} data-testid="item-tooltip">
      <div className={`text-sm ${st.name ? 'italic text-[#55ffff]' : st.ench ? 'text-[#55ffff]' : 'text-white'}`}>{itemDisplayName(st)}</div>
      {Object.entries(st.ench ?? {}).map(([k, l]) => <div key={k} className="text-xs leading-5 text-[#aaaaaa]">{enchantLabel(k, l)}</div>)}
      {(info.lore ?? []).map((l, i) => <div key={i} className="text-xs leading-5"><ColorText text={l} color="#aaaaaa" /></div>)}
      {max > 0 && st.damage ? <div className="text-xs leading-5 text-white/80">Durability: {max - st.damage} / {max}</div> : null}
    </div>
  );
}

function ItemSlot({ id, count, onMouseDown, onMouseEnter, highlight = false, size = 'md', st, slotKey }: {
  st?: ItemStack | null;
  slotKey?: string;
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
      data-slot={slotKey}
      className={`${box} border-2 flex items-center justify-center relative cursor-pointer select-none transition-colors duration-100 ${
        highlight ? 'bg-[#a8a8a8] border-white' : 'bg-[#8b8b8b] border-[#3d3d3d] hover:bg-[#a0a0a0]'
      }`}
      style={{ boxShadow: 'inset -2px -2px 0 rgba(0,0,0,0.25), inset 2px 2px 0 rgba(255,255,255,0.15)' }}
    >
      {id !== null && <ItemIcon id={id} className={size === 'sm' ? 'w-6 h-6' : 'w-8 h-8'} />}
      {id !== null && count !== undefined && count > 1 && (
        <span className="absolute bottom-0 right-0.5 text-[10px] text-white font-bold drop-shadow-[0_1px_0_black]">{count}</span>
      )}
      <ItemExtras st={st} />
    </div>
  );
}

type HeldStack = ItemStack;
type Container = 'inv' | 'chest' | 'grid' | 'offhand' | 'armor' | 'furnace' | 'station';
/** What the enchanting table and anvil need from the game. */
type StationApi = {
  xpLevel: number;
  spend: (levels: number) => boolean;
  seed: () => number;
  reroll: () => void;
  sound: (kind: 'enchant' | 'anvil') => void;
  onEnchanted: () => void;
};

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
/** Manage Server: rules for this world, and (online) the players. Only the host can change things. */
const TIME_PRESETS: Array<{ label: string; time: number }> = [
  { label: 'Sunrise', time: 0 }, { label: 'Noon', time: 0.25 }, { label: 'Sunset', time: 0.5 }, { label: 'Midnight', time: 0.75 },
];
const WEATHER_OPTIONS: Array<{ kind: WeatherKind; label: string }> = [
  { kind: 'clear', label: 'Clear' }, { kind: 'rain', label: 'Rain' }, { kind: 'snow', label: 'Snow' },
];

function ManageServerView({ settings, hardcore, online, isHost, players, myId, hostId, weather, onChange, onKick, onBan, onTime, onWeather }: {
  settings: ServerSettings; hardcore: boolean; online: boolean; isHost: boolean;
  players: Array<{ id: number; name: string }>; myId: number | null; hostId: number | null; weather: WeatherKind;
  onChange: (s: Partial<ServerSettings>) => void; onKick: (id: number) => void; onBan: (id: number) => void;
  onTime: (t: number) => void; onWeather: (k: WeatherKind) => void;
}) {
  const [confirmBan, setConfirmBan] = useState<number | null>(null);
  const toggle = (key: 'keepInventory' | 'scripts' | 'mods' | 'commands', label: string, hint: string) => (
    <button disabled={!isHost} onClick={() => onChange({ [key]: !settings[key] })} data-testid={`toggle-${key}`}
      className="flex items-center justify-between gap-3 w-full rounded-xl bg-[#121822] border border-[#243044] px-4 py-3 text-left disabled:opacity-60">
      <span><span className="block text-white text-sm">{label}</span><span className="block text-[#5a6b80] text-[11px]">{hint}</span></span>
      <span className={`w-11 h-6 rounded-full p-0.5 transition-colors ${settings[key] ? 'bg-[#00e676]' : 'bg-[#2a3444]'}`}><span className={`block w-5 h-5 rounded-full bg-white transition-transform ${settings[key] ? 'translate-x-5' : ''}`} /></span>
    </button>
  );
  return (
    <div className="flex flex-col gap-4" data-testid="manage-server">
      {!isHost && <p className="text-[#ffb347] text-xs">Only the host can change these.</p>}
      <div>
        <p className="text-[#8ea0b8] text-xs mb-1.5">Difficulty{hardcore ? ' (Hardcore is always Hard)' : ''}</p>
        <div className="grid grid-cols-4 gap-2">
          {(['peaceful', 'easy', 'normal', 'hard'] as Difficulty[]).map((d) => (
            <button key={d} disabled={!isHost || hardcore} onClick={() => onChange({ difficulty: d })} data-testid={`server-difficulty-${d}`}
              className={`py-2 rounded-xl text-xs font-bold capitalize ${settings.difficulty === d ? 'bg-[#00e676] text-[#0a0e14]' : 'bg-[#121822] border border-[#243044] text-[#8ea0b8] hover:text-white'} disabled:cursor-not-allowed`}>{d}</button>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <p className="text-[#8ea0b8] text-xs mb-1.5">Time</p>
          <div className="grid grid-cols-2 gap-2">
            {TIME_PRESETS.map((p) => (
              <button key={p.label} disabled={!isHost} onClick={() => onTime(p.time)} data-testid={`server-time-${p.label.toLowerCase()}`}
                className="py-2 rounded-xl text-xs font-bold bg-[#121822] border border-[#243044] text-[#8ea0b8] hover:text-white hover:border-[#00e676]/50 active:scale-95 transition-all disabled:cursor-not-allowed disabled:opacity-60">{p.label}</button>
            ))}
          </div>
        </div>
        <div>
          <p className="text-[#8ea0b8] text-xs mb-1.5">Weather</p>
          <div className="grid grid-cols-3 gap-2">
            {WEATHER_OPTIONS.map((w) => (
              <button key={w.kind} disabled={!isHost} onClick={() => onWeather(w.kind)} data-testid={`server-weather-${w.kind}`}
                className={`py-2 rounded-xl text-xs font-bold transition-all active:scale-95 ${weather === w.kind ? 'bg-[#00e676] text-[#0a0e14]' : 'bg-[#121822] border border-[#243044] text-[#8ea0b8] hover:text-white'} disabled:cursor-not-allowed disabled:opacity-60`}>{w.label}</button>
            ))}
          </div>
          <p className="text-[#5a6b80] text-[10px] mt-1">Rain is snow in cold biomes. It changes by itself over time.</p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {toggle('keepInventory', 'Keep inventory', 'Keep your items when you die')}
        {toggle('commands', 'Allow commands', 'Chat commands like /give and /tp')}
        {toggle('scripts', 'Allow scripts', 'Off hides the Scripts button')}
        {toggle('mods', 'Allow mods', 'Off hides the Mods button')}
      </div>
      <div>
        <p className="text-[#8ea0b8] text-xs mb-1.5">Players</p>
        {!online ? (
          <p className="text-[#5a6b80] text-xs rounded-xl bg-[#121822] border border-[#243044] px-4 py-3">Just you. Kick and ban are for multiplayer servers.</p>
        ) : (
          <div className="flex flex-col gap-1.5" data-testid="player-list">
            {players.map((pl) => (
              <div key={pl.id} className="flex items-center gap-2 rounded-xl bg-[#121822] border border-[#243044] px-4 py-2">
                <span className="text-white text-sm flex-1 truncate">{pl.name}{pl.id === myId ? ' (you)' : ''}{pl.id === hostId ? ' · host' : ''}</span>
                {isHost && pl.id !== myId && (confirmBan === pl.id ? (
                  <>
                    <span className="text-[#ff8a8a] text-xs">Ban {pl.name}?</span>
                    <button onClick={() => { onBan(pl.id); setConfirmBan(null); }} className="px-3 py-1 rounded-lg bg-[#ff5555] text-white text-xs font-bold">Ban</button>
                    <button onClick={() => setConfirmBan(null)} className="px-3 py-1 rounded-lg bg-[#1a2230] text-[#8ea0b8] text-xs">Cancel</button>
                  </>
                ) : (
                  <>
                    <button onClick={() => onKick(pl.id)} data-testid="kick" className="px-3 py-1 rounded-lg bg-[#1a2230] text-[#ffb347] text-xs font-bold hover:bg-[#ffb347]/10">Kick</button>
                    <button onClick={() => setConfirmBan(pl.id)} data-testid="ban" className="px-3 py-1 rounded-lg bg-[#1a2230] text-[#ff8a8a] text-xs font-bold hover:bg-[#ff5555]/10">Ban</button>
                  </>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/** Trading with a villager: each offer shows what you give and what you get. */
function TradeOverlay({ trade, inventory, note, onTrade, onClose }: {
  trade: { id: number; profession: string; trades: Trade[] };
  inventory: Slots;
  note: string | null;
  onTrade: (index: number) => void;
  onClose: () => void;
}) {
  const icon = (id: number, n: number) => (
    <span className="relative inline-flex w-10 h-10 items-center justify-center rounded-md bg-[#1a2230] border border-[#243044]" title={ITEM_INFO[id]?.name}>
      <img src={getItemIconURL(id)} alt={ITEM_INFO[id]?.name ?? ''} className="w-8 h-8 [image-rendering:pixelated]" />
      {n > 1 && <span className="absolute bottom-0 right-0.5 text-[10px] font-bold text-white drop-shadow">{n}</span>}
    </span>
  );
  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/50" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }} data-testid="trade">
      <div className="w-[440px] max-w-[95vw] rounded-2xl bg-[#0d131b] border border-[#243044] p-5 text-white">
        <div className="flex items-center justify-between mb-4">
          <span className="font-[var(--font-retro)] text-xs tracking-wider">{trade.profession.toUpperCase()}</span>
          <button onClick={onClose} className="text-[#8ea0b8] hover:text-white text-sm">✕</button>
        </div>
        <div className="flex flex-col gap-2">
          {trade.trades.map((t, i) => {
            const can = t.give.every(([id, n]) => countInSlots(inventory, id) >= n);
            return (
              <div key={i} className="flex items-center gap-2 rounded-xl bg-[#121822] border border-[#243044] px-3 py-2" data-testid="trade-row">
                <div className="flex gap-1">{t.give.map(([id, n], k) => <span key={k}>{icon(id, n)}</span>)}</div>
                <span className="text-[#5a6b80] px-1">→</span>
                {icon(t.get[0], t.get[1])}
                <span className="flex-1 text-xs text-[#8ea0b8] truncate pl-1">{t.ench ? `Enchanted Book: ${Object.entries(t.ench).map(([k, v]) => enchantLabel(k, v)).join(', ')}` : ITEM_INFO[t.get[0]]?.name}</span>
                <button disabled={!can} onClick={() => onTrade(i)} data-testid="trade-button"
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all active:scale-95 ${can ? 'bg-[#00e676] text-[#0a0e14] hover:brightness-110' : 'bg-[#1a2230] text-[#5a6b80] cursor-not-allowed'}`}>Trade</button>
              </div>
            );
          })}
        </div>
        {note && <p className="text-xs text-[#ff8a8a] mt-3">{note}</p>}
      </div>
    </div>
  );
}

/** Minecraft-style command block setup: the command, its type, and when it runs. */
function CommandBlockPanel({ info, onDone, onCancel }: {
  info: CommandBlockInfo;
  onDone: (cfg: { type: CommandType; cmd: string; auto: boolean; conditional: boolean }) => void;
  onCancel: () => void;
}) {
  const [cmd, setCmd] = useState(info.cmd);
  const [type, setType] = useState<CommandType>(info.type);
  const [auto, setAuto] = useState(info.auto);
  const [conditional, setConditional] = useState(info.conditional);
  const done = () => onDone({ type, cmd: cmd.trim(), auto, conditional });
  const toggle = (on: boolean, a: string, b: string, set: (v: boolean) => void, id: string) => (
    <button type="button" onClick={() => set(!on)} data-testid={id}
      className="flex-1 py-2 rounded-lg bg-[#121822] border border-[#243044] text-white text-xs font-medium hover:border-[#00e676] transition-colors">{on ? b : a}</button>
  );
  const names: Record<CommandType, string> = { impulse: 'Impulse', chain: 'Chain', repeating: 'Repeat' };
  const colors: Record<CommandType, string> = { impulse: '#d87a2f', chain: '#4fa37a', repeating: '#7a52c8' };
  return (
    <div className="absolute inset-0 z-40 bg-black/70 backdrop-blur-sm flex items-center justify-center vb-fade-in" onContextMenu={(e) => e.preventDefault()} data-testid="command-block">
      <div className="w-[560px] max-w-[94vw] bg-[#0d131b] border border-[#243044] rounded-2xl p-6 shadow-2xl" onKeyDown={(e) => { e.stopPropagation(); if (e.key === 'Enter') done(); if (e.key === 'Escape') onCancel(); }}>
        <h3 className="font-[var(--font-retro)] text-white text-sm tracking-wider uppercase mb-4 flex items-center gap-2">
          <span className="w-3 h-3 rounded-sm" style={{ background: colors[type] }} /> Set Console Command for Block
        </h3>
        <label className="text-[#8ea0b8] text-xs">Console Command</label>
        <input autoFocus value={cmd} onChange={(e) => setCmd(e.target.value)} maxLength={512} spellCheck={false} data-testid="command-input"
          placeholder="/say Hello! · /give @p diamond 1 · /setblock ~ ~2 ~ glowstone"
          className="mt-1.5 w-full bg-[#0a0e14] border border-[#243044] rounded-lg px-3 py-2.5 text-white text-sm font-mono placeholder-[#364860] focus:border-[#00e676] focus:outline-none" />
        <p className="text-[#5a6b80] text-[10px] mt-1.5">~ means this block's position (~ ~1 ~ is the block above it). @p, @s and @a all mean you.</p>
        <div className="mt-4 grid grid-cols-3 gap-2">
          {COMMAND_TYPES.map((t: CommandType) => (
            <button key={t} type="button" onClick={() => setType(t)} data-testid={`command-type-${t}`}
              className={`py-2 rounded-lg text-xs font-bold border transition-all ${type === t ? 'text-[#0a0e14] border-transparent' : 'bg-[#121822] border-[#243044] text-[#8ea0b8] hover:text-white'}`}
              style={type === t ? { background: colors[t] } : undefined}>{names[t]}</button>
          ))}
        </div>
        <div className="mt-2 flex gap-2">
          {toggle(conditional, 'Unconditional', 'Conditional', setConditional, 'command-conditional')}
          {toggle(auto, 'Needs Redstone', 'Always Active', setAuto, 'command-auto')}
        </div>
        <p className="text-[#5a6b80] text-[10px] mt-2">
          {type === 'impulse' ? 'Impulse: runs once each time it gets power (or once, when set to Always Active).' : type === 'repeating' ? 'Repeat: runs 20 times a second while it has power (or all the time when Always Active).' : 'Chain: runs right after the command block pointing into it.'}
          {conditional ? ' Conditional: only if the block behind it worked.' : ''}
        </p>
        <label className="text-[#8ea0b8] text-xs mt-4 block">Previous Output</label>
        <div className={`mt-1.5 min-h-[34px] rounded-lg bg-[#0a0e14] border border-[#1a2230] px-3 py-2 text-xs font-mono ${info.last ? (info.success ? 'text-[#80ff20]' : 'text-[#ff6b6b]') : 'text-[#364860]'}`} data-testid="command-last">{info.last || 'Nothing yet'}</div>
        <div className="mt-5 flex gap-2">
          <button onClick={done} data-testid="command-done" className="flex-1 py-2.5 rounded-xl bg-[#00e676] text-[#0a0e14] font-bold text-sm hover:bg-[#00e676]/90">Done</button>
          <button onClick={onCancel} className="flex-1 py-2.5 rounded-xl bg-[#121822] border border-[#243044] text-white text-sm hover:border-[#3a4a60]">Cancel</button>
        </div>
      </div>
    </div>
  );
}

function InventoryOverlay({
  inventory, offhand, armor, atCraftingTable, chestKey, furnaceKey = null, isCreative, craftMode, onCraftModeChange,
  onQuickCraft, onSlotsChange, onOffhandChange, onArmorChange, getChest, onChestChange, getFurnace, onFurnaceChange, onDropItems,
  station = null, stationApi,
}: {
  station?: Station | null;
  stationApi?: StationApi;
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
  const [hoverStack, setHoverStack] = useState<ItemStack | null>(null);
  // Enchanting table / anvil: two input slots (item + lapis, or left + right)
  const [stationSlots, setStationSlots] = useState<Slots>(() => emptySlots(2));
  const stationRef = useRef(stationSlots);
  function commitStation(next: Slots) { stationRef.current = next; setStationSlots(next); }
  const [enchSeed, setEnchSeed] = useState(() => stationApi?.seed() ?? 0);
  const [anvilName, setAnvilName] = useState<string | undefined>(undefined);
  const anvilLeftId = stationSlots[0]?.id ?? null;
  useEffect(() => { setAnvilName(undefined); }, [anvilLeftId]);

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
  const arrOf = (c: Container): Slots => (c === 'inv' ? invRef.current : c === 'furnace' ? furnaceRef.current : c === 'chest' ? chestRef.current : c === 'offhand' ? [offRef.current] : c === 'armor' ? armRef.current : c === 'station' ? stationRef.current : gridRef.current);
  const commit = (c: Container, next: Slots) => (c === 'inv' ? commitInv(next) : c === 'furnace' ? commitFurnace(next) : c === 'chest' ? commitChest(next) : c === 'offhand' ? commitOff(next[0] ?? null) : c === 'armor' ? commitArm(next) : c === 'station' ? commitStation(next) : commitGrid(next));
  /** May this stack go in this station slot? Enchanting: an enchantable item in 0, lapis in 1. */
  const stationAccepts = (i: number, st: ItemStack): boolean =>
    station?.kind === 'enchanting' ? (i === 0 ? canEnchant(st) : st.id === ITEM_LAPIS) : true;

  useEffect(() => {
    const up = () => { spreadingRef.current = false; };
    window.addEventListener('mouseup', up);
    return () => window.removeEventListener('mouseup', up);
  }, []);

  // Closing drops whatever is left in the crafting grid or on your cursor; the enchanting table and
  // anvil hand their items back (or drop them if your inventory is full)
  const slotsRef = useRef(onSlotsChange);
  slotsRef.current = onSlotsChange;
  useEffect(() => () => {
    const drops: ItemStack[] = gridRef.current.filter((st): st is ItemStack => !!st);
    if (cursorRef.current) drops.push(cursorRef.current);
    const back = stationRef.current.filter((st): st is ItemStack => !!st);
    if (back.length) {
      const next = invRef.current.slice();
      for (const st of back) { const left = addStackToSlots(next, st); if (left > 0) drops.push(withCount(st, left)); }
      slotsRef.current(next);
    }
    if (drops.length) dropRef.current(drops);
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
    // Enchanting table and anvil slots: one item to work on, lapis or extra material beside it
    if (c === 'station') {
      if (!cur) { if (slot) { commitCursor(slot); arr[i] = null; commit(c, arr); } return; }
      if (!stationAccepts(i, cur)) return;
      if (!slot) {
        const one = station?.kind === 'enchanting' && i === 0; // the table takes one item at a time
        arr[i] = one ? withCount(cur, 1) : cur;
        commitCursor(one && cur.count > 1 ? withCount(cur, cur.count - 1) : null);
      } else if (slot.id === cur.id && slot.count < maxStack(slot.id) && !(station?.kind === 'enchanting' && i === 0)) {
        const move = Math.min(maxStack(slot.id) - slot.count, cur.count);
        arr[i] = withCount(slot, slot.count + move);
        commitCursor(cur.count - move > 0 ? withCount(cur, cur.count - move) : null);
      } else if (cur.count === 1 || !(station?.kind === 'enchanting' && i === 0)) {
        arr[i] = cur;
        commitCursor(slot);
      } else return;
      commit(c, arr);
      return;
    }
    // The furnace's output slot is take-only (you can scoop more onto a matching stack in your hand)
    if (c === 'furnace' && i === 2) {
      if (!slot) return;
      if (!cur) { commitCursor(slot); arr[2] = null; }
      else if (cur.id === slot.id && cur.count + slot.count <= maxStack(slot.id)) { commitCursor(withCount(cur, cur.count + slot.count)); arr[2] = null; }
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
        arr[i] = withCount(slot, slot.count + move);
        commitCursor(cur.count - move > 0 ? withCount(cur, cur.count - move) : null);
      } else {
        arr[i] = cur; // different item: swap
        commitCursor(slot);
      }
    } else if (e.button === 2) {
      if (!cur) {
        if (!slot) return;
        const half = Math.ceil(slot.count / 2);
        commitCursor(withCount(slot, half));
        arr[i] = slot.count - half > 0 ? withCount(slot, slot.count - half) : null;
      } else if (!slot || (slot.id === cur.id && slot.count < maxStack(slot.id))) {
        arr[i] = withCount(slot ?? cur, (slot ? slot.count : 0) + 1);
        commitCursor(cur.count > 1 ? withCount(cur, cur.count - 1) : null);
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
    if (c === 'armor' || c === 'station' || (c === 'furnace' && i === 2)) return;
    if (!spreadingRef.current || !(e.buttons & 2)) return;
    const cur = cursorRef.current;
    if (!cur) return;
    const arr = arrOf(c).slice();
    const slot = arr[i];
    if (slot && (slot.id !== cur.id || slot.count >= maxStack(cur.id))) return;
    arr[i] = withCount(slot ?? cur, (slot ? slot.count : 0) + 1);
    commitCursor(cur.count > 1 ? withCount(cur, cur.count - 1) : null);
    commit(c, arr);
  }

  // Shift-click: chest <-> inventory, grid -> inventory, hotbar <-> main inventory
  function quickMove(c: Container, i: number) {
    const src = arrOf(c).slice();
    const st = src[i];
    if (!st) return;
    // Shift-clicking armor puts it on (and shift-clicking worn armor takes it off)
    // Station open: shift-click moves things in and out of it
    if (station && (c === 'inv' || c === 'station')) {
      if (c === 'station') {
        const next = invRef.current.slice();
        const left = addStackToSlots(next, st);
        src[i] = left > 0 ? withCount(st, left) : null;
        commit('inv', next);
        commit('station', src);
        return;
      }
      const sta = stationRef.current.slice();
      const target = [0, 1].find((k) => stationAccepts(k, st) && (!sta[k] || (sta[k]!.id === st.id && sta[k]!.count < maxStack(st.id) && !(station.kind === 'enchanting' && k === 0))));
      if (target === undefined) return;
      const one = station.kind === 'enchanting' && target === 0;
      const have = sta[target];
      const move = one ? 1 : Math.min(maxStack(st.id) - (have?.count ?? 0), st.count);
      sta[target] = withCount(have ?? st, (have?.count ?? 0) + move);
      src[i] = st.count - move > 0 ? withCount(st, st.count - move) : null;
      commit('inv', src);
      commit('station', sta);
      return;
    }
    const piece = ARMOR[st.id];
    if (c === 'inv' && piece && !armRef.current[piece.slot] && !chestKey && !furnaceKey) {
      src[i] = null;
      const nextArm = armRef.current.slice();
      nextArm[piece.slot] = withCount(st, 1);
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
      f[target] = withCount(have ?? st, (have?.count ?? 0) + move);
      src[i] = st.count - move > 0 ? withCount(st, st.count - move) : null;
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
    const left = addStackToSlots(part, st);
    for (let k = 0; k < part.length; k++) dst[range[0] + k] = part[k];
    if (left > 0) src[i] = withCount(st, left);
    commit(c, src);
    if (dstC !== c) commit(dstC, dst);
  }

  const gridIds = (g: Slots) => g.map((st) => (st ? st.id : null));
  const consumeGrid = () => commitGrid(gridRef.current.map((st) => (st && st.count > 1 ? { id: st.id, count: st.count - 1 } : null)));
  const result = craftMode === 'grid' && !chestKey && !furnaceKey && !station ? matchRecipe(gridIds(grid), gridSize, atCraftingTable) : null;

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

  /** Creative: an enchanted book of one enchantment at one level. */
  function onCreativeBook(e: ReactMouseEvent, key: string, level: number) {
    e.preventDefault();
    const book: ItemStack = { id: ITEM_ENCHANTED_BOOK, count: 1, ench: { [key]: level } };
    if (e.shiftKey) {
      const next = invRef.current.slice();
      addStackToSlots(next, book);
      commitInv(next);
      return;
    }
    commitCursor(cursorRef.current ? null : book);
  }

  // Clicking outside the panels throws the held stack into the world
  function onBackdrop(e: ReactMouseEvent) {
    if (e.target !== e.currentTarget) return;
    const h = cursorRef.current;
    if (!h) return;
    if (e.button === 2) {
      onDropItems([withCount(h, 1)]);
      commitCursor(h.count > 1 ? withCount(h, h.count - 1) : null);
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
      for (const st of gridRef.current) if (st) addStackToSlots(next, st);
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
        st={st}
        slotKey={`${c}:${from + k}`}
        onMouseDown={(e) => onSlotDown(e, c, from + k)}
        onMouseEnter={(e) => onSlotEnter(e, c, from + k)}
      />
    ));

  const previewRecipe = recipePreview !== null ? RECIPES.find((r) => r.output.id === recipePreview) ?? null : null;
  const title = station?.kind === 'enchanting' ? 'Enchanting Table' : station?.kind === 'anvil' ? 'Anvil' : furnaceKey ? 'Furnace' : chestKey ? 'Chest' : atCraftingTable ? 'Crafting Table' : 'Inventory';

  // ---- Enchanting table ----
  const lapisHere = stationSlots[1]?.id === ITEM_LAPIS ? stationSlots[1].count : 0;
  const offers = station?.kind === 'enchanting' ? enchantOffers(stationSlots[0], station.shelves, enchSeed) : [];
  function takeOffer(i: number) {
    const o = offers[i], item = stationRef.current[0];
    if (!o || !item || !stationApi) return;
    if (!isCreative && (stationApi.xpLevel < o.level || lapisHere < o.lapis)) return;
    if (!stationApi.spend(o.lapis)) return; // it costs 1-3 levels, but you need the full level to pick it
    const lapis = stationRef.current[1];
    commitStation([applyEnchants(item, o.ench), isCreative || !lapis ? lapis : lapis.count - o.lapis > 0 ? withCount(lapis, lapis.count - o.lapis) : null]);
    stationApi.reroll();
    setEnchSeed(stationApi.seed());
    stationApi.sound('enchant');
    stationApi.onEnchanted();
  }
  // ---- Anvil ----
  const anvilLeft = stationSlots[0];
  const typedName = anvilName !== undefined && anvilLeft && !anvilLeft.name && anvilName.trim() === (ITEM_INFO[anvilLeft.id]?.name ?? '') ? undefined : anvilName;
  const anvil = station?.kind === 'anvil' ? anvilResult(anvilLeft, stationSlots[1], typedName) : null;
  const anvilAffordable = !!anvil?.ok && (isCreative || (stationApi?.xpLevel ?? 0) >= anvil.cost);
  function takeAnvil(e: ReactMouseEvent) {
    e.preventDefault();
    if (!anvil || !anvil.ok || !anvilAffordable || cursorRef.current || !stationApi) return;
    if (!stationApi.spend(anvil.cost)) return;
    const right = stationRef.current[1];
    commitStation([null, right && anvil.useRight ? (right.count - anvil.useRight > 0 ? withCount(right, right.count - anvil.useRight) : null) : right]);
    commitCursor(anvil.out);
    setAnvilName(undefined);
    stationApi.sound('anvil');
  }

  return (
    <div
      className="absolute inset-0 z-30 bg-black/70 backdrop-blur-sm flex items-center justify-center gap-4 vb-fade-in"
      onMouseMove={(e) => setMouse({ x: e.clientX, y: e.clientY })}
      onMouseOver={(e) => {
        const el = (e.target as HTMLElement).closest('[data-item-id]');
        setHoverId(el ? Number(el.getAttribute('data-item-id')) : null);
        const sk = el?.getAttribute('data-slot');
        if (sk === 'anvil:out') setHoverStack(anvil?.ok ? anvil.out : null);
        else if (sk?.startsWith('book:')) { const [, k, lv] = sk.split(':'); setHoverStack({ id: ITEM_ENCHANTED_BOOK, count: 1, ench: { [k]: Number(lv) } }); }
        else if (sk) { const [c, i] = sk.split(':'); setHoverStack(arrOf(c as Container)[Number(i)] ?? null); }
        else setHoverStack(null);
      }}
      onMouseDown={onBackdrop}
      onContextMenu={(e) => e.preventDefault()}
    >
      <div className="w-[640px] max-w-[64vw] bg-[#0d131b] border border-[#243044] rounded-2xl p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-[var(--font-retro)] text-white text-sm tracking-wider uppercase">{title}</h3>
          <div className="flex items-center gap-3">
            {!chestKey && !furnaceKey && !station && (
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

        <div className={!chestKey && !furnaceKey && !atCraftingTable && !station ? 'flex gap-4 items-start mb-5' : ''}>
        {!chestKey && !furnaceKey && !atCraftingTable && !station && (
          <>
            <div className="flex flex-col gap-1">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="relative" title={ARMOR_PIECES[i]}>
                  <ItemSlot id={arm[i] ? arm[i]!.id : null} st={arm[i]} slotKey={`armor:${i}`} onMouseDown={(e) => onSlotDown(e, 'armor', i)} />
                  {!arm[i] && <span className="absolute inset-0 flex items-center justify-center text-[8px] font-bold text-black/35 pointer-events-none">{['HEAD', 'CHEST', 'LEGS', 'FEET'][i]}</span>}
                </div>
              ))}
            </div>
            <PlayerPreview armor={arm} mouse={mouse} />
            <div className="flex flex-col items-center self-end" title="Off-hand (F swaps)">
              <ItemSlot id={off ? off.id : null} count={off?.count} st={off} slotKey="offhand:0" onMouseDown={(e) => onSlotDown(e, 'offhand', 0)} onMouseEnter={(e) => onSlotEnter(e, 'offhand', 0)} />
              <span className="text-[#5a6b80] text-[9px] mt-0.5">Off-hand</span>
            </div>
          </>
        )}
        <div className="flex-1 min-w-0">
        {station?.kind === 'enchanting' ? (
          <div className="flex items-start gap-5 mb-5" data-testid="enchanting">
            <div className="flex flex-col items-center gap-1.5">
              <div className="flex gap-1.5">{slotRow('station', stationSlots, 0, 1)}{slotRow('station', stationSlots, 1, 2)}</div>
              <span className="text-[10px] text-[#8ea0b8]">Item · Lapis</span>
              <span className="text-[10px] text-[#5a6b80] mt-1" title="Bookshelves two blocks away, with air between, give better enchantments">{station.shelves} bookshelves</span>
            </div>
            <div className="flex-1 flex flex-col gap-1.5">
              {[0, 1, 2].map((i) => {
                const o = offers[i];
                const can = !!o && (isCreative || ((stationApi?.xpLevel ?? 0) >= o.level && lapisHere >= o.lapis));
                return (
                  <button key={i} disabled={!can} onClick={() => takeOffer(i)} data-testid={`enchant-offer-${i}`}
                    className={`flex items-center justify-between gap-3 px-3 py-2 rounded-lg border text-left transition-all ${!o ? 'bg-[#0a0e14] border-[#1a2230] text-[#364860]' : can ? 'bg-[#2a1a3a] border-[#8a4ac8]/60 text-white hover:bg-[#3a2450] hover:border-[#b070ff]' : 'bg-[#1a1422] border-[#3a2a4a] text-[#7a6a8a]'}`}>
                    <span className="text-xs">{o ? `${o.hint} . . . ?` : '—'}</span>
                    {o && (
                      <span className="flex items-center gap-2 shrink-0">
                        <span className="flex items-center gap-0.5 text-[11px]"><ItemIcon id={ITEM_LAPIS} className="w-4 h-4" />{o.lapis}</span>
                        <span className={`text-[12px] font-bold ${(stationApi?.xpLevel ?? 0) >= o.level || isCreative ? 'text-[#80ff20]' : 'text-[#ff5555]'}`}>{o.level}</span>
                      </span>
                    )}
                  </button>
                );
              })}
              <p className="text-[10px] text-[#5a6b80]">Needs the green level shown; costs 1, 2 or 3 levels and lapis. Up to 15 bookshelves around the table unlock the best ones.</p>
            </div>
          </div>
        ) : station?.kind === 'anvil' ? (
          <div className="flex flex-col gap-2 mb-5" data-testid="anvil">
            <input
              value={anvilName ?? (anvilLeft ? itemDisplayName(anvilLeft) : '')}
              onChange={(e) => setAnvilName(e.target.value)}
              disabled={!anvilLeft || maxStack(anvilLeft.id) > 1}
              maxLength={30}
              placeholder="Put an item in to rename it"
              data-testid="anvil-name"
              onKeyDown={(e) => e.stopPropagation()}
              className="w-full max-w-[360px] bg-[#0a0e14] border border-[#243044] rounded-lg px-3 py-1.5 text-white text-sm placeholder-[#364860] focus:border-[#00e676] focus:outline-none disabled:opacity-50"
            />
            <div className="flex items-center gap-3">
              {slotRow('station', stationSlots, 0, 1)}
              <span className="text-[#5a6b80] text-xl">+</span>
              {slotRow('station', stationSlots, 1, 2)}
              <span className="text-[#5a6b80] text-2xl">→</span>
              <ItemSlot id={anvil?.ok ? anvil.out.id : null} st={anvil?.ok ? anvil.out : null} highlight={anvilAffordable} onMouseDown={takeAnvil} slotKey="anvil:out" />
            </div>
            <p className={`text-xs ${!anvil ? 'text-[#5a6b80]' : !anvil.ok ? 'text-[#ff5555]' : anvilAffordable ? 'text-[#80ff20]' : 'text-[#ff5555]'}`} data-testid="anvil-cost">
              {!anvil ? 'Repair with the same item or its material, add an enchanted book, or type a new name.' : !anvil.ok ? anvil.error : `Enchantment Cost: ${anvil.cost}${isCreative ? ' (free in creative)' : ''}`}
            </p>
          </div>
        ) : furnaceKey ? (
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
          <h4 className="text-white text-xs font-medium mt-4 mb-2">Enchanted Books</h4>
          <div className="grid grid-cols-4 gap-1" data-testid="creative-books">
            {ENCHANTMENTS.flatMap((d) => Array.from({ length: d.max }, (_, i) => i + 1).map((lv) => (
              <ItemSlot key={`${d.key}${lv}`} id={ITEM_ENCHANTED_BOOK} st={{ id: ITEM_ENCHANTED_BOOK, count: 1, ench: { [d.key]: lv } }} slotKey={`book:${d.key}:${lv}`} size="sm" onMouseDown={(e) => onCreativeBook(e, d.key, lv)} />
            )))}
          </div>
          <p className="text-[#5a6b80] text-[10px] mt-2">One book per click. Combine them in an anvil.</p>
        </div>
      )}

      {hoverId !== null && !cursor && ITEM_INFO[hoverId] && (
        <ItemTooltip st={hoverStack && hoverStack.id === hoverId ? hoverStack : { id: hoverId, count: 1 }} x={mouse.x} y={mouse.y} />
      )}
      {cursor && (
        <div className="fixed z-50 pointer-events-none" style={{ left: mouse.x - 18, top: mouse.y - 18 }}>
          <ItemIcon id={cursor.id} className="w-9 h-9" />
          <ItemExtras st={cursor} />
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
  { names: ['time'], usage: '/time set <sunrise|day|noon|sunset|night|midnight|0-24000>', desc: 'Change the time of day. Monsters only spawn at night. On a server, only the host can.' },
  { names: ['weather'], usage: '/weather <clear|rain|snow> [seconds]', desc: 'Change the weather. Rain turns to snow in cold biomes. On a server, only the host can.' },
  { names: ['list'], usage: '/list', desc: 'Show who is online (multiplayer). You can also hold Tab.' },
  { names: ['seed'], usage: '/seed', desc: 'Show this world\'s seed.' },
  { names: ['say'], usage: '/say <message>', desc: 'Say something in chat (command blocks show as [@]).' },
  { names: ['setblock'], usage: '/setblock <x> <y> <z> <block>', desc: 'Place one block. ~ means where you are (or the command block).' },
  { names: ['xp', 'experience'], usage: '/xp <amount> [levels] · /xp set <level>', desc: 'Give yourself experience (points or levels) for enchanting and the anvil.' },
  { names: ['summon'], usage: '/summon [baby] <mob>', desc: 'Spawn a mob in front of you (or /summon <mob> x y z): pig, cow, chicken, sheep, zombie, skeleton, creeper, spider, ghast, blaze, piglin, villager or iron golem. Add "baby" for a baby one, e.g. /summon baby cow.' },
  { names: ['enchant'], usage: '/enchant <enchantment> [level]', desc: 'Enchant the item in your hand, e.g. /enchant sharpness 5. Also works on books. /give enchanted_book mending gives a book.' },
  { names: ['whisper', 'w', 'msg', 'tell'], usage: '/w <player> <message>', desc: 'Send a private message to a player on your server, or to a friend (even offline). /r <message> answers the last whisper.' },
  { names: ['friend'], usage: '/friend <username>', desc: 'Send a friend request (or accept theirs). Manage friends and messages in the Social tab.' },
  { names: ['unfriend'], usage: '/unfriend <username>', desc: 'Remove a friend.' },
  { names: ['friends'], usage: '/friends', desc: 'List your friends and who is online.' },
  { names: ['wand'], usage: '/wand', desc: 'Get the selection wand: left-click a block for position 1, right-click for position 2.' },
  { names: ['pos1', 'pos2'], usage: '/pos1 · /pos2', desc: 'Set a selection corner where you stand.' },
  { names: ['chunk'], usage: '/chunk', desc: 'Select the whole chunk you are standing in (16 x 16, full height).' },
  { names: ['fill'], usage: '/fill <block>  or  /fill x1 y1 z1 x2 y2 z2 <block>', desc: 'Fill the selection (or a box) with a block, up to 32,768 blocks. /fill air clears it.' },
  { names: ['desel'], usage: '/desel', desc: 'Clear the selection.' },
  { names: ['difficulty'], usage: '/difficulty peaceful|easy|normal|hard', desc: 'Change the difficulty (not in Hardcore).' },
  { names: ['gamerule'], usage: '/gamerule keepInventory true|false', desc: 'Keep your items when you die.' },
  { names: ['locate'], usage: '/locate village | temple | fortress', desc: 'Find the closest village, desert temple, or (in the Nether) fortress.' },
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
  const id = itemIdFromNameAny(name);
  // experimental items only exist in planets made with experimental features
  return id !== null && EXPERIMENTAL_IDS.includes(id) && !experimentalEnabled() ? null : id;
}
function itemIdFromNameAny(name: string): number | null {
  if (name.includes(':')) return customIdForKey(name.toLowerCase().trim());
  if (/^\d+$/.test(name)) {
    const id = Number(name);
    return ITEM_INFO[id] ? id : null;
  }
  const n = normalizeItemName(name);
  let hiddenMatch: number | null = null; // block states (a lit torch on a wall...) share names: prefer the real item
  for (const [id, info] of Object.entries(ITEM_INFO)) {
    if (normalizeItemName(info.name) !== n) continue;
    if (!info.hidden) return Number(id);
    hiddenMatch ??= Number(id);
  }
  if (n === 'redstone') return itemIdFromNameAny('redstone dust');
  return hiddenMatch;
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

/** Lying in bed: the screen fades to dark over the 3 seconds it takes, with a way out and a way to chat. */
function SleepOverlay({ online, onLeave, onChat }: { online: boolean; onLeave: () => void; onChat: () => void }) {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setDark(true)); // so the fade really starts from clear
    return () => cancelAnimationFrame(id);
  }, []);
  return (
    <div className="absolute inset-0 z-20 pointer-events-none" data-testid="sleep-overlay">
      <div className="absolute inset-0 bg-black ease-in" style={{ opacity: dark ? 0.85 : 0, transition: 'opacity 3000ms ease-in' }} />
      <div className="absolute inset-x-0 top-[24%] text-center select-none">
        <div className="text-white/90 text-3xl font-[var(--font-display)]">Sleeping…</div>
        <div className="text-white/50 text-sm mt-2">{online ? 'The night passes when half of the players are in bed.' : 'Morning is coming.'}</div>
      </div>
      <div className="absolute inset-x-0 bottom-28 flex justify-center gap-3 pointer-events-auto">
        <button onClick={onLeave} data-testid="leave-bed" className="px-8 py-3 rounded-xl bg-white/90 text-black font-bold text-sm hover:bg-white active:scale-95 transition-all">Leave Bed</button>
        <button onClick={onChat} data-testid="sleep-chat" className="px-8 py-3 rounded-xl bg-black/60 border border-white/30 text-white font-bold text-sm hover:bg-black/80 active:scale-95 transition-all">Chat</button>
      </div>
    </div>
  );
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

// ---------------- Advancements ----------------
type AdvToast = { key: number; adv: Advancement };
function advKindLabel(a: Advancement): { text: string; color: string } {
  if (a.challenge) return { text: 'Challenge Complete!', color: '#d97ff7' };
  if (a.goal) return { text: 'Goal Reached!', color: '#ffe066' };
  return { text: 'Advancement Made!', color: '#ffe066' };
}
/** The Minecraft-style pop-ups in the top right corner. */
function AdvancementToasts({ toasts }: { toasts: AdvToast[] }) {
  return (
    <div className="absolute top-3 right-3 z-30 flex flex-col gap-2 pointer-events-none" data-testid="advancement-toasts">
      {toasts.map(({ key, adv }) => {
        const k = advKindLabel(adv);
        return (
          <div key={key} className="vb-adv-toast w-[300px] flex items-center gap-3 px-3 py-2.5 rounded-md bg-[#1d1d1d]/95 border-2 border-[#5a5a5a] shadow-[0_4px_0_rgba(0,0,0,0.5)]">
            <div className="w-10 h-10 shrink-0 flex items-center justify-center rounded bg-black/40 border border-[#3a3a3a]"><ItemIcon id={adv.icon} className="w-8 h-8" /></div>
            <div className="min-w-0">
              <div className="text-[12px] font-bold leading-tight" style={{ color: k.color }}>{k.text}</div>
              <div className="text-white text-[13px] leading-tight mt-1 truncate">{adv.title}</div>
            </div>
          </div>
        );
      })}
      <style>{`.vb-adv-toast{animation:vbAdvIn .35s cubic-bezier(.2,.9,.3,1.2) both, vbAdvOut .4s ease-in 4.6s both}
@keyframes vbAdvIn{from{transform:translateX(120%);opacity:0}to{transform:none;opacity:1}}
@keyframes vbAdvOut{to{transform:translateX(120%);opacity:0}}`}</style>
    </div>
  );
}
/** The full list (L key, or Advancements in the Game Menu). */
function AdvancementsPanel({ have, experimental }: { have: ReadonlySet<string>; experimental: boolean }) {
  const [tab, setTab] = useState<AdvancementTab>('story');
  const all = advancementsFor(experimental);
  const list = all.filter((a) => a.tab === tab);
  const done = all.filter((a) => have.has(a.id)).length;
  return (
    <div className="p-5 overflow-y-auto" data-testid="advancements-panel">
      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <div className="flex gap-1.5">
          {ADVANCEMENT_TABS.map((t) => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${tab === t.id ? 'bg-[#00e676] text-[#0a0e14]' : 'bg-[#121822] border border-[#243044] text-[#8ea0b8] hover:text-white'}`}>{t.label}</button>
          ))}
        </div>
        <span className="text-[#8ea0b8] text-xs">{done} / {all.length} earned in this planet</span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        {list.map((a) => {
          const got = have.has(a.id), k = advKindLabel(a);
          return (
            <div key={a.id} className={`flex items-center gap-3 p-3 rounded-xl border ${got ? 'bg-[#1a2a1f] border-[#2e6b45]' : 'bg-[#0d131b] border-[#1a2230]'}`}>
              <div className={`w-11 h-11 shrink-0 flex items-center justify-center rounded-lg ${got ? 'bg-[#ffe066]/15 border border-[#ffe066]/50' : 'bg-black/30 border border-[#243044]'}`}>
                <ItemIcon id={a.icon} className={`w-8 h-8 ${got ? '' : 'opacity-30 grayscale'}`} />
              </div>
              <div className="min-w-0">
                <div className={`text-sm font-medium ${got ? 'text-white' : 'text-[#8ea0b8]'}`}>{a.title}{(a.goal || a.challenge) && <span className="ml-1.5 text-[9px] font-bold uppercase" style={{ color: k.color }}>{a.challenge ? 'Challenge' : 'Goal'}</span>}</div>
                <div className="text-[11px] text-[#5a6b80] mt-0.5">{a.description}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

type MenuPage = 'main' | 'settings' | 'scripts' | 'mods' | 'shop' | 'server' | 'advancements';

function GameMenu({ page, onResume, onOpenSettings, onOpenScripts, onOpenMods, onOpenShop, onOpenServer, onOpenAdvancements, showScripts = true, showMods = true, onBack, onExit, children }: {
  page: MenuPage;
  onOpenAdvancements: () => void;
  onOpenServer: () => void;
  showScripts?: boolean;
  showMods?: boolean;
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
          <MenuButton color="gray" icon={Users} label="Manage Server" onClick={onOpenServer} />
          {(showScripts || showMods) && (
            <div className={`grid gap-2.5 ${showScripts && showMods ? 'grid-cols-2' : 'grid-cols-1'}`}>
              {showScripts && <MenuButton color="blue" icon={ScrollText} label="Scripts" onClick={onOpenScripts} />}
              {showMods && <MenuButton color="teal" icon={Package} label="Mods" onClick={onOpenMods} />}
            </div>
          )}
          <div className="grid grid-cols-2 gap-2.5">
            <MenuButton color="gray" icon={Trophy} label="Advancements" onClick={onOpenAdvancements} />
            <MenuButton color="green" icon={ShoppingBag} label="Shop" onClick={onOpenShop} />
          </div>
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
function DeathScreen({ reason, onRespawn, onExit, hardcore = false }: { reason: string; onRespawn: () => void; onExit: () => void; hardcore?: boolean }) {
  // The buttons unlock after a moment so a panicked click doesn't respawn you instantly
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setReady(true), 1000);
    return () => clearTimeout(t);
  }, []);
  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center vb-fade-in" style={{ background: 'rgba(110, 0, 0, 0.5)' }} onContextMenu={(e) => e.preventDefault()}>
      <div className="w-[400px] max-w-[90vw] flex flex-col items-center gap-2.5">
        <h2 className="font-[var(--font-retro)] text-white text-3xl mb-3 drop-shadow-[0_3px_0_rgba(0,0,0,0.6)]">{hardcore ? 'Game Over!' : 'You Died!'}</h2>
        {hardcore && <p className="text-[#ffd0d0] text-xs mb-1 text-center">Hardcore worlds only give you one life. You can still look around as a spectator.</p>}
        <p className="text-white text-sm mb-5 text-center">
          You have died by: <span className="font-semibold text-[#ffd0d0]">{reason}</span>
        </p>
        <MenuButton color="green" icon={Heart} label={hardcore ? 'Spectate World' : 'Respawn'} onClick={onRespawn} disabled={!ready} />
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
  const viewRef = useRef<View>('home');
  viewRef.current = view;
  // ---- accounts, friends, private messages, admin ----
  const { account, admin, checked: accountChecked, signOut: doSignOut } = useAccount();
  const accountRef = useRef(account);
  accountRef.current = account;
  const adminRef = useRef(admin);
  adminRef.current = admin;
  const [authWaitOver, setAuthWaitOver] = useState(false);
  const [unread, setUnread] = useState<Record<string, number>>({});
  const [pendingRequests, setPendingRequests] = useState(0);
  const pendingRequestsRef = useRef(0);
  const openChatFriendRef = useRef<string | null>(null);
  const [toasts, setToasts] = useState<Array<{ key: number; text: string; kind: 'dm' | 'announce' | 'info' }>>([]);
  const [panelOpen, setPanelOpen] = useState(false);
  const panelOpenRef = useRef(false);
  const [adminPlayers, setAdminPlayers] = useState<PanelPlayer[]>([]);
  const [sleeping, setSleeping] = useState(false);
  const sleepingRef = useRef(false);
  const lastWhisperFromRef = useRef<string | null>(null);
  const pendingWhisperRef = useRef<{ to: string; text: string } | null>(null);
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
  const [activeExperimental, setActiveExperimental] = useState(false);
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
  const [serverSettings, setServerSettings] = useState<ServerSettings>(DEFAULT_SERVER);
  const serverSettingsRef = useRef<ServerSettings>(DEFAULT_SERVER);
  const [hostId, setHostId] = useState<number | null>(null);
  const [xpState, setXpState] = useState({ level: 0, progress: 0 });
  const [cmdBlock, setCmdBlock] = useState<CommandBlockInfo | null>(null);
  const cmdBlockRef = useRef(false);
  const [openStation, setOpenStation] = useState<Station | null>(null);
  const [weather, setWeather] = useState<WeatherKind>('clear');
  const [myNetId, setMyNetId] = useState<number | null>(null);
  const [hardcore, setHardcore] = useState(false);
  const hardcoreRef = useRef(false);
  const [trading, setTrading] = useState<{ id: number; profession: string; trades: Trade[] } | null>(null);
  const tradingRef = useRef(false);
  const [tradeNote, setTradeNote] = useState<string | null>(null);
  const menuOpenedAtRef = useRef(0);
  const menuClosedAtRef = useRef(0);
  const hadLockRef = useRef(false);
  const [menuPage, setMenuPage] = useState<MenuPage>('main');
  const advRef = useRef<Set<string>>(new Set());
  const [advHave, setAdvHave] = useState<Set<string>>(() => new Set());
  const [advToasts, setAdvToasts] = useState<AdvToast[]>([]);
  const advQuietUntilRef = useRef(0); // just after loading a planet: grant what you already have without pop-ups
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
  const [spyglass, setSpyglass] = useState(false);
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
  // Redstone runs on one machine only: yours offline, the host's online (everyone sees the blocks change)
  const rsAuthorityRef = useRef(true);
  useEffect(() => {
    rsAuthorityRef.current = netStatus !== 'online' || hostId === null || hostId === myNetId;
    gameHandleRef.current?.setRedstoneAuthority(rsAuthorityRef.current);
  }, [netStatus, hostId, myNetId, gameMode]);

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
    if (saved) setUsername(saved);
    setReady(true);
    const t = window.setTimeout(() => setAuthWaitOver(true), 3500); // don't keep a first-time visitor waiting for the sign-in service
    return () => window.clearTimeout(t);
  }, []);

  // Signed in: play under the account's name. Nobody signed in and no saved name: ask who is playing.
  useEffect(() => {
    if (!ready) return;
    if (account) {
      setUsername(account.username);
      setShowModal(false);
      try { localStorage.setItem(STORAGE_KEY, account.username); } catch { /* storage blocked */ }
    } else if ((accountChecked || authWaitOver) && !username) {
      setShowModal(true);
    }
  }, [ready, account, accountChecked, authWaitOver, username]);

  function showToast(text: string, kind: 'dm' | 'announce' | 'info' = 'info') {
    const key = Date.now() + Math.random();
    setToasts((t) => [...t.slice(-3), { key, text, kind }]);
    window.setTimeout(() => setToasts((t) => t.filter((x) => x.key !== key)), kind === 'announce' ? 9000 : 5000);
  }
  function showAnnouncement(text: string) {
    pushMessage(`[Announcement] ${text}`, '#ffd700');
    showToast(text, 'announce');
  }

  async function handleIncomingMessages(msgs: DM[]) {
    const a = accountRef.current;
    if (!a) return;
    const names: Record<string, string> = {};
    const fr = await loadFriends(a.userId);
    if (fr.ok) for (const f of fr.friends) names[f.id] = f.username;
    const bump: Record<string, number> = {};
    for (const m of msgs) {
      const name = names[m.from] ?? 'A friend';
      pushMessage(`[${name} → you] ${m.text}`, '#8ab4ff');
      if (!(viewRef.current === 'social' && openChatFriendRef.current === m.from)) bump[m.from] = (bump[m.from] ?? 0) + 1;
    }
    if (Object.keys(bump).length) setUnread((u) => { const n = { ...u }; for (const [k, v] of Object.entries(bump)) n[k] = (n[k] ?? 0) + v; return n; });
    const last = msgs[msgs.length - 1];
    if (!(viewRef.current === 'social' && openChatFriendRef.current === last.from)) showToast(`${names[last.from] ?? 'A friend'}: ${last.text}`, 'dm');
  }

  // New messages, friend requests and announcements arrive while you play
  useEffect(() => {
    const poller = startPolling(account, {
      onMessages: (msgs) => { void handleIncomingMessages(msgs); },
      onAnnouncements: (items) => { for (const it of items) showAnnouncement(it.text); },
      onRequests: (n, from) => {
        if (n > pendingRequestsRef.current) showToast(`${from[0]?.username ?? 'Someone'} sent you a friend request`, 'dm');
        pendingRequestsRef.current = n;
        setPendingRequests(n);
      },
    });
    return () => poller.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [account?.userId]);

  async function handleSignOut() {
    await doSignOut();
    try { localStorage.removeItem(STORAGE_KEY); } catch { /* storage blocked */ }
    setUnread({});
    setPendingRequests(0);
    pendingRequestsRef.current = 0;
    setUsername(null);
  }

  function handleGuest(name: string) {
    try { localStorage.setItem(STORAGE_KEY, name); } catch { /* storage blocked */ }
    setUsername(name);
    setShowModal(false);
  }

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
        if (panelOpenRef.current) { closePanel(); return; }
        if (sleepingRef.current) { gameHandleRef.current?.leaveBed(); return; } // Esc gets you out of bed instead of pausing
        if (tradingRef.current) { closeTrade(); return; }
        if (cmdBlockRef.current) { closeCommandBlock(); return; }
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

  // No browser right-click menu (Back, Forward, Inspect...) anywhere in a world. Right-clicking a
  // villager opens trading and frees the mouse, so the click's own menu event lands on the trade
  // window rather than the game canvas. Text boxes keep their normal menu (copy/paste).
  useEffect(() => {
    if (gameMode !== 'playing') return;
    const blockMenu = (e: MouseEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.closest('input, textarea, [contenteditable="true"]'))) return;
      e.preventDefault();
    };
    window.addEventListener('contextmenu', blockMenu, true);
    return () => window.removeEventListener('contextmenu', blockMenu, true);
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
      lastStatTickRef.current = Date.now();
      const applyRules = (h: { setRules: (r: { difficulty: Difficulty; keepInventory: boolean; hardcore: boolean }) => void }) => h.setRules({ difficulty: serverSettingsRef.current.difficulty, keepInventory: serverSettingsRef.current.keepInventory, hardcore: hardcoreRef.current });
      const handle = createVoxelGame(canvasRef.current, renderDistance, activeWorldMode, graphicsQuality, fov, activeWorldType, sfxVolume, activeSeed, activeExperimental);
      gameHandleRef.current = handle;
      handle.setPlayerLook(currentLook());
      // Advancements belong to this planet; whatever you already hold on load is granted quietly
      advRef.current = loadAdvancements(activeWorldIdRef.current);
      setAdvHave(new Set(advRef.current));
      setAdvToasts([]);
      advQuietUntilRef.current = performance.now() + 3000;
      handle.onInventoryChange((inv, off, arm) => {
        setInventory(inv); setOffhand(off); setArmor(arm);
        earnAdvancements(checkItems([...inv, off, ...arm], advRef.current, experimentalEnabled()));
      });
      handle.onStatsChange((h, hu) => {
        setHealth(h);
        setHunger(hu);
      });
      applyRules(handle);
      setWeather(handle.getWeather());
      handle.onWeatherChange((k) => setWeather(k));
      handle.onTrade((t) => {
        if (!t) return;
        tradingRef.current = true;
        setTradeNote(null);
        setTrading(t);
        if (document.pointerLockElement) document.exitPointerLock();
      });
      sleepingRef.current = false;
      setSleeping(false);
      panelOpenRef.current = false;
      setPanelOpen(false);
      handle.setSleepOnline(!!mpRef.current?.connected); // online, the server skips the night once half the players sleep
      handle.onSleep((st) => {
        sleepingRef.current = st.sleeping;
        setSleeping(st.sleeping);
        if (mpRef.current?.connected) mpRef.current.sendSleep(st.sleeping);
      });
      handle.onInventoryToggle((open, atTable, chestKey, furnaceKey, station) => {
        setOpenStation(station ?? null);
        setOpenChest(chestKey);
        setOpenFurnace(furnaceKey ?? null);
        inventoryOpenRef.current = open; // set now: the pointer-unlock event can arrive before React re-renders
        setInventoryOpen(open);
        setAtCraftingTable(atTable);
      });
      setInventory(handle.getInventory());
      setXpState(handle.getXp());
      handle.setRedstoneAuthority(rsAuthorityRef.current);
      handle.onCommandBlockOpen((info) => {
        cmdBlockRef.current = true;
        setCmdBlock(info);
        handle.setChatOpen(true); // typing a command must not walk you around
        if (document.pointerLockElement) document.exitPointerLock();
      });
      handle.setCommandRunner((cmd, at) => runCommandRef.current(cmd, at));
      handle.onXpChange((level, progress) => setXpState({ level, progress }));
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
        handle.setWeatherAuto(false); // the server decides the weather
        handle.setWeather(welcome.weather ?? 'clear');
        setWeather(welcome.weather ?? 'clear');
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
            applyRules(handle); // the planet's own settings win over anything old in the save
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
        earnAdvancements(checkEvent(name, data, advRef.current, experimentalEnabled()));
        if (name === 'zoomChange') { setScoped(Number(data.zoom) < 0.5); setSpyglass(!!data.spyglass); return; }
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
  }, [gameMode, activeWorldMode, activeWorldType, activeSeed, activeExperimental]);

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
      if (chatOpenRef.current || helpOpenRef.current || inventoryOpenRef.current || menuOpenRef.current || tradingRef.current || cmdBlockRef.current || deadRef.current || disconnectedRef.current || panelOpenRef.current) return;
      if (e.code === 'F3') {
        e.preventDefault(); // F3 is "find" in some browsers
        setShowDebug((v) => !v);
        return;
      }
      if (e.code === 'KeyL') { openGameMenu('advancements'); return; }
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
      if (chatOpenRef.current || helpOpenRef.current || inventoryOpenRef.current || menuOpenRef.current || tradingRef.current || cmdBlockRef.current || deadRef.current || disconnectedRef.current || sleepingRef.current || panelOpenRef.current) return;
      if (!hadLockRef.current) return; // the mouse was never captured yet (e.g. still joining): nothing to pause
      if (performance.now() - menuClosedAtRef.current < 400) return; // a re-lock that the browser refused right after closing the menu
      openGameMenu();
    };
    document.addEventListener('pointerlockchange', onLockChange);
    return () => document.removeEventListener('pointerlockchange', onLockChange);
  }, [gameMode]);

  /** Puts server settings into effect (difficulty, keep inventory, and what's allowed). */
  function applyServerSettings(st: ServerSettings) {
    if (hardcoreRef.current) st = { ...st, difficulty: 'hard' };
    serverSettingsRef.current = st;
    setServerSettings(st);
    gameHandleRef.current?.setRules({ difficulty: st.difficulty, keepInventory: st.keepInventory });
    const runner = getRunner();
    if (!st.scripts) for (const sc of scripts) runner.stop(sc.id);
    if (!st.mods) for (const id of modsState.enabled) runner.stop(`mod:${id}`);
    if (!st.scripts || !st.mods) setRunningScripts(runner.runningIds().filter((id) => !id.startsWith("mod:")));
    // remember a planet's settings with the planet
    const wid = activeWorldIdRef.current;
    if (wid && !mpRef.current) setSavedWorlds((prev) => prev.map((w) => (w.id === wid ? { ...w, difficulty: st.difficulty, keepInventory: st.keepInventory } : w)));
  }
  /** Manage Server changes: the host sends them to the server; alone, they apply right away. */
  function changeServerSettings(part: Partial<ServerSettings>) {
    const mp = mpRef.current;
    if (mp && mp.connected) { if (hostId === myNetId) mp.sendSettings(part); return; }
    applyServerSettings({ ...serverSettingsRef.current, ...part });
  }

  /** Time and weather (Manage Server, /time, /weather): on a server only the host can, and the server tells everyone. */
  function changeTime(t: number): boolean {
    const mp = mpRef.current;
    if (mp && mp.connected) {
      if (hostId !== myNetId) return false;
      mp.sendTime(t);
      return true;
    }
    gameHandleRef.current?.setTime(t);
    return true;
  }
  function changeWeather(kind: WeatherKind, seconds?: number): boolean {
    const mp = mpRef.current;
    if (mp && mp.connected) {
      if (hostId !== myNetId) return false;
      mp.sendWeather(kind);
      return true;
    }
    gameHandleRef.current?.setWeather(kind, seconds);
    setWeather(kind);
    return true;
  }

  function closeCommandBlock(cfg?: { type: CommandType; cmd: string; auto: boolean; conditional: boolean }) {
    setCmdBlock((cur) => { if (cur && cfg) gameHandleRef.current?.setCommandBlock(cur.key, cfg); return null; });
    if (!cmdBlockRef.current) return;
    cmdBlockRef.current = false;
    gameHandleRef.current?.setChatOpen(false);
    gameHandleRef.current?.relock();
  }

  function closeTrade() {
    const t = tradingRef.current;
    tradingRef.current = false;
    setTrading((cur) => { if (cur) gameHandleRef.current?.endTrade(cur.id); return null; });
    if (t) gameHandleRef.current?.relock();
  }

  /** Records newly earned advancements, saves them, and shows the pop-ups. */
  function earnAdvancements(list: Advancement[]) {
    const fresh = list.filter((a) => !advRef.current.has(a.id));
    if (!fresh.length) return;
    for (const a of fresh) advRef.current.add(a.id);
    saveAdvancements(activeWorldIdRef.current, advRef.current);
    setAdvHave(new Set(advRef.current));
    if (performance.now() < advQuietUntilRef.current) return; // catching up on an old save: no pop-ups
    for (const a of fresh) {
      const key = Date.now() + Math.random();
      setAdvToasts((t) => [...t.slice(-2), { key, adv: a }]);
      window.setTimeout(() => setAdvToasts((t) => t.filter((x) => x.key !== key)), 5000);
      pushMessage(`${username ? `${username} has` : 'You have'} made the advancement [${a.title}]`, a.challenge ? '#d97ff7' : '#7cfc7c');
    }
  }

  function openGameMenu(page: MenuPage = 'main') {
    if (menuOpenRef.current) return; // already open: never stack a second one
    menuOpenedAtRef.current = performance.now();
    menuOpenRef.current = true;
    setMenuPage(page);
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

  const lastStatTickRef = useRef(0);
  function saveWorldNow() {
    const id = activeWorldIdRef.current;
    const h = gameHandleRef.current;
    if (!id || !h) return;
    const now = Date.now();
    const gap = lastStatTickRef.current ? Math.min(15, (now - lastStatTickRef.current) / 1000) : 0; // never count a long pause
    lastStatTickRef.current = now;
    setSavedWorlds((prev) => prev.map((w) => (w.id === id ? { ...w, lastPlayed: now, playSeconds: (w.playSeconds ?? 0) + (document.visibilityState === 'visible' ? gap : 0) } : w)));
    try {
      localStorage.setItem(`vb-save-${id}`, JSON.stringify(h.getSaveData()));
    } catch {
      setHint("Couldn't save: your browser's storage is full");
    }
  }

  // Whenever a game starts, nothing from the menus may keep keyboard focus: Space (jump) would "click" it
  useEffect(() => {
    if (gameMode === 'playing') (document.activeElement as HTMLElement | null)?.blur?.();
  }, [gameMode]);

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
        setMyNetId(w.id);
        setHostId(w.hostId ?? null);
        hardcoreRef.current = false; setHardcore(false);
        { const st = { ...DEFAULT_SERVER, ...(w.settings ?? {}) }; serverSettingsRef.current = st; setServerSettings(st); }
        setNetStatus('online');
        activeWorldIdRef.current = null; // the server keeps multiplayer worlds
        // Everyone on a server shares its seed, world type and game mode
        const m = w.mode === 'creative' || w.mode === 'adventure' ? w.mode : 'survival';
        setActiveWorldMode(m);
        setActiveWorldType(w.worldType === 'superflat' ? 'superflat' : 'default');
        setActiveSeed(w.seed);
        setActiveExperimental(!!w.experimental);
        setGameMode('playing');
      },
      onHost: (id) => setHostId(id),
      onSettings: (st) => applyServerSettings({ ...DEFAULT_SERVER, ...st }),
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
      onWeather: (k) => { gameHandleRef.current?.setWeather(k); setWeather(k); },
      onWhisper: (from, text) => { lastWhisperFromRef.current = from; pushMessage(`[${from} \u2192 you] ${text}`, '#c8a2ff'); },
      onWhispered: (to, text) => { pendingWhisperRef.current = null; pushMessage(`[you \u2192 ${to}] ${text}`, '#c8a2ff'); },
      onWhisperFail: (to) => {
        const p = pendingWhisperRef.current;
        pendingWhisperRef.current = null;
        if (p && p.to.toLowerCase() === to.toLowerCase()) void whisperToFriend(p.to, p.text); // not on this server: maybe a friend
        else pushMessage(`No player named ${to}`, '#ff6b6b');
      },
      onSetMode: (mode, by) => applyAdminMode(mode, by),
      onAdminPlayers: (list) => setAdminPlayers(list),
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
      case 'world.getWeather': return S.getWeather();
      case 'world.setWeather': {
        const k = String(args[0] ?? '').toLowerCase();
        if (k !== 'clear' && k !== 'rain' && k !== 'snow') throw new Error('setWeather needs "clear", "rain" or "snow"');
        if (!changeWeather(k)) throw new Error('Only the host can change the weather on a server');
        return null;
      }
      case 'world.setTime':
      case 'setTime': {
        const named: Record<string, number> = { sunrise: 0, day: 1000, noon: 6000, sunset: 12000, night: 13000, midnight: 18000 };
        const ticks = typeof args[0] === 'string' ? named[args[0].toLowerCase()] : Number(args[0]);
        if (ticks === undefined || !Number.isFinite(ticks)) throw new Error('setTime needs sunrise, day, noon, sunset, night, midnight or 0-24000');
        if (!changeTime((((ticks % 24000) + 24000) % 24000) / 24000)) throw new Error('Only the host can change the time on a server');
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
      if (relock && !sleepingRef.current) gameHandleRef.current?.relock(); // in bed you need the mouse for the Leave Bed button
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
      const res = runCommand(text);
      if (res === 'help') {
        closeChat(false);
        openHelp();
        return;
      }
      if (res === 'panel') {
        closeChat(false);
        openPanel();
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

  /** Runs a command for a command block: ~ is the block's position, and the result is returned, not shown in chat. */
  const runCommandRef = useRef<(cmd: string, at: { x: number; y: number; z: number }) => { success: boolean; output: string }>(() => ({ success: false, output: '' }));
  runCommandRef.current = (raw, at) => {
    const ctx = { at, out: [] as string[], ok: true };
    runCommand(raw, ctx);
    return { success: ctx.ok, output: ctx.out.join(' ') };
  };

  function findEnchantment(name: string) {
    const k = name.toLowerCase().replace(/[\s-]+/g, '_');
    return ENCHANTMENTS.find((d) => d.key === k || d.name.toLowerCase().replace(/\s+/g, '_') === k);
  }

  /** A private message to a friend, delivered through the account service (works when they are offline). */
  async function whisperToFriend(to: string, text: string) {
    const me = accountRef.current;
    if (!me || isGuestName(me.username)) { pushMessage(`No player named ${to} is on this server. Sign in to message your friends anywhere.`, '#ff6b6b'); return; }
    const fr = await loadFriends(me.userId);
    if (!fr.ok) { pushMessage(fr.error, '#ff6b6b'); return; }
    const f = fr.friends.find((x) => x.username.toLowerCase() === to.toLowerCase());
    if (!f) { pushMessage(`No player or friend named ${to}`, '#ff6b6b'); return; }
    const r = await sendDM(me, f.id, text);
    if (r.ok) pushMessage(`[you \u2192 ${f.username}] ${text}`, '#c8a2ff');
    else pushMessage(r.error, '#ff6b6b');
  }
  function sendWhisper(to: string, text: string) {
    const mp = mpRef.current;
    if (mp?.connected) { pendingWhisperRef.current = { to, text }; mp.sendWhisper(to, text); return; } // the server says if nobody here has that name
    void whisperToFriend(to, text);
  }

  function openPanel() {
    if (panelOpenRef.current) return;
    panelOpenRef.current = true;
    setPanelOpen(true);
    gameHandleRef.current?.setChatOpen(true);
    if (document.pointerLockElement) document.exitPointerLock();
  }
  function closePanel() {
    if (!panelOpenRef.current) return;
    panelOpenRef.current = false;
    setPanelOpen(false);
    gameHandleRef.current?.setChatOpen(false);
    gameHandleRef.current?.relock();
  }
  function applyAdminMode(mode: string, by: string) {
    const m = MODE_ALIASES[mode.toLowerCase()];
    const h = gameHandleRef.current;
    if (!m || !h) return;
    h.setGameMode(m);
    setPlayMode(m);
    pushMessage(by === 'You' ? `Set own game mode to ${capitalize(m)} Mode` : `${by} set your game mode to ${capitalize(m)} Mode`, '#ffe066');
  }
  function adminSetMode(name: string | null, mode: string) {
    const a = accountRef.current;
    if (!a) return;
    const mp = mpRef.current;
    if (mp?.connected) mp.sendAdmin(a.token, 'gamemode', name ? { name, mode } : { mode }); // the server checks you are an admin, then tells the player
    else if (!name) applyAdminMode(mode, 'You');
  }
  function adminAct(action: 'kick' | 'ban', name: string) {
    const a = accountRef.current;
    if (!a || !mpRef.current?.connected) return;
    mpRef.current.sendAdmin(a.token, action, { name });
    window.setTimeout(() => { if (mpRef.current?.connected && accountRef.current) mpRef.current.sendAdmin(accountRef.current.token, 'players'); }, 700);
  }

  /** /friend, /unfriend, /friends, /w, /r and /panel. These are for chat only, so they work even where game commands are off. */
  function runSocialCommand(cmd: string, args: string[]): 'panel' | void {
    const me = accountRef.current;
    const info = (t: string) => pushMessage(t, '#aaaaaa');
    const err = (t: string) => pushMessage(t, '#ff6b6b');
    if (cmd === 'panel') {
      if (!me || !adminRef.current) { err("You don't have permission to use /panel"); return; }
      return 'panel';
    }
    if (cmd === 'friend' || cmd === 'unfriend' || cmd === 'friends') {
      if (!me || isGuestName(me.username)) { err('Sign in to use friends (open the Social tab in the menu).'); return; }
      if (cmd === 'friends') {
        void loadFriends(me.userId).then((r) => {
          if (!r.ok) { err(r.error); return; }
          info(r.friends.length ? `Friends (${r.friends.length}): ${r.friends.map((f) => `${f.username}${f.online ? ' (online)' : ''}`).join(', ')}` : 'You have no friends yet. Try /friend <username>');
          if (r.incoming.length) info(`Friend requests from: ${r.incoming.map((f) => f.username).join(', ')}. Use /friend <name> to accept.`);
        });
        return;
      }
      if (!args[0]) { err(cmd === 'friend' ? 'Usage: /friend <username>' : 'Usage: /unfriend <username>'); return; }
      void (cmd === 'friend' ? addFriend(me, args[0]) : unfriendByName(me, args[0])).then((r) => (r.ok ? info(r.message) : err(r.error)));
      return;
    }
    if (cmd === 'r' || cmd === 'reply') {
      const to = lastWhisperFromRef.current;
      if (!to) { err('Nobody has whispered to you yet'); return; }
      if (!args.length) { err('Usage: /r <message>'); return; }
      sendWhisper(to, args.join(' '));
      return;
    }
    // /w <player> <message>
    if (args.length < 2) { err('Usage: /w <player> <message>'); return; }
    sendWhisper(args[0], args.slice(1).join(' '));
  }

  function runCommand(raw: string, ctx?: { at: { x: number; y: number; z: number }; out: string[]; ok: boolean }): 'help' | 'panel' | void {
    const parts = raw.slice(1).trim().split(/\s+/).filter(Boolean);
    const cmd = (parts[0] ?? '').toLowerCase();
    // Target selectors: in a world where you're the only player, @p, @s, @a and @r all mean you
    const args = parts.slice(1).filter((a) => !/^@[psare](\[.*\])?$/i.test(a));
    const h = gameHandleRef.current;
    const info = (t: string) => { if (ctx) ctx.out.push(t); else pushMessage(t, '#aaaaaa'); };
    const err = (t: string) => { if (ctx) { ctx.ok = false; ctx.out.push(t); } else pushMessage(t, '#ff6b6b'); };
    // Where "~" is: you, or the command block running this
    const origin = (): [number, number, number] => {
      if (ctx) return [ctx.at.x + 0.5, ctx.at.y, ctx.at.z + 0.5];
      const d = h!.getDebugInfo();
      return [d.x, d.y, d.z];
    };
    const coords = (list: string[]): number[] => { const o = origin(); return list.map((a, i) => (a.startsWith('~') ? o[i] + (a.length > 1 ? Number(a.slice(1)) : 0) : Number(a))); };
    if (!h) { if (ctx) ctx.ok = false; return; }
    if (ctx && (cmd === 'help' || cmd === '?')) { info('Command blocks run commands; /help is for chat.'); return; }
    const SOCIAL = ['friend', 'friends', 'unfriend', 'whisper', 'w', 'msg', 'tell', 'r', 'reply', 'panel'];
    if (SOCIAL.includes(cmd)) {
      if (ctx) { err('That command only works in chat'); return; }
      return runSocialCommand(cmd, args);
    }
    if (!serverSettingsRef.current.commands && cmd !== 'help' && cmd !== '?') { err('Commands are turned off on this server (Manage Server).'); return; }

    switch (cmd) {
      case 'wand':
        h.addItem(ITEM_WAND, 1);
        info('Selection wand: left-click a block for position 1, right-click for position 2. Then /fill <block>.');
        return;
      case 'pos1':
      case 'pos2': {
        const st = h.getNetState();
        const p: [number, number, number] = [Math.floor(st.x), Math.floor(st.y), Math.floor(st.z)];
        const sel = h.getSelection();
        h.setSelection(cmd === 'pos1' ? p : sel.p1, cmd === 'pos2' ? p : sel.p2);
        info(`Position ${cmd === 'pos1' ? 1 : 2}: ${p.join(', ')}`);
        return;
      }
      case 'desel':
        h.setSelection(null, null);
        info('Selection cleared');
        return;
      case 'chunk': {
        const st = h.getNetState();
        const cx = Math.floor(st.x / CHUNK_SIZE), cz = Math.floor(st.z / CHUNK_SIZE);
        h.setSelection([cx * CHUNK_SIZE, 0, cz * CHUNK_SIZE], [cx * CHUNK_SIZE + CHUNK_SIZE - 1, CHUNK_HEIGHT - 1, cz * CHUNK_SIZE + CHUNK_SIZE - 1]);
        info(`Selected the whole chunk you're in (${(CHUNK_SIZE * CHUNK_SIZE * CHUNK_HEIGHT).toLocaleString()} blocks). /fill <block> to fill it.`);
        return;
      }
      case 'fill': {
        // /fill <block> (fills the wand selection) or /fill x1 y1 z1 x2 y2 z2 <block> (~ = where you are)
        const here = origin();
        const coord = (t: string, i: number) => (t.startsWith('~') ? Math.floor(here[i] + (Number(t.slice(1)) || 0)) : Math.floor(Number(t)));
        let a: number[] | null, b: number[] | null, name: string | undefined;
        if (args.length >= 7) {
          a = [0, 1, 2].map((i) => coord(args[i], i)); b = [0, 1, 2].map((i) => coord(args[i + 3], i)); name = args[6];
          if ([...a, ...b].some((v) => !Number.isFinite(v))) { err('Usage: /fill x1 y1 z1 x2 y2 z2 <block>'); return; }
        } else {
          const sel = h.getSelection();
          a = sel.p1 ?? sel.p2; b = sel.p2 ?? sel.p1; name = args[0];
          if (!a || !b) { err('Select a box first: /wand (then click two blocks), /pos1 + /pos2, or /chunk. Or: /fill x1 y1 z1 x2 y2 z2 <block>'); return; }
        }
        if (!name) { err('Usage: /fill <block>   e.g. /fill stone, /fill air'); return; }
        let id: number;
        try { id = blockIdFromName(name.toLowerCase()); } catch (e) { err((e as Error).message); return; }
        const [x0, x1] = [Math.min(a[0], b[0]), Math.max(a[0], b[0])], [y0, y1] = [Math.max(0, Math.min(a[1], b[1])), Math.min(CHUNK_HEIGHT - 1, Math.max(a[1], b[1]))], [z0, z1] = [Math.min(a[2], b[2]), Math.max(a[2], b[2])];
        const volume = (x1 - x0 + 1) * (y1 - y0 + 1) * (z1 - z0 + 1);
        if (volume > 32768) { err(`That's ${volume.toLocaleString()} blocks; /fill can do up to 32,768 at once.`); return; }
        const list: Array<[number, number, number, number]> = [];
        for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) list.push([x, y, z, id]);
        const n = h.setBlocks(list);
        info(`Filled ${n.toLocaleString()} blocks with ${name.toLowerCase()}${n < volume ? ` (${(volume - n).toLocaleString()} were in chunks that aren't loaded)` : ''}`);
        return;
      }
      case 'difficulty': {
        const d = (args[0] ?? '').toLowerCase();
        if (!['peaceful', 'easy', 'normal', 'hard'].includes(d)) { info(`Difficulty: ${serverSettingsRef.current.difficulty}. Change it with /difficulty peaceful|easy|normal|hard`); return; }
        if (hardcoreRef.current) { err('Hardcore worlds are always on Hard.'); return; }
        changeServerSettings({ difficulty: d as Difficulty });
        info(`Difficulty set to ${d}`);
        return;
      }
      case 'gamerule': {
        if ((args[0] ?? '').toLowerCase() !== 'keepinventory' || !['true', 'false'].includes((args[1] ?? '').toLowerCase())) { err('Usage: /gamerule keepInventory true|false'); return; }
        changeServerSettings({ keepInventory: args[1].toLowerCase() === 'true' });
        info(`keepInventory is now ${args[1].toLowerCase()}`);
        return;
      }
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
        const vals = coords(args);
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
        if (id === ITEM_ENCHANTED_BOOK) { // /give enchanted_book [enchantment] [level]
          const def = args[1] ? findEnchantment(args[1]) : undefined;
          if (args[1] && !def) { err(`Unknown enchantment "${args[1]}". Try: ${ENCHANTMENTS.map((d) => d.key).join(', ')}`); return; }
          const level = def ? Math.max(1, Math.min(def.max, parseInt(args[2] ?? '1', 10) || 1)) : 0;
          const inv = h.getInventory();
          const left = addStackToSlots(inv, def ? { id, count: 1, ench: { [def.key]: level } } : { id, count: 1 });
          if (left > 0) { err('Your inventory is full'); return; }
          h.setSlots(inv);
          info(def ? `Gave an enchanted book [${enchantLabel(def.key, level)}]` : 'Gave [Enchanted Book]');
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
        const named: Record<string, number> = { sunrise: 0, day: 1000, noon: 6000, sunset: 12000, night: 13000, midnight: 18000 };
        const v = (args[1] ?? '').toLowerCase();
        const ticks = named[v] ?? Number(v);
        if ((args[0] ?? '').toLowerCase() !== 'set' || !v || !Number.isFinite(ticks)) {
          err('Usage: /time set <day|noon|sunset|night|midnight|0-24000>');
          return;
        }
        if (!changeTime((((ticks % 24000) + 24000) % 24000) / 24000)) { err('Only the host can change the time on a server.'); return; }
        info(`Set the time to ${named[v] !== undefined ? v : Math.round(ticks)}`);
        return;
      }
      case 'weather': {
        const kind = (args[0] ?? '').toLowerCase();
        const secs = args[1] === undefined ? undefined : Number(args[1]);
        if ((kind !== 'clear' && kind !== 'rain' && kind !== 'snow') || (secs !== undefined && !(secs > 0))) {
          err('Usage: /weather <clear|rain|snow> [seconds]');
          return;
        }
        if (h.getDebugInfo().dimension !== 'overworld') info('There is no weather here. It will show when you go back to the Overworld.');
        if (!changeWeather(kind, secs)) { err('Only the host can change the weather on a server.'); return; }
        info(`Set the weather to ${kind}${secs ? ` for ${Math.round(secs)} seconds` : ''}`);
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
      case 'say': {
        const text = parts.slice(1).join(' ').trim();
        if (!text) { err('Usage: /say <message>'); return; }
        // online, the server sends chat back to everyone (you too); offline it just shows here
        if (mpRef.current?.connected) mpRef.current.sendChat(ctx ? `[@] ${text}` : text);
        else pushMessage(`[${ctx ? '@' : (username ?? 'You')}] ${text}`, '#ffffff');
        info(text);
        return;
      }
      case 'setblock': {
        // /setblock x y z <block>
        if (args.length < 4) { err('Usage: /setblock <x> <y> <z> <block>   (~ for relative)'); return; }
        const p = coords(args.slice(0, 3)).map(Math.floor);
        if (p.some((v) => !Number.isFinite(v))) { err('Coordinates must be numbers or ~ (like ~1)'); return; }
        let id: number;
        try { id = blockIdFromName(args[3].toLowerCase()); } catch (e) { err((e as Error).message); return; }
        if (h.getBlock(p[0], p[1], p[2]) === id) { err('Nothing changed: that block is already there'); return; }
        if (!h.setBlocks([[p[0], p[1], p[2], id]])) { err("That position isn't loaded"); return; }
        info(`Changed the block at ${p.join(', ')}`);
        return;
      }
      case 'xp':
      case 'experience': {
        // /xp 30 (points)  ·  /xp 5 levels  ·  /xp set 10
        const setTo = args[0]?.toLowerCase() === 'set';
        const n = Number(setTo ? args[1] : args[0]);
        const levels = setTo || /^l(evels?)?$/i.test(args[1] ?? '');
        if (!Number.isFinite(n) || n < 0 || n > 100000) { err('Usage: /xp <amount> [levels]  or  /xp set <level>'); return; }
        if (setTo) { h.setXpLevel(Math.floor(n)); info(`Set your level to ${Math.floor(n)}`); return; }
        if (levels) { h.setXpLevel(h.getXp().level + Math.floor(n)); info(`Gave you ${Math.floor(n)} levels`); return; }
        h.addXp(Math.floor(n));
        info(`Gave you ${Math.floor(n)} experience`);
        return;
      }
      case 'locate': {
        const what = (args[0] ?? '').toLowerCase();
        if (what === 'temple' || what === 'fortress') {
          const st = h.locateStructure();
          if (!st || st.kind !== what) err(what === 'temple' ? 'No desert temple found. Temples are in the Overworld, in deserts (and rarer than villages).' : 'No fortress found. Fortresses are in the Nether: use this there.');
          else info(`The nearest ${what} is at ${st.x}, ${st.z}, about ${st.distance} blocks away. Use /tp ${st.x} ~ ${st.z} to go there.`);
          return;
        }
        if (what !== 'village') {
          err('Usage: /locate village | temple | fortress');
          return;
        }
        const found = h.locateVillage();
        if (!found) err('No village found. They only generate in the Overworld, in plains, deserts and snowy lands.');
        else info(`The nearest village is at ${found.x}, ${found.z}, about ${found.distance} blocks away. Use /tp ${found.x} ~ ${found.z} to go there.`);
        return;
      }
      case 'enchant': {
        const def = args[0] ? findEnchantment(args[0]) : undefined;
        if (!def) { err(`Usage: /enchant <enchantment> [level]. Try: ${ENCHANTMENTS.map((d) => d.key).join(', ')}`); return; }
        const level = Math.max(1, Math.min(def.max, parseInt(args[1] ?? '1', 10) || 1));
        const inv = h.getInventory();
        const slot = selectedSlotRef.current;
        const st = inv[slot];
        if (!st) { err('Hold the item you want to enchant'); return; }
        const isBook = st.id === ITEM_BOOK || st.id === ITEM_ENCHANTED_BOOK;
        if (!isBook && !enchantFits(def, st.id, true)) { err(`${def.name} can't go on a ${ITEM_INFO[st.id].name}`); return; }
        if (Object.keys(st.ench ?? {}).some((k) => k !== def.key && enchantsConflict(k, def.key))) { err(`${def.name} doesn't work together with what this item already has`); return; }
        if (st.id === ITEM_BOOK && st.count > 1) {
          inv[slot] = withCount(st, st.count - 1);
          if (addStackToSlots(inv, { id: ITEM_ENCHANTED_BOOK, count: 1, ench: { [def.key]: level } }) > 0) { err('Your inventory is full'); return; }
        } else {
          inv[slot] = st.id === ITEM_BOOK ? { id: ITEM_ENCHANTED_BOOK, count: 1, ench: { [def.key]: level } } : { ...st, ench: { ...(st.ench ?? {}), [def.key]: level } };
        }
        h.setSlots(inv);
        info(`Enchanted with ${enchantLabel(def.key, level)}`);
        return;
      }
      case 'summon': {
        // /summon [baby] <mob> [x y z]
        const isBaby = args.some((a) => a.toLowerCase() === 'baby');
        const mobArgs = args.filter((a) => a.toLowerCase() !== 'baby');
        const at = mobArgs.length >= 4 ? coords(mobArgs.slice(-3)) : null;
        const kind = mobName((at ? mobArgs.slice(0, -3) : mobArgs).join(' '));
        if (at) {
          if (at.some((v) => !Number.isFinite(v)) || !h.script.spawnEntity(kind, at[0], at[1], at[2])) { err('Usage: /summon <mob> [x y z]'); return; }
          info(`Summoned a ${kind} at ${at.map((v) => v.toFixed(1)).join(', ')}`);
          return;
        }
        if (ctx) { // from a command block: right on top of it
          const o = origin();
          if (!h.script.spawnEntity(kind, o[0], o[1] + 1, o[2])) { err(`Unknown mob "${kind}"`); return; }
          info(`Summoned a ${kind}`);
          return;
        }
        if (!h.summonMob(kind, { baby: isBaby })) {
          err('Usage: /summon [baby] <pig|cow|chicken|sheep|zombie|skeleton|creeper|spider|ghast|blaze|piglin|villager|iron golem>');
          return;
        }
        info(`Summoned a ${isBaby ? 'baby ' : ''}${kind}`);
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

  function handleDropItems(items: ItemStack[]) {
    gameHandleRef.current?.dropItems(items);
  }

  function handleQuickCraft(recipeId: string) {
    gameHandleRef.current?.quickCraft(recipeId, atCraftingTable);
  }

  function handleRemoveItem(id: number, count: number) {
    gameHandleRef.current?.removeItem(id, count);
  }


  /** Deletes a planet and its saved blocks from this device. */
  function handleDeleteWorld(world: { id?: string; name?: string }) {
    setSavedWorlds((prev) => prev.filter((w) => (world.id ? w.id !== world.id : w !== world)));
    if (world.id) { try { localStorage.removeItem(`vb-save-${world.id}`); } catch { /* storage blocked */ } }
    if (world.id) clearAdvancements(world.id);
  }

  function handleNavClick(v: View) {
    if (v === 'create-world') setCreatePreset({ mode: 'survival', worldType: 'default', nonce: Date.now() });
    setView(v);
  }

  function handleRenderDistanceChange(rd: number) {
    setRenderDistance(rd);
  }

  const rank = readRank();
  const planetLimit = worldLimit(rank);
  const lastLaunchRef = useRef(0);
  /** Starting a game: ignore a second start right after the first (a focused button + Space used to restart the game). */
  function startGuard(): boolean {
    const now = Date.now();
    if (gameMode === 'playing' || now - lastLaunchRef.current < 1500) return false;
    lastLaunchRef.current = now;
    (document.activeElement as HTMLElement | null)?.blur?.();
    return true;
  }

  function handleSaveWorld(config: WorldConfig) {
    if (savedWorlds.length >= planetLimit) { setHint(`You've reached your limit of ${planetLimit} planets (${RANK_NAMES[rank]}). Delete one to make a new one.`); return; }
    if (!startGuard()) return;
    const made: WorldConfig = { ...config, creator: currentUsername || 'Guest', createdAt: Date.now(), lastPlayed: Date.now(), playSeconds: 0 };
    setSavedWorlds((prev) => [...prev, made]);
    beginWorld(made);
  }

  // Play a saved world with its own mode and world type (it used to always start Survival)
  function launchWorld(config: WorldConfig) {
    if (!startGuard()) return;
    beginWorld(config);
  }

  function beginWorld(config: WorldConfig) {
    const hc = config.mode === 'hardcore';
    hardcoreRef.current = hc;
    setHardcore(hc);
    const s: ServerSettings = { ...DEFAULT_SERVER, difficulty: hc ? 'hard' : config.difficulty ?? 'normal', keepInventory: config.keepInventory ?? false };
    serverSettingsRef.current = s;
    setServerSettings(s);
    setActiveWorldMode((hc ? 'survival' : config.mode) as GameWorldMode);
    setActiveWorldType(config.worldType ?? 'default');
    setActiveSeed(config.seed ?? randomSeed());
    setActiveExperimental(!!config.experimental);
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
    if (!startGuard()) return;
    setActiveWorldMode('survival');
    setActiveWorldType('default');
    setActiveSeed(randomSeed());
    setActiveExperimental(false);
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
        <Sidebar username={currentUsername} view={view} onNavClick={handleNavClick} socialBadge={(Object.values(unread) as number[]).reduce((a, b) => a + b, 0) + pendingRequests} />
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
          socialView={(
            <SocialView
              account={account}
              checking={!accountChecked && !authWaitOver}
              isAdmin={admin}
              unread={unread}
              onOpenChat={(id) => {
                openChatFriendRef.current = id;
                if (id) setUnread((u) => { if (!u[id]) return u; const n = { ...u }; delete n[id]; return n; });
              }}
              onSignIn={() => setShowModal(true)}
              onSignOut={handleSignOut}
              onFriendsChanged={(n) => { pendingRequestsRef.current = n; setPendingRequests(n); }}
            />
          )}
          onDeleteWorld={handleDeleteWorld}
          savedWorlds={savedWorlds}
          planetLimit={planetLimit}
          createPreset={createPreset}
          serverUrl={serverUrl}
          onServerUrlChange={setServerUrl}
          onJoinServer={joinServer}
          netStatus={netStatus}
          netError={netError}
        />
        <ProfilePanel username={currentUsername} onPlayNow={handlePlayNow} />
        {showModal && <LoginOverlay onGuest={handleGuest} onClose={username ? () => setShowModal(false) : undefined} />}
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
        {!showMenu && <GameHUD xp={xpState} inventory={inventory} offhand={offhand} armor={armor} health={health} hunger={hunger} selectedSlot={selectedSlot} mode={playMode} />}
        {!showMenu && inventoryOpen && (
          <InventoryOverlay
            key={`${atCraftingTable}-${openChest}-${openFurnace}-${openStation?.kind ?? ''}`}
            station={openStation}
            stationApi={{
              xpLevel: xpState.level,
              spend: (n) => gameHandleRef.current?.spendXpLevels(n) ?? false,
              seed: () => gameHandleRef.current?.getEnchantSeed() ?? 0,
              reroll: () => gameHandleRef.current?.rerollEnchantSeed(),
              sound: (k) => gameHandleRef.current?.playStationSound(k),
              onEnchanted: () => earnAdvancements(checkEvent('itemEnchanted', {}, advRef.current, experimentalEnabled())),
            }}
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
        {!showMenu && sleeping && (
          <SleepOverlay online={netStatus === 'online'} onLeave={() => gameHandleRef.current?.leaveBed()} onChat={() => openChat('')} />
        )}
        {!showMenu && panelOpen && account && admin && (
          <AdminPanel
            account={account}
            online={netStatus === 'online'}
            players={adminPlayers}
            onSetMode={adminSetMode}
            onKick={(n) => adminAct('kick', n)}
            onBan={(n) => adminAct('ban', n)}
            onAnnounced={showAnnouncement}
            onRefreshPlayers={() => { if (mpRef.current?.connected && accountRef.current) mpRef.current.sendAdmin(accountRef.current.token, 'players'); }}
            onClose={closePanel}
          />
        )}
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
        {!showMenu && advToasts.length > 0 && <AdvancementToasts toasts={advToasts} />}
        {!showMenu && scoped && (
          <div className="absolute inset-0 z-10 pointer-events-none" style={{ background: 'radial-gradient(circle at center, transparent 0, transparent 36vh, rgba(0,0,0,0.97) calc(36vh + 2px))' }}>
            {!spyglass && <div className="absolute left-1/2 top-[14vh] bottom-[14vh] w-px bg-black/85 -translate-x-1/2" />}
            {!spyglass && <div className="absolute top-1/2 left-[calc(50%-36vh)] right-[calc(50%-36vh)] h-px bg-black/85 -translate-y-1/2" />}
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
        {!showMenu && trading && (
          <TradeOverlay trade={trading} inventory={inventory} note={tradeNote} onClose={closeTrade}
            onTrade={(i) => { const r = gameHandleRef.current?.trade(trading.id, i); setTradeNote(r === 'missing' ? "You don't have what this trade needs." : r === 'gone' ? 'The villager walked away.' : null); if (r === 'gone') closeTrade(); }} />
        )}
        {!showMenu && cmdBlock && <CommandBlockPanel key={cmdBlock.key} info={cmdBlock} onDone={(cfg) => closeCommandBlock(cfg)} onCancel={() => closeCommandBlock()} />}
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
          <DeathScreen reason={deathReason} onRespawn={handleRespawn} onExit={exitToHome} hardcore={hardcore} />
        )}
        {!showMenu && menuOpen && (
          <GameMenu
            page={menuPage}
            onResume={resumeGame}
            onOpenSettings={() => setMenuPage('settings')}
            onOpenScripts={() => setMenuPage('scripts')}
            onOpenMods={() => setMenuPage('mods')}
            onOpenShop={() => setMenuPage('shop')}
            onOpenServer={() => setMenuPage('server')}
            onOpenAdvancements={() => setMenuPage('advancements')}
            showScripts={serverSettings.scripts}
            showMods={serverSettings.mods}
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
            ) : menuPage === 'server' ? (
              <ManageServerView
                settings={serverSettings}
                hardcore={hardcore}
                online={!!mpRef.current?.connected}
                isHost={!mpRef.current?.connected || hostId === myNetId}
                players={Object.entries(onlinePlayers).map(([id, name]) => ({ id: Number(id), name }))}
                myId={myNetId}
                hostId={hostId}
                weather={weather}
                onChange={changeServerSettings}
                onKick={(id) => mpRef.current?.kick(id)}
                onBan={(id) => mpRef.current?.ban(id)}
                onTime={(t) => { changeTime(t); }}
                onWeather={(k) => { changeWeather(k); }}
              />
            ) : menuPage === 'advancements' ? (
              <AdvancementsPanel have={advHave} experimental={experimentalEnabled()} />
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

      {/* Pop-ups that show in the menu and in a world: private messages, friend requests, announcements */}
      <div className="fixed top-4 right-4 z-[80] flex flex-col gap-2 items-end pointer-events-none" data-testid="toasts">
        {toasts.map((t) => (
          <div
            key={t.key}
            className={`max-w-[360px] rounded-xl px-4 py-3 text-sm shadow-2xl border vb-fade-in ${
              t.kind === 'announce' ? 'bg-[#2a2208]/95 border-[#ffd700]/60 text-[#ffe680]' : t.kind === 'dm' ? 'bg-[#101a2c]/95 border-[#5b8def]/50 text-[#cfe0ff]' : 'bg-[#0d131b]/95 border-[#243044] text-white'
            }`}
          >
            {t.kind === 'announce' && <div className="text-[10px] uppercase tracking-widest font-bold mb-0.5 text-[#ffd700]">Announcement</div>}
            <div className="break-words">{t.text}</div>
          </div>
        ))}
      </div>
    </>
  );
}