# Hosting the VibeBlox server on Oracle Cloud (free, all in your browser)

You never download anything. You use Oracle's website and its built-in terminal (Cloud Shell).
Players don't download anything either: they type your address into the game.

## 1. Make the server
1. Sign up at oracle.com/cloud/free. It asks for a card to check you're real; the Always Free
   tier doesn't charge you. Pick your home region carefully, it can't be changed later.
2. Open **Cloud Shell** (the `>_` icon at the top right of the Oracle console) and run:
   ```
   ssh-keygen -t ed25519 -N "" -f ~/.ssh/id_ed25519 && cat ~/.ssh/id_ed25519.pub
   ```
   Copy the line it prints (starts with `ssh-ed25519`).
3. Go to **Compute → Instances → Create instance**.
   - Image: **Ubuntu** (22.04 or 24.04).
   - Shape: **VM.Standard.E2.1.Micro** (AMD, Always Free). The Ampere A1 shape is stronger
     but often says "out of capacity".
   - SSH keys: choose **Paste public keys** and paste the line from step 2.
   - Click **Create**, wait until it says Running, and copy the **Public IP address**.

## 2. Open ports 80 and 443
1. On the instance page, click the **Subnet** link, then the **Security List**.
2. **Add Ingress Rules** twice: Source CIDR `0.0.0.0/0`, IP Protocol TCP,
   Destination Port `80`, and again for `443`.

## 3. Point your domain at it
In Cloudflare DNS for vibeblox.online, add an **A** record: name `play`, value = the public IP.
Set it to **DNS only (grey cloud)**. The orange cloud would break the game connection.

## 4. Install (in Cloud Shell)
```
ssh ubuntu@YOUR_PUBLIC_IP
```
Then paste this whole block (it installs Node.js and Caddy, which adds HTTPS for you):
```
sudo apt-get update && sudo apt-get install -y curl debian-keyring debian-archive-keyring apt-transport-https
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash - && sudo apt-get install -y nodejs
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt-get update && sudo apt-get install -y caddy
# Oracle's Ubuntu blocks ports 80/443 inside the machine too, on top of the Security List:
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 80 -j ACCEPT
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 443 -j ACCEPT
sudo netfilter-persistent save
mkdir -p ~/vibeblox
```
Now get `server.js` onto the machine. The easiest way: open server.js on GitHub, click **Raw**,
copy that address, and run:
```
curl -fsSL "PASTE_THE_RAW_GITHUB_LINK_HERE" -o ~/vibeblox/server.js
```

## 5. Run it forever
```
sudo tee /etc/systemd/system/vibeblox.service > /dev/null <<'UNIT'
[Unit]
Description=VibeBlox server
After=network.target
[Service]
User=ubuntu
WorkingDirectory=/home/ubuntu/vibeblox
ExecStart=/usr/bin/node /home/ubuntu/vibeblox/server.js
Environment=PORT=8080
Restart=always
[Install]
WantedBy=multi-user.target
UNIT
echo 'play.vibeblox.online {
  reverse_proxy localhost:8080
}' | sudo tee /etc/caddy/Caddyfile
sudo systemctl daemon-reload && sudo systemctl enable --now vibeblox && sudo systemctl restart caddy
```
Check it: open `https://play.vibeblox.online` in a browser. It should say
"VibeBlox server is running". In the game, join `play.vibeblox.online`.

## Updating the server later
```
curl -fsSL "PASTE_THE_RAW_GITHUB_LINK_HERE" -o ~/vibeblox/server.js && sudo systemctl restart vibeblox
```
The world is saved in `~/vibeblox/world.json` and survives restarts and updates.

## Good to know
- Options go on `Environment=` lines in step 5, e.g. `Environment=MAX_PLAYERS=30` (without it the limit is 18, or 24 / 32 / 48 when the host is a Rising / Popular / Star Creator),
  `Environment=EXPERIMENTAL=1` (only for a brand-new world), `Environment=WEATHER_CYCLE=0`.
- **This version of the server speaks protocol 14.** Update the server file whenever you update the game, or players on
  the old server will be told to refresh/update. (Sleeping, whispers, the admin panel, global bans, `/title`, fake ranks and creator badges all need it.)
  The newest server file also answers the game's ping message, which is what the Ping HUD overlay shows; an older
  server still works but the ping reads "—".
- **Admin panel, global bans and announcements** use your Supabase project. The server already knows its address; to point
  it elsewhere add `Environment=SUPABASE_URL=...` and `Environment=SUPABASE_ANON_KEY=...`. The server needs to be able to
  reach Supabase over the internet (the default Oracle setup can). Run `supabase_social.sql` once in Supabase
  (SQL editor, New snippet) and add your VibeBlox username to the `admins` table; only those usernames can use `/panel`.
  The account named **Master** is always the owner: it can use the panel and can't be kicked or banned. Re-run the
  newest `supabase_social.sql` whenever it changes (it's safe to run again); it also adds the live "playing" counts
  on the home page.
- If Supabase can't be reached, players can still join (global bans are skipped) but nobody can use the admin tools.
- Oracle may reclaim Always Free machines that look idle for a week (very low CPU use).
  Upgrading the account to "Pay As You Go" stops that, and Always Free resources stay free.
- See what the server is doing: `journalctl -u vibeblox -f`
