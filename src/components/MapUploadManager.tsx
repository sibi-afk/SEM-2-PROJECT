import React, { useRef, useState, useEffect } from "react";
import {
  Upload,
  Download,
  Map as MapIcon,
  CheckCircle2,
  AlertTriangle,
  FileCode,
  Layers,
  Sparkles,
  RefreshCw,
  FolderOpen,
} from "lucide-react";
import { CustomMapRecord } from "../types/paths";
import { saveCustomMap, fetchCustomMaps } from "../lib/pathPersistence";
import { useAuth } from "../lib/AuthContext";

interface MapUploadManagerProps {
  currentGrid: number[][];
  currentDimension: number;
  startPos: [number, number];
  targetPos: [number, number];
  onApplyMap: (newMap: {
    grid: number[][];
    dimension: number;
    startPos: [number, number];
    targetPos: [number, number];
    name: string;
  }) => void;
}

const PRESET_MAP_TEMPLATES = [
  {
    id: "mountain_pass",
    name: "Mountain Avalanche Pass (12x12)",
    dimension: 12,
    desc: "Narrow icy canyon with high slip risk and lateral rock walls",
    generate: () => {
      const N = 12;
      const g: number[][] = Array.from({ length: N }, () => Array(N).fill(0));
      // Outer border
      for (let r = 0; r < N; r++) {
        for (let c = 0; c < N; c++) {
          if (r === 0 || r === N - 1 || c === 0 || c === N - 1) g[r][c] = 1;
        }
      }
      // Canyon ridges
      for (let r = 2; r < 10; r++) {
        if (r !== 5 && r !== 6) {
          g[r][3] = 1;
          g[r][8] = 1;
        }
      }
      // Ice patch hazards
      g[4][5] = 2;
      g[4][6] = 2;
      g[7][5] = 2;
      g[7][6] = 2;
      return g;
    },
    start: [1, 1] as [number, number],
    target: [10, 10] as [number, number],
  },
  {
    id: "collapsed_urban",
    name: "Collapsed Urban Rubble (14x14)",
    dimension: 14,
    desc: "Dense collapsed concrete columns with thermal smoke zones",
    generate: () => {
      const N = 14;
      const g: number[][] = Array.from({ length: N }, () => Array(N).fill(0));
      for (let r = 0; r < N; r++) {
        for (let c = 0; c < N; c++) {
          if (r === 0 || r === N - 1 || c === 0 || c === N - 1) g[r][c] = 1;
        }
      }
      // Checkerboard debris clusters
      for (let r = 2; r < 12; r += 2) {
        for (let c = 2; c < 12; c += 2) {
          if ((r + c) % 4 === 0) g[r][c] = 1;
          else if ((r + c) % 6 === 0) g[r][c] = 2;
        }
      }
      return g;
    },
    start: [1, 1] as [number, number],
    target: [12, 12] as [number, number],
  },
  {
    id: "flood_islands",
    name: "Flood Disaster Archipelago (10x10)",
    dimension: 10,
    desc: "Isolated dry mounds separated by deep flood hazard channels",
    generate: () => {
      const N = 10;
      const g: number[][] = Array.from({ length: N }, () => Array(N).fill(0));
      for (let r = 0; r < N; r++) {
        for (let c = 0; c < N; c++) {
          if (r === 0 || r === N - 1 || c === 0 || c === N - 1) g[r][c] = 1;
        }
      }
      // Flood hazard channels across grid
      for (let c = 1; c < 9; c++) {
        if (c !== 4) g[4][c] = 2;
        if (c !== 6) g[7][c] = 2;
      }
      g[2][4] = 1;
      g[2][5] = 1;
      return g;
    },
    start: [1, 1] as [number, number],
    target: [8, 8] as [number, number],
  },
];

export const MapUploadManager: React.FC<MapUploadManagerProps> = ({
  currentGrid,
  currentDimension,
  startPos,
  targetPos,
  onApplyMap,
}) => {
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [savedMaps, setSavedMaps] = useState<CustomMapRecord[]>([]);

  useEffect(() => {
    fetchCustomMaps(user?.uid).then(setSavedMaps);
  }, [user]);

  // Handle file upload (JSON or ASCII matrix)
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    setErrorMsg(null);
    setSuccessMsg(null);
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target?.result as string;
        let parsedMap: any = null;

        if (file.name.endsWith(".json")) {
          // Parse JSON map format
          parsedMap = JSON.parse(text);

          if (!Array.isArray(parsedMap.grid)) {
            throw new Error("JSON must include a 2D 'grid' array (e.g. [[0, 1], [0, 0]]).");
          }

          const dim = parsedMap.dimension || parsedMap.grid.length;
          const s = parsedMap.startPos || [1, 1];
          const t = parsedMap.targetPos || [dim - 2, dim - 2];

          const newCustomMap: CustomMapRecord = {
            id: `map_${Date.now()}`,
            name: parsedMap.name || file.name.replace(".json", ""),
            description: parsedMap.description || "Uploaded terrain JSON",
            dimension: dim,
            grid: parsedMap.grid,
            startPos: s,
            targetPos: t,
            createdAt: new Date().toISOString(),
            source: "uploaded",
          };

          await saveCustomMap(newCustomMap, user?.uid);
          setSavedMaps((prev) => [newCustomMap, ...prev]);

          onApplyMap({
            grid: parsedMap.grid,
            dimension: dim,
            startPos: s,
            targetPos: t,
            name: newCustomMap.name,
          });

          setSuccessMsg(`Successfully loaded map "${newCustomMap.name}" (${dim}x${dim})!`);
        } else {
          // Parse ASCII or CSV format (.txt, .csv)
          // Lines with symbols: '.' = empty, '#' = obstacle, 'H'/'F' = hazard, 'S' = start, 'T'/'P' = target
          const lines = text
            .split(/\r?\n/)
            .map((l) => l.trim())
            .filter((l) => l.length > 0);

          if (lines.length < 5) {
            throw new Error("Map file must contain at least 5 lines of grid data.");
          }

          const dim = lines.length;
          const newGrid: number[][] = [];
          let detectedStart: [number, number] = [1, 1];
          let detectedTarget: [number, number] = [dim - 2, dim - 2];

          for (let r = 0; r < dim; r++) {
            const rowChars = lines[r].split(/[\s,]+/);
            const rowVals: number[] = [];

            for (let c = 0; c < rowChars.length; c++) {
              const ch = rowChars[c].toUpperCase();
              if (ch === "1" || ch === "#" || ch === "W") {
                rowVals.push(1); // Rubble/wall
              } else if (ch === "2" || ch === "H" || ch === "F") {
                rowVals.push(2); // Hazard
              } else if (ch === "3" || ch === "S" || ch === "A") {
                rowVals.push(3); // Start agent
                detectedStart = [r, c];
              } else if (ch === "4" || ch === "T" || ch === "P" || ch === "G") {
                rowVals.push(4); // Target person
                detectedTarget = [r, c];
              } else {
                rowVals.push(0); // Empty
              }
            }
            newGrid.push(rowVals);
          }

          const newCustomMap: CustomMapRecord = {
            id: `map_${Date.now()}`,
            name: file.name.replace(/\.[^/.]+$/, ""),
            description: "Uploaded matrix terrain",
            dimension: dim,
            grid: newGrid,
            startPos: detectedStart,
            targetPos: detectedTarget,
            createdAt: new Date().toISOString(),
            source: "uploaded",
          };

          await saveCustomMap(newCustomMap, user?.uid);
          setSavedMaps((prev) => [newCustomMap, ...prev]);

          onApplyMap({
            grid: newGrid,
            dimension: dim,
            startPos: detectedStart,
            targetPos: detectedTarget,
            name: newCustomMap.name,
          });

          setSuccessMsg(`Successfully parsed ASCII/CSV map "${newCustomMap.name}" (${dim}x${newGrid[0]?.length || dim})!`);
        }
      } catch (err: any) {
        setErrorMsg(err.message || "Failed to parse uploaded map file.");
      }
    };

    reader.readAsText(file);
    // Reset file input value
    if (e.target) e.target.value = "";
  };

  // Export current active map to JSON file
  const handleExportMapJson = () => {
    const mapExport = {
      name: `Search_Rescue_Map_${currentDimension}x${currentDimension}`,
      description: "MDP stochastic pathfinding search and rescue terrain grid",
      dimension: currentDimension,
      startPos,
      targetPos,
      legend: {
        0: "empty_traversable",
        1: "rubble_barrier",
        2: "thermal_smoke_hazard",
        3: "start_search_drone",
        4: "target_person_beacon",
      },
      grid: currentGrid,
      exportedAt: new Date().toISOString(),
    };

    const blob = new Blob([JSON.stringify(mapExport, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `terrain_map_${currentDimension}x${currentDimension}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="bg-[#0a0a0a] border border-[#ffffff15] rounded-xl p-4 shadow-[0_0_20px_rgba(0,0,0,0.6)] font-mono space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-[#ffffff10]">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-indigo-950/80 border border-indigo-500/50 flex items-center justify-center text-indigo-400">
            <MapIcon className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
              Custom Terrain Map Manager & Upload
            </h4>
            <p className="text-[10px] text-white/40">
              Upload JSON, CSV, or ASCII map topologies, or switch between terrain archetypes
            </p>
          </div>
        </div>

        {/* Upload & Export Action Buttons */}
        <div className="flex items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept=".json,.csv,.txt"
            onChange={handleFileUpload}
            className="hidden"
          />

          <button
            onClick={() => fileInputRef.current?.click()}
            className="px-3 py-1.5 rounded bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-[0_0_12px_rgba(99,102,241,0.3)]"
            title="Upload custom map file (.json, .csv, .txt)"
          >
            <Upload className="w-3.5 h-3.5" />
            UPLOAD MAP FILE
          </button>

          <button
            onClick={handleExportMapJson}
            className="px-3 py-1.5 rounded bg-black/60 hover:bg-white/10 text-[#00D1FF] border border-[#00D1FF30] text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
            title="Download active map topology as JSON"
          >
            <Download className="w-3.5 h-3.5" />
            EXPORT MAP JSON
          </button>
        </div>
      </div>

      {/* Status Notifications */}
      {errorMsg && (
        <div className="p-2.5 rounded bg-rose-950/60 border border-rose-600 text-rose-300 text-xs flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
          <span>{errorMsg}</span>
        </div>
      )}

      {successMsg && (
        <div className="p-2.5 rounded bg-emerald-950/60 border border-emerald-600 text-emerald-300 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Preset Archetype Maps */}
      <div>
        <span className="text-[10px] text-white/40 uppercase block mb-1.5">
          Select Terrain Archetype / Preset Maps:
        </span>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {PRESET_MAP_TEMPLATES.map((tpl) => (
            <button
              key={tpl.id}
              onClick={() => {
                const g = tpl.generate();
                onApplyMap({
                  grid: g,
                  dimension: tpl.dimension,
                  startPos: tpl.start,
                  targetPos: tpl.target,
                  name: tpl.name,
                });
                setSuccessMsg(`Switched map to ${tpl.name}!`);
                setErrorMsg(null);
              }}
              className="p-2.5 rounded bg-black/50 hover:bg-white/5 border border-[#ffffff10] hover:border-[#00D1FF40] text-left transition-all cursor-pointer group"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white group-hover:text-[#00D1FF] transition-colors">
                  {tpl.name}
                </span>
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-white/5 text-white/50">
                  {tpl.dimension}x{tpl.dimension}
                </span>
              </div>
              <p className="text-[10px] text-white/40 mt-1 line-clamp-1">{tpl.desc}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Custom Uploaded Maps Library */}
      {savedMaps.length > 0 && (
        <div className="pt-2 border-t border-[#ffffff0a]">
          <span className="text-[10px] text-white/40 uppercase block mb-1.5 flex items-center gap-1.5">
            <FolderOpen className="w-3.5 h-3.5 text-indigo-400" />
            Uploaded / Saved Maps Library ({savedMaps.length}):
          </span>

          <div className="flex flex-wrap gap-2">
            {savedMaps.map((sm) => (
              <button
                key={sm.id}
                onClick={() => {
                  onApplyMap({
                    grid: sm.grid,
                    dimension: sm.dimension,
                    startPos: sm.startPos,
                    targetPos: sm.targetPos,
                    name: sm.name,
                  });
                  setSuccessMsg(`Loaded custom map "${sm.name}"!`);
                }}
                className="px-2.5 py-1.5 rounded bg-black/70 hover:bg-indigo-950/40 border border-[#ffffff15] hover:border-indigo-500/60 text-xs text-white/80 hover:text-white flex items-center gap-2 cursor-pointer transition-all"
              >
                <span className="w-2 h-2 rounded-full bg-indigo-400" />
                <span className="font-bold">{sm.name}</span>
                <span className="text-[9px] text-white/40">({sm.dimension}x{sm.dimension})</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
