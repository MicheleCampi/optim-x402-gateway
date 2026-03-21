# OptimEngine x402 Gateway

Payment gateway for OptimEngine v9.0.0 — enables pay-per-solve optimization via the x402 protocol.

**ERC-8004 Agent #22518** | Base L2

## What This Does

This gateway wraps OptimEngine's MCP solver tools behind x402 HTTP payment endpoints. AI agents and DeFi protocols can request optimization solves and pay per-request in USDC — no API keys, no subscriptions.

## Endpoints

| Endpoint | Price | Solver | Description |
|---|---|---|---|
| `POST /solve/portfolio` | $0.10 | Pareto + CVaR Monte Carlo | Multi-objective portfolio optimization |
| `POST /solve/vpp` | $0.25 | Stochastic + Prescriptive | Virtual Power Plant dispatch scheduling |
| `POST /solve/schedule` | $0.15 | FJSP | Flexible Job-Shop Scheduling |
| `GET /health` | Free | — | Gateway + engine status |
| `GET /.well-known/x402` | Free | — | Service discovery for agents |

## Quick Start

```bash
# Clone and install
git clone https://github.com/YOUR_USER/optim-x402-gateway.git
cd optim-x402-gateway
npm install

# Configure
cp .env.example .env
# Edit .env with your Phantom wallet 0x address

# Run (testnet — no CDP account needed)
npm run dev
```

## Configuration

Copy `.env.example` to `.env` and set:

- `WALLET_ADDRESS` — Your 0x address (Phantom on Base)
- `OPTIMENGINE_URL` — OptimEngine Railway URL
- `FACILITATOR_URL` — `https://x402.org/facilitator` for testnet
- `NETWORK` — `eip155:84532` (Base Sepolia) or `eip155:8453` (Base Mainnet)

## Switching to Mainnet

1. Create CDP account at `portal.cdp.coinbase.com`
2. Get API keys
3. Update `.env`:
   ```
   FACILITATOR_URL=https://api.cdp.coinbase.com/platform/v2/x402
   NETWORK=eip155:8453
   CDP_API_KEY_ID=your_key
   CDP_API_KEY_SECRET=your_secret
   ```

## Deploy to Railway

Railway auto-deploys on push to main. Set environment variables in Railway dashboard.

## Architecture

```
Agent/Client → x402 Gateway (this) → OptimEngine MCP (Railway)
     ↕                   ↕
  USDC payment      Optimization result
  (Base L2)         (JSON response)
```

## License

MIT
