// ══════════════════════════════════════════════════════════════
// OptimEngine Solver Bridge v4 — FULL STACK
// All 9 solver tools + health check
// Parameter path syntax: jobs[ID].tasks[ID].field
// ══════════════════════════════════════════════════════════════

const OPTIMENGINE_URL = process.env.OPTIMENGINE_URL || "https://optim-engine-production.up.railway.app";

async function callEngine(endpoint, body) {
  const resp = await fetch(`${OPTIMENGINE_URL}${endpoint}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Engine-Key": process.env.ENGINE_API_KEY || "" },
    body: JSON.stringify(body),
  });
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`OptimEngine ${endpoint} returned ${resp.status}: ${text.slice(0, 300)}`);
  }
  return resp.json();
}

// ═══ L1 CORE SOLVERS ═══

/** Flexible Job-Shop Scheduling — FJSP with OR-Tools CP-SAT */
export async function solveSchedule(input) {
  const defaultInput = {
    jobs: [
      { job_id: "J1", tasks: [{ task_id: "T1", duration: 3, eligible_machines: ["M1", "M2"] }, { task_id: "T2", duration: 2, eligible_machines: ["M2", "M3"] }] },
      { job_id: "J2", tasks: [{ task_id: "T3", duration: 4, eligible_machines: ["M1", "M3"] }, { task_id: "T4", duration: 1, eligible_machines: ["M2"] }] },
    ],
    machines: [{ machine_id: "M1" }, { machine_id: "M2" }, { machine_id: "M3" }],
    objective: "minimize_makespan",
  };
  return callEngine("/optimize_schedule", input && input.jobs ? input : defaultInput);
}

/** Vehicle Routing — CVRPTW with OR-Tools Routing */
export async function solveRouting(input) {
  const defaultInput = {
    depot_id: "depot",
    locations: [
      { location_id: "depot", demand: 0 },
      { location_id: "A", demand: 3, time_window_start: 0, time_window_end: 50 },
      { location_id: "B", demand: 5, time_window_start: 0, time_window_end: 50 },
      { location_id: "C", demand: 4, time_window_start: 10, time_window_end: 40 },
    ],
    vehicles: [{ vehicle_id: "V1", capacity: 10 }, { vehicle_id: "V2", capacity: 8 }],
    distance_matrix: [
      { from_id: "depot", to_id: "A", distance: 10 }, { from_id: "depot", to_id: "B", distance: 15 },
      { from_id: "depot", to_id: "C", distance: 20 }, { from_id: "A", to_id: "depot", distance: 10 },
      { from_id: "A", to_id: "B", distance: 12 }, { from_id: "A", to_id: "C", distance: 8 },
      { from_id: "B", to_id: "depot", distance: 15 }, { from_id: "B", to_id: "A", distance: 12 },
      { from_id: "B", to_id: "C", distance: 10 }, { from_id: "C", to_id: "depot", distance: 20 },
      { from_id: "C", to_id: "A", distance: 8 }, { from_id: "C", to_id: "B", distance: 10 },
    ],
  };
  return callEngine("/optimize_routing", input && input.depot_id ? input : defaultInput);
}

/** Bin Packing — OR-Tools CP-SAT */
export async function solvePacking(input) {
  const defaultInput = {
    bins: [{ bin_id: "B1", weight_capacity: 20 }, { bin_id: "B2", weight_capacity: 15 }],
    items: [
      { item_id: "I1", weight: 8, value: 10 }, { item_id: "I2", weight: 6, value: 7 },
      { item_id: "I3", weight: 5, value: 8 }, { item_id: "I4", weight: 12, value: 15 },
      { item_id: "I5", weight: 3, value: 4 },
    ],
    objective: "minimize_bins",
  };
  return callEngine("/optimize_packing", input && input.bins ? input : defaultInput);
}

// ═══ L2 RISK & UNCERTAINTY ═══

/** Multi-Objective Pareto Frontier — 2-4 objectives on any L1 solver */
export async function solvePareto(input) {
  const defaultInput = {
    solver_type: "scheduling",
    objectives: [
      { name: "minimize_makespan", weight: 1 },
      { name: "minimize_total_tardiness", weight: 1 },
    ],
    solver_request: {
      jobs: [
        { job_id: "J1", due_date: 10, tasks: [{ task_id: "T1", duration: 3, eligible_machines: ["M1", "M2"] }, { task_id: "T2", duration: 2, eligible_machines: ["M2", "M3"] }] },
        { job_id: "J2", due_date: 8, tasks: [{ task_id: "T3", duration: 4, eligible_machines: ["M1", "M3"] }, { task_id: "T4", duration: 1, eligible_machines: ["M2"] }] },
      ],
      machines: [{ machine_id: "M1" }, { machine_id: "M2" }, { machine_id: "M3" }],
    },
    num_points: 5,
  };
  return callEngine("/optimize_pareto", input && input.solver_type ? input : defaultInput);
}

/** Stochastic Optimization — Monte Carlo CVaR */
export async function solveStochastic(input) {
  const defaultInput = {
    solver_type: "scheduling",
    solver_request: {
      jobs: [
        { job_id: "J1", tasks: [{ task_id: "T1", duration: 5, eligible_machines: ["M1", "M2"] }, { task_id: "T2", duration: 3, eligible_machines: ["M2"] }] },
        { job_id: "J2", tasks: [{ task_id: "T3", duration: 4, eligible_machines: ["M1"] }, { task_id: "T4", duration: 2, eligible_machines: ["M1", "M2"] }] },
      ],
      machines: [{ machine_id: "M1" }, { machine_id: "M2" }],
      objective: "minimize_makespan",
    },
    stochastic_parameters: [
      { parameter_path: "jobs[J1].tasks[T1].duration", distribution: "normal", mean: 5, std_dev: 1.5 },
      { parameter_path: "jobs[J2].tasks[T3].duration", distribution: "uniform", min_value: 2, max_value: 6 },
    ],
    num_scenarios: 50,
    optimize_for: "cvar_95",
  };
  return callEngine("/optimize_stochastic", input && input.solver_type ? input : defaultInput);
}

/** Robust Optimization — worst-case, percentile, regret minimization */
export async function solveRobust(input) {
  const defaultInput = {
    solver_type: "scheduling",
    solver_request: {
      jobs: [
        { job_id: "J1", tasks: [{ task_id: "T1", duration: 5, eligible_machines: ["M1", "M2"] }] },
        { job_id: "J2", tasks: [{ task_id: "T2", duration: 3, eligible_machines: ["M1"] }] },
      ],
      machines: [{ machine_id: "M1" }, { machine_id: "M2" }],
      objective: "minimize_makespan",
    },
    uncertain_parameters: [
      { parameter_path: "jobs[J1].tasks[T1].duration", min_value: 3, max_value: 8 },
      { parameter_path: "jobs[J2].tasks[T2].duration", min_value: 1, max_value: 6 },
    ],
    num_scenarios: 20,
    mode: "worst_case",
  };
  return callEngine("/optimize_robust", input && input.solver_type ? input : defaultInput);
}

// ═══ L3 INTELLIGENCE ═══

/** Sensitivity Analysis — parametric perturbation, elasticity, risk ranking */
export async function solveSensitivity(input) {
  const defaultInput = {
    solver_type: "scheduling",
    solver_request: {
      jobs: [
        { job_id: "J1", tasks: [{ task_id: "T1", duration: 5, eligible_machines: ["M1", "M2"] }] },
        { job_id: "J2", tasks: [{ task_id: "T2", duration: 3, eligible_machines: ["M1"] }] },
      ],
      machines: [{ machine_id: "M1" }, { machine_id: "M2" }],
      objective: "minimize_makespan",
    },
  };
  return callEngine("/analyze_sensitivity", input && input.solver_type ? input : defaultInput);
}

/** Prescriptive Intelligence — forecast + optimize + risk + recommendations */
export async function solvePrescriptive(input) {
  const defaultInput = {
    solver_type: "scheduling",
    solver_request: {
      jobs: [
        { job_id: "J1", tasks: [{ task_id: "T1", duration: 5, eligible_machines: ["M1", "M2"] }] },
        { job_id: "J2", tasks: [{ task_id: "T2", duration: 3, eligible_machines: ["M1"] }] },
      ],
      machines: [{ machine_id: "M1" }, { machine_id: "M2" }],
      objective: "minimize_makespan",
    },
    forecast_parameters: [
      {
        parameter_path: "jobs[J1].tasks[T1].duration",
        historical_data: [
          { period: 0, value: 4 }, { period: 1, value: 5 }, { period: 2, value: 5 },
          { period: 3, value: 6 }, { period: 4, value: 7 },
        ],
        forecast_method: "linear_trend",
      },
    ],
    risk_appetite: "moderate",
  };
  return callEngine("/prescriptive_advise", input && input.solver_type ? input : defaultInput);
}

// ═══ VALIDATION ═══

/** Schedule Validation — check constraints */
export async function solveValidate(input) {
  if (!input || !input.schedule) {
    throw new Error("Validation requires 'jobs', 'machines', and 'schedule' fields in the request body.");
  }
  return callEngine("/validate_schedule", input);
}

// ═══ HEALTH ═══

export async function healthCheck() {
  try {
    const resp = await fetch(`${OPTIMENGINE_URL}/health`);
    if (resp.ok) return { status: "connected", method: "http" };
    return { status: "degraded", code: resp.status };
  } catch (err) {
    return { status: "unreachable", error: err.message };
  }
}
