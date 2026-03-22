// ══════════════════════════════════════════════════════════════
// OptimEngine API Documentation — Schema & Examples
// Serves /docs and /docs/:endpoint for agent discovery
// ══════════════════════════════════════════════════════════════

export const DOCS = {
  schedule: {
    endpoint: "/solve/schedule",
    price: "$0.15",
    method: "POST",
    description: "Flexible Job-Shop Scheduling — FJSP with OR-Tools CP-SAT. Precedence constraints, time windows, setup times, machine-specific durations, quality gates, 4 objectives.",
    objectives: ["minimize_makespan", "minimize_total_tardiness", "minimize_max_tardiness", "balance_load"],
    input_schema: {
      jobs: { type: "array", required: true, description: "Jobs to schedule. Each job has ordered tasks executed sequentially.",
        items: { job_id: "string (required)", tasks: "array of {task_id, duration, eligible_machines, duration_per_machine?, setup_time?}", due_date: "integer (optional)", priority: "1-10 (default 1)", quality_min: "0.0-1.0 (optional)", time_window: "{earliest_start, latest_end} (optional)" }},
      machines: { type: "array", required: true, description: "Available machines.",
        items: { machine_id: "string (required)", yield_rate: "0.0-1.0 (default 1.0)", availability_windows: "[{start, end}] (optional)" }},
      objective: { type: "string", default: "minimize_makespan" },
      setup_times: { type: "array", optional: true, description: "Sequence-dependent setup times: [{machine_id, from_job_id, to_job_id, setup_time}]" },
      max_solve_time_seconds: { type: "integer", default: 30, max: 300 },
    },
    output_schema: {
      status: "optimal | feasible | infeasible | timeout | error",
      message: "Human-readable status",
      schedule: "[{job_id, task_id, machine_id, start, end, duration}]",
      job_summaries: "[{job_id, start, end, makespan, tardiness, on_time}]",
      machine_utilization: "[{machine_id, busy_time, idle_time, utilization_pct, num_tasks}]",
      gantt: "[{job_id, task_id, machine_id, start, end, label}]",
      metrics: "Aggregate metrics object",
    },
    example_input: {
      jobs: [
        { job_id: "J1", due_date: 10, tasks: [{ task_id: "T1", duration: 3, eligible_machines: ["M1", "M2"] }, { task_id: "T2", duration: 2, eligible_machines: ["M2", "M3"] }] },
        { job_id: "J2", due_date: 8, tasks: [{ task_id: "T3", duration: 4, eligible_machines: ["M1", "M3"] }, { task_id: "T4", duration: 1, eligible_machines: ["M2"] }] },
      ],
      machines: [{ machine_id: "M1" }, { machine_id: "M2" }, { machine_id: "M3" }],
      objective: "minimize_makespan",
    },
  },

  routing: {
    endpoint: "/solve/routing",
    price: "$0.20",
    method: "POST",
    description: "Capacitated Vehicle Routing with Time Windows (CVRPTW). OR-Tools Routing solver. Distance matrix required (not GPS).",
    objectives: ["minimize_total_distance", "minimize_total_time", "minimize_vehicles", "balance_routes"],
    input_schema: {
      depot_id: { type: "string", required: true, description: "Location ID of the depot (start/end point)" },
      locations: { type: "array", required: true,
        items: { location_id: "string (required)", demand: "integer (default 0)", time_window_start: "integer (optional)", time_window_end: "integer (optional)", service_time: "integer (default 0)" }},
      vehicles: { type: "array", required: true,
        items: { vehicle_id: "string (required)", capacity: "integer (required)", max_travel_time: "integer (optional)", max_travel_distance: "integer (optional)" }},
      distance_matrix: { type: "array", required: true, description: "REQUIRED. Array of {from_id, to_id, distance}. Must cover all location pairs including depot." },
      allow_drop_visits: { type: "boolean", default: false },
      objective: { type: "string", default: "minimize_total_distance" },
    },
    output_schema: {
      status: "optimal | feasible | no_solution | timeout | error",
      routes: "[{vehicle_id, stops: [{location_id, arrival_time, departure_time, load_after, demand_served}], total_distance, total_time, total_load}]",
      metrics: "{total_distance, vehicles_used, locations_served, locations_dropped, avg_route_load_pct}",
      dropped_locations: "[location_ids]",
    },
    example_input: {
      depot_id: "depot",
      locations: [
        { location_id: "depot", demand: 0 },
        { location_id: "A", demand: 3, time_window_start: 0, time_window_end: 50 },
        { location_id: "B", demand: 5, time_window_start: 0, time_window_end: 50 },
      ],
      vehicles: [{ vehicle_id: "V1", capacity: 10 }],
      distance_matrix: [
        { from_id: "depot", to_id: "A", distance: 10 }, { from_id: "depot", to_id: "B", distance: 15 },
        { from_id: "A", to_id: "depot", distance: 10 }, { from_id: "A", to_id: "B", distance: 12 },
        { from_id: "B", to_id: "depot", distance: 15 }, { from_id: "B", to_id: "A", distance: 12 },
      ],
    },
  },

  packing: {
    endpoint: "/solve/packing",
    price: "$0.10",
    method: "POST",
    description: "Bin Packing with weight/volume constraints, item groups, partial packing. OR-Tools CP-SAT.",
    objectives: ["minimize_bins", "maximize_value", "maximize_items", "balance_load"],
    input_schema: {
      bins: { type: "array", required: true,
        items: { bin_id: "string (required)", weight_capacity: "integer (required)", volume_capacity: "integer (default 0)", max_items: "integer (optional)", quantity: "integer (default 1)" }},
      items: { type: "array", required: true,
        items: { item_id: "string (required)", weight: "integer (required)", volume: "integer (default 0)", value: "integer (default 1)", group: "string (optional)", fragile: "boolean (default false)" }},
      objective: { type: "string", default: "minimize_bins" },
      allow_partial: { type: "boolean", default: false },
      keep_groups_together: { type: "boolean", default: false },
    },
    output_schema: {
      status: "optimal | feasible | no_solution | timeout | error",
      assignments: "[{item_id, bin_id, weight, volume, value}]",
      bin_summaries: "[{bin_id, is_used, items_packed, weight_used, weight_capacity, weight_utilization_pct, total_value, item_ids}]",
      unpacked_items: "[item_ids]",
    },
    example_input: {
      bins: [{ bin_id: "B1", weight_capacity: 20 }, { bin_id: "B2", weight_capacity: 15 }],
      items: [{ item_id: "I1", weight: 8, value: 10 }, { item_id: "I2", weight: 6, value: 7 }, { item_id: "I3", weight: 5, value: 8 }],
      objective: "minimize_bins",
    },
  },

  pareto: {
    endpoint: "/solve/pareto",
    price: "$0.20",
    method: "POST",
    description: "Multi-Objective Pareto Frontier. Generates 3-50 points trading off 2-4 competing objectives on any L1 solver (scheduling, routing, packing).",
    input_schema: {
      solver_type: { type: "string", required: true, enum: ["scheduling", "routing", "packing"] },
      objectives: { type: "array", required: true, description: "2-4 objectives. Use objective names from the corresponding L1 solver.",
        items: { name: "string (required)", weight: "number (default 1)" }},
      solver_request: { type: "object", required: true, description: "The L1 solver request (same format as /solve/schedule, /solve/routing, or /solve/packing but WITHOUT the 'objective' field)" },
      num_points: { type: "integer", default: 10, min: 3, max: 50 },
    },
    output_schema: {
      status: "completed | partial | error",
      frontier: "[{point_id, objectives: {name: value}, weights_used, feasible, is_extreme, is_balanced}]",
      trade_offs: "[{objective_a, objective_b, correlation, trade_off_ratio, relationship}]",
      recommendation: "Human-readable trade-off recommendation",
    },
    example_input: {
      solver_type: "scheduling",
      objectives: [{ name: "minimize_makespan", weight: 1 }, { name: "minimize_total_tardiness", weight: 1 }],
      solver_request: {
        jobs: [{ job_id: "J1", due_date: 10, tasks: [{ task_id: "T1", duration: 3, eligible_machines: ["M1", "M2"] }] }],
        machines: [{ machine_id: "M1" }, { machine_id: "M2" }],
      },
      num_points: 5,
    },
  },

  stochastic: {
    endpoint: "/solve/stochastic",
    price: "$0.25",
    method: "POST",
    description: "Monte Carlo Stochastic Optimization with CVaR risk metrics. Simulates uncertainty in parameters using normal, uniform, triangular, or log-normal distributions.",
    input_schema: {
      solver_type: { type: "string", required: true, enum: ["scheduling", "routing", "packing"] },
      solver_request: { type: "object", required: true, description: "Base L1 solver request" },
      stochastic_parameters: { type: "array", required: true, description: "Parameters with distributions. Use bracket notation for path: jobs[J1].tasks[T1].duration",
        items: { parameter_path: "string (required) — e.g. jobs[J1].tasks[T1].duration", distribution: "normal | uniform | triangular | log_normal", mean: "number (for normal)", std_dev: "number (for normal)", min_value: "number (for uniform/triangular)", max_value: "number (for uniform/triangular)" }},
      num_scenarios: { type: "integer", default: 50, max: 500 },
      optimize_for: { type: "string", default: "cvar_95", enum: ["expected_value", "cvar_90", "cvar_95", "cvar_99", "worst_case"] },
    },
    output_schema: {
      status: "completed | partial | error",
      recommended_objective: "number — objective value optimized for chosen risk metric",
      distribution: "{mean, median, std_dev, min_value, max_value, percentile_5/10/25/75/90/95/99, skewness, coefficient_of_variation}",
      risk: "{expected_value, var_90/95/99, cvar_90/95/99, worst_case, best_case, probability_of_infeasibility}",
      scenarios: "[{scenario_id, parameter_values, objective_value, feasible, status}]",
      recommendation: "Human-readable risk assessment",
    },
    example_input: {
      solver_type: "scheduling",
      solver_request: {
        jobs: [{ job_id: "J1", tasks: [{ task_id: "T1", duration: 5, eligible_machines: ["M1", "M2"] }] }],
        machines: [{ machine_id: "M1" }, { machine_id: "M2" }],
        objective: "minimize_makespan",
      },
      stochastic_parameters: [
        { parameter_path: "jobs[J1].tasks[T1].duration", distribution: "normal", mean: 5, std_dev: 1.5 },
      ],
      num_scenarios: 50,
      optimize_for: "cvar_95",
    },
  },

  robust: {
    endpoint: "/solve/robust",
    price: "$0.20",
    method: "POST",
    description: "Robust Optimization under uncertainty. Evaluates scenarios across parameter ranges. Modes: worst_case, percentile_90/95, regret_minimization.",
    input_schema: {
      solver_type: { type: "string", required: true, enum: ["scheduling", "routing", "packing"] },
      solver_request: { type: "object", required: true },
      uncertain_parameters: { type: "array", required: true,
        items: { parameter_path: "string — bracket notation: jobs[J1].tasks[T1].duration", min_value: "number (required)", max_value: "number (required)", nominal_value: "number (optional)" }},
      num_scenarios: { type: "integer", default: 20 },
      mode: { type: "string", default: "worst_case", enum: ["worst_case", "percentile_90", "percentile_95", "regret_minimization"] },
    },
    output_schema: {
      status: "completed | partial | error",
      robust_solution: "{objective_value, scenario_used, parameter_values}",
      scenarios: "[{scenario_id, parameter_values, objective_value, feasible, is_worst_case, is_nominal}]",
      metrics: "{nominal_objective, worst_case_objective, best_case_objective, price_of_robustness_pct, feasibility_rate_pct}",
      recommendation: "Human-readable recommendation",
    },
    example_input: {
      solver_type: "scheduling",
      solver_request: {
        jobs: [{ job_id: "J1", tasks: [{ task_id: "T1", duration: 5, eligible_machines: ["M1"] }] }],
        machines: [{ machine_id: "M1" }],
        objective: "minimize_makespan",
      },
      uncertain_parameters: [{ parameter_path: "jobs[J1].tasks[T1].duration", min_value: 3, max_value: 8 }],
      num_scenarios: 20,
      mode: "worst_case",
    },
  },

  sensitivity: {
    endpoint: "/solve/sensitivity",
    price: "$0.15",
    method: "POST",
    description: "Parametric Sensitivity Analysis. Perturbs parameters across any L1 solver. Returns sensitivity scores, elasticity, risk ranking, critical parameter detection.",
    input_schema: {
      solver_type: { type: "string", required: true, enum: ["scheduling", "routing", "packing"] },
      solver_request: { type: "object", required: true },
      parameters: { type: "array", optional: true, description: "If empty, auto-detects all numeric parameters.",
        items: { parameter_path: "string — bracket notation", perturbations: "array of numbers (default [-50,-20,-10,10,20,50])", mode: "percentage | absolute (default percentage)" }},
    },
    output_schema: {
      status: "completed | partial | error",
      baseline_objective: "number",
      parameters: "[{parameter_path, sensitivity_score (0-100), elasticity, critical (boolean), direction, perturbation_results, risk_summary}]",
      risk_ranking: "[parameter_paths sorted by sensitivity]",
    },
    example_input: {
      solver_type: "scheduling",
      solver_request: {
        jobs: [{ job_id: "J1", tasks: [{ task_id: "T1", duration: 5, eligible_machines: ["M1", "M2"] }] }],
        machines: [{ machine_id: "M1" }, { machine_id: "M2" }],
        objective: "minimize_makespan",
      },
    },
  },

  prescriptive: {
    endpoint: "/solve/prescriptive",
    price: "$0.30",
    method: "POST",
    description: "Prescriptive Intelligence — full pipeline: forecast future parameter values from historical data, optimize with forecasted values, assess risk, generate actionable recommendations. 4 forecast methods, 3 risk appetites.",
    forecast_methods: ["moving_average", "exponential_smoothing", "linear_trend", "seasonal_naive"],
    risk_appetites: ["conservative", "moderate", "aggressive"],
    input_schema: {
      solver_type: { type: "string", required: true, enum: ["scheduling", "routing", "packing"] },
      solver_request: { type: "object", required: true },
      forecast_parameters: { type: "array", required: true,
        items: { parameter_path: "string — bracket notation", historical_data: "[{period: int, value: number}] — minimum 3 points", forecast_method: "moving_average | exponential_smoothing | linear_trend | seasonal_naive", forecast_horizon: "1-12 (default 1)" }},
      risk_appetite: { type: "string", default: "moderate", enum: ["conservative", "moderate", "aggressive"] },
    },
    output_schema: {
      status: "completed | error",
      forecasts: "[{parameter_path, method_used, forecast_value, lower_bound, upper_bound, trend, trend_strength}]",
      optimization: "{objective_name, objective_value, status, parameters_used}",
      risk: "{conservative_objective, moderate_objective, aggressive_objective, feasibility_risk}",
      actions: "[{priority, action, reason, impact}]",
      recommendation: "Executive summary recommendation",
    },
    example_input: {
      solver_type: "scheduling",
      solver_request: {
        jobs: [{ job_id: "J1", tasks: [{ task_id: "T1", duration: 5, eligible_machines: ["M1"] }] }],
        machines: [{ machine_id: "M1" }],
        objective: "minimize_makespan",
      },
      forecast_parameters: [{
        parameter_path: "jobs[J1].tasks[T1].duration",
        historical_data: [{ period: 0, value: 4 }, { period: 1, value: 5 }, { period: 2, value: 5 }, { period: 3, value: 6 }, { period: 4, value: 7 }],
        forecast_method: "linear_trend",
      }],
      risk_appetite: "moderate",
    },
  },

  validate: {
    endpoint: "/solve/validate",
    price: "$0.05",
    method: "POST",
    description: "Schedule Validation — checks an existing schedule against constraints. Detects overlaps, precedence violations, machine eligibility errors, time window breaches.",
    input_schema: {
      jobs: { type: "array", required: true, description: "Same format as /solve/schedule" },
      machines: { type: "array", required: true },
      schedule: { type: "array", required: true, description: "The schedule to validate: [{job_id, task_id, machine_id, start, end, duration}]" },
    },
    output_schema: {
      is_valid: "boolean",
      num_violations: "integer",
      violations: "[{violation_type, severity, description, affected_tasks}]",
      improvement_suggestions: "[strings]",
    },
    example_input: {
      jobs: [{ job_id: "J1", tasks: [{ task_id: "T1", duration: 3, eligible_machines: ["M1"] }] }],
      machines: [{ machine_id: "M1" }],
      schedule: [{ job_id: "J1", task_id: "T1", machine_id: "M1", start: 0, end: 3, duration: 3 }],
    },
  },
};

/** Register /docs routes on an Express app */
export function registerDocsRoutes(app) {
  app.get("/docs", (_req, res) => {
    res.json({
      name: "OptimEngine",
      version: "9.0.0",
      agent_id: "ERC-8004 #22518",
      description: "Full-stack optimization solver. 9 paid endpoints via x402. Input/output schemas and examples available at /docs/:endpoint.",
      endpoints: Object.entries(DOCS).map(([key, doc]) => ({
        name: key,
        path: doc.endpoint,
        price: doc.price,
        description: doc.description,
        docs_url: `/docs/${key}`,
      })),
      parameter_path_syntax: "Use bracket notation with IDs: jobs[J1].tasks[T1].duration — NOT dot-notation with indices.",
    });
  });

  app.get("/docs/:endpoint", (req, res) => {
    const doc = DOCS[req.params.endpoint];
    if (!doc) {
      return res.status(404).json({
        error: `Unknown endpoint: ${req.params.endpoint}`,
        available: Object.keys(DOCS),
      });
    }
    res.json(doc);
  });
}
