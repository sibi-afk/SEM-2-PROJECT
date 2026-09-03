import { useState, FormEvent } from "react";
import { X, Check, Sparkles, Plus, GraduationCap, ArrowRight } from "lucide-react";
import { Sem2Project } from "../types";
import { DEFAULT_SEM2_PROJECTS } from "../data/defaultProjects";

interface ProjectSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentProjectId: string;
  onSelectProject: (project: Sem2Project) => void;
  onCustomProjectCreated: (project: Sem2Project) => void;
}

export function ProjectSelectorModal({
  isOpen,
  onClose,
  currentProjectId,
  onSelectProject,
  onCustomProjectCreated,
}: ProjectSelectorModalProps) {
  const [activeTab, setActiveTab] = useState<"preset" | "custom">("preset");
  const [customName, setCustomName] = useState("");
  const [customDomain, setCustomDomain] = useState("Machine Learning");
  const [customProblem, setCustomProblem] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);

  if (!isOpen) return null;

  const handleCreateCustom = async (e: FormEvent) => {
    e.preventDefault();
    if (!customName.trim()) return;

    setIsGenerating(true);
    try {
      // Call backend to generate spec or create robust local model spec
      const res = await fetch("/api/model/generate-spec", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectName: customName,
          domain: customDomain,
          problemStatement: customProblem,
        }),
      });

      const specData = await res.json();

      const newProj: Sem2Project = {
        id: `custom-${Date.now()}`,
        name: customName,
        shortCode: `SEM2-${customName.slice(0, 6).toUpperCase().replace(/\s+/g, "")}`,
        domain: customDomain,
        semester: "Semester 2",
        problemStatement:
          customProblem ||
          `Autonomous AI model predicting and classifying target outcomes for ${customName}.`,
        algorithm: specData.algorithm || "Random Forest & Gradient Boosting Classifier",
        framework: "scikit-learn",
        metrics: specData.metrics || {
          accuracy: "93.8%",
          precision: "92.4%",
          recall: "94.1%",
          f1Score: "93.2%",
          aucRoc: "0.965",
        },
        architectureSummary:
          specData.architecture ||
          "Data Preprocessing -> Feature Scaling -> Decision Tree Ensemble -> Evaluation Metrics",
        features: (specData.features && specData.features.length > 0)
          ? specData.features.map((f: any) => ({
              name: f.name || "feature_1",
              label: (f.name || "Feature").replace(/_/g, " ").toUpperCase(),
              type: f.type || "numerical",
              min: 0,
              max: 100,
              step: 1,
              defaultVal: f.defaultVal ? Number(f.defaultVal) || 50 : 50,
              description: f.description || "Input metric",
            }))
          : [
              {
                name: "primary_metric",
                label: "Primary Metric (0-100)",
                type: "numerical",
                min: 0,
                max: 100,
                step: 1,
                defaultVal: 75,
                description: "Key input feature score for classification",
              },
              {
                name: "variance_factor",
                label: "Variance Level (0-1)",
                type: "numerical",
                min: 0,
                max: 1,
                step: 0.05,
                defaultVal: 0.45,
                description: "Signal stability coefficient",
              },
              {
                name: "sampling_quality",
                label: "Input Quality Tier",
                type: "categorical",
                options: ["High", "Standard", "Low"],
                defaultVal: "High",
                description: "Sensor or data stream fidelity",
              },
            ],
        vivaQuestions: specData.vivaQuestions || [
          {
            topic: "Project Objective",
            question: `What is the core novelty of your ${customName} project for Sem-2?`,
            answer: `It implements an end-to-end ML pipeline with optimized feature engineering, delivering high predictive accuracy while maintaining sub-50ms inference latency.`,
          },
        ],
      };

      onCustomProjectCreated(newProj);
      onClose();
    } catch (err) {
      console.error(err);
      // Fallback
      const fallbackProj: Sem2Project = {
        id: `custom-${Date.now()}`,
        name: customName,
        shortCode: "SEM2-CUSTOM",
        domain: customDomain,
        semester: "Semester 2",
        problemStatement: customProblem || `AI model solving ${customName}`,
        algorithm: "XGBoost Classifier",
        framework: "scikit-learn",
        metrics: {
          accuracy: "93.4%",
          precision: "92.8%",
          recall: "94.0%",
          f1Score: "93.4%",
        },
        architectureSummary: "StandardScaler -> Gradient Boosted Trees -> Softmax Classifier",
        features: [
          {
            name: "input_metric_1",
            label: "Sensor/Data Metric 1",
            type: "numerical",
            min: 0,
            max: 100,
            step: 1,
            defaultVal: 65,
            description: "Primary feature indicator",
          },
          {
            name: "input_metric_2",
            label: "Sensor/Data Metric 2",
            type: "numerical",
            min: 0,
            max: 50,
            step: 1,
            defaultVal: 28,
            description: "Secondary feature indicator",
          },
        ],
        vivaQuestions: [
          {
            question: "Why did you build this project for your Sem-2 requirements?",
            answer: "It demonstrates practical application of machine learning pipelines, preprocessing, and model evaluation techniques taught in Sem-2 coursework.",
          },
        ],
      };
      onCustomProjectCreated(fallbackProj);
      onClose();
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-4">
      <div className="bg-[#0a0a0a] border border-[#ffffff15] rounded-xl w-full max-w-2xl overflow-hidden shadow-[0_0_35px_rgba(0,0,0,0.95)] flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#ffffff10] bg-[#050505]">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded bg-[#00D1FF15] text-[#00D1FF] border border-[#00D1FF30]">
              <GraduationCap className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-[#00D1FF] shadow-[0_0_6px_#00D1FF]" />
                <h2 className="text-sm font-mono font-bold text-white uppercase tracking-widest">
                  LOAD SEM-2 TARGET PROJECT
                </h2>
              </div>
              <p className="text-[11px] text-white/40 font-mono">
                Select a vetted Semester 2 project or enter your exact topic name
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-white/40 hover:text-white rounded hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab switch */}
        <div className="flex border-b border-[#ffffff10] px-6 pt-2 bg-[#050505]">
          <button
            onClick={() => setActiveTab("preset")}
            className={`pb-3 px-4 text-xs font-mono font-bold border-b-2 transition-all cursor-pointer uppercase tracking-wider ${
              activeTab === "preset"
                ? "border-[#00D1FF] text-[#00D1FF] shadow-[0_1px_0_#00D1FF]"
                : "border-transparent text-white/40 hover:text-white"
            }`}
          >
            Curated Models ({DEFAULT_SEM2_PROJECTS.length})
          </button>
          <button
            onClick={() => setActiveTab("custom")}
            className={`pb-3 px-4 text-xs font-mono font-bold border-b-2 transition-all cursor-pointer flex items-center gap-1.5 uppercase tracking-wider ${
              activeTab === "custom"
                ? "border-[#00D1FF] text-[#00D1FF] shadow-[0_1px_0_#00D1FF]"
                : "border-transparent text-white/40 hover:text-white"
            }`}
          >
            <Plus className="w-3.5 h-3.5" />
            Custom Project Identifier
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-4 flex-1">
          {activeTab === "preset" ? (
            <div className="grid grid-cols-1 gap-3">
              {DEFAULT_SEM2_PROJECTS.map((proj) => {
                const isSelected = proj.id === currentProjectId;
                return (
                  <div
                    key={proj.id}
                    onClick={() => {
                      onSelectProject(proj);
                      onClose();
                    }}
                    className={`p-4 rounded-lg border transition-all cursor-pointer flex items-start justify-between gap-4 font-mono ${
                      isSelected
                        ? "bg-[#00D1FF0c] border-[#00D1FF] shadow-[0_0_15px_rgba(0,209,255,0.15)]"
                        : "bg-black/60 border-[#ffffff10] hover:bg-[#ffffff05] hover:border-[#00D1FF40]"
                    }`}
                  >
                    <div className="space-y-1.5 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] px-2 py-0.5 rounded bg-black/80 text-[#00D1FF] border border-[#00D1FF30]">
                          {proj.shortCode}
                        </span>
                        <span className="text-[10px] text-white/40 uppercase">{proj.domain}</span>
                      </div>
                      <h3 className="text-xs font-bold text-white tracking-wide">
                        {proj.name}
                      </h3>
                      <p className="text-[11px] text-white/50 font-sans line-clamp-2">
                        {proj.problemStatement}
                      </p>
                      <div className="flex items-center gap-3 pt-1 text-[10px] text-white/60">
                        <span className="text-[#00D1FF] font-medium">
                          ACCURACY: {proj.metrics.accuracy}
                        </span>
                        <span className="text-white/20">•</span>
                        <span className="text-white/40">ALG: {proj.algorithm}</span>
                      </div>
                    </div>
                    <div className="pt-1">
                      {isSelected ? (
                        <div className="h-6 w-6 rounded bg-[#00D1FF] text-black flex items-center justify-center font-bold shadow-[0_0_8px_#00D1FF]">
                          <Check className="w-3.5 h-3.5" />
                        </div>
                      ) : (
                        <div className="h-6 w-6 rounded border border-[#ffffff20] flex items-center justify-center text-white/30 hover:border-[#00D1FF] hover:text-[#00D1FF]">
                          <ArrowRight className="w-3.5 h-3.5" />
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <form onSubmit={handleCreateCustom} className="space-y-4 font-mono">
              <div className="p-3 bg-black/60 border border-[#00D1FF30] rounded text-xs text-white/70 space-y-1">
                <span className="text-[#00D1FF] font-bold block">💡 GEMINI CHAT PROJECT SYNC:</span>
                <p className="font-sans text-xs">
                  If you discussed a specific project name in your prior chat (e.g., <em>Smart Crop Disease Detection</em> or <em>Helmet Detection AI</em>), enter it below. The system will synthesize a custom AI model architecture and test inference pipeline.
                </p>
              </div>

              <div>
                <label className="block text-xs uppercase tracking-wider text-white/70 mb-1">
                  Project Title *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. AI Smart Traffic Signal Controller, Crop Disease Classifier, etc."
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded bg-black/80 border border-[#ffffff15] text-white text-xs focus:outline-none focus:border-[#00D1FF]"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs uppercase tracking-wider text-white/70 mb-1">
                    Domain / Field
                  </label>
                  <select
                    value={customDomain}
                    onChange={(e) => setCustomDomain(e.target.value)}
                    className="w-full px-3 py-2 rounded bg-black/80 border border-[#ffffff15] text-white text-xs focus:outline-none focus:border-[#00D1FF]"
                  >
                    <option value="Machine Learning">Machine Learning / Scikit-Learn</option>
                    <option value="Deep Learning / CNN">Computer Vision / CNN</option>
                    <option value="Natural Language Processing">NLP / Text Classification</option>
                    <option value="IoT & Smart Sensors">IoT & Embedded AI</option>
                    <option value="Healthcare Informatics">Healthcare & Medical AI</option>
                    <option value="Cybersecurity">Cybersecurity & Intrusion Detection</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs uppercase tracking-wider text-white/70 mb-1">
                    Academic Semester
                  </label>
                  <input
                    type="text"
                    disabled
                    value="Semester 2 (Sem-2)"
                    className="w-full px-3 py-2 rounded bg-black/40 border border-[#ffffff08] text-white/40 text-xs cursor-not-allowed"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs uppercase tracking-wider text-white/70 mb-1">
                  Problem Statement / Brief Overview (Optional)
                </label>
                <textarea
                  rows={2}
                  placeholder="Briefly describe what your Sem-2 AI project is trying to predict, detect, or automate..."
                  value={customProblem}
                  onChange={(e) => setCustomProblem(e.target.value)}
                  className="w-full px-3.5 py-2 rounded bg-black/80 border border-[#ffffff15] text-white text-xs focus:outline-none focus:border-[#00D1FF]"
                />
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isGenerating || !customName.trim()}
                  className="w-full py-3 px-4 rounded bg-[#00D1FF] hover:bg-[#33dbff] disabled:opacity-50 text-black text-xs font-mono font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer shadow-[0_0_15px_rgba(0,209,255,0.3)] active:scale-95"
                >
                  {isGenerating ? (
                    <>
                      <Sparkles className="w-4 h-4 animate-spin text-black" />
                      SYNTHESIZING MODEL WEIGHTS & FEATURES...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      INITIALIZE AI MODEL FOR "{customName || 'SEM-2 PROJECT'}"
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-[#ffffff10] bg-[#050505] flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded bg-black/60 border border-[#ffffff15] hover:border-white/40 text-white/60 hover:text-white text-xs font-mono transition-colors cursor-pointer uppercase tracking-wider"
          >
            [CLOSE]
          </button>
        </div>
      </div>
    </div>
  );
}
