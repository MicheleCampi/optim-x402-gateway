// ══════════════════════════════════════════════════════════════
// OptimEngine Solver Bridge v3
// Correct parameter_path syntax: jobs[ID].tasks[ID].field
// ══════════════════════════════════════════════════════════════

const OPTIMENGINE_URL = process.env.OPTIMENGINE_URL || "https://optim-engine-production.up.railway.app";

async function callEngine(endpoint, body) {
  const resp = await fetch(`${OPTIMENGINE_URL}${endpoint}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`OptimEngine ${endpoint} returned ${resp.status}: ${text.slice(0, 300)}`);
  }
  return resp.json();
}

/**
 * Multi-Objective Pareto Optimization
 * Trade-off analysis: makespan vs tardiness vs machine utilization
 */
export async function solvePortfolio(input) {
  const defaultRequest = {
    solver_type: "scheduling",
    objectives: [
      { name: "minimize_makespan", weight: 1 },
      { name: "minimize_total_tardiness", weight: 1 },
    ],
    solver_request: {
      jobs: [
        { job_id: "J1", due_date: 10, tasks: [{ task_id: "T1", duration: 3, eligible_machines: ["M1", "M2"] }, { task_id: "T2", duration: 2, eligible_machines: ["M2", "M3"] }] },
        { job_id: "J2", due_date: 8, tasks: [{ task_id: "T3", duration: 4, eligible_machines: ["M1", "M3"] }, { task_id: "T4", duration: 1, eligible_machines: ["M2"] }] },
        { job_id: "J3", due_date: 15, tasks: [{ task_id: "T5", duration: 2, eligible_machines: ["M1"] }, { task_id: "T6", duration: 3, eligible_machines: ["M2", "M3"] }] },
      ],
      machines: [{ machine_id: "M1" }, { machine_id: "M2" }, { machine_id: "M3" }],
    },
    num_points: 5,
  };

  const request = input && input.solver_type ? input : defaultRequest;
  return await callEngine("/optimize_pareto", request);
}

/**
 * Stochastic Optimization with Monte Carlo CVaR
 * Uncertainty in task durations — models production variability, energy generation uncertainty
 */
export async function solveVPP(input) {
  const defaultRequest = {
    solver_type: "scheduling",
    solver_request: {
      jobs: [
        { job_id: "Solar", tasks: [{ task_id: "generate", duration: 5, eligible_machines: ["Grid"] }] },
        { job_id: "Battery", tasks: [{ task_id: "charge", duration: 3, eligible_machines: ["Grid", "Storage"] }] },
        { job_id: "Demand", due_date: 10, tasks: [{ task_id: "deliver", duration: 4, eligible_machines: ["Grid"] }] },
      ],
      machines: [{ machine_id: "Grid" }, { machine_id: "Storage" }],
      objective: "minimize_makespan",
    },
    stochastic_parameters: [
      { parameter_path: "jobs[Solar].tasks[generate].duration", distribution: "normal", mean: 5, std_dev: 2 },
      { parameter_path: "jobs[Battery].tasks[charge].duration", distribution: "uniform", min_value: 2, max_value: 6 },
    ],
    num_scenarios: 50,
    optimize_for: "cvar_95",
  };

  const request = input && input.solver_type ? input : defaultRequest;
  return await callEngine("/optimize_stochastic", request);
}

/**
 * Flexible Job-Shop Scheduling
 * Direct scheduling with setup times, availability windows, quality constraints
 */
export async function solveSchedule(input) {
  const defaultRequest = {
    jobs: [
      { job_id: "J1", tasks: [{ task_id: "O1", duration: 3, eligible_machines: ["M1", "M2"] }, { task_id: "O2", duration: 2, eligible_machines: ["M2", "M3"] }] },
      { job_id: "J2", tasks: [{ task_id: "O3", duration: 4, eligible_machines: ["M1", "M3"] }, { task_id: "O4", duration: 1, eligible_machines: ["M2"] }] },
    ],
    machines: [{ machine_id: "M1" }, { machine_id: "M2" }, { machine_id: "M3" }],
    objective: "minimize_makespan",
  };

  const request = input && Object.keys(input).length > 0 && input.jobs ? input : defaultRequest;
  return await callEngine("/optimize_schedule", request);
}

/**
 * Health check
 */
export async function healthCheck() {
  try {
    const resp = await fetch(`${OPTIMENGINE_URL}/health`);
    if (resp.ok) return { status: "connected", method: "http" };
    return { status: "degraded", code: resp.status };
  } catch (err) {
    return { status: "unreachable", error: err.message };
  }
}
