import { Cpu, Layers, Sparkles, Activity } from "lucide-react";
import { Sem2Project } from "../types";

interface NavbarProps {
  currentProject: Sem2Project;
  onOpenSelector: () => void;
  hasApi: boolean;
}

export function Navbar({ currentProject, onOpenSelector, hasApi }: NavbarProps) {
  return (
    <header className="w-full bg-[#0a0a0a] border-b border-[#ffffff10] text-[#e0e0e0] sticky top-0 z-40 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand & Project Identity */}
        <div className="flex items-center space-x-3 sm:space-x-4">
          <div className="relative flex items-center justify-center">
            <div className="w-3 h-3 rounded-full bg-[#00D1FF] shadow-[0_0_8px_#00D1FF] animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <span className="font-bold text-sm sm:text-base tracking-widest uppercase text-white font-mono">
                STOCHASTIC PATHFINDING VISUALIZER
              </span>
              <span className="px-2 py-0.5 text-[10px] bg-[#00D1FF20] text-[#00D1FF] border border-[#00D1FF40] rounded font-mono font-bold tracking-wider uppercase">
                {hasApi ? "GEMINI LIVE" : "MDP READY"}
              </span>
            </div>
            <p className="text-[11px] text-white/40 font-mono hidden sm:block tracking-wide">
              BELLMAN VALUE ITERATION & DEEP Q-LEARNING INFERENCE
            </p>
          </div>
        </div>

        {/* Telemetry Metrics & Active Project Switcher */}
        <div className="flex items-center space-x-4 sm:space-x-6">
          {/* Telemetry Stats */}
          <div className="hidden lg:flex items-center space-x-5 text-xs text-white/50 border-r border-[#ffffff10] pr-6">
            <div className="flex flex-col items-end">
              <span className="uppercase text-[10px] tracking-wider text-white/40 font-mono">Telemetry</span>
              <span className="text-white font-mono text-xs">ONLINE</span>
            </div>
            <div className="flex flex-col items-end">
              <span className="uppercase text-[10px] tracking-wider text-white/40 font-mono">GPU Load</span>
              <span className="text-[#00D1FF] font-mono text-xs">88.4%</span>
            </div>
          </div>

          <button
            onClick={onOpenSelector}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#ffffff05] hover:bg-[#00D1FF15] border border-[#ffffff15] hover:border-[#00D1FF50] text-xs font-mono text-white/90 transition-all cursor-pointer group shadow-sm"
            title="Switch or customize your Sem-2 project"
          >
            <Layers className="w-3.5 h-3.5 text-[#00D1FF] group-hover:scale-110 transition-transform" />
            <span className="max-w-[130px] sm:max-w-[200px] truncate">
              {currentProject.name}
            </span>
            <span className="px-1.5 py-0.5 rounded bg-black/60 text-[10px] text-[#00D1FF] border border-[#00D1FF30]">
              [SWITCH]
            </span>
          </button>
        </div>
      </div>
    </header>
  );
}

