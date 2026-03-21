// ══════════════════════════════════════════════════════════════
// OptimEngine Solver Bridge
// Translates x402 gateway requests → OptimEngine MCP calls
// ══════════════════════════════════════════════════════════════

const OPTIMENGINE_URL = process.env.OPTIMENGINE_URL || "https://optim-engine-production.up.railway.app";

/**
 * Call OptimEngine MCP tool via HTTP
 */
async function callOptimEngine(toolName, args) {
  const response = await fetch(`${OPTIMENGINE_URL}/mcp`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: Date.now(),
      method: "tools/call",
      params: { name: toolName, arguments: args },
    }),
  });

  if (!response.ok) {
    throw new Error(`OptimEngine returned ${response.status}: ${response.statusText}`);
  }

  const data = await response.json();

  if (data.error) {
    throw new Error(`OptimEngine error: ${data.error.message || JSON.stringify(data.error)}`);
  }

  // MCP tools/call returns result.content array
  if (data.result?.content) {
    const textContent = data.result.content.find(c => c.type === "text");
    if (textContent) {
      try {
        return JSON.parse(textContent.text);
      } catch {
        return textContent.text;
      }
    }
  }

  return data.result;
}

/**
 * Portfolio Optimization — Pareto + Monte Carlo CVaR
 * 
 * Input format:
 * {
 *   assets: ["BTC", "ETH", "SOL", "USDC"],
 *   expected_returns: [0.12, 0.15, 0.25, 0.04],
 *   volatilities: [0.35, 0.40, 0.60, 0.01],
 *   correlations: [[1, 0.7, 0.5, 0], ...],   // optional
 *   risk_budget: 0.20,                         // max portfolio volatility
 *   num_scenarios: 1000,                       // Monte Carlo scenarios
 *   confidence_level: 0.95                     // CVaR confidence
 * }
 */
export async function solvePortfolio(input) {
  const {
    assets = ["Asset_A", "Asset_B", "Asset_C"],
    expected_returns = [0.10, 0.15, 0.08],
    volatilities = [0.20, 0.35, 0.15],
    risk_budget = 0.25,
    num_scenarios = 1000,
    confidence_level = 0.95,
  } = input || {};

  // Step 1: Pareto optimization (return vs risk)
  const paretoResult = await callOptimEngine("optimize_pareto", {
    objectives: [
      {
        name: "expected_return",
        type: "maximize",
        parameters: expected_returns.map((r, i) => ({
          name: `weight_${assets[i]}`,
          coefficient: r,
        })),
      },
      {
        name: "portfolio_risk",
        type: "minimize",
        parameters: volatilities.map((v, i) => ({
          name: `weight_${assets[i]}`,
          coefficient: v,
        })),
      },
    ],
    constraints: [
      {
        name: "full_allocation",
        type: "equality",
        value: 1.0,
        parameters: assets.map((a, i) => ({
          name: `weight_${a}`,
          coefficient: 1.0,
        })),
      },
    ],
    variable_bounds: assets.map(a => ({
      name: `weight_${a}`,
      lower: 0.0,
      upper: 1.0,
    })),
    num_points: 10,
  });

  // Step 2: Monte Carlo CVaR analysis on best Pareto point
  const stochasticResult = await callOptimEngine("optimize_stochastic", {
    objective: {
      name: "risk_adjusted_return",
      type: "maximize",
      parameters: expected_returns.map((r, i) => ({
        name: `weight_${assets[i]}`,
        coefficient: r,
      })),
    },
    uncertain_parameters: volatilities.map((v, i) => ({
      name: `volatility_${assets[i]}`,
      distribution: "normal",
      mean: v,
      std_dev: v * 0.3,
    })),
    constraints: [
      {
        name: "full_allocation",
        type: "equality",
        value: 1.0,
        parameters: assets.map(a => ({
          name: `weight_${a}`,
          coefficient: 1.0,
        })),
      },
    ],
    variable_bounds: assets.map(a => ({
      name: `weight_${a}`,
      lower: 0.0,
      upper: 1.0,
    })),
    num_scenarios,
    confidence_level,
  });

  return {
    pareto_frontier: paretoResult,
    risk_analysis: stochasticResult,
    meta: { assets, num_scenarios, confidence_level },
  };
}

/**
 * VPP Stochastic Optimization
 * 
 * Input format:
 * {
 *   batteries: [{ id: "bat_1", capacity_kwh: 100, max_charge_kw: 50 }],
 *   solar_forecast_kw: [10, 30, 50, 40, 20, 5],    // hourly
 *   grid_prices_eur: [0.05, 0.08, 0.15, 0.20, 0.12, 0.06],
 *   demand_kw: [30, 40, 60, 50, 35, 25],
 *   price_uncertainty: 0.20,        // ±20% price variation
 *   solar_uncertainty: 0.30,        // ±30% solar variation
 *   num_scenarios: 500
 * }
 */
export async function solveVPP(input) {
  const {
    time_slots = 6,
    grid_prices = [0.05, 0.08, 0.15, 0.20, 0.12, 0.06],
    demand_kw = [30, 40, 60, 50, 35, 25],
    solar_forecast = [10, 30, 50, 40, 20, 5],
    price_uncertainty = 0.20,
    solar_uncertainty = 0.30,
    num_scenarios = 500,
    confidence_level = 0.95,
  } = input || {};

  const result = await callOptimEngine("optimize_stochastic", {
    objective: {
      name: "minimize_energy_cost",
      type: "minimize",
      parameters: grid_prices.map((p, t) => ({
        name: `grid_import_t${t}`,
        coefficient: p,
      })),
    },
    uncertain_parameters: [
      ...grid_prices.map((p, t) => ({
        name: `price_t${t}`,
        distribution: "normal",
        mean: p,
        std_dev: p * price_uncertainty,
      })),
      ...solar_forecast.map((s, t) => ({
        name: `solar_t${t}`,
        distribution: "normal",
        mean: s,
        std_dev: s * solar_uncertainty,
      })),
    ],
    constraints: demand_kw.map((d, t) => ({
      name: `demand_balance_t${t}`,
      type: "gte",
      value: d,
      parameters: [
        { name: `grid_import_t${t}`, coefficient: 1.0 },
        { name: `battery_discharge_t${t}`, coefficient: 1.0 },
      ],
    })),
    variable_bounds: [
      ...grid_prices.map((_, t) => ({ name: `grid_import_t${t}`, lower: 0, upper: 200 })),
      ...grid_prices.map((_, t) => ({ name: `battery_discharge_t${t}`, lower: 0, upper: 50 })),
    ],
    num_scenarios,
    confidence_level,
  });

  return {
    dispatch_schedule: result,
    meta: { time_slots, num_scenarios, confidence_level },
  };
}

/**
 * Flexible Job-Shop Scheduling
 * 
 * Input: standard FJSP format with jobs, machines, operations
 */
export async function solveSchedule(input) {
  // Pass through to OptimEngine FJSP solver
  const result = await callOptimEngine("optimize_schedule", input || {
    jobs: [
      { id: "J1", operations: [{ id: "O1", machines: ["M1", "M2"], duration: 3 }, { id: "O2", machines: ["M2", "M3"], duration: 2 }] },
      { id: "J2", operations: [{ id: "O3", machines: ["M1", "M3"], duration: 4 }, { id: "O4", machines: ["M2"], duration: 1 }] },
    ],
    machines: [{ id: "M1" }, { id: "M2" }, { id: "M3" }],
    optimization_target: "makespan",
  });

  return result;
}

/**
 * Health check — ping OptimEngine
 */
export async function healthCheck() {
  try {
    const result = await callOptimEngine("health_check", {});
    return { status: "connected", ...result };
  } catch (err) {
    // Try direct HTTP health check
    try {
      const resp = await fetch(`${OPTIMENGINE_URL}/health`);
      if (resp.ok) {
        return { status: "connected", method: "http" };
      }
    } catch {}
    return { status: "unreachable", error: err.message };
  }
}
