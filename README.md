# Drops

**Money becomes a real-world treasure hunt.** Hide SOL anywhere in the world. A stranger walks to that spot, opens the app, and claims it.

Pokémon GO, but for real money on Solana.

## What's here

A mobile-first web app (installable PWA, also works on desktop) built with Next.js 16, React 19, Tailwind 4, Prisma (Postgres), MapLibre and a three.js Solana coin.

**Hunters**
- Sign in with Phantom, Solflare, Backpack or any Wallet Standard Solana wallet (native Sign-In With Solana, no third party), or with email and password: email accounts get an encrypted custodial Solana wallet so they can receive payouts. Google and Apple sign-in are available once a Privy app is configured.
- Wallet home: total found, nearby-drop banner, claim history with on-chain receipts.
- Map of drops as spinning Solana coins, with a zoom-aware system: at world level you see one bubble per hunt, zooming in splits them into clusters, and up close the individual coins appear and scale up. The map fetches whatever is in view.
- Address search on the Hide and Post-bounty pickers (OpenStreetMap geocoding). Each hidden drop shows a search circle (default 80 m) rather than a point: the real spot is somewhere inside, and the exact location only appears once you're within the reveal radius (default 30 m), so hunters have to explore.
- Works as a phone app (installable PWA, bottom nav, full-screen map) and a desktop app (sidebar, map with a side panel, two-column forms).
- $DROPS token card and DexScreener chart page, live as soon as `NEXT_PUBLIC_DROPS_TOKEN` is set to the mint address.
- Hunt screen: live distance, compass needle, warmer/colder, mini map.
- Claim screen: camera backdrop, hold-to-claim, instant "You found $X" card. Claims are validated server-side (distance, one-per-person, campaign window) and the drop is flipped atomically so two people can't take the same one.

**Hiders**
- "Hide money" is four inputs: amount in SOL, how many drops, tap the map (or search an address), spread radius (type anything up to 100 km; search circles up to 2 km). Drops split evenly.
- Accounts signed in with a wallet pay the amount plus a 5% fee from their wallet into escrow before the hunt goes live. Email accounts post without paying (demo mode).
- Campaign page: live stats, drop map, escrow deposit link.

**Bounties**
- Anyone posts a task with a USDC reward, optional place and radius, deadline and number of winners. The reward is held in escrow.
- Hunters submit proof: up to three photos, videos or files uploaded straight to a private Vercel Blob store (only mods, the submitter and the creator can see them until approved), and/or a video link. Mods review a queue, approve or reject with a note, and approval pays the reward to the submitter's wallet.
- Mod panel at `/mod`: review queue, every live drop and bounty with a "take down" action that closes the post and refunds the creator's unclaimed money, and a team tab where admins add or remove mods by wallet. Wallets in `ADMIN_WALLETS` become admins on sign-in.

**Chat**
- A global room (polling every 3 s, no extra services). Mods get a shield badge and can delete messages.

**Fees and the drop pool**
- Every hunt and bounty pays a 5% platform fee. Half of each fee goes into a community pool shown on the wallet home and $DROPS pages: balance, fees collected, amount dropped, countdown.
- Every 15 minutes the pool scatters random drops within a few miles of where people are hunting (a Vercel cron hits `/api/cron/pool-drops`; map viewers also nudge the scheduler so it runs on the Hobby plan).

**Mods and admins**
- Mod panel at `/mod`: review queue, every live drop and bounty with "take down" (closes it and refunds the creator's unclaimed money), a team tab where admins add or remove mods by wallet, and admin-only permanent deletes.

**Money (Solana)**
- Amounts are SOL (stored as lamports). Posts are funded by a SOL transfer to the escrow wallet with the post id as the memo; the server verifies the deposit on-chain and opens the post.
- Claims, bounty rewards and refunds are SOL transfers from the escrow to the recipient's wallet, with the transaction signature recorded.
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
   | `SEED_DEMO` | `true` (optional: seeds demo content on build; leave unset for an empty site) |
   | `ANTHROPIC_API_KEY` | optional: turns on AI spam moderation for chat, bounties and hidden money |
   | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | optional: Google sign-in (see below) |
   | `APPLE_CLIENT_ID` | optional: Apple sign-in (see below) |
   | `ADMIN_WALLETS` | your wallet address, so you can review bounties and delete posts |
   | `NEXT_PUBLIC_TREASURY_ADDRESS` / `TREASURY_SECRET_KEY` | escrow wallet (`npm run treasury:new`); set `DEV_SKIP_FUNDING` to `false` so wallet accounts really pay |
   | `BLOB_READ_WRITE_TOKEN` | set automatically by the linked Vercel Blob store; needed for proof uploads |

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

Give the treasury some devnet SOL from [faucet.solana.com](https://faucet.solana.com) so it can pay out, set `DEV_SKIP_FUNDING="false"`, and wallet accounts will pay from their wallet when they post. Switch `NEXT_PUBLIC_SOLANA_CLUSTER` to `mainnet-beta` when ready.

## Scripts

| Script | What it does |
| --- | --- |
| `npm run dev` | Dev server |
| `npm run build` / `start` | Production build and server |
| `npm run typecheck` / `lint` | Type and lint checks |
| `npm run db:push` | Apply the Prisma schema to the database |
| `npm run vercel-build` | What Vercel runs: schema push, optional seed, build |
| `npm run db:seed` | Seed demo content: hunts in six cities, bounties, chat, claims, a demo mod |
| `npm run db:unseed` | Remove everything the seed created |
| `npm run db:wipe` | Remove all content (hunts, drops, bounties, chat, pool history) and keep accounts |
| `npm run db:studio` | Browse the database |
| `npm run treasury:new` | Generate an escrow keypair |

## Layout

```
prisma/schema.prisma      User, Campaign, Drop, Claim
src/app/api/              auth (wallet nonce + verify, email signup/login, privy, dev), me, drops, campaigns, bounties, submissions, uploads, files, mod, chat, pool, cron
src/lib/                  geo math, sessions, custody (custodial wallets + passwords), Solana escrow/payout, pool (fees + random drops), moderation, uploads
src/components/           screens: SignIn, Home, MapScreen, HuntScreen, ClaimScreen, HideScreen, CampaignScreen, BountiesScreen, NewBountyScreen, BountyScreen, ModScreen, ChatScreen
src/hooks/                useGeolocation (with dev simulation), useCompassHeading, useSolanaWallets (Wallet Standard)
src/proxy.ts              redirects signed-out users to /sign-in
```

## Roadmap

- Non-custodial escrow program (Anchor) so creators' funds never sit in a server-held key.
- Direct video upload for bounty proof (Vercel Blob) instead of links; dispute flow and mod audit log.
- Per-city chat rooms and realtime delivery.
- "Only public places": filter generated drop locations against OSM parks/footways and exclude roads, rail and private property.
- Anti-spoofing: GPS plausibility checks, speed limits between claims, device attestation.
- Clustering on the map at low zoom, push notifications when a drop is nearby.
- PostGIS for geo queries at scale, refunds for ended event drops, creator analytics.

## Google and Apple sign-in

Both run as plain OpenID Connect redirects (`src/lib/oauth.ts`), no auth service in between. New social accounts get a custodial Solana wallet like email accounts; an existing email account with the same verified address is linked instead of duplicated. Buttons appear on the sign-in page only when the provider is configured.

**Google** (5 minutes): in [Google Cloud Console](https://console.cloud.google.com/apis/credentials) create an OAuth client ID of type Web application. Add `https://money-drops.vercel.app/api/auth/google/callback` (and `http://localhost:3000/api/auth/google/callback` for local dev) as an authorised redirect URI. Set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`.

**Apple** (needs a paid Apple Developer account): in [Certificates, Identifiers & Profiles](https://developer.apple.com/account/resources/identifiers) create an App ID with "Sign in with Apple", then a Services ID (this is the client id) with Sign in with Apple enabled, domain `money-drops.vercel.app` and return URL `https://money-drops.vercel.app/api/auth/apple/callback`. Set `APPLE_CLIENT_ID` to the Services ID. No private key is needed: the app uses the hybrid flow and verifies Apple's ID token directly. Apple only returns the user's name on the first sign-in, and may give a private relay email.

If redirect URIs come out wrong behind a proxy, set `APP_URL` to the public origin.

## Spam moderation

Every chat message, bounty and hidden-money post is screened before it is saved (`src/lib/moderate.ts`). A built-in heuristic blocks obvious junk (links in chat, scam bait, repeated characters). With `ANTHROPIC_API_KEY` set, anything that passes the heuristic is also checked by Claude (`claude-opus-5-5`, override with `MODERATION_MODEL`), which is told to flag spam, scams and bot junk only and to allow everything else. If the API is unreachable the post goes through, so an outage never locks real users out. Blocked posts return a 400 with the reason, which the forms show inline.
