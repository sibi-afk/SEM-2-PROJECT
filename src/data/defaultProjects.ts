import { Sem2Project } from "../types";

export const DEFAULT_SEM2_PROJECTS: Sem2Project[] = [
  {
    id: "stochastic-pathfinding",
    name: "Stochastic Pathfinding Visualizer",
    shortCode: "SEM2-STOCH-PATH",
    domain: "Reinforcement Learning & Probabilistic Planning",
    semester: "Semester 2 Capstone",
    problemStatement:
      "Autonomous search-and-rescue pathfinding to locate and extract a missing person or distress beacon across uncertain Markov Decision Process (MDP) terrain maps with transition slip friction (wind gusts, ice, mud), dynamic hazard zones, and structural barriers using Bellman Value Iteration and Deep Q-Learning.",
    algorithm: "Stochastic Value Iteration & Deep Q-Network (DQN)",
    framework: "pytorch",
    metrics: {
      accuracy: "96.8% Success Rate",
      precision: "97.4% Collision-Free",
      recall: "96.2% Goal Reach",
      f1Score: "96.8% Path Optimality",
      aucRoc: "0.985 Bellman Convergence",
    },
    architectureSummary:
      "Grid State Tensor [4xHxW] -> Spatial Conv2D Receptive Fields -> Residual Bottleneck -> Dueling Value V(s) & Advantage A(s,a) Streams -> Stochastic Directional Q-Action Probabilities",
    features: [
      {
        name: "grid_dimension",
        label: "Grid Matrix Dimension (NxN)",
        type: "numerical",
        min: 8,
        max: 20,
        step: 1,
        unit: "tiles",
        defaultVal: 12,
        description: "Width and height of the stochastic grid world environment",
      },
      {
        name: "obstacle_density",
        label: "Obstacle / Barrier Density (%)",
        type: "numerical",
        min: 5,
        max: 45,
        step: 1,
        unit: "%",
        defaultVal: 22,
        description: "Percentage of grid terrain blocked by non-traversable barriers",
      },
      {
        name: "stochastic_slip_prob",
        label: "Transition Slip Probability (ε)",
        type: "numerical",
        min: 0,
        max: 0.45,
        step: 0.05,
        defaultVal: 0.15,
        description: "Probability that agent drifts unintentionally to an adjacent orthogonal tile due to environment noise",
      },
      {
        name: "discount_factor_gamma",
        label: "Bellman Discount Factor (γ)",
        type: "numerical",
        min: 0.7,
        max: 0.99,
        step: 0.01,
        defaultVal: 0.95,
        description: "Temporal discount weighting for future rewards versus immediate path step costs",
      },
      {
        name: "step_energy_budget",
        label: "Battery / Step Energy Budget",
        type: "numerical",
        min: 20,
        max: 120,
        step: 5,
        unit: "steps",
        defaultVal: 60,
        description: "Maximum allowable step energy before battery depletion failure",
      },
      {
        name: "dynamic_hazard_intensity",
        label: "Dynamic Hazard Threat Level",
        type: "categorical",
        options: ["Low (Safe Corridors)", "Moderate (Stochastic Swarms)", "Severe (Volatile Hazard Front)"],
        defaultVal: "Moderate (Stochastic Swarms)",
        description: "Severity of stochastic penalty hazards distributed along shortest corridors",
      },
    ],
    presetTestCases: [
      {
        label: "Nominal Rescue (ε=0.15)",
        description: "Standard 12x12 terrain with moderate rubble barriers and 15% orthogonal wind/terrain slip probability to locate survivor.",
        values: {
          grid_dimension: 12,
          obstacle_density: 22,
          stochastic_slip_prob: 0.15,
          discount_factor_gamma: 0.95,
          step_energy_budget: 60,
          dynamic_hazard_intensity: "Moderate (Stochastic Swarms)",
        },
      },
      {
        label: "Blizzard Mountain (ε=0.35)",
        description: "Severe mountain wind turbulence and icy friction causing 35% lateral slip deviation while tracking stranded mountaineer beacon.",
        values: {
          grid_dimension: 12,
          obstacle_density: 18,
          stochastic_slip_prob: 0.35,
          discount_factor_gamma: 0.92,
          step_energy_budget: 80,
          dynamic_hazard_intensity: "Moderate (Stochastic Swarms)",
        },
      },
      {
        label: "Earthquake Rubble (35% Walls)",
        description: "Dense 14x14 collapsed building debris labyrinth requiring Bellman clearance value optimization to reach trapped person.",
        values: {
          grid_dimension: 14,
          obstacle_density: 35,
          stochastic_slip_prob: 0.1,
          discount_factor_gamma: 0.98,
          step_energy_budget: 90,
          dynamic_hazard_intensity: "Low (Safe Corridors)",
        },
      },
      {
        label: "Wildfire Hazard Front",
        description: "Aggressive thermal smoke and fire hazard penalties testing risk-averse detour policy vs drone battery budget.",
        values: {
          grid_dimension: 10,
          obstacle_density: 20,
          stochastic_slip_prob: 0.25,
          discount_factor_gamma: 0.9,
          step_energy_budget: 50,
          dynamic_hazard_intensity: "Severe (Volatile Hazard Front)",
        },
      },
    ],
    vivaQuestions: [
      {
        question: "Why does standard deterministic A* or Dijkstra fail in stochastic pathfinding environments?",
        answer:
          "Deterministic A* assumes transition certainty P(s'|s,a) = 1.0. In stochastic environments, actions have non-zero slip probabilities ε; a path along a narrow ledge with 0.15 slip probability can easily cause fatal collisions. Stochastic Value Iteration models expected utility over transition distributions, preferring safer, high-confidence corridors.",
      },
      {
        question: "How does the Bellman Optimality Equation compute the state value V*(s) under stochastic transitions?",
        answer:
          "V*(s) = max_a [ R(s,a) + γ ∑_{s'} P(s'|s,a) V*(s') ]. In our visualizer, P(s'|s,a) allocates (1 - 2ε) probability to intended direction and ε to each perpendicular slip direction, weighting future rewards by empirical transition likelihood.",
      },
      {
        question: "What is the difference between Policy Iteration and Value Iteration in Markov Decision Processes?",
        answer:
          "Value Iteration updates state values directly using the Bellman backup operator until max |V_{k+1}(s) - V_k(s)| < δ. Policy Iteration alternates between exact Policy Evaluation (solving linear equations) and Policy Improvement until the policy stabilizes. Value Iteration converges faster per iteration for dynamic path grids.",
      },
      {
        question: "How does Deep Q-Learning (DQN) scale stochastic pathfinding to high-dimensional state spaces?",
        answer:
          "Instead of storing a tabular Q-table of size |S| x |A|, DQN parameterizes Q(s,a; θ) with deep convolutional neural networks. We employ Experience Replay to break temporal correlation and a Target Network Q(s',a'; θ^-) to prevent policy oscillation during gradient descent.",
      },
    ],
  },
];
