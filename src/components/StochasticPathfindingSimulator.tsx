import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Play,
  Pause,
  RotateCcw,
  Shuffle,
  Compass,
  Zap,
  Flame,
  CheckCircle2,
  AlertTriangle,
  Layers,
  ArrowRight,
  User,
  Radio,
  Crosshair,
  MapPin,
  LifeBuoy,
  Navigation,
  Activity,
  Sliders,
  Sparkles,
  Signal,
  Eye,
  RadioTower,
  Volume2,
} from "lucide-react";
import { CanvasPathHeatmapOverlay } from "./CanvasPathHeatmapOverlay";
import { useAuth } from "../lib/AuthContext";
import { recordRecentPath } from "../lib/pathPersistence";
import { RecentPathsList } from "./RecentPathsList";
import { MapUploadManager } from "./MapUploadManager";
import { PathRecord } from "../types/paths";

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
type MapTool = "locate_person" | "move_agent" | "toggle_barrier" | "toggle_hazard" | "inspect";

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

const SURVIVOR_PROFILES = [
  { name: "Lost Mountaineer (Beacon #402)", condition: "Hypothermia Risk (Cold Exposure)", freq: "406.025 MHz" },
  { name: "Trapped Citizen (Unit Echo)", condition: "Rubble Pocket (Structural Collapse)", freq: "406.050 MHz" },
  { name: "Stranded Hiker (Beacon #711)", condition: "Smoke Inhalation Risk", freq: "406.028 MHz" },
  { name: "Man-Overboard (Sea Beacon #204)", condition: "Oceanic Drift Current", freq: "406.035 MHz" },
  { name: "Cave Explorer (Unit Echo-9)", condition: "Acoustic Subterranean Ping", freq: "406.012 MHz" },
];

export function StochasticPathfindingSimulator({
  gridDimension = 12,
  obstacleDensity = 22,
  slipProb = 0.15,
  gamma = 0.95,
  energyBudget = 60,
  hazardLevel = "Moderate (Stochastic Swarms)",
  onRunTelemetry,
}: SimulatorProps) {
  const { user } = useAuth();
  const [refreshPathsTrigger, setRefreshPathsTrigger] = useState(0);
  const [actionSequence, setActionSequence] = useState<Direction[]>([]);
  const N = Math.min(16, Math.max(8, Math.round(gridDimension)));

  // Grid states: 0: empty, 1: obstacle, 2: hazard, 3: start, 4: target person
  const [grid, setGrid] = useState<number[][]>([]);
  const [values, setValues] = useState<number[][]>([]);
  const [policy, setPolicy] = useState<(Direction | null)[][]>([]);

  // Positions
  const [startPos, setStartPos] = useState<[number, number]>([1, 1]);
  const [targetPos, setTargetPos] = useState<[number, number]>([N - 2, N - 2]);
  const [agentPos, setAgentPos] = useState<[number, number]>([1, 1]);
  const [pathHistory, setPathHistory] = useState<[number, number][]>([[1, 1]]);

  // Target Person Metadata
  const [profileIndex, setProfileIndex] = useState(0);
  const currentSurvivor = SURVIVOR_PROFILES[profileIndex % SURVIVOR_PROFILES.length];
  const [isPinging, setIsPinging] = useState(false);

  // Active Map Tool
  const [activeTool, setActiveTool] = useState<MapTool>("locate_person");

  // Display toggles
  const [showHeatmap, setShowHeatmap] = useState(true);
  const [showPolicyArrows, setShowPolicyArrows] = useState(true);
  const gridContainerRef = useRef<HTMLDivElement | null>(null);
  const [hoveredCell, setHoveredCell] = useState<[number, number] | null>(null);

  // Simulation execution state
  const [isPlaying, setIsPlaying] = useState(false);
  const [simStatus, setSimStatus] = useState<
    "idle" | "running" | "goal_reached" | "energy_depleted" | "hazard_damage"
  >("idle");
  const [stepsTaken, setStepsTaken] = useState(0);
  const [slipsCount, setSlipsCount] = useState(0);
  const [accumulatedReward, setAccumulatedReward] = useState(0);
  const [lastEvent, setLastEvent] = useState<string>(
    "Search & Rescue Grid initialized. Click any tile to reposition the target person."
  );

  const timerRef = useRef<any>(null);

  // Distance & Bearing Calculations
  const calcDistance = (p1: [number, number], p2: [number, number]) => {
    const dr = p1[0] - p2[0];
    const dc = p1[1] - p2[1];
    return {
      euclidean: Math.hypot(dr, dc),
      manhattan: Math.abs(dr) + Math.abs(dc),
    };
  };

  const distToTarget = calcDistance(agentPos, targetPos);
  const maxPossibleDist = Math.hypot(N - 1, N - 1);
  const signalPercent = Math.max(
    10,
    Math.min(100, Math.round(100 - (distToTarget.euclidean / maxPossibleDist) * 88))
  );

  const calcBearing = (from: [number, number], to: [number, number]) => {
    const dr = to[0] - from[0];
    const dc = to[1] - from[1];
    if (dr === 0 && dc === 0) return { deg: 0, cardinal: "ON TARGET" };

    let deg = (Math.atan2(dc, -dr) * 180) / Math.PI;
    if (deg < 0) deg += 360;
    const cardinals = ["N", "NE", "E", "SE", "S", "SW", "W", "NW", "N"];
    const idx = Math.round(deg / 45);
    return { deg: Math.round(deg), cardinal: cardinals[idx] };
  };

  const bearing = calcBearing(agentPos, targetPos);

  // Bellman Value Iteration solver targeting targetPos
  const solveValueIteration = useCallback(
    (
      currentGrid: number[][],
      sR: number,
      sC: number,
      tR: number,
      tC: number
    ) => {
      const size = currentGrid.length;
      let V: number[][] = Array.from({ length: size }, () => Array(size).fill(0));
      let P: (Direction | null)[][] = Array.from({ length: size }, () => Array(size).fill(null));

      // Terminal goal value at person coordinates
      if (tR >= 0 && tR < size && tC >= 0 && tC < size) {
        V[tR][tC] = 100;
      }

      const eps = slipProb;
      const probIntended = Math.max(0, 1 - 2 * eps);
      const probSlip = eps;

      const maxIterations = 90;
      const deltaThreshold = 0.001;

      for (let it = 0; it < maxIterations; it++) {
        let maxDelta = 0;
        const nextV = V.map((row) => [...row]);

        for (let r = 0; r < size; r++) {
          for (let c = 0; c < size; c++) {
            if (currentGrid[r][c] === 1) continue; // Barrier has 0 value
            if (r === tR && c === tC) continue; // Terminal target person

            let maxQ = -Infinity;
            let bestAction: Direction = "RIGHT";

            for (const action of ACTIONS) {
              let expectedVal = 0;

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
                  nr = r;
                  nc = c;
                }

                let reward = -1; // Standard step friction cost
                if (nr === tR && nc === tC) {
                  reward = 100; // Found missing person
                } else if (currentGrid[nr][nc] === 2) {
                  reward = -15; // Hazardous terrain penalty
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
    },
    [slipProb, gamma]
  );

  // Initialize and generate map terrain
  const initializeGrid = useCallback(() => {
    const newGrid: number[][] = Array.from({ length: N }, () => Array(N).fill(0));
    const sR = 1;
    const sC = 1;
    const tR = N - 2;
    const tC = N - 2;

    const barrierProb = obstacleDensity / 100;
    const hazardProb =
      hazardLevel.includes("Severe") ? 0.12 : hazardLevel.includes("Moderate") ? 0.07 : 0.03;

    for (let r = 0; r < N; r++) {
      for (let c = 0; c < N; c++) {
        // Perimeter borders
        if (r === 0 || r === N - 1 || c === 0 || c === N - 1) {
          newGrid[r][c] = 1;
          continue;
        }
        // Protect start & target person zones
        if (
          (Math.abs(r - sR) <= 1 && Math.abs(c - sC) <= 1) ||
          (Math.abs(r - tR) <= 1 && Math.abs(c - tC) <= 1)
        ) {
          continue;
        }

        const rand = Math.random();
        if (rand < barrierProb) {
          newGrid[r][c] = 1; // Obstacle / Rubble
        } else if (rand < barrierProb + hazardProb) {
          newGrid[r][c] = 2; // Smoke / Hazard
        }
      }
    }

    newGrid[sR][sC] = 3; // Start Search Unit
    newGrid[tR][tC] = 4; // Target Person Beacon

    setGrid(newGrid);
    setStartPos([sR, sC]);
    setTargetPos([tR, tC]);
    setAgentPos([sR, sC]);
    setPathHistory([[sR, sC]]);
    setStepsTaken(0);
    setSlipsCount(0);
    setAccumulatedReward(0);
    setSimStatus("idle");
    setLastEvent(
      `Map initialized (${N}x${N}, ${obstacleDensity}% barriers). Missing person beacon at (${tR}, ${tC}). Computing Bellman paths...`
    );

    solveValueIteration(newGrid, sR, sC, tR, tC);
  }, [N, obstacleDensity, hazardLevel, solveValueIteration]);

  // Re-initialize when dimensions or core params change
  useEffect(() => {
    initializeGrid();
  }, [initializeGrid]);

  // Execute single stochastic search step
  const executeStep = useCallback(() => {
    if (simStatus === "goal_reached" || simStatus === "energy_depleted") {
      setIsPlaying(false);
      return;
    }

    setAgentPos(([currR, currC]) => {
      const tR = targetPos[0];
      const tC = targetPos[1];

      // Check if already on target
      if (currR === tR && currC === tC) {
        setSimStatus("goal_reached");
        setIsPlaying(false);
        setLastEvent(
          `[SURVIVOR LOCATED] Rescue agent established contact with ${currentSurvivor.name} at (${tR}, ${tC})! Terminal reward +100.`
        );
        onRunTelemetry?.({
          steps: stepsTaken,
          slips: slipsCount,
          reward: accumulatedReward + 100,
          reachedGoal: true,
          pathLength: pathHistory.length,
        });
        return [currR, currC];
      }

      // Check battery energy limit
      if (stepsTaken >= energyBudget) {
        setSimStatus("energy_depleted");
        setIsPlaying(false);
        setLastEvent(
          `[BATTERY DEPLETED] Search drone exhausted battery budget (${energyBudget} steps limit) before reaching target.`
        );
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

      // Stochastic transition slip
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

      // Obstacle or boundary collision rebound
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
      const isTarget = nextR === tR && nextC === tC;

      let stepReward = -1;
      if (isTarget) stepReward = 100;
      else if (isHazard) stepReward = -15;
      else if (bounced) stepReward = -5;

      setStepsTaken((s) => s + 1);
      setAccumulatedReward((r) => r + stepReward);
      if (slipped) setSlipsCount((s) => s + 1);

      setActionSequence((prev) => [...prev, actualDir]);
      const updatedHistory: [number, number][] = [...pathHistory, [nextR, nextC]];
      setPathHistory(updatedHistory);

      if (isTarget) {
        setSimStatus("goal_reached");
        setIsPlaying(false);
        setLastEvent(
          `[SUCCESS: PERSON LOCATED] Target acquired at (${nextR}, ${nextC}) in ${stepsTaken + 1} steps! Signal locked.`
        );

        // Record optimal path sequence to Firestore & localStorage
        const newRecord: PathRecord = {
          id: `path_${Date.now()}`,
          sequence: [...actionSequence, actualDir],
          pathCoordinates: updatedHistory,
          startPos,
          targetPos,
          gridDimension: N,
          stepsCount: stepsTaken + 1,
          slipsCount: slipsCount + (slipped ? 1 : 0),
          accumulatedReward: accumulatedReward + stepReward,
          reachedGoal: true,
          slipProb,
          survivorName: currentSurvivor.name,
          timestamp: new Date().toISOString(),
        };

        recordRecentPath(newRecord, user?.uid).then(() => {
          setRefreshPathsTrigger((prev) => prev + 1);
        });

        onRunTelemetry?.({
          steps: stepsTaken + 1,
          slips: slipsCount + (slipped ? 1 : 0),
          reward: accumulatedReward + stepReward,
          reachedGoal: true,
          pathLength: updatedHistory.length,
        });
      } else if (isHazard) {
        setLastEvent(
          `[HAZARD DAMAGE] Step ${stepsTaken + 1}: Drone drifted into thermal hazard at (${nextR}, ${nextC})! -15 reward penalty.`
        );
      } else if (slipped) {
        setLastEvent(
          `[STOCHASTIC SLIP] Step ${stepsTaken + 1}: Wind/friction deflected intended ${optimalDir} -> Slipped to ${actualDir} (ε=${(
            slipProb * 100
          ).toFixed(0)}%)`
        );
      } else if (bounced) {
        setLastEvent(
          `[BARRIER BOUNCE] Step ${stepsTaken + 1}: Collided with rubble at (${nextR}, ${nextC}) and held position.`
        );
      } else {
        setLastEvent(
          `Step ${stepsTaken + 1}: Optimal action ${optimalDir} executed toward target -> Position (${nextR}, ${nextC}).`
        );
      }

      return [nextR, nextC];
    });
  }, [
    simStatus,
    targetPos,
    stepsTaken,
    energyBudget,
    policy,
    slipProb,
    N,
    grid,
    slipsCount,
    accumulatedReward,
    pathHistory.length,
    currentSurvivor.name,
    onRunTelemetry,
    actionSequence,
    startPos,
    user?.uid,
  ]);

  // Simulation timer loop
  useEffect(() => {
    if (isPlaying) {
      timerRef.current = setInterval(() => {
        executeStep();
      }, 250);
    } else if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isPlaying, executeStep]);

  // Reset agent position back to start without altering map
  const handleResetRun = (overrideStart?: [number, number]) => {
    setIsPlaying(false);
    const s = overrideStart || startPos;
    setAgentPos(s);
    setPathHistory([s]);
    setActionSequence([]);
    setStepsTaken(0);
    setSlipsCount(0);
    setAccumulatedReward(0);
    setSimStatus("idle");
    setLastEvent(`Search unit reset to launch coordinates (${s[0]}, ${s[1]}). Ready.`);
  };

  // Map tile click handler - locates person, moves agent, or edits environment
  const handleCellClick = (r: number, c: number) => {
    // Keep outer boundary locked as perimeter barrier
    if (r <= 0 || r >= N - 1 || c <= 0 || c >= N - 1) return;

    if (activeTool === "locate_person") {
      if (r === startPos[0] && c === startPos[1]) {
        setLastEvent(
          `Cannot place target person directly on Search Agent starting coordinates (${r}, ${c}).`
        );
        return;
      }

      const newGrid = grid.map((row) => [...row]);
      // Clear old target position
      newGrid[targetPos[0]][targetPos[1]] = 0;
      // Set new target person position
      newGrid[r][c] = 4;

      setGrid(newGrid);
      setTargetPos([r, c]);
      solveValueIteration(newGrid, startPos[0], startPos[1], r, c);
      handleResetRun();
      setLastEvent(
        `[TARGET RELOCATED] Missing person beacon established at (${r}, ${c}). Bellman MDP gradient re-converged toward new coordinates!`
      );
    } else if (activeTool === "move_agent") {
      if (r === targetPos[0] && c === targetPos[1]) {
        setLastEvent(
          `Cannot place Search Agent directly on Missing Person coordinates (${r}, ${c}).`
        );
        return;
      }

      const newGrid = grid.map((row) => [...row]);
      newGrid[startPos[0]][startPos[1]] = 0;
      newGrid[r][c] = 3;

      setGrid(newGrid);
      setStartPos([r, c]);
      setAgentPos([r, c]);
      setPathHistory([[r, c]]);
      solveValueIteration(newGrid, r, c, targetPos[0], targetPos[1]);
      handleResetRun([r, c]);
      setLastEvent(
        `[SEARCH DRONE RELOCATED] Autonomous search unit deployed from coordinate (${r}, ${c}).`
      );
    } else if (activeTool === "toggle_barrier") {
      if (
        (r === startPos[0] && c === startPos[1]) ||
        (r === targetPos[0] && c === targetPos[1])
      ) {
        setLastEvent(`Cannot place rubble barrier on Search Unit or Target Person.`);
        return;
      }

      const newGrid = grid.map((row) => [...row]);
      newGrid[r][c] = newGrid[r][c] === 1 ? 0 : 1;
      setGrid(newGrid);
      solveValueIteration(newGrid, startPos[0], startPos[1], targetPos[0], targetPos[1]);
      setLastEvent(
        newGrid[r][c] === 1
          ? `[RUBBLE ADDED] Barrier constructed at (${r}, ${c}). Path recalculated.`
          : `[RUBBLE CLEARED] Debris cleared at (${r}, ${c}). Corridor reopened.`
      );
    } else if (activeTool === "toggle_hazard") {
      if (
        (r === startPos[0] && c === startPos[1]) ||
        (r === targetPos[0] && c === targetPos[1])
      ) {
        setLastEvent(`Cannot place hazard directly on Search Unit or Target Person.`);
        return;
      }

      const newGrid = grid.map((row) => [...row]);
      newGrid[r][c] = newGrid[r][c] === 2 ? 0 : 2;
      setGrid(newGrid);
      solveValueIteration(newGrid, startPos[0], startPos[1], targetPos[0], targetPos[1]);
      setLastEvent(
        newGrid[r][c] === 2
          ? `[HAZARD ZONE ADDED] Thermal/smoke hazard flagged at (${r}, ${c}) (-15 penalty).`
          : `[HAZARD NEUTRALIZED] Hazard zone removed at (${r}, ${c}).`
      );
    } else if (activeTool === "inspect") {
      setHoveredCell([r, c]);
      const val = values[r]?.[c] ?? 0;
      const act = policy[r]?.[c] ?? "None";
      setLastEvent(
        `[INSPECT TILE] Coordinate (${r}, ${c}) | V*(s) = ${val.toFixed(2)} | Optimal Policy: ${act} | Distance to Person: ${calcDistance(
          [r, c],
          targetPos
        ).euclidean.toFixed(1)} tiles`
      );
    }
  };

  // Randomize Person's Location
  const handleRandomizePerson = () => {
    // Find all empty cells
    const candidates: [number, number][] = [];
    for (let r = 1; r < N - 1; r++) {
      for (let c = 1; c < N - 1; c++) {
        if (
          grid[r][c] === 0 &&
          (Math.abs(r - startPos[0]) > 1 || Math.abs(c - startPos[1]) > 1)
        ) {
          candidates.push([r, c]);
        }
      }
    }

    if (candidates.length === 0) return;
    const choice = candidates[Math.floor(Math.random() * candidates.length)];
    const newGrid = grid.map((row) => [...row]);
    newGrid[targetPos[0]][targetPos[1]] = 0;
    newGrid[choice[0]][choice[1]] = 4;

    setGrid(newGrid);
    setTargetPos(choice);
    setProfileIndex((p) => p + 1);
    solveValueIteration(newGrid, startPos[0], startPos[1], choice[0], choice[1]);
    handleResetRun();
    setLastEvent(
      `[PERSON RELOCATED AT RANDOM] Target person moved to (${choice[0]}, ${choice[1]}). Radio beacon re-synchronized!`
    );
  };

  // Trigger Acoustic / Radio Distress Ping
  const handleTriggerPing = () => {
    setIsPinging(true);
    setLastEvent(
      `[ACOUSTIC BEACON PING] Distress signal transmitted on ${currentSurvivor.freq} from coordinate (${targetPos[0]}, ${targetPos[1]}). Signal RSSI: ${signalPercent}%. Bearing: ${bearing.cardinal} (${bearing.deg}°).`
    );
    setTimeout(() => {
      setIsPinging(false);
    }, 1600);
  };

  // Value normalization for heatmap coloring
  const flatVals = values.flat().filter((v) => v !== 0 && v !== 100);
  const minVal = flatVals.length ? Math.min(...flatVals) : -50;
  const maxVal = flatVals.length ? Math.max(...flatVals) : 80;

  return (
    <div className="space-y-4 font-mono">
      {/* Target Person & Radar Sensor Telemetry Banner */}
      <div className="bg-[#0c0f12] border border-[#00D1FF40] rounded-xl p-4 shadow-[0_0_25px_rgba(0,209,255,0.15)] relative overflow-hidden">
        {/* Subtle grid backdrop */}
        <div className="absolute inset-0 bg-[radial-gradient(#00D1FF08_1px,transparent_1px)] [background-size:16px_16px] pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          {/* Missing Person Profile & Beacon Info */}
          <div className="flex items-start sm:items-center gap-3">
            <div className="relative">
              <div
                className={`w-12 h-12 rounded-xl bg-emerald-950/80 border border-emerald-500/60 flex items-center justify-center text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.3)] transition-all ${
                  isPinging ? "ring-4 ring-emerald-500/50 scale-105" : ""
                }`}
              >
                <User className="w-6 h-6" />
              </div>
              {/* Radar pulse ping indicator */}
              <span className="absolute -top-1 -right-1 flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500" />
              </span>
            </div>

            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-extrabold text-white uppercase tracking-wider flex items-center gap-1.5">
                  TARGET PERSON: {currentSurvivor.name}
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-950/80 text-emerald-300 border border-emerald-500/40 font-bold">
                  COORDINATES ({targetPos[0]}, {targetPos[1]})
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded bg-[#00D1FF15] text-[#00D1FF] border border-[#00D1FF30]">
                  {currentSurvivor.freq}
                </span>
              </div>
              <p className="text-[11px] text-white/60 mt-0.5 flex items-center gap-2">
                <span>Condition: {currentSurvivor.condition}</span>
                <span className="text-white/30">•</span>
                <span className="text-amber-300/80">
                  Click any tile below with the locator tool to move this person
                </span>
              </p>
            </div>
          </div>

          {/* Quick Beacon Interaction Actions */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleTriggerPing}
              className={`px-3 py-1.5 rounded text-xs font-bold font-mono flex items-center gap-1.5 transition-all cursor-pointer border ${
                isPinging
                  ? "bg-emerald-500 text-black border-emerald-400 shadow-[0_0_15px_#10b981]"
                  : "bg-emerald-950/50 text-emerald-300 hover:bg-emerald-900/60 border-emerald-500/40"
              }`}
              title="Transmit acoustic/radio ping from missing person beacon"
            >
              <Radio className={`w-3.5 h-3.5 ${isPinging ? "animate-spin" : ""}`} />
              {isPinging ? "PINGING SOS..." : "PING BEACON"}
            </button>

            <button
              onClick={handleRandomizePerson}
              className="px-3 py-1.5 rounded text-xs font-mono font-bold bg-[#00D1FF15] hover:bg-[#00D1FF25] text-[#00D1FF] border border-[#00D1FF40] hover:border-[#00D1FF] flex items-center gap-1.5 cursor-pointer transition-all shadow-sm"
              title="Place the missing person at a random traversable coordinate"
            >
              <Shuffle className="w-3.5 h-3.5" />
              RELOCATE PERSON
            </button>
          </div>
        </div>

        {/* Live Radar Signal & Sensor Readouts */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3 pt-3 border-t border-[#ffffff10]">
          {/* Signal Strength RSSI */}
          <div className="p-2.5 rounded bg-black/60 border border-[#ffffff08]">
            <div className="flex items-center justify-between text-[10px] text-white/40 uppercase">
              <span className="flex items-center gap-1">
                <Signal className="w-3 h-3 text-[#00D1FF]" />
                Signal Strength (RSSI)
              </span>
              <span className="text-[#00D1FF] font-bold">{signalPercent}%</span>
            </div>
            <div className="w-full bg-white/10 h-1.5 rounded mt-1.5 overflow-hidden">
              <div
                className={`h-full transition-all duration-300 ${
                  signalPercent > 70
                    ? "bg-emerald-400 shadow-[0_0_8px_#10b981]"
                    : signalPercent > 40
                    ? "bg-amber-400"
                    : "bg-rose-400"
                }`}
                style={{ width: `${signalPercent}%` }}
              />
            </div>
            <span className="text-[9px] text-white/40 mt-1 block">
              {signalPercent > 75
                ? "Direct Line-of-Sight"
                : signalPercent > 45
                ? "Moderate Attenuation"
                : "Weak Penetration / High Noise"}
            </span>
          </div>

          {/* Compass Bearing */}
          <div className="p-2.5 rounded bg-black/60 border border-[#ffffff08]">
            <span className="text-[10px] text-white/40 uppercase block">Compass Bearing</span>
            <div className="flex items-center gap-2 mt-0.5">
              <Navigation
                className="w-4 h-4 text-[#00D1FF] transition-transform duration-300"
                style={{ transform: `rotate(${bearing.deg}deg)` }}
              />
              <span className="text-sm font-bold text-white">
                {bearing.cardinal} ({bearing.deg}°)
              </span>
            </div>
            <span className="text-[9px] text-white/40 mt-1 block">
              Vector: Δr={targetPos[0] - agentPos[0]}, Δc={targetPos[1] - agentPos[1]}
            </span>
          </div>

          {/* Distance in Grid Units / Est. Meters */}
          <div className="p-2.5 rounded bg-black/60 border border-[#ffffff08]">
            <span className="text-[10px] text-white/40 uppercase block">Distance to Person</span>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span className="text-sm font-bold text-white">
                {distToTarget.euclidean.toFixed(1)}
              </span>
              <span className="text-[10px] text-white/40">tiles (~{Math.round(distToTarget.euclidean * 10)}m)</span>
            </div>
            <span className="text-[9px] text-white/40 mt-1 block">
              Manhattan: {distToTarget.manhattan} steps minimum
            </span>
          </div>

          {/* Search Status */}
          <div className="p-2.5 rounded bg-black/60 border border-[#ffffff08]">
            <span className="text-[10px] text-white/40 uppercase block">Locator Status</span>
            <div className="flex items-center gap-1.5 mt-1">
              {simStatus === "goal_reached" ? (
                <span className="text-xs font-bold text-emerald-400 flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  LOCATED & RESCUED!
                </span>
              ) : isPlaying ? (
                <span className="text-xs font-bold text-[#00D1FF] flex items-center gap-1 animate-pulse">
                  <Crosshair className="w-3.5 h-3.5" />
                  HOMING IN ON BEACON...
                </span>
              ) : simStatus === "energy_depleted" ? (
                <span className="text-xs font-bold text-rose-400 flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  BATTERY DEPLETED
                </span>
              ) : (
                <span className="text-xs font-bold text-white/70 flex items-center gap-1">
                  <RadioTower className="w-3.5 h-3.5 text-emerald-400" />
                  BEACON LOCKED (READY)
                </span>
              )}
            </div>
            <span className="text-[9px] text-white/40 mt-1 block">
              Slip ε={(slipProb * 100).toFixed(0)}% compensated by MDP
            </span>
          </div>
        </div>
      </div>

      {/* Interactive Map Tool Palette & Playback Controls Bar */}
      <div className="bg-[#0a0a0a] border border-[#ffffff15] rounded-xl p-3 shadow-[0_0_20px_rgba(0,0,0,0.8)]">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Map Placement Tool Palette */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[10px] font-bold text-white/40 uppercase tracking-wider mr-1">
              Map Click Tool:
            </span>

            <button
              onClick={() => setActiveTool("locate_person")}
              className={`px-3 py-1.5 rounded text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 border ${
                activeTool === "locate_person"
                  ? "bg-emerald-500/20 text-emerald-300 border-emerald-400 shadow-[0_0_12px_rgba(16,185,129,0.3)]"
                  : "bg-black/50 text-white/70 border-[#ffffff15] hover:text-white hover:bg-white/5"
              }`}
              title="Click any cell on the map to relocate the missing person"
            >
              <User className="w-3.5 h-3.5 text-emerald-400" />
              LOCATE PERSON
            </button>

            <button
              onClick={() => setActiveTool("move_agent")}
              className={`px-3 py-1.5 rounded text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 border ${
                activeTool === "move_agent"
                  ? "bg-[#00D1FF20] text-[#00D1FF] border-[#00D1FF] shadow-[0_0_12px_rgba(0,209,255,0.3)]"
                  : "bg-black/50 text-white/70 border-[#ffffff15] hover:text-white hover:bg-white/5"
              }`}
              title="Click any cell on the map to reposition the autonomous search unit"
            >
              <Crosshair className="w-3.5 h-3.5 text-[#00D1FF]" />
              SEARCH UNIT (S)
            </button>

            <button
              onClick={() => setActiveTool("toggle_barrier")}
              className={`px-3 py-1.5 rounded text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 border ${
                activeTool === "toggle_barrier"
                  ? "bg-zinc-700/60 text-white border-zinc-400 shadow-[0_0_10px_rgba(255,255,255,0.15)]"
                  : "bg-black/50 text-white/70 border-[#ffffff15] hover:text-white hover:bg-white/5"
              }`}
              title="Click any cell to add or clear rubble debris"
            >
              <span className="text-xs">■</span>
              RUBBLE / WALL
            </button>

            <button
              onClick={() => setActiveTool("toggle_hazard")}
              className={`px-3 py-1.5 rounded text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 border ${
                activeTool === "toggle_hazard"
                  ? "bg-rose-950/60 text-rose-300 border-rose-500 shadow-[0_0_12px_rgba(244,63,94,0.3)]"
                  : "bg-black/50 text-white/70 border-[#ffffff15] hover:text-white hover:bg-white/5"
              }`}
              title="Click any cell to place or remove smoke/fire hazard"
            >
              <Flame className="w-3.5 h-3.5 text-rose-400" />
              HAZARD (-15)
            </button>

            <button
              onClick={() => setActiveTool("inspect")}
              className={`px-3 py-1.5 rounded text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 border ${
                activeTool === "inspect"
                  ? "bg-sky-500/20 text-sky-300 border-sky-400"
                  : "bg-black/50 text-white/70 border-[#ffffff15] hover:text-white hover:bg-white/5"
              }`}
              title="Click any cell to inspect Bellman value and slip probability"
            >
              <Eye className="w-3.5 h-3.5 text-sky-400" />
              INSPECT
            </button>
          </div>

          {/* Playback Execution Controls */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsPlaying((p) => !p)}
              disabled={simStatus === "goal_reached" || simStatus === "energy_depleted"}
              className={`px-3.5 py-1.5 rounded text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-all border ${
                isPlaying
                  ? "bg-amber-500/20 text-amber-300 border-amber-500/50 hover:bg-amber-500/30"
                  : "bg-[#00D1FF] hover:bg-[#33dbff] text-black border-[#00D1FF] shadow-[0_0_12px_rgba(0,209,255,0.3)]"
              } disabled:opacity-40 disabled:cursor-not-allowed`}
            >
              {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 fill-current" />}
              {isPlaying ? "PAUSE" : "START SEARCH"}
            </button>

            <button
              onClick={executeStep}
              disabled={isPlaying || simStatus === "goal_reached" || simStatus === "energy_depleted"}
              className="px-3 py-1.5 rounded text-xs bg-black/60 hover:bg-white/10 text-white/80 border border-[#ffffff15] flex items-center gap-1 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              title="Step forward 1 tick in stochastic environment"
            >
              <ArrowRight className="w-3.5 h-3.5" />
              STEP
            </button>

            <button
              onClick={() => handleResetRun()}
              className="px-3 py-1.5 rounded text-xs bg-black/60 hover:bg-white/10 text-white/70 hover:text-white border border-[#ffffff15] flex items-center gap-1 cursor-pointer"
              title="Reset Search Unit back to starting coordinates"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              RESET
            </button>

            <button
              onClick={initializeGrid}
              className="px-3 py-1.5 rounded text-xs bg-black/60 hover:bg-white/10 text-[#00D1FF] border border-[#00D1FF30] flex items-center gap-1 cursor-pointer"
              title="Generate new randomized maze topology"
            >
              <Shuffle className="w-3.5 h-3.5" />
              REBUILD MAP
            </button>
          </div>
        </div>

        {/* Live Search Telemetry Counters */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3 pt-3 border-t border-[#ffffff10]">
          <div className="p-2.5 rounded bg-black/50 border border-[#ffffff08]">
            <span className="block text-[10px] text-white/40 uppercase">Search Battery</span>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span className="text-base font-bold text-white">{stepsTaken}</span>
              <span className="text-[11px] text-white/40">/ {energyBudget} steps</span>
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
            <span className="block text-[10px] text-white/40 uppercase">Bellman Utility</span>
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
              find person: +100 | step: -1 | hazard: -15
            </span>
          </div>

          <div className="p-2.5 rounded bg-black/50 border border-[#ffffff08]">
            <span className="block text-[10px] text-white/40 uppercase">Optimal Next Move</span>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="text-sm font-bold text-[#00D1FF]">
                {policy[agentPos[0]]?.[agentPos[1]] || "TARGET REACHED"}
              </span>
              {policy[agentPos[0]]?.[agentPos[1]] && (
                <span className="text-sm text-white/70">
                  {DIR_ARROWS[policy[agentPos[0]][agentPos[1]]!]}
                </span>
              )}
            </div>
            <span className="text-[9px] text-white/40 block mt-1">
              V*(s) = {(values[agentPos[0]]?.[agentPos[1]] ?? 0).toFixed(1)}
            </span>
          </div>
        </div>
      </div>

      {/* Interactive Grid Canvas & Mission Telemetry */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* The Matrix Canvas */}
        <div className="lg:col-span-8 bg-[#0a0a0a] border border-[#ffffff15] rounded-xl p-4 flex flex-col items-center justify-center">
          {/* Active Tool Reminder Helper */}
          <div className="w-full mb-3 flex items-center justify-between text-xs text-white/60 bg-black/40 px-3 py-1.5 rounded border border-[#ffffff0a]">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold text-[#00D1FF] uppercase">
                Active Tool:
              </span>
              <span className="text-white font-bold">
                {activeTool === "locate_person" && "📍 Click any grid tile to relocate the Missing Person"}
                {activeTool === "move_agent" && "🚁 Click any grid tile to reposition the Search Unit"}
                {activeTool === "toggle_barrier" && "🧱 Click any tile to toggle Rubble Debris"}
                {activeTool === "toggle_hazard" && "🔥 Click any tile to toggle Thermal Hazard"}
                {activeTool === "inspect" && "🔍 Click or hover any tile to inspect state utility V*(s)"}
              </span>
            </div>
            <span className="text-[10px] text-white/40 hidden sm:inline">
              Terrain: {N}x{N} Matrix
            </span>
          </div>

          <div
            ref={gridContainerRef}
            className="relative inline-block max-w-full rounded-lg"
            onMouseLeave={() => setHoveredCell(null)}
          >
            <div
              className={`grid gap-1 bg-black/90 p-2 rounded-lg border border-[#ffffff15] shadow-inner max-w-full overflow-auto relative ${
                activeTool === "locate_person" || activeTool === "move_agent"
                  ? "cursor-crosshair"
                  : "cursor-pointer"
              }`}
              style={{
                gridTemplateColumns: `repeat(${N}, minmax(0, 1fr))`,
              }}
            >
              {grid.map((row, r) =>
                row.map((cellType, c) => {
                  const isAgent = agentPos[0] === r && agentPos[1] === c;
                  const isStart = startPos[0] === r && startPos[1] === c;
                  const isTarget = targetPos[0] === r && targetPos[1] === c;
                  const isObstacle = cellType === 1;
                  const isHazard = cellType === 2;

                  const isVisited = pathHistory.some(([pr, pc]) => pr === r && pc === c);
                  const val = values[r]?.[c] ?? 0;
                  const optimalDir = policy[r]?.[c];

                  // Value heatmap color
                  let cellBg = "bg-[#ffffff04]";
                  let cellExtraClass = "";
                  if (isObstacle) {
                    cellBg = "bg-[#18181b] border-[#ffffff15] shadow-none";
                  } else if (isHazard) {
                    cellBg = "hazard-swarm-cell text-rose-300";
                    cellExtraClass = "hazard-swarm-cell";
                  } else if (isTarget) {
                    cellBg = "bg-emerald-950/80 border-emerald-500 text-emerald-300 shadow-[0_0_15px_rgba(16,185,129,0.3)]";
                  } else if (isStart) {
                    cellBg = "bg-sky-950/70 border-sky-500/80 text-sky-300";
                  } else if (showHeatmap && !isObstacle && val !== 0) {
                    const norm = Math.max(0, Math.min(1, (val - minVal) / (maxVal - minVal || 1)));
                    if (norm > 0.65) cellBg = "bg-cyan-950/40 border-cyan-800/40";
                    else if (norm > 0.4) cellBg = "bg-blue-950/30 border-blue-900/30";
                    else cellBg = "bg-[#ffffff04] border-[#ffffff08]";
                  }

                  return (
                    <div
                      key={`${r}-${c}`}
                      data-cell={`${r}-${c}`}
                      onClick={() => handleCellClick(r, c)}
                      onMouseEnter={() => setHoveredCell([r, c])}
                      className={`relative w-8 h-8 sm:w-10 sm:h-10 rounded flex flex-col items-center justify-center text-[10px] font-bold border transition-all duration-150 select-none ${cellBg} ${cellExtraClass} ${
                        isVisited && !isObstacle && !isAgent && !isTarget
                          ? "shadow-[inset_0_0_6px_rgba(0,209,255,0.25)] border-[#00D1FF40]"
                          : ""
                      } hover:border-[#00D1FF80]`}
                      title={`Tile (${r}, ${c}) | V*(s)=${val.toFixed(1)} | Policy: ${optimalDir || "None"} | Click with active tool: ${activeTool}`}
                    >
                      {/* Shimmer overlay for active Stochastic Swarm hazards */}
                      {isHazard && <div className="hazard-swarm-shimmer" />}

                      {/* Obstacle Icon (Static rubble / rigid geometry) */}
                      {isObstacle && (
                        <div className="flex flex-col items-center justify-center pointer-events-none opacity-40">
                          <span className="text-zinc-400 text-[11px] font-mono leading-none">■</span>
                          <span className="text-[7px] text-zinc-500 font-mono tracking-tighter uppercase">WALL</span>
                        </div>
                      )}

                      {/* Stochastic Swarm Hazard Icon with Dynamic Pulse & Shimmer */}
                      {isHazard && !isAgent && !isTarget && (
                        <div className="relative flex items-center justify-center pointer-events-none z-10">
                          <span className="absolute w-2 h-2 rounded-full bg-rose-500/40 animate-ping" />
                          <Flame className="w-4 h-4 text-rose-300 drop-shadow-[0_0_6px_rgba(244,63,94,0.9)] animate-pulse" />
                          <span className="absolute -bottom-2 text-[7px] font-extrabold text-rose-400/90 font-mono uppercase tracking-tighter">
                            SWARM
                          </span>
                        </div>
                      )}

                      {/* Start Base Badge (if agent moved away) */}
                      {isStart && !isAgent && (
                        <span className="text-[10px] font-bold text-sky-400 font-mono">S</span>
                      )}

                      {/* Target Person Beacon Marker */}
                      {isTarget && !isAgent && (
                        <div className="relative flex items-center justify-center">
                          {/* Animated Sonar Radar Ripple */}
                          <span className="absolute -inset-1 rounded-full bg-emerald-400/30 animate-ping" />
                          <div className="w-6 h-6 rounded-full bg-emerald-500 text-black flex items-center justify-center text-xs shadow-[0_0_12px_#10b981] z-10 animate-bounce">
                            <User className="w-3.5 h-3.5 text-black stroke-[2.5]" />
                          </div>
                          {/* Floating SOS badge */}
                          <span className="absolute -top-3.5 px-1 py-0.2 bg-emerald-400 text-black text-[7px] font-extrabold rounded font-mono shadow-sm">
                            SOS
                          </span>
                        </div>
                      )}

                      {/* Optimal Directional Policy Arrow */}
                      {showPolicyArrows &&
                        optimalDir &&
                        !isObstacle &&
                        !isTarget &&
                        !isAgent && (
                          <span className="text-white/30 text-xs leading-none">
                            {DIR_ARROWS[optimalDir]}
                          </span>
                        )}

                      {/* Search Drone / Autonomous Agent Marker */}
                      {isAgent && (
                        <div className="w-6 h-6 rounded-full bg-[#00D1FF] text-black font-extrabold flex items-center justify-center text-xs shadow-[0_0_14px_#00D1FF] z-20 animate-pulse">
                          <Crosshair className="w-4 h-4 text-black stroke-[2.5]" />
                        </div>
                      )}

                      {/* Visited search trail breadcrumb dot */}
                      {isVisited && !isAgent && !isTarget && !isStart && (
                        <span className="absolute bottom-0.5 right-0.5 w-1.5 h-1.5 rounded-full bg-[#00D1FF]/60" />
                      )}
                    </div>
                  );
                })
              )}
            </div>

            {/* Dynamic Canvas-Based Path Heatmap Overlay targeting targetPos */}
            <CanvasPathHeatmapOverlay
              grid={grid}
              N={N}
              agentPos={agentPos}
              goalPos={targetPos}
              values={values}
              policy={policy}
              slipProb={slipProb}
              gamma={gamma}
              containerRef={gridContainerRef}
              hoveredCell={hoveredCell}
            />
          </div>

          {/* Canvas display toggles */}
          <div className="flex flex-wrap items-center gap-4 mt-3 text-xs text-white/60">
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
              Show Bellman State Values V*(s)
            </label>
          </div>
        </div>

        {/* Legend, Mathematical Formulation, & Real-time Telemetry Log */}
        <div className="lg:col-span-4 space-y-4">
          {/* Mission Map Legend */}
          <div className="bg-[#0a0a0a] border border-[#ffffff15] rounded-xl p-4 space-y-3">
            <h4 className="text-[11px] font-bold uppercase text-white/50 tracking-wider flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-[#00D1FF]" />
              Search & Rescue Map Legend
            </h4>
            <div className="grid grid-cols-2 gap-2 text-[11px]">
              <div className="flex items-center gap-2 p-1.5 rounded bg-black/40 border border-[#ffffff08]">
                <div className="w-4 h-4 rounded-full bg-[#00D1FF] flex items-center justify-center text-[9px] text-black font-bold">
                  A
                </div>
                <span className="text-white/80">Search Unit</span>
              </div>
              <div className="flex items-center gap-2 p-1.5 rounded bg-black/40 border border-[#ffffff08]">
                <div className="w-4 h-4 rounded-full bg-emerald-500 flex items-center justify-center text-[9px] text-black font-bold">
                  <User className="w-2.5 h-2.5" />
                </div>
                <span className="text-emerald-300 font-bold">Target Person</span>
              </div>
              <div className="flex items-center gap-2 p-1.5 rounded bg-black/40 border border-[#ffffff08]">
                <div className="w-3.5 h-3.5 rounded bg-zinc-800 border border-zinc-600 flex items-center justify-center text-[8px] text-zinc-400 font-bold">
                  ■
                </div>
                <div className="flex flex-col">
                  <span className="text-white/80 font-medium">Static Obstacle</span>
                  <span className="text-[9px] text-zinc-500">Rigid wall / barrier</span>
                </div>
              </div>
              <div className="flex items-center gap-2 p-1.5 rounded bg-rose-950/30 border border-rose-500/40">
                <div className="w-3.5 h-3.5 rounded hazard-swarm-cell flex items-center justify-center text-[9px] text-rose-300">
                  🔥
                </div>
                <div className="flex flex-col">
                  <span className="text-rose-300 font-bold flex items-center gap-1">
                    Stochastic Swarm
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-ping" />
                  </span>
                  <span className="text-[9px] text-rose-400/80">Pulsing hazard (-15)</span>
                </div>
              </div>
            </div>
          </div>

          {/* Stochastic Bellman Equation Explained */}
          <div className="bg-[#0a0a0a] border border-[#ffffff15] rounded-xl p-4 space-y-2">
            <h4 className="text-[11px] font-bold uppercase text-[#00D1FF] tracking-wider">
              Stochastic Slip & Bellman Equation
            </h4>
            <div className="p-2.5 rounded bg-black/60 border border-[#ffffff08] text-[11px] text-white/70 space-y-1 font-mono">
              <div className="text-[#00D1FF] font-semibold">
                V*(s) = max_a [ R(s,a) + γ ∑ P(s'|s,a) V*(s') ]
              </div>
              <div className="text-white/50 text-[10px] mt-1 leading-relaxed">
                P(intended toward person) = 1 - 2ε = {(1 - 2 * slipProb).toFixed(2)}
                <br />
                P(orthogonal wind/ice slip) = ε = {slipProb.toFixed(2)}
                <br />
                Target coordinates: ({targetPos[0]}, {targetPos[1]})
              </div>
            </div>
            <p className="text-[10px] text-white/50 leading-relaxed">
              The agent chooses paths that maximize safety margin around cliffs and hazards, ensuring arrival at the person despite stochastic terrain drift.
            </p>
          </div>

          {/* Real-time Telemetry Event Log */}
          <div className="bg-[#0a0a0a] border border-[#ffffff15] rounded-xl p-4 space-y-2">
            <span className="text-[10px] font-bold uppercase text-white/40 tracking-wider block">
              Search Telemetry & Radio Log
            </span>
            <div className="p-3 rounded bg-black/80 border border-[#ffffff10] text-[11px] text-white/80 leading-relaxed min-h-[72px] flex items-center">
              <p className="font-mono text-emerald-400/90">{lastEvent}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Custom Map Upload & Archetypes Manager */}
      <MapUploadManager
        currentGrid={grid}
        currentDimension={N}
        startPos={startPos}
        targetPos={targetPos}
        onApplyMap={(newMap) => {
          setGrid(newMap.grid);
          setStartPos(newMap.startPos);
          setTargetPos(newMap.targetPos);
          setAgentPos(newMap.startPos);
          setPathHistory([newMap.startPos]);
          setActionSequence([]);
          setStepsTaken(0);
          setSlipsCount(0);
          setAccumulatedReward(0);
          setSimStatus("idle");
          solveValueIteration(
            newMap.grid,
            newMap.startPos[0],
            newMap.startPos[1],
            newMap.targetPos[0],
            newMap.targetPos[1]
          );
          setLastEvent(`Loaded custom map "${newMap.name}" (${newMap.dimension}x${newMap.dimension})! Bellman policy recomputed.`);
        }}
      />

      {/* Recent Optimal Paths Saved (Last 5 sequences from Firestore / Local) */}
      <RecentPathsList
        refreshTrigger={refreshPathsTrigger}
        onLoadPath={(savedPath) => {
          setStartPos(savedPath.startPos);
          setTargetPos(savedPath.targetPos);
          setAgentPos(savedPath.startPos);
          setPathHistory(savedPath.pathCoordinates);
          setStepsTaken(savedPath.stepsCount);
          setSlipsCount(savedPath.slipsCount);
          setAccumulatedReward(savedPath.accumulatedReward);
          setSimStatus("goal_reached");
          setLastEvent(`Replaying mission path "${savedPath.survivorName}" (${savedPath.stepsCount} steps, ${savedPath.slipsCount} slips).`);
        }}
      />
    </div>
  );
}
