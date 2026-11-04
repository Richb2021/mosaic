# Mosaic staging

A private test copy at **https://mosaic-staging.24hourcoder.com**. It runs the released app code (server and pages) with its own data, so you can test with as many people as you like without touching the live site.

## What is different from live

- **Sign-in:** staging uses test people instead of NoCodeBackend accounts.
  - Pick a person on `/staging`, or add a new one, which works like a new sign-up with no group yet.
  - There are no passwords, and nothing is sent to NoCodeBackend.
- **Learner saves:** they go to a staging copy of the learner store (`scripts/staging/learner-store.mjs`). It has the same version rules as NCB and keeps the latest version of each slot.
- **AI and voices:**
  - Staging has the same Meta (`META_API_KEY`) and Fish Audio keys as live, copied server to server from `~/.config/mosaic/app.env`.
  - It shares live's provider accounts but has its own lower caps: $5 a day per workspace, $10 a day overall and 20 generations. Live keeps $20, $100 and 50.
  - The background narration worker (`mosaic-media`) runs for live only, so finished episodes aren't voiced on staging.
  - NCB, gateway and maintenance secrets are never copied.
- **Private access:** the whole site needs the staging link. Everything else returns 401, and pages are marked `noindex`.

Everything else, including invites, onboarding, classes, assignments, sharing, the inbox, feedback and data controls, is the live code.

## Seeded content (first start)

| Person | Set-up |
|---|---|
| Sam Patel | Teacher and administrator. Owns the course "Living systems": 2 reviewed objectives, 2 published chapters and an Explore lesson. |
| Maya Singh | Learner aged 13–17 in Sam's school group |
| Olu Ade | Second teacher |
| Ada Lovelace | Self-directed adult managed by Olu. Can join Sam's class by code. |

## Running it (Baldur)

| What | Where |
|---|---|
| Service | `systemctl --user status mosaic-staging` (loopback port 3187) |
| Tunnel | `systemctl --user status cloudflared-mosaic-staging` (its own tunnel, separate from the live API tunnel) |
| Code | `~/services/mosaic-staging/current` points to `releases/<commit>-staging` |
| Data | `~/.local/share/mosaic-staging/` (app database, objects, learner store) |
| Settings | `~/.config/mosaic-staging/staging.env` (`STAGING_KEY`, origin, port, data dir; mode 600) |

**Your staging link:** `https://mosaic-staging.24hourcoder.com/staging/enter?key=<STAGING_KEY>`. To print it:

```bash
ssh baldur 'echo https://mosaic-staging.24hourcoder.com/staging/enter?key=$(grep ^STAGING_KEY= ~/.config/mosaic-staging/staging.env | cut -d= -f2)'
```

**Update to a new build:** run `npm run build:staging`, rsync `portable-staging/` to `~/services/mosaic-staging/releases/<commit>-staging/`, re-point `current`, then `systemctl --user restart mosaic-staging`.

**Start again with fresh data:** stop the service, move `~/.local/share/mosaic-staging` aside, then start it. It reseeds.

**Remove staging completely:**
1. Disable both services.
2. Run `cloudflared tunnel delete mosaic-staging`.
3. Remove the `mosaic-staging` CNAME in Cloudflare DNS.
