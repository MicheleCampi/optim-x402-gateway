// ══════════════════════════════════════════════════════════════
// OptimEngine x402 Gateway — Server
// ERC-8004 Agent #22518 | Base L2
// ══════════════════════════════════════════════════════════════

import "dotenv/config";
import express from "express";
import { paymentMiddleware } from "x402-express";
import { facilitator, createFacilitatorConfig } from "@coinbase/x402";
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
// If CDP keys are set, use authenticated facilitator; otherwise default
const cdpKeyId = process.env.CDP_API_KEY_ID;
const cdpKeySecret = process.env.CDP_API_KEY_SECRET;

const facilitatorConfig = (cdpKeyId && cdpKeySecret)
  ? createFacilitatorConfig(cdpKeyId, cdpKeySecret)
  : facilitator;

// ── Express App ──
const app = express();
app.use(express.json());

// ── Payment-Protected Routes ──
const paidRoutes = {
  "POST /solve/portfolio": {
    price: "$0.10",
    network: NETWORK,
    description: "Multi-objective portfolio optimization (Pareto + CVaR Monte Carlo)",
  },
  "POST /solve/vpp": {
    price: "$0.25",
    network: NETWORK,
    description: "VPP stochastic optimization — battery dispatch under uncertainty",
  },
  "POST /solve/schedule": {
    price: "$0.15",
    network: NETWORK,
    description: "Flexible Job-Shop Scheduling with setup times and quality constraints",
  },
};

// Apply x402 middleware
app.use(paymentMiddleware(WALLET, paidRoutes, facilitatorConfig));

// ── Free Routes ──
app.get("/health", async (_req, res) => {
  try {
    const engineHealth = await healthCheck();
    res.json({
      gateway: "operational",
      version: "1.0.0",
      agent: "ERC-8004 #22518",
      network: NETWORK,
      wallet: WALLET,
      engine: engineHealth,
      endpoints: Object.entries(paidRoutes).map(([route, config]) => {
        const [method, path] = route.split(" ");
        return { method, path, price: config.price, description: config.description };
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
      return { method, path, price: config.price, network: NETWORK, payTo: WALLET, description: config.description };
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
const networkLabel = NETWORK.includes("8453") && !NETWORK.includes("84532") ? "Base MAINNET" : "Base Sepolia (testnet)";
const authLabel = (cdpKeyId && cdpKeySecret) ? "CDP (authenticated)" : "x402.org (public)";

app.listen(PORT, () => {
  console.log(`
╔══════════════════════════════════════════════════════════╗
║  OptimEngine x402 Gateway v1.0.0                        ║
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
