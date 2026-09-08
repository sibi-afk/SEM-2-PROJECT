import React, { useState, useEffect } from "react";
import {
  History,
  Route,
  ArrowRight,
  User,
  Zap,
  CheckCircle2,
  Clock,
  Sparkles,
  Cloud,
  ChevronRight,
  Flame,
  AlertTriangle,
  Play,
  RotateCcw,
} from "lucide-react";
import { PathRecord } from "../types/paths";
import { fetchRecentPaths } from "../lib/pathPersistence";
import { useAuth } from "../lib/AuthContext";

interface RecentPathsListProps {
  onLoadPath?: (path: PathRecord) => void;
  refreshTrigger?: number;
}

const DIR_ARROWS: Record<string, string> = {
  UP: "↑",
  DOWN: "↓",
  LEFT: "←",
  RIGHT: "→",
};

export const RecentPathsList: React.FC<RecentPathsListProps> = ({
  onLoadPath,
  refreshTrigger = 0,
}) => {
  const { user } = useAuth();
  const [paths, setPaths] = useState<PathRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedPathId, setSelectedPathId] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    const loadData = async () => {
      setLoading(true);
      try {
        const data = await fetchRecentPaths(user?.uid);
        if (mounted) {
          setPaths(data);
          if (data.length > 0 && !selectedPathId) {
            setSelectedPathId(data[0].id);
          }
        }
      } catch (err) {
        console.error("Error loading recent paths:", err);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    loadData();
    return () => {
      mounted = false;
    };
  }, [user, refreshTrigger]);

  const selectedPath = paths.find((p) => p.id === selectedPathId) || paths[0];

  return (
    <div className="bg-[#0a0a0a] border border-[#ffffff15] rounded-xl p-4 shadow-[0_0_20px_rgba(0,0,0,0.6)] font-mono">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-[#ffffff10]">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-[#00D1FF15] border border-[#00D1FF40] flex items-center justify-center text-[#00D1FF]">
            <History className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
              Recent Optimal Paths (Last 5 Sequences)
              <span className="px-2 py-0.5 rounded text-[10px] bg-[#00D1FF15] text-[#00D1FF] border border-[#00D1FF30]">
                {paths.length}/5 SAVED
              </span>
            </h3>
            <p className="text-[10px] text-white/40">
              Optimal stochastic Bellman Markov decisions saved {user ? "to Firestore & Local" : "locally"}
            </p>
          </div>
        </div>

        {user && (
          <span className="text-[10px] text-emerald-400 flex items-center gap-1">
            <Cloud className="w-3 h-3" />
            Cloud Synced ({user.email?.split("@")[0]})
          </span>
        )}
      </div>

      {/* Main Container */}
      {paths.length === 0 ? (
        <div className="py-8 text-center text-xs text-white/40 space-y-2">
          <Route className="w-8 h-8 mx-auto text-white/20" />
          <p>No optimal paths calculated yet.</p>
          <p className="text-[11px] text-[#00D1FF]/70">
            Click &quot;START SEARCH&quot; or &quot;STEP&quot; above to run the stochastic Bellman engine and generate a sequence.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 mt-3">
          {/* Path List Selector (5 max) */}
          <div className="lg:col-span-5 space-y-1.5">
            {paths.map((p, idx) => {
              const isSelected = selectedPath?.id === p.id;
              const dateObj = new Date(p.timestamp);
              const timeStr = !isNaN(dateObj.getTime())
                ? dateObj.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })
                : "Just now";

              return (
                <button
                  key={p.id}
                  onClick={() => setSelectedPathId(p.id)}
                  className={`w-full text-left p-2.5 rounded-lg border transition-all cursor-pointer flex items-center justify-between gap-2 ${
                    isSelected
                      ? "bg-[#00D1FF15] border-[#00D1FF] text-white shadow-[0_0_12px_rgba(0,209,255,0.2)]"
                      : "bg-black/50 hover:bg-[#ffffff08] border-[#ffffff10] text-white/70 hover:text-white"
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="w-4 h-4 rounded-full bg-white/10 text-[9px] font-bold flex items-center justify-center text-white/80">
                        #{idx + 1}
                      </span>
                      <span className="text-xs font-bold text-[#00D1FF] truncate">
                        {p.survivorName}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 text-[10px] text-white/40 mt-1">
                      <span>({p.startPos[0]},{p.startPos[1]}) → ({p.targetPos[0]},{p.targetPos[1]})</span>
                      <span>•</span>
                      <span>{p.stepsCount} steps</span>
                      <span>•</span>
                      <span className={p.reachedGoal ? "text-emerald-400" : "text-amber-400"}>
                        {p.reachedGoal ? "+100 (Rescue)" : "Partial"}
                      </span>
                    </div>
                  </div>

                  <div className="text-right flex flex-col items-end">
                    <span className="text-[9px] text-white/30">{timeStr}</span>
                    <ChevronRight className={`w-3.5 h-3.5 mt-1 transition-transform ${isSelected ? "text-[#00D1FF] translate-x-0.5" : "text-white/20"}`} />
                  </div>
                </button>
              );
            })}
          </div>

          {/* Selected Path Sequence Detail */}
          {selectedPath && (
            <div className="lg:col-span-7 bg-black/60 border border-[#ffffff10] rounded-lg p-3.5 flex flex-col justify-between space-y-3">
              <div>
                <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-[#ffffff10]">
                  <div>
                    <span className="text-[10px] text-white/40 uppercase">Selected Mission Sequence</span>
                    <h4 className="text-xs font-bold text-white flex items-center gap-1.5 mt-0.5">
                      <User className="w-3.5 h-3.5 text-emerald-400" />
                      {selectedPath.survivorName}
                    </h4>
                  </div>

                  {onLoadPath && (
                    <button
                      onClick={() => onLoadPath(selectedPath)}
                      className="px-2.5 py-1 rounded bg-[#00D1FF] hover:bg-[#33dbff] text-black text-[10px] font-bold flex items-center gap-1 transition-all cursor-pointer shadow-[0_0_10px_rgba(0,209,255,0.3)]"
                      title="Load this path back into the active simulator grid"
                    >
                      <Play className="w-3 h-3 fill-current" />
                      REPLAY ON GRID
                    </button>
                  )}
                </div>

                {/* Telemetry Micro Stats */}
                <div className="grid grid-cols-3 gap-2 mt-2.5">
                  <div className="p-2 rounded bg-black/40 border border-[#ffffff08]">
                    <span className="text-[9px] text-white/40 block">Steps & Slips</span>
                    <span className="text-xs font-bold text-white">
                      {selectedPath.stepsCount} <span className="text-[10px] text-amber-400 font-normal">({selectedPath.slipsCount} slips)</span>
                    </span>
                  </div>
                  <div className="p-2 rounded bg-black/40 border border-[#ffffff08]">
                    <span className="text-[9px] text-white/40 block">Bellman Utility</span>
                    <span className={`text-xs font-bold ${selectedPath.accumulatedReward >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                      {selectedPath.accumulatedReward >= 0 ? `+${selectedPath.accumulatedReward}` : selectedPath.accumulatedReward}
                    </span>
                  </div>
                  <div className="p-2 rounded bg-black/40 border border-[#ffffff08]">
                    <span className="text-[9px] text-white/40 block">Slip Friction ε</span>
                    <span className="text-xs font-bold text-[#00D1FF]">
                      {(selectedPath.slipProb * 100).toFixed(0)}%
                    </span>
                  </div>
                </div>

                {/* Direction Sequence Visualizer (Horizontal Streamline) */}
                <div className="mt-3">
                  <span className="text-[10px] text-white/40 uppercase block mb-1.5">
                    Calculated Optimal Action Sequence ({selectedPath.sequence.length} Actions):
                  </span>

                  <div className="flex flex-wrap items-center gap-1.5 max-h-28 overflow-y-auto p-2 bg-black/80 rounded border border-[#ffffff10]">
                    {selectedPath.sequence.map((dir, i) => (
                      <span
                        key={i}
                        className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#00D1FF15] border border-[#00D1FF30] text-[#00D1FF] flex items-center gap-1 shadow-sm"
                        title={`Step ${i + 1}: ${dir}`}
                      >
                        <span className="text-white/60 text-[9px]">{i + 1}.</span>
                        <span>{DIR_ARROWS[dir] || dir}</span>
                        <span className="text-[9px]">{dir}</span>
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Coordinates Stream */}
              <div className="pt-2 border-t border-[#ffffff08] flex items-center justify-between text-[9px] text-white/40">
                <span>Start: ({selectedPath.startPos[0]}, {selectedPath.startPos[1]})</span>
                <span className="truncate max-w-[200px]">
                  Coords: {selectedPath.pathCoordinates.map((c) => `[${c[0]},${c[1]}]`).slice(0, 5).join(" → ")}
                  {selectedPath.pathCoordinates.length > 5 ? ` +${selectedPath.pathCoordinates.length - 5} more` : ""}
                </span>
                <span className="text-emerald-400">Target: ({selectedPath.targetPos[0]}, {selectedPath.targetPos[1]})</span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
