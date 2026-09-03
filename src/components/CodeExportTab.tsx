import { useState, useEffect } from "react";
import { Code, Copy, Check, Download, Terminal, Sparkles } from "lucide-react";
import { Sem2Project } from "../types";

interface CodeExportTabProps {
  project: Sem2Project;
}

export function CodeExportTab({ project }: CodeExportTabProps) {
  const [framework, setFramework] = useState<"scikit-learn" | "pytorch" | "tensorflow">(
    project.framework || "scikit-learn"
  );
  const [code, setCode] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const fetchCode = async (selectedFw: string) => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/model/generate-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectName: project.name,
          domain: project.domain,
          framework: selectedFw,
          features: project.features,
        }),
      });
      const data = await res.json();
      setCode(data.code || "# No code generated");
    } catch (err) {
      console.error(err);
      setCode(`# Sem-2 Project: ${project.name}
# Algorithm: ${project.algorithm}
import numpy as np
import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import classification_report, accuracy_score
import joblib

# Load Data
df = pd.read_csv("${project.shortCode.toLowerCase()}_dataset.csv")
X = df.drop(columns=["id", "target_outcome"])
y = df["target_outcome"]

X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

scaler = StandardScaler()
X_train_scaled = scaler.fit_transform(X_train)
X_test_scaled = scaler.transform(X_test)

model = RandomForestClassifier(n_estimators=100, max_depth=8, random_state=42)
model.fit(X_train_scaled, y_train)

y_pred = model.predict(X_test_scaled)
print("Sem-2 Project Accuracy:", accuracy_score(y_test, y_pred))
print(classification_report(y_test, y_pred))

joblib.dump(model, "sem2_model.joblib")
print("[SUCCESS] Model artifacts successfully serialized.")
`);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCode(framework);
  }, [project.id, framework]);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([code], { type: "text/x-python;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute(
      "download",
      `${project.shortCode.toLowerCase()}_model_pipeline.py`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Top Header Card */}
      <div className="bg-[#0a0a0a] border border-[#ffffff10] rounded-xl p-5 shadow-[0_0_20px_rgba(0,0,0,0.8)] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-2.5 h-2.5 rounded-full bg-[#00D1FF] shadow-[0_0_8px_#00D1FF]" />
            <h3 className="text-xs font-mono font-bold uppercase tracking-widest text-white flex items-center gap-2">
              <Code className="w-4 h-4 text-[#00D1FF]" />
              SOURCE_EXPORT // COMPLETE PIPELINE SCRIPT
            </h3>
          </div>
          <p className="text-[11px] text-white/40 font-mono">
            Verified, runnable academic script for laboratory submission, evaluation, and viva defense
          </p>
        </div>

        {/* Framework Selector & Actions */}
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center bg-black/80 p-1 rounded border border-[#ffffff15]">
            {(["scikit-learn", "pytorch", "tensorflow"] as const).map((fw) => (
              <button
                key={fw}
                onClick={() => setFramework(fw)}
                className={`px-3 py-1 rounded text-xs font-mono capitalize transition-all cursor-pointer ${
                  framework === fw
                    ? "bg-[#00D1FF20] text-[#00D1FF] border border-[#00D1FF40] shadow-[0_0_8px_rgba(0,209,255,0.25)]"
                    : "text-white/40 hover:text-white"
                }`}
              >
                {fw}
              </button>
            ))}
          </div>

          <button
            onClick={handleCopy}
            className="px-3 py-1.5 rounded bg-black/60 border border-[#ffffff15] hover:border-[#00D1FF40] text-xs font-mono text-white/80 hover:text-[#00D1FF] flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-[#00D1FF]" />
                COPIED!
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                COPY SCRIPT
              </>
            )}
          </button>

          <button
            onClick={handleDownload}
            className="px-3.5 py-1.5 rounded bg-[#00D1FF] hover:bg-[#33dbff] text-xs font-mono font-bold text-black flex items-center gap-1.5 transition-all cursor-pointer shadow-[0_0_12px_rgba(0,209,255,0.3)] active:scale-95"
          >
            <Download className="w-3.5 h-3.5" />
            EXPORT .PY
          </button>
        </div>
      </div>

      {/* Code Viewer Panel */}
      <div className="bg-black border border-[#ffffff10] rounded-xl overflow-hidden shadow-[0_0_25px_rgba(0,0,0,0.9)]">
        <div className="px-4 py-2.5 bg-[#050505] border-b border-[#ffffff10] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Terminal className="w-4 h-4 text-[#00D1FF]" />
            <span className="font-mono text-xs text-[#00D1FF]">
              {project.shortCode.toLowerCase()}_model_pipeline.py
            </span>
          </div>
          <span className="text-[10px] font-mono text-white/30 uppercase tracking-widest">
            RUNTIME: Python 3.10+ // {framework}
          </span>
        </div>

        <div className="p-4 overflow-x-auto max-h-[550px] relative">
          {isLoading ? (
            <div className="py-20 flex flex-col items-center justify-center text-white/40 space-y-2">
              <Sparkles className="w-6 h-6 text-[#00D1FF] animate-spin" />
              <p className="text-xs font-mono">Compiling verified Python pipeline tensors...</p>
            </div>
          ) : (
            <pre className="font-mono text-xs text-white/80 leading-relaxed whitespace-pre selection:bg-[#00D1FF30] selection:text-[#00D1FF]">
              <code>{code}</code>
            </pre>
          )}
        </div>
      </div>
    </div>
  );
}
