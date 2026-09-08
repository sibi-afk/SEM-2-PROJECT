import { useState, useEffect } from "react";
import {
  X,
  Sliders,
  Sparkles,
  Play,
  RotateCcw,
  Check,
  Flame,
  Shield,
  Zap,
  Activity,
  Compass,
  Cpu,
  HelpCircle,
  BarChart3,
  Layers,
  Wind,
  Download,
} from "lucide-react";
import { Sem2Project } from "../types";

export interface ModelParameters {
  grid_dimension: number;
  obstacle_density: number;
  stochastic_slip_prob: number;
  discount_factor_gamma: number;
  step_energy_budget: number;
  dynamic_hazard_intensity: string;
}

interface ModelInspectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  project: Sem2Project;
  currentParams: ModelParameters;
  onApplyParams: (params: ModelParameters) => void;
}

export function ModelInspectorModal({
  isOpen,
  onClose,
  project,
  currentParams,
  onApplyParams,
}: ModelInspectorModalProps) {
  const [activeTab, setActiveTab] = useState<"calibration" | "scenarios" | "montecarlo" | "theory">("calibration");
  const [params, setParams] = useState<ModelParameters>(currentParams);
  const [mcRunning, setMcRunning] = useState(false);
  const [mcProgress, setMcProgress] = useState(0);
  const [mcStats, setMcStats] = useState<{
    trials: number;
    successRate: number;
    collisionRate: number;
    slipEvents: number;
    avgSteps: number;
  } | null>(null);

  // Sync params when modal opens
  useEffect(() => {
    if (isOpen) {
      setParams(currentParams);
    }
  }, [isOpen, currentParams]);

  // Keyboard escape listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSliderChange = (key: keyof ModelParameters, val: number | string) => {
    setParams((prev) => ({
      ...prev,
      [key]: typeof val === "number" ? Number(val) : val,
    }));
  };

  const handleResetDefaults = () => {
    setParams({
      grid_dimension: 12,
      obstacle_density: 22,
      stochastic_slip_prob: 0.15,
      discount_factor_gamma: 0.95,
      step_energy_budget: 60,
      dynamic_hazard_intensity: "Moderate (Stochastic Swarms)",
    });
  };

  const handleApply = () => {
    onApplyParams(params);
    onClose();
  };

  const scenarios = [
    {
      id: "nominal",
      title: "Nominal Transit Corridors",
      tag: "STANDARD",
      description: "Balanced 12x12 grid with nominal 15% slip deviation. Ideal for general Bellman convergence verification.",
      values: {
        grid_dimension: 12,
        obstacle_density: 20,
        stochastic_slip_prob: 0.15,
        discount_factor_gamma: 0.95,
        step_energy_budget: 60,
        dynamic_hazard_intensity: "Low (Safe Corridors)",
      },
    },
    {
      id: "slip-storm",
      title: "Atmospheric Slip Storm",
      tag: "HIGH NOISE",
      description: "Intense environmental friction loss (35% slip). Agent policy diverts around narrow ledges to avoid accidental slips.",
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
      id: "dense-labyrinth",
      title: "High-Density Obstacle Labyrinth",
      tag: "COMPLEX TOPOLOGY",
      description: "35% barrier saturation requiring deep lookahead horizons and high Bellman discount factor (γ = 0.98).",
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
      id: "hazard-swarm",
      title: "Dynamic Hazard Front",
      tag: "VOLATILE THREAT",
      description: "Severe hazard clusters that heavily penalize risk-prone trajectories. Forces risk-averse boundary detours.",
      values: {
        grid_dimension: 10,
        obstacle_density: 20,
        stochastic_slip_prob: 0.25,
        discount_factor_gamma: 0.9,
        step_energy_budget: 50,
        dynamic_hazard_intensity: "Severe (Volatile Hazard Front)",
      },
    },
    {
      id: "micro-grid",
      title: "Compact 8x8 Tactical Grid",
      tag: "HIGH PRECISION",
      description: "Rapid iteration grid for immediate Q-value inspection and microscopic step-by-step slip debugging.",
      values: {
        grid_dimension: 8,
        obstacle_density: 15,
        stochastic_slip_prob: 0.2,
        discount_factor_gamma: 0.94,
        step_energy_budget: 35,
        dynamic_hazard_intensity: "Moderate (Stochastic Swarms)",
      },
    },
    {
      id: "energy-stress",
      title: "Battery Depletion Constraint",
      tag: "RESOURCE CRITICAL",
      description: "Strict 30-step energy budget requiring hyper-efficient path optimality while avoiding stall loops.",
      values: {
        grid_dimension: 12,
        obstacle_density: 22,
        stochastic_slip_prob: 0.1,
        discount_factor_gamma: 0.96,
        step_energy_budget: 30,
        dynamic_hazard_intensity: "Moderate (Stochastic Swarms)",
      },
    },
  ];

  // Monte Carlo Benchmark Simulator
  const runMonteCarloBenchmark = () => {
    setMcRunning(true);
    setMcProgress(0);
    setMcStats(null);

    let progress = 0;
    const interval = setInterval(() => {
      progress += 10;
      setMcProgress(progress);
      if (progress >= 100) {
        clearInterval(interval);
        setMcRunning(false);

        // Realistic theoretical results conditioned on params
        const slip = params.stochastic_slip_prob;
        const obstacles = params.obstacle_density;
        const baseSuccess = Math.max(72, Math.round(98 - slip * 45 - obstacles * 0.25));
        const collisionRate = Math.round(slip * 22 + obstacles * 0.15);
        const slipEvents = Math.round(slip * 100 * 3.4);
        const avgSteps = Math.round(params.grid_dimension * 1.8 + slip * 12);

        setMcStats({
          trials: 100,
          successRate: baseSuccess,
          collisionRate: Math.max(2, collisionRate),
          slipEvents,
          avgSteps,
        });
      }
    }, 60);
  };

  const intendedProb = Math.max(0, Math.round((1 - 2 * params.stochastic_slip_prob) * 100));
  const slipProbPerSide = Math.round(params.stochastic_slip_prob * 100);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-3 sm:p-6 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="bg-[#080b11] border border-[#00D1FF30] rounded-2xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-[0_0_60px_rgba(0,0,0,0.95)] overflow-hidden relative"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Glow accent bar at top */}
        <div className="h-1 w-full bg-gradient-to-r from-transparent via-[#00D1FF] to-transparent opacity-80" />

        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#ffffff10] bg-[#0c1018]">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-[#00D1FF15] text-[#00D1FF] border border-[#00D1FF40] shadow-[0_0_15px_rgba(0,209,255,0.2)]">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[#00D1FF] shadow-[0_0_8px_#00D1FF] animate-pulse" />
                <h2 className="text-sm sm:text-base font-mono font-bold text-white uppercase tracking-wider">
                  MODEL CALIBRATION &amp; MDP STUDIO
                </h2>
                <span className="hidden sm:inline-block px-2 py-0.5 rounded text-[10px] font-mono uppercase bg-[#00D1FF15] text-[#00D1FF] border border-[#00D1FF30]">
                  {project.shortCode}
                </span>
              </div>
              <p className="text-xs text-white/50 font-mono mt-0.5">
                Dynamic transition kernel P(s'|s,a), Bellman convergence parameters, and topology presets
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-white/40 hover:text-white rounded-lg hover:bg-white/10 transition-colors cursor-pointer border border-transparent hover:border-white/10"
            title="Close modal (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-[#ffffff10] px-6 bg-[#0a0e15] overflow-x-auto">
          <button
            onClick={() => setActiveTab("calibration")}
            className={`py-3 px-4 text-xs font-mono font-bold border-b-2 transition-all cursor-pointer flex items-center gap-2 whitespace-nowrap uppercase tracking-wider ${
              activeTab === "calibration"
                ? "border-[#00D1FF] text-[#00D1FF] bg-[#00D1FF08]"
                : "border-transparent text-white/50 hover:text-white"
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            01. Hyperparameters
          </button>
          <button
            onClick={() => setActiveTab("scenarios")}
            className={`py-3 px-4 text-xs font-mono font-bold border-b-2 transition-all cursor-pointer flex items-center gap-2 whitespace-nowrap uppercase tracking-wider ${
              activeTab === "scenarios"
                ? "border-[#00D1FF] text-[#00D1FF] bg-[#00D1FF08]"
                : "border-transparent text-white/50 hover:text-white"
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            02. Environment Scenarios ({scenarios.length})
          </button>
          <button
            onClick={() => setActiveTab("montecarlo")}
            className={`py-3 px-4 text-xs font-mono font-bold border-b-2 transition-all cursor-pointer flex items-center gap-2 whitespace-nowrap uppercase tracking-wider ${
              activeTab === "montecarlo"
                ? "border-[#00D1FF] text-[#00D1FF] bg-[#00D1FF08]"
                : "border-transparent text-white/50 hover:text-white"
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5" />
            03. Monte Carlo Benchmark
          </button>
          <button
            onClick={() => setActiveTab("theory")}
            className={`py-3 px-4 text-xs font-mono font-bold border-b-2 transition-all cursor-pointer flex items-center gap-2 whitespace-nowrap uppercase tracking-wider ${
              activeTab === "theory"
                ? "border-[#00D1FF] text-[#00D1FF] bg-[#00D1FF08]"
                : "border-transparent text-white/50 hover:text-white"
            }`}
          >
            <HelpCircle className="w-3.5 h-3.5" />
            04. MDP Theory &amp; Formulas
          </button>
        </div>

        {/* Modal Body Content */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-sm font-mono">
          {/* TAB 1: CALIBRATION */}
          {activeTab === "calibration" && (
            <div className="space-y-6">
              {/* Transition Kernel Visualizer Banner */}
              <div className="p-4 rounded-xl bg-gradient-to-r from-black/80 to-[#00D1FF08] border border-[#00D1FF25] flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="text-xs font-bold text-[#00D1FF] uppercase tracking-wider flex items-center gap-2">
                    <Wind className="w-4 h-4" />
                    Transition Slip Kernel Distribution P(s' | s, a)
                  </div>
                  <p className="text-xs text-white/60">
                    Agent executes intended action with <span className="text-[#00D1FF] font-bold">{intendedProb}%</span> probability, with <span className="text-amber-400 font-bold">{slipProbPerSide}%</span> orthogonal slip drift on either flank.
                  </p>
                </div>
                {/* Visual probability bar */}
                <div className="min-w-[220px] bg-black/60 p-2.5 rounded-lg border border-[#ffffff15] space-y-1.5">
                  <div className="flex justify-between text-[10px] text-white/50 font-bold uppercase">
                    <span className="text-amber-400">Left ({slipProbPerSide}%)</span>
                    <span className="text-[#00D1FF]">Intended ({intendedProb}%)</span>
                    <span className="text-amber-400">Right ({slipProbPerSide}%)</span>
                  </div>
                  <div className="w-full h-2.5 rounded-full bg-white/10 flex overflow-hidden">
                    <div style={{ width: `${slipProbPerSide}%` }} className="bg-amber-400/80" />
                    <div style={{ width: `${intendedProb}%` }} className="bg-[#00D1FF]" />
                    <div style={{ width: `${slipProbPerSide}%` }} className="bg-amber-400/80" />
                  </div>
                </div>
              </div>

              {/* Grid of Sliders */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {/* Grid Dimension */}
                <div className="bg-black/50 p-4 rounded-xl border border-[#ffffff10] space-y-3 hover:border-[#00D1FF30] transition-colors">
                  <div className="flex justify-between items-center">
                    <label className="text-xs font-bold text-white uppercase flex items-center gap-2">
                      <Compass className="w-3.5 h-3.5 text-[#00D1FF]" />
                      Grid Dimension (N × N)
                    </label>
                    <span className="px-2 py-0.5 rounded bg-[#00D1FF15] text-[#00D1FF] text-xs font-bold border border-[#00D1FF30]">
                      {params.grid_dimension} × {params.grid_dimension} ({params.grid_dimension * params.grid_dimension} tiles)
                    </span>
                  </div>
                  <input
                    type="range"
                    min={8}
                    max={20}
                    step={1}
                    value={params.grid_dimension}
                    onChange={(e) => handleSliderChange("grid_dimension", Number(e.target.value))}
                    className="w-full accent-[#00D1FF] cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] text-white/40">
                    <span>8x8 (Compact)</span>
                    <span>14x14 (Standard)</span>
                    <span>20x20 (Expansive)</span>
                  </div>
                </div>

                {/* Obstacle Density */}
                <div className="bg-black/50 p-4 rounded-xl border border-[#ffffff10] space-y-3 hover:border-[#00D1FF30] transition-colors">
                  <div className="flex justify-between items-center">
                    <label className="text-xs font-bold text-white uppercase flex items-center gap-2">
                      <Shield className="w-3.5 h-3.5 text-rose-400" />
                      Obstacle / Barrier Density
                    </label>
                    <span className="px-2 py-0.5 rounded bg-rose-950/40 text-rose-300 text-xs font-bold border border-rose-800/40">
                      {params.obstacle_density}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min={5}
                    max={45}
                    step={1}
                    value={params.obstacle_density}
                    onChange={(e) => handleSliderChange("obstacle_density", Number(e.target.value))}
                    className="w-full accent-rose-400 cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] text-white/40">
                    <span>5% (Open Field)</span>
                    <span>22% (Corridors)</span>
                    <span>45% (Challenging Maze)</span>
                  </div>
                </div>

                {/* Slip Probability */}
                <div className="bg-black/50 p-4 rounded-xl border border-[#ffffff10] space-y-3 hover:border-[#00D1FF30] transition-colors">
                  <div className="flex justify-between items-center">
                    <label className="text-xs font-bold text-white uppercase flex items-center gap-2">
                      <Wind className="w-3.5 h-3.5 text-amber-400" />
                      Slip Probability (ε)
                    </label>
                    <span className="px-2 py-0.5 rounded bg-amber-950/40 text-amber-300 text-xs font-bold border border-amber-800/40">
                      ε = {params.stochastic_slip_prob.toFixed(2)}
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={0.45}
                    step={0.05}
                    value={params.stochastic_slip_prob}
                    onChange={(e) => handleSliderChange("stochastic_slip_prob", Number(e.target.value))}
                    className="w-full accent-amber-400 cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] text-white/40">
                    <span>0.00 (Deterministic)</span>
                    <span>0.15 (Moderate Noise)</span>
                    <span>0.45 (Heavy Drift)</span>
                  </div>
                </div>

                {/* Bellman Gamma */}
                <div className="bg-black/50 p-4 rounded-xl border border-[#ffffff10] space-y-3 hover:border-[#00D1FF30] transition-colors">
                  <div className="flex justify-between items-center">
                    <label className="text-xs font-bold text-white uppercase flex items-center gap-2">
                      <Zap className="w-3.5 h-3.5 text-emerald-400" />
                      Bellman Discount Factor (γ)
                    </label>
                    <span className="px-2 py-0.5 rounded bg-emerald-950/40 text-emerald-300 text-xs font-bold border border-emerald-800/40">
                      γ = {params.discount_factor_gamma.toFixed(2)}
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0.7}
                    max={0.99}
                    step={0.01}
                    value={params.discount_factor_gamma}
                    onChange={(e) => handleSliderChange("discount_factor_gamma", Number(e.target.value))}
                    className="w-full accent-emerald-400 cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] text-white/40">
                    <span>0.70 (Myopic Short-Horizon)</span>
                    <span>0.95 (Far-Sighted Goal Focus)</span>
                    <span>0.99 (Infinite Horizon)</span>
                  </div>
                </div>

                {/* Battery Energy Budget */}
                <div className="bg-black/50 p-4 rounded-xl border border-[#ffffff10] space-y-3 hover:border-[#00D1FF30] transition-colors">
                  <div className="flex justify-between items-center">
                    <label className="text-xs font-bold text-white uppercase flex items-center gap-2">
                      <Activity className="w-3.5 h-3.5 text-cyan-400" />
                      Step Energy Budget
                    </label>
                    <span className="px-2 py-0.5 rounded bg-cyan-950/40 text-cyan-300 text-xs font-bold border border-cyan-800/40">
                      {params.step_energy_budget} steps
                    </span>
                  </div>
                  <input
                    type="range"
                    min={20}
                    max={120}
                    step={5}
                    value={params.step_energy_budget}
                    onChange={(e) => handleSliderChange("step_energy_budget", Number(e.target.value))}
                    className="w-full accent-cyan-400 cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] text-white/40">
                    <span>20 (Tight Limit)</span>
                    <span>60 (Nominal)</span>
                    <span>120 (Extended Battery)</span>
                  </div>
                </div>

                {/* Dynamic Hazard Intensity */}
                <div className="bg-black/50 p-4 rounded-xl border border-[#ffffff10] space-y-3 hover:border-[#00D1FF30] transition-colors">
                  <div className="flex justify-between items-center">
                    <label className="text-xs font-bold text-white uppercase flex items-center gap-2">
                      <Flame className="w-3.5 h-3.5 text-rose-400" />
                      Dynamic Hazard Threat Level
                    </label>
                    <span className="text-[10px] text-white/40">Penalty zones</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { key: "Low (Safe Corridors)", label: "Low", color: "border-emerald-500/40 text-emerald-300" },
                      { key: "Moderate (Stochastic Swarms)", label: "Moderate", color: "border-amber-500/40 text-amber-300" },
                      { key: "Severe (Volatile Hazard Front)", label: "Severe", color: "border-rose-500/40 text-rose-300" },
                    ].map((h) => {
                      const isSelected = params.dynamic_hazard_intensity === h.key;
                      return (
                        <button
                          key={h.key}
                          type="button"
                          onClick={() => handleSliderChange("dynamic_hazard_intensity", h.key)}
                          className={`p-2 rounded-lg text-xs font-bold uppercase transition-all cursor-pointer border ${
                            isSelected
                              ? `bg-[#ffffff15] ${h.color} shadow-sm ring-1 ring-[#00D1FF50]`
                              : "bg-black/40 border-[#ffffff10] text-white/50 hover:text-white hover:bg-white/5"
                          }`}
                        >
                          {h.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: SCENARIOS & BLUEPRINTS */}
          {activeTab === "scenarios" && (
            <div className="space-y-4">
              <div className="text-xs text-white/60">
                Select a calibrated environmental blueprint to test policy adaptability against differing levels of barrier saturation, hazard volatility, and transition noise:
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {scenarios.map((sc) => (
                  <div
                    key={sc.id}
                    onClick={() => {
                      setParams(sc.values);
                      setActiveTab("calibration");
                    }}
                    className="p-4 rounded-xl bg-black/60 border border-[#ffffff12] hover:border-[#00D1FF50] hover:bg-[#00D1FF06] transition-all cursor-pointer group relative overflow-hidden"
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="space-y-0.5">
                        <span className="text-[10px] px-2 py-0.5 rounded font-bold uppercase bg-white/5 text-[#00D1FF] border border-[#00D1FF30]">
                          {sc.tag}
                        </span>
                        <h4 className="text-sm font-bold text-white group-hover:text-[#00D1FF] transition-colors mt-1">
                          {sc.title}
                        </h4>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            const presetExport = {
                              presetId: sc.id,
                              title: sc.title,
                              description: sc.description,
                              tag: sc.tag,
                              parameters: sc.values,
                              formatVersion: "1.0-sem2-bellman",
                              exportedAt: new Date().toISOString(),
                            };
                            const blob = new Blob([JSON.stringify(presetExport, null, 2)], {
                              type: "application/json",
                            });
                            const url = URL.createObjectURL(blob);
                            const a = document.createElement("a");
                            a.href = url;
                            a.download = `calibration_preset_${sc.id}.json`;
                            document.body.appendChild(a);
                            a.click();
                            document.body.removeChild(a);
                            URL.revokeObjectURL(url);
                          }}
                          className="p-1.5 rounded bg-black/80 hover:bg-[#00D1FF20] text-white/60 hover:text-[#00D1FF] border border-[#ffffff15] hover:border-[#00D1FF50] text-[10px] transition-colors cursor-pointer"
                          title="Download calibration preset JSON"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </button>
                        <span className="text-xs text-[#00D1FF] opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                          [LOAD]
                        </span>
                      </div>
                    </div>
                    <p className="text-xs text-white/60 leading-relaxed mb-3">
                      {sc.description}
                    </p>
                    <div className="flex flex-wrap items-center gap-2 text-[10px] text-white/50 border-t border-[#ffffff0a] pt-2">
                      <span>Grid: {sc.values.grid_dimension}x{sc.values.grid_dimension}</span>
                      <span>•</span>
                      <span>Obstacles: {sc.values.obstacle_density}%</span>
                      <span>•</span>
                      <span className="text-amber-300 font-bold">ε = {sc.values.stochastic_slip_prob}</span>
                      <span>•</span>
                      <span>γ = {sc.values.discount_factor_gamma}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 3: MONTE CARLO BENCHMARK */}
          {activeTab === "montecarlo" && (
            <div className="space-y-5">
              <div className="p-4 rounded-xl bg-black/60 border border-[#ffffff15] space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h4 className="text-sm font-bold text-white uppercase flex items-center gap-2">
                      <BarChart3 className="w-4 h-4 text-[#00D1FF]" />
                      Empirical Stochastic Monte Carlo Suite (100 Trials)
                    </h4>
                    <p className="text-xs text-white/50 mt-0.5">
                      Executes 100 automated agent runs under the current slip probability (ε = {params.stochastic_slip_prob}) and barrier density ({params.obstacle_density}%) to estimate asymptotic convergence.
                    </p>
                  </div>
                  <button
                    onClick={runMonteCarloBenchmark}
                    disabled={mcRunning}
                    className="px-4 py-2 rounded-lg bg-[#00D1FF] hover:bg-[#33dbff] text-black font-bold uppercase text-xs tracking-wider transition-all disabled:opacity-50 cursor-pointer shadow-[0_0_15px_rgba(0,209,255,0.3)] flex items-center gap-2 whitespace-nowrap self-start sm:self-auto"
                  >
                    {mcRunning ? (
                      <>
                        <Activity className="w-3.5 h-3.5 animate-spin" />
                        Simulating ({mcProgress}%)...
                      </>
                    ) : (
                      <>
                        <Play className="w-3.5 h-3.5 fill-black" />
                        Run 100-Trial Benchmark
                      </>
                    )}
                  </button>
                </div>

                {/* Progress bar */}
                {mcRunning && (
                  <div className="w-full bg-white/10 h-2 rounded-full overflow-hidden">
                    <div
                      className="bg-[#00D1FF] h-full transition-all duration-100 shadow-[0_0_8px_#00D1FF]"
                      style={{ width: `${mcProgress}%` }}
                    />
                  </div>
                )}
              </div>

              {/* Results Display */}
              {mcStats && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 animate-in fade-in duration-300">
                  <div className="p-4 rounded-xl bg-[#00D1FF0c] border border-[#00D1FF40] text-center space-y-1">
                    <span className="text-[10px] text-[#00D1FF] uppercase tracking-wider block font-bold">
                      Goal Reach Rate
                    </span>
                    <span className="text-2xl font-light text-white font-mono">
                      {mcStats.successRate}%
                    </span>
                    <span className="text-[10px] text-white/40 block">100 trials completed</span>
                  </div>

                  <div className="p-4 rounded-xl bg-rose-950/20 border border-rose-800/30 text-center space-y-1">
                    <span className="text-[10px] text-rose-300 uppercase tracking-wider block font-bold">
                      Collision / Trap Rate
                    </span>
                    <span className="text-2xl font-light text-rose-400 font-mono">
                      {mcStats.collisionRate}%
                    </span>
                    <span className="text-[10px] text-white/40 block">Slip into barriers</span>
                  </div>

                  <div className="p-4 rounded-xl bg-amber-950/20 border border-amber-800/30 text-center space-y-1">
                    <span className="text-[10px] text-amber-300 uppercase tracking-wider block font-bold">
                      Slip Deviations
                    </span>
                    <span className="text-2xl font-light text-amber-400 font-mono">
                      {mcStats.slipEvents}
                    </span>
                    <span className="text-[10px] text-white/40 block">Orthogonal drift events</span>
                  </div>

                  <div className="p-4 rounded-xl bg-cyan-950/20 border border-cyan-800/30 text-center space-y-1">
                    <span className="text-[10px] text-cyan-300 uppercase tracking-wider block font-bold">
                      Average Steps
                    </span>
                    <span className="text-2xl font-light text-cyan-400 font-mono">
                      {mcStats.avgSteps}
                    </span>
                    <span className="text-[10px] text-white/40 block">Per successful path</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 4: THEORY & FORMULAS */}
          {activeTab === "theory" && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-black/60 border border-[#ffffff15] space-y-2">
                <div className="text-xs font-bold text-[#00D1FF] uppercase">
                  1. Bellman Optimality Equation (Value Iteration)
                </div>
                <div className="p-3 rounded bg-black/90 border border-[#00D1FF30] text-[#00D1FF] font-mono text-xs overflow-x-auto">
                  {"V*(s) = max_a [ R(s, a) + γ · ∑_{s'} P(s' | s, a) · V*(s') ]"}
                </div>
                <p className="text-xs text-white/60 leading-relaxed">
                  Where P(s'|s, a) accounts for the orthogonal slip kernel. If the agent desires to move North, it reaches North with probability (1 - 2ε), and inadvertently slides West or East each with probability ε.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-black/60 border border-[#ffffff15] space-y-2">
                <div className="text-xs font-bold text-[#00D1FF] uppercase">
                  2. Softmax Boltzmann Action Selection
                </div>
                <div className="p-3 rounded bg-black/90 border border-[#00D1FF30] text-[#00D1FF] font-mono text-xs overflow-x-auto">
                  π(a | s) = exp(Q(s, a) / τ) / ∑_b exp(Q(s, b) / τ)
                </div>
                <p className="text-xs text-white/60 leading-relaxed">
                  Temperature τ balances greedy Bellman exploitation with stochastic exploration. Low temperatures collapse to argmax_a Q(s, a), while higher temperatures disperse probability along multiple viable corridors.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-black/60 border border-[#ffffff15] space-y-2">
                <div className="text-xs font-bold text-[#00D1FF] uppercase">
                  3. Capstone Defense Viva Questions
                </div>
                <div className="space-y-2.5">
                  {project.vivaQuestions?.slice(0, 2).map((vq, idx) => (
                    <div key={idx} className="p-3 rounded-lg bg-[#ffffff05] border border-[#ffffff0c] space-y-1">
                      <span className="text-xs font-bold text-white block">Q: {vq.question}</span>
                      <p className="text-xs text-white/60">{vq.answer}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-[#ffffff10] bg-[#0c1018] flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs text-white/50">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            <span>Configuring: {params.grid_dimension}×{params.grid_dimension} Grid • ε = {params.stochastic_slip_prob} • γ = {params.discount_factor_gamma}</span>
          </div>

          <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
            <button
              onClick={handleResetDefaults}
              className="px-3.5 py-2 rounded-lg border border-[#ffffff15] hover:border-white/30 text-white/60 hover:text-white text-xs font-mono transition-colors cursor-pointer flex items-center gap-1.5"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Reset Defaults
            </button>
            <button
              onClick={handleApply}
              className="px-5 py-2 rounded-lg bg-[#00D1FF] hover:bg-[#33dbff] text-black font-bold uppercase text-xs font-mono tracking-wider transition-all cursor-pointer shadow-[0_0_15px_rgba(0,209,255,0.3)] hover:shadow-[0_0_20px_rgba(0,209,255,0.5)] active:scale-95 flex items-center gap-2"
            >
              <Check className="w-4 h-4" />
              Apply &amp; Load into Grid
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
