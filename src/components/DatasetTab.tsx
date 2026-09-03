import { useState, useEffect } from "react";
import { Database, Download, RefreshCw, Sparkles, Filter } from "lucide-react";
import { Sem2Project } from "../types";

interface DatasetTabProps {
  project: Sem2Project;
}

export function DatasetTab({ project }: DatasetTabProps) {
  const [rows, setRows] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [filterQuery, setFilterQuery] = useState("");

  const generateData = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/model/generate-dataset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectName: project.name,
          features: project.features,
          rowCount: 12,
        }),
      });
      const data = await res.json();
      if (data.rows && Array.isArray(data.rows)) {
        setRows(data.rows);
      }
    } catch (err) {
      console.error("Failed to generate data:", err);
      // Fallback generator
      const generated = Array.from({ length: 10 }, (_, i) => {
        const row: Record<string, any> = { id: i + 1 };
        project.features.forEach((f) => {
          if (f.type === "numerical") {
            const min = f.min ?? 0;
            const max = f.max ?? 100;
            row[f.name] = +(min + Math.random() * (max - min)).toFixed(1);
          } else if (f.type === "categorical" && f.options) {
            row[f.name] = f.options[Math.floor(Math.random() * f.options.length)];
          } else {
            row[f.name] = f.defaultVal;
          }
        });
        row["target_outcome"] = Math.random() > 0.4 ? "Optimal / Pass" : "At-Risk / Action Required";
        return row;
      });
      setRows(generated);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    generateData();
  }, [project.id]);

  const downloadCSV = () => {
    if (!rows.length) return;
    const headers = Object.keys(rows[0]);
    const csvContent = [
      headers.join(","),
      ...rows.map((row) =>
        headers.map((h) => JSON.stringify(row[h] ?? "")).join(",")
      ),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `${project.shortCode.toLowerCase()}_dataset.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const filteredRows = rows.filter((r) => {
    if (!filterQuery) return true;
    return Object.values(r).some((val) =>
      String(val).toLowerCase().includes(filterQuery.toLowerCase())
    );
  });

  return (
    <div className="space-y-6">
      <div className="bg-[#0a0a0a] border border-[#ffffff10] rounded-xl p-5 shadow-[0_0_20px_rgba(0,0,0,0.8)]">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <div className="w-2.5 h-2.5 rounded-full bg-[#00D1FF] shadow-[0_0_8px_#00D1FF]" />
              <h3 className="text-xs font-mono font-bold uppercase tracking-widest text-white flex items-center gap-2">
                <Database className="w-4 h-4 text-[#00D1FF]" />
                TRAINING_DATASET STREAM // ({rows.length} OBSERVATIONS)
              </h3>
            </div>
            <p className="text-[11px] text-white/40 font-mono">
              Synthetic training and validation feature vectors calibrated for {project.name}
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={generateData}
              disabled={isLoading}
              className="px-3 py-1.5 rounded bg-black/60 border border-[#ffffff15] hover:border-[#00D1FF40] text-xs font-mono text-white/80 hover:text-[#00D1FF] flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin text-[#00D1FF]" : ""}`} />
              RE-GENERATE TENSORS
            </button>
            <button
              onClick={downloadCSV}
              disabled={!rows.length}
              className="px-3.5 py-1.5 rounded bg-[#00D1FF] hover:bg-[#33dbff] text-xs font-mono font-bold text-black flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50 shadow-[0_0_12px_rgba(0,209,255,0.3)] active:scale-95"
            >
              <Download className="w-3.5 h-3.5" />
              EXPORT .CSV
            </button>
          </div>
        </div>

        {/* Filter bar */}
        <div className="mt-4 pt-4 border-t border-[#ffffff10] flex items-center gap-2">
          <Filter className="w-4 h-4 text-[#00D1FF]" />
          <input
            type="text"
            placeholder="Search across vector rows..."
            value={filterQuery}
            onChange={(e) => setFilterQuery(e.target.value)}
            className="w-full sm:max-w-xs px-3 py-1.5 rounded bg-black/80 border border-[#ffffff15] text-xs font-mono text-white focus:outline-none focus:border-[#00D1FF]"
          />
          <span className="text-[10px] font-mono text-white/30 hidden sm:inline-block">
            FILTER: {filteredRows.length} MATCHING
          </span>
        </div>
      </div>

      {/* Tabular data view */}
      <div className="bg-[#0a0a0a] border border-[#ffffff10] rounded-xl shadow-[0_0_20px_rgba(0,0,0,0.8)] overflow-hidden">
        <div className="overflow-x-auto max-h-[480px]">
          <table className="w-full text-left text-xs font-mono">
            <thead className="bg-[#050505] text-white/60 font-semibold border-b border-[#ffffff10] sticky top-0 z-10">
              <tr>
                {rows.length > 0 ? (
                  Object.keys(rows[0]).map((col) => (
                    <th key={col} className="px-4 py-3 whitespace-nowrap uppercase tracking-wider text-[10px] text-[#00D1FF]">
                      {col.replace(/_/g, " ")}
                    </th>
                  ))
                ) : (
                  <th className="px-4 py-3">Loading Columns...</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#ffffff08] text-white/70">
              {filteredRows.length > 0 ? (
                filteredRows.map((row, idx) => (
                  <tr
                    key={idx}
                    className="hover:bg-[#00D1FF08] transition-colors font-mono text-[11px]"
                  >
                    {Object.entries(row).map(([colKey, val]: [string, any], colIdx) => (
                      <td key={colIdx} className="px-4 py-2.5 whitespace-nowrap">
                        {colKey === "target_outcome" ? (
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold border ${
                              String(val).toLowerCase().includes("risk") ||
                              String(val).toLowerCase().includes("negative") ||
                              String(val).toLowerCase().includes("action")
                                ? "bg-rose-950/60 text-rose-400 border-rose-800"
                                : "bg-[#00D1FF15] text-[#00D1FF] border-[#00D1FF40]"
                            }`}
                          >
                            {String(val)}
                          </span>
                        ) : (
                          String(val)
                        )}
                      </td>
                    ))}
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={project.features.length + 2} className="px-4 py-8 text-center text-white/40 font-mono">
                    {isLoading ? "Synthesizing dataset rows..." : "No records found matching query"}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
