// Real music files, one folder per soundtrack, in the project's public/music folder:
//
//   public/music/phonk/song1.mp3 ... song5.mp3
//   public/music/classical/song1.mp3 ... song4.mp3
//   public/music/overworld/song1.mp3 ... song3.mp3
//
// Choosing that soundtrack in Settings > Audio plays its songs one after another, forever (mp3 is best; .ogg, .m4a and
// .wav work too). A soundtrack with no files yet plays the game's built-in music instead, and a song whose file is
// missing is skipped. To show the real name in "Now Playing", change `title` (and `artist`) in the lists below.
// The files are streamed when they play, so they do not slow down the first load of the game.
import { setNowPlayingName } from './music';

export type Song = {
  /** the file name without the extension: public/music/<soundtrack>/<id>.mp3 */
  id: string;
  /** shown in "Now Playing" */
  title: string;
  /** the artist, shown after the title (needed by some licenses) */
  artist?: string;
};

export type FileStyle = 'overworld' | 'classical' | 'phonk';
const numbered = (n: number): Song[] => Array.from({ length: n }, (_, i) => ({ id: `song${i + 1}`, title: `Song ${i + 1}` }));

export const PLAYLISTS: Record<FileStyle, Song[]> = {
  phonk: [
    { id: 'song1', title: 'Drift Phonk', artist: 'Sub Clair' },
    { id: 'song2', title: 'Aggressive Drift Night', artist: 'Alex Morgan' },
    { id: 'song3', title: 'Hard Phonk', artist: 'AbsoluteSound' },
    { id: 'song4', title: 'Dark Aggressive Bass', artist: 'Watermelon Beats' },
    { id: 'song5', title: 'Phonk Aura', artist: 'MondaMusic' },
  ],
  classical: numbered(4),
  overworld: [
    { id: 'song1', title: 'Rain in the Overworld', artist: 'ThatLofiShow' },
    { id: 'song2', title: 'Ambient Dreamscape', artist: 'Morgan' },
    { id: 'song3', title: 'Ambient Calm', artist: 'QuietPhase' },
  ],
};
export const isFileStyle = (s: string): s is FileStyle => s in PLAYLISTS;
export const songLabel = (s: Song) => (s.artist ? `${s.title} · ${s.artist}` : s.title);

const EXTENSIONS = ['mp3', 'ogg', 'm4a', 'wav'];

/** idle: not started · loading: looking for a song · playing · empty: not one song file was found */
export type PlaylistStatus = 'idle' | 'loading' | 'playing' | 'empty';
let status: PlaylistStatus = 'idle';
const listeners = new Set<() => void>();
export const getPlaylistStatus = () => status;
export function subscribePlaylistStatus(f: () => void): () => void { listeners.add(f); return () => { listeners.delete(f); }; }
function setStatus(s: PlaylistStatus) { if (s !== status) { status = s; listeners.forEach((f) => f()); } }

function baseUrl(): string {
  try { const b = (import.meta as unknown as { env?: { BASE_URL?: string } }).env?.BASE_URL; if (b) return b.endsWith('/') ? b : b + '/'; } catch { /* no vite */ }
  return '/';
}

export class FilePlaylist {
  private audio: HTMLAudioElement | null = null;
  private index = -1;
  private volume = 0.6;
  private run = 0;
  /** files that turned out not to exist (so they are not tried again every loop) */
  private missing = new Set<string>();
  /** the soundtrack being played (null when stopped) */
  style: FileStyle | null = null;
  private onEmpty: (() => void) | null = null;
  private ext = new Map<string, string>();
  playing = false;
  current: Song | null = null;

  private el(): HTMLAudioElement {
    if (!this.audio) {
      const a = new Audio();
      a.preload = 'auto';
      a.addEventListener('ended', () => { void this.playFrom(this.index + 1, this.run); });
      this.audio = a;
    }
    this.audio.volume = this.volume;
    return this.audio;
  }

  /** Tries the file under each extension until one can be played. */
  private load(song: Song): Promise<boolean> {
    const a = this.el();
    const known = this.ext.get(`${this.style}/${song.id}`);
    const list = known ? [known] : EXTENSIONS;
    return new Promise((resolve) => {
      let i = 0;
      const tryNext = () => {
        if (i >= list.length) { cleanup(); resolve(false); return; }
        a.src = `${baseUrl()}music/${this.style}/${song.id}.${list[i]}`;
        a.load();
      };
      const ok = () => { this.ext.set(`${this.style}/${song.id}`, list[i]); cleanup(); resolve(true); };
      const bad = () => { i++; tryNext(); };
      const cleanup = () => { a.removeEventListener('canplay', ok); a.removeEventListener('error', bad); window.clearTimeout(timer); };
      // a host that answers an unknown file with a web page ends up as an error too; the timer covers a stuck request
      const timer = window.setTimeout(() => { bad(); }, 8000);
      a.addEventListener('canplay', ok);
      a.addEventListener('error', bad);
      tryNext();
    });
  }

  /** Plays song number `from` (wrapping round), skipping songs that are not there. */
  private async playFrom(from: number, run: number) {
    const list = this.style ? PLAYLISTS[this.style] : [];
    const n = list.length;
    for (let k = 0; k < n; k++) {
      if (run !== this.run) return; // stopped or restarted meanwhile
      const idx = (((from + k) % n) + n) % n;
      const song = list[idx];
      if (this.missing.has(song.id)) continue;
      setStatus('loading');
      const loaded = await this.load(song);
      if (run !== this.run) return;
      if (!loaded) { this.missing.add(song.id); continue; }
      this.index = idx;
      this.current = song;
      try { await this.audio!.play(); } catch { setStatus('idle'); this.playing = false; return; } // the browser wants a click first
      if (run !== this.run) return;
      this.playing = true;
      setStatus('playing');
      setNowPlayingName(songLabel(song));
      return;
    }
    // not one file could be found
    this.playing = false;
    this.current = null;
    setStatus('empty');
    setNowPlayingName(null);
    this.onEmpty?.(); // no song files for this soundtrack yet: the caller plays the built-in music instead
  }

  start(style: FileStyle, volume?: number, onEmpty?: () => void) {
    if (volume !== undefined) this.volume = volume;
    this.style = style;
    this.onEmpty = onEmpty ?? null;
    this.run++;
    this.ext.clear();
    this.missing.clear();
    this.index = -1;
    void this.playFrom(0, this.run);
  }

  /** Jump to the next song. */
  next() {
    if (status === 'empty') return;
    this.run++;
    void this.playFrom(this.index + 1, this.run);
  }

  pause() { if (this.audio && this.playing) { this.audio.pause(); this.playing = false; } }
  resume() { if (this.audio && this.current && !this.playing) { void this.audio.play().then(() => { this.playing = true; }).catch(() => { /* needs a click */ }); } }
  setVolume(v: number) { this.volume = Math.max(0, Math.min(1, v)); if (this.audio) this.audio.volume = this.volume; }
  stop() {
    this.run++;
    if (this.audio) { this.audio.pause(); this.audio.removeAttribute('src'); this.audio.load(); }
    this.playing = false;
    this.current = null;
    this.style = null;
    this.onEmpty = null;
    setStatus('idle');
    setNowPlayingName(null);
  }
}

/** The one playlist player the whole game shares. */
export const playlist = new FilePlaylist();
