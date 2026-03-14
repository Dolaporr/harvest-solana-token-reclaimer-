# Harvest — Solana Token Reclaimer

Harvest is a Solana dApp that scans your wallet for empty token accounts and lets you reclaim the rent in a few clicks.

## Features
- Scan Token and Token-2022 accounts
- Reclaim rent safely with batched transactions
- Wallet support via Solana Wallet Adapter (Phantom, Solflare, Backpack)
- Helius RPC recommended for fast, reliable metadata + RPC
- Clean UX with instant feedback

## Tech Stack
- React + TypeScript + Vite
- Tailwind CSS + Radix UI
- Solana web3.js + SPL Token
- TanStack Query + Zod

## Getting Started
1. Install deps:

```bash
npm install
```

2. Create your env file:

```bash
cp .env.example .env
```

3. Add your Helius key:

```
VITE_HELIUS_API_KEY=YOUR_API_KEY_HERE
```

4. Start the dev server:

```bash
npm run dev
```

## Notes
- Never commit your `.env` file.
- If you don’t use Helius, the app falls back to the public Solana RPC (rate-limited).

## License
MIT
