// ══════════════════════════════════════════════════════════════
// OptimEngine x402 Gateway — Server v2
// ERC-8004 Agent #22518 | Base L2
// Uses @x402/express v2 + @coinbase/x402 CDP facilitator
// ══════════════════════════════════════════════════════════════

import "dotenv/config";
import express from "express";
import { paymentMiddleware, x402ResourceServer } from "@x402/express";
import { ExactEvmScheme } from "@x402/evm/exact/server";
import { HTTPFacilitatorClient } from "@x402/core/server";
import { createFacilitatorConfig } from "@coinbase/x402";
import { solvePortfolio, solveVPP, solveSchedule, healthCheck } from "./solvers.js";

// ── Configuration ──
const PORT = process.env.PORT || 4402;
const WALLET = process.env.WALLET_ADDRESS;
const NETWORK = process.env.NETWORK || "base-sepolia";

if (!WALLET) {
  console.error("❌ WALLET_ADDRESS is required in .env");
  process.exit(1);
}

// ── Facilitator Setup ──
const cdpKeyId = process.env.CDP_API_KEY_ID;
const cdpKeySecret = process.env.CDP_API_KEY_SECRET;

const facilitatorConfig = (cdpKeyId && cdpKeySecret)
  ? createFacilitatorConfig(cdpKeyId, cdpKeySecret)
  : { url: "https://x402.org/facilitator" };

const facilitatorClient = new HTTPFacilitatorClient(facilitatorConfig);
const server = new x402ResourceServer(facilitatorClient)
  .register(NETWORK, new ExactEvmScheme());

// ── Express App ──
const app = express();
app.use(express.json());

// ── Payment-Protected Routes ──
const paidRoutes = {
  "POST /solve/portfolio": {
    accepts: [{
      scheme: "exact",
      network: NETWORK,
      price: "$0.10",
      payTo: WALLET,
    }],
    description: "Multi-objective portfolio optimization (Pareto + CVaR Monte Carlo)",
    mimeType: "application/json",
  },
  "POST /solve/vpp": {
    accepts: [{
      scheme: "exact",
      network: NETWORK,
      price: "$0.25",
      payTo: WALLET,
    }],
    description: "VPP stochastic optimization — battery dispatch under uncertainty",
    mimeType: "application/json",
  },
  "POST /solve/schedule": {
    accepts: [{
      scheme: "exact",
      network: NETWORK,
      price: "$0.15",
      payTo: WALLET,
    }],
    description: "Flexible Job-Shop Scheduling with setup times and quality constraints",
    mimeType: "application/json",
  },
};

// Apply x402 v2 middleware
app.use(paymentMiddleware(paidRoutes, server));

// ── Free Routes ──
app.get("/health", async (_req, res) => {
  try {
    const engineHealth = await healthCheck();
    res.json({
      gateway: "operational",
      version: "2.0.0",
      agent: "ERC-8004 #22518",
      network: NETWORK,
      wallet: WALLET,
      engine: engineHealth,
      endpoints: Object.entries(paidRoutes).map(([route, config]) => {
        const [method, path] = route.split(" ");
        return { method, path, price: config.accepts[0].price, description: config.description };
      }),
    });
  } catch (err) {
    res.status(503).json({ gateway: "operational", engine: "unreachable", error: err.message });
  }
});

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
const isMainnet = NETWORK === "base" || NETWORK === "eip155:8453";
const networkLabel = isMainnet ? "Base MAINNET" : "Base Sepolia (testnet)";
const authLabel = (cdpKeyId && cdpKeySecret) ? "CDP (authenticated)" : "x402.org (public)";

app.listen(PORT, () => {
  console.log(`
╔══════════════════════════════════════════════════════════╗
║  OptimEngine x402 Gateway v2.0.0                        ║
║  ERC-8004 Agent #22518 | Base L2                        ║
╠══════════════════════════════════════════════════════════╣
║  Server:      http://localhost:${PORT}                    ║
║  Network:     ${networkLabel.padEnd(39)}║
║  Facilitator: ${authLabel.padEnd(39)}║
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
