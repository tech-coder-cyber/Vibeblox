// The song playlist: real music files that live in the project's public/music folder.
//
//   public/music/song1.mp3   public/music/song2.mp3   ...   public/music/song5.mp3
//
// Put the files there (mp3 is best; .ogg, .m4a and .wav work too), keep the names song1 .. song5, and the game plays
// them one after another, forever. A song whose file is missing is skipped, so you can start with one or two.
// To show the real name, change `title` (and `artist`, if the license asks for credit) in the list below.
// The files are streamed when they play, so they do not slow down the first load of the game.
import { setNowPlayingName } from './music';

export type Song = {
  /** the file name without the extension: public/music/<id>.mp3 */
  id: string;
  /** shown in "Now Playing" */
  title: string;
  /** the artist, shown after the title (needed by some licenses, for example Chris Zabriskie's) */
  artist?: string;
};

export const SONGS: Song[] = [
  { id: 'song1', title: 'Song 1' },
  { id: 'song2', title: 'Song 2' },
  { id: 'song3', title: 'Song 3' },
  { id: 'song4', title: 'Song 4' },
  { id: 'song5', title: 'Song 5' },
];

const EXTENSIONS = ['mp3', 'ogg', 'm4a', 'wav'];
export const songLabel = (s: Song) => (s.artist ? `${s.title} · ${s.artist}` : s.title);

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
    const known = this.ext.get(song.id);
    const list = known ? [known] : EXTENSIONS;
    return new Promise((resolve) => {
      let i = 0;
      const tryNext = () => {
        if (i >= list.length) { cleanup(); resolve(false); return; }
        a.src = `${baseUrl()}music/${song.id}.${list[i]}`;
        a.load();
      };
      const ok = () => { this.ext.set(song.id, list[i]); cleanup(); resolve(true); };
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
    const n = SONGS.length;
    for (let k = 0; k < n; k++) {
      if (run !== this.run) return; // stopped or restarted meanwhile
      const idx = (((from + k) % n) + n) % n;
      const song = SONGS[idx];
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
  }

  start(volume?: number) {
    if (volume !== undefined) this.volume = volume;
    this.run++;
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
    setStatus('idle');
    setNowPlayingName(null);
  }
}

/** The one playlist player the whole game shares. */
export const playlist = new FilePlaylist();
