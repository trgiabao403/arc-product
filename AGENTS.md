# [App Name]

> Built with Arc Studio - money-powered apps in minutes

This is the **project memory** - what Arc Studio remembers about building this app. It helps future agents (or humans) understand and extend the project.

---

## What This App Does

Concert ticketing hub for BLACKPINK WORLD TOUR - BORN PINK ENCORE on Arc Testnet: numbered seats on an interactive T-stage map, USDC payments, NFT tickets with QR, resale (5% fee), seat upgrades, lightstick shop, fan leaderboard.

## Deployed Contracts

- BlackpinkTickets (Arc Testnet, chain 5042002): 0xdd4417191cc8cfdef749b381f7d988da8d1f30e6, USDC 0x3600000000000000000000000000000000000000, owner = platform deployer wallet (Ownable2Step, immutable code). Deploy block 0x4253b81.
- tokenId = (showId+1)*1000 + seatId. 344 seats per show: 0-239 CAT1 (10 USDC), 240-319 VIP (25), 320-343 VVIP (100). Max 6 tickets held per wallet per show.
- Frontend wiring: src/lib/contract.ts (ABI, address), src/lib/seats.ts (seat layout), src/hooks/useTicketData.ts (reads).

## Tech Stack

- Frontend: React 18, Vite, TypeScript, Tailwind CSS
- Web3: wagmi v2, viem v2, ConnectKit
- Contracts: Solidity 0.8.28 + Foundry. Sources in `contracts/`, unit tests in `contracts/test/*.t.sol`. Build with `bun run contracts:build` (`forge build`), test with `bun run contracts:test` (`forge test`).
- Wallet: injected (MetaMask, etc.)
- Chain: Arc Testnet (Chain ID: 5042002, imported from `viem/chains`)
- Token: USDC (6 decimals) (Address: 0x3600000000000000000000000000000000000000, Chain: Arc Testnet)
- Toasts: Sonner

## Key Files

- `src/App.tsx` - Main application logic
- `src/components/` - UI components
- `src/config.ts` - wagmi config (chains, connectors, transports)

## To Run

```bash
bun install
bun run dev
```
