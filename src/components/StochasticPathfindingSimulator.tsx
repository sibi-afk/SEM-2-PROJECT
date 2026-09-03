import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Play,
  Pause,
  RotateCcw,
  Shuffle,
  Compass,
  Zap,
  ShieldAlert,
  Flame,
  CheckCircle2,
  AlertTriangle,
  Layers,
  ArrowRight,
} from "lucide-react";
import { CanvasPathHeatmapOverlay } from "./CanvasPathHeatmapOverlay";

interface SimulatorProps {
  gridDimension?: number;
  obstacleDensity?: number;
  slipProb?: number;
  gamma?: number;
  energyBudget?: number;
  hazardLevel?: string;
  onRunTelemetry?: (stats: {
    steps: number;
    slips: number;
    reward: number;
    reachedGoal: boolean;
    pathLength: number;
  }) => void;
}

type Direction = "UP" | "DOWN" | "LEFT" | "RIGHT";

const ACTIONS: Direction[] = ["UP", "DOWN", "LEFT", "RIGHT"];

const DIR_DELTAS: Record<Direction, [number, number]> = {
  UP: [-1, 0],
  DOWN: [1, 0],
  LEFT: [0, -1],
  RIGHT: [0, 1],
};

const PERPENDICULAR: Record<Direction, [Direction, Direction]> = {
  UP: ["LEFT", "RIGHT"],
  DOWN: ["RIGHT", "LEFT"],
  LEFT: ["DOWN", "UP"],
  RIGHT: ["UP", "DOWN"],
};

const DIR_ARROWS: Record<Direction, string> = {
  UP: "↑",
  DOWN: "↓",
  LEFT: "←",
  RIGHT: "→",
};

export function StochasticPathfindingSimulator({
  gridDimension = 12,
  obstacleDensity = 22,
  slipProb = 0.15,
  gamma = 0.95,
  energyBudget = 60,
  hazardLevel = "Moderate (Stochastic Swarms)",
  onRunTelemetry,
}: SimulatorProps) {
  const N = Math.min(16, Math.max(8, Math.round(gridDimension)));
  const [grid, setGrid] = useState<number[][]>([]); // 0: empty, 1: obstacle, 2: hazard, 3: start, 4: goal
  const [values, setValues] = useState<number[][]>([]);
  const [policy, setPolicy] = useState<(Direction | null)[][]>([]);
  const [showHeatmap, setShowHeatmap] = useState(true);
  const [showPolicyArrows, setShowPolicyArrows] = useState(true);
  const gridContainerRef = useRef<HTMLDivElement | null>(null);
  const [hoveredCell, setHoveredCell] = useState<[number, number] | null>(null);

  // Agent execution state
  const [agentPos, setAgentPos] = useState<[number, number]>([1, 1]);
  const [pathHistory, setPathHistory] = useState<[number, number][]>([[1, 1]]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [simStatus, setSimStatus] = useState<
    "idle" | "running" | "goal_reached" | "energy_depleted" | "hazard_damage"
  >("idle");
  const [stepsTaken, setStepsTaken] = useState(0);
  const [slipsCount, setSlipsCount] = useState(0);
  const [accumulatedReward, setAccumulatedReward] = useState(0);
  const [lastEvent, setLastEvent] = useState<string>("Ready to initialize MDP Value Iteration");

  const timerRef = useRef<any>(null);

  // Initialize and solve grid
  const initializeGrid = useCallback(() => {
    const newGrid: number[][] = Array.from({ length: N }, () => Array(N).fill(0));
    const startR = 1;
    const startC = 1;
    const goalR = N - 2;
    const goalC = N - 2;

    // Obstacles
    const barrierProb = obstacleDensity / 100;
    const hazardProb =
      hazardLevel.includes("Severe") ? 0.12 : hazardLevel.includes("Moderate") ? 0.07 : 0.03;

    for (let r = 0; r < N; r++) {
      for (let c = 0; c < N; c++) {
        // Perimeter walls
        if (r === 0 || r === N - 1 || c === 0 || c === N - 1) {
          newGrid[r][c] = 1; // wall
          continue;
        }
        // Protect start & goal neighborhoods
        if (
          (Math.abs(r - startR) <= 1 && Math.abs(c - startC) <= 1) ||
          (Math.abs(r - goalR) <= 1 && Math.abs(c - goalC) <= 1)
        ) {
          continue;
        }

        const rand = Math.random();
        if (rand < barrierProb) {
          newGrid[r][c] = 1; // Obstacle
        } else if (rand < barrierProb + hazardProb) {
          newGrid[r][c] = 2; // Hazard
        }
      }
    }

    newGrid[startR][startC] = 3; // Start
    newGrid[goalR][goalC] = 4; // Goal

    setGrid(newGrid);
    setAgentPos([startR, startC]);
    setPathHistory([[startR, startC]]);
    setStepsTaken(0);
    setSlipsCount(0);
    setAccumulatedReward(0);
    setSimStatus("idle");
    setLastEvent(`Grid generated (${N}x${N}, ${obstacleDensity}% obstacles). Computing MDP Value Iteration...`);

    // Solve via Bellman Value Iteration
    solveValueIteration(newGrid, startR, startC, goalR, goalC);
  }, [N, obstacleDensity, hazardLevel, slipProb, gamma]);

  // Solve Bellman Value Iteration under transition slip probability
  const solveValueIteration = (
    currentGrid: number[][],
    startR: number,
    startC: number,
    goalR: number,
    goalC: number
  ) => {
    const size = currentGrid.length;
    let V: number[][] = Array.from({ length: size }, () => Array(size).fill(0));
    let P: (Direction | null)[][] = Array.from({ length: size }, () => Array(size).fill(null));

    // Goal terminal state value
    V[goalR][goalC] = 100;

    const eps = slipProb;
    const probIntended = 1 - 2 * eps;
    const probSlip = eps;

    // Value iteration loop
    const maxIterations = 80;
    const deltaThreshold = 0.001;

    for (let it = 0; it < maxIterations; it++) {
      let maxDelta = 0;
      const nextV = V.map((row) => [...row]);

      for (let r = 0; r < size; r++) {
        for (let c = 0; c < size; c++) {
          if (currentGrid[r][c] === 1) continue; // Barrier has 0 value
          if (r === goalR && c === goalC) continue; // Terminal goal

          let maxQ = -Infinity;
          let bestAction: Direction = "RIGHT";

          for (const action of ACTIONS) {
            let expectedVal = 0;

            // Transition distribution:
            // 1. Intended direction
            // 2. Slip perpendicular 1
            // 3. Slip perpendicular 2
            const outcomes: { dir: Direction; prob: number }[] = [
              { dir: action, prob: probIntended },
              { dir: PERPENDICULAR[action][0], prob: probSlip },
              { dir: PERPENDICULAR[action][1], prob: probSlip },
            ];

            for (const outcome of outcomes) {
              const [dr, dc] = DIR_DELTAS[outcome.dir];
              let nr = r + dr;
              let nc = c + dc;

              // Check boundary or obstacle collision
              if (nr < 0 || nr >= size || nc < 0 || nc >= size || currentGrid[nr][nc] === 1) {
                // Bounce back into current cell
                nr = r;
                nc = c;
              }

              let reward = -1; // Base step cost
              if (nr === goalR && nc === goalC) {
                reward = 100;
              } else if (currentGrid[nr][nc] === 2) {
                reward = -15; // Hazard penalty
              }

              expectedVal += outcome.prob * (reward + gamma * V[nr][nc]);
            }

            if (expectedVal > maxQ) {
              maxQ = expectedVal;
              bestAction = action;
            }
          }

          nextV[r][c] = maxQ;
          P[r][c] = bestAction;
          maxDelta = Math.max(maxDelta, Math.abs(nextV[r][c] - V[r][c]));
        }
      }

      V = nextV;
      if (maxDelta < deltaThreshold) break;
    }

    setValues(V);
    setPolicy(P);
  };

  // Re-initialize when dimensions or core params change
  useEffect(() => {
    initializeGrid();
  }, [initializeGrid]);

  // Execute single stochastic step
  const executeStep = useCallback(() => {
    if (simStatus === "goal_reached" || simStatus === "energy_depleted") {
      setIsPlaying(false);
      return;
    }

    setAgentPos(([currR, currC]) => {
      const goalR = N - 2;
      const goalC = N - 2;

      if (currR === goalR && currC === goalC) {
        setSimStatus("goal_reached");
        setIsPlaying(false);
        setLastEvent(`[GOAL REACHED] Stochastic destination reached! Terminal Reward +100.`);
        onRunTelemetry?.({
          steps: stepsTaken,
          slips: slipsCount,
          reward: accumulatedReward + 100,
          reachedGoal: true,
          pathLength: pathHistory.length,
        });
        return [currR, currC];
      }

      if (stepsTaken >= energyBudget) {
        setSimStatus("energy_depleted");
        setIsPlaying(false);
        setLastEvent(`[OUT OF ENERGY] Battery budget depleted (${energyBudget} steps limit).`);
        onRunTelemetry?.({
          steps: stepsTaken,
          slips: slipsCount,
          reward: accumulatedReward,
          reachedGoal: false,
          pathLength: pathHistory.length,
        });
        return [currR, currC];
      }

      const optimalDir = policy[currR]?.[currC] || "RIGHT";
      const roll = Math.random();
      let actualDir = optimalDir;
      let slipped = false;

      // Check for stochastic slip
      if (roll < slipProb) {
        actualDir = PERPENDICULAR[optimalDir][0];
        slipped = true;
      } else if (roll < 2 * slipProb) {
        actualDir = PERPENDICULAR[optimalDir][1];
        slipped = true;
      }

      const [dr, dc] = DIR_DELTAS[actualDir];
      let nextR = currR + dr;
      let nextC = currC + dc;

      // Obstacle bounce
      let bounced = false;
      if (
        nextR < 0 ||
        nextR >= N ||
        nextC < 0 ||
        nextC >= N ||
        grid[nextR]?.[nextC] === 1
      ) {
        nextR = currR;
        nextC = currC;
        bounced = true;
      }

      const isHazard = grid[nextR]?.[nextC] === 2;
      const isGoal = nextR === goalR && nextC === goalC;

      let stepReward = -1;
      if (isGoal) stepReward = 100;
      else if (isHazard) stepReward = -15;
      else if (bounced) stepReward = -5;

      setStepsTaken((s) => s + 1);
      setAccumulatedReward((r) => r + stepReward);
      if (slipped) setSlipsCount((s) => s + 1);

      setPathHistory((hist) => [...hist, [nextR, nextC]]);

      if (isGoal) {
        setSimStatus("goal_reached");
        setIsPlaying(false);
        setLastEvent(`[GOAL REACHED] Target acquired in ${stepsTaken + 1} steps!`);
      } else if (isHazard) {
        setLastEvent(
          `[HAZARD COLLISION] Step ${stepsTaken + 1}: Agent walked into high-threat hazard at (${nextR}, ${nextC})!`
        );
      } else if (slipped) {
        setLastEvent(
          `[STOCHASTIC SLIP] Step ${stepsTaken + 1}: Policy called ${optimalDir} -> Slipped orthogonally to ${actualDir} (ε=${slipProb})`
        );
      } else if (bounced) {
        setLastEvent(
          `[WALL BOUNCE] Step ${stepsTaken + 1}: Barrier collision! Rebounded back to (${nextR}, ${nextC}).`
        );
      } else {
        setLastEvent(
          `Step ${stepsTaken + 1}: Action ${optimalDir} executed smoothly -> Position (${nextR}, ${nextC}).`
        );
      }

      return [nextR, nextC];
    });
  }, [
    simStatus,
    N,
    policy,
    grid,
    stepsTaken,
    slipsCount,
    accumulatedReward,
    energyBudget,
    slipProb,
    pathHistory.length,
    onRunTelemetry,
  ]);

  // Simulation timer loop
  useEffect(() => {
    if (isPlaying) {
      timerRef.current = setInterval(() => {
        executeStep();
      }, 260);
    } else if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isPlaying, executeStep]);

  // Reset simulation without changing maze
  const handleResetRun = () => {
    setIsPlaying(false);
    setAgentPos([1, 1]);
    setPathHistory([[1, 1]]);
    setStepsTaken(0);
    setSlipsCount(0);
    setAccumulatedReward(0);
    setSimStatus("idle");
    setLastEvent("Agent reset to start coordinate (1, 1). Ready to run.");
  };

  // Min/Max Value for normalization
  const flatVals = values.flat().filter((v) => v !== 0 && v !== 100);
  const minVal = flatVals.length ? Math.min(...flatVals) : -50;
  const maxVal = flatVals.length ? Math.max(...flatVals) : 80;

  return (
    <div className="space-y-4 font-mono">
      {/* Simulation Header & Status Bar */}
      <div className="bg-[#0a0a0a] border border-[#ffffff15] rounded-xl p-4 shadow-[0_0_20px_rgba(0,0,0,0.8)]">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[#00D1FF15] border border-[#00D1FF40] flex items-center justify-center text-[#00D1FF]">
              <Compass className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-white uppercase tracking-wider">
                  Live MDP Stochastic Grid World
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded bg-[#00D1FF20] text-[#00D1FF] border border-[#00D1FF40]">
                  {N}x{N} MATRIX
                </span>
              </div>
              <p className="text-[11px] text-white/50">
                Stochastic Transition Slip: ε = {(slipProb * 100).toFixed(0)}% | Bellman Discount: γ = {gamma}
              </p>
            </div>
          </div>

          {/* Interactive Play Controls */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsPlaying((p) => !p)}
              disabled={simStatus === "goal_reached" || simStatus === "energy_depleted"}
              className={`px-3.5 py-1.5 rounded text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-all border ${
                isPlaying
                  ? "bg-amber-500/20 text-amber-300 border-amber-500/50 hover:bg-amber-500/30"
                  : "bg-[#00D1FF20] text-[#00D1FF] border-[#00D1FF] hover:bg-[#00D1FF30] shadow-[0_0_10px_rgba(0,209,255,0.2)]"
              } disabled:opacity-40 disabled:cursor-not-allowed`}
            >
              {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 fill-current" />}
              {isPlaying ? "PAUSE" : "EXECUTE PATH"}
            </button>

            <button
              onClick={executeStep}
              disabled={isPlaying || simStatus === "goal_reached" || simStatus === "energy_depleted"}
              className="px-3 py-1.5 rounded text-xs bg-black/60 hover:bg-white/10 text-white/80 border border-[#ffffff15] flex items-center gap-1 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              title="Step forward by 1 tick"
            >
              <ArrowRight className="w-3.5 h-3.5" />
              STEP
            </button>

            <button
              onClick={handleResetRun}
              className="px-3 py-1.5 rounded text-xs bg-black/60 hover:bg-white/10 text-white/70 hover:text-white border border-[#ffffff15] flex items-center gap-1 cursor-pointer"
              title="Reset Agent position to Start"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              RESET
            </button>

            <button
              onClick={initializeGrid}
              className="px-3 py-1.5 rounded text-xs bg-black/60 hover:bg-white/10 text-[#00D1FF] border border-[#00D1FF30] flex items-center gap-1 cursor-pointer"
              title="Regenerate random grid obstacles"
            >
              <Shuffle className="w-3.5 h-3.5" />
              RANDOMIZE
            </button>
          </div>
        </div>

        {/* Live Metrics Row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 pt-3 border-t border-[#ffffff10]">
          <div className="p-2.5 rounded bg-black/50 border border-[#ffffff08]">
            <span className="block text-[10px] text-white/40 uppercase">Step Energy</span>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span className="text-base font-bold text-white">{stepsTaken}</span>
              <span className="text-[11px] text-white/40">/ {energyBudget}</span>
            </div>
            <div className="w-full bg-white/10 h-1 rounded mt-1 overflow-hidden">
              <div
                className={`h-full transition-all ${
                  stepsTaken > energyBudget * 0.85 ? "bg-rose-500" : "bg-[#00D1FF]"
                }`}
                style={{ width: `${Math.min(100, (stepsTaken / energyBudget) * 100)}%` }}
              />
            </div>
          </div>

          <div className="p-2.5 rounded bg-black/50 border border-[#ffffff08]">
            <span className="block text-[10px] text-white/40 uppercase">Stochastic Slips</span>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span className="text-base font-bold text-amber-400">{slipsCount}</span>
              <span className="text-[10px] text-white/40">
                ({stepsTaken > 0 ? ((slipsCount / stepsTaken) * 100).toFixed(0) : 0}%)
              </span>
            </div>
            <span className="text-[9px] text-amber-400/70 block mt-1">
              orthogonally deflected by ε
            </span>
          </div>

          <div className="p-2.5 rounded bg-black/50 border border-[#ffffff08]">
            <span className="block text-[10px] text-white/40 uppercase">Bellman Reward</span>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span
                className={`text-base font-bold ${
                  accumulatedReward >= 0 ? "text-emerald-400" : "text-rose-400"
                }`}
              >
                {accumulatedReward >= 0 ? `+${accumulatedReward}` : accumulatedReward}
              </span>
            </div>
            <span className="text-[9px] text-white/40 block mt-1">
              goal: +100 | step: -1 | hazard: -15
            </span>
          </div>

          <div className="p-2.5 rounded bg-black/50 border border-[#ffffff08]">
            <span className="block text-[10px] text-white/40 uppercase">Status</span>
            <div className="flex items-center gap-1.5 mt-1">
              {simStatus === "goal_reached" && (
                <span className="text-xs font-bold text-emerald-400 flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  GOAL REACHED
                </span>
              )}
              {simStatus === "energy_depleted" && (
                <span className="text-xs font-bold text-rose-400 flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  ENERGY DEPLETED
                </span>
              )}
              {simStatus === "running" || (isPlaying && (
                <span className="text-xs font-bold text-[#00D1FF] flex items-center gap-1 animate-pulse">
                  <Zap className="w-3.5 h-3.5" />
                  NAVIGATING...
                </span>
              ))}
              {!isPlaying && simStatus === "idle" && (
                <span className="text-xs text-white/60">CONVERGED (READY)</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Grid Canvas + Legend */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* The Matrix Canvas */}
        <div className="lg:col-span-8 bg-[#0a0a0a] border border-[#ffffff15] rounded-xl p-4 flex flex-col items-center justify-center">
          <div
            ref={gridContainerRef}
            className="relative inline-block max-w-full rounded-lg"
            onMouseLeave={() => setHoveredCell(null)}
          >
            <div
              className="grid gap-1 bg-black/90 p-2 rounded-lg border border-[#ffffff15] shadow-inner max-w-full overflow-auto relative"
              style={{
                gridTemplateColumns: `repeat(${N}, minmax(0, 1fr))`,
              }}
            >
              {grid.map((row, r) =>
                row.map((cellType, c) => {
                  const isAgent = agentPos[0] === r && agentPos[1] === c;
                  const isStart = cellType === 3;
                  const isGoal = cellType === 4;
                  const isObstacle = cellType === 1;
                  const isHazard = cellType === 2;

                  // Path trace
                  const isVisited = pathHistory.some(([pr, pc]) => pr === r && pc === c);
                  const val = values[r]?.[c] ?? 0;
                  const optimalDir = policy[r]?.[c];

                  // Value heatmap color
                  let cellBg = "bg-[#ffffff04]";
                  if (isObstacle) {
                    cellBg = "bg-[#18181b] border-[#ffffff15]";
                  } else if (isHazard) {
                    cellBg = "bg-rose-950/60 border-rose-800/80 text-rose-300";
                  } else if (isGoal) {
                    cellBg = "bg-emerald-950/70 border-emerald-500/80 text-emerald-300";
                  } else if (isStart) {
                    cellBg = "bg-sky-950/70 border-sky-500/80 text-sky-300";
                  } else if (showHeatmap && !isObstacle && val !== 0) {
                    // Normalize 0 to 1
                    const norm = Math.max(0, Math.min(1, (val - minVal) / (maxVal - minVal || 1)));
                    if (norm > 0.65) cellBg = "bg-cyan-950/40 border-cyan-800/40";
                    else if (norm > 0.4) cellBg = "bg-blue-950/30 border-blue-900/30";
                    else cellBg = "bg-[#ffffff04] border-[#ffffff08]";
                  }

                  return (
                    <div
                      key={`${r}-${c}`}
                      data-cell={`${r}-${c}`}
                      onMouseEnter={() => setHoveredCell([r, c])}
                      className={`relative w-8 h-8 sm:w-10 sm:h-10 rounded flex flex-col items-center justify-center text-[10px] font-bold border transition-all duration-150 select-none ${cellBg} ${
                        isVisited && !isObstacle && !isAgent
                          ? "shadow-[inset_0_0_6px_rgba(0,209,255,0.25)] border-[#00D1FF40]"
                          : ""
                      }`}
                      title={`Tile (${r}, ${c}) | V*(s)=${val.toFixed(1)} | Policy: ${optimalDir || "None"}`}
                    >
                      {/* Obstacle Icon */}
                      {isObstacle && <span className="text-white/20 text-xs font-mono">■</span>}

                      {/* Hazard Icon */}
                      {isHazard && !isAgent && (
                        <Flame className="w-4 h-4 text-rose-400 animate-pulse" />
                      )}

                      {/* Start Badge */}
                      {isStart && !isAgent && (
                        <span className="text-[10px] font-bold text-sky-400">S</span>
                      )}

                      {/* Goal Badge */}
                      {isGoal && !isAgent && (
                        <span className="text-[11px] font-bold text-emerald-400 animate-bounce">
                          G
                        </span>
                      )}

                      {/* Optimal Policy Arrow (if policy shown and not obstacle/goal) */}
                      {showPolicyArrows &&
                        optimalDir &&
                        !isObstacle &&
                        !isGoal &&
                        !isAgent && (
                          <span className="text-white/30 text-xs leading-none">
                            {DIR_ARROWS[optimalDir]}
                          </span>
                        )}

                      {/* Agent Marker */}
                      {isAgent && (
                        <div className="w-6 h-6 rounded-full bg-[#00D1FF] text-black font-extrabold flex items-center justify-center text-xs shadow-[0_0_12px_#00D1FF] z-20 animate-pulse">
                          A
                        </div>
                      )}

                      {/* Visited breadcrumb dot */}
                      {isVisited && !isAgent && !isGoal && !isStart && (
                        <span className="absolute bottom-0.5 right-0.5 w-1.5 h-1.5 rounded-full bg-[#00D1FF]/60" />
                      )}
                    </div>
                  );
                })
              )}
            </div>

            {/* Dynamic Canvas-Based Path Heatmap Overlay */}
            <CanvasPathHeatmapOverlay
              grid={grid}
              N={N}
              agentPos={agentPos}
              goalPos={[N - 2, N - 2]}
              values={values}
              policy={policy}
              slipProb={slipProb}
              gamma={gamma}
              containerRef={gridContainerRef}
              hoveredCell={hoveredCell}
            />
          </div>

          {/* Canvas display toggles */}
          <div className="flex items-center gap-4 mt-3 text-xs text-white/60">
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={showPolicyArrows}
                onChange={(e) => setShowPolicyArrows(e.target.checked)}
                className="rounded accent-[#00D1FF]"
              />
              Show Directional Policy π*(s)
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={showHeatmap}
                onChange={(e) => setShowHeatmap(e.target.checked)}
                className="rounded accent-[#00D1FF]"
              />
              Show State Values V*(s)
            </label>
          </div>
        </div>

        {/* Legend, Mathematical Formulation, & Real-time Event Log */}
        <div className="lg:col-span-4 space-y-4">
          {/* Legend Card */}
          <div className="bg-[#0a0a0a] border border-[#ffffff15] rounded-xl p-4 space-y-3">
            <h4 className="text-[11px] font-bold uppercase text-white/50 tracking-wider flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-[#00D1FF]" />
              Grid Topology Legend
            </h4>
            <div className="grid grid-cols-2 gap-2 text-[11px]">
              <div className="flex items-center gap-2 p-1.5 rounded bg-black/40 border border-[#ffffff08]">
                <div className="w-3.5 h-3.5 rounded bg-sky-950 border border-sky-400 flex items-center justify-center text-[9px] text-sky-400">
                  S
                </div>
                <span className="text-white/80">Start (1, 1)</span>
              </div>
              <div className="flex items-center gap-2 p-1.5 rounded bg-black/40 border border-[#ffffff08]">
                <div className="w-3.5 h-3.5 rounded bg-emerald-950 border border-emerald-400 flex items-center justify-center text-[9px] text-emerald-400">
                  G
                </div>
                <span className="text-white/80">Goal (+100)</span>
              </div>
              <div className="flex items-center gap-2 p-1.5 rounded bg-black/40 border border-[#ffffff08]">
                <div className="w-3.5 h-3.5 rounded bg-zinc-800 border border-zinc-600" />
                <span className="text-white/80">Barrier Wall</span>
              </div>
              <div className="flex items-center gap-2 p-1.5 rounded bg-black/40 border border-[#ffffff08]">
                <div className="w-3.5 h-3.5 rounded bg-rose-950 border border-rose-600 flex items-center justify-center text-[9px] text-rose-400">
                  🔥
                </div>
                <span className="text-white/80">Hazard (-15)</span>
              </div>
            </div>
          </div>

          {/* Mathematical Bellman Formulation */}
          <div className="bg-[#0a0a0a] border border-[#ffffff15] rounded-xl p-4 space-y-2">
            <h4 className="text-[11px] font-bold uppercase text-[#00D1FF] tracking-wider">
              Stochastic Bellman Equation
            </h4>
            <div className="p-2.5 rounded bg-black/60 border border-[#ffffff08] text-[11px] text-white/70 space-y-1 font-mono">
              <div className="text-[#00D1FF] font-semibold">
                V*(s) = max_a [ R(s,a) + γ ∑ P(s'|s,a) V*(s') ]
              </div>
              <div className="text-white/50 text-[10px] mt-1 leading-relaxed">
                P(intended) = 1 - 2ε = {(1 - 2 * slipProb).toFixed(2)}
                <br />
                P(left_slip) = ε = {slipProb.toFixed(2)}
                <br />
                P(right_slip) = ε = {slipProb.toFixed(2)}
              </div>
            </div>
          </div>

          {/* Real-time Telemetry Event Log */}
          <div className="bg-[#0a0a0a] border border-[#ffffff15] rounded-xl p-4 space-y-2">
            <span className="text-[10px] font-bold uppercase text-white/40 tracking-wider block">
              Execution Telemetry Log
            </span>
            <div className="p-3 rounded bg-black/80 border border-[#ffffff10] text-[11px] text-white/80 leading-relaxed min-h-[64px] flex items-center">
              <p className="font-mono text-emerald-400/90">{lastEvent}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
