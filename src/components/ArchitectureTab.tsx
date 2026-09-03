import { useState } from "react";
import { GitCommit, Settings2, Sliders, BarChart3, CheckSquare } from "lucide-react";
import { Sem2Project } from "../types";
import { NetworkArchitectureD3 } from "./NetworkArchitectureD3";

interface ArchitectureTabProps {
  project: Sem2Project;
}

export function ArchitectureTab({ project }: ArchitectureTabProps) {
  const [learningRate, setLearningRate] = useState("0.001");
  const [nEstimators, setNEstimators] = useState(100);
  const [batchSize, setBatchSize] = useState(32);
  const [testSplit, setTestSplit] = useState(20);

  return (
    <div className="space-y-6">
      {/* Interactive D3.js Network Architecture Visualization */}
      <NetworkArchitectureD3 project={project} batchSize={batchSize} />

      {/* Pipeline Stage Cards */}
      <div className="bg-[#0a0a0a] border border-[#ffffff10] rounded-xl p-5 shadow-[0_0_20px_rgba(0,0,0,0.8)] space-y-4">
        <div className="flex items-center justify-between border-b border-[#ffffff10] pb-3">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-[#00D1FF] shadow-[0_0_6px_#00D1FF]" />
            <h3 className="text-xs font-mono font-bold uppercase tracking-widest text-white">
              DATAFLOW & PREPROCESSING PIPELINE CHANNELS
            </h3>
          </div>
          <span className="text-[10px] font-mono text-[#00D1FF] bg-[#00D1FF10] px-2 py-0.5 rounded border border-[#00D1FF30]">
            SEMESTER 2 CAPSTONE
          </span>
        </div>

        {/* Pipeline Nodes */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-1">
          <div className="p-3 rounded bg-[#ffffff05] border border-[#ffffff10] space-y-1 relative">
            <span className="text-[10px] font-mono font-bold text-[#00D1FF] uppercase tracking-wider">
              01 // INGESTION
            </span>
            <h4 className="text-xs font-semibold text-white">Missing Value Imputation</h4>
            <p className="text-[11px] text-white/50 leading-relaxed font-mono">
              Median/mode imputation with IQR suppression and duplicate purging.
            </p>
          </div>

          <div className="p-3 rounded bg-[#ffffff05] border border-[#ffffff10] space-y-1 relative">
            <span className="text-[10px] font-mono font-bold text-[#00D1FF] uppercase tracking-wider">
              02 // PREPROCESS
            </span>
            <h4 className="text-xs font-semibold text-white">Feature Scaling (z-score)</h4>
            <p className="text-[11px] text-white/50 leading-relaxed font-mono">
              StandardScaler z = (x - μ) / σ; One-Hot categorical dummy encoding.
            </p>
          </div>

          <div className="p-3 rounded bg-[#00D1FF08] border border-[#00D1FF30] space-y-1 relative">
            <span className="text-[10px] font-mono font-bold text-[#00D1FF] uppercase tracking-wider">
              03 // CORE MODEL
            </span>
            <h4 className="text-xs font-semibold text-white">{project.algorithm}</h4>
            <p className="text-[11px] text-white/70 leading-relaxed font-sans text-xs">
              {project.architectureSummary}
            </p>
          </div>

          <div className="p-3 rounded bg-[#ffffff05] border border-[#ffffff10] space-y-1 relative">
            <span className="text-[10px] font-mono font-bold text-[#00D1FF] uppercase tracking-wider">
              04 // VALIDATION
            </span>
            <h4 className="text-xs font-semibold text-white">Cross-Validation k=5</h4>
            <p className="text-[11px] text-white/50 leading-relaxed font-mono">
              Stratified train/test split ({100 - testSplit}/{testSplit}), AUC-ROC scoring.
            </p>
          </div>
        </div>
      </div>

      {/* Hyperparameter Controls & Confusion Matrix */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Hyperparameters */}
        <div className="lg:col-span-6 bg-[#0a0a0a] border border-[#ffffff10] rounded-xl p-5 shadow-[0_0_20px_rgba(0,0,0,0.8)] space-y-4">
          <div className="flex items-center justify-between border-b border-[#ffffff10] pb-3">
            <h3 className="text-xs font-mono font-bold uppercase tracking-widest text-white flex items-center gap-2">
              <Sliders className="w-4 h-4 text-[#00D1FF]" />
              Tunable Hyperparameters
            </h3>
            <span className="text-[10px] font-mono text-[#00D1FF] bg-[#00D1FF10] px-2 py-0.5 rounded border border-[#00D1FF30]">
              CONFIG_RUNTIME
            </span>
          </div>

          <div className="space-y-4 text-xs font-mono">
            <div className="space-y-1.5 p-3 rounded bg-[#ffffff04] border border-[#ffffff08]">
              <div className="flex justify-between">
                <span className="text-white/70">Learning Rate (α)</span>
                <span className="text-[#00D1FF] font-bold">{learningRate}</span>
              </div>
              <input
                type="range"
                min="0.0001"
                max="0.01"
                step="0.0005"
                value={learningRate}
                onChange={(e) => setLearningRate(e.target.value)}
                className="w-full accent-[#00D1FF] h-1.5 bg-white/10 rounded-full cursor-pointer"
              />
              <span className="text-[10px] text-white/40">Controls gradient descent step size during optimization</span>
            </div>

            <div className="space-y-1.5 p-3 rounded bg-[#ffffff04] border border-[#ffffff08]">
              <div className="flex justify-between">
                <span className="text-white/70">Estimators / Training Epochs</span>
                <span className="text-[#00D1FF] font-bold">{nEstimators}</span>
              </div>
              <input
                type="range"
                min="10"
                max="300"
                step="10"
                value={nEstimators}
                onChange={(e) => setNEstimators(Number(e.target.value))}
                className="w-full accent-[#00D1FF] h-1.5 bg-white/10 rounded-full cursor-pointer"
              />
              <span className="text-[10px] text-white/40">Total number of trees or training forward passes</span>
            </div>

            <div className="space-y-1.5 p-3 rounded bg-[#ffffff04] border border-[#ffffff08]">
              <div className="flex justify-between">
                <span className="text-white/70">Mini-Batch Size</span>
                <span className="text-[#00D1FF] font-bold">{batchSize} samples</span>
              </div>
              <select
                value={batchSize}
                onChange={(e) => setBatchSize(Number(e.target.value))}
                className="w-full px-3 py-1.5 rounded bg-black/80 border border-[#ffffff15] text-white text-xs focus:outline-none focus:border-[#00D1FF]"
              >
                <option value={16}>16 samples</option>
                <option value={32}>32 samples (Standard Lab Benchmark)</option>
                <option value={64}>64 samples</option>
                <option value={128}>128 samples</option>
              </select>
            </div>

            <div className="space-y-1.5 p-3 rounded bg-[#ffffff04] border border-[#ffffff08]">
              <div className="flex justify-between">
                <span className="text-white/70">Test Partition Ratio</span>
                <span className="text-[#00D1FF] font-bold">{testSplit}% Test / {100 - testSplit}% Train</span>
              </div>
              <input
                type="range"
                min="10"
                max="40"
                step="5"
                value={testSplit}
                onChange={(e) => setTestSplit(Number(e.target.value))}
                className="w-full accent-[#00D1FF] h-1.5 bg-white/10 rounded-full cursor-pointer"
              />
            </div>
          </div>

          <div className="p-3 bg-black/60 rounded border border-[#ffffff10] text-[11px] text-white/60 space-y-1 font-mono">
            <span className="text-[#00D1FF] uppercase tracking-wider font-bold block">Academic Viva Justification:</span>
            <p className="font-sans text-xs">
              Tuned to prevent overfitting on the Semester-2 evaluation set while preserving generalizability across real-world edge inputs.
            </p>
          </div>
        </div>

        {/* Right: Confusion Matrix & Metrics */}
        <div className="lg:col-span-6 bg-[#0a0a0a] border border-[#ffffff10] rounded-xl p-5 shadow-[0_0_20px_rgba(0,0,0,0.8)] space-y-4">
          <div className="flex items-center justify-between border-b border-[#ffffff10] pb-3">
            <h3 className="text-xs font-mono font-bold uppercase tracking-widest text-white flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-[#00D1FF]" />
              Confusion Matrix & Validation Set
            </h3>
            <span className="text-[10px] font-mono text-[#00D1FF] bg-[#00D1FF10] px-2 py-0.5 rounded border border-[#00D1FF30]">
              N = 200 SAMPLES
            </span>
          </div>

          {/* 2x2 Matrix Visualizer */}
          <div className="space-y-2">
            <div className="text-center text-[10px] text-white/40 font-mono uppercase tracking-widest">
              Predicted Target Class
            </div>
            <div className="grid grid-cols-2 gap-2 text-center text-xs font-mono">
              {/* True Positive */}
              <div className="p-3 rounded bg-[#00D1FF0a] border border-[#00D1FF40]">
                <div className="text-[10px] text-[#00D1FF] font-bold uppercase">True Positive (TP)</div>
                <div className="text-2xl font-light font-mono text-white my-1">94</div>
                <div className="text-[10px] text-white/40">Correctly Identified</div>
              </div>

              {/* False Positive */}
              <div className="p-3 rounded bg-rose-950/20 border border-rose-900/40">
                <div className="text-[10px] text-rose-400 font-bold uppercase">False Positive (FP)</div>
                <div className="text-2xl font-light font-mono text-white my-1">6</div>
                <div className="text-[10px] text-white/40">Type I Error</div>
              </div>

              {/* False Negative */}
              <div className="p-3 rounded bg-amber-950/20 border border-amber-900/40">
                <div className="text-[10px] text-amber-400 font-bold uppercase">False Negative (FN)</div>
                <div className="text-2xl font-light font-mono text-white my-1">5</div>
                <div className="text-[10px] text-white/40">Type II Error</div>
              </div>

              {/* True Negative */}
              <div className="p-3 rounded bg-[#00D1FF0a] border border-[#00D1FF40]">
                <div className="text-[10px] text-[#00D1FF] font-bold uppercase">True Negative (TN)</div>
                <div className="text-2xl font-light font-mono text-white my-1">95</div>
                <div className="text-[10px] text-white/40">Correctly Rejected</div>
              </div>
            </div>
          </div>

          {/* Metrics summary list in telemetry card format */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2">
            <div className="p-2.5 border border-[#ffffff10] bg-black/60 rounded text-center">
              <span className="block text-[10px] text-white/40 uppercase font-mono tracking-wider mb-0.5">ACCURACY</span>
              <span className="text-lg font-light font-mono text-[#00D1FF]">{project.metrics.accuracy}</span>
            </div>
            <div className="p-2.5 border border-[#ffffff10] bg-black/60 rounded text-center">
              <span className="block text-[10px] text-white/40 uppercase font-mono tracking-wider mb-0.5">PRECISION</span>
              <span className="text-lg font-light font-mono text-[#00D1FF]">{project.metrics.precision}</span>
            </div>
            <div className="p-2.5 border border-[#ffffff10] bg-black/60 rounded text-center">
              <span className="block text-[10px] text-white/40 uppercase font-mono tracking-wider mb-0.5">RECALL</span>
              <span className="text-lg font-light font-mono text-[#00D1FF]">{project.metrics.recall}</span>
            </div>
            <div className="p-2.5 border border-[#ffffff10] bg-black/60 rounded text-center">
              <span className="block text-[10px] text-white/40 uppercase font-mono tracking-wider mb-0.5">F1-SCORE</span>
              <span className="text-lg font-light font-mono text-[#00D1FF]">{project.metrics.f1Score}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
