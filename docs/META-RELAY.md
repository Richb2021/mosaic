# Meta API relay (20i)

**Why:** from 3–4 November 2026, Meta's Model API returns no models (`model_not_found` for `muse-wonder-1.0`) to requests from Baldur's address (Netherlands, AS218428). The same keys see every model from the UK. So the API server sends its Meta calls through a small relay on the 20i web host, which is in the UK.

**How:**

| Piece | Where |
|---|---|
| Relay | `deploy/20i/meta-relay.php`, served at `https://mosaic.richardbatt.com/meta-relay.php`. Accepts POST only, with the `X-Mosaic-Relay` secret. Allows only `/v1/responses`, `/v1/responses/resp_…` and `/v1/models`, follows no redirects, has an 18 s timeout, and stores and logs nothing. |
| Relay secret | `/.mosaic/meta-relay.json` on 20i (mode 600, outside the web root). Baldur keeps a copy at `~/.config/mosaic/meta-relay.json`. |
| Server side | `server/node/meta-relay.mjs`. When `META_RELAY_URL` and `META_RELAY_SECRET` are set, only `https://api.meta.ai` requests are rewritten to the relay; everything else goes out directly. Enabled for live (`~/.config/mosaic/app.env`) and staging (`~/.config/mosaic-staging/staging.env`). |
| Upload tool | `~/services/mosaic/relay_tools.py put|get|rm` on Baldur (FTPS with the pinned CA, readback after upload). |

**Turn it off:**
- **On 20i:** set `"enabled": false` in `/.mosaic/meta-relay.json`.
- **On Baldur:** remove the two `META_RELAY_*` lines from the env file and restart. Meta calls then go out directly again.

**Rotate the secret:**
1. Write a new secret to both copies.
2. Upload it with `relay_tools.py put /.mosaic/meta-relay.json … 600`.
3. Update both env files and restart both services.

A full 20i redeploy (`deploy_20i.py`) must keep `meta-relay.php` and `/.mosaic/meta-relay.json`.
