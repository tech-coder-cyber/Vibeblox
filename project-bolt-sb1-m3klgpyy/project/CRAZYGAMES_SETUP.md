# CrazyGames setup (Indev 35.3)

On CrazyGames the game logs players in automatically with their CrazyGames account. This needs a small server function on your own website (vibeblox.online). Everything else works without it, and if the function is missing the game simply lets CrazyGames players play as guests.

## 1. Put the function online (one time)
The folder `functions/api/cg-login.ts` is a Cloudflare Pages Function. Upload the whole project to GitHub as usual; Cloudflare Pages finds the `functions` folder by itself and serves it at `https://vibeblox.online/api/cg-login`.

In Cloudflare: your Pages project > Settings > Variables and Secrets. Add:

| Name | Value |
|---|---|
| `SUPABASE_URL` | `https://okhtosecqytklgwouwxv.supabase.co` |
| `SUPABASE_ANON_KEY` | your publishable key (the `sb_publishable_...` one) |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase > Project Settings > API > `service_role` (a SECRET: never put it in the game or in GitHub) |
| `CG_LINK_SECRET` | any long random text (30+ characters). Never change it later, or CrazyGames players lose their account link. |
| `CG_GAME_ID` | optional: your game id from the CrazyGames developer portal |

Then redeploy once. Test: open `https://vibeblox.online/api/cg-login` in a browser. "POST only" means it is running.

## 2. Build the CrazyGames version
`npm install` then `npm run build`, zip the CONTENTS of `dist` (index.html at the top). The game finds out it is on CrazyGames by itself. If the function lives somewhere else, build with `VITE_CG_LOGIN_URL=https://your-address/api/cg-login`.

## 3. In the CrazyGames submission form
* Account integration: say the game logs in automatically ("full" integration with the SDK user token).
* The game has Terms of Use and a Privacy Policy (Settings > About, and a notice for new players). They are a plain draft, not legal advice: have them checked.
* Chat: the game blocks chat messages when CrazyGames switches chat off for a player.

## What is not done
* Multiplayer room invites / "instant multiplayer" CrazyGames features are not built (optional unless you launch as a full multiplayer game).
* Players on CrazyGames have a separate account from vibeblox.online (no email, no merging).
* The names of the CrazyGames SDK settings (chat off, sound off) follow the public docs but were not tested against the real SDK: check them in the CrazyGames QA tool.
