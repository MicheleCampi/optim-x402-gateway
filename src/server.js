// ══════════════════════════════════════════════════════════════
// OptimEngine x402 Gateway — Server v3 (Full Stack)
// ERC-8004 Agent #22518 | Base L2
// ALL 9 solver tools exposed as x402 paid endpoints
// ══════════════════════════════════════════════════════════════

import "dotenv/config";
import rateLimit from "express-rate-limit";
import express from "express";
import { paymentMiddleware, x402ResourceServer } from "@x402/express";
import { ExactEvmScheme } from "@x402/evm/exact/server";
import { HTTPFacilitatorClient } from "@x402/core/server";
import { createFacilitatorConfig } from "@coinbase/x402";
import * as solvers from "./solvers.js";
import { registerDocsRoutes } from "./docs.js";
import { trackRequest, trackPayment, getStats } from "./stats.js";

const PORT = process.env.PORT || 4402;
const WALLET = process.env.WALLET_ADDRESS;
const NETWORK = process.env.NETWORK || "eip155:84532";

if (!WALLET) { console.error("WALLET_ADDRESS required"); process.exit(1); }

// ── Facilitator ──
const cdpKeyId = process.env.CDP_API_KEY_ID;
const cdpKeySecret = process.env.CDP_API_KEY_SECRET;
const facilitatorConfig = (cdpKeyId && cdpKeySecret)
  ? createFacilitatorConfig(cdpKeyId, cdpKeySecret)
  : { url: "https://x402.org/facilitator" };
const facilitatorClient = new HTTPFacilitatorClient(facilitatorConfig);
const server = new x402ResourceServer(facilitatorClient)
  .register(NETWORK, new ExactEvmScheme());

const app = express();
app.use(express.json({ limit: "100kb" }));

const limiter = rateLimit({ windowMs: 60 * 1000, max: 60, message: { status: 429, message: "Too many requests. Max 60/minute." } });
app.use("/solve", limiter);
app.use("/stats", rateLimit({ windowMs: 60 * 1000, max: 10 }));

// ── Pricing tiers ──
const accept = (price) => [{ scheme: "exact", network: NETWORK, price, payTo: WALLET }];

const paidRoutes = {
  // L1 — Core Solvers
  "POST /solve/schedule":    { accepts: accept("$0.15"), description: "Flexible Job-Shop Scheduling — FJSP with setup times, availability windows, quality constraints, 4 objectives", mimeType: "application/json" },
  "POST /solve/routing":     { accepts: accept("$0.20"), description: "Vehicle Routing — CVRPTW with capacity, time windows, distance matrix, drop visits", mimeType: "application/json" },
  "POST /solve/packing":     { accepts: accept("$0.10"), description: "Bin Packing — weight/volume constraints, groups, partial packing, 4 objectives", mimeType: "application/json" },
  // L2 — Risk & Uncertainty
  "POST /solve/pareto":      { accepts: accept("$0.20"), description: "Multi-Objective Pareto Frontier — 2-4 objectives trade-off on any L1 solver", mimeType: "application/json" },
  "POST /solve/stochastic":  { accepts: accept("$0.25"), description: "Stochastic Optimization — Monte Carlo CVaR with normal/uniform/triangular/log-normal distributions", mimeType: "application/json" },
  "POST /solve/robust":      { accepts: accept("$0.20"), description: "Robust Optimization — worst-case, percentile 90/95, regret minimization under uncertainty", mimeType: "application/json" },
  // L3 — Intelligence
  "POST /solve/sensitivity": { accepts: accept("$0.15"), description: "Sensitivity Analysis — parametric perturbation, elasticity, risk ranking, critical parameter detection", mimeType: "application/json" },
  "POST /solve/prescriptive":{ accepts: accept("$0.30"), description: "Prescriptive Intelligence — forecast (4 methods) + optimize + risk assess + actionable recommendations", mimeType: "application/json" },
  // Validation
  "POST /solve/validate":    { accepts: accept("$0.05"), description: "Schedule Validation — check existing schedule for constraint violations", mimeType: "application/json" },
};

app.use(paymentMiddleware(paidRoutes, server));

// ── Free Routes ──
app.get("/stats", (_req, res) => { res.json(getStats()); });

app.get("/health", async (_req, res) => {
  try {
    const engineHealth = await solvers.healthCheck();
    res.json({
      gateway: "operational", version: "3.0.0", agent: "ERC-8004 #22518",
      network: NETWORK, wallet: WALLET, engine: engineHealth,
      paid_endpoints: Object.entries(paidRoutes).map(([r, c]) => {
        const [method, path] = r.split(" ");
        return { method, path, price: c.accepts[0].price, description: c.description };
      }),
      free_endpoints: [
        { method: "GET", path: "/health" },
        { method: "GET", path: "/.well-known/x402" },
      ],
    });
  } catch (err) {
    res.status(503).json({ gateway: "operational", engine: "unreachable", error: err.message });
  }
});

app.get("/.well-known/x402", (_req, res) => {
  res.json({
    name: "OptimEngine", version: "9.0.0", agent_id: "22518", erc8004_chain: "eip155:8453",
    description: "Full-stack manufacturing & operations optimization — 9 paid solver endpoints. Scheduling, routing, packing, Pareto, Monte Carlo CVaR, robust, sensitivity, prescriptive intelligence, validation. ERC-8004 Agent #22518.",
    endpoints: Object.entries(paidRoutes).map(([r, c]) => {
      const [method, path] = r.split(" ");
      return { method, path, ...c };
    }),
  });
});

// ── API Documentation (free) ──
registerDocsRoutes(app);

// ── L1 Core Solvers ──
app.post("/solve/schedule", async (req, res) => {
  const t0 = Date.now();
  try { const r = await solvers.solveSchedule(req.body); trackRequest("/solve/schedule", 200); trackPayment(true, 0.15, "x402-paid", "cdp", "/solve/schedule", Date.now()-t0); res.json({ success: true, solver: "fjsp", result: r }); }
  catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

app.post("/solve/routing", async (req, res) => {
  const t0 = Date.now();
  try { const r = await solvers.solveRouting(req.body); trackRequest("/solve/routing", 200); trackPayment(true, 0.20, "x402-paid", "cdp", "/solve/routing", Date.now()-t0); res.json({ success: true, solver: "cvrptw", result: r }); }
  catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

app.post("/solve/packing", async (req, res) => {
  const t0 = Date.now();
  try { const r = await solvers.solvePacking(req.body); trackRequest("/solve/packing", 200); trackPayment(true, 0.10, "x402-paid", "cdp", "/solve/packing", Date.now()-t0); res.json({ success: true, solver: "bin_packing", result: r }); }
  catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

// ── L2 Risk & Uncertainty ──
app.post("/solve/pareto", async (req, res) => {
  const t0 = Date.now();
  try { const r = await solvers.solvePareto(req.body); trackRequest("/solve/pareto", 200); trackPayment(true, 0.20, "x402-paid", "cdp", "/solve/pareto", Date.now()-t0); res.json({ success: true, solver: "pareto", result: r }); }
  catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

app.post("/solve/stochastic", async (req, res) => {
  const t0 = Date.now();
  try { const r = await solvers.solveStochastic(req.body); trackRequest("/solve/stochastic", 200); trackPayment(true, 0.25, "x402-paid", "cdp", "/solve/stochastic", Date.now()-t0); res.json({ success: true, solver: "monte_carlo_cvar", result: r }); }
  catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

app.post("/solve/robust", async (req, res) => {
  const t0 = Date.now();
  try { const r = await solvers.solveRobust(req.body); trackRequest("/solve/robust", 200); trackPayment(true, 0.20, "x402-paid", "cdp", "/solve/robust", Date.now()-t0); res.json({ success: true, solver: "robust", result: r }); }
  catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

// ── L3 Intelligence ──
app.post("/solve/sensitivity", async (req, res) => {
  const t0 = Date.now();
  try { const r = await solvers.solveSensitivity(req.body); trackRequest("/solve/sensitivity", 200); trackPayment(true, 0.15, "x402-paid", "cdp", "/solve/sensitivity", Date.now()-t0); res.json({ success: true, solver: "sensitivity", result: r }); }
  catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

app.post("/solve/prescriptive", async (req, res) => {
  const t0 = Date.now();
  try { const r = await solvers.solvePrescriptive(req.body); trackRequest("/solve/prescriptive", 200); trackPayment(true, 0.30, "x402-paid", "cdp", "/solve/prescriptive", Date.now()-t0); res.json({ success: true, solver: "prescriptive", result: r }); }
  catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

// ── Validation ──
app.post("/solve/validate", async (req, res) => {
  const t0 = Date.now();
  try { const r = await solvers.solveValidate(req.body); trackRequest("/solve/validate", 200); trackPayment(true, 0.05, "x402-paid", "cdp", "/solve/validate", Date.now()-t0); res.json({ success: true, solver: "validate", result: r }); }
  catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

// ── Start ──
const isMainnet = NETWORK === "eip155:8453";
const label = isMainnet ? "Base MAINNET" : "Base Sepolia";
const auth = (cdpKeyId && cdpKeySecret) ? "CDP" : "x402.org";

app.listen(PORT, () => {
  console.log(`
╔══════════════════════════════════════════════════════════════╗
║  OptimEngine x402 Gateway v3.0.0 — FULL STACK               ║
║  ERC-8004 Agent #22518 | ${label.padEnd(35)}║
╠══════════════════════════════════════════════════════════════╣
║  Facilitator: ${auth.padEnd(46)}║
║  Wallet:      ${WALLET.slice(0, 6)}...${WALLET.slice(-4)}                                    ║
╠══════════════════════════════════════════════════════════════╣
║  L1 Core:     /solve/schedule ($0.15)  /solve/routing ($0.20)║
║               /solve/packing  ($0.10)                        ║
║  L2 Risk:     /solve/pareto   ($0.20)  /solve/stochastic($0.25)║
║               /solve/robust   ($0.20)                        ║
║  L3 Intel:    /solve/sensitivity($0.15) /solve/prescriptive($0.30)║
║  Validate:    /solve/validate ($0.05)                        ║
║  Free:        /health  /.well-known/x402                     ║
╚══════════════════════════════════════════════════════════════╝
  `);
});
