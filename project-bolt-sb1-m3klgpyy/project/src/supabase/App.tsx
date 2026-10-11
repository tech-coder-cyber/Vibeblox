import { useState, useEffect, useRef, type FormEvent, type ChangeEvent, type MouseEvent as ReactMouseEvent, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from 'react';
import { createVoxelGame, type GameWorldMode, type GraphicsQuality, type Recipe, type PlayMode, type DebugInfo, type WorldType, ITEM_INFO, RECIPES, getItemIconURL, matchRecipe } from '@/voxelGame';
import * as THREE from 'three';
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
} from 'lucide-react';

type View = 'home' | 'shop' | 'settings' | 'create-world';
type GameMode = 'menu' | 'playing';

type NavItem = {
  label: string;
  icon: typeof Settings;
  view?: View;
};

const navItems: NavItem[] = [
  { label: 'Home', icon: Home, view: 'home' },
  { label: 'Create', icon: Plus, view: 'create-world' },
  { label: 'Settings', icon: Settings, view: 'settings' },
  { label: 'Social', icon: Users },
  { label: 'Messages', icon: MessageSquare },
  { label: 'Planets', icon: Globe },
  { label: 'Achievements', icon: Trophy },
  { label: 'Shop', icon: ShoppingBag, view: 'shop' },
  { label: 'Rankings', icon: BarChart3 },
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
              onClick={() => { if (item.view) onNavClick(item.view); }}
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
          className={`w-full py-3 rounded-xl font-[var(--font-display)] text-sm tracking-wide flex items-center justify-center gap-2 transition-all duration-300 hover:scale-[1.02] active:scale-95 bg-gradient-to-r ${tier.iconBg} text-[#0a0e14]`}
        >
          <ShoppingBag className="w-4 h-4" />
          BUY NOW
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

      <SavedWorldsDashboard savedWorlds={savedWorlds} onPlayWorld={onPlayWorld} />
    </div>
  );
}

type WorldMode = 'survival' | 'creative' | 'adventure';

type WorldConfig = {
  name: string;
  mode: WorldMode;
  image: string;
  tag: string;
  accent: string;
  worldType?: WorldType;
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

  const modes: WorldMode[] = ['survival', 'creative', 'adventure'];
  const currentMode = modeConfig[selectedMode];
  const previewName = worldName.trim() || 'Untitled World';

  function handleSave() {
    onSave({
      name: worldName.trim() || 'Untitled World',
      mode: selectedMode,
      image: selectedType === 'superflat' ? '/images/superflat-bg.jpg' : currentMode.image,
      tag: currentMode.tag,
      accent: currentMode.accent,
      worldType: selectedType,
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
                  src={selectedType === 'superflat' ? '/images/superflat-bg.jpg' : currentMode.image}
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
    { value: 'high', label: 'High', blurb: 'Soft shadows + reflections' },
    { value: 'max', label: 'Max', blurb: 'Everything + motion blur' },
  ];

  const renderDistanceLabel =
    renderDistance <= 4 ? 'High FPS — optimized for performance' :
    renderDistance <= 8 ? 'Balanced — good visuals and performance' :
    'Best Visuals — maximum draw distance';

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
          <p className="text-amber-500 text-xs mt-2 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
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
          <p className="text-[#5a6b80] text-xs mt-0.5">Higher tiers add reflections, softer/bigger shadows, and motion blur</p>
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
            <input type="file" accept="audio/*" onChange={onTrackChange} className="hidden" />
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

function ShopView() {
  return (
    <div className="vb-fade-in">
      <header className="mb-8">
        <div className="flex items-center gap-2 mb-2">
          <ShoppingBag className="w-5 h-5 text-[#00e676]" />
          <span className="font-[var(--font-retro)] text-[10px] text-[#00e676]">STORE</span>
        </div>
        <h1 className="font-[var(--font-retro)] text-xl text-white leading-relaxed tracking-wider">
          VIBEBLOX PREMIUM STORE
        </h1>
        <p className="text-[#5a6b80] text-sm mt-1">Unlock powerful perks and stand out from the crowd</p>
      </header>

      <section className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start pt-2">
        {rankTiers.map((tier) => (
          <RankTierCard key={tier.name} tier={tier} />
        ))}
      </section>

      <p className="text-center text-[#5a6b80] text-xs mt-8">
        All purchases are processed securely via Tebex. Ranks are applied to your account automatically.
      </p>
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
  createPreset,
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
  createPreset: { mode: WorldMode; worldType: WorldType; nonce: number };
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
  hudPrefs: HudPrefs;
  onHudPrefsChange: (p: HudPrefs) => void;
  sfxVolume: number;
  onSfxVolumeChange: (v: number) => void;
}) {
  return (
    <main className="flex-1 overflow-y-auto vb-scroll bg-[#0a0e14]">
      <div className="px-8 py-6">
        {view === 'home' && <HomeView username={username} onPlaySurvival={onPlaySurvival} savedWorlds={(window as any).savedWorldsGlobal || []} onPlayWorld={onPlayWorld} onCreatePreset={onCreatePreset} />}
        {view === 'shop' && <ShopView />}
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
            hudPrefs={hudPrefs}
            onHudPrefsChange={onHudPrefsChange}
            sfxVolume={sfxVolume}
            onSfxVolumeChange={onSfxVolumeChange}
          />
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

function GameHUD({ inventory, health, hunger, selectedSlot, mode }: {
  inventory: Record<number, number>;
  health: number;
  hunger: number;
  selectedSlot: number;
  mode: PlayMode;
}) {
  const hotbarItems = Object.entries(inventory).filter(([, count]) => count > 0);
  const heldId = hotbarItems[selectedSlot] ? Number(hotbarItems[selectedSlot][0]) : null;

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

      <div className="flex gap-0.5 bg-black/40 p-1 rounded-md">
        {Array.from({ length: 9 }).map((_, i) => {
          const entry = hotbarItems[i];
          const id = entry ? Number(entry[0]) : null;
          const count = entry ? entry[1] : 0;
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

const ALL_ITEM_IDS = Object.keys(ITEM_INFO).map(Number);

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
      title={id !== null ? ITEM_INFO[id]?.name : undefined}
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

type HeldStack = { id: number; count: number };

function ingredientsOf(r: Recipe): HeldStack[] {
  const need: Record<number, number> = {};
  for (const p of r.pattern) if (p !== null) need[p] = (need[p] || 0) + 1;
  return Object.entries(need).map(([id, count]) => ({ id: Number(id), count }));
}

function InventoryOverlay({
  inventory, atCraftingTable, isCreative, craftMode, onCraftModeChange,
  onCraftGrid, onQuickCraft, onAddItem, onRemoveItem, onDropItems,
}: {
  inventory: Record<number, number>;
  atCraftingTable: boolean;
  isCreative: boolean;
  craftMode: 'grid' | 'quick';
  onCraftModeChange: (m: 'grid' | 'quick') => void;
  onCraftGrid: (grid: (number | null)[], size: number) => void;
  onQuickCraft: (recipeId: string) => void;
  onAddItem: (id: number, count: number) => void;
  onRemoveItem: (id: number, count: number) => void;
  onDropItems: (items: HeldStack[]) => void;
}) {
  const gridSize = atCraftingTable ? 3 : 2;
  const [grid, setGrid] = useState<(number | null)[]>(() => Array(gridSize * gridSize).fill(null));
  const [held, setHeld] = useState<HeldStack | null>(null);
  const [mouse, setMouse] = useState({ x: -100, y: -100 });
  const [recipePreview, setRecipePreview] = useState<number | null>(null);

  // Refs mirror state so fast drag events and the close-cleanup always see
  // the latest values (React state updates land asynchronously).
  const gridRef = useRef(grid);
  const heldRef = useRef(held);
  const dropRef = useRef(onDropItems);
  dropRef.current = onDropItems;
  const spreadingRef = useRef(false);

  function commitGrid(next: (number | null)[]) { gridRef.current = next; setGrid(next); }
  function commitHeld(next: HeldStack | null) { heldRef.current = next; setHeld(next); }

  useEffect(() => {
    const up = () => { spreadingRef.current = false; };
    window.addEventListener('mouseup', up);
    return () => window.removeEventListener('mouseup', up);
  }, []);

  // Closing the inventory drops whatever is left in the crafting grid or on
  // your cursor into the world, like Minecraft.
  useEffect(() => () => {
    const counts: Record<number, number> = {};
    for (const id of gridRef.current) if (id !== null) counts[id] = (counts[id] || 0) + 1;
    const h = heldRef.current;
    if (h) counts[h.id] = (counts[h.id] || 0) + h.count;
    const items = Object.entries(counts).map(([id, count]) => ({ id: Number(id), count }));
    if (items.length) dropRef.current(items);
  }, []);

  const items = Object.entries(inventory).filter(([, c]) => c > 0);
  const slots: Array<HeldStack | null> = items.map(([id, count]) => ({ id: Number(id), count }));
  while (slots.length < 27) slots.push(null);
  const previewRecipe = recipePreview !== null ? RECIPES.find((r) => r.output.id === recipePreview) ?? null : null;
  const result = craftMode === 'grid' ? matchRecipe(grid, gridSize, atCraftingTable) : null;

  function addToHeld(id: number, amount: number) {
    const h = heldRef.current;
    commitHeld(h && h.id === id ? { id, count: Math.min(64, h.count + amount) } : { id, count: Math.min(64, amount) });
  }

  // Put the cursor stack back into your inventory (right-click = just 1)
  function returnHeld(e: ReactMouseEvent) {
    const h = heldRef.current;
    if (!h) return;
    if (e.button === 2) {
      onAddItem(h.id, 1);
      commitHeld(h.count > 1 ? { id: h.id, count: h.count - 1 } : null);
    } else {
      onAddItem(h.id, h.count);
      commitHeld(null);
    }
  }

  // Your items: click = 1, shift+click = whole stack, right-click = half
  function onInventorySlot(e: ReactMouseEvent, id: number, count: number) {
    e.preventDefault();
    if (e.button === 1) { setRecipePreview(id); return; }
    if (heldRef.current) { returnHeld(e); return; }
    const amount = e.button === 2 ? Math.ceil(count / 2) : e.shiftKey ? Math.min(64, count) : 1;
    onRemoveItem(id, amount);
    addToHeld(id, amount);
  }

  function onEmptySlot(e: ReactMouseEvent) {
    e.preventDefault();
    returnHeld(e);
  }

  // Creative palette: infinite and free. Clicking it while holding a
  // different item deletes that item, like Minecraft's creative menu.
  function onCreativeSlot(e: ReactMouseEvent, id: number) {
    e.preventDefault();
    if (e.button === 1) { setRecipePreview(id); return; }
    const h = heldRef.current;
    if (h && h.id !== id) { commitHeld(null); return; }
    addToHeld(id, e.shiftKey ? 64 : 1);
  }

  function placeOne(index: number) {
    const h = heldRef.current;
    const g = gridRef.current;
    if (!h || g[index] !== null) return;
    const next = [...g];
    next[index] = h.id;
    commitGrid(next);
    commitHeld(h.count > 1 ? { id: h.id, count: h.count - 1 } : null);
  }

  function onGridDown(e: ReactMouseEvent, index: number) {
    e.preventDefault();
    if (e.button === 1) return;
    const cell = gridRef.current[index];
    const h = heldRef.current;
    if (h) {
      if (cell === null) {
        placeOne(index);
        spreadingRef.current = true; // keep holding + drag to drop 1 per slot
      } else if (cell === h.id && h.count < 64) {
        const next = [...gridRef.current];
        next[index] = null;
        commitGrid(next);
        commitHeld({ id: h.id, count: h.count + 1 });
      }
      return;
    }
    if (cell !== null) {
      const next = [...gridRef.current];
      next[index] = null;
      commitGrid(next);
      commitHeld({ id: cell, count: 1 });
    }
  }

  function onGridEnter(e: ReactMouseEvent, index: number) {
    if (spreadingRef.current && (e.buttons & 3)) placeOne(index);
  }

  function onResult(e: ReactMouseEvent) {
    e.preventDefault();
    if (!result) return;
    onCraftGrid(gridRef.current, gridSize);
    commitGrid(Array(gridSize * gridSize).fill(null));
  }

  // Switching to Quick Craft hands anything in the grid back to you first
  function switchCraftMode(m: 'grid' | 'quick') {
    if (m === craftMode) return;
    if (m === 'quick') {
      for (const id of gridRef.current) if (id !== null) onAddItem(id, 1);
      commitGrid(Array(gridSize * gridSize).fill(null));
    }
    onCraftModeChange(m);
  }

  // Clicking outside the panels throws the cursor stack into the world
  function onBackdrop(e: ReactMouseEvent) {
    if (e.target !== e.currentTarget) return;
    const h = heldRef.current;
    if (!h) return;
    if (e.button === 2) {
      onDropItems([{ id: h.id, count: 1 }]);
      commitHeld(h.count > 1 ? { id: h.id, count: h.count - 1 } : null);
    } else {
      onDropItems([h]);
      commitHeld(null);
    }
  }

  return (
    <div
      className="absolute inset-0 z-30 bg-black/70 backdrop-blur-sm flex items-center justify-center gap-4 vb-fade-in"
      onMouseMove={(e) => setMouse({ x: e.clientX, y: e.clientY })}
      onMouseDown={onBackdrop}
      onContextMenu={(e) => e.preventDefault()}
    >
      <div className="w-[560px] max-w-[60vw] bg-[#0d131b] border border-[#243044] rounded-2xl p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-[var(--font-retro)] text-white text-sm tracking-wider uppercase">
            {atCraftingTable ? 'Crafting Table' : 'Inventory'}
          </h3>
          <div className="flex items-center gap-3">
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
            <span className="text-[#5a6b80] text-xs">E / Esc to close</span>
          </div>
        </div>

        {craftMode === 'quick' ? (
          <div className="flex flex-col gap-1.5 mb-5 max-h-64 overflow-y-auto vb-scroll pr-1">
            {RECIPES.map((r) => {
              const ing = ingredientsOf(r);
              const tableOk = !r.needsTable || atCraftingTable;
              const can = tableOk && ing.every((x) => (inventory[x.id] || 0) >= x.count);
              return (
                <button
                  key={r.id}
                  onClick={() => onQuickCraft(r.id)}
                  disabled={!can}
                  className={`flex items-center justify-between px-3 py-2 rounded-xl border transition-all duration-200 ${
                    can
                      ? 'bg-[#00e676]/10 border-[#00e676]/30 hover:bg-[#00e676]/20 hover:scale-[1.01] active:scale-[0.98]'
                      : 'bg-[#121822]/50 border-[#243044]/50 opacity-60 cursor-not-allowed'
                  }`}
                >
                  <div className="flex items-center gap-1.5">
                    {ing.map((x) => (
                      <span key={x.id} className="flex items-center gap-0.5 text-xs">
                        <span className={(inventory[x.id] || 0) >= x.count ? 'text-white' : 'text-red-400'}>{x.count}</span>
                        <ItemIcon id={x.id} className="w-6 h-6" />
                      </span>
                    ))}
                    <span className="text-[#5a6b80] mx-1">→</span>
                    <span className="text-xs text-white">{r.output.count}</span>
                    <ItemIcon id={r.output.id} className="w-6 h-6" />
                    <span className="text-white text-xs font-medium ml-1">{r.name}</span>
                  </div>
                  {!tableOk && <span className="text-amber-500 text-[10px]">Needs table</span>}
                </button>
              );
            })}
          </div>
        ) : (
          <div className="flex items-center gap-5 mb-5">
            <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${gridSize}, minmax(0, 1fr))` }}>
              {grid.map((cellId, i) => (
                <ItemSlot
                  key={i}
                  id={cellId}
                  onMouseDown={(e) => onGridDown(e, i)}
                  onMouseEnter={(e) => onGridEnter(e, i)}
                />
              ))}
            </div>
            <span className="text-[#5a6b80] text-2xl">→</span>
            <ItemSlot id={result ? result.output.id : null} count={result?.output.count} highlight={!!result} onMouseDown={onResult} />
            {result && <span className="text-white text-xs">{result.name}</span>}
          </div>
        )}

        <h4 className="text-white text-xs font-medium mb-2">Your Items</h4>
        <div className="grid grid-cols-9 gap-1 mb-2 w-fit">
          {slots.map((slot, i) =>
            slot ? (
              <ItemSlot
                key={`item-${slot.id}`}
                id={slot.id}
                count={slot.count}
                onMouseDown={(e) => onInventorySlot(e, slot.id, slot.count)}
              />
            ) : (
              <ItemSlot key={`empty-${i}`} id={null} onMouseDown={onEmptySlot} />
            ),
          )}
        </div>
        <p className="text-[#5a6b80] text-[10px]">
          Click = 1 · Shift+click = full stack · Right-click = half · Hold + drag over the grid = 1 per slot ·
          Middle-click = recipe · Click outside = drop
        </p>

        {previewRecipe && (
          <div className="mt-4 p-3 rounded-xl bg-[#121822] border border-[#243044] vb-fade-in">
            <div className="flex items-center justify-between mb-2">
              <span className="text-white text-xs font-medium">{previewRecipe.name} recipe</span>
              <button onClick={() => setRecipePreview(null)} className="text-[#5a6b80] text-xs hover:text-white">close</button>
            </div>
            <div className="flex items-center gap-3">
              <div className="grid gap-1 w-fit" style={{ gridTemplateColumns: `repeat(${previewRecipe.width}, minmax(0, 1fr))` }}>
                {previewRecipe.pattern.map((pid, i) => (
                  <ItemSlot key={i} id={pid} size="sm" />
                ))}
              </div>
              <span className="text-[#5a6b80]">→</span>
              <ItemSlot id={previewRecipe.output.id} count={previewRecipe.output.count} size="sm" />
            </div>
            {previewRecipe.needsTable && <p className="text-amber-500 text-[10px] mt-2">Requires a crafting table</p>}
          </div>
        )}
        {recipePreview !== null && !previewRecipe && (
          <p className="text-[#5a6b80] text-[10px] mt-2">
            {ITEM_INFO[recipePreview]?.name} can't be crafted — you get it by breaking blocks.
          </p>
        )}
      </div>

      {isCreative && (
        <div className="w-[230px] max-h-[70vh] bg-[#0d131b] border border-[#243044] rounded-2xl p-4 shadow-2xl overflow-y-auto vb-scroll">
          <h4 className="text-white text-xs font-medium mb-2">All Items (Creative)</h4>
          <div className="grid grid-cols-4 gap-1">
            {ALL_ITEM_IDS.map((id) => (
              <ItemSlot key={id} id={id} size="sm" onMouseDown={(e) => onCreativeSlot(e, id)} />
            ))}
          </div>
          <p className="text-[#5a6b80] text-[10px] mt-2">Free — click to take, shift+click for 64</p>
        </div>
      )}

      {held && (
        <div className="fixed z-50 pointer-events-none" style={{ left: mouse.x - 18, top: mouse.y - 18 }}>
          <ItemIcon id={held.id} className="w-9 h-9" />
          {held.count > 1 && (
            <span className="absolute bottom-0 right-0 text-[11px] text-white font-bold drop-shadow-[0_1px_0_black]">{held.count}</span>
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
  { names: ['summon'], usage: '/summon <mob>', desc: 'Spawn a mob in front of you: pig, cow, chicken, zombie, skeleton or creeper.' },
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
            {m.text}
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

function HelpPanel({ onClose }: { onClose: () => void }) {
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
    `Biome: ${info.biome}`,
    `Mode: ${info.mode}${info.flying ? ' (flying)' : ''}`,
    `Chunks: ${info.loadedChunks} loaded, render distance ${info.renderDistance}`,
    `Graphics: ${info.graphics}`,
    `Camera: ${info.camera} (F5)`,
    `Mobs nearby: ${info.mobs}`,
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

function MenuButton({ color, label, icon: Icon, onClick, soon = false }: {
  color: keyof typeof MENU_COLORS;
  label: string;
  icon: typeof Play;
  onClick?: () => void;
  soon?: boolean;
}) {
  return (
    <button
      onClick={soon ? undefined : onClick}
      disabled={soon}
      className={`relative w-full py-3 border-2 ${MENU_COLORS[color]} text-white font-[var(--font-retro)] text-xs tracking-wide flex items-center justify-center gap-2 transition-all duration-150 ${
        soon ? 'opacity-60 cursor-not-allowed' : 'hover:brightness-125 hover:scale-[1.02] active:scale-[0.98]'
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
function GameMenu({ page, onResume, onOpenSettings, onBack, onExit, children }: {
  page: 'main' | 'settings';
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
            <MenuButton color="blue" icon={ScrollText} label="Scripts" soon />
            <MenuButton color="teal" icon={Package} label="Mods" soon />
          </div>
          <MenuButton color="red" icon={LogOut} label="Exit Game" onClick={onExit} />
          <p className="text-center text-white/50 text-[11px] mt-2">The world keeps running while this menu is open · Esc to resume</p>
        </div>
      ) : (
        <div className="w-[640px] max-w-[94vw] max-h-[86vh] flex flex-col bg-[#0a0e14]/95 border border-[#243044] rounded-2xl shadow-2xl overflow-hidden vb-fade-in">
          <div className="flex items-center gap-3 px-5 py-3 border-b border-[#243044]">
            <button
              onClick={onBack}
              className="w-8 h-8 rounded-lg bg-[#121822] border border-[#243044] flex items-center justify-center text-[#8ea0b8] transition-all duration-200 hover:text-white hover:border-[#364860] active:scale-95"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="font-[var(--font-retro)] text-white text-xs tracking-wider">SETTINGS</span>
          </div>
          <div className="overflow-y-auto vb-scroll p-5">{children}</div>
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
  const [renderDistance, setRenderDistance] = useState(6);
  const [graphicsQuality, setGraphicsQuality] = useState<GraphicsQuality>('medium');
  const [fov, setFov] = useState(75);
  const [savedWorlds, setSavedWorlds] = useState<WorldConfig[]>([]);
  const [activeWorldMode, setActiveWorldMode] = useState<GameWorldMode>('survival');
  const [activeWorldType, setActiveWorldType] = useState<WorldType>('default');
  const [createPreset, setCreatePreset] = useState<{ mode: WorldMode; worldType: WorldType; nonce: number }>({ mode: 'survival', worldType: 'default', nonce: 0 });
  const [sfxVolume, setSfxVolume] = useState(0.6);
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPage, setMenuPage] = useState<'main' | 'settings'>('main');
  const [hurtFlash, setHurtFlash] = useState(false);
  const menuOpenRef = useRef(false);
  const menuPageRef = useRef<'main' | 'settings'>('main');
  menuPageRef.current = menuPage;
  const hurtTimerRef = useRef<number | undefined>(undefined);
  const [inventory, setInventory] = useState<Record<number, number>>({});
  const [health, setHealth] = useState(20);
  const [hunger, setHunger] = useState(20);
  const [inventoryOpen, setInventoryOpen] = useState(false);
  const [atCraftingTable, setAtCraftingTable] = useState(false);
  const [craftMode, setCraftMode] = useState<'grid' | 'quick'>('grid');
  const [playMode, setPlayMode] = useState<PlayMode>('survival');
  const [hudPrefs, setHudPrefs] = useState<HudPrefs>({ keystrokes: false, cps: false, fps: false });
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

  // Soundtrack — lifted up to App level (rather than living inside
  // SettingsView) so playback survives navigating to other sidebar panels
  // and continues even while actually playing the game, since this <audio>
  // element itself never unmounts.
  const [trackName, setTrackName] = useState<string | null>(null);
  const [builtInTrack, setBuiltInTrack] = useState<'overworld' | 'phonk' | 'arcade' | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(0.5);
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
        if (menuOpenRef.current) {
          if (menuPageRef.current === 'settings') setMenuPage('main');
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
      const handle = createVoxelGame(canvasRef.current, renderDistance, activeWorldMode, graphicsQuality, fov, activeWorldType, sfxVolume);
      gameHandleRef.current = handle;
      handle.onExit(() => {
        setGameMode('menu');
      });
      handle.onInventoryChange((inv) => setInventory(inv));
      handle.onStatsChange((h, hu) => {
        setHealth(h);
        setHunger(hu);
      });
      handle.onInventoryToggle((open, atTable) => {
        inventoryOpenRef.current = open; // set now: the pointer-unlock event can arrive before React re-renders
        setInventoryOpen(open);
        setAtCraftingTable(atTable);
      });
      setInventory(handle.getInventory());
      setHealth(handle.getHealth());
      setHunger(handle.getHunger());
      setInventoryOpen(false);
      setPlayMode(activeWorldMode);
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
      return () => {
        handle.dispose();
        gameHandleRef.current = null;
      };
    }
  }, [gameMode, activeWorldMode, activeWorldType]);

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

  // Keep the engine's "held item" in sync with the selected hotbar slot,
  // so right-click places the block you actually have selected.
  useEffect(() => {
    if (!gameHandleRef.current) return;
    const ids = Object.entries(inventory).filter(([, c]) => c > 0).map(([id]) => Number(id));
    gameHandleRef.current.setHeldItem(ids[selectedSlot] ?? null);
  }, [selectedSlot, inventory]);

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
      if (chatOpenRef.current || helpOpenRef.current || inventoryOpenRef.current || menuOpenRef.current) return;
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
      if (document.pointerLockElement) return;
      if (chatOpenRef.current || helpOpenRef.current || inventoryOpenRef.current || menuOpenRef.current) return;
      openGameMenu();
    };
    document.addEventListener('pointerlockchange', onLockChange);
    return () => document.removeEventListener('pointerlockchange', onLockChange);
  }, [gameMode]);

  function openGameMenu() {
    menuOpenRef.current = true;
    setMenuPage('main');
    setMenuOpen(true);
    gameHandleRef.current?.setChatOpen(true); // stop walking; the world itself keeps running
    if (document.pointerLockElement) document.exitPointerLock();
  }

  function resumeGame() {
    menuOpenRef.current = false;
    setMenuOpen(false);
    gameHandleRef.current?.setChatOpen(false);
    gameHandleRef.current?.relock();
  }

  function exitToHome() {
    menuOpenRef.current = false;
    setMenuOpen(false);
    handleExitGame();
    setView('home');
  }

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
      pushMessage(`<${username ?? 'Player'}> ${text}`);
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
        const count = Math.max(1, Math.min(64, parseInt(args[1] ?? '1', 10) || 1));
        h.addItem(id, count);
        info(`Gave ${count} [${ITEM_INFO[id].name}]`);
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
      case 'summon': {
        const kind = (args[0] ?? '').toLowerCase();
        if (!h.summonMob(kind)) {
          err('Usage: /summon <pig|cow|chicken|zombie|skeleton|creeper>');
          return;
        }
        info(`Summoned a ${kind}`);
        return;
      }
      default:
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
    setGameMode('playing');
  }

  // Play a saved world with its own mode and world type (it used to always start Survival)
  function launchWorld(config: WorldConfig) {
    setActiveWorldMode(config.mode as GameWorldMode);
    setActiveWorldType(config.worldType ?? 'default');
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
    setGameMode('playing');
  }

  function handleExitGame() {
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
          hudPrefs={hudPrefs}
          onHudPrefsChange={setHudPrefs}
          sfxVolume={sfxVolume}
          onSfxVolumeChange={setSfxVolume}
          onPlayWorld={launchWorld}
          onCreatePreset={handleCreatePreset}
          createPreset={createPreset}
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
        {!showMenu && <GameHUD inventory={inventory} health={health} hunger={hunger} selectedSlot={selectedSlot} mode={playMode} />}
        {!showMenu && inventoryOpen && (
          <InventoryOverlay
            inventory={inventory}
            atCraftingTable={atCraftingTable}
            isCreative={playMode === 'creative'}
            onCraftGrid={handleCraftGrid}
            onAddItem={handleAddItem}
            onRemoveItem={handleRemoveItem}
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
        {!showMenu && helpOpen && <HelpPanel onClose={closeHelp} />}
        {!showMenu && (
          <div
            className="absolute inset-0 z-[15] pointer-events-none transition-opacity duration-300"
            style={{ opacity: hurtFlash ? 1 : 0, background: 'radial-gradient(ellipse at center, rgba(0,0,0,0) 45%, rgba(200,0,0,0.55) 100%)' }}
          />
        )}
        {!showMenu && menuOpen && (
          <GameMenu
            page={menuPage}
            onResume={resumeGame}
            onOpenSettings={() => setMenuPage('settings')}
            onBack={() => setMenuPage('main')}
            onExit={exitToHome}
          >
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
              hudPrefs={hudPrefs}
              onHudPrefsChange={setHudPrefs}
              sfxVolume={sfxVolume}
              onSfxVolumeChange={setSfxVolume}
            />
          </GameMenu>
        )}
      </div>
    </>
  );
}
