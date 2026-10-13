import { useState, useEffect, useRef, useMemo, useSyncExternalStore, createContext, useContext, type FormEvent, type ChangeEvent, type MouseEvent as ReactMouseEvent, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from 'react';
import { ADVANCEMENT_TABS, advancementsFor, checkItems, checkEvent, loadAdvancements, saveAdvancements, clearAdvancements, type Advancement, type AdvancementTab } from './advancements';
import { SKINS, CAPES, CUSTOM_SKIN_ID, isCustomSkinData, type PlayerLook } from '@/cosmetics';
import { CAN_LINK_OUT, CAN_SELL_RANKS, ADS_POSSIBLE, PLATFORM, initAds, triggerRewardedAd, setGameplayActive, reportLoadingFinished, setAdsBlocked, maybeInterstitial } from '@/adEconomy';
import {
  getProgress, subscribeProgress, onLevelUp, setCustomSkin, addActiveSeconds, rewardAdCoins, rewardAdBooster, buyCosmetic, equipCosmetic, currentLook, reloadProgress,
  xpForLevel, DISCORD_INVITE_URL, TEBEX_STORE_URL, AD_COINS, LEVEL_UP_COINS, XP_PER_PERIOD, SECONDS_PER_PERIOD, BOOSTER_SECONDS, IDLE_AFTER_SECONDS,
} from '@/progression';
import { ModBuilder } from '@/ModBuilder';
import { parseModCode } from '@/modBuilderLogic';
import { readRank, worldLimit, WORLD_LIMITS, RANK_NAMES, effectiveRank, playerCap, scriptBudgetMs, canUploadSkin, SCRIPT_BUDGET_MS, creatorTier, CREATOR_PLAYS, CREATOR_NAMES, PLAYER_CAP, adsAllowedFor, badgeTags, type RankId, type CreatorTier } from '@/ranks';
import { GAME_VERSION, NEWS } from '@/news';
import { t, useLanguage, setLanguage, LANGUAGES, type LangCode } from '@/i18n';
import { useKeybinds, rebind, resetBinds, keyLabel, KEY_ACTIONS, setCapturingKey, isCapturingKey, getBinds } from '@/keybinds';
import type { OneBlockView, KeyAction } from '@/voxelGame';
import { ITEM_IRON_INGOT, ITEM_GOLD_INGOT, ITEM_DIAMOND, ITEM_ENDER_PEARL, ITEM_IRON_SWORD, ITEM_IRON_PICKAXE, ITEM_BOW, BLOCK_TNT, BLOCK_GLASS, armorId } from '@/voxelGame';
import { createVoxelGame, type GameWorldMode, type GraphicsQuality, type Recipe, type PlayMode, type DebugInfo, type WorldType, type Slots, type ItemStack, type SaveData, type WeatherKind, EXPERIMENTAL_IDS, experimentalEnabled, isWater, isLava, BLOCK_WATER, BLOCK_LAVA, BLOCK_GRASS, BLOCK_DIRT, BLOCK_STONE, ARMOR, ARMOR_PIECES, CUSTOM_ITEMS, CUSTOM_BLOCKS, customIdForKey, registerCustomItem, registerCustomBlock, createPlayerPreview, drawLookPreview, getTexturePreviews, setTextureResolution, type TextureRes, type DimensionSpec, type TextureSpec, maxStack, addToSlots, countInSlots, emptySlots, INVENTORY_SIZE, ITEM_INFO, RECIPES, getItemIconURL, matchRecipe, SMELTING, FUEL_SECONDS, isBlockId, type Trade, type Difficulty, ITEM_WAND, CHUNK_SIZE, CHUNK_HEIGHT, isPotionItem, isBrewIngredient, ITEM_BLAZE_POWDER, potionName, ITEM_NAME_TAG } from '@/voxelGame';
import * as THREE from 'three';
import {
  withCount, addStackToSlots, maxDurability, itemDisplayName, enchantLabel, ENCHANTMENTS, enchantFits, enchantsConflict, ITEM_LAPIS, ITEM_BOOK, ITEM_ENCHANTED_BOOK, type Station,
  COMMAND_TYPES, type CommandBlockInfo, type CommandType,
  MOB_KINDS, MOB_NAMES, playerHeadItem, isPlayerHeadItem, type MinigameView, type MinigameSize, type BotDifficulty, type ArenaKind,
} from '@/voxelGame';
import { enchantOffers, applyEnchants, anvilResult, canEnchant } from '@/enchanting';
import { FancyText, stripFancy } from '@/fancytext';
import { emptyRanks, cleanFakeRanks, rankTagOf, runRankCommand, loadFakeRanks, saveFakeRanks, type FakeRanks } from '@/fakeranks';
import { runSchem, pasteByName, type SchemEnv } from './schemCommands';
import { pickTextFile, downloadFile, fileSafe } from './fileTools';
import { loadLibrary, validateSchematic, nameKey, type Schematic } from './schematics';
import SchematicsPage, { SchematicUpload } from './SchematicsPage';
import PrivateServers from './PrivateServersPanel';
import VideoOptions from './VideoOptions';
import { MusicPlayer, SOUNDTRACKS, subscribeNowPlaying, getNowPlaying, type SoundtrackStyle } from './music';
import SideNav from './SideNav';
import { AccountTab, AccountSummaryContext } from './AccountPanel';
import { subscribeVideo, getVideo } from './videoPrefs';
import { rotateBlockId, mirrorBlockId } from '@/voxelGame';
import { ScriptRunner, OFFICIAL_MODS, SCRIPT_EXAMPLES, SCRIPT_API_HELP, AI_MODELS, checkApiUsage, type Mod, type AiMode, type AiTurn } from '@/scripting';
import { requestAssistant, parseSearchReplace, applySearchReplace, type AiMeta } from '@/aiAssistant';
import LoginOverlay from './LoginOverlay';
import SocialView from './SocialView';
import AdminPanel, { type PanelPlayer } from './AdminPanel';
import { useAccount } from './useAccount';
import TouchControls, { RotateHint, touchEnabled, loadTouchPref, saveTouchPref, lockViewportForTouch, type TouchPref } from './TouchControls';
import Tutorial, { tutorialDone } from './Tutorial';
import { addFriend, unfriendByName, loadFriends, sendDM, startPolling, isGuestName, reportActivity, fetchPlayingCounts, fetchLeaderboard, fetchStanding, recordPlay, setServerPresence, isOwnerName, listHostedWorlds, publishHostedWorld, unpublishHostedWorld, verifyToken, isFriendOf, isBannedName, isAdminToken, type DM, type Activity, type Friend, type LeaderRow, type Standing, type HostedWorld } from './social';

// Multiplayer is optional: Vite only includes src/multiplayer.ts if the file
// exists, so deleting it (or the server folder) never breaks the game.
const multiplayerModules = import.meta.glob('./multiplayer.ts');
const multiplayerAvailable = Object.keys(multiplayerModules).length > 0;
// Hosting your own world (others join it straight from your browser) is optional in the same way: src/hosting.ts
const hostingModules = import.meta.glob('./hosting.ts');
const hostingAvailable = Object.keys(hostingModules).length > 0;
/** Who may join a world while you play it. */
type WorldPrivacy = 'private' | 'friends' | 'accounts' | 'public';
const PRIVACY_INFO: Record<WorldPrivacy, { label: string; hint: string }> = {
  public: { label: 'Public', hint: 'Anyone can join from the Servers page' },
  accounts: { label: 'Accounts only', hint: 'Anyone signed in to VibeBlox can join' },
  friends: { label: 'Friends only', hint: 'Only your friends see it and can join' },
  private: { label: 'Private', hint: 'Just you: nobody else sees or joins it' },
};
const PRIVACY_ORDER: WorldPrivacy[] = ['public', 'accounts', 'friends', 'private'];
type HostRoomLike = { count: number; full: boolean; setPrivacy(p: WorldPrivacy): void; stop(reason?: string): void };
type HostingMod = {
  HostRoom: new (o: Record<string, unknown>) => HostRoomLike;
  PeerHost: new (id: string, signaling: unknown, room: HostRoomLike) => { start(): Promise<void>; stop(): void };
  loopback(room: HostRoomLike): unknown;
  openPeerSocket(id: string, signaling: unknown, hostName?: string): unknown;
  supabaseSignaling(getClient: () => Promise<unknown>): unknown;
  randomId(n?: number): string;
};
function loadHosting(): Promise<HostingMod | null> {
  const l = Object.values(hostingModules)[0];
  return l ? l().then((m) => m as HostingMod).catch(() => null) : Promise.resolve(null);
}
/** How players find each other: a Supabase Realtime channel (tests put their own in window.__vbSignaling). */
function signalingFor(h: HostingMod): unknown {
  const test = (window as unknown as { __vbSignaling?: unknown }).__vbSignaling;
  return test ?? h.supabaseSignaling(() => import('./auth/supabaseAuth').then((A) => (A as unknown as { getSupabase: () => Promise<unknown> }).getSupabase()));
}
const HOSTABLE_TYPES = ['default', 'superflat'];
type NetBlock = [number, number, number, number];
type NetBadge = { owner?: boolean; rank?: string; tier?: string };
type NetPlayerInfo = { id: number; name: string; x: number; y: number; z: number; yaw: number; pitch: number; mode: string; look?: PlayerLook; badge?: NetBadge };
type ServerSettings = { difficulty: Difficulty; keepInventory: boolean; scripts: boolean; mods: boolean; commands: boolean };
const DEFAULT_SERVER: ServerSettings = { difficulty: 'normal', keepInventory: false, scripts: true, mods: true, commands: true };
type Welcome = { id: number; name: string; seed: number; worldType: 'default' | 'superflat'; mode: string; time: number; changes: NetBlock[]; players: NetPlayerInfo[]; hostId?: number | null; settings?: ServerSettings; weather?: WeatherKind; experimental?: boolean; maxPlayers?: number; ranks?: unknown };
type MpEvents = {
  onPing?: (ms: number) => void;
  onWelcome?: (w: Welcome) => void;
  onHost?: (id: number) => void;
  onSettings?: (s: ServerSettings) => void;
  onBlocks?: (list: NetBlock[]) => void;
  onMoves?: (list: Array<[number, number, number, number, number, number, string, number, number]>) => void;
  onJoin?: (id: number, name: string) => void;
  onLeave?: (id: number, name: string) => void;
  onLook?: (id: number, look: PlayerLook) => void;
  onChat?: (name: string, text: string) => void;
  onTitle?: (text: string, sub: string) => void;
  onRanks?: (ranks: unknown) => void;
  onBadge?: (id: number, badge: NetBadge) => void;
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
  connect(url: string, name: string, token?: string | null): void;
  connectSocket(sock: unknown, name: string, token?: string | null, cantConnect?: string, waitMs?: number): void;
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
  sendTitle(to: string, text: string, sub?: string): void;
  sendRanks(ranks: unknown): void;
  sendAdmin(token: string, action: 'check' | 'players' | 'kick' | 'ban' | 'gamemode', extra?: { name?: string; mode?: string }): void;
  disconnect(): void;
};

// ---------------- Remembered settings ----------------
type SavedSettings = {
  renderDistance?: number; graphicsQuality?: GraphicsQuality; gfxV?: number; fov?: number; sfxVolume?: number;
  hudPrefs?: HudPrefs; craftMode?: 'grid' | 'quick'; volume?: number; textureRes?: TextureRes;
};
const savedSettings: SavedSettings = (() => {
  try { return JSON.parse(localStorage.getItem('vb-settings') ?? '{}') as SavedSettings; } catch { return {}; }
})();
// Before version 15 "Max" was what is now called "Epic": keep those players on the tier they picked
if (savedSettings.graphicsQuality === 'max' && !savedSettings.gfxV) savedSettings.graphicsQuality = 'epic';
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
  Star,
  Search,
  Newspaper,
} from 'lucide-react';

type View = 'home' | 'shop' | 'settings' | 'create-world' | 'servers' | 'planets' | 'social' | 'news' | 'leaderboard';
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
  { label: 'Top', icon: Trophy, view: 'leaderboard' },
  { label: 'Planets', icon: Globe, view: 'planets' },
  { label: 'Shop', icon: ShoppingBag, view: 'shop' },
];

type GameCard = {
  title: string;
  /** Which "playing now" count belongs to this card (see social.ts reportActivity). */
  activity: Activity;
  image: string;
  tag: string;
  accent: string;
};
/** "12 playing" from the live counts (or nothing while they load / when they can't be reached). */
function playersLabel(counts: Record<string, number> | null, activity: Activity): string {
  if (!counts) return t('home.playNow');
  const n = counts[activity] ?? 0;
  return t('home.playing', { n: n.toLocaleString() });
}

const games: GameCard[] = [
  {
    title: 'Survival',
    activity: 'survival',
    image: '/images/survival-bg.jpg',
    tag: 'PvE',
    accent: 'from-orange-500 to-red-500',
  },
  {
    title: 'EggWars',
    activity: 'eggwars',
    image: '/images/eggwars-bg.jpg',
    tag: 'Team',
    accent: 'from-pink-500 to-purple-500',
  },
  {
    title: 'Superflat',
    activity: 'superflat',
    image: '/images/superflat-bg.jpg',
    tag: 'Build',
    accent: 'from-sky-500 to-cyan-500',
  },
  {
    title: 'Creative',
    activity: 'creative',
    image: '/images/creative-bg.jpg',
    tag: 'Sandbox',
    accent: 'from-emerald-500 to-teal-500',
  },
  {
    title: 'OneBlock',
    activity: 'oneblock',
    image: '/images/oneblock-bg.jpg',
    tag: 'Solo',
    accent: 'from-amber-500 to-orange-500',
  },
  {
    title: 'Bridge Duels',
    activity: 'bridge',
    image: '/images/bridgeduels-bg.jpg',
    tag: 'PvP',
    accent: 'from-blue-500 to-indigo-500',
  },
];


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
    perks: [`${WORLD_LIMITS.vanguard} planets (instead of ${WORLD_LIMITS.none})`, 'Custom Chat Tag', `${SCRIPT_BUDGET_MS.vanguard}ms CPU script budget`],
    borderClass: 'vb-border-copper border-2',
    accentText: 'text-[#e8a87c]',
    iconBg: 'from-[#b87333] to-[#8b5a2b]',
  },
  {
    name: 'ELITE',
    price: '$15',
    priceValue: 15,
    icon: Zap,
    perks: [`${WORLD_LIMITS.elite} planets`, 'Reflective linear gradient text colors', `${SCRIPT_BUDGET_MS.elite}ms CPU script budget`, '+100 daily AI terminal calls'],
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
    perks: [`${WORLD_LIMITS.champion} planets`, 'Animated molten magma chat tags', 'Cosmic floating chat tags', `${SCRIPT_BUDGET_MS.champion}ms CPU script budget`, 'Upload your own custom skin', 'Unlimited AI terminal access'],
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

const NEWS_SEEN_KEY = 'vibeblox-news-seen';
function readNewsSeen(): number { try { return parseInt(localStorage.getItem(NEWS_SEEN_KEY) ?? '0', 10) || 0; } catch { return 0; } }
function Sidebar({ username, view, onNavClick, socialBadge = 0 }: { username: string; view: View; onNavClick: (v: View) => void; socialBadge?: number }) {
  useLanguage();
  const initial = username ? username.charAt(0).toUpperCase() : 'P';
  const [seen, setSeen] = useState(readNewsSeen);
  useEffect(() => { if (view === 'news') { try { localStorage.setItem(NEWS_SEEN_KEY, String(GAME_VERSION)); } catch { /* private window */ } setSeen(GAME_VERSION); } }, [view]);
  const newsUnread = seen < GAME_VERSION;
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
              <Icon className="w-5 h-5 mb-0.5 transition-transform duration-200" />{item.view ? t('nav.' + item.view) : item.label}
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
      <button
        data-testid="nav-news"
        onClick={() => onNavClick('news')}
        className={`relative mt-2 w-12 h-12 rounded-xl flex flex-col items-center justify-center text-[8px] transition-all duration-200 ease-out hover:scale-110 active:scale-95 ${view === 'news' ? 'bg-[#00e676]/15 text-[#00e676]' : 'text-[#5a6b80] hover:text-white hover:bg-[#1a2230]'}`}
      >
        <Newspaper className="w-5 h-5 mb-0.5" />{t('nav.news')}
        {newsUnread && view !== 'news' && <span data-testid="news-dot" className="absolute top-1 right-1 w-2.5 h-2.5 rounded-full bg-[#ff5252]" />}
      </button>
      <div data-testid="game-version" className="text-[9px] text-[#5a6b80] mt-1">v{GAME_VERSION}</div>
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

function GameCardItem({ game, onPlay, players }: { game: GameCard; onPlay?: () => void; players: string }) {
  return (
    <button
      onClick={onPlay}
      className="group relative bg-[#121822] rounded-2xl overflow-hidden border border-[#243044] hover:border-[#364860] transition-all duration-300 text-left hover:-translate-y-1 hover:shadow-2xl hover:shadow-black/50"
    >
      <div className={`relative h-36 overflow-hidden bg-gradient-to-br ${game.accent}`}>
        <img
          src={game.image}
          alt={game.title}
          loading="lazy"
          onError={(e) => { e.currentTarget.style.visibility = 'hidden'; }}
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
            <span data-testid={`players-${game.activity}`}>{players}</span>
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
                <div className="h-28 bg-cover bg-center relative" style={{ backgroundImage: `url(${world.image || '/images/survival-bg.jpg'}), linear-gradient(135deg, #0e4f6e, #121822)` }}>
                  <div className="absolute inset-0 bg-gradient-to-t from-[#121822] to-transparent" />
                  <span className="absolute top-2 left-2 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-black/60 text-white">{world.mode}{world.worldType === 'superflat' ? ' · flat' : world.worldType === 'oneblock' ? ' · oneblock' : ''}</span>
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

/** EggWars / Bridge Duels: play against bots now; real players are coming. */
function MinigamePicker({ kind, onPlay, onClose }: { kind: ArenaKind; onPlay: (d: BotDifficulty, size: MinigameSize) => void; onClose: () => void }) {
  const [diff, setDiff] = useState<BotDifficulty>('normal');
  const [size, setSize] = useState<MinigameSize>('solo');
  const sizeBlurb: Record<MinigameSize, string> = kind === 'eggwars'
    ? { solo: 'Every team is one player: you against 3 bots.', duos: 'Teams of 2: you and a bot teammate against three bot duos.', squads: 'Teams of 4: you and 3 bot teammates against three bot squads.' }
    : { solo: '1 v 1: you against one bot.', duos: '2 v 2: you and a bot teammate against two bots.', squads: '4 v 4: you and 3 bot teammates against four bots.' };
  const info = kind === 'eggwars'
    ? { title: 'EggWars', blurb: 'Four teams, four islands. Collect iron, gold and diamonds from the generators, buy gear at your shop, and break the other teams\' eggs. While your egg stands you come back after dying. Last team standing wins.' }
    : { title: 'Bridge Duels', blurb: 'Two islands over the void. Build a bridge across, fight your opponent, and jump into their goal hole. First to 5 goals wins.' };
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 vb-fade-in" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }} data-testid="minigame-picker">
      <div className="w-[480px] max-w-full rounded-2xl bg-[#0d131b] border border-[#243044] p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-3 mb-2">
          <h2 className="font-[var(--font-retro)] text-white text-lg tracking-wider">{info.title.toUpperCase()}</h2>
          <button onClick={onClose} className="text-[#8ea0b8] hover:text-white text-sm" aria-label="Close">✕</button>
        </div>
        <p className="text-[#8ea0b8] text-sm mb-5">{info.blurb}</p>
        <div className="rounded-xl border border-[#00e676]/40 bg-[#00e676]/5 p-4 mb-3">
          <div className="flex items-center gap-2 mb-1"><Swords className="w-4 h-4 text-[#00e676]" /><span className="text-white font-bold text-sm">Play against AI</span></div>
          <p className="text-[#5a6b80] text-xs mb-3">Computer players (bots) bridge, fight{kind === 'eggwars' ? ' and break eggs' : ' and go for your goal'}. Pick how tough they are:</p>
          <div className="grid grid-cols-3 gap-2 mb-1" data-testid="team-size">
            {(['solo', 'duos', 'squads'] as MinigameSize[]).map((z) => (
              <button key={z} onClick={() => setSize(z)} data-testid={`size-${z}`} className={`py-2 rounded-xl text-xs font-bold capitalize ${size === z ? 'bg-[#ffb300] text-[#0a0e14]' : 'bg-[#121822] border border-[#243044] text-[#8ea0b8] hover:text-white'}`}>{z}</button>
            ))}
          </div>
          <p className="text-[#5a6b80] text-[11px] mb-3" data-testid="size-blurb">{sizeBlurb[size]}</p>
          <div className="grid grid-cols-3 gap-2 mb-3">
            {(['easy', 'normal', 'hard'] as BotDifficulty[]).map((d) => (
              <button key={d} onClick={() => setDiff(d)} data-testid={`bots-${d}`} className={`py-2 rounded-xl text-xs font-bold capitalize ${diff === d ? 'bg-[#00e676] text-[#0a0e14]' : 'bg-[#121822] border border-[#243044] text-[#8ea0b8] hover:text-white'}`}>{d}</button>
            ))}
          </div>
          <button onClick={() => onPlay(diff, size)} data-testid="play-vs-ai" className="w-full py-3 rounded-xl bg-[#00e676] text-[#0a0e14] font-bold text-sm hover:brightness-110 active:scale-95 transition-all">Play vs AI</button>
        </div>
        <div className="rounded-xl border border-[#243044] bg-[#121822] p-4 opacity-70">
          <div className="flex items-center gap-2 mb-1"><Users className="w-4 h-4 text-[#8ea0b8]" /><span className="text-white font-bold text-sm">Play against players</span></div>
          <p className="text-[#5a6b80] text-xs mb-3">Real players from all over VibeBlox.</p>
          <button disabled data-testid="play-vs-players" className="w-full py-3 rounded-xl bg-[#1a2230] text-[#5a6b80] font-bold text-sm cursor-not-allowed">Coming soon</button>
        </div>
      </div>
    </div>
  );
}

function HomeView({ username, onPlaySurvival, savedWorlds, onPlayWorld, onCreatePreset, onMinigame, counts }: { username: string; onPlaySurvival: (activity?: Activity) => void; savedWorlds: any[]; onPlayWorld: (config: any) => void; onCreatePreset: (mode: WorldMode, worldType: WorldType) => void; onMinigame: (kind: ArenaKind, d: BotDifficulty, size: MinigameSize) => void; counts: Record<string, number> | null }) {
  useLanguage();
  const displayName = username.toUpperCase() || 'PLAYER';
  const [picker, setPicker] = useState<ArenaKind | null>(null);
  return (
    <div className="vb-fade-in">
      <header className="mb-8">
        <div className="vb-logo-wrapper inline-block mb-4 cursor-pointer">
          <img src="/images/logo.png" alt="VibeBlox" className="vb-logo-img w-12 h-12 rounded-xl" />
        </div>
        <h1 className="font-[var(--font-retro)] text-2xl text-white leading-relaxed tracking-wider">
          <span className="text-[#00e676]">{t('home.welcomeBack')}</span>, {displayName}!
        </h1>
        <p className="font-[var(--font-display)] text-[#5a6b80] mt-3 text-sm tracking-wide">
          {t('home.tagline')}
        </p>
      </header>

      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-[var(--font-display)] text-white text-lg tracking-wide flex items-center gap-2">
            <Trophy className="w-4 h-4 text-[#00e676]" />
            {t('home.topGames')}
          </h2>
          <button className="text-[#5a6b80] hover:text-[#00e676] text-xs font-medium transition-colors">
            {t('home.viewAll')}
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {games.map((game) => (
            <GameCardItem
              key={game.title}
              game={game}
              players={playersLabel(counts, game.activity)}
              onPlay={() => {
                // Survival / Creative / Superflat open Create World with that option picked
                if (game.title === 'Survival') onCreatePreset('survival', 'default');
                else if (game.title === 'Creative') onCreatePreset('creative', 'default');
                else if (game.title === 'Superflat') onCreatePreset('creative', 'superflat');
                else if (game.title === 'OneBlock') onCreatePreset('survival', 'oneblock');
                else if (game.title === 'EggWars') setPicker('eggwars');
                else if (game.title === 'Bridge Duels') setPicker('bridge');
                else onPlaySurvival(game.activity);
              }}
            />
          ))}
        </div>
      </section>
      {picker && <MinigamePicker kind={picker} onClose={() => setPicker(null)} onPlay={(d, z) => { const k = picker; setPicker(null); onMinigame(k, d, z); }} />}

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
  privacy?: WorldPrivacy; // who may join while you play it (public when not set)
  bans?: string[];        // players banned from this world
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
  const [privacy, setPrivacy] = useState<WorldPrivacy>('public');

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
      image: customImage ?? (selectedType === 'superflat' ? '/images/superflat-bg.jpg' : selectedType === 'oneblock' ? '/images/oneblock-bg.jpg' : currentMode.image),
      tag: currentMode.tag,
      accent: currentMode.accent,
      worldType: selectedType,
      seed: seedFromText(seedText),
      id: newWorldId(),
      difficulty: selectedMode === 'hardcore' ? 'hard' : difficulty,
      keepInventory: false,
      experimental,
      privacy,
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
                        onError={(e) => { e.currentTarget.style.visibility = 'hidden'; }}
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
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {([
                ['default', 'Default', 'Hills, biomes, caves, ores and trees'],
                ['superflat', 'Superflat', 'Completely flat grass, perfect for building'],
                ['oneblock', t('create.oneblock'), t('create.oneblockDesc')],
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
            {HOSTABLE_TYPES.includes(selectedType) && (
              <div className="mt-4" data-testid="create-privacy">
                <label className="text-[#8ea0b8] text-xs">Who can join while you play</label>
                <div className="grid grid-cols-2 gap-2 mt-1.5">
                  {PRIVACY_ORDER.map((p) => (
                    <button key={p} type="button" onClick={() => setPrivacy(p)} data-testid={`privacy-${p}`}
                      className={`rounded-xl px-3 py-2 text-left border transition-all ${privacy === p ? 'bg-[#00e676]/10 border-[#00e676]' : 'bg-[#0a0e14] border-[#243044] hover:border-[#3a4a60]'}`}>
                      <span className="block text-white text-xs font-medium">{PRIVACY_INFO[p].label}</span>
                      <span className="block text-[#5a6b80] text-[10px] mt-0.5 leading-snug">{PRIVACY_INFO[p].hint}</span>
                    </button>
                  ))}
                </div>
                <p className="text-[#364860] text-[10px] mt-1.5">You need to be signed in for others to join. You can change this any time in Manage Server.</p>
              </div>
            )}
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
                  onError={(e) => { e.currentTarget.style.visibility = 'hidden'; }}
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

/** Settings > Language: the most-spoken languages; menus and buttons switch right away. */
function LanguagePicker() {
  const lang = useLanguage();
  return (
    <section className="bg-[#121822] rounded-2xl border border-[#243044] p-6 mt-6" data-testid="language-section">
      <div className="mb-4">
        <label className="text-white text-sm font-medium">{t('settings.language')}</label>
        <p className="text-[#5a6b80] text-xs mt-0.5">{t('settings.languageDesc')}</p>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {LANGUAGES.map((l) => (
          <button
            key={l.code}
            data-testid={`lang-${l.code}`}
            onClick={() => setLanguage(l.code as LangCode)}
            title={l.english}
            className={`px-3 py-2.5 rounded-xl border text-sm font-medium text-left transition-all duration-200 hover:scale-[1.02] active:scale-95 ${
              lang === l.code ? 'bg-[#00e676]/15 border-[#00e676] text-[#00e676]' : 'bg-[#0a0e14] border-[#243044] text-[#8ea0b8] hover:border-[#364860] hover:text-white'
            }`}
          >
            {l.name}
          </button>
        ))}
      </div>
    </section>
  );
}

/** Settings > Controls: click an action, press the key you want (Esc cancels). A key that's taken swaps with the other action. */
function ControlsPanel() {
  useLanguage();
  const binds = useKeybinds();
  const [listening, setListening] = useState<KeyAction | null>(null);
  const [note, setNote] = useState<string | null>(null);
  useEffect(() => {
    setCapturingKey(!!listening);
    if (!listening) return;
    const onKey = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.code === 'Escape') { setListening(null); return; }
      const res = rebind(listening, e.code);
      if (!res.ok) { setNote(t('settings.keyReserved', { key: keyLabel(e.code) })); return; } // stay listening: try another key
      setNote(res.swapped ? t('settings.swapped', { key: keyLabel(e.code), action: t('key.' + res.swapped.action), old: keyLabel(res.swapped.now) }) : null);
      setListening(null);
    };
    // Capture phase on the window so the game and the Esc menu never see this key press
    window.addEventListener('keydown', onKey, true);
    return () => { window.removeEventListener('keydown', onKey, true); setCapturingKey(false); };
  }, [listening]);
  return (
    <section className="bg-[#121822] rounded-2xl border border-[#243044] p-6 mt-6" data-testid="controls-section">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <label className="text-white text-sm font-medium">{t('settings.controls')}</label>
          <p className="text-[#5a6b80] text-xs mt-0.5">{t('settings.controlsDesc')}</p>
        </div>
        <button onClick={() => { resetBinds(); setListening(null); setNote(null); }} data-testid="keys-reset"
          className="shrink-0 px-3 py-1.5 rounded-lg bg-[#0a0e14] border border-[#243044] text-[#8ea0b8] text-xs hover:text-white hover:border-[#364860] active:scale-95 transition-all">{t('settings.resetKeys')}</button>
      </div>
      <div className="flex flex-col gap-1.5">
        {KEY_ACTIONS.map((a) => (
          <button key={a} data-testid={`bind-${a}`} onClick={() => { setNote(null); setListening(listening === a ? null : a); }}
            className={`flex items-center justify-between px-4 py-2.5 rounded-xl border text-left transition-all duration-200 ${
              listening === a ? 'bg-[#00e676]/10 border-[#00e676]' : 'bg-[#0a0e14] border-[#243044] hover:border-[#364860]'
            }`}>
            <span className="text-white text-sm">{t('key.' + a)}</span>
            <span data-testid={`bind-${a}-key`} className={`min-w-[96px] text-center px-3 py-1 rounded-md text-xs font-bold ${listening === a ? 'bg-[#00e676] text-[#0a0e14] animate-pulse' : 'bg-[#1a2230] text-[#00e676]'}`}>
              {listening === a ? t('settings.pressKey') : keyLabel(binds[a])}
            </span>
          </button>
        ))}
      </div>
      {note && <p data-testid="bind-note" className="text-[#ffb347] text-xs mt-3">{note}</p>}
      <TouchSetting />
    </section>
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
  builtInTrack: SoundtrackStyle | null;
  isPlaying: boolean;
  volume: number;
  onTrackChange: (e: ChangeEvent<HTMLInputElement>) => void;
  onPlayBuiltIn: (style: SoundtrackStyle) => void;
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
  useLanguage();
  const [tab, setTab] = useState<'video' | 'audio' | 'controls' | 'hud' | 'language' | 'account' | 'about'>('video');
  const [showPrivacy, setShowPrivacy] = useState(false);
  const [showCredits, setShowCredits] = useState(false);
  const builtInTracks = SOUNDTRACKS;
  const nowPlaying = useSyncExternalStore(subscribeNowPlaying, getNowPlaying, getNowPlaying);
  const graphicsTiers: { value: GraphicsQuality; label: string; blurb: string }[] = [
    { value: 'low', label: t('gfx.low'), blurb: t('gfx.lowDesc') },
    { value: 'medium', label: t('gfx.medium'), blurb: t('gfx.mediumDesc') },
    { value: 'high', label: t('gfx.high'), blurb: t('gfx.highDesc') },
    { value: 'epic', label: t('gfx.epic'), blurb: t('gfx.epicDesc') },
    { value: 'max', label: t('gfx.max'), blurb: t('gfx.maxDesc') },
  ];

  const renderDistanceLabel =
    renderDistance <= 4 ? t('settings.rdLow') :
    renderDistance <= 8 ? t('settings.rdMid') :
    t('settings.rdHigh');
  // Green = light on your computer, orange = balanced, red = heavy
  const rdColor = renderDistance <= 4 ? '#00e676' : renderDistance <= 8 ? '#f59e0b' : '#ef4444';

  return (
    <div className="vb-fade-in max-w-4xl">
      {!compact && (
      <header className="mb-8">
        <div className="flex items-center gap-2 mb-2">
          <Settings className="w-5 h-5 text-[#00e676]" />
          <span className="font-[var(--font-retro)] text-[10px] text-[#00e676]">SETTINGS</span>
        </div>
        <h1 className="font-[var(--font-retro)] text-xl text-white leading-relaxed tracking-wider">
          {t('settings.title')}
        </h1>
      </header>
      )}

      <div className="flex gap-5" data-testid="settings-layout">
      <SideNav testid="settings-sidenav" active={tab} onSelect={setTab} tabs={[
        { id: 'video', label: 'Video' }, { id: 'audio', label: 'Audio' }, { id: 'controls', label: t('settings.controls') }, { id: 'hud', label: 'HUD' },
        { id: 'language', label: t('settings.language') }, { id: 'account', label: 'Account' }, { id: 'about', label: 'About' },
      ]} />
      <div className="flex-1 min-w-0 max-w-2xl vb-stack">
      {tab === 'video' && <>
      <section className="bg-[#121822] rounded-2xl border border-[#243044] p-6">
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <div>
              <label className="text-white text-sm font-medium">{t('settings.renderDistance')}</label>
              <p className="text-[#5a6b80] text-xs mt-0.5">{t('settings.renderDistanceDesc')}</p>
            </div>
            <div className="bg-[#00e676]/15 border border-[#00e676]/30 rounded-lg px-3 py-1.5">
              <span className="font-[var(--font-display)] text-[#00e676] text-lg">{renderDistance}</span>
              <span className="text-[#5a6b80] text-xs ml-1">{t('settings.chunks')}</span>
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
              <label className="text-white text-sm font-medium">{t('settings.fov')}</label>
              <p className="text-[#5a6b80] text-xs mt-0.5">{t('settings.fovDesc')}</p>
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
          <label className="text-white text-sm font-medium">{t('settings.graphics')}</label>
          <p className="text-[#5a6b80] text-xs mt-0.5">{t('settings.graphicsDesc')}</p>
        </div>
        <div className="grid grid-cols-5 gap-2">
          {graphicsTiers.map((tier) => {
            const active = graphicsQuality === tier.value;
            return (
              <button
                key={tier.value}
                data-testid={`gfx-${tier.value}`}
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
          <label className="text-white text-sm font-medium">{t('settings.textures')}</label>
          <p className="text-[#5a6b80] text-xs mt-0.5">{t('settings.texturesDesc')}</p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {([
            { value: 16 as TextureRes, label: '16×16', name: t('tex.classic'), blurb: t('tex.classicDesc') },
            { value: 32 as TextureRes, label: '32×32', name: t('tex.detailed'), blurb: t('tex.detailedDesc') },
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

      <VideoOptions />
      </>}
      {tab === 'language' && <LanguagePicker />}
      {tab === 'controls' && <ControlsPanel />}
      {tab === 'account' && <AccountTab />}

      {tab === 'audio' && <>
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

      </>}
      {tab === 'hud' && <section className="bg-[#121822] rounded-2xl border border-[#243044] p-6 mt-6">
        <div className="flex items-center gap-2 mb-1">
          <BarChart3 className="w-4 h-4 text-[#00e676]" />
          <h2 className="text-white text-sm font-medium">HUD Overlays</h2>
        </div>
        <p className="text-[#5a6b80] text-xs mb-4">Extra info on screen while you play. Press F3 in game for the full debug screen (coordinates, direction and more).</p>
        <div className="flex flex-col gap-2" data-testid="hud-options">
          {([
            ['keystrokes', 'Keystrokes', 'Your movement keys, mouse buttons and jump key light up as you press them'],
            ['cps', 'CPS', 'Clicks per second for left and right mouse'],
            ['fps', 'FPS', 'Frames per second'],
            ['ping', 'Ping', 'How long the server takes to answer (on a multiplayer server)'],
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
      </section>}

      {tab === 'audio' && <>
      <section className="bg-[#121822] rounded-2xl border border-[#243044] p-6 mt-6">
        <div className="flex items-center gap-2 mb-1">
          <Music className="w-4 h-4 text-[#00e676]" />
          <h2 className="text-white text-sm font-medium">Soundtrack</h2>
        </div>
        <p className="text-[#5a6b80] text-xs mb-4">Pick a soundtrack (a playlist of several tracks that play one after another), or upload your own. It keeps playing while you browse or play.</p>

        <div className="grid grid-cols-4 gap-2 mb-4" data-testid="soundtracks">
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
            {trackName ?? (builtInTrack ? `${builtInTracks.find((t) => t.value === builtInTrack)?.label}${nowPlaying ? ': ' + nowPlaying : ''}` : 'No track selected')}
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
      </>}

      {tab === 'about' && <section className="bg-[#121822] rounded-2xl border border-[#243044] p-6 mt-6">
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
      </section>}
      </div>
      </div>
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
  useEffect(() => { if (ref.current) drawLookPreview(ref.current, look, view); }, [look.skin, look.cape, look.custom, view]);
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
function NewsView() {
  useLanguage();
  return (
    <div className="py-2" data-testid="news-view">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-end justify-between mb-6">
          <h1 className="font-[var(--font-retro)] text-white text-3xl">{t('news.title')}</h1>
          <span className="text-[#5a6b80] text-sm">You are on version {GAME_VERSION}</span>
        </div>
        <div className="flex flex-col gap-4">
          {NEWS.map((n, i) => (
            <article key={n.version} className="bg-[#111923] border border-[#243044] rounded-xl p-5" data-testid={`news-${n.version}`}>
              <div className="flex items-center gap-3 mb-1">
                <span className="px-2 py-0.5 rounded-md bg-[#00e676] text-[#0a0e14] text-xs font-bold">v{n.version}</span>
                {i === 0 && <span className="px-2 py-0.5 rounded-md bg-[#ffb300] text-[#0a0e14] text-[10px] font-bold">LATEST</span>}
                <span className="text-[#5a6b80] text-xs">{n.date}</span>
              </div>
              <h2 className="text-white text-lg font-bold mb-2">{n.title}</h2>
              <ul className="list-disc pl-5 text-[#b8c4d4] text-sm leading-6">
                {n.changes.map((c) => <li key={c}>{c}</li>)}
              </ul>
            </article>
          ))}
        </div>
      </div>
    </div>
  );
}

function ShopView({ compact = false }: { compact?: boolean }) {
  const p = useProgress();
  const [tab, setTab] = useState<'ranks' | 'cosmetics'>(CAN_SELL_RANKS ? 'ranks' : 'cosmetics');
  const [sub, setSub] = useState<'skins' | 'capes'>('skins');
  const [adBusy, setAdBusy] = useState<null | 'coins' | 'booster'>(null);
  const [adsOk, setAdsOk] = useState<boolean>(false);
  const [note, setNote] = useState<string | null>(null);
  const { rank: adRank, isOwner: adOwner } = useContext(StandingContext);
  const adsFree = !adsAllowedFor(adRank, adOwner); // a rank means no ads, ever: the rewards are simply handed over
  useEffect(() => { if (ADS_POSSIBLE && !adsFree) void initAds().then(setAdsOk); }, [adsFree]);
  useEffect(() => { if (!note) return; const t = setTimeout(() => setNote(null), 3500); return () => clearTimeout(t); }, [note]);

  const curXp = xpForLevel(p.level), nextXp = xpForLevel(p.level + 1);
  const pct = Math.max(0, Math.min(1, (p.xp - curXp) / (nextXp - curXp)));
  const boosted = p.boosterSeconds > 0;
  const untilXp = (SECONDS_PER_PERIOD - p.activeSeconds) / (boosted ? 2 : 1);

  async function watch(kind: 'coins' | 'booster') {
    setAdBusy(kind);
    const ok = adsFree || await triggerRewardedAd({
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

  const look: PlayerLook = currentLook();
  const { rank: shopRank, signedIn: shopSignedIn } = useContext(StandingContext);
  const mayUpload = canUploadSkin(shopRank);
  const fileRef = useRef<HTMLInputElement>(null);
  /** Reads a skin PNG (64x64 or 64x32), re-encodes it small, and wears it. */
  async function uploadSkin(file: File | undefined) {
    if (!file) return;
    if (!/^image\/png$/.test(file.type) && !/\.png$/i.test(file.name)) { setNote('Pick a PNG skin file (64x64 or 64x32).'); return; }
    if (file.size > 300_000) { setNote('That file is too big for a skin.'); return; }
    const url = URL.createObjectURL(file);
    try {
      const img = await new Promise<HTMLImageElement>((resolve, reject) => { const im = new Image(); im.onload = () => resolve(im); im.onerror = () => reject(new Error('bad image')); im.src = url; });
      if (img.width !== 64 || (img.height !== 64 && img.height !== 32)) { setNote(`Skins are 64x64 or 64x32 pixels (yours is ${img.width}x${img.height}).`); return; }
      const c = document.createElement('canvas');
      c.width = 64; c.height = 64;
      const ctx = c.getContext('2d');
      if (!ctx) { setNote("This browser can't read the picture."); return; }
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(img, 0, 0);
      const data = c.toDataURL('image/png');
      if (!isCustomSkinData(data)) { setNote('That skin is too detailed to share with other players. Try a simpler one.'); return; }
      setCustomSkin(data);
      setNote('Your skin is on! Other players see it too.');
    } catch {
      setNote("Couldn't read that picture.");
    } finally {
      URL.revokeObjectURL(url);
      if (fileRef.current) fileRef.current.value = '';
    }
  }
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
              disabled={(!adsOk && !adsFree) || adBusy !== null}
              onClick={() => watch('coins')}
              className="flex items-center justify-center gap-2 rounded-xl py-3 font-bold text-sm bg-gradient-to-r from-[#ffd23a] to-[#ff9a1a] text-[#0a0e14] transition-all duration-200 hover:scale-[1.02] active:scale-95 disabled:opacity-40 disabled:hover:scale-100"
            >
              <Tv className="w-4 h-4" />{adBusy === 'coins' ? 'Playing ad…' : adsFree ? `Claim ${AD_COINS} Coins` : `Watch Ad for ${AD_COINS} Coins`}
            </button>
            <button
              disabled={(!adsOk && !adsFree) || adBusy !== null}
              onClick={() => watch('booster')}
              className="flex items-center justify-center gap-2 rounded-xl py-3 font-bold text-sm bg-gradient-to-r from-[#00e5ff] to-[#7c4dff] text-[#0a0e14] transition-all duration-200 hover:scale-[1.02] active:scale-95 disabled:opacity-40 disabled:hover:scale-100"
            >
              <Sparkles className="w-4 h-4" />{adBusy === 'booster' ? 'Playing ad…' : adsFree ? 'Claim a 2x XP Playtime Booster' : 'Watch Ad for a 2x XP Playtime Booster'}
            </button>
          </div>
          {adsFree && <p className="-mt-3 mb-5 text-[#5a6b80] text-xs" data-testid="no-ads-note">You have a rank, so you never see ads. The rewards are yours without watching one.</p>}
          {!adsOk && !adsFree && <p className="-mt-3 mb-5 text-[#5a6b80] text-xs">{ADS_POSSIBLE ? 'No ads are available right now. Try again in a moment.' : 'Ads are available when you play VibeBlox on CrazyGames or Poki. Here you earn coins by levelling up.'}</p>}

          <div className="flex gap-2 mb-4">
            <button className={tabBtn(sub === 'skins')} onClick={() => setSub('skins')}>Skins / Characters</button>
            <button className={tabBtn(sub === 'capes')} onClick={() => setSub('capes')}>Capes</button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {sub === 'skins' && (
              <div data-testid="custom-skin-card" className={`rounded-2xl border p-3 flex flex-col items-center gap-2 bg-[#121822] ${p.currentSkin === CUSTOM_SKIN_ID ? 'border-[#00e676]' : 'border-[#ffd23a]/40'}`}>
                <div className="h-[120px] flex items-center">
                  <LookPicture look={p.customSkin ? { skin: CUSTOM_SKIN_ID, cape: 'none', custom: p.customSkin } : { skin: 'classic', cape: 'none' }} view="front" />
                </div>
                <div className="text-white text-sm font-bold text-center flex items-center gap-1"><Crown className="w-3.5 h-3.5 text-[#ffd700]" />Your own skin</div>
                {mayUpload ? (
                  <>
                    <input ref={fileRef} data-testid="skin-file" type="file" accept="image/png" className="hidden" onChange={(e) => { void uploadSkin(e.target.files?.[0]); }} />
                    <div className="flex gap-1.5 w-full">
                      <button data-testid="skin-upload" onClick={() => fileRef.current?.click()} className="flex-1 rounded-lg py-1.5 text-xs font-bold bg-[#ffd23a] text-[#0a0e14] hover:scale-[1.03] transition-all active:scale-95">{p.customSkin ? 'Replace' : 'Upload PNG'}</button>
                      {p.customSkin && (p.currentSkin === CUSTOM_SKIN_ID
                        ? <button onClick={() => { setCustomSkin(null); }} className="rounded-lg px-2 py-1.5 text-xs bg-[#1a2230] text-[#8ea0b8] hover:text-white">Remove</button>
                        : <button onClick={() => { equipCosmetic('skin', CUSTOM_SKIN_ID); }} className="rounded-lg px-2 py-1.5 text-xs bg-[#1a2230] text-white hover:bg-[#243044]">Wear</button>)}
                    </div>
                  </>
                ) : (
                  <div className="w-full rounded-lg py-1.5 text-[11px] text-center bg-[#1a2230] text-[#8ea0b8]" data-testid="skin-locked">{shopSignedIn ? 'Champion rank only' : 'Sign in with a Champion account'}</div>
                )}
              </div>
            )}
            {(sub === 'skins' ? Object.entries(SKINS) : Object.entries(CAPES)).map(([id, def]) => {
              const kind = sub === 'skins' ? 'skin' : 'cape';
              const owned = kind === 'skin' ? p.ownedSkins.includes(id) : p.ownedCapes.includes(id);
              const equipped = kind === 'skin' ? p.currentSkin === id : p.currentCape === id;
              const afford = p.coins >= def.price;
              return (
                <div key={id} className={`rounded-2xl border p-3 flex flex-col items-center gap-2 bg-[#121822] ${equipped ? 'border-[#00e676]' : 'border-[#243044]'}`}>
                  <div className="h-[120px] flex items-center">
                    <LookPicture look={kind === 'skin' ? { skin: id, cape: 'none' } : { ...look, cape: id }} view={kind === 'skin' ? 'front' : 'back'} />
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
  onMinigame,
  playingCounts,
}: {
  socialView?: ReactNode;
  onMinigame: (kind: ArenaKind, d: BotDifficulty, size: MinigameSize) => void;
  playingCounts: Record<string, number> | null;
  username: string;
  view: View;
  onPlaySurvival: (activity?: Activity) => void;
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
  onJoinServer: (address?: string, hostName?: string) => void;
  netStatus: NetStatus;
  netError: string | null;
  trackName: string | null;
  builtInTrack: SoundtrackStyle | null;
  isPlaying: boolean;
  volume: number;
  onTrackChange: (e: ChangeEvent<HTMLInputElement>) => void;
  onPlayBuiltIn: (style: SoundtrackStyle) => void;
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
        {view === 'home' && <HomeView username={username} onPlaySurvival={onPlaySurvival} savedWorlds={savedWorlds} onPlayWorld={onPlayWorld} onCreatePreset={onCreatePreset} onMinigame={onMinigame} counts={playingCounts} />}
        {view === 'shop' && <ShopView />}
        {view === 'news' && <NewsView />}
        {view === 'leaderboard' && <LeaderboardView username={username} />}
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

/** Settings > Controls: on-screen touch controls (Auto turns them on for phones and tablets). */
function TouchSetting() {
  const [pref, setPref] = useState<TouchPref>(loadTouchPref);
  const pick = (v: TouchPref) => { setPref(v); saveTouchPref(v); window.dispatchEvent(new CustomEvent('vb-touch', { detail: v })); };
  return (
    <div className="mt-5" data-testid="touch-setting">
      <p className="text-white text-sm font-medium">Touch controls</p>
      <p className="text-[#5a6b80] text-xs mt-0.5 mb-2">A joystick and buttons on screen, for phones and tablets. Auto turns them on when there's no mouse.</p>
      <div className="grid grid-cols-3 gap-2">
        {(['auto', 'on', 'off'] as TouchPref[]).map((v) => (
          <button key={v} onClick={() => pick(v)} data-testid={`touch-${v}`}
            className={`py-2 rounded-xl text-xs font-bold capitalize ${pref === v ? 'bg-[#00e676] text-[#0a0e14]' : 'bg-[#0a0e14] border border-[#243044] text-[#8ea0b8] hover:text-white'}`}>{v}</button>
        ))}
      </div>
      <button onClick={() => { try { localStorage.removeItem('vb-tutorial-done'); } catch { /* blocked */ } window.dispatchEvent(new CustomEvent('vb-tutorial-reset')); }} data-testid="tutorial-again"
        className="mt-3 text-[#00e676] text-xs hover:underline">Show the tutorial again next time I play</button>
    </div>
  );
}

/** Your rank, whether you are a Rising Creator, and your plays: provided by App, read by the shop and the panels. */
const StandingContext = createContext<{ rank: RankId; rising: boolean; tier: CreatorTier; isOwner: boolean; standing: Standing | null; signedIn: boolean }>({ rank: 'none', rising: false, tier: 'none', isOwner: false, standing: null, signedIn: false });

/** The creators with the most plays; refreshes once a minute while it is on screen. */
function useLeaderboard(limit: number): LeaderRow[] | null {
  const [rows, setRows] = useState<LeaderRow[] | null>(null);
  useEffect(() => {
    let alive = true;
    const load = () => { void fetchLeaderboard(limit).then((r) => { if (alive && r) setRows(r); }); };
    load();
    const timer = window.setInterval(load, 60_000);
    return () => { alive = false; window.clearInterval(timer); };
  }, [limit]);
  return rows;
}

function RisingBadge({ small = false }: { small?: boolean }) {
  return (
    <span data-testid="rising-badge" className={`inline-flex items-center gap-1 rounded-full bg-[#ffd23a]/15 text-[#ffd23a] font-bold ${small ? 'px-1.5 py-0.5 text-[9px]' : 'px-2.5 py-1 text-xs'}`}>
      <Sparkles className={small ? 'w-2.5 h-2.5' : 'w-3.5 h-3.5'} />{t('lb.rising')}
    </span>
  );
}

/** Rising / Popular / Star Creator, by plays. */
function TierBadge({ tier, small = false }: { tier: CreatorTier; small?: boolean }) {
  if (tier === 'none') return null;
  if (tier === 'rising') return <RisingBadge small={small} />;
  const star = tier === 'star';
  return (
    <span data-testid={`${tier}-badge`} className={`inline-flex items-center gap-1 rounded-full font-bold ${star ? 'bg-[#ff5fd2]/15 text-[#ff8be6]' : 'bg-[#ff9a1a]/15 text-[#ffb347]'} ${small ? 'px-1.5 py-0.5 text-[9px]' : 'px-2.5 py-1 text-xs'}`}>
      {star ? <Star className={small ? 'w-2.5 h-2.5 fill-current' : 'w-3.5 h-3.5 fill-current'} /> : <Sparkles className={small ? 'w-2.5 h-2.5' : 'w-3.5 h-3.5'} />}{CREATOR_NAMES[tier]}
    </span>
  );
}
const NEXT_TIER: Record<CreatorTier, CreatorTier | null> = { none: 'rising', rising: 'popular', popular: 'star', star: null };

function LeaderboardView({ username }: { username: string }) {
  useLanguage();
  const rows = useLeaderboard(50);
  const { standing, rising, tier, signedIn } = useContext(StandingContext);
  const plays = standing?.plays ?? 0;
  const next = NEXT_TIER[tier];
  const prevPlays = tier === 'none' ? 0 : CREATOR_PLAYS[tier];
  const pct = next ? Math.min(100, ((plays - prevPlays) / (CREATOR_PLAYS[next] - prevPlays)) * 100) : 100;
  return (
    <div className="vb-fade-in max-w-3xl" data-testid="leaderboard-view">
      <header className="mb-5">
        <div className="flex items-center gap-2 mb-2"><Trophy className="w-5 h-5 text-[#ffd23a]" /><span className="font-[var(--font-retro)] text-[10px] text-[#ffd23a]">{t('nav.leaderboard').toUpperCase()}</span></div>
        <h1 className="font-[var(--font-retro)] text-xl text-white leading-relaxed tracking-wider">{t('lb.title').toUpperCase()}</h1>
        <p className="text-[#8ea0b8] text-sm mt-1">{t('lb.sub')}. A play is another player joining a game you host (one per player per day).</p>
      </header>

      {signedIn && (
        <div className="mb-5 rounded-2xl bg-[#121822] border border-[#243044] p-4" data-testid="my-standing">
          <div className="flex items-center justify-between mb-2 gap-3">
            <span className="text-white font-bold">{username}</span>
            {rising ? <TierBadge tier={tier} /> : null}
            {next ? <span className="text-[#8ea0b8] text-xs" data-testid="next-tier">{plays.toLocaleString()} / {CREATOR_PLAYS[next].toLocaleString()} {t('lb.plays', { n: '' }).trim()} → {CREATOR_NAMES[next]}</span> : null}
          </div>
          <div className="h-2.5 rounded-full bg-[#0a0e14] overflow-hidden"><div className="h-full bg-gradient-to-r from-[#ffd23a] to-[#ff9a1a]" style={{ width: `${pct}%` }} /></div>
          <p className="text-[#5a6b80] text-xs mt-2">{CREATOR_NAMES.rising} (1,000 plays): {PLAYER_CAP.rising} players in your world instead of {PLAYER_CAP.none}, and a bigger script CPU budget. {CREATOR_NAMES.popular} (10,000): {PLAYER_CAP.popular} players. {CREATOR_NAMES.star} (100,000): {PLAYER_CAP.star} players. Each tier gets a tag in front of your name in chat.</p>
        </div>
      )}

      <div className="rounded-2xl bg-[#121822] border border-[#243044] overflow-hidden">
        {rows === null && <div className="p-6 text-center text-[#5a6b80] text-sm">…</div>}
        {rows !== null && rows.length === 0 && <div className="p-6 text-center text-[#5a6b80] text-sm">{t('lb.empty')}</div>}
        {rows?.map((r, i) => (
          <div key={r.username} data-testid="lb-row" className={`flex items-center gap-3 px-4 py-2.5 border-b border-[#1a2230] last:border-0 ${r.username.toLowerCase() === username.toLowerCase() ? 'bg-[#00e676]/10' : ''}`}>
            <span className={`w-7 text-center font-[var(--font-display)] ${i === 0 ? 'text-[#ffd23a]' : i === 1 ? 'text-[#cfd8e3]' : i === 2 ? 'text-[#e8a87c]' : 'text-[#5a6b80]'}`}>{i + 1}</span>
            <span className="text-white text-sm font-semibold truncate flex-1">{r.username}</span>
            <TierBadge tier={creatorTier(r.plays)} small />
            <span className="text-[#8ea0b8] text-sm tabular-nums">{t('lb.plays', { n: r.plays.toLocaleString() })}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ProfilePanel({ username, onPlayNow, onOpenLeaderboard }: { username: string; onPlayNow: () => void; onOpenLeaderboard: () => void }) {
  useLanguage();
  const p = useProgress();
  const { rising, tier, signedIn } = useContext(StandingContext);
  const top = useLeaderboard(5);
  const displayName = username || 'PlayerOne';
  const initial = username ? username.charAt(0).toUpperCase() : 'P';
  const curXp = xpForLevel(p.level), nextXp = xpForLevel(p.level + 1);
  const pct = Math.max(0, Math.min(100, ((p.xp - curXp) / (nextXp - curXp)) * 100));
  return (
    <aside className="w-[280px] shrink-0 bg-[#0d131b] border-l border-[#243044] flex flex-col p-5 gap-5 overflow-y-auto">
      <div className="bg-[#121822] rounded-2xl border border-[#243044] p-4">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#3b5998] to-[#00e676] ring-2 ring-[#243044] flex items-center justify-center text-white font-[var(--font-display)] text-xl">
            {initial}
          </div>
          <div className="min-w-0">
            <p className="font-[var(--font-display)] text-white text-sm truncate max-w-[160px]">{displayName}</p>
            <p className="text-[#5a6b80] text-xs">{signedIn ? 'Online' : 'Guest'}</p>
            {rising && <div className="mt-1"><TierBadge tier={tier} small /></div>}
          </div>
        </div>
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[#8ea0b8] text-xs font-medium" data-testid="panel-level">{t('profile.level', { n: p.level })}</span>
            <span className="text-[#5a6b80] text-xs">{(p.xp - curXp).toLocaleString()} / {(nextXp - curXp).toLocaleString()} XP</span>
          </div>
          <div className="h-2 bg-[#0a0e14] rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-[#00e676] to-[#00b248] rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
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
          <span className="text-[#8ea0b8] text-xs">{t('profile.coins')}</span>
          <span data-testid="panel-coins" className="font-[var(--font-display)] text-[#ffd700] text-lg tabular-nums">{p.coins.toLocaleString()}</span>
        </div>
      </div>

      <div className="bg-[#121822] rounded-2xl border border-[#243044] p-4" data-testid="lb-card">
        <h3 className="font-[var(--font-display)] text-white text-sm tracking-wide mb-3 flex items-center gap-2">
          <Trophy className="w-4 h-4 text-[#ffd23a]" /> {t('lb.title').toUpperCase()}
        </h3>
        {top === null && <p className="text-[#5a6b80] text-xs">…</p>}
        {top !== null && top.length === 0 && <p className="text-[#5a6b80] text-xs">{t('lb.empty')}</p>}
        <ol className="space-y-1.5">
          {top?.map((r, i) => (
            <li key={r.username} className="flex items-center gap-2 text-xs">
              <span className={`w-4 text-center font-bold ${i === 0 ? 'text-[#ffd23a]' : 'text-[#5a6b80]'}`}>{i + 1}</span>
              <span className="text-white truncate flex-1">{r.username}</span>
              <span className="text-[#8ea0b8] tabular-nums">{r.plays.toLocaleString()}</span>
            </li>
          ))}
        </ol>
        <button onClick={onOpenLeaderboard} data-testid="lb-see-all" className="mt-3 w-full py-1.5 rounded-lg bg-[#1a2230] text-[#8ea0b8] text-xs font-bold hover:text-white hover:bg-[#243044] transition-colors">{t('lb.seeAll')}</button>
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

function GameHUD({ inventory, offhand, armor, health, hunger, selectedSlot, mode, xp, air = 10, blighted = false, onPick }: {
  /** touch screens: tap a hotbar slot to hold it */
  onPick?: (slot: number) => void;
  xp: { level: number; progress: number };
  /** Breath bubbles (0-10), shown only when some are used up. */
  air?: number;
  /** Blight darkens your hearts. */
  blighted?: boolean;
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
    <div className={`absolute bottom-4 left-1/2 -translate-x-1/2 ${onPick ? 'z-[27]' : 'z-20'} flex flex-col items-center gap-1.5 pointer-events-none`}>
      <div
        className={`text-white text-sm font-bold h-5 transition-opacity duration-500 drop-shadow-[0_2px_0_rgba(0,0,0,0.8)] ${
          nameVisible ? 'opacity-100' : 'opacity-0'
        }`}
      >
        {inventory[selectedSlot] ? (inventory[selectedSlot]!.name ? <FancyText text={inventory[selectedSlot]!.name!} /> : itemDisplayName(inventory[selectedSlot]!)) : ''}
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
      {air < 10 && (mode === 'survival' || mode === 'adventure') && (
        <div className="flex gap-0.5 self-end px-0.5" data-testid="air-bubbles" title="Breath">
          {Array.from({ length: 10 }, (_, i) => (
            <span key={i} className={`w-3.5 h-3.5 rounded-full border ${i < air ? 'bg-[#9fd8ff] border-[#d8f2ff] shadow-[inset_-2px_-2px_0_rgba(40,90,160,0.6)]' : 'border-transparent'}`} />
          ))}
        </div>
      )}
      <div className={`flex items-center justify-between w-full px-0.5 ${mode === 'survival' || mode === 'adventure' ? '' : 'invisible'}`}>
        <div className="flex gap-0.5" data-testid="hearts" data-blight={blighted ? '1' : '0'}>
          {pips(health).map((state, i) => (
            <Heart
              key={i}
              className={`w-4 h-4 transition-colors duration-300 ${
                state === 'empty' ? 'text-white/20 fill-white/10' : blighted ? 'text-[#3d2f40] fill-[#3d2f40]' : 'text-red-500 fill-red-500'
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
              data-testid="hotbar-slot" data-selected={isSelected ? 'true' : 'false'}
              onPointerDown={onPick ? (e) => { e.preventDefault(); onPick(i); } : undefined}
              className={`${onPick ? 'pointer-events-auto ' : ''}w-11 h-11 flex items-center justify-center relative transition-all duration-150 ${
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
      <div className={`text-sm ${st.name ? 'italic text-[#55ffff]' : st.ench ? 'text-[#55ffff]' : 'text-white'}`}>{st.name ? <FancyText text={st.name} /> : itemDisplayName(st)}</div>
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

function ManageServerView({ settings, hardcore, online, isHost, players, myId, hostId, weather, onChange, onKick, onBan, onTime, onWeather, tagOf, privacy }: {
  tagOf?: (name: string) => string;
  /** Your own world: who may join it (null when this isn't a world you can open to others). */
  privacy?: { value: WorldPrivacy; open: boolean; players: number; signedIn: boolean; onChange: (p: WorldPrivacy) => void } | null;
  settings: ServerSettings; hardcore: boolean; online: boolean; isHost: boolean;
  players: Array<{ id: number; name: string }>; myId: number | null; hostId: number | null; weather: WeatherKind;
  onChange: (s: Partial<ServerSettings>) => void; onKick: (id: number) => void; onBan: (id: number) => void;
  onTime: (t: number) => void; onWeather: (k: WeatherKind) => void;
}) {
  const [confirmBan, setConfirmBan] = useState<number | null>(null);
  const [tab, setTab] = useState<'world' | 'rules' | 'players' | 'schematics'>('world');
  const toggle = (key: 'keepInventory' | 'scripts' | 'mods' | 'commands', label: string, hint: string) => (
    <button disabled={!isHost} onClick={() => onChange({ [key]: !settings[key] })} data-testid={`toggle-${key}`}
      className="flex items-center justify-between gap-3 w-full rounded-xl bg-[#121822] border border-[#243044] px-4 py-3 text-left disabled:opacity-60">
      <span><span className="block text-white text-sm">{label}</span><span className="block text-[#5a6b80] text-[11px]">{hint}</span></span>
      <span className={`w-11 h-6 rounded-full p-0.5 transition-colors ${settings[key] ? 'bg-[#00e676]' : 'bg-[#2a3444]'}`}><span className={`block w-5 h-5 rounded-full bg-white transition-transform ${settings[key] ? 'translate-x-5' : ''}`} /></span>
    </button>
  );
  return (
    <div className="flex gap-5" data-testid="manage-server">
     <SideNav tabs={[{ id: 'world', label: 'World' }, { id: 'rules', label: 'Rules' }, { id: 'players', label: 'Players' }, { id: 'schematics', label: 'Schematics' }]} active={tab} onSelect={setTab} testid="manage-sidenav" />
     <div className="flex-1 min-w-0 flex flex-col gap-4">
      {!isHost && <p className="text-[#ffb347] text-xs">Only the host can change these.</p>}
      {tab === 'world' && <>
      {privacy && (
        <div data-testid="manage-privacy">
          <p className="text-[#8ea0b8] text-xs mb-1.5">Who can join</p>
          <div className="grid grid-cols-4 gap-2">
            {PRIVACY_ORDER.map((p) => (
              <button key={p} onClick={() => privacy.onChange(p)} data-testid={`manage-privacy-${p}`} title={PRIVACY_INFO[p].hint}
                className={`py-2 rounded-xl text-xs font-bold ${privacy.value === p ? 'bg-[#00e676] text-[#0a0e14]' : 'bg-[#121822] border border-[#243044] text-[#8ea0b8] hover:text-white'}`}>{PRIVACY_INFO[p].label}</button>
            ))}
          </div>
          <p className="text-[10px] mt-1.5" data-testid="manage-privacy-status">
            {privacy.value === 'private' ? <span className="text-[#5a6b80]">Only you. Nobody else can see or join this world.</span>
              : !privacy.signedIn ? <span className="text-[#ffb347]">Sign in so other players can join your world.</span>
              : privacy.open ? <span className="text-[#7cfc7c]">Open: {privacy.players} {privacy.players === 1 ? 'player' : 'players'} here. {PRIVACY_INFO[privacy.value].hint}.</span>
              : <span className="text-[#ffb347]">Opening your world…</span>}
          </p>
        </div>
      )}
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
          {(() => {
            // One button: each click changes the weather once (it still changes by itself later on)
            const i = Math.max(0, WEATHER_OPTIONS.findIndex((w) => w.kind === weather));
            const next = WEATHER_OPTIONS[(i + 1) % WEATHER_OPTIONS.length];
            return (
              <button disabled={!isHost} onClick={() => onWeather(next.kind)} data-testid="server-weather"
                className="w-full py-2 rounded-xl text-xs font-bold bg-[#121822] border border-[#243044] text-white hover:border-[#00e676]/50 active:scale-95 transition-all disabled:cursor-not-allowed disabled:opacity-60">
                Now: {WEATHER_OPTIONS[i]?.label ?? weather} · click for {next.label.toLowerCase()}
              </button>
            );
          })()}
          <p className="text-[#5a6b80] text-[10px] mt-1">Changes the weather right now. It still changes by itself over time. Rain is snow in cold biomes.</p>
        </div>
      </div>
      </>}
      {tab === 'rules' && <div className="grid grid-cols-2 gap-2">
        {toggle('keepInventory', 'Keep inventory', 'Keep your items when you die')}
        {toggle('commands', 'Allow commands', 'Chat commands like /give and /tp')}
        {toggle('scripts', 'Allow scripts', 'Off hides the Scripts button')}
        {toggle('mods', 'Allow mods', 'Off hides the Mods button')}
      </div>}
      {tab === 'schematics' && (
        <div>
          <p className="text-[#8ea0b8] text-xs mb-2">Upload schematic files (.vbschem) here. Everyone building in this world finds them on the Schematics page of the game menu.</p>
          <SchematicUpload />
        </div>
      )}
      {tab === 'players' && <div>
        <p className="text-[#8ea0b8] text-xs mb-1.5">Players</p>
        {!online ? (
          <p className="text-[#5a6b80] text-xs rounded-xl bg-[#121822] border border-[#243044] px-4 py-3">Just you. Kick and ban are for multiplayer servers.</p>
        ) : (
          <div className="flex flex-col gap-1.5" data-testid="player-list">
            {players.map((pl) => (
              <div key={pl.id} className="flex items-center gap-2 rounded-xl bg-[#121822] border border-[#243044] px-4 py-2">
                <span className="text-white text-sm flex-1 truncate" data-testid="manage-player">{tagOf && tagOf(pl.name) ? <FancyText text={tagOf(pl.name)} /> : null}{pl.name}{pl.id === myId ? ' (you)' : ''}{pl.id === hostId ? ' · host' : ''}</span>
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
      </div>}
     </div>
    </div>
  );
}

/** The EggWars item shop: a Quick Buy grid with category tabs (Blocks, Weapons, Armor, Tools, Ranged, Utility). */
const SHOP_TABS: Array<{ name: string; icon: number }> = [
  { name: 'Quick Buy', icon: ITEM_ENDER_PEARL }, { name: 'Blocks', icon: BLOCK_GLASS }, { name: 'Weapons', icon: ITEM_IRON_SWORD },
  { name: 'Armor', icon: armorId('iron', 3) }, { name: 'Tools', icon: ITEM_IRON_PICKAXE }, { name: 'Ranged', icon: ITEM_BOW }, { name: 'Utility', icon: BLOCK_TNT },
];
const shopTabLabel = (name: string) => t('shop.' + (name === 'Quick Buy' ? 'quickBuy' : name.toLowerCase()));
function ItemShop({ trade, inventory, note, onTrade, onClose }: {
  trade: { id: number; profession: string; trades: Trade[] };
  inventory: Slots; note: string | null; onTrade: (index: number) => void; onClose: () => void;
}) {
  useLanguage();
  const [tab, setTab] = useState('Quick Buy');
  const items = trade.trades.map((t, i) => ({ t, i })).filter(({ t }) => (tab === 'Quick Buy' ? t.quick : t.cat === tab));
  const currency: Record<number, { label: string; color: string }> = {
    [ITEM_IRON_INGOT]: { label: 'Iron', color: '#d8d8d8' }, [ITEM_GOLD_INGOT]: { label: 'Gold', color: '#ffd54a' }, [ITEM_DIAMOND]: { label: 'Diamond', color: '#5ff0ff' },
  };
  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/55" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }} data-testid="trade">
      <div className="w-[640px] max-w-[96vw] rounded-lg bg-[#262626] border-2 border-[#101010] shadow-[0_0_0_2px_#4a4a4a_inset] p-4 text-white" data-testid="item-shop">
        <div className="flex items-center gap-1 mb-3 flex-wrap">
          {SHOP_TABS.map((tb) => (
            <button key={tb.name} onClick={() => setTab(tb.name)} data-testid={`shop-tab-${tb.name.toLowerCase().replace(/ /g, '-')}`} title={shopTabLabel(tb.name)}
              className={`relative w-11 h-11 rounded-md flex items-center justify-center border ${tab === tb.name ? 'bg-[#3b3b3b] border-[#80ff20]' : 'bg-[#1a1a1a] border-[#3a3a3a] hover:bg-[#2e2e2e]'}`}>
              <img src={getItemIconURL(tb.icon)} alt={shopTabLabel(tb.name)} className="w-7 h-7 [image-rendering:pixelated]" />
            </button>
          ))}
          <button onClick={onClose} className="ml-auto text-[#8a8a8a] hover:text-white text-sm px-2" aria-label="Close">✕</button>
        </div>
        <div className="text-[#a8a8a8] text-sm mb-2" data-testid="shop-title">{shopTabLabel(tab)}</div>
        <div className="max-h-[52vh] overflow-y-auto pr-1 vb-scroll" data-testid="shop-scroll">
          <div className="grid gap-1.5" style={{ gridTemplateColumns: 'repeat(9, minmax(0, 1fr))' }}>
            {items.map(({ t, i }) => {
              const can = t.give.every(([id, n]) => countInSlots(inventory, id) >= n);
              const [pid, pn] = t.give[0];
              const cur = currency[pid];
              return (
                <button key={i} onClick={() => onTrade(i)} data-testid="shop-item" data-item-id={t.get[0]} title={`${ITEM_INFO[t.get[0]]?.name ?? ''} — ${pn} ${cur?.label ?? ITEM_INFO[pid]?.name}`}
                  className={`relative aspect-square rounded-sm bg-[#3a3a3a] border-2 border-t-[#202020] border-l-[#202020] border-b-[#6a6a6a] border-r-[#6a6a6a] flex items-center justify-center transition-all active:scale-95 hover:brightness-125 ${can ? '' : 'opacity-50'}`}>
                  <img src={getItemIconURL(t.get[0])} alt={ITEM_INFO[t.get[0]]?.name ?? ''} className="w-8 h-8 [image-rendering:pixelated]" />
                  {t.get[1] > 1 && <span className="absolute bottom-0 right-0.5 text-[11px] font-bold text-white drop-shadow-[1px_1px_0_#000]">{t.get[1]}</span>}
                  <span className="absolute top-0 left-0.5 text-[9px] font-bold drop-shadow-[1px_1px_0_#000]" style={{ color: cur?.color ?? '#fff' }}>{pn}</span>
                </button>
              );
            })}
          </div>
          {items.length === 0 && <p className="text-[#8a8a8a] text-xs py-6 text-center">{t('shop.nothing')}</p>}
        </div>
        <div className="flex items-center gap-4 mt-3 text-[11px] text-[#a8a8a8]">
          {[ITEM_IRON_INGOT, ITEM_GOLD_INGOT, ITEM_DIAMOND].map((id) => (
            <span key={id} className="flex items-center gap-1" style={{ color: currency[id].color }}>
              <img src={getItemIconURL(id)} alt="" className="w-4 h-4 [image-rendering:pixelated]" />{countInSlots(inventory, id)}
            </span>
          ))}
          <span className="ml-auto text-[#8a8a8a]">{t('shop.legend')}</span>
        </div>
        {note && <p className="text-xs text-[#ff8a8a] mt-2">{note}</p>}
      </div>
    </div>
  );
}

/** Trading with a villager: each offer shows what you give and what you get. */
export function TradeOverlay({ trade, inventory, note, onTrade, onClose }: {
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
  if (trade.trades.some((t) => t.cat)) return <ItemShop trade={trade} inventory={inventory} note={note} onTrade={onTrade} onClose={onClose} />;
  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/50" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }} data-testid="trade">
      <div className="w-[440px] max-w-[95vw] rounded-2xl bg-[#0d131b] border border-[#243044] p-5 text-white">
        <div className="flex items-center justify-between mb-4">
          <span className="font-[var(--font-retro)] text-xs tracking-wider">{trade.profession.toUpperCase()}</span>
          <button onClick={onClose} className="text-[#8ea0b8] hover:text-white text-sm">✕</button>
        </div>
        <div className="flex flex-col gap-2 max-h-[65vh] overflow-y-auto pr-1 vb-scroll" data-testid="trade-list">
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
        <p className="text-[#5a6b80] text-[10px] mt-1.5">~ means this block's position (~ ~1 ~ is the block above it). @p is the nearest player, @a every player, @e every mob too.</p>
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
  const brewing = !!furnaceKey && furnaceKey.startsWith('B|');
  /** What each brewing stand slot takes: potions below, an ingredient on top, blaze powder as fuel. */
  const brewAccepts = (i: number, st: ItemStack) => (i < 3 ? isPotionItem(st.id) : i === 3 ? isBrewIngredient(st.id) : st.id === ITEM_BLAZE_POWDER);
  const [cursor, setCursor] = useState<HeldStack | null>(null);
  const [mouse, setMouse] = useState({ x: -100, y: -100 });
  const [recipePreview, setRecipePreview] = useState<number | null>(null);
  const [hoverId, setHoverId] = useState<number | null>(null);
  const [hoverStack, setHoverStack] = useState<ItemStack | null>(null);
  const [creativeQuery, setCreativeQuery] = useState('');
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

  /** Double-click: pull every matching item from the chest, the crafting grid and your inventory onto the cursor (up to a full stack). */
  const lastClickRef = useRef({ t: 0, c: '' as string, i: -1 });
  function gatherAll() {
    const cur = cursorRef.current;
    if (!cur) return;
    const max = maxStack(cur.id);
    if (max <= 1 || cur.count >= max) return;
    const same = (a: ItemStack) => a.id === cur.id && JSON.stringify({ ...a, count: 0 }) === JSON.stringify({ ...cur, count: 0 });
    let have = cur.count;
    const sources: Container[] = ['grid', 'chest', 'inv'];
    for (const pass of [0, 1]) { // part-full stacks first, then full ones
      for (const c of sources) {
        const arr = arrOf(c).slice();
        let changed = false;
        for (let k = 0; k < arr.length && have < max; k++) {
          const st = arr[k];
          if (!st || !same(st)) continue;
          if (pass === 0 ? st.count >= max : st.count < max) continue;
          const take = Math.min(st.count, max - have);
          have += take;
          arr[k] = st.count - take > 0 ? withCount(st, st.count - take) : null;
          changed = true;
        }
        if (changed) commit(c, arr);
      }
    }
    if (have !== cur.count) commitCursor(withCount(cur, have));
  }

  function onSlotDown(e: ReactMouseEvent, c: Container, i: number) {
    e.preventDefault();
    {
      const now = performance.now(), lc = lastClickRef.current;
      const dbl = e.button === 0 && !e.shiftKey && now - lc.t < 450 && lc.c === c && lc.i === i;
      lastClickRef.current = { t: now, c, i };
      if (dbl && cursorRef.current && c !== 'armor' && c !== 'station' && c !== 'furnace' && c !== 'offhand') { lastClickRef.current.t = 0; gatherAll(); return; }
    }
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
    if (brewing && c === 'furnace' && cur && !brewAccepts(i, cur)) return;
    if (c === 'furnace' && i === 2 && !brewing) {
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
    if (c === 'armor' || c === 'station' || (c === 'furnace' && i === 2 && !brewing)) return;
    if (brewing && c === 'furnace' && cursorRef.current && !brewAccepts(i, cursorRef.current)) return;
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
    if (c === 'inv' && brewing) {
      const f = furnaceRef.current.slice();
      let target = -1;
      if (isPotionItem(st.id)) target = [0, 1, 2].find((k) => !f[k]) ?? -1;
      else if (st.id === ITEM_BLAZE_POWDER) target = 4;
      else if (isBrewIngredient(st.id)) target = 3;
      if (target < 0) return;
      const have = f[target];
      if (have && have.id !== st.id) return;
      const move = Math.min(maxStack(st.id) - (have?.count ?? 0), st.count);
      if (move <= 0) return;
      f[target] = withCount(have ?? st, (have?.count ?? 0) + move);
      src[i] = st.count - move > 0 ? withCount(st, st.count - move) : null;
      commit('inv', src);
      commit('furnace', f);
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
  /** Hover over a slot (or a creative item) and press 1-9: it swaps with that hotbar slot, like Minecraft. */
  const hoverSlotRef = useRef<string | null>(null);
  const hotbarKeyRef = useRef<(n: number) => void>(() => {});
  hotbarKeyRef.current = (n: number) => {
    const sk = hoverSlotRef.current;
    if (!sk || cursorRef.current) return;
    const inv = invRef.current.slice();
    const bar = inv[n] ?? null;
    if (sk.startsWith('creative:')) {
      const id = Number(sk.slice(9));
      if (!Number.isFinite(id)) return;
      inv[n] = { id, count: maxStack(id) };
      commitInv(inv);
      return;
    }
    if (sk.startsWith('book:') || sk === 'anvil:out') return;
    const [c, si] = sk.split(':') as [Container, string];
    const i = Number(si);
    if (!Number.isInteger(i)) return;
    if (c === 'inv') {
      if (i === n) return;
      const a = inv[i] ?? null;
      inv[i] = bar; inv[n] = a;
      commitInv(inv);
      return;
    }
    const arr = arrOf(c).slice();
    const there = arr[i] ?? null;
    // Slots that only take some things
    if (bar) {
      if (c === 'armor' && ARMOR[bar.id]?.slot !== i) return;
      if (c === 'station' && !stationAccepts(i, bar)) return;
      if (c === 'furnace' && (brewing ? !brewAccepts(i, bar) : i === 2)) return;
    }
    arr[i] = bar;
    inv[n] = there;
    commit(c, arr);
    commitInv(inv);
  };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const m = e.code.match(/^Digit([1-9])$/);
      if (!m) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      e.preventDefault();
      hotbarKeyRef.current(Number(m[1]) - 1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

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
  const title = station?.kind === 'enchanting' ? 'Enchanting Table' : station?.kind === 'anvil' ? 'Anvil' : furnaceKey ? (furnaceKey.startsWith('B|') ? 'Brewing Stand' : 'Furnace') : chestKey ? 'Chest' : atCraftingTable ? 'Crafting Table' : 'Inventory';

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
        hoverSlotRef.current = sk ?? null;
        if (sk?.startsWith('creative:')) setHoverStack(null);
        else if (sk === 'anvil:out') setHoverStack(anvil?.ok ? anvil.out : null);
        else if (sk?.startsWith('book:')) { const [, k, lv] = sk.split(':'); setHoverStack({ id: ITEM_ENCHANTED_BOOK, count: 1, ench: { [k]: Number(lv) } }); }
        else if (sk) { const [c, i] = sk.split(':'); setHoverStack(arrOf(c as Container)[Number(i)] ?? null); }
        else setHoverStack(null);
      }}
      onMouseDown={onBackdrop}
      onContextMenu={(e) => e.preventDefault()}
    >
      <div className="w-fit min-w-[480px] max-w-[96vw] bg-[#0d131b] border border-[#243044] rounded-2xl p-6 shadow-2xl">
        <div className="flex items-center justify-between gap-6 mb-4">
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
              disabled={!anvilLeft || (maxStack(anvilLeft.id) > 1 && anvilLeft.id !== ITEM_NAME_TAG)}
              maxLength={64}
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
        ) : furnaceKey && brewing ? (
          <div className="flex items-center gap-8 mb-5" data-testid="brewing">
            <div className="flex flex-col items-center gap-1.5">
              <span className="text-[10px] text-[#8ea0b8]">Fuel</span>
              {slotRow('furnace', furnace, 4, 5)}
              <div className="w-14 h-2 rounded-full bg-[#1a1a1a] overflow-hidden" title="Brews left on this blaze powder">
                <div className="h-full bg-gradient-to-r from-[#ff5a1a] to-[#ffd23a]" style={{ width: `${Math.round(furnaceProgress.burn * 100)}%` }} data-testid="brew-fuel" />
              </div>
              <span className="text-[9px] text-[#5a6b80]">Blaze Powder</span>
            </div>
            <div className="flex flex-col items-center gap-1.5">
              <span className="text-[10px] text-[#8ea0b8]">Ingredient</span>
              {slotRow('furnace', furnace, 3, 4)}
              <div className="w-24 h-3 rounded-full bg-[#1a1a1a] overflow-hidden" title="Brewing">
                <div className="h-full bg-[#7ee0ff]" style={{ width: `${Math.round(furnaceProgress.cook * 100)}%` }} data-testid="brew-progress" />
              </div>
              <div className="flex gap-2">{slotRow('furnace', furnace, 0, 3)}</div>
              <span className="text-[10px] text-[#8ea0b8]">Bottles</span>
            </div>
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
        <div className="grid grid-cols-9 gap-1 w-full justify-items-center">{slotRow('inv', inv, 9, INVENTORY_SIZE)}</div>
        <div className="flex items-end gap-3 mt-2.5">
          <div className="grid grid-cols-9 gap-1 w-full justify-items-center">{slotRow('inv', inv, 0, 9)}</div>
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
          <input value={creativeQuery} onChange={(e) => setCreativeQuery(e.target.value)} onKeyDown={(e) => e.stopPropagation()} placeholder="Search items" data-testid="creative-search"
            className="w-full mb-2 bg-[#05080c] border border-[#243044] rounded-lg px-3 py-1.5 text-white text-xs placeholder-[#364860] focus:outline-none focus:border-[#00e676]" />
          {(() => {
            // everything in one list: blocks and items, your own player head, then an enchanted book for every enchantment and level
            const q = creativeQuery.trim();
            const ids = [...allItemIds(), playerHeadItem(currentLook().skin)].filter((id) => matchesQuery(q, ITEM_INFO[id]?.name ?? '', blockNameOf(id)));
            const books = ENCHANTMENTS.flatMap((d) => Array.from({ length: d.max }, (_, i) => i + 1).map((lv) => ({ d, lv })))
              .filter(({ d, lv }) => matchesQuery(q, 'enchanted book', enchantLabel(d.key, lv), d.key));
            return (
              <>
                <div className="grid grid-cols-4 gap-1" data-testid="creative-items">
                  {ids.map((id) => (
                    <ItemSlot key={id} id={id} size="sm" slotKey={`creative:${id}`} onMouseDown={(e) => onCreativeSlot(e, id)} />
                  ))}
                  {books.map(({ d, lv }) => (
                    <ItemSlot key={`${d.key}${lv}`} id={ITEM_ENCHANTED_BOOK} st={{ id: ITEM_ENCHANTED_BOOK, count: 1, ench: { [d.key]: lv } }} slotKey={`book:${d.key}:${lv}`} size="sm" onMouseDown={(e) => onCreativeBook(e, d.key, lv)} />
                  ))}
                </div>
                {!ids.length && !books.length && <p className="text-[#5a6b80] text-[11px] mt-1" data-testid="creative-empty">Nothing matches "{q}".</p>}
              </>
            );
          })()}
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
type HudPrefs = { keystrokes: boolean; cps: boolean; fps: boolean; ping: boolean; coords: boolean; facing: boolean; clock: boolean; speed: boolean; minimap: boolean };
const DEFAULT_HUD: HudPrefs = { keystrokes: false, cps: false, fps: false, ping: false, coords: false, facing: false, clock: false, speed: false, minimap: false };

const MAX_MOD_SCHEMATICS = 20;
/** The shareable form of a mod: a .vbmod file (the same JSON that Export copies). */
function modToFile(m: Mod): string {
  return JSON.stringify({ magic: 'vibeblox-mod', name: m.name, author: m.author, description: m.description, version: m.version, code: m.code, schematics: m.schematics });
}
/** What still works in a minigame or in somebody else's world: help and talking to people. */
/** What a script may run with game.commands.run (the rest have game.* functions). */
const SCRIPT_COMMANDS = new Set(['title', 'say', 'effect', 'give', 'summon', 'tp', 'teleport', 'time', 'weather', 'playsound', 'rank']);
const SAFE_COMMANDS = new Set(['help', '?', 'whisper', 'w', 'msg', 'tell', 'r', 'reply', 'friend', 'friends', 'unfriend']);
const COMMANDS: Array<{ names: string[]; usage: string; desc: string }> = [
  { names: ['help', '?'], usage: '/help', desc: 'Show this list of commands.' },
  { names: ['gamemode', 'mode', 'gm'], usage: '/gamemode <mode> [player]', desc: 'Change a game mode: survival (s, 0), creative (c, 1), adventure (a, 2) or spectator (sp, 3). Other players need /panel (admins).' },
  { names: ['tp', 'teleport'], usage: '/tp <x> <y> <z> · /tp <player> · /tp <who> <x> <y> <z> · /tp <who> <player>', desc: 'Teleport to coordinates or to a player, e.g. /tp ~ ~20 ~ or /tp Steve or /tp @e[type=pig] @s. ~ means "where I am now".' },
  { names: ['give'], usage: '/give <player> <item> [count]', desc: 'Give an item, e.g. /give @p diamond 5 or /give @s stone_pickaxe.' },
  { names: ['clear'], usage: '/clear [player]', desc: 'Empty an inventory (yours if you leave the player out).' },
  { names: ['kill'], usage: '/kill [target]', desc: 'Kill yourself, or a target: /kill @e[type=zombie] kills every zombie nearby, /kill @e kills everything (you too!).' },
  { names: ['title'], usage: '/title <player> <text> [| subtitle] · /title clear', desc: 'Show a big title on a screen, e.g. /title @p \\green\\\\shiny\\ Hello world! Add a subtitle after a | . Codes: colours (\\red\\ \\gold\\ \\#ff8800\\), styles (\\bold\\ \\italic\\ \\underline\\ \\strike\\), moving effects (\\shiny\\ \\rainbow\\ \\neon\\ \\toxic\\ \\pristine\\ \\glitched\\ \\wave\\ \\shake\\ \\pulse\\), fonts (\\serif\\ \\mono\\ \\cursive\\ \\comic\\ \\impact\\ \\pixel\\ \\retro\\) and \\reset\\. Works in chat, signs of lore, scripts and command blocks.' },
  { names: ['rank'], usage: '/rank add <name> [tag] · /rank join <name> [player] · /rank modify <name> <tag> · /rank leave · /rank remove <name> · /rank list', desc: 'Make fake ranks for your world or server. They show in front of names in chat, the player list, Manage Server and over heads. Example: /rank add Owner, then /rank join Owner, then /rank modify Owner \\gold\\\\shiny\\OWNER.' },
  { names: ['effect'], usage: '/effect <player> <effect> [seconds] [level] · /effect clear [player]', desc: 'Give an effect: speed, slowness, jump_boost, regeneration, resistance, slow_falling, night_vision, weakness, blight, strength, fire_resistance, water_breathing or poison.' },
  { names: ['time'], usage: '/time set <sunrise|day|noon|sunset|night|midnight|0-24000>', desc: 'Change the time of day. Monsters only spawn at night. On a server, only the host can.' },
  { names: ['weather'], usage: '/weather <clear|rain|snow> [seconds]', desc: 'Change the weather. Rain turns to snow in cold biomes. On a server, only the host can.' },
  { names: ['list'], usage: '/list', desc: 'Show who is online (multiplayer). You can also hold Tab.' },
  { names: ['seed'], usage: '/seed', desc: 'Show this world\'s seed.' },
  { names: ['say'], usage: '/say <message>', desc: 'Say something in chat (command blocks show as [@]).' },
  { names: ['setblock'], usage: '/setblock <x> <y> <z> <block>', desc: 'Place one block. ~ means where you are (or the command block).' },
  { names: ['xp', 'experience'], usage: '/xp <amount> [levels] [player] · /xp set <level> [player]', desc: 'Give experience (points or levels) for enchanting and the anvil.' },
  { names: ['summon'], usage: '/summon [baby] <mob> [x y z]', desc: 'Spawn a mob in front of you: pig, cow, chicken, sheep, zombie, skeleton, creeper, spider, ghast, blaze, piglin, villager, iron golem, cinderbone or hollow tyrant (the boss). Add "baby" for a baby one, e.g. /summon baby cow.' },
  { names: ['enchant'], usage: '/enchant <player> <enchantment> [level]', desc: 'Enchant the item in a player\'s hand, e.g. /enchant @p sharpness 5. Also works on books. /give @s enchanted_book mending gives a book.' },
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
  { names: ['locate'], usage: '/locate village | temple | fortress | dungeon | portal | treasure', desc: 'Find the closest village, desert temple, dungeon, ruined portal, buried treasure, or (in the Nether) fortress.' },
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

/** Shows Miniblox-style codes like \red\, \gold\\shiny\, \rainbow\, \glitched\ (unknown codes stay as typed). */
const ColorText = FancyText;

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

function ChatBox({ open, initialText, messages, history, onSubmit, restricted = false }: {
  restricted?: boolean;
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
    ? COMMANDS.filter((c) => (!restricted || c.names.some((n) => SAFE_COMMANDS.has(n))) && c.names.some((n) => n.startsWith(typedCmd))).slice(0, 6)
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

/** Does a command (or anything with a usage and description) match what you typed in a search box? */
function matchesQuery(q: string, ...texts: string[]): boolean {
  const words = q.toLowerCase().replace(/^\//, '').split(/\s+/).filter(Boolean);
  if (!words.length) return true;
  const hay = texts.join(' ').toLowerCase();
  return words.every((w) => hay.includes(w));
}

const SELECTOR_HELP: Array<[string, string]> = [
  ['@s', 'yourself'], ['@p', 'the nearest player'], ['@a', 'every player'], ['@r', 'a random player'],
  ['@e', 'every entity: players and mobs (add [type=zombie] for one kind, [distance=..10] for nearby ones)'],
];

function HelpPanel({ onClose, extra = [], restricted = false }: { onClose: () => void; extra?: Array<{ usage: string; desc: string }>; restricted?: boolean }) {
  const [query, setQuery] = useState('');
  const cmds = COMMANDS.filter((c) => (!restricted || c.names.some((n) => SAFE_COMMANDS.has(n))) && matchesQuery(query, c.usage, c.desc, ...c.names));
  const ext = extra.filter((c) => matchesQuery(query, c.usage, c.desc));
  const searching = query.trim().length > 0;
  return (
    <div
      className="absolute inset-0 z-40 bg-black/60 backdrop-blur-sm flex items-center justify-center vb-fade-in"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-[600px] max-w-[92vw] max-h-[82vh] overflow-y-auto vb-scroll bg-[#0d131b] border border-[#243044] rounded-2xl p-6 shadow-2xl" data-testid="help-panel">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-[var(--font-retro)] text-white text-sm tracking-wider uppercase">Commands</h3>
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded-lg bg-[#121822] border border-[#243044] text-[#8ea0b8] text-xs transition-all duration-200 hover:text-white hover:border-[#364860] active:scale-95"
          >
            Close (Esc)
          </button>
        </div>
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#5a6b80]" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => { e.stopPropagation(); if (e.key === 'Escape') { if (query) setQuery(''); else onClose(); } }}
            placeholder="Search commands, e.g. tp, enchant, mob…"
            data-testid="help-search"
            className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-[#0a0e14] border border-[#243044] text-white text-sm placeholder:text-[#5a6b80] focus:outline-none focus:border-[#00e676]/60"
          />
        </div>

        {searching && !cmds.length && !ext.length && <p className="text-[#5a6b80] text-sm mb-6" data-testid="help-empty">No command matches "{query}".</p>}
        <div className="flex flex-col gap-2 mb-6">
          {cmds.map((c) => (
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

        {ext.length > 0 && (
          <>
            <h4 className="text-white text-xs font-medium mb-2 uppercase tracking-wide">From your mods &amp; scripts</h4>
            <div className="flex flex-col gap-2 mb-6">
              {ext.map((c) => (
                <div key={c.usage} className="p-3 rounded-xl bg-[#121822] border border-[#243044]">
                  <span className="font-mono text-sm text-[#7dd3fc]">{c.usage}</span>
                  <p className="text-[#8ea0b8] text-xs mt-1">{c.desc}</p>
                </div>
              ))}
            </div>
          </>
        )}

        {!searching && (<>
        <h4 className="text-white text-xs font-medium mb-2 uppercase tracking-wide">Target selectors</h4>
        <div className="flex flex-col gap-1.5 mb-6">
          {SELECTOR_HELP.map(([k, d]) => (
            <div key={k} className="flex gap-3 text-xs"><span className="w-10 shrink-0 font-mono text-[#00e676]">{k}</span><span className="text-[#8ea0b8]">{d}</span></div>
          ))}
          <p className="text-[#5a6b80] text-[11px] mt-1">Use them (or a player's name) wherever a command takes a player, e.g. /tp @p, /give @s diamond, /kill @e[type=creeper].</p>
        </div>
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
          <span><b className="text-white">Right-click</b> a boat to get in · <b className="text-white">Shift</b> out</span>
        </div>
        </>)}
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

const COMPASS = ['North', 'North-East', 'East', 'South-East', 'South', 'South-West', 'West', 'North-West'];
function HudOverlays({ prefs, getFps, paused, getInfo, ping, online }: { prefs: HudPrefs; getFps: () => number; paused: boolean; getInfo?: () => DebugInfo | null; ping?: number | null; online?: boolean }) {
  const binds = useKeybinds();
  const [pressed, setPressed] = useState<Record<string, boolean>>({});
  const [, setTick] = useState(0);
  const clicksRef = useRef<{ left: number[]; right: number[] }>({ left: [], right: [] });
  const pausedRef = useRef(paused);
  pausedRef.current = paused;
  const speedRef = useRef<{ x: number; z: number; t: number; v: number } | null>(null);
  const anyOn = prefs.keystrokes || prefs.cps || prefs.fps || prefs.ping || prefs.coords || prefs.facing || prefs.clock || prefs.speed;

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

  const info = prefs.coords || prefs.facing || prefs.clock || prefs.speed ? getInfo?.() ?? null : null;
  let speed = 0;
  if (info && prefs.speed) {
    const t = performance.now() / 1000, prev = speedRef.current;
    if (prev && t - prev.t >= 0.2) { const v = Math.hypot(info.x - prev.x, info.z - prev.z) / (t - prev.t); speedRef.current = { x: info.x, z: info.z, t, v: v > 200 ? 0 : v }; }
    else if (!prev) speedRef.current = { x: info.x, z: info.z, t, v: 0 };
    speed = speedRef.current?.v ?? 0;
  }
  const pill = 'bg-black/45 text-white text-xs font-bold px-2 py-1 rounded-md';
  const facingName = info ? COMPASS[((Math.round(info.yaw / 45) % 8) + 8) % 8] : '';
  return (
    <div className="absolute top-3 right-3 z-20 flex flex-col gap-1 items-end pointer-events-none" data-testid="hud-overlays">
      {prefs.fps && <div className={pill}>{getFps()} FPS</div>}
      {prefs.ping && <div className={pill} data-testid="hud-ping">{online ? (ping !== null && ping !== undefined && ping >= 0 ? `${ping} ms` : '… ms') : 'Ping: single player'}</div>}
      {prefs.coords && info && <div className={`${pill} font-mono`} data-testid="hud-coords">XYZ: {info.x.toFixed(1)} / {info.y.toFixed(1)} / {info.z.toFixed(1)}</div>}
      {prefs.facing && info && <div className={pill} data-testid="hud-facing">Facing {facingName}</div>}
      {prefs.clock && info && <div className={pill} data-testid="hud-clock">{info.clock}{info.night ? ' 🌙' : ' ☀'}</div>}
      {prefs.speed && info && <div className={pill} data-testid="hud-speed">{speed.toFixed(1)} blocks/s</div>}
      {prefs.keystrokes && (
        <div className="grid grid-cols-3 gap-1 w-[144px]">
          <div />
          {keyBox(binds.forward, keyLabel(binds.forward))}
          <div />
          {keyBox(binds.left, keyLabel(binds.left))}
          {keyBox(binds.back, keyLabel(binds.back))}
          {keyBox(binds.right, keyLabel(binds.right))}
          <div className="col-span-3 grid grid-cols-2 gap-1">
            {keyBox('Mouse0', 'LMB', prefs.cps ? `${lcps} CPS` : undefined)}
            {keyBox('Mouse2', 'RMB', prefs.cps ? `${rcps} CPS` : undefined)}
          </div>
          {keyBox(binds.jump, binds.jump === 'Space' ? '———' : keyLabel(binds.jump), undefined, true)}
        </div>
      )}
      {prefs.cps && !prefs.keystrokes && (
        <div className="bg-black/45 text-white text-xs font-bold px-2 py-1 rounded-md">{lcps} | {rcps} CPS</div>
      )}
    </div>
  );
}

/** A small top-down map (north up) of the land around you, redrawn a few times a second. */
function Minimap({ getMap }: { getMap: () => ReturnType<NonNullable<ReturnType<typeof createVoxelGame>['getMinimap']>> | null }) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    let alive = true;
    const draw = () => {
      if (!alive) return;
      const m = getMap();
      const c = ref.current;
      if (!m || !c) return;
      const ctx = c.getContext('2d');
      if (!ctx) return;
      const img = new ImageData(new Uint8ClampedArray(m.rgba), m.size, m.size);
      const tmp = document.createElement('canvas');
      tmp.width = m.size; tmp.height = m.size;
      tmp.getContext('2d')?.putImageData(img, 0, 0);
      ctx.imageSmoothingEnabled = false;
      ctx.clearRect(0, 0, c.width, c.height);
      ctx.fillStyle = '#0b0f16'; ctx.fillRect(0, 0, c.width, c.height);
      ctx.drawImage(tmp, 0, 0, c.width, c.height);
      const k = c.width / m.size, mid = c.width / 2;
      for (const d of m.dots) {
        ctx.fillStyle = d.kind === 'hostile' ? '#ff4d4d' : d.kind === 'player' ? '#4dd2ff' : d.kind === 'bot' ? (d.color ?? '#ffffff') : '#ffffff';
        ctx.fillRect(mid + d.dx * k - 2, mid + d.dz * k - 2, 4, 4);
      }
      // you: an arrow pointing the way you look
      ctx.save();
      ctx.translate(mid, mid);
      ctx.rotate(-m.yaw);
      ctx.fillStyle = '#ffe066'; ctx.strokeStyle = '#000000'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(0, -7); ctx.lineTo(5, 6); ctx.lineTo(0, 3); ctx.lineTo(-5, 6); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.restore();
    };
    draw();
    const t = window.setInterval(draw, 400);
    return () => { alive = false; window.clearInterval(t); };
  }, [getMap]);
  return (
    <div className="absolute top-3 left-3 z-20 pointer-events-none" data-testid="minimap">
      <div className="relative rounded-lg overflow-hidden border-2 border-black/60 shadow-lg">
        <canvas ref={ref} width={150} height={150} className="block w-[150px] h-[150px] [image-rendering:pixelated]" />
        <span className="absolute top-0.5 left-1/2 -translate-x-1/2 text-[10px] font-bold text-white drop-shadow-[0_1px_0_#000]">N</span>
      </div>
    </div>
  );
}

/** The boss health bar at the top of the screen (like the Wither's). */
function BossBar({ bar }: { bar: { name: string; health: number; max: number; charging: boolean; hardened: boolean } }) {
  const pct = Math.max(0, Math.min(100, (bar.health / bar.max) * 100));
  return (
    <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20 w-[420px] max-w-[70vw] pointer-events-none text-center" data-testid="boss-bar">
      <div className="text-white text-sm font-bold drop-shadow-[0_2px_0_rgba(0,0,0,0.9)] mb-1">{bar.name}{bar.charging ? ' is waking up…' : ''}</div>
      <div className="h-2.5 bg-black/70 border border-black rounded-[2px] overflow-hidden">
        <div className={`h-full transition-[width] duration-200 ${bar.charging ? 'bg-gradient-to-r from-[#5ad8ff] to-[#c8f0ff]' : bar.hardened ? 'bg-gradient-to-r from-[#3a6ae2] to-[#5ad8ff]' : 'bg-gradient-to-r from-[#7a2ad8] to-[#c070ff]'}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

/** EggWars and Bridge Duels: the score or the eggs at the top, the countdown, messages, and the result screen. */
/** OneBlock: which phase you're in, how many blocks you've broken, and how far to the next phase. */
function OneBlockHud({ view }: { view: OneBlockView }) {
  useLanguage();
  const pct = Math.max(0, Math.min(100, Math.round(view.progress * 100)));
  return (
    <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20 pointer-events-none w-[320px] max-w-[70vw]" data-testid="oneblock-hud">
      <div className="bg-black/55 border border-white/10 rounded-xl px-3 py-2 font-[var(--font-display)]">
        <div className="flex items-center justify-between gap-3 text-white">
          <span className="text-sm font-bold text-[#00e676]" data-testid="ob-phase">{t('ob.phase', { n: view.phase + 1 })} · {t('ob.' + view.name)}</span>
          <span className="text-xs tabular-nums" data-testid="ob-count">{t('ob.broken', { n: view.count })}</span>
        </div>
        <div className="h-1.5 rounded-full bg-white/15 mt-1.5 overflow-hidden"><div className="h-full bg-[#00e676] transition-all duration-300" style={{ width: `${pct}%` }} data-testid="ob-bar" /></div>
        <div className="flex items-center justify-between text-[10px] text-white/60 mt-1">
          <span>{view.nextName && view.nextAt !== null ? t('ob.next', { name: t('ob.' + view.nextName), at: view.nextAt }) : t('ob.final')}</span>
          <span className={view.chestIn === 0 ? 'text-[#ffd54a] font-bold' : ''} data-testid="ob-chest">{view.chestIn === 0 ? t('ob.chestNow') : t('ob.chest', { n: view.chestIn })}</span>
        </div>
      </div>
    </div>
  );
}

function MinigameHud({ view, onPlayAgain, onExit }: { view: MinigameView; onPlayAgain: (d: BotDifficulty) => void; onExit: () => void }) {
  const [diff, setDiff] = useState<BotDifficulty>(view.difficulty);
  const [watching, setWatching] = useState(false); // knocked out: keep watching the rest of the game
  const showResult = !!view.result && (view.phase === 'over' || (view.you.out && !watching));
  useEffect(() => { if (showResult && document.pointerLockElement) document.exitPointerLock(); }, [showResult]);
  useEffect(() => { if (view.phase === 'countdown') setWatching(false); }, [view.phase]);
  const teamName = (t: MinigameView['teams'][number]) => (t.you ? `${t.name} (you)` : view.size === 'solo' ? `${t.name} Bot` : `${t.name} Team`);
  const mins = Math.floor(view.elapsed / 60), secs = view.elapsed % 60;
  return (
    <>
      <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20 pointer-events-none flex flex-col items-center gap-1.5" data-testid="minigame-hud">
        {view.kind === 'bridge' ? (
          <div className="flex items-center gap-3 bg-black/55 border border-white/10 rounded-xl px-4 py-2 font-[var(--font-display)]">
            <span className="text-lg font-bold" style={{ color: view.teams[0].color }}>{view.teams[0].name.toUpperCase()}</span>
            <span className="text-white text-2xl font-bold tabular-nums" data-testid="bridge-score">{view.teams[0].score} - {view.teams[1].score}</span>
            <span className="text-lg font-bold" style={{ color: view.teams[1].color }}>{view.teams[1].name.toUpperCase()}</span>
            <span className="text-white/50 text-[11px] ml-1">first to {view.winScore}</span>
          </div>
        ) : (
          <div className="bg-black/55 border border-white/10 rounded-xl px-3 py-2 min-w-[220px]" data-testid="eggwars-teams">
            {view.teams.map((t) => (
              <div key={t.name} className={`flex items-center gap-2 text-xs leading-6 ${t.out ? 'opacity-40 line-through' : ''}`}>
                <span className="w-2.5 h-2.5 rounded-sm" style={{ background: t.color }} />
                <span className="text-white font-bold flex-1">{teamName(t)}</span>
                <span className={t.eggAlive ? 'text-[#80ff20]' : 'text-[#ff6b6b]'} title={t.eggAlive ? 'Egg standing' : 'Egg broken'}>{t.eggAlive ? '● egg' : '✗ egg'}</span>
                <span className="text-white/60 w-14 text-right">{t.out ? 'out' : `${t.alive} alive`}</span>
              </div>
            ))}
            <div className="text-white/50 text-[10px] mt-1 flex justify-between"><span>Kills {view.you.kills}</span><span>{mins}:{String(secs).padStart(2, '0')}</span></div>
          </div>
        )}
        {view.message && <div className="bg-black/60 text-white text-sm font-bold px-3 py-1 rounded-md vb-fade-in" data-testid="minigame-message">{view.message}</div>}
      </div>
      {view.phase === 'countdown' && (
        <div className="absolute inset-0 z-20 flex items-center justify-center pointer-events-none">
          <div key={view.countdown} className="font-[var(--font-retro)] text-[#ffe066] text-7xl drop-shadow-[0_4px_0_rgba(0,0,0,0.7)] vb-fade-in" data-testid="minigame-countdown">{view.countdown}</div>
        </div>
      )}
      {showResult && view.result && (
        <div className="absolute inset-0 z-[45] flex items-center justify-center bg-black/55 vb-fade-in" data-testid="minigame-result">
          <div className="w-[420px] max-w-[92vw] rounded-2xl bg-[#0d131b] border border-[#243044] p-6 text-center shadow-2xl">
            <div className={`font-[var(--font-retro)] text-3xl mb-2 ${view.result.win ? 'text-[#ffe066]' : 'text-[#ff6b6b]'}`}>{view.result.win ? 'VICTORY!' : 'GAME OVER'}</div>
            <p className="text-white text-sm mb-1">{view.result.text}</p>
            <p className="text-[#5a6b80] text-xs mb-5">Kills {view.you.kills} · Deaths {view.you.deaths} · {mins}:{String(secs).padStart(2, '0')}</p>
            <p className="text-[#8ea0b8] text-xs mb-2">Bots for the next game</p>
            <div className="grid grid-cols-3 gap-2 mb-4">
              {(['easy', 'normal', 'hard'] as BotDifficulty[]).map((d) => (
                <button key={d} onClick={() => setDiff(d)} className={`py-2 rounded-xl text-xs font-bold capitalize ${diff === d ? 'bg-[#00e676] text-[#0a0e14]' : 'bg-[#121822] border border-[#243044] text-[#8ea0b8] hover:text-white'}`}>{d}</button>
              ))}
            </div>
            <div className="flex gap-2">
              <button onClick={() => onPlayAgain(diff)} data-testid="play-again" className="flex-1 py-3 rounded-xl bg-[#00e676] text-[#0a0e14] font-bold text-sm hover:brightness-110 active:scale-95">Play again</button>
              <button onClick={onExit} className="flex-1 py-3 rounded-xl bg-[#121822] border border-[#243044] text-white font-bold text-sm hover:border-[#3a4a60] active:scale-95">Back to menu</button>
            </div>
            {view.phase !== 'over' && <button onClick={() => setWatching(true)} className="mt-3 text-[#8ea0b8] text-xs hover:text-white underline">Keep watching</button>}
          </div>
        </div>
      )}
    </>
  );
}

const EFFECT_LABELS: Record<string, { name: string; color: string }> = {
  speed: { name: 'Speed', color: '#7cafc6' }, slowness: { name: 'Slowness', color: '#5a6c81' }, jump_boost: { name: 'Jump Boost', color: '#22ff4c' },
  regeneration: { name: 'Regeneration', color: '#cd5cab' }, resistance: { name: 'Resistance', color: '#99453a' }, slow_falling: { name: 'Slow Falling', color: '#f7f8e0' },
  night_vision: { name: 'Night Vision', color: '#1f1fa1' }, weakness: { name: 'Weakness', color: '#8a8a8a' }, blight: { name: 'Blight', color: '#5a4a5e' },
  strength: { name: 'Strength', color: '#cc3a38' }, fire_resistance: { name: 'Fire Resistance', color: '#e49a3a' }, water_breathing: { name: 'Water Breathing', color: '#2e7fd9' }, poison: { name: 'Poison', color: '#6fd23a' },
};
/** Active effects, each with how long it has left. */
function EffectsBar({ effects }: { effects: Array<{ name: string; level: number; seconds: number }> }) {
  if (!effects.length) return null;
  return (
    <div className="absolute top-24 right-3 z-20 flex flex-col gap-1 items-end pointer-events-none" data-testid="effects">
      {effects.map((e) => {
        const l = EFFECT_LABELS[e.name] ?? { name: e.name, color: '#ffffff' };
        const m = Math.floor(e.seconds / 60), sec = e.seconds % 60;
        return (
          <div key={e.name} className="flex items-center gap-2 bg-black/55 border border-white/10 rounded-md px-2 py-1 text-xs text-white">
            <span className="w-3 h-3 rounded-full border border-black/50" style={{ background: l.color }} />
            <span className="font-bold">{l.name}{e.level > 1 ? ` ${['', 'I', 'II', 'III', 'IV', 'V'][e.level] ?? e.level}` : ''}</span>
            <span className="text-white/70 font-mono">{m}:{String(sec).padStart(2, '0')}</span>
          </div>
        );
      })}
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
      className={`relative w-full py-3 [@media(max-height:500px)]:py-1.5 border-2 ${MENU_COLORS[color]} text-white font-[var(--font-retro)] text-xs tracking-wide flex items-center justify-center gap-2 transition-all duration-150 ${
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

type MenuPage = 'main' | 'settings' | 'scripts' | 'mods' | 'shop' | 'server' | 'advancements' | 'schematics';

function GameMenu({ page, onResume, onOpenSettings, onOpenScripts, onOpenMods, onOpenShop, onOpenServer, onOpenAdvancements, onOpenSchematics, showScripts = true, showMods = true, showServer = true, showAdvancements = true, showSchematics = false, onBack, onExit, children }: {
  page: MenuPage;
  showSchematics?: boolean;
  onOpenSchematics?: () => void;
  showServer?: boolean;
  showAdvancements?: boolean;
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
  useLanguage();
  return (
    <div data-testid="game-menu" className="absolute inset-0 z-40 bg-black/55 flex items-center justify-center overflow-y-auto py-4 vb-fade-in" onContextMenu={(e) => e.preventDefault()}>
      {page === 'main' ? (
        <div className="w-[400px] max-w-[90vw] flex flex-col gap-2.5 [@media(max-height:500px)]:gap-1.5 my-auto">
          <h2 className="font-[var(--font-retro)] text-white text-2xl text-center mb-4 [@media(max-height:500px)]:mb-1 [@media(max-height:500px)]:text-lg drop-shadow-[0_3px_0_rgba(0,0,0,0.6)]">{t('menu.title')}</h2>
          <MenuButton color="green" icon={Play} label={t('menu.resume')} onClick={onResume} />
          <MenuButton color="gray" icon={Settings} label={t('menu.settings')} onClick={onOpenSettings} />
          {showServer && <MenuButton color="gray" icon={Users} label={t('menu.server')} onClick={onOpenServer} />}
          {(showScripts || showMods) && (
            <div className={`grid gap-2.5 ${showScripts && showMods ? 'grid-cols-2' : 'grid-cols-1'}`}>
              {showScripts && <MenuButton color="blue" icon={ScrollText} label={t('menu.scripts')} onClick={onOpenScripts} />}
              {showMods && <MenuButton color="teal" icon={Package} label={t('menu.mods')} onClick={onOpenMods} />}
            </div>
          )}
          {showSchematics && onOpenSchematics && <MenuButton color="teal" icon={Package} label={t('menu.schematics')} onClick={onOpenSchematics} />}
          {showAdvancements && <MenuButton color="gray" icon={Trophy} label={t('menu.advancements')} onClick={onOpenAdvancements} />}
          <MenuButton color="red" icon={LogOut} label={t('menu.exit')} onClick={onExit} />
          <p className="text-center text-white/50 text-[11px] mt-2">{t('menu.hint')}</p>
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
            <span className="font-[var(--font-retro)] text-white text-xs tracking-wider">{t('page.' + page).toUpperCase()}</span>
          </div>
          <div className="overflow-y-auto vb-scroll p-5">{children}</div>
        </div>
      )}
    </div>
  );
}

/** Minecraft-style death screen: no automatic respawn. */
function DeathScreen({ reason, onRespawn, onExit, hardcore = false }: { reason: string; onRespawn: () => void; onExit: () => void; hardcore?: boolean }) {
  useLanguage();
  // The buttons unlock after a moment so a panicked click doesn't respawn you instantly
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setReady(true), 1000);
    return () => clearTimeout(t);
  }, []);
  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center vb-fade-in" style={{ background: 'rgba(110, 0, 0, 0.5)' }} onContextMenu={(e) => e.preventDefault()}>
      <div className="w-[400px] max-w-[90vw] flex flex-col items-center gap-2.5">
        <h2 className="font-[var(--font-retro)] text-white text-3xl mb-3 drop-shadow-[0_3px_0_rgba(0,0,0,0.6)]">{hardcore ? t('death.gameOver') : t('death.title')}</h2>
        {hardcore && <p className="text-[#ffd0d0] text-xs mb-1 text-center">{t('death.hardcore')}</p>}
        <p className="text-white text-sm mb-5 text-center">
          {t('death.by')} <span className="font-semibold text-[#ffd0d0]">{reason}</span>
        </p>
        <MenuButton color="green" icon={Heart} label={hardcore ? t('death.spectate') : t('death.respawn')} onClick={onRespawn} disabled={!ready} />
        <MenuButton color="gray" icon={LogOut} label={t('death.exit')} onClick={onExit} disabled={!ready} />
      </div>
    </div>
  );
}

type NetStatus = 'offline' | 'connecting' | 'online';

function ServersView({ serverUrl, onServerUrlChange, onJoin, status, error, available }: {
  serverUrl: string;
  onServerUrlChange: (v: string) => void;
  onJoin: (address?: string, hostName?: string) => void;
  status: NetStatus;
  error: string | null;
  available: boolean;
}) {
  const connecting = status === 'connecting';
  const summary = useContext(AccountSummaryContext);
  const [worlds, setWorlds] = useState<HostedWorld[] | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [showAddress, setShowAddress] = useState(false);
  const [joiningId, setJoiningId] = useState<string | null>(null);
  // The list keeps itself up to date while you look at it
  useEffect(() => {
    let live = true;
    const load = async () => {
      const r = await listHostedWorlds();
      if (!live) return;
      if (r.ok) { setWorlds(r.worlds); setListError(null); } else setListError(r.error);
    };
    void load();
    const t = window.setInterval(load, 8000);
    return () => { live = false; window.clearInterval(t); };
  }, []);
  useEffect(() => { if (!connecting) setJoiningId(null); }, [connecting]);
  const canJoin = available && hostingAvailable;
  const privacyBadge = (p: HostedWorld['privacy']) => (p === 'friends' ? { icon: Users, text: 'Friends', cls: 'text-[#c8a2ff]' } : p === 'accounts' ? { icon: Shield, text: 'Accounts', cls: 'text-[#6ec6ff]' } : { icon: Globe, text: 'Public', cls: 'text-[#7cfc7c]' });
  return (
    <div className="vb-fade-in max-w-2xl">
      <header className="mb-6">
        <div className="flex items-center gap-2 mb-2">
          <Globe className="w-5 h-5 text-[#00e676]" />
          <span className="font-[var(--font-retro)] text-[10px] text-[#00e676]">MULTIPLAYER</span>
        </div>
        <h1 className="font-[var(--font-retro)] text-xl text-white leading-relaxed tracking-wider">PLAY WITH OTHERS</h1>
        <p className="text-[#5a6b80] text-sm mt-1">Jump into a world someone is playing right now. Your own worlds open up the same way while you play them.</p>
      </header>

      <section className="bg-[#121822] rounded-2xl border border-[#243044] p-5" data-testid="world-list">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-white text-sm font-medium">Worlds you can join</h2>
          <span className="text-[#5a6b80] text-[10px]">{worlds ? `${worlds.length} open · updates by itself` : 'Loading…'}</span>
        </div>
        {error && <p className="text-red-400 text-xs mb-3 vb-fade-in" data-testid="join-error">{error}</p>}
        {!canJoin && <p className="text-amber-500 text-xs mb-3">Joining worlds isn't installed in this copy of the game (src/multiplayer.ts or src/hosting.ts is missing).</p>}
        {listError && !worlds?.length && <p className="text-[#ff9a3c] text-xs mb-2">{listError}</p>}
        {worlds && !worlds.length && !listError && (
          <div className="rounded-xl bg-[#0a0e14] border border-[#243044] px-4 py-6 text-center" data-testid="world-list-empty">
            <p className="text-white text-sm">Nobody is playing an open world right now.</p>
            <p className="text-[#5a6b80] text-xs mt-1">Play one of your own worlds (signed in) and it shows up here for others.</p>
          </div>
        )}
        <div className="flex flex-col gap-2">
          {worlds?.map((w) => {
            const b = privacyBadge(w.privacy);
            const full = w.players >= w.max;
            const mine = !!summary.username && w.host.toLowerCase() === summary.username.toLowerCase();
            return (
              <div key={w.id} className="flex items-center gap-3 rounded-xl bg-[#0a0e14] border border-[#243044] px-4 py-3" data-testid="world-row">
                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[#00e676]/30 to-[#00b248]/10 flex items-center justify-center text-white font-bold">{w.name.charAt(0).toUpperCase()}</div>
                <div className="flex-1 min-w-0">
                  <div className="text-white text-sm font-medium truncate" data-testid="world-name">{w.name}</div>
                  <div className="text-[#5a6b80] text-[11px] flex items-center gap-2 flex-wrap">
                    <span>by <span className="text-[#8ea0b8]">{w.host}</span></span>
                    <span className="capitalize">{w.mode}{w.worldType === 'superflat' ? ' · flat' : ''}</span>
                    <span className={`inline-flex items-center gap-1 ${b.cls}`}><b.icon className="w-3 h-3" />{b.text}</span>
                  </div>
                </div>
                <span className={`text-xs font-bold ${full ? 'text-[#ff8a8a]' : 'text-[#8ea0b8]'}`}>{w.players}/{w.max}</span>
                <button disabled={!canJoin || connecting || full || mine} data-testid="world-join"
                  onClick={() => { setJoiningId(w.id); onJoin('p2p:' + w.id, w.host); }}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${connecting && joiningId === w.id ? 'bg-[#243044] text-[#8ea0b8] cursor-wait' : 'bg-gradient-to-r from-[#00e676] to-[#00b248] text-[#0a0e14] hover:scale-[1.03] active:scale-95'} disabled:opacity-40 disabled:hover:scale-100`}>
                  {connecting && joiningId === w.id ? 'Joining…' : mine ? 'Yours' : full ? 'Full' : 'Join'}
                </button>
              </div>
            );
          })}
        </div>
        <p className="text-[#5a6b80] text-[11px] mt-4 leading-relaxed">
          To open your own world, sign in and play it. Pick who can join (Public, Accounts only, Friends only or Private) when you create it, or in
          Esc → Manage Server. Players connect straight to your game, so it stays open only while you're playing.
        </p>
      </section>

      <section className="bg-[#121822] rounded-2xl border border-[#243044] mt-6">
        <button onClick={() => setShowAddress((v) => !v)} className="w-full flex items-center justify-between px-6 py-4 text-left" data-testid="toggle-address">
          <span>
            <span className="block text-white text-sm font-medium">Advanced: join a dedicated server by address</span>
            <span className="block text-[#5a6b80] text-[11px]">Only if someone gave you an address for a server they run themselves.</span>
          </span>
          <ChevronRight className={`w-4 h-4 text-[#8ea0b8] transition-transform ${showAddress ? 'rotate-90' : ''}`} />
        </button>
        {showAddress && (
          <div className="px-6 pb-6">
            <div className="flex gap-2">
              <input
                type="text"
                value={serverUrl}
                onChange={(e) => onServerUrlChange(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !connecting) onJoin(); }}
                placeholder="play.example.com"
                data-testid="server-address"
                className="flex-1 bg-[#0a0e14] border border-[#243044] rounded-xl px-4 py-3 text-white text-sm placeholder-[#364860] focus:border-[#00e676] focus:outline-none transition-colors"
              />
              <button
                onClick={() => onJoin()}
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
            <p className="text-[#5a6b80] text-xs mt-3">Just the domain is fine. A server on this computer is <span className="font-mono text-[#8ea0b8]">localhost:8080</span>.</p>
            <PrivateServers connecting={connecting} available={available} onJoin={(address) => { onServerUrlChange(address); onJoin(address); }} />
          </div>
        )}
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

function PlayerList({ players, myId, max, tagOf }: { players: Record<number, string>; myId: number | null; max?: number | null; tagOf?: (name: string) => string }) {
  const entries = Object.entries(players).sort((a, b) => a[1].localeCompare(b[1]));
  return (
    <div className="absolute top-8 left-1/2 -translate-x-1/2 z-30 w-[300px] bg-black/60 rounded-lg p-3 pointer-events-none vb-fade-in">
      <div className="text-center text-white text-xs font-bold mb-2">Players online ({entries.length}{max ? `/${max}` : ''})</div>
      <div className="flex flex-col gap-0.5">
        {entries.map(([id, name]) => (
          <div key={id} className={`px-2 py-0.5 text-sm bg-white/10 ${Number(id) === myId ? 'text-[#ffe066]' : 'text-white'}`} data-testid="player-row">{tagOf && tagOf(name) ? <><FancyText text={tagOf(name)} /></> : null}{name}</div>
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
  const list = (tab === 'community' ? custom : official).slice().sort((a, b) => Number(starred.includes(b.id)) - Number(starred.includes(a.id)));

  function exportMod(m: Mod) {
    const json = JSON.stringify({ name: m.name, author: m.author, description: m.description, code: m.code });
    navigator.clipboard?.writeText(modToFile(m)).then(() => setCopied(m.id), () => setCopied(null));
    void json;
    setTimeout(() => setCopied(null), 1500);
  }
  function importResult(err: string | null): string {
    if (!err) return 'Imported! It starts switched off.';
    if (err.startsWith('SKIPPED:')) return `Imported! It starts switched off. ${err.slice(8)} of its schematics could not be used and were left out.`;
    return err;
  }
  async function importFromFile() {
    const text = await pickTextFile('.vbmod,.json');
    if (text === null) return;
    const err = onImport(text);
    setImportMsg(importResult(err));
    if (!err || err.startsWith('SKIPPED:')) setTab('community');
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
          <button key={t} onClick={() => setTab(t)} data-testid={`mods-tab-${t}`}
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
                {m.version && <span className="text-[#5a6b80] text-[10px]">v{m.version}</span>}
                {on && <span className="text-[#00e676] text-[10px] font-bold">✓ Installed</span>}
                {!!m.schematics?.length && <span className="text-[#3a8aff] text-[10px]" data-testid="mod-pack-badge">📦 {m.schematics.length} schematic{m.schematics.length === 1 ? '' : 's'}</span>}
              </div>
              <p className="text-[#8ea0b8] text-xs mt-1">{m.description || 'No description'}</p>
              <div className="flex gap-3 mt-2 text-[11px]">
                <button onClick={() => onStar(m)} className={star ? 'text-amber-400' : 'text-[#5a6b80] hover:text-white'}>{star ? '★ Starred' : '☆ Star'}</button>
                <button onClick={() => onFork(m)} className="text-[#5a6b80] hover:text-white">⑂ Fork</button>
                <button onClick={() => exportMod(m)} className="text-[#5a6b80] hover:text-white">{copied === m.id ? '✓ Copied' : '⇪ Copy'}</button>
                <button onClick={() => downloadFile(`${fileSafe(m.name)}.vbmod`, modToFile(m))} data-testid="mod-download" className="text-[#5a6b80] hover:text-white">⇩ File</button>
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
          <span className="text-[#8ea0b8] text-xs">Import a mod someone shared: choose their .vbmod file, or paste what their Copy button copied</span>
          <div className="mt-2"><button onClick={() => void importFromFile()} data-testid="mod-import-file" className="px-3 py-2 rounded-lg bg-[#121822] border border-[#243044] text-white text-xs hover:border-[#00e676]">Choose a file…</button></div>
          <div className="flex gap-2 mt-2">
            <input value={importText} onChange={(e) => setImportText(e.target.value)} placeholder='{"name": ..., "code": ...}'
              className="flex-1 bg-[#05080c] border border-[#243044] rounded-lg px-3 py-2 text-white text-xs font-mono focus:outline-none focus:border-[#00e676]" />
            <button onClick={() => { const err = onImport(importText); setImportMsg(importResult(err)); if (!err || err.startsWith('SKIPPED:')) setImportText(''); }}
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
  useLanguage();
  const [username, setUsername] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [ready, setReady] = useState(false);
  const [view, setView] = useState<View>('home');
  const viewRef = useRef<View>('home');
  viewRef.current = view;
  // ---- accounts, friends, private messages, admin ----
  const { account, admin, checked: accountChecked, signOut: doSignOut, rename: doRename } = useAccount();
  const accountRef = useRef(account);
  accountRef.current = account;
  const adminRef = useRef(admin);
  adminRef.current = admin;
  // Your plays decide if you are a Rising Creator (1000 plays); your rank comes from your account
  const [standing, setStanding] = useState<Standing | null>(null);
  const isOwnerAccount = isOwnerName(account?.username);
  const myRank: RankId = effectiveRank(account, isOwnerAccount);
  const myTier: CreatorTier = isOwnerAccount ? 'star' : creatorTier(standing?.plays ?? 0);
  const rising = myTier !== 'none';
  const budgetRef = useRef(scriptBudgetMs(myRank, myTier));
  budgetRef.current = scriptBudgetMs(myRank, myTier);
  const myRankRef = useRef(myRank);
  myRankRef.current = myRank;
  useEffect(() => { setAdsBlocked(!adsAllowedFor(myRank, isOwnerAccount)); }, [myRank, isOwnerAccount]);
  const myTierRef = useRef(myTier);
  myTierRef.current = myTier;
  const isOwnerRef = useRef(isOwnerAccount);
  isOwnerRef.current = isOwnerAccount;
  // ---- Tags in front of names: fake ranks (/rank) and the real ones (owner, paid rank, creator tier) ----
  const [fakeRanks, setFakeRanksState] = useState<FakeRanks>(() => emptyRanks());
  const fakeRanksRef = useRef(fakeRanks);
  const badgesRef = useRef<Record<string, NetBadge>>({}); // lowercase player name -> badge, for other players on a server
  const [, setBadgeTick] = useState(0);
  const applyFakeRanks = (r: FakeRanks) => { fakeRanksRef.current = r; setFakeRanksState(r); };
  /** Everything shown in front of a name (with a trailing space), as text with colour codes. '' if there is none. */
  function tagsFor(name: string): string {
    const parts: string[] = [];
    const fr = rankTagOf(fakeRanksRef.current, name);
    if (fr) parts.push(`${fr}\\reset\\`);
    const me = name.toLowerCase() === (usernameRef.current || '').toLowerCase();
    const a = accountRef.current;
    const badge: NetBadge | undefined = me ? (a && !isGuestName(a.username) ? { owner: isOwnerRef.current, rank: myRankRef.current, tier: myTierRef.current } : undefined) : badgesRef.current[name.toLowerCase()];
    parts.push(...badgeTags(badge));
    return parts.length ? parts.join(' ') + ' ' : '';
  }
  /** The same without colour codes (for places that cannot show them). */
  const plainTags = (name: string) => stripFancy(tagsFor(name));
  /** Pushes everyone's tags onto the name plates over their heads. */
  function refreshNameTags() {
    const h = gameHandleRef.current;
    if (!h) return;
    for (const [id, name] of Object.entries(onlineNamesRef.current) as Array<[string, string]>) if (Number(id) !== myNetIdRef.current) h.setRemoteTag(Number(id), `${tagsFor(name)}${name}`);
  }
  /** The host changes the fake ranks: saved with the world, and sent to everyone on a server. */
  function commitFakeRanks(next: FakeRanks) {
    applyFakeRanks(next);
    const mp = mpRef.current;
    if (mp?.connected) mp.sendRanks(next);
    if (!mp?.connected || hostingRef.current) saveFakeRanks(activeWorldIdRef.current, next); // your own world keeps them
    refreshNameTags();
  }

  useEffect(() => {
    if (!account || isGuestName(account.username)) { setStanding(null); return; }
    let alive = true;
    const load = () => { void fetchStanding(account.username).then((st) => { if (alive) setStanding(st); }); };
    load();
    const timer = window.setInterval(load, 5 * 60_000);
    return () => { alive = false; window.clearInterval(timer); };
  }, [account?.username]);
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
  useEffect(() => {
    if (gameMode !== 'playing') { applyFakeRanks(emptyRanks()); badgesRef.current = {}; return; }
    if (!mpRef.current?.connected) applyFakeRanks(loadFakeRanks(activeWorldIdRef.current));
  }, [gameMode]);
  // Breath, effects, the boss bar, your ping and the minigame score
  const [air, setAir] = useState(10);
  const [effectsList, setEffectsList] = useState<Array<{ name: string; level: number; seconds: number }>>([]);
  const [bossBar, setBossBar] = useState<{ name: string; health: number; max: number; charging: boolean; hardened: boolean } | null>(null);
  const [ping, setPing] = useState<number | null>(null);
  const [minigame, setMinigame] = useState<MinigameView | null>(null);
  const minigameDifficultyRef = useRef<BotDifficulty>('normal');
  const minigameSizeRef = useRef<MinigameSize>('solo');
  // "N playing" on the home cards: what everyone is playing right now (and we tell it what we play)
  const [playingCounts, setPlayingCounts] = useState<Record<string, number> | null>(null);
  const activityRef = useRef<Activity | null>(null);
  useEffect(() => {
    if (gameMode !== 'menu') return;
    let alive = true;
    const load = () => { void fetchPlayingCounts().then((c) => { if (alive && c) setPlayingCounts(c); }); };
    load();
    const t = window.setInterval(load, 30_000);
    return () => { alive = false; window.clearInterval(t); };
  }, [gameMode]);
  useEffect(() => {
    if (gameMode !== 'playing') return;
    let lastE = '', lastB = '';
    const t = window.setInterval(() => {
      const h = gameHandleRef.current;
      if (!h) return;
      const e = h.getEffects();
      const je = JSON.stringify(e);
      if (je !== lastE) { lastE = je; setEffectsList(e); }
      const b = h.getBossBar();
      const jb = JSON.stringify(b ? { ...b, health: Math.round(b.health) } : null);
      if (jb !== lastB) { lastB = jb; setBossBar(b); }
    }, 250);
    return () => window.clearInterval(t);
  }, [gameMode]);
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
  const [serverMax, setServerMax] = useState<number | null>(null);
  const [joiningFriend, setJoiningFriend] = useState(false);
  const friendJoinErrorRef = useRef(false);
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
  // Touch screens (phones, tablets): on-screen controls instead of mouse and keyboard
  const [touchPref, setTouchPrefState] = useState<TouchPref>(loadTouchPref);
  const touchOn = touchEnabled(touchPref);
  const touchOnRef = useRef(touchOn);
  touchOnRef.current = touchOn;
  useEffect(() => { if (touchOn) lockViewportForTouch(); }, [touchOn]);
  useEffect(() => { gameHandleRef.current?.setTouchMode(touchOn); }, [touchOn]);
  useEffect(() => {
    const f = (e: Event) => setTouchPrefState((e as CustomEvent<TouchPref>).detail);
    window.addEventListener('vb-touch', f);
    return () => window.removeEventListener('vb-touch', f);
  }, []);
  // The first-time tutorial (only ever shown once, and it can be skipped)
  const [showTutorial, setShowTutorial] = useState(false);
  const blockListenerRef = useRef<((type: 'break' | 'place') => void) | null>(null);
  const [serverSettings, setServerSettings] = useState<ServerSettings>(DEFAULT_SERVER);
  const serverSettingsRef = useRef<ServerSettings>(DEFAULT_SERVER);
  const [hostId, setHostId] = useState<number | null>(null);
  const [xpState, setXpState] = useState({ level: 0, progress: 0 });
  const [cmdBlock, setCmdBlock] = useState<CommandBlockInfo | null>(null);
  const cmdBlockRef = useRef(false);
  const [openStation, setOpenStation] = useState<Station | null>(null);
  const [weather, setWeather] = useState<WeatherKind>('clear');
  const weatherRef = useRef<WeatherKind>('clear');
  weatherRef.current = weather;
  const savedWorldsRef = useRef(savedWorlds);
  savedWorldsRef.current = savedWorlds;
  const activeSeedRef = useRef(activeSeed);
  activeSeedRef.current = activeSeed;
  /** Where you are playing online right now ("p2p:<id>" for a hosted world): friends get a Join button for it. */
  const joinedAddressRef = useRef<string | null>(null);
  const [myNetId, setMyNetId] = useState<number | null>(null);
  // Minigames, and worlds that belong to somebody else, have no cheats: no commands, mods, scripts or server admin.
  // Advancements are for survival worlds only.
  const isMinigame = activeWorldType === 'eggwars' || activeWorldType === 'bridge';
  const ownsWorld = !isMinigame && !(netStatus === 'online' && hostId !== myNetId);
  const advAllowed = !isMinigame && activeWorldMode === 'survival';
  const ownsWorldRef = useRef(true);
  ownsWorldRef.current = ownsWorld;
  const isMinigameRef = useRef(false);
  isMinigameRef.current = isMinigame;
  const advAllowedRef = useRef(true);
  advAllowedRef.current = advAllowed;
  const [oneBlock, setOneBlock] = useState<OneBlockView | null>(null);
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
  /** Shows a big title (colour codes and effects work: \\green\\\\shiny\\ Hello). */
  function showTitle(text: string, sub = '', seconds = 3) {
    setTitleCard({ text: String(text).slice(0, 160), sub: String(sub).slice(0, 200), id: Date.now() + Math.random() });
    window.clearTimeout(titleTimerRef.current);
    titleTimerRef.current = window.setTimeout(() => setTitleCard(null), Math.max(1, Math.min(30, seconds)) * 1000);
  }
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
  const [hudPrefs, setHudPrefs] = useState<HudPrefs>({ ...DEFAULT_HUD, ...(savedSettings.hudPrefs ?? {}), coords: false, facing: false, clock: false, speed: false, minimap: false });
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

  // Minigames and other people's worlds: whatever mods or scripts were running stop
  useEffect(() => {
    if (gameMode !== 'playing' || ownsWorld) return;
    getRunner().stopAll();
    setRunningScripts([]);
  }, [gameMode, ownsWorld]);

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
    const look = currentLook();
    gameHandleRef.current?.setPlayerLook(look);
    gameHandleRef.current?.setOwnSkin(look.skin); // a player head you get shows your skin
    mpRef.current?.sendLook(look);
  }, [progress.currentSkin, progress.currentCape, progress.customSkin, gameMode]);

  // Soundtrack — lifted up to App level (rather than living inside
  // SettingsView) so playback survives navigating to other sidebar panels
  // and continues even while actually playing the game, since this <audio>
  // element itself never unmounts.
  const [trackName, setTrackName] = useState<string | null>(null);
  const [builtInTrack, setBuiltInTrack] = useState<SoundtrackStyle | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(savedSettings.volume ?? 0.5);

  // Remember settings between visits
  useEffect(() => {
    const settings: SavedSettings = { renderDistance, graphicsQuality, gfxV: 2, fov, sfxVolume, hudPrefs, craftMode, volume, textureRes };
    try { localStorage.setItem('vb-settings', JSON.stringify(settings)); } catch { /* storage blocked */ }
  }, [renderDistance, graphicsQuality, fov, sfxVolume, hudPrefs, craftMode, volume, textureRes]);
  const audioRef = useRef<HTMLAudioElement>(null);
  const objectUrlRef = useRef<string | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const musicRef = useRef<MusicPlayer | null>(null);

  useEffect(() => {
    return () => {
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
      musicRef.current?.stop();
      audioCtxRef.current?.close();
    };
  }, []);

  function getAudioCtx(): AudioContext {
    if (!audioCtxRef.current) {
      audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    return audioCtxRef.current;
  }

  function getMusic(): MusicPlayer {
    if (!musicRef.current) musicRef.current = new MusicPlayer(getAudioCtx);
    return musicRef.current;
  }
  function stopBuiltInSource() { musicRef.current?.stop(); }

  /** Starts a soundtrack: a playlist of several tracks that follow one another. */
  function playBuiltInTrack(style: SoundtrackStyle) {
    audioRef.current?.pause(); // stop any uploaded file first
    const m = getMusic();
    m.setVolume(volume);
    m.start(style);
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
      const m = musicRef.current;
      if (!m) return;
      if (isPlaying) m.pause(); else m.resume();
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
    musicRef.current?.setVolume(v);
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
      if (isCapturingKey()) return; // the Controls screen is waiting for a key
      if (chatOpenRef.current || helpOpenRef.current) {
        if (e.key === 'Escape') {
          e.preventDefault();
          e.stopPropagation(); // keep the engine from treating this Esc as "leave game"
          if (chatOpenRef.current) closeChat();
          else closeHelp();
        }
        return;
      }
      if (e.key === 'Escape' && gameMode !== 'playing' && panelOpenRef.current) { e.preventDefault(); closePanel(); return; } // the Admin panel opened from Settings or Social
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
      if (inventoryOpenRef.current) return; // the inventory uses 1-9 to move the hovered item into the hotbar
      const match = e.code.match(/^Digit([1-9])$/);
      if (match) setSelectedSlot(parseInt(match[1], 10) - 1);
    };
    const handleWheel = (e: WheelEvent) => {
      if (chatOpenRef.current || helpOpenRef.current) return;
      // A menu or panel is open (inventory, scripts, shop, settings...): the wheel scrolls it and never touches the hotbar
      if (menuOpenRef.current || inventoryOpenRef.current || panelOpenRef.current || tradingRef.current || cmdBlockRef.current || deadRef.current) return;
      for (let el = e.target as HTMLElement | null; el && el !== document.body; el = el.parentElement) {
        if (!(el instanceof HTMLElement)) break;
        const oy = getComputedStyle(el).overflowY;
        if ((oy === 'auto' || oy === 'scroll') && el.scrollHeight > el.clientHeight + 1) return; // scrollable thing under the pointer
      }
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
      handle.setOwnSkin(currentLook().skin);
      setAir(10);
      handle.onAirChange((b) => setAir(b));
      setMinigame(null);
      setEffectsList([]);
      setBossBar(null);
      handle.onMinigame((v) => setMinigame(v));
      setOneBlock(null);
      handle.onOneBlock((v) => setOneBlock(v));
      if (activeWorldType === 'eggwars' || activeWorldType === 'bridge') handle.startMinigame(minigameDifficultyRef.current, minigameSizeRef.current);
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
        if (!t) { if (tradingRef.current) closeTrade(); return; } // the inventory key closed the shop
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
      handle.setTouchMode(touchOnRef.current);
      // First time ever in a world (not a minigame): the tutorial
      if (!tutorialDone() && activeWorldType !== 'eggwars' && activeWorldType !== 'bridge') setShowTutorial(true);
      if (touchOnRef.current) { try { const el = document.documentElement; if (!document.fullscreenElement && el.requestFullscreen) void el.requestFullscreen().then(() => (screen.orientation as unknown as { lock?: (o: string) => Promise<void> })?.lock?.('landscape')).catch(() => {}); } catch { /* not allowed */ } }
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
      // Your own world opens to others (as its privacy allows) a moment after it has loaded
      if (worldId && !mpRef.current) window.setTimeout(() => { if (gameHandleRef.current === handle) void maybeStartHostingRef.current(); }, 1200);
      handle.onEngineEvent((name, data) => {
        if (name === 'oneblockPhase') setHint(t('ob.newPhase', { name: t('ob.' + String(data.name)) }));
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
        blockListenerRef.current?.(type);
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

  // Video settings (clouds, stars, fast render, frame cap...) go straight to the running game
  useEffect(() => subscribeVideo(() => gameHandleRef.current?.setVideoPrefs(getVideo())), []);

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
      if (e.code === 'KeyL') { if (advAllowedRef.current) openGameMenu('advancements'); return; }
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
      if (touchOnRef.current) return; // touch screens never use the mouse lock (the ❚❚ button opens the menu)
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
    if (wid && (!mpRef.current || hostingRef.current)) setSavedWorlds((prev) => prev.map((w) => (w.id === wid ? { ...w, difficulty: st.difficulty, keepInventory: st.keepInventory } : w)));
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
    if (!advAllowedRef.current) return; // advancements are for survival worlds only (none in creative, adventure, EggWars or Bridge Duels)
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
    if ((page === 'server' || page === 'scripts' || page === 'mods') && !ownsWorldRef.current) page = 'main';
    if (page === 'advancements' && !advAllowedRef.current) page = 'main';
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

  /** Join a server by address, or a world someone is hosting ("p2p:<id>", from the Servers list or a friend). */
  function joinServer(address?: string, hostName?: string) {
    if (address === undefined) friendJoinErrorRef.current = false; // a click on the Servers page, not on a friend
    const load = Object.values(multiplayerModules)[0];
    if (!load) {
      setNetError("Multiplayer isn't installed in this copy of the game (src/multiplayer.ts is missing).");
      return;
    }
    const p2p = (address ?? serverUrl).trim().startsWith('p2p:');
    Promise.all([load(), p2p ? loadHosting() : Promise.resolve(null)])
      .then(([m, hm]) => connectWith((m as { MultiplayerClient: new () => MpClient }).MultiplayerClient, address, { hosting: hm, hostName }))
      .catch(() => setNetError('Could not load the multiplayer module.'));
  }

  /** via.hostSocket: this is your own world, and you connect to the room your browser runs (nothing reloads). */
  function connectWith(MP: new () => MpClient, address?: string, via: { hostSocket?: unknown; hosting?: HostingMod | null; hostName?: string } = {}) {
    const hostingSelf = via.hostSocket !== undefined;
    const url = hostingSelf ? '' : (address ?? serverUrl).trim();
    const p2p = url.startsWith('p2p:');
    if (!hostingSelf && !url) { setNetError('Type a server address first'); return; }
    if (p2p && !via.hosting) { setNetError("Joining worlds isn't installed in this copy of the game (src/hosting.ts is missing)."); return; }
    if (!hostingSelf && !p2p) { try { localStorage.setItem('vb-server', url); } catch { /* storage may be blocked */ } }
    if (!hostingSelf) joinedAddressRef.current = url;
    mpRef.current?.disconnect();
    const mp = new MP();
    mpRef.current = mp;
    if (!hostingSelf) setNetStatus('connecting');
    setNetError(null);
    earlyBlocksRef.current = [];
    setPing(null);
    mp.events = {
      onPing: (ms) => setPing(ms),
      onWelcome: (w) => {
        if (hostingSelf) {
          // Your own world: you stay right where you are, now with the door open
          myNetIdRef.current = w.id;
          mp.sendLook(currentLook());
          const names: Record<number, string> = { [w.id]: w.name };
          for (const p of w.players) names[p.id] = p.name;
          onlineNamesRef.current = names;
          setOnlinePlayers(names);
          setMyNetId(w.id);
          setHostId(w.hostId ?? w.id);
          setServerMax(typeof w.maxPlayers === 'number' ? w.maxPlayers : null);
          const h = gameHandleRef.current;
          h?.setNetEnabled(true);
          h?.setWeatherAuto(false); // your room decides the weather now, for everyone
          h?.setSleepOnline(true);
          setNetStatus('online');
          return;
        }
        myNetIdRef.current = w.id;
        mp.sendLook(currentLook());
        pendingWelcomeRef.current = w;
        const names: Record<number, string> = { [w.id]: w.name };
        for (const p of w.players) names[p.id] = p.name;
        badgesRef.current = {};
        for (const p of w.players) if (p.badge) badgesRef.current[p.name.toLowerCase()] = p.badge;
        applyFakeRanks(cleanFakeRanks(w.ranks));
        onlineNamesRef.current = names;
        setOnlinePlayers(names);
        setMyNetId(w.id);
        setHostId(w.hostId ?? null);
        setServerMax(typeof w.maxPlayers === 'number' ? w.maxPlayers : null);
        // Joining someone's game counts as a play for them (the database ignores repeats and your own)
        { const hostName = w.hostId != null ? names[w.hostId] : undefined; const me = accountRef.current; if (hostName && w.hostId !== w.id && me && !isGuestName(me.username)) void recordPlay(hostName); }
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
        if (hostingSelf) { h?.applyRemoteBlocks(list, true); return; } // other players' edits become part of your saved world
        if (h && !pendingWelcomeRef.current) h.applyRemoteBlocks(list);
        else earlyBlocksRef.current.push(...list); // arrived while the world was still loading
      },
      onMoves: (list) => {
        const h = gameHandleRef.current;
        if (!h) return;
        for (const [id, x, y, z, yaw, pitch, mode, held, act] of list) {
          if (id === myNetIdRef.current) continue;
          const nm = onlineNamesRef.current[id] ?? 'Player';
          h.setRemotePlayer(id, nm, x, y, z, yaw, pitch, mode, held, act);
          h.setRemoteTag(id, `${tagsFor(nm)}${nm}`);
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
      onChat: (name, text) => pushMessage(`<${tagsFor(name)}${name}> ${text}`),
      onTitle: (text, sub) => showTitle(text, sub),
      onRanks: (r) => { applyFakeRanks(cleanFakeRanks(r)); refreshNameTags(); },
      onBadge: (id, badge) => {
        const nm = onlineNamesRef.current[id];
        if (!nm) return;
        badgesRef.current = { ...badgesRef.current, [nm.toLowerCase()]: badge };
        setBadgeTick((n) => n + 1);
        refreshNameTags();
      },
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
        if (hostingSelf) { stopHostingRef.current(true); return; } // (only if your own room shut down by itself)
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
    const token = accountRef.current?.token ?? null;
    if (hostingSelf) mp.connectSocket(via.hostSocket, username ?? 'Player', token, 'Could not open your world to other players', 10_000);
    else if (p2p) {
      const who = via.hostName ?? 'that';
      mp.connectSocket(via.hosting!.openPeerSocket(url.slice(4), signalingFor(via.hosting!), via.hostName ?? 'the host'), username ?? 'Player', token,
        `Couldn't connect to ${who === 'that' ? 'that' : who + "'s"} world. It may have closed, or a network may be blocking direct connections.`, 45_000);
    } else mp.connect(url, username ?? 'Player', token);
  }

  // ---------------- Hosting: your world, open to others while you play ----------------
  type Hosting = { id: string; room: HostRoomLike; peer: { start(): Promise<void>; stop(): void }; worldId: string; privacy: WorldPrivacy; name: string; mode: string; worldType: string; max: number; timer: number };
  const hostingRef = useRef<Hosting | null>(null);
  const [hostingInfo, setHostingInfo] = useState<{ privacy: WorldPrivacy; players: number } | null>(null);
  function publishHosting() {
    const hs = hostingRef.current, me = accountRef.current;
    if (!hs || !me) return;
    void publishHostedWorld(me, { id: hs.id, name: hs.name, mode: hs.mode, worldType: hs.worldType, privacy: hs.privacy, players: hs.room.count, max: hs.max });
    void setServerPresence('p2p:' + hs.id);
  }
  /** Opens the world you're playing to others (unless it's private, you're a guest, or it's a minigame). */
  async function maybeStartHosting() {
    if (hostingRef.current || mpRef.current) return;
    const worldId = activeWorldIdRef.current, h = gameHandleRef.current, me = accountRef.current;
    if (!worldId || !h || !me || isGuestName(me.username) || !multiplayerAvailable || !hostingAvailable) return;
    const cfg = savedWorldsRef.current.find((w) => w.id === worldId);
    if (!cfg) return;
    const privacy = cfg.privacy ?? 'public';
    if (privacy === 'private' || !HOSTABLE_TYPES.includes(cfg.worldType ?? 'default')) return;
    const load = Object.values(multiplayerModules)[0];
    const [mpMod, hMod] = await Promise.all([load ? load().catch(() => null) : null, loadHosting()]);
    if (!mpMod || !hMod) return;
    if (gameHandleRef.current !== h || activeWorldIdRef.current !== worldId || hostingRef.current || mpRef.current) return; // things moved on meanwhile
    const save = h.getSaveData();
    const mode = cfg.mode === 'creative' || cfg.mode === 'adventure' ? cfg.mode : 'survival';
    const worldType = cfg.worldType === 'superflat' ? 'superflat' : 'default';
    const max = playerCap(isOwnerRef.current ? 'star' : myTierRef.current);
    const id = hMod.randomId(16);
    const room = new hMod.HostRoom({
      seed: activeSeedRef.current, worldType, mode, changes: save.edits, time: save.time, weather: weatherRef.current,
      settings: serverSettingsRef.current, ranks: fakeRanksRef.current, experimental: !!cfg.experimental, privacy, hostName: me.username, maxPlayers: max, bans: cfg.bans ?? [],
      services: {
        verify: verifyToken,
        isFriend: (uid: string) => isFriendOf(me.userId, uid),
        isBanned: isBannedName,
        isAdmin: isAdminToken,
        standing: async (name: string) => { const st = await fetchStanding(name); return { rank: st?.rank ?? 'none', tier: creatorTier(st?.plays ?? 0) }; },
      },
      onCount: (n: number) => { setHostingInfo((x) => (x ? { ...x, players: n } : x)); publishHosting(); },
      onBans: (bans: string[]) => setSavedWorlds((prev) => prev.map((w) => (w.id === worldId ? { ...w, bans } : w))),
    });
    const peer = new hMod.PeerHost(id, signalingFor(hMod), room);
    hostingRef.current = { id, room, peer, worldId, privacy, name: cfg.name, mode, worldType, max, timer: 0 };
    joinedAddressRef.current = 'p2p:' + id;
    connectWith((mpMod as { MultiplayerClient: new () => MpClient }).MultiplayerClient, undefined, { hostSocket: hMod.loopback(room) });
    setHostingInfo({ privacy, players: 1 });
    peer.start().then(() => {
      if (hostingRef.current?.id !== id) return;
      pushMessage(`Your world is open (${PRIVACY_INFO[privacy].label}): ${privacy === 'friends' ? 'your friends can join from Social' : 'others can join from the Servers page'}. Change it in Manage Server.`, '#7cfc7c');
    }).catch(() => {
      if (hostingRef.current?.id === id) pushMessage("Couldn't open your world to other players right now (the matchmaking service didn't answer). You can keep playing.", '#ff9a3c');
    });
    publishHosting();
    hostingRef.current.timer = window.setInterval(publishHosting, 20_000);
  }
  /** Closes your world to others. stillPlaying: you stay in it (it was made private). */
  function stopHosting(stillPlaying: boolean) {
    const hs = hostingRef.current;
    if (!hs) return;
    hostingRef.current = null;
    setHostingInfo(null);
    window.clearInterval(hs.timer);
    hs.peer.stop();
    if (mpRef.current) { mpRef.current.disconnect(); mpRef.current = null; }
    hs.room.stop();
    void unpublishHostedWorld(hs.id);
    void setServerPresence(null);
    joinedAddressRef.current = null;
    if (stillPlaying) {
      const h = gameHandleRef.current;
      if (h) {
        h.setNetEnabled(false);
        h.setWeatherAuto(true);
        h.setSleepOnline(false);
        for (const k of Object.keys(onlineNamesRef.current)) if (Number(k) !== myNetIdRef.current) h.removeRemotePlayer(Number(k));
      }
      setNetStatus('offline');
      onlineNamesRef.current = {};
      setOnlinePlayers({});
      setHostId(null);
    }
  }
  const stopHostingRef = useRef(stopHosting);
  stopHostingRef.current = stopHosting;
  const maybeStartHostingRef = useRef(maybeStartHosting);
  maybeStartHostingRef.current = maybeStartHosting;
  /** Manage Server: who may join this world. Takes effect at once. */
  function setWorldPrivacy(p: WorldPrivacy) {
    const id = activeWorldIdRef.current;
    if (!id) return;
    savedWorldsRef.current = savedWorldsRef.current.map((w) => (w.id === id ? { ...w, privacy: p } : w));
    setSavedWorlds((prev) => prev.map((w) => (w.id === id ? { ...w, privacy: p } : w)));
    const hs = hostingRef.current;
    if (p === 'private') {
      if (hs) { stopHosting(true); pushMessage('Your world is private now: other players were sent home.', '#ffe066'); }
    } else if (hs) {
      hs.privacy = p;
      hs.room.setPrivacy(p);
      setHostingInfo((x) => (x ? { ...x, privacy: p } : x));
      publishHosting();
      pushMessage(`Who can join: ${PRIVACY_INFO[p].label}.`, '#ffe066');
    } else void maybeStartHosting();
  }

  // Friends see which server you are on (and get a Join button) while you play online
  useEffect(() => {
    if (netStatus !== 'online' || !account || isGuestName(account.username) || hostingRef.current) return; // (hosting keeps its own)
    const address = (joinedAddressRef.current ?? serverUrl).trim();
    if (!address) return;
    void setServerPresence(address);
    const timer = window.setInterval(() => { void setServerPresence(address); }, 30_000);
    return () => { window.clearInterval(timer); void setServerPresence(null); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [netStatus, account?.userId]);

  /** Social > Join: connect to the server a friend is playing on. */
  function joinFriend(friend: Friend) {
    if (!friend.server) return;
    if (netStatus === 'connecting') return;
    if (!friend.server.startsWith('p2p:')) setServerUrl(friend.server);
    setJoiningFriend(true);
    friendJoinErrorRef.current = true;
    joinServer(friend.server, friend.username);
  }
  useEffect(() => { if (netStatus !== 'connecting') setJoiningFriend(false); }, [netStatus]);

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
      case 'schematics.list': {
        const names = new Set<string>([...Object.values(loadLibrary()).map((x) => x.name), ...bundledSchematics().map((x) => x.name)]);
        return [...names];
      }
      case 'schematics.info': {
        const env = makeSchemEnv(() => undefined, () => undefined);
        const k = nameKey(String(args[0] ?? ''));
        const sc = loadLibrary()[k] ?? env.bundled?.().find((x) => nameKey(x.name) === k) ?? null;
        return sc ? { name: sc.name, w: sc.w, h: sc.h, d: sc.d } : null;
      }
      case 'schematics.paste': {
        const o = obj(args[4]);
        const rot = Number(o.rotate ?? 0);
        if (![0, 90, 180, 270].includes(rot)) throw new Error('rotate must be 0, 90, 180 or 270');
        const at: [number, number, number] = [Math.floor(num(args[1], 'x')), Math.floor(num(args[2], 'y')), Math.floor(num(args[3], 'z'))];
        return pasteByName(String(args[0] ?? ''), at, { rotate: rot, flipX: !!o.flipX, flipZ: !!o.flipZ, skipAir: !!o.skipAir }, makeSchemEnv(() => undefined, () => undefined)).then((r) => {
          if (!r.ok) throw new Error(r.error);
          return { placed: r.placed, total: r.total, w: r.w, h: r.h, d: r.d };
        });
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
      case 'commands.run': {
        const raw = String(args[0] ?? '').slice(0, 512);
        const word = (/^\s*\/?\s*(\S+)/.exec(raw)?.[1] ?? '').toLowerCase();
        if (!SCRIPT_COMMANDS.has(word)) throw new Error(`Scripts can run: ${[...SCRIPT_COMMANDS].join(', ')}. Use the game.* functions for the rest.`);
        const st = S.getNetState();
        const res = runCommandRef.current(raw.startsWith('/') ? raw : '/' + raw, { x: Math.floor(st.x), y: Math.floor(st.y), z: Math.floor(st.z) });
        return { success: res.success, output: res.output };
      }
      case 'gui.toast':
        setHint(String(args[0]).slice(0, 120));
        window.clearTimeout(hintTimerRef.current);
        hintTimerRef.current = window.setTimeout(() => setHint(null), 2200);
        return null;
      case 'gui.title':
        showTitle(String(args[0]), String(args[1] ?? ''), Number(args[2]) > 0 ? Number(args[2]) : 3);
        return null;
      case 'gui.sidebar': {
        const lines = Array.isArray(args[1]) ? (args[1] as unknown[]).slice(0, 15).map((l) => String(l).slice(0, 80)) : [];
        setSidebar({ title: String(args[0]).slice(0, 80), lines });
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
        if (!['flat', 'void', 'islands', 'caves', 'hills', 'mountains'].includes(type)) throw new Error('type must be flat, void, islands, caves, hills or mountains');
        const blk = (v: unknown, fallback: number) => (v === undefined || v === null ? fallback : blockIdFromName(v));
        const WOODS: Record<string, number> = { none: -1, oak: 0, birch: 1, spruce: 2, jungle: 3 };
        const trees = o.trees === undefined || o.trees === null || o.trees === false ? -1 : WOODS[String(o.trees === true ? 'oak' : o.trees).toLowerCase()];
        if (trees === undefined) throw new Error('trees must be "oak", "birch", "spruce", "jungle" or "none"');
        const plants = Array.isArray(o.plants) ? (o.plants as unknown[]).slice(0, 8).map((v) => blockIdFromName(v)) : [];
        const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
        const optNum = (v: unknown, name: string) => (v === undefined || v === null ? undefined : num(v, name));
        const height = optNum(o.height, 'height'), amplitude = optNum(o.amplitude, 'amplitude'), scale = optNum(o.scale, 'scale');
        const waterLevel = optNum(o.waterLevel, 'waterLevel'), gravity = optNum(o.gravity, 'gravity');
        const treeChance = optNum(o.treeChance, 'treeChance'), plantChance = optNum(o.plantChance, 'plantChance');
        S.createDimension({
          id, name: String(o.name ?? id).slice(0, 30), type: type as DimensionSpec['type'],
          top: blk(o.top, BLOCK_GRASS), filler: blk(o.filler, BLOCK_DIRT), base: blk(o.base, BLOCK_STONE), liquid: blk(o.liquid, 0),
          sky: color(o.sky, '#87ceeb'), fog: color(o.fog, '#b8dcf0'), light: Math.max(0, Math.min(1, opt(o.light, 1, 'light'))),
          ...(height !== undefined ? { height: clamp(height, 4, 50) } : {}),
          ...(amplitude !== undefined ? { amplitude: clamp(amplitude, 0, 40) } : {}),
          ...(scale !== undefined ? { scale: clamp(scale, 0.002, 0.2) } : {}),
          ...(waterLevel !== undefined ? { waterLevel: clamp(Math.floor(waterLevel), -1, 60) } : {}),
          trees, ...(treeChance !== undefined ? { treeChance: clamp(treeChance, 0, 0.2) } : {}),
          ores: o.ores === true,
          plants, ...(plantChance !== undefined ? { plantChance: clamp(plantChance, 0, 0.5) } : {}),
          ...(gravity !== undefined ? { gravity: clamp(gravity, 0.1, 3) } : {}),
          stars: o.stars === true, clouds: o.clouds === true,
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
        budgetMs: () => budgetRef.current,
      });
    }
    return runnerRef.current;
  }

  const allMods = () => [...OFFICIAL_MODS, ...modsStateRef.current.custom];

  function startEnabledMods() {
    if (!ownsWorldRef.current) return; // no mods in minigames or in worlds you don't own
    const runner = getRunner();
    for (const m of allMods()) if (modsStateRef.current.enabled.includes(m.id)) runner.run(`mod:${m.id}`, m.name, m.code);
  }

  function toggleMod(m: Mod) {
    const on = !modsStateRef.current.enabled.includes(m.id);
    setModsState((st) => ({ ...st, enabled: on ? [...st.enabled, m.id] : st.enabled.filter((x) => x !== m.id) }));
    if (gameModeRef.current === 'playing') {
      if (on && ownsWorldRef.current) getRunner().run(`mod:${m.id}`, m.name, m.code);
      else getRunner().stop(`mod:${m.id}`);
    }
  }

  function saveMod(m: Mod) {
    const mod: Mod = { ...m, id: m.id || `c-${newWorldId()}`, official: false };
    setModsState((st) => ({ ...st, custom: st.custom.some((x) => x.id === mod.id) ? st.custom.map((x) => (x.id === mod.id ? mod : x)) : [...st.custom, mod] }));
    // Restart it so edits take effect right away
    if (gameModeRef.current === 'playing' && ownsWorldRef.current && modsStateRef.current.enabled.includes(mod.id)) getRunner().run(`mod:${mod.id}`, mod.name, mod.code);
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
    if (gameModeRef.current === 'playing' && ownsWorldRef.current) getRunner().run(`mod:${id}`, mod.name, mod.code);
  }

  function forkMod(m: Mod) {
    saveMod({ ...m, id: '', name: `${m.name} (fork)`, author: username ?? 'You', official: false });
  }

  function deleteMod(m: Mod) {
    getRunner().stop(`mod:${m.id}`);
    setModsState((st) => ({ ...st, custom: st.custom.filter((x) => x.id !== m.id), enabled: st.enabled.filter((x) => x !== m.id), starred: st.starred.filter((x) => x !== m.id) }));
  }

  /** Returns an error, null when all went in, or 'SKIPPED:n' when the mod went in but n of its schematics were not usable. */
  function importMod(json: string): string | null {
    try {
      if (json.length > 8_000_000) return 'That mod is too big.';
      const d = JSON.parse(json) as Partial<Mod> & { magic?: string };
      if (typeof d.name !== 'string' || typeof d.code !== 'string') return 'That doesn\'t look like a mod (it needs a name and code).';
      if (d.code.length > 100_000) return 'That mod is too big.';
      // Schematics that come with the mod (checked one by one; the bad ones are skipped)
      const schematics: Schematic[] = [];
      let skipped = 0;
      if (Array.isArray(d.schematics)) {
        for (const raw of d.schematics.slice(0, MAX_MOD_SCHEMATICS)) {
          const v = validateSchematic(raw);
          if (typeof v === 'string') skipped++; else schematics.push(v);
        }
        skipped += Math.max(0, d.schematics.length - MAX_MOD_SCHEMATICS);
      }
      saveMod({
        id: '', name: d.name.slice(0, 40), author: String(d.author ?? 'Unknown').slice(0, 30), description: String(d.description ?? '').slice(0, 120),
        code: d.code, official: false, version: typeof d.version === 'string' ? d.version.slice(0, 16) : undefined, schematics: schematics.length ? schematics : undefined,
      });
      return skipped ? `SKIPPED:${skipped}` : null;
    } catch {
      return 'Couldn\'t read that. Paste exactly what the Export button copied.';
    }
  }

  function updateScript(id: string, patch: Partial<ScriptDoc>) {
    setScripts((list) => list.map((sc) => (sc.id === id ? { ...sc, ...patch } : sc)));
  }

  function runScript(sc: ScriptDoc) {
    if (!ownsWorldRef.current) return; // no scripts in minigames or in worlds you don't own
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
      else pushMessage(`<${tagsFor(username ?? 'Player')}${username ?? 'Player'}> ${text}`);
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

  /** What the /schem commands (and scripts) need from the game. */
  function makeSchemEnv(out: (t: string) => void, fail: (t: string) => void): SchemEnv {
    const h = gameHandleRef.current!;
    return {
      readBlocks: (x0, y0, z0, x1, y1, z1) => { const r = h.readBlocks(x0, y0, z0, x1, y1, z1); return { ...r, ids: Array.from(r.ids) }; },
      setBlocks: (list) => h.setBlocks(list),
      getSelection: () => h.getSelection(),
      where: () => { const st = h.getNetState(); return [Math.floor(st.x), Math.floor(st.y), Math.floor(st.z)]; },
      maxY: CHUNK_HEIGHT - 1,
      out, fail,
      idOf: (key) => { try { return customIdForKey(key.toLowerCase()) ?? null; } catch { return null; } },
      keyOf: (id) => CUSTOM_BLOCKS.get(id)?.key ?? id,
      rotateId: rotateBlockId,
      mirrorId: mirrorBlockId,
      download: (filename, text) => downloadFile(filename, text),
      pickFile: () => pickTextFile('.vbschem,.json'),
      bundled: bundledSchematics,
      alive: () => gameHandleRef.current === h,
    };
  }

  /** Schematics that come with the mods that are switched on. */
  function bundledSchematics(): Schematic[] {
    const on = modsStateRef.current.enabled;
    const out: Schematic[] = [];
    for (const m of allMods()) if (on.includes(m.id) && m.schematics) out.push(...m.schematics);
    return out;
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
    const args = parts.slice(1); // selectors (@p, @s, @a, @e, @r) and player names stay: commands use them as targets
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
    // ---- Targets: @s, @p, @a, @r, @e (with [type=...], [distance=..N], [limit=N]) or a player's name ----
    type Target = { who: 'you'; name: string; x: number; y: number; z: number } | { who: 'player'; id: number; name: string; x: number; y: number; z: number } | { who: 'mob'; id: number; kind: string; name: string; x: number; y: number; z: number };
    const meName = usernameRef.current || 'You';
    const isTargetToken = (t: string | undefined) => !!t && (/^@[psare](\[.*\])?$/i.test(t) || (/^[A-Za-z0-9_]{3,16}$/.test(t) && (t.toLowerCase() === meName.toLowerCase() || h.listPlayers().some((p) => p.name.toLowerCase() === t.toLowerCase()))));
    const resolve = (tok: string): Target[] | string => {
      const o = origin();
      const d = h.getDebugInfo();
      const you: Target = { who: 'you', name: meName, x: d.x, y: d.y, z: d.z };
      const others: Target[] = h.listPlayers().map((p) => ({ who: 'player', id: p.id, name: p.name, x: p.x, y: p.y, z: p.z }));
      const dist = (t: Target) => Math.hypot(t.x - o[0], t.y - o[1], t.z - o[2]);
      const m = /^@([psare])(?:\[(.*)\])?$/i.exec(tok);
      if (!m) {
        if (tok.toLowerCase() === meName.toLowerCase()) return [you];
        const p = others.find((t) => t.name.toLowerCase() === tok.toLowerCase());
        return p ? [p] : `No player named ${tok} here`;
      }
      const kind = m[1].toLowerCase();
      const opts: Record<string, string> = {};
      for (const part of (m[2] ?? '').split(',')) { const [k, v] = part.split('='); if (k && v !== undefined) opts[k.trim().toLowerCase()] = v.trim().toLowerCase(); }
      let list: Target[];
      if (kind === 's') list = [you];
      else if (kind === 'p') list = [[you, ...others].sort((a, b) => dist(a) - dist(b))[0]];
      else if (kind === 'r') { const all = [you, ...others]; list = [all[Math.floor(Math.random() * all.length)]]; }
      else if (kind === 'a') list = [you, ...others];
      else list = [you, ...others, ...h.listEntities().map((e): Target => ({ who: 'mob', id: e.id, kind: e.kind, name: MOB_NAMES[e.kind] ?? e.kind, x: e.x, y: e.y, z: e.z }))];
      if (opts.type) {
        const neg = opts.type.startsWith('!'), want = mobName(opts.type.replace(/^!/, ''));
        const typeOf = (t: Target) => (t.who === 'mob' ? t.kind : 'player');
        list = list.filter((t) => (typeOf(t) === want) !== neg);
      }
      if (opts.distance) {
        const [lo, hi] = opts.distance.includes('..') ? opts.distance.split('..').map((v) => (v === '' ? NaN : Number(v))) : [Number(opts.distance), Number(opts.distance)];
        list = list.filter((t) => (!Number.isFinite(lo) || dist(t) >= lo) && (!Number.isFinite(hi) || dist(t) <= hi + (lo === hi ? 0.5 : 0)));
      }
      if (opts.limit && Number(opts.limit) > 0) list = list.sort((a, b) => dist(a) - dist(b)).slice(0, Number(opts.limit));
      return list;
    };
    /** Targets for a command that only changes your own game (others' games are their own). */
    const onlyYou = (tok: string | undefined, what: string): boolean | null => {
      if (tok === undefined) return true;
      const r = resolve(tok);
      if (typeof r === 'string') { err(r); return null; }
      if (!r.length) { err('No targets matched that selector'); return null; }
      if (!r.some((t) => t.who === 'you')) { err(r.some((t) => t.who === 'mob') ? `You can't ${what} a mob` : `You can only ${what} yourself here. Admins can manage other players with /panel.`); return null; }
      return true;
    };
    if (ctx && (cmd === 'help' || cmd === '?')) { info('Command blocks run commands; /help is for chat.'); return; }
    const SOCIAL = ['friend', 'friends', 'unfriend', 'whisper', 'w', 'msg', 'tell', 'r', 'reply', 'panel'];
    if (SOCIAL.includes(cmd)) {
      if (ctx) { err('That command only works in chat'); return; }
      return runSocialCommand(cmd, args);
    }
    if (!ownsWorldRef.current && cmd !== 'help' && cmd !== '?') { err(isMinigameRef.current ? t('restricted.minigame') : t('restricted.world')); return; } // no cheats in minigames or other people's worlds
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
          err(`Usage: /${cmd} <survival|creative|adventure|spectator> [player]  (or s, c, a, sp)`);
          return;
        }
        if (args[1] !== undefined) {
          const r = resolve(args[1]);
          if (typeof r === 'string') { err(r); return; }
          const others = r.filter((t) => t.who === 'player');
          if (others.length) {
            // other players: only admins, through the server
            if (!adminRef.current || !accountRef.current || !mpRef.current?.connected) { err("You can only change your own game mode. Admins can change other players' with /panel."); return; }
            for (const t of others) mpRef.current.sendAdmin(accountRef.current.token, 'gamemode', { name: t.name, mode: m });
            info(`Set ${others.map((t) => t.name).join(', ')} to ${capitalize(m)} Mode`);
          }
          if (!r.some((t) => t.who === 'you')) { if (!others.length) err('No players matched that selector'); return; }
        }
        h.setGameMode(m);
        setPlayMode(m);
        info(`Set own game mode to ${capitalize(m)} Mode`);
        return;
      }
      case 'tp':
      case 'teleport': {
        const usage = 'Usage: /tp <x> <y> <z> · /tp <player> · /tp <who> <x> <y> <z> · /tp <who> <player>   (~ = where you are; who can be @s, @p, @a, @e[type=...] or a name)';
        if (!args.length || args.length > 4) { err(usage); return; }
        let movers: Target[] = [];
        let dest: { x: number; y: number; z: number; label: string } | null = null;
        const firstIsTarget = isTargetToken(args[0]);
        if (args.length === 3 && !firstIsTarget) { movers = resolve('@s') as Target[]; }
        else if (args.length === 1) {
          if (!firstIsTarget) { err(`${args[0]} isn't a player or selector here. ${usage}`); return; }
          movers = resolve('@s') as Target[];
          const r = resolve(args[0]);
          if (typeof r === 'string') { err(r); return; }
          const t = r.filter((x) => x.who !== 'you')[0] ?? r[0];
          if (!t) { err('No targets matched that selector'); return; }
          dest = { x: t.x, y: t.y, z: t.z, label: t.name };
        } else {
          const r = resolve(args[0]);
          if (typeof r === 'string') { err(r); return; }
          movers = r;
          if (args.length === 2) {
            const d2 = resolve(args[1]);
            if (typeof d2 === 'string') { err(d2); return; }
            if (!d2.length) { err('No targets matched the destination'); return; }
            dest = { x: d2[0].x, y: d2[0].y, z: d2[0].z, label: d2[0].name };
          } else if (args.length !== 4) { err(usage); return; }
        }
        if (!dest) {
          const vals = coords(args.slice(args.length - 3));
          if (vals.some((v) => !Number.isFinite(v))) { err('Coordinates must be numbers or ~ (like ~5)'); return; }
          dest = { x: vals[0], y: vals[1], z: vals[2], label: vals.map((v) => v.toFixed(1)).join(', ') };
        }
        if (!movers.length) { err('No targets matched that selector'); return; }
        let moved = 0;
        const refused: string[] = [];
        for (const t of movers) {
          if (t.who === 'you') { h.teleport(dest.x, dest.y, dest.z); moved++; }
          else if (t.who === 'mob') { if (h.teleportEntity(t.id, dest.x, dest.y, dest.z)) moved++; }
          else refused.push(t.name);
        }
        if (refused.length && !moved) { err(`You can only teleport yourself and mobs, not ${refused.join(', ')}`); return; }
        info(movers.length === 1 && movers[0].who === 'you' ? `Teleported to ${dest.label}` : `Teleported ${moved} ${moved === 1 ? 'target' : 'targets'} to ${dest.label}`);
        return;
      }
      case 'give': {
        if (!args[0] || !args[1] || (!isTargetToken(args[0]) && itemIdFromName(args[0]) !== null)) {
          err(`Usage: /give <player> <item> [count]   e.g. /give @p diamond 5${args[0] && !isTargetToken(args[0]) ? ` (say who gets it: /give @s ${args.join(' ')})` : ''}`);
          return;
        }
        if (!onlyYou(args[0], 'give items to')) return;
        args.shift(); // the rest is just like before: item, count / enchantment, level
        let id = itemIdFromName(args[0]);
        if (id === null) {
          err(`Unknown item "${args[0]}". Names look like: dirt, planks, stone_pickaxe, diamond`);
          return;
        }
        if (isPlayerHeadItem(id)) id = playerHeadItem(currentLook().skin); // a player head shows your own skin
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
        if (!onlyYou(args[0], 'clear the inventory of')) return;
        h.clearInventory();
        info('Cleared your inventory');
        return;
      case 'kill': {
        const r = resolve(args[0] ?? '@s');
        if (typeof r === 'string') { err(r); return; }
        if (!r.length) { err('No entities matched that selector'); return; }
        let n = 0;
        const refused: string[] = [];
        for (const t of r) {
          if (t.who === 'mob') { if (h.killEntity(t.id)) n++; }
          else if (t.who === 'player') refused.push(t.name);
        }
        const me = r.some((t) => t.who === 'you');
        if (refused.length) err(`You can't kill other players with commands (${refused.join(', ')})`);
        if (me) { h.kill(); n++; }
        if (me && n === 1) info('You died. Respawning...');
        else if (n) info(`Killed ${n} ${n === 1 ? 'entity' : 'entities'}`);
        return;
      }
      case 'title': {
        // Everything after the target is the title, spacing and \codes\ kept as typed
        const afterCmd = raw.replace(/^\s*\/?\s*\S+\s*/, '');
        const tm = /^(\S+)\s*([\s\S]*)$/.exec(afterCmd);
        if (!tm) { err('Usage: /title <player> <text> [| subtitle]   e.g. /title @p \\green\\\\shiny\\ Hello world!'); return; }
        if (tm[1].toLowerCase() === 'clear') { setTitleCard(null); info('Cleared the title'); return; }
        let targets: Target[];
        let body: string;
        if (isTargetToken(tm[1])) {
          const r = resolve(tm[1]);
          if (typeof r === 'string') { err(r); return; }
          if (!r.length) { err('No targets matched that selector'); return; }
          targets = r; body = tm[2];
        } else {
          const d0 = h.getDebugInfo();
          targets = [{ who: 'you', name: meName, x: d0.x, y: d0.y, z: d0.z }]; body = afterCmd; // /title <text> shows it to you
        }
        const [titleText, subText] = body.split(/\s\|\s?/, 2);
        if (!titleText?.trim()) { err('Usage: /title <player> <text> [| subtitle]'); return; }
        let shown = 0;
        for (const tg of targets) {
          if (tg.who === 'you') { showTitle(titleText.trim(), (subText ?? '').trim()); shown++; }
          else if (tg.who === 'player') {
            if (mpRef.current?.connected) { mpRef.current.sendTitle(tg.name, titleText.trim(), (subText ?? '').trim()); shown++; }
          }
        }
        if (!shown) { err('Nobody to show it to'); return; }
        info(`Showed the title to ${shown === 1 ? (targets[0].name) : shown + ' players'}`);
        return;
      }
      case 'rank': {
        const rest = raw.replace(/^\s*\/?\s*\S+\s*/, '');
        const sub = (rest.split(/\s+/)[0] ?? '').toLowerCase();
        const online = !!mpRef.current?.connected;
        if (online && hostId !== myNetIdRef.current && sub !== 'list' && sub !== 'who') { err('Only the host of the server can change ranks'); return; }
        const resolveNames = (tok: string): string[] | string => {
          const r = resolve(tok);
          if (typeof r === 'string') return r;
          const names = r.filter((x) => x.who === 'you' || x.who === 'player').map((x) => x.name);
          return names.length ? names : 'That is not a player';
        };
        const res = runRankCommand(fakeRanksRef.current, rest, meName, resolveNames);
        if (res.error) { err(res.error); return; }
        if (res.changed) commitFakeRanks(res.ranks);
        if (res.message) info(res.message);
        return;
      }
      case 'effect': {
        const effects = ['speed', 'slowness', 'jump_boost', 'regeneration', 'resistance', 'slow_falling', 'night_vision', 'weakness', 'blight', 'strength', 'fire_resistance', 'water_breathing', 'poison'];
        const usage = `Usage: /effect <player> <effect> [seconds] [level] · /effect clear [player]. Effects: ${effects.join(', ')}`;
        let a = [...args];
        if ((a[0] ?? '').toLowerCase() === 'give') a = a.slice(1); // Minecraft's /effect give @p speed works too
        if ((a[0] ?? '').toLowerCase() === 'clear') {
          if (!onlyYou(a[1], 'clear the effects of')) return;
          h.clearEffects();
          info('Removed every effect');
          return;
        }
        if (a.length < 2) { err(usage); return; }
        if (!onlyYou(a[0], 'give effects to')) return;
        const name = a[1].toLowerCase().replace(/^minecraft:/, '');
        if (!effects.includes(name)) { err(`Unknown effect "${a[1]}". ${usage}`); return; }
        const secs = a[2] === undefined ? 30 : Number(a[2]);
        const level = a[3] === undefined ? 1 : Number(a[3]);
        if (!(secs > 0) || !(level >= 1)) { err(usage); return; }
        h.giveEffect(name, Math.min(3600, secs), Math.min(5, Math.floor(level)));
        info(`Gave you ${name.replace('_', ' ')} ${Math.floor(level)} for ${Math.round(Math.min(3600, secs))} seconds`);
        return;
      }
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
        if (!mpRef.current?.connected) info('Nobody else is here. Open your world to others in Manage Server, or join one from the Servers page.');
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
        else pushMessage(`[${ctx ? '@' : tagsFor(username ?? 'You') + (username ?? 'You')}] ${text}`, '#ffffff');
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
        // /xp 30 (points)  ·  /xp 5 levels  ·  /xp set 10  (a player or selector anywhere, e.g. /xp 5 levels @p)
        const who = args.findIndex((a) => isTargetToken(a) || a.startsWith('@'));
        if (who >= 0) { if (!onlyYou(args[who], 'give experience to')) return; args.splice(who, 1); }
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
        if (what === 'temple' || what === 'fortress' || what === 'dungeon' || what === 'portal' || what === 'treasure') {
          const st = h.locateStructure(what);
          const none: Record<string, string> = {
            temple: 'No desert temple found. Temples are in the Overworld, in deserts (and rarer than villages).',
            fortress: 'No fortress found. Fortresses are in the Nether: use this there.',
            dungeon: 'No dungeon found. Dungeons are underground in the Overworld.',
            portal: 'No ruined portal found. They are on the surface in the Overworld.',
            treasure: 'No buried treasure found. It is buried under beaches in the Overworld.',
          };
          if (!st || st.kind !== what) err(none[what]);
          else info(`The nearest ${what === 'portal' ? 'ruined portal' : what === 'treasure' ? 'buried treasure' : what} is at ${st.x}, ${st.z}, about ${st.distance} blocks away. Use /tp ${st.x} ~ ${st.z} to go there.`);
          return;
        }
        if (what !== 'village') {
          err('Usage: /locate village | temple | fortress | dungeon | portal | treasure');
          return;
        }
        const found = h.locateVillage();
        if (!found) err('No village found. They only generate in the Overworld, in plains, deserts and snowy lands.');
        else info(`The nearest village is at ${found.x}, ${found.z}, about ${found.distance} blocks away. Use /tp ${found.x} ~ ${found.z} to go there.`);
        return;
      }
      case 'enchant': {
        if (!args[0] || !isTargetToken(args[0])) {
          err(`Usage: /enchant <player> <enchantment> [level], e.g. /enchant @p sharpness 5${args[0] && findEnchantment(args[0]) ? ` (say who: /enchant @s ${args.join(' ')})` : ''}`);
          return;
        }
        if (!onlyYou(args[0], 'enchant the items of')) return;
        args.shift();
        const def = args[0] ? findEnchantment(args[0]) : undefined;
        if (!def) { err(`Usage: /enchant <player> <enchantment> [level]. Try: ${ENCHANTMENTS.map((d) => d.key).join(', ')}`); return; }
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
          err(`Usage: /summon [baby] <${MOB_KINDS.map((k) => k.replace('_', ' ')).join('|')}>`);
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

  const getMinimapData = useMemo(() => () => gameHandleRef.current?.getMinimap(32) ?? null, []);

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

  const planetLimit = worldLimit(myRank);
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
    if (savedWorlds.length >= planetLimit) { setHint(`You've reached your limit of ${planetLimit} planets (${RANK_NAMES[myRank]}). Delete one to make a new one.`); return; }
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

  function handlePlayNow(activity?: Activity) {
    if (!startGuard()) return;
    setActiveWorldMode('survival');
    setActiveWorldType('default');
    setActiveSeed(randomSeed());
    setActiveExperimental(false);
    activeWorldIdRef.current = null; // quick play isn't saved
    activityRef.current = typeof activity === 'string' ? activity : null;
    setGameMode('playing');
  }
  // While you play, tell everyone what (every 30 seconds; it stops counting you about a minute after you leave)
  useEffect(() => {
    if (gameMode !== 'playing') return;
    const act: Activity = activityRef.current
      ?? (activeWorldType === 'eggwars' || activeWorldType === 'bridge' ? activeWorldType : activeWorldType === 'oneblock' ? 'oneblock' : activeWorldType === 'superflat' ? 'superflat' : activeWorldMode === 'creative' ? 'creative' : 'survival');
    void reportActivity(act);
    const t = window.setInterval(() => { void reportActivity(act); }, 30_000);
    return () => { window.clearInterval(t); void reportActivity(null); };
  }, [gameMode, activeWorldType, activeWorldMode]);

  /** EggWars or Bridge Duels against bots: a fresh arena every time (never saved). */
  function handlePlayMinigame(kind: ArenaKind, difficulty: BotDifficulty, size: MinigameSize = 'solo') {
    if (!startGuard()) return;
    minigameDifficultyRef.current = difficulty;
    minigameSizeRef.current = size;
    const s: ServerSettings = { ...DEFAULT_SERVER, difficulty: 'normal', keepInventory: false };
    serverSettingsRef.current = s;
    setServerSettings(s);
    hardcoreRef.current = false;
    setHardcore(false);
    setActiveWorldMode('survival');
    setActiveWorldType(kind);
    setActiveSeed(randomSeed());
    setActiveExperimental(false);
    activeWorldIdRef.current = null;
    activityRef.current = kind;
    setGameMode('playing');
  }

  function handleExitGame() {
    saveWorldNow(); // save before the world is thrown away
    stopHosting(false); // everyone in your world is sent home
    void maybeInterstitial({ onStart: () => window.dispatchEvent(new CustomEvent('vb-ad', { detail: true })), onEnd: () => window.dispatchEvent(new CustomEvent('vb-ad', { detail: false })) }); // never for ranked players
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
    <AccountSummaryContext.Provider value={{ username: account?.username ?? '', signedIn: !!account && !isGuestName(account.username), isOwner: isOwnerAccount, isAdmin: !!admin, openAdmin: () => openPanel() }}>
    <StandingContext.Provider value={{ rank: myRank, rising, tier: myTier, isOwner: isOwnerAccount, standing, signedIn: !!account && !isGuestName(account.username) }}>
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
          onMinigame={handlePlayMinigame}
          playingCounts={playingCounts}
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
              onOpenPanel={() => openPanel()}
              unread={unread}
              onOpenChat={(id) => {
                openChatFriendRef.current = id;
                if (id) setUnread((u) => { if (!u[id]) return u; const n = { ...u }; delete n[id]; return n; });
              }}
              onSignIn={() => setShowModal(true)}
              onSignOut={handleSignOut}
              onFriendsChanged={(n) => { pendingRequestsRef.current = n; setPendingRequests(n); }}
              onRename={doRename}
              standing={standing}
              onJoinFriend={joinFriend}
              joining={joiningFriend}
              joinError={joiningFriend || netStatus === 'connecting' ? null : friendJoinErrorRef.current ? netError : null}
            />
          )}
          onDeleteWorld={handleDeleteWorld}
          savedWorlds={savedWorlds}
          planetLimit={planetLimit}
          createPreset={createPreset}
          serverUrl={serverUrl}
          onServerUrlChange={setServerUrl}
          onJoinServer={(a, host) => { friendJoinErrorRef.current = false; joinServer(a, host); }}
          netStatus={netStatus}
          netError={netError}
        />
        <ProfilePanel username={currentUsername} onPlayNow={handlePlayNow} onOpenLeaderboard={() => handleNavClick('leaderboard')} />
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
        {!showMenu && <GameHUD xp={xpState} inventory={inventory} offhand={offhand} armor={armor} health={health} hunger={hunger} selectedSlot={selectedSlot} mode={playMode} air={air} blighted={effectsList.some((e) => e.name === 'blight')} onPick={touchOn && !inventoryOpen && !menuOpen ? (i) => setSelectedSlot(i) : undefined} />}
        {!showMenu && touchOn && (
          <TouchControls
            getHandle={() => gameHandleRef.current}
            onMenu={() => openGameMenu()}
            onChat={() => openChat('')}
            creative={playMode === 'creative'}
            paused={menuOpen || inventoryOpen || chatOpen || helpOpen || !!deathReason || !!trading || !!cmdBlock || !!disconnectReason || panelOpen}
          />
        )}
        {!showMenu && touchOn && !menuOpen && <RotateHint />}
        {!showMenu && touchOn && (inventoryOpen || chatOpen) && (
          <button data-testid="touch-close"
            onClick={() => { if (chatOpen) closeChat(false); else { const c = getBinds().inventory; document.dispatchEvent(new KeyboardEvent('keydown', { code: c, key: c, bubbles: true })); document.dispatchEvent(new KeyboardEvent('keyup', { code: c, key: c, bubbles: true })); } }}
            className="absolute top-3 right-3 z-[80] w-11 h-11 rounded-full bg-black/60 border-2 border-white/40 text-white text-lg font-bold">✕</button>
        )}
        {!showMenu && showTutorial && (
          <Tutorial
            touch={touchOn}
            getInfo={() => gameHandleRef.current?.getDebugInfo() ?? null}
            inventoryOpen={inventoryOpen}
            chatOpen={chatOpen}
            menuOpen={menuOpen}
            selectedSlot={selectedSlot}
            subscribeBlocks={(cb) => { blockListenerRef.current = cb; return () => { if (blockListenerRef.current === cb) blockListenerRef.current = null; }; }}
            onDone={() => setShowTutorial(false)}
          />
        )}
        {!showMenu && bossBar && !minigame && <BossBar bar={bossBar} />}
        {!showMenu && <EffectsBar effects={effectsList} />}
        {!showMenu && hudPrefs.minimap && !showDebug && <Minimap getMap={getMinimapData} />}
        {!showMenu && activeWorldType === 'oneblock' && oneBlock && <OneBlockHud view={oneBlock} />}
        {!showMenu && minigame && (
          <MinigameHud
            view={minigame}
            onPlayAgain={(d) => { minigameDifficultyRef.current = d; gameHandleRef.current?.startMinigame(d); gameHandleRef.current?.relock(); }}
            onExit={exitToHome}
          />
        )}
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
          <HudOverlays prefs={hudPrefs} getFps={() => gameHandleRef.current?.getFps() ?? 0} paused={chatOpen || helpOpen} getInfo={() => gameHandleRef.current?.getDebugInfo() ?? null} ping={ping} online={netStatus === 'online'} />
        )}
        {!showMenu && showDebug && <DebugOverlay getInfo={() => gameHandleRef.current?.getDebugInfo() ?? null} />}
        {!showMenu && sleeping && (
          <SleepOverlay online={netStatus === 'online'} onLeave={() => gameHandleRef.current?.leaveBed()} onChat={() => openChat('')} />
        )}
        {!showMenu && (
          <ChatBox
            key={chatSession}
            open={chatOpen}
            initialText={chatInitial}
            messages={chatMessages}
            history={chatHistory}
            onSubmit={submitChat}
            restricted={!ownsWorld}
          />
        )}
        {!showMenu && helpOpen && (
          <HelpPanel
            onClose={closeHelp}
            restricted={!ownsWorld}
            extra={ownsWorld ? [...(runnerRef.current?.commands.values() ?? [])].map((c) => ({ usage: '/' + c.name, desc: c.description || 'Added by a mod or script' })) : []}
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
            <div data-testid="title-text" className="font-[var(--font-retro)] text-white text-3xl text-center px-6 drop-shadow-[0_3px_0_rgba(0,0,0,0.8)]"><FancyText text={titleCard.text} color="#ffffff" /></div>
            {titleCard.sub && <div data-testid="title-sub" className="text-white/90 text-lg mt-3 drop-shadow-[0_2px_0_rgba(0,0,0,0.8)]"><FancyText text={titleCard.sub} color="#ffffff" /></div>}
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
        {!showMenu && showPlayerList && netStatus === 'online' && <PlayerList players={onlinePlayers} myId={myNetIdRef.current} max={serverMax} tagOf={tagsFor} />}
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
            onOpenSchematics={() => setMenuPage('schematics')}
            showSchematics={ownsWorld}
            showScripts={ownsWorld && serverSettings.scripts}
            showMods={ownsWorld && serverSettings.mods}
            showServer={ownsWorld}
            showAdvancements={advAllowed}
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
                tagOf={tagsFor}
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
                privacy={(() => {
                  const wid = activeWorldIdRef.current;
                  const cfg = wid ? savedWorlds.find((w) => w.id === wid) : null;
                  if (!cfg || !HOSTABLE_TYPES.includes(cfg.worldType ?? 'default') || (mpRef.current && !hostingInfo)) return null;
                  return { value: cfg.privacy ?? 'public', open: !!hostingInfo, players: hostingInfo?.players ?? 1, signedIn: !!account && !isGuestName(account.username), onChange: setWorldPrivacy };
                })()}
              />
            ) : menuPage === 'schematics' ? (
              <SchematicsPage
                makeEnv={makeSchemEnv}
                onGetWand={() => { gameHandleRef.current?.addItem(ITEM_WAND, 1); }}
                selection={{
                  get: () => gameHandleRef.current?.getSelection() ?? { p1: null, p2: null },
                  set: (p1, p2) => gameHandleRef.current?.setSelection(p1, p2),
                  here: () => { const st = gameHandleRef.current!.getNetState(); return [Math.floor(st.x), Math.floor(st.y), Math.floor(st.z)]; },
                  chunk: () => {
                    const st = gameHandleRef.current!.getNetState();
                    const cx = Math.floor(st.x / CHUNK_SIZE), cz = Math.floor(st.z / CHUNK_SIZE);
                    gameHandleRef.current!.setSelection([cx * CHUNK_SIZE, 0, cz * CHUNK_SIZE], [cx * CHUNK_SIZE + CHUNK_SIZE - 1, CHUNK_HEIGHT - 1, cz * CHUNK_SIZE + CHUNK_SIZE - 1]);
                  },
                }}
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

      {panelOpen && account && admin && (
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
    </StandingContext.Provider>
    </AccountSummaryContext.Provider>
  );
}