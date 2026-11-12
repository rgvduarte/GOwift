# Deploying GOindoor

A server is one Docker container. It serves the browser client, the routes and
the WebSocket game on one port (8080 inside the container). TLS belongs to a
reverse proxy in front of it: browsers only allow Bluetooth on `https://` pages.

## Behind your own Caddy (recommended for production)

### 1. The GOindoor server

```bash
git clone <your-repo-url> goindoor && cd goindoor
make setup          # creates .env from .env.example; later runs add new settings
$EDITOR .env
make up
```

Settings for production in `.env`:

```bash
GOINDOOR_SERVER_NAME=Leon's Ride Club
GOINDOOR_PUBLIC_URL=https://ride.example.org
GOINDOOR_TRUST_PROXY=true                 # client IPs from X-Forwarded-For (per-IP limit)
GOINDOOR_MAX_PLAYERS=50                   # trainer riders at the same time, all routes together
GOINDOOR_MAX_PADDLE_PLAYERS=20            # phone riders, in seats of their own
GOINDOOR_MAX_VISIBLE_RIDERS=200           # riders per state message, humans first
GOINDOOR_ALLOW_SIMULATED_TRAINER=false    # only real trainers on the start screen
GOINDOOR_ALLOW_PADDLE_MODE=true           # phone paddles (marked 📱, no Strava, no ride files)
GOINDOOR_PRIVACY_URL=https://ride.example.org/privacy/  # your privacy policy, linked in the start menu
GOINDOOR_ANALYTICS_DOMAIN=              # optional Plausible analytics, off when empty (see .env.example)
# GOINDOOR_OBN_URL=wss://obn.example/v0   # optional: share the velodrome with other apps (see OpenBikeNet below)
GOINDOOR_HTTP_BIND=127.0.0.1              # only the proxy on this machine can reach it
GOINDOOR_HTTP_PORT=8080
COMPOSE_PROFILES=                         # leave the bundled Caddy off
```

`GOINDOOR_PUBLIC_URL` also becomes the only page origin allowed to open game
connections (`GOINDOOR_ALLOWED_ORIGINS` in `docker-compose.yml`). Without it,
any web page may open a game connection to your server, which is fine on a
home network but not for a public server: always set it there. Only set
`GOINDOOR_TRUST_PROXY=true` when the proxy is the only way in, otherwise
anyone could fake their address in the header.

Deploy new commits later with `make update` (git pull, rebuild, restart,
wait until healthy).

`make update`, `make restart` and `make down` drop everyone who is riding, so
they first ask the running server who is on it. With riders connected you get
the count and where they ride, and a prompt that defaults to *No* (nothing is
pulled or changed then). Without a terminal (cron, CI, ssh without a TTY) they
refuse instead of waiting; add `FORCE=1` (`make update FORCE=1`) to go ahead
regardless. If no server is running or it does not answer, they continue.

### 2. Caddy on the same machine

Caddy proxies WebSockets and sets `X-Forwarded-For` on its own. The server
compresses its responses itself (Brotli or gzip); `encode` leaves those as they
are and only matters for anything else the proxy serves:

```caddyfile
ride.example.org {
	encode zstd gzip
	reverse_proxy 127.0.0.1:8080
}
```

### Caddy in its own container

Put both containers on a shared Docker network instead of publishing a port.
Next to `docker-compose.yml` create `docker-compose.override.yml` (Compose
reads it automatically; it is not in git):

```yaml
services:
  server:
    ports: !reset []
    networks: [default, proxy]

networks:
  proxy:
    external: true
    name: caddy   # the network your Caddy container is on
```

and point Caddy at the container name:

```caddyfile
ride.example.org {
	encode zstd gzip
	reverse_proxy goindoor-server-1:8080
}
```

## Landing page

A public server can split into two addresses: a static landing page on the
main domain (`example.org`, from `landing/`) and the app on a subdomain
(`app.example.org`). Both run in the same Compose stack. Self-hosters who
don't want a landing page leave this out; nothing changes for them.

1. DNS: `A`/`AAAA` records for the bare domain, `www` and `app`, all to the
   server.
2. `.env`:

   ```bash
   COMPOSE_PROFILES=tls,landing
   GOINDOOR_DOMAIN=app.example.org
   GOINDOOR_PUBLIC_URL=https://app.example.org
   GOINDOOR_LANDING_DOMAIN=example.org, www.example.org
   GOINDOOR_LANDING_URL=https://example.org
   GOINDOOR_LANDING_PLAUSIBLE_DOMAIN=example.org   # optional, cookie-free analytics
   # GOINDOOR_PRIVACY_URL=https://...                # optional, privacy link (start menu + landing footer)
   # GOINDOOR_LANDING_IMPRINT_URL=https://...        # optional, imprint link in the footer
   ```

3. `make up`. The bundled Caddy serves the landing page on the bare domain,
   redirects `www.` to it and proxies the app subdomain as before.
4. **Strava:** the *Authorization Callback Domain* in the Strava API settings
   must be the app subdomain (`app.example.org`). Change it when moving the
   app, then check *Connect with Strava* once.

Behind your own Caddy, leave `tls` out of `COMPOSE_PROFILES`; the landing
container is published on `127.0.0.1:8081` (`GOINDOOR_LANDING_PORT`):

```caddyfile
example.org {
	encode zstd gzip
	reverse_proxy 127.0.0.1:8081
}
www.example.org {
	redir https://example.org{uri} permanent
}
app.example.org {
	encode zstd gzip
	reverse_proxy 127.0.0.1:8080
}
```

The page's links are baked in at build time from `.env`, so run `make up`
again after changing them. Details: [landing/README.md](../landing/README.md).

## Strava (optional)

1. Create an API application at <https://www.strava.com/settings/api>.
   *Authorization Callback Domain*: the host of your public URL, e.g.
   `ride.example.org`.
2. In `.env`:

   ```bash
   GOINDOOR_STRAVA_CLIENT_ID=12345
   GOINDOOR_STRAVA_CLIENT_SECRET=…
   GOINDOOR_REQUIRE_STRAVA=false   # true: riders must connect Strava to ride
   GOINDOOR_SECRET_KEY=…           # openssl rand -hex 32; keeps logins across updates
   ```

3. `make up`.

To try it locally, copy `.env.dev.example` to `.env.dev` and run `make dev`
(see the comments in that file). Strava accepts `localhost` and `127.0.0.1` as
callback domains, so the same Strava app works locally. Open the app at
`http://localhost:8080` (the `GOINDOOR_PUBLIC_URL` in that file).

Riders then see *Connect with Strava* on the start screen. After a ride,
*Finish ride* offers *Upload to Strava* (and `.tcx`, `.gpx` and `.fit` downloads either way).
Strava gets a FIT file marked as a virtual ride (`sub_sport` virtual activity):
Strava files it as a *Virtual Ride* and keeps the ride's own elevation. Its
elevation map would see open sea there and drop the climbing, as it did for
the TCX uploads before.
With `GOINDOOR_REQUIRE_STRAVA=true` every rider needs a real Strava account,
and one account can ride only once at a time — a simple hurdle against bots
and scripts.

Strava logins are saved in a SQLite database on the `data` Docker volume
(`/app/data`), so riders stay connected through `make update` and restarts.
Session ids are stored only as hashes and refresh tokens are encrypted with
`GOINDOOR_SECRET_KEY`, which must stay the same across deploys (changing it
logs everyone out once, which is harmless). Without the key logins stay in
memory and are lost on every restart. Back the volume up like any data:

```bash
docker run --rm -v goindoor_data:/data -v "$PWD":/backup alpine tar czf /backup/goindoor-data.tgz -C /data .
```

The start menu also shows how far everyone has ridden on the server, on
trainers and on phones. Only the two kilometre totals are kept, in `stats.json`
next to the database (set `GOINDOOR_STATS_FILE` to put it elsewhere); without a
data directory they restart from zero. Riders declare their own device, so the
numbers are for fun, not a leaderboard.

Things to know:

- Sessions are kept in memory. After a restart riders press *Connect* again;
  Strava skips its consent screen the second time.
- A new Strava API app may be limited to a single athlete until Strava
  approves it for more ("athlete capacity" in the API settings).
- Uploads carry GPS positions in a virtual world off Mallorca (see
  [routes](routes.md#on-the-map)), so Strava shows a map. Once Strava has
  processed an upload, the server sets the sport type to *Virtual Ride*,
  which keeps it off real-world segments.

## OpenBikeNet (optional)

Set `GOINDOOR_OBN_URL` (a `ws://` or `wss://` URL of an OpenBikeNet server) to share the
velodrome with riders of other apps. The server then sends the name, position, speed, power
and cadence of the riders on the velodrome, and shows the riders of other apps next to yours
(they have no bots there). Empty or unset = not connected; nothing is sent. If the connection
drops, the other apps' riders vanish and the server reconnects with a growing pause (1 s up to
a minute). `/api/info` marks the route with `"shared": true` while the link is configured.

- Riders doing a workout, riders off the route and bots are never sent.
- A rider of another app that is silent for 10 s is hidden until they send again.
- A server that stays silent for 20 s gets a ping; after 10 s more without an answer the
  connection counts as dropped and is reopened.
- `ws://` is unencrypted: rider names and values cross the network in the clear. Use `wss://`
  whenever the OpenBikeNet server is not on your own machine or network.

## Protection against floods and scripts

| Setting | Default | What it limits |
| --- | --- | --- |
| `GOINDOOR_MAX_PLAYERS` | 50 | Trainer riders at the same time across all routes (phone riders not counted) |
| `GOINDOOR_MAX_PADDLE_PLAYERS` | 20 | Phone-paddle riders at the same time, in seats of their own so they never block a trainer rider |
| `GOINDOOR_MAX_VISIBLE_RIDERS` | 200 | Riders in one state message; humans first, then the nearest bots |
| `GOINDOOR_MAX_CONNECTIONS_PER_IP` | 4 | Open game connections per IP (needs `GOINDOOR_TRUST_PROXY` behind a proxy) |
| `GOINDOOR_MESSAGES_PER_SECOND` | 20 | Messages per connection (the client sends about 4); floods are dropped, then the connection is closed |
| `GOINDOOR_ALLOWED_ORIGINS` | the public URL | Pages from other sites can't open game connections |
| `GOINDOOR_REQUIRE_STRAVA` | false | Riders need a Strava account; one ride per account |
| `GOINDOOR_GRACE_S` | 60 | How long a rider whose connection dropped is kept (coasting, holding their place) before being removed; 0 removes at once |
| `GOINDOOR_AFK_TIMEOUT_S` | 1800 | Seconds of 0 W before a "Still riding?" warning; an unanswered warning removes the rider. 0 turns it off |
| `GOINDOOR_AFK_REMINDER_S` | 600 | Seconds of 0 W after "Stay" before the next warning |

Connections must say hello and join within 15 s, and silent connections are
closed after 120 s. Chat is limited to bursts of 5, then one message every
2 s. Trainer data is still trusted (watts are only clamped to 2500 W); this
is about keeping a small community server usable, not about stopping a
determined cheater.

## Routes

Every `*.json` file in `routes/` becomes a world riders can pick on the start
screen; `GOINDOOR_ROUTE` is the default and listed first. Routes are mounted
read-only, so a new file only needs `make restart`. See [routes](routes.md).

## Without your own proxy

For a server without a reverse proxy, the bundled Caddy can handle TLS:
`COMPOSE_PROFILES=tls` and `GOINDOOR_DOMAIN=ride.example.org` in `.env`
(ports 80 and 443 must be reachable).
