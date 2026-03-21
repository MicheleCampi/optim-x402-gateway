// ══════════════════════════════════════════════════════════════
// OptimEngine x402 Gateway — Server
// ERC-8004 Agent #22518 | Base L2
// ══════════════════════════════════════════════════════════════

import "dotenv/config";
import express from "express";
import { paymentMiddleware, x402ResourceServer } from "@x402/express";
import { ExactEvmScheme } from "@x402/evm/exact/server";
import { HTTPFacilitatorClient } from "@x402/core/server";
import { solvePortfolio, solveVPP, solveSchedule, healthCheck } from "./solvers.js";

// ── Configuration ──
const PORT = process.env.PORT || 4402;
const WALLET = process.env.WALLET_ADDRESS;
const FACILITATOR = process.env.FACILITATOR_URL || "https://x402.org/facilitator";
const NETWORK = process.env.NETWORK || "eip155:84532"; // Base Sepolia default

if (!WALLET) {
  console.error("❌ WALLET_ADDRESS is required in .env");
  process.exit(1);
}

// ── x402 Setup ──
const facilitatorClient = new HTTPFacilitatorClient({ url: FACILITATOR });
const server = new x402ResourceServer(facilitatorClient)
  .register(NETWORK, new ExactEvmScheme());

// ── Express App ──
const app = express();
app.use(express.json());

// ── Payment-Protected Routes ──
// Each route maps to an OptimEngine solver with a price in USDC
const paidRoutes = {
  "POST /solve/portfolio": {
    accepts: [{
      scheme: "exact",
      price: "$0.10",        // $0.10 USDC per portfolio optimization
      network: NETWORK,
      payTo: WALLET,
    }],
    description: "Multi-objective portfolio optimization (Pareto + CVaR Monte Carlo). Returns efficient frontier with risk-adjusted allocations.",
    mimeType: "application/json",
  },
  "POST /solve/vpp": {
    accepts: [{
      scheme: "exact",
      price: "$0.25",        // $0.25 USDC per VPP optimization
      network: NETWORK,
      payTo: WALLET,
    }],
    description: "Virtual Power Plant stochastic optimization. Battery dispatch scheduling under price/generation uncertainty with CVaR risk control.",
    mimeType: "application/json",
  },
  "POST /solve/schedule": {
    accepts: [{
      scheme: "exact",
      price: "$0.15",        // $0.15 USDC per scheduling solve
      network: NETWORK,
      payTo: WALLET,
    }],
    description: "Flexible Job-Shop Scheduling with setup times, machine availability, and quality constraints.",
    mimeType: "application/json",
  },
};

// Apply x402 middleware only to paid routes
app.use(paymentMiddleware(paidRoutes, server));

// ── Free Routes (no payment required) ──
app.get("/health", async (_req, res) => {
  try {
    const engineHealth = await healthCheck();
    res.json({
      gateway: "operational",
      version: "1.0.0",
      agent: "ERC-8004 #22518",
      network: NETWORK,
      facilitator: FACILITATOR,
      wallet: WALLET,
      engine: engineHealth,
      endpoints: Object.keys(paidRoutes).map(r => {
        const [method, path] = r.split(" ");
        const route = paidRoutes[r];
        return {
          method,
          path,
          price: route.accepts[0].price,
          description: route.description,
        };
      }),
    });
  } catch (err) {
    res.status(503).json({ gateway: "operational", engine: "unreachable", error: err.message });
  }
});

// Service discovery endpoint (for x402 Bazaar / agent discovery)
app.get("/.well-known/x402", (_req, res) => {
  res.json({
    name: "OptimEngine",
    description: "Manufacturing & financial optimization solver — 11 MCP tools. ERC-8004 Agent #22518.",
    agent_id: "22518",
    erc8004_chain: "eip155:8453",
    version: "9.0.0",
    endpoints: Object.entries(paidRoutes).map(([route, config]) => {
      const [method, path] = route.split(" ");
      return { method, path, ...config };
    }),
  });
});

// ── Paid Route Handlers ──
app.post("/solve/portfolio", async (req, res) => {
  try {
    const result = await solvePortfolio(req.body);
    res.json({ success: true, solver: "pareto+stochastic", result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post("/solve/vpp", async (req, res) => {
  try {
    const result = await solveVPP(req.body);
    res.json({ success: true, solver: "stochastic+prescriptive", result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post("/solve/schedule", async (req, res) => {
  try {
    const result = await solveSchedule(req.body);
    res.json({ success: true, solver: "fjsp", result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── Start ──
app.listen(PORT, () => {
  console.log(`
╔══════════════════════════════════════════════════════════╗
║  OptimEngine x402 Gateway v1.0.0                        ║
║  ERC-8004 Agent #22518 | Base L2                        ║
╠══════════════════════════════════════════════════════════╣
║  Server:      http://localhost:${PORT}                    ║
║  Network:     ${NETWORK.padEnd(39)}║
║  Facilitator: ${FACILITATOR.length > 39 ? FACILITATOR.slice(0, 36) + "..." : FACILITATOR.padEnd(39)}║
║  Wallet:      ${WALLET.slice(0, 6)}...${WALLET.slice(-4)}                               ║
╠══════════════════════════════════════════════════════════╣
║  Endpoints:                                              ║
║    POST /solve/portfolio  — $0.10/solve                  ║
║    POST /solve/vpp        — $0.25/solve                  ║
║    POST /solve/schedule   — $0.15/solve                  ║
║    GET  /health           — free                         ║
║    GET  /.well-known/x402 — free (discovery)             ║
╚══════════════════════════════════════════════════════════╝
  `);
});
