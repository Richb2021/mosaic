# Mosaic staging

A private test copy at **https://mosaic-staging.24hourcoder.com**. It runs the released app code (server and pages) with its own data, so you can test with as many people as you like without touching the live site.

## What is different from live

- **Sign-in:** staging uses test people instead of NoCodeBackend accounts.
  - Pick a person on `/staging`, or add a new one, which works like a new sign-up with no group yet.
  - There are no passwords, and nothing is sent to NoCodeBackend.
- **Learner saves:** they go to a staging copy of the learner store (`scripts/staging/learner-store.mjs`). It has the same version rules as NCB and keeps the latest version of each slot.
- **No AI or audio:** there are no AI or audio provider keys, so generating podcasts, cartoons and new chapters isn't available.
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
