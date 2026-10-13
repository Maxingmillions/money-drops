# Drops

**Money becomes a real-world treasure hunt.** Hide USDC anywhere in the world. A stranger walks to that spot, opens the app, and claims it.

Pokémon GO, but for real dollars on Solana.

## What's here

A mobile-first web app (installable PWA, also works on desktop) built with Next.js 16, React 19, Tailwind 4, Prisma (Postgres), MapLibre and a three.js Solana coin.

**Hunters**
- Sign in with Phantom, Solflare, Backpack or any Wallet Standard Solana wallet (native Sign-In With Solana, no third party). Google, Apple and email sign-in with an auto-created Solana wallet are available once a Privy app is configured.
- Wallet home: total found, nearby-drop banner, claim history with on-chain receipts.
- Map of nearby drops as spinning Solana coins. Each hidden drop shows a search circle (default 80 m) rather than a point: the real spot is somewhere inside, and the exact location only appears once you're within the reveal radius (default 30 m), so hunters have to explore.
- Works as a phone app (installable PWA, bottom nav, full-screen map) and a desktop app (sidebar, map with a side panel, two-column forms).
- $DROPS token card and DexScreener chart page, live as soon as `NEXT_PUBLIC_DROPS_TOKEN` is set to the mint address.
- Hunt screen: live distance, compass needle, warmer/colder, mini map.
- Claim screen: camera backdrop, hold-to-claim, instant "You found $X" card. Claims are validated server-side (distance, one-per-person, campaign window) and the drop is flipped atomically so two people can't take the same one.

**Creators**
- "Hide money": name the drop, pick proximity or event mode, set tiers (e.g. 20 × $5, 5 × $20, 1 × $100), tap the map to choose the area and radius, set the search circle size, time window and per-person limit.
- Campaign page: live stats per tier, drop map, escrow deposit link.

**Money (Solana)**
- Amounts are USDC. Campaigns are funded by sending USDC to the Money Drops escrow wallet with the campaign id as the memo; the server verifies the deposit on-chain and activates the campaign.
- Claims pay out USDC from the escrow to the hunter's wallet and record the transaction signature.
- v1 escrow is custodial (a treasury keypair held by the server). An on-chain escrow program is the planned next step; the API shape stays the same.

## Deploy to Vercel (no terminal needed)

1. Go to [vercel.com/new](https://vercel.com/new) and import the `money-drops` GitHub repo. Don't deploy yet.
2. In the project, open **Storage → Create Database → Neon (Postgres)** and connect it. That sets `DATABASE_URL` and `DATABASE_URL_UNPOOLED`.
3. Under **Settings → Environment Variables** add:

   | Name | Value |
   | --- | --- |
   | `SESSION_SECRET` | any long random string |
   | `DEV_LOGIN` | `true` (test sign-in until Privy is set up) |
   | `NEXT_PUBLIC_DEV_LOGIN` | `true` |
   | `DEV_SKIP_FUNDING` | `true` (campaigns go live without an on-chain deposit) |
   | `NEXT_PUBLIC_DEV_LOCATION` | `true` (optional: tap the map to teleport) |
   | `SEED_DEMO` | `true` (optional: seeds the Tokyo demo hunt on first build) |

4. Deploy. The build runs `prisma db push`, seeds if asked, then builds the app.

Add `NEXT_PUBLIC_PRIVY_APP_ID` and `PRIVY_APP_SECRET` later for real wallet / Google / Apple sign-in, then remove the two `DEV_LOGIN` variables. Add the treasury variables and set `DEV_SKIP_FUNDING` to `false` for real USDC.

Phones need HTTPS for location and camera; Vercel gives you that out of the box.

## Run it locally

```bash
npm install
npm run setup             # creates .env, syncs the schema, seeds a demo hunt
npm run dev               # http://localhost:3000
```

The database is Postgres. Run one locally (Postgres.app or `brew install postgresql`), or paste your Neon URLs from Vercel into `.env` and use the same database.

Open it on your phone too: find your computer's LAN IP and visit `http://<ip>:3000`. Geolocation and camera need HTTPS on most phones, so for phone testing either use a tunnel (`npx localtunnel --port 3000`, ngrok, Cloudflare Tunnel) or use the Vercel deployment.

### Testing from a desk

With `NEXT_PUBLIC_DEV_LOCATION="true"` (default in `.env.example`) the map has a pin button: turn it on and tap the map to teleport yourself. The seed hunt is around Yoyogi Park, Tokyo; change `SEED_LAT`/`SEED_LNG` in `.env` and re-run `npm run db:seed` to put it near you.

"Continue as test hunter" signs you in with a random wallet, no Privy needed. It's always on in development; in production it only appears when `DEV_LOGIN` and `NEXT_PUBLIC_DEV_LOGIN` are both `true`. `DEV_SKIP_FUNDING="true"` makes new campaigns live immediately without an on-chain deposit and records claims without a payout. Turn these off once Privy and the treasury are configured.

### Google, Apple and email sign-in

Wallet sign-in works out of the box. For social logins (with a wallet created for the user):

1. Create an app at [dashboard.privy.io](https://dashboard.privy.io).
2. Enable the login methods you want (wallet, Google, Apple, email) and Solana embedded wallets.
3. Turn on **Identity tokens** (Authentication → Advanced).
4. Put `NEXT_PUBLIC_PRIVY_APP_ID` and `PRIVY_APP_SECRET` in `.env`.

### Real money (devnet first)

```bash
npm run treasury:new      # prints NEXT_PUBLIC_TREASURY_ADDRESS and TREASURY_SECRET_KEY for .env
```

Fund the treasury with a little SOL for fees (`solana airdrop 1 <address> --url devnet`), get devnet USDC from [faucet.circle.com](https://faucet.circle.com), set `DEV_SKIP_FUNDING="false"`, and the "Fund with wallet" button on a new campaign will send a real USDC deposit. Switch `NEXT_PUBLIC_SOLANA_CLUSTER` to `mainnet-beta` when ready.

## Scripts

| Script | What it does |
| --- | --- |
| `npm run dev` | Dev server |
| `npm run build` / `start` | Production build and server |
| `npm run typecheck` / `lint` | Type and lint checks |
| `npm run db:push` | Apply the Prisma schema to the database |
| `npm run vercel-build` | What Vercel runs: schema push, optional seed, build |
| `npm run db:seed` | Seed the demo hunt |
| `npm run db:studio` | Browse the database |
| `npm run treasury:new` | Generate an escrow keypair |

## Layout

```
prisma/schema.prisma      User, Campaign, Drop, Claim
src/app/api/              auth (nonce + verify for wallets, privy, dev), me, drops, campaigns
src/lib/                  geo math, session cookies, Privy verification, Solana escrow/payout, data access
src/components/           screens: SignIn, Home, MapScreen, HuntScreen, ClaimScreen, HideScreen, CampaignScreen
src/hooks/                useGeolocation (with dev simulation), useCompassHeading, useSolanaWallets (Wallet Standard)
src/proxy.ts              redirects signed-out users to /sign-in
```

## Roadmap

- Non-custodial escrow program (Anchor) so creators' funds never sit in a server-held key.
- "Only public places": filter generated drop locations against OSM parks/footways and exclude roads, rail and private property.
- Anti-spoofing: GPS plausibility checks, speed limits between claims, device attestation.
- Clustering on the map at low zoom, push notifications when a drop is nearby.
- PostGIS for geo queries at scale, refunds for ended event drops, creator analytics.
