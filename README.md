# BLACKPINK BORN PINK ENCORE: Ticket Hub

Online ticket hunting and seat selection for a two-night concert, paid in USDC on Arc Testnet. Fans pick numbered seats on an interactive stadium map, pay with USDC and receive an NFT ticket with a QR check-in code. The app also has a lightstick shop, a resale and seat-upgrade market, and a fan leaderboard.

Built with [Arc Studio](https://studio.arc.io)

## Tech stack

- React, Vite, TypeScript, Tailwind CSS
- wagmi, viem, ConnectKit (injected wallets)
- Solidity (Foundry) with OpenZeppelin, deployed on Arc Testnet
- USDC (ERC-20, 6 decimals) for all payments

## Features

- Interactive T-stage seat map with three ticket classes (10, 25 and 100 USDC) and live sold, free and selected seat colors
- 10-minute seat hold timer in the cart (the seat is guaranteed only once the purchase is confirmed onchain)
- NFT tickets with buyer name, seat, zone, check-in gate and QR code
- Resale market (5% organizer fee), seat upgrades, virtual lightstick shop
- "Top BLINKs" leaderboard by Fan Points and VIP tickets
- Up to 6 tickets per wallet per night

## Development

Prerequisites: [Bun](https://bun.sh) and, for contracts, [Foundry](https://getfoundry.sh).

```bash
bun install
bun run dev          # start the app on http://localhost:5173
bun run check        # lint and typecheck
bun run contracts:build
bun run contracts:test
```

Use a wallet on Arc Testnet and get test USDC from the Arc Studio sidebar ("Get test USDC") or the Circle faucet.

### Environment variables

None.

## Contracts

- `contracts/BlackpinkTickets.sol`: ticket sales, resale, upgrades, lightsticks and fan rewards. Not upgradeable. The owner can pause sales, open or close a night and withdraw revenue.
- Unit tests live in `contracts/test/`.

Ticket photos are from [Unsplash](https://unsplash.com). This is a demo and is not affiliated with BLACKPINK or YG Entertainment.
