import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import { PLATFORM } from './adEconomy';
import { prepareCrazyGames } from './crazygames';

// On CrazyGames the SDK must be running (and saving routed through its data module) BEFORE the game reads any saved setting,
// so the game itself is loaded afterwards. Everywhere else this is instant.
async function start() {
  if (PLATFORM === 'crazygames') {
    await Promise.race([prepareCrazyGames(), new Promise<void>((r) => setTimeout(r, 10_000))]); // never keep the player waiting for a slow SDK
  }
  const { default: App } = await import('./App.tsx');
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>
  );
}
void start();
