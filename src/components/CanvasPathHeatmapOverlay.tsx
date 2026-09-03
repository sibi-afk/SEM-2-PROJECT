import React, { useEffect, useRef, useState, useMemo } from "react";
import { Sparkles, Eye, Zap, Sliders, Activity, Info } from "lucide-react";

export type HeatmapMode = "reachability" | "branches" | "entropy";

interface CanvasPathHeatmapOverlayProps {
  grid: number[][]; // 0: empty, 1: obstacle, 2: hazard, 3: start, 4: goal
  N: number;
  agentPos: [number, number];
  goalPos: [number, number];
  values: number[][];
  policy: ("UP" | "DOWN" | "LEFT" | "RIGHT" | null)[][];
  slipProb: number;
  gamma: number;
  containerRef: React.RefObject<HTMLDivElement | null>;
  hoveredCell: [number, number] | null;
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

export function CanvasPathHeatmapOverlay({
  grid,
  N,
  agentPos,
  goalPos,
  values,
  policy,
  slipProb,
  gamma,
  containerRef,
  hoveredCell,
}: CanvasPathHeatmapOverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // User adjustable heatmap overlay parameters
  const [enabled, setEnabled] = useState(true);
  const [mode, setMode] = useState<HeatmapMode>("reachability");
  const [opacity, setOpacity] = useState(0.85);
  const [temperature, setTemperature] = useState(0.35); // Softmax temperature
  const [horizon, setHorizon] = useState(20); // Multi-step forward horizon
  const [showStreamlines, setShowStreamlines] = useState(true);
  const [showParticles, setShowParticles] = useState(true);
  const [showDecisionBadges, setShowDecisionBadges] = useState(true);
  const [showControls, setShowControls] = useState(false);

  // Animated particles state stored in ref for 60fps canvas loop
  const particlesRef = useRef<
    {
      x: number;
      y: number;
      progress: number;
      speed: number;
      pathIndex: number;
      alpha: number;
      size: number;
    }[]
  >([]);

  // 1. Calculate Q-values and Softmax Action Probabilities for all states
  const { qValues, actionProbabilities } = useMemo(() => {
    const Q: Record<string, Record<Direction, number>> = {};
    const Pi: Record<string, Record<Direction, number>> = {};
    const eps = slipProb;
    const probIntended = Math.max(0, 1 - 2 * eps);
    const probSlip = eps;

    for (let r = 0; r < N; r++) {
      for (let c = 0; c < N; c++) {
        const key = `${r},${c}`;
        Q[key] = { UP: 0, DOWN: 0, LEFT: 0, RIGHT: 0 };
        Pi[key] = { UP: 0.25, DOWN: 0.25, LEFT: 0.25, RIGHT: 0.25 };

        if (!grid[r] || grid[r][c] === 1) continue; // Barrier has no valid transitions

        let maxQ = -Infinity;
        for (const action of ACTIONS) {
          const outcomes: { dir: Direction; prob: number }[] = [
            { dir: action, prob: probIntended },
            { dir: PERPENDICULAR[action][0], prob: probSlip },
            { dir: PERPENDICULAR[action][1], prob: probSlip },
          ];

          let expectedQ = 0;
          for (const outcome of outcomes) {
            const [dr, dc] = DIR_DELTAS[outcome.dir];
            let nr = r + dr;
            let nc = c + dc;

            // Wall bounce
            if (nr < 0 || nr >= N || nc < 0 || nc >= N || grid[nr]?.[nc] === 1) {
              nr = r;
              nc = c;
            }

            let reward = -1;
            if (nr === goalPos[0] && nc === goalPos[1]) reward = 100;
            else if (grid[nr]?.[nc] === 2) reward = -15;

            const nextV = values[nr]?.[nc] ?? 0;
            expectedQ += outcome.prob * (reward + gamma * nextV);
          }

          Q[key][action] = expectedQ;
          if (expectedQ > maxQ) maxQ = expectedQ;
        }

        // Softmax Action Choice distribution
        let sumExp = 0;
        const temp = Math.max(0.05, temperature);
        for (const action of ACTIONS) {
          sumExp += Math.exp((Q[key][action] - maxQ) / temp);
        }
        for (const action of ACTIONS) {
          Pi[key][action] = Math.exp((Q[key][action] - maxQ) / temp) / (sumExp || 1);
        }
      }
    }

    return { qValues: Q, actionProbabilities: Pi };
  }, [grid, N, values, goalPos, slipProb, gamma, temperature]);

  // 2. Compute Multi-Step Forward Path Occupancy from the current MDP state s0 (agentPos)
  const { pathOccupancy, maxOccupancy, discreteBranches } = useMemo(() => {
    const [agentR, agentC] = agentPos;
    const [goalR, goalC] = goalPos;

    // Probability map
    let currentDist: number[][] = Array.from({ length: N }, () => Array(N).fill(0));
    currentDist[agentR][agentC] = 1.0;

    const cumulative: number[][] = Array.from({ length: N }, () => Array(N).fill(0));
    cumulative[agentR][agentC] = 1.0;

    const eps = slipProb;
    const probIntended = Math.max(0, 1 - 2 * eps);
    const probSlip = eps;

    // Forward propagation up to horizon steps
    for (let step = 1; step <= horizon; step++) {
      const nextDist: number[][] = Array.from({ length: N }, () => Array(N).fill(0));

      for (let r = 0; r < N; r++) {
        for (let c = 0; c < N; c++) {
          const p = currentDist[r][c];
          if (p < 0.0001) continue;

          // Goal absorbs probability
          if (r === goalR && c === goalC) {
            nextDist[r][c] += p;
            continue;
          }

          const pi = actionProbabilities[`${r},${c}`];
          if (!pi) continue;

          for (const action of ACTIONS) {
            const actionProb = pi[action];
            if (actionProb < 0.001) continue;

            const outcomes: { dir: Direction; prob: number }[] = [
              { dir: action, prob: probIntended },
              { dir: PERPENDICULAR[action][0], prob: probSlip },
              { dir: PERPENDICULAR[action][1], prob: probSlip },
            ];

            for (const outcome of outcomes) {
              const [dr, dc] = DIR_DELTAS[outcome.dir];
              let nr = r + dr;
              let nc = c + dc;

              if (nr < 0 || nr >= N || nc < 0 || nc >= N || grid[nr]?.[nc] === 1) {
                nr = r;
                nc = c;
              }

              nextDist[nr][nc] += p * actionProb * outcome.prob;
            }
          }
        }
      }

      currentDist = nextDist;
      // Accumulate discounted path presence
      const discountFactor = Math.pow(0.96, step);
      for (let r = 0; r < N; r++) {
        for (let c = 0; c < N; c++) {
          cumulative[r][c] += currentDist[r][c] * discountFactor;
        }
      }
    }

    // Find max for normalization (excluding agent starting tile if it skews)
    let maxOcc = 0;
    for (let r = 0; r < N; r++) {
      for (let c = 0; c < N; c++) {
        if (grid[r]?.[c] !== 1) {
          maxOcc = Math.max(maxOcc, cumulative[r][c]);
        }
      }
    }

    // 3. Extract Discrete Trajectory Branches from current state
    const branches: {
      id: string;
      name: string;
      probability: number;
      color: string;
      path: [number, number][];
    }[] = [];

    // Main optimal trajectory
    const tracePath = (startStepDir?: Direction) => {
      const path: [number, number][] = [[agentR, agentC]];
      let currR = agentR;
      let currC = agentC;
      const visited = new Set<string>([`${currR},${currC}`]);

      for (let step = 0; step < Math.min(30, N * 2); step++) {
        if (currR === goalR && currC === goalC) break;

        let nextDir: Direction | null = null;
        if (step === 0 && startStepDir) {
          nextDir = startStepDir;
        } else {
          nextDir = policy[currR]?.[currC] || null;
        }

        if (!nextDir) break;

        const [dr, dc] = DIR_DELTAS[nextDir];
        const nr = currR + dr;
        const nc = currC + dc;

        if (nr < 0 || nr >= N || nc < 0 || nc >= N || grid[nr]?.[nc] === 1) break;

        currR = nr;
        currC = nc;
        const key = `${currR},${currC}`;
        if (visited.has(key)) break; // Prevent cycle loops
        visited.add(key);
        path.push([currR, currC]);
      }
      return path;
    };

    const optDir = policy[agentR]?.[agentC];
    if (optDir) {
      // Primary optimal path
      const optPath = tracePath();
      branches.push({
        id: "primary",
        name: "Optimal Bellman Corridor π*(s)",
        probability: Math.round(probIntended * 100),
        color: "#00D1FF",
        path: optPath,
      });

      // Lateral slip alternative A
      const perpA = PERPENDICULAR[optDir][0];
      const slipPathA = tracePath(perpA);
      if (slipPathA.length > 1) {
        branches.push({
          id: "slip_a",
          name: `Slip Deflection Branch (${perpA})`,
          probability: Math.round(probSlip * 100),
          color: "#F59E0B",
          path: slipPathA,
        });
      }

      // Lateral slip alternative B
      const perpB = PERPENDICULAR[optDir][1];
      const slipPathB = tracePath(perpB);
      if (slipPathB.length > 1) {
        branches.push({
          id: "slip_b",
          name: `Slip Deflection Branch (${perpB})`,
          probability: Math.round(probSlip * 100),
          color: "#EC4899",
          path: slipPathB,
        });
      }
    }

    return {
      pathOccupancy: cumulative,
      maxOccupancy: maxOcc || 1,
      discreteBranches: branches,
    };
  }, [agentPos, goalPos, N, slipProb, horizon, actionProbabilities, grid, policy]);

  // Canvas Drawing & Animation Loop
  useEffect(() => {
    if (!enabled) return;
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationFrameId: number;

    // Helper to get pixel center coordinates of tile (r, c)
    const getCellCenter = (r: number, c: number): { x: number; y: number; size: number } | null => {
      const cellEl = container.querySelector<HTMLElement>(`[data-cell="${r}-${c}"]`);
      if (!cellEl) return null;
      const containerRect = container.getBoundingClientRect();
      const cellRect = cellEl.getBoundingClientRect();

      return {
        x: cellRect.left - containerRect.left + cellRect.width / 2,
        y: cellRect.top - containerRect.top + cellRect.height / 2,
        size: Math.min(cellRect.width, cellRect.height),
      };
    };

    // Initialize or refresh particles along branches
    if (particlesRef.current.length < 24 && discreteBranches.length > 0) {
      particlesRef.current = Array.from({ length: 24 }, (_, i) => ({
        x: 0,
        y: 0,
        progress: (i / 24) * 0.9,
        speed: 0.008 + Math.random() * 0.007,
        pathIndex: i % discreteBranches.length,
        alpha: 0.8,
        size: 2.5 + Math.random() * 2,
      }));
    }

    const render = () => {
      const containerRect = container.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;

      // Ensure canvas resolution matches high-DPI container size
      if (
        canvas.width !== containerRect.width * dpr ||
        canvas.height !== containerRect.height * dpr
      ) {
        canvas.width = containerRect.width * dpr;
        canvas.height = containerRect.height * dpr;
        canvas.style.width = `${containerRect.width}px`;
        canvas.style.height = `${containerRect.height}px`;
      }

      ctx.save();
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, containerRect.width, containerRect.height);

      ctx.globalAlpha = opacity;

      // LAYER 1: Fluid Canvas Path Probability Heatmap
      if (mode === "reachability" || mode === "branches") {
        for (let r = 0; r < N; r++) {
          for (let c = 0; c < N; c++) {
            if (grid[r]?.[c] === 1) continue; // Skip wall obstacles

            const occ = pathOccupancy[r]?.[c] ?? 0;
            const normOcc = Math.min(1.0, occ / maxOccupancy);

            if (normOcc < 0.04) continue; // Skip near-zero likelihood tiles

            const pos = getCellCenter(r, c);
            if (!pos) continue;

            // Multi-stop radial gradient for soft continuous glow
            const radius = pos.size * (0.8 + normOcc * 0.7);
            const gradient = ctx.createRadialGradient(pos.x, pos.y, 0, pos.x, pos.y, radius);

            if (normOcc > 0.65) {
              // High probability core (Golden Emerald / Bright Cyan)
              gradient.addColorStop(0, `rgba(0, 209, 255, ${0.45 * normOcc})`);
              gradient.addColorStop(0.5, `rgba(16, 185, 129, ${0.28 * normOcc})`);
              gradient.addColorStop(1, "rgba(0, 209, 255, 0)");
            } else if (normOcc > 0.3) {
              // Moderate corridor (Cyan - Indigo)
              gradient.addColorStop(0, `rgba(0, 209, 255, ${0.32 * normOcc})`);
              gradient.addColorStop(0.6, `rgba(99, 102, 241, ${0.18 * normOcc})`);
              gradient.addColorStop(1, "rgba(99, 102, 241, 0)");
            } else {
              // Stochastic fringe (Amber - Violet slip margin)
              gradient.addColorStop(0, `rgba(245, 158, 11, ${0.22 * normOcc})`);
              gradient.addColorStop(1, "rgba(245, 158, 11, 0)");
            }

            ctx.fillStyle = gradient;
            ctx.beginPath();
            ctx.arc(pos.x, pos.y, radius, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }

      // LAYER 2: Entropy Overlay (Local Policy Uncertainty Heatmap)
      if (mode === "entropy") {
        for (let r = 0; r < N; r++) {
          for (let c = 0; c < N; c++) {
            if (grid[r]?.[c] === 1) continue;
            const pi = actionProbabilities[`${r},${c}`];
            if (!pi) continue;

            // Shannon entropy H(s) = -sum p log p
            let entropy = 0;
            for (const a of ACTIONS) {
              const p = pi[a];
              if (p > 0.001) entropy -= p * Math.log2(p);
            }
            // Max entropy for 4 actions is 2 bits
            const normEntropy = Math.min(1, entropy / 2.0);

            const pos = getCellCenter(r, c);
            if (!pos) continue;

            const radius = pos.size * 0.9;
            const grad = ctx.createRadialGradient(pos.x, pos.y, 0, pos.x, pos.y, radius);
            grad.addColorStop(0, `rgba(244, 63, 94, ${normEntropy * 0.4})`);
            grad.addColorStop(1, "rgba(244, 63, 94, 0)");
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.arc(pos.x, pos.y, radius, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }

      // LAYER 3: Dynamic Path Streamlines / Bezier Ribbons
      if (showStreamlines && discreteBranches.length > 0) {
        discreteBranches.forEach((branch, bIdx) => {
          if (branch.path.length < 2) return;

          ctx.beginPath();
          let started = false;

          for (let i = 0; i < branch.path.length; i++) {
            const [pr, pc] = branch.path[i];
            const pt = getCellCenter(pr, pc);
            if (!pt) continue;

            if (!started) {
              ctx.moveTo(pt.x, pt.y);
              started = true;
            } else {
              // Smooth bezier through midpoint
              const prev = getCellCenter(branch.path[i - 1][0], branch.path[i - 1][1]);
              if (prev) {
                const midX = (prev.x + pt.x) / 2;
                const midY = (prev.y + pt.y) / 2;
                ctx.quadraticCurveTo(prev.x, prev.y, midX, midY);
              }
            }
          }

          ctx.lineWidth = bIdx === 0 ? 3.5 : 2;
          ctx.strokeStyle = branch.color;
          ctx.lineCap = "round";
          ctx.lineJoin = "round";

          // Dashed line for slip branches, solid for primary
          if (bIdx > 0) {
            ctx.setLineDash([5, 4]);
          } else {
            ctx.setLineDash([]);
          }

          // Glowing shadow
          ctx.shadowColor = branch.color;
          ctx.shadowBlur = bIdx === 0 ? 10 : 6;
          ctx.stroke();
          ctx.shadowBlur = 0;
          ctx.setLineDash([]);
        });
      }

      // LAYER 4: Animated Streamline Photons
      if (showParticles && discreteBranches.length > 0) {
        particlesRef.current.forEach((p) => {
          const branch = discreteBranches[p.pathIndex % discreteBranches.length];
          if (!branch || branch.path.length < 2) return;

          p.progress += p.speed;
          if (p.progress >= 0.98) {
            p.progress = 0;
            p.pathIndex = Math.floor(Math.random() * discreteBranches.length);
          }

          const pathLen = branch.path.length;
          const floatIdx = p.progress * (pathLen - 1);
          const idx0 = Math.floor(floatIdx);
          const idx1 = Math.min(pathLen - 1, idx0 + 1);
          const t = floatIdx - idx0;

          const pt0 = getCellCenter(branch.path[idx0][0], branch.path[idx0][1]);
          const pt1 = getCellCenter(branch.path[idx1][0], branch.path[idx1][1]);

          if (pt0 && pt1) {
            p.x = pt0.x + (pt1.x - pt0.x) * t;
            p.y = pt0.y + (pt1.y - pt0.y) * t;

            ctx.fillStyle = branch.color;
            ctx.shadowColor = branch.color;
            ctx.shadowBlur = 8;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            ctx.fill();
            ctx.shadowBlur = 0;
          }
        });
      }

      // LAYER 5: Agent MDP State Action Choice Arcs
      const agentCenter = getCellCenter(agentPos[0], agentPos[1]);
      if (agentCenter) {
        const agentPi = actionProbabilities[`${agentPos[0]},${agentPos[1]}`];
        if (agentPi) {
          const arcR = agentCenter.size * 0.72;
          ctx.lineWidth = 3;

          // Draw probability ring arcs for 4 directions
          const angles: Record<Direction, number> = {
            RIGHT: 0,
            DOWN: Math.PI / 2,
            LEFT: Math.PI,
            UP: -Math.PI / 2,
          };

          for (const a of ACTIONS) {
            const prob = agentPi[a];
            if (prob < 0.05) continue;

            const midAngle = angles[a];
            const span = (prob * Math.PI) / 2;

            ctx.strokeStyle = prob > 0.45 ? "#00D1FF" : "rgba(245, 158, 11, 0.75)";
            ctx.beginPath();
            ctx.arc(agentCenter.x, agentCenter.y, arcR, midAngle - span, midAngle + span);
            ctx.stroke();
          }
        }
      }

      // LAYER 6: Decision Badges on Key Tiles
      if (showDecisionBadges) {
        discreteBranches.forEach((branch, bIdx) => {
          if (branch.path.length > 2) {
            const midNode = branch.path[Math.min(3, branch.path.length - 2)];
            const pos = getCellCenter(midNode[0], midNode[1]);
            if (pos) {
              const label = `${branch.probability}%`;
              ctx.font = "bold 9px monospace";
              const textW = ctx.measureText(label).width;

              ctx.fillStyle = "rgba(10, 10, 10, 0.85)";
              ctx.strokeStyle = branch.color;
              ctx.lineWidth = 1;
              ctx.beginPath();
              ctx.roundRect(pos.x - textW / 2 - 4, pos.y - 6, textW + 8, 12, 3);
              ctx.fill();
              ctx.stroke();

              ctx.fillStyle = branch.color;
              ctx.textAlign = "center";
              ctx.textBaseline = "middle";
              ctx.fillText(label, pos.x, pos.y);
            }
          }
        });
      }

      ctx.restore();
      animationFrameId = requestAnimationFrame(render);
    };

    animationFrameId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animationFrameId);
  }, [
    enabled,
    mode,
    opacity,
    showStreamlines,
    showParticles,
    showDecisionBadges,
    pathOccupancy,
    maxOccupancy,
    discreteBranches,
    actionProbabilities,
    N,
    grid,
    agentPos,
    containerRef,
  ]);

  // Hovered Cell Inspector Data
  const hoveredInfo = useMemo(() => {
    if (!hoveredCell) return null;
    const [hr, hc] = hoveredCell;
    if (grid[hr]?.[hc] === 1) return null;

    const occ = pathOccupancy[hr]?.[hc] ?? 0;
    const pathProbPct = Math.min(100, Math.round((occ / maxOccupancy) * 100));
    const pi = actionProbabilities[`${hr},${hc}`];
    const q = qValues[`${hr},${hc}`];
    const val = values[hr]?.[hc] ?? 0;

    return {
      coords: `(${hr}, ${hc})`,
      pathProbPct,
      val: val.toFixed(1),
      pi,
      q,
    };
  }, [hoveredCell, grid, pathOccupancy, maxOccupancy, actionProbabilities, qValues, values]);

  return (
    <>
      {/* Absolute Canvas Layer over the matrix grid */}
      <canvas
        ref={canvasRef}
        className={`absolute inset-0 pointer-events-none z-10 transition-opacity duration-300 ${
          enabled ? "opacity-100" : "opacity-0"
        }`}
      />

      {/* Interactive Floating Canvas Heatmap Controls Panel */}
      <div className="w-full space-y-2 mt-2">
        <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-lg bg-[#070b10] border border-[#00D1FF30]">
          {/* Left: Main Toggle & Mode Selector */}
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={enabled}
                onChange={(e) => setEnabled(e.target.checked)}
                className="rounded accent-[#00D1FF] w-4 h-4 cursor-pointer"
              />
              <span className="text-xs font-bold font-mono text-[#00D1FF] flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 animate-pulse" />
                CANVAS PATH HEATMAP OVERLAY
              </span>
            </label>

            {enabled && (
              <div className="hidden sm:flex items-center gap-1 bg-black/60 p-0.5 rounded border border-white/10 text-[10px] font-mono">
                <button
                  type="button"
                  onClick={() => setMode("reachability")}
                  className={`px-2 py-0.5 rounded cursor-pointer transition-all ${
                    mode === "reachability"
                      ? "bg-[#00D1FF25] text-[#00D1FF] font-bold border border-[#00D1FF50]"
                      : "text-white/60 hover:text-white"
                  }`}
                >
                  Forward Occupancy
                </button>
                <button
                  type="button"
                  onClick={() => setMode("branches")}
                  className={`px-2 py-0.5 rounded cursor-pointer transition-all ${
                    mode === "branches"
                      ? "bg-[#00D1FF25] text-[#00D1FF] font-bold border border-[#00D1FF50]"
                      : "text-white/60 hover:text-white"
                  }`}
                >
                  Slip Branches
                </button>
                <button
                  type="button"
                  onClick={() => setMode("entropy")}
                  className={`px-2 py-0.5 rounded cursor-pointer transition-all ${
                    mode === "entropy"
                      ? "bg-rose-500/25 text-rose-300 font-bold border border-rose-500/50"
                      : "text-white/60 hover:text-white"
                  }`}
                >
                  Policy Entropy
                </button>
              </div>
            )}
          </div>

          {/* Right: Fine-tuning Drawer Trigger & Hover Stat */}
          <div className="flex items-center gap-2">
            {hoveredInfo && (
              <div className="text-[11px] font-mono px-2 py-0.5 rounded bg-black/70 border border-[#00D1FF40] text-[#00D1FF] flex items-center gap-1.5">
                <Activity className="w-3 h-3" />
                <span>
                  Tile {hoveredInfo.coords}: <b className="text-white">{hoveredInfo.pathProbPct}%</b> Choice Prob
                </span>
              </div>
            )}

            <button
              type="button"
              onClick={() => setShowControls((c) => !c)}
              className={`px-2.5 py-1 rounded text-xs font-mono border flex items-center gap-1 cursor-pointer transition-colors ${
                showControls
                  ? "bg-white/10 text-white border-white/30"
                  : "bg-black/50 text-white/70 hover:text-white border-white/10"
              }`}
            >
              <Sliders className="w-3.5 h-3.5 text-[#00D1FF]" />
              Heatmap Settings
            </button>
          </div>
        </div>

        {/* Collapsible Fine-tuning Drawer */}
        {enabled && showControls && (
          <div className="p-3.5 rounded-lg bg-[#070b10]/95 border border-[#ffffff12] grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs font-mono">
            {/* Opacity Slider */}
            <div className="space-y-1">
              <div className="flex justify-between text-white/60">
                <span>Overlay Opacity:</span>
                <span className="text-[#00D1FF]">{Math.round(opacity * 100)}%</span>
              </div>
              <input
                type="range"
                min="0.2"
                max="1.0"
                step="0.05"
                value={opacity}
                onChange={(e) => setOpacity(parseFloat(e.target.value))}
                className="w-full accent-[#00D1FF] cursor-pointer"
              />
            </div>

            {/* Temperature Slider */}
            <div className="space-y-1">
              <div className="flex justify-between text-white/60">
                <span>Softmax Temp (τ):</span>
                <span className="text-[#00D1FF]">{temperature.toFixed(2)}</span>
              </div>
              <input
                type="range"
                min="0.1"
                max="1.2"
                step="0.05"
                value={temperature}
                onChange={(e) => setTemperature(parseFloat(e.target.value))}
                className="w-full accent-[#00D1FF] cursor-pointer"
              />
              <span className="text-[10px] text-white/40 block">
                {temperature < 0.25 ? "Sharp Greedy Focus" : "Stochastic Path Dispersion"}
              </span>
            </div>

            {/* Horizon Slider */}
            <div className="space-y-1">
              <div className="flex justify-between text-white/60">
                <span>Forward Horizon (H):</span>
                <span className="text-[#00D1FF]">{horizon} steps</span>
              </div>
              <input
                type="range"
                min="8"
                max="32"
                step="2"
                value={horizon}
                onChange={(e) => setHorizon(parseInt(e.target.value))}
                className="w-full accent-[#00D1FF] cursor-pointer"
              />
            </div>

            {/* Feature Checkboxes */}
            <div className="sm:col-span-3 flex flex-wrap items-center gap-4 pt-2 border-t border-white/10 text-white/70">
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showStreamlines}
                  onChange={(e) => setShowStreamlines(e.target.checked)}
                  className="rounded accent-[#00D1FF]"
                />
                Trajectory Bezier Streamlines
              </label>

              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showParticles}
                  onChange={(e) => setShowParticles(e.target.checked)}
                  className="rounded accent-[#00D1FF]"
                />
                Photon Particle Pulse
              </label>

              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showDecisionBadges}
                  onChange={(e) => setShowDecisionBadges(e.target.checked)}
                  className="rounded accent-[#00D1FF]"
                />
                Branch Probability Badges
              </label>
            </div>
          </div>
        )}

        {/* Dynamic Branch Likelihood Bar (from current state s0) */}
        {enabled && discreteBranches.length > 0 && (
          <div className="p-2.5 rounded-lg bg-black/70 border border-[#ffffff10] flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs font-mono">
            <div className="flex items-center gap-2">
              <Zap className="w-3.5 h-3.5 text-[#00D1FF]" />
              <span className="text-white/60">
                Current MDP State <b className="text-white">({agentPos[0]}, {agentPos[1]})</b> Path Choices:
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {discreteBranches.map((b) => (
                <div
                  key={b.id}
                  className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-[#0a0a0a] border border-white/10"
                >
                  <span
                    className="w-2 h-2 rounded-full shadow-[0_0_6px]"
                    style={{ backgroundColor: b.color }}
                  />
                  <span className="text-white/80 text-[11px]">{b.name}:</span>
                  <span className="font-bold text-white text-[11px]" style={{ color: b.color }}>
                    {b.probability}%
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
