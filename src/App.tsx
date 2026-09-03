import { useState, useEffect } from "react";
import {
  Activity,
  GitCommit,
  Database,
  Code,
  GraduationCap,
  Sparkles,
  Layers,
  HelpCircle,
  ExternalLink,
} from "lucide-react";
import { Sem2Project } from "./types";
import { DEFAULT_SEM2_PROJECTS } from "./data/defaultProjects";
import { Navbar } from "./components/Navbar";
import { ProjectSelectorModal } from "./components/ProjectSelectorModal";
import { ModelInferenceTab } from "./components/ModelInferenceTab";
import { ArchitectureTab } from "./components/ArchitectureTab";
import { DatasetTab } from "./components/DatasetTab";
import { CodeExportTab } from "./components/CodeExportTab";
import { VivaDefenseTab } from "./components/VivaDefenseTab";

export default function App() {
  const [currentProject, setCurrentProject] = useState<Sem2Project>(
    DEFAULT_SEM2_PROJECTS[0]
  );
  const [activeTab, setActiveTab] = useState<
    "inference" | "architecture" | "dataset" | "code" | "viva"
  >("inference");
  const [isSelectorOpen, setIsSelectorOpen] = useState(false);
  const [hasApiKey, setHasApiKey] = useState(false);

  useEffect(() => {
    // Check server health and API status
    fetch("/api/health")
      .then((res) => res.json())
      .then((data) => {
        setHasApiKey(Boolean(data.hasApiKey));
      })
      .catch((err) => {
        console.warn("Backend health check:", err);
      });
  }, []);

  const handleSelectProject = (proj: Sem2Project) => {
    setCurrentProject(proj);
  };

  const handleCustomProjectCreated = (proj: Sem2Project) => {
    setCurrentProject(proj);
    setActiveTab("inference");
  };

  return (
    <div className="min-h-screen bg-[#050505] text-[#e0e0e0] flex flex-col font-sans selection:bg-[#00D1FF] selection:text-black relative">
      {/* Subtle radial ambient lighting */}
      <div className="fixed inset-0 pointer-events-none opacity-40 bg-[radial-gradient(circle_at_50%_0%,_#00D1FF15_0%,_transparent_60%)]" />

      {/* Top Navigation */}
      <Navbar
        currentProject={currentProject}
        onOpenSelector={() => setIsSelectorOpen(true)}
        hasApi={hasApiKey}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6 relative z-10">
        {/* Project Notification / Chat Context Bar */}
        <div className="bg-[#0a0a0a] border border-[#ffffff10] rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-[0_0_20px_rgba(0,0,0,0.8)]">
          <div className="flex items-start sm:items-center gap-3">
            <div className="p-2 rounded-lg bg-[#00D1FF10] text-[#00D1FF] border border-[#00D1FF30] flex-shrink-0 shadow-[0_0_10px_rgba(0,209,255,0.15)]">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <div className="text-[11px] font-mono font-bold tracking-widest uppercase text-[#00D1FF]">
                SEM-2 PROJECT RUNTIME INITIALIZED
              </div>
              <div className="text-xs text-white/80 font-mono mt-0.5">
                Active: <span className="text-white font-bold">{currentProject.name}</span>{" "}
                <span className="text-white/40">[{currentProject.domain}]</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsSelectorOpen(true)}
              className="text-xs font-mono font-bold uppercase tracking-wider px-3.5 py-1.5 rounded bg-[#00D1FF] hover:bg-[#33dbff] text-black transition-all cursor-pointer shadow-[0_0_12px_rgba(0,209,255,0.3)] hover:shadow-[0_0_18px_rgba(0,209,255,0.5)] active:scale-95"
            >
              [ SWITCH / ENTER PROJECT ]
            </button>
          </div>
        </div>

        {/* Tab Navigation Controls */}
        <div className="border-b border-[#ffffff10] flex items-center gap-2 overflow-x-auto pb-px">
          <button
            onClick={() => setActiveTab("inference")}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-mono tracking-wider uppercase border-b-2 whitespace-nowrap transition-all cursor-pointer rounded-t ${
              activeTab === "inference"
                ? "border-[#00D1FF] text-[#00D1FF] bg-[#00D1FF10] shadow-[0_4px_12px_rgba(0,209,255,0.1)]"
                : "border-transparent text-white/40 hover:text-white/80 hover:bg-[#ffffff05]"
            }`}
          >
            <Activity className="w-4 h-4 text-[#00D1FF]" />
            Live Model Inference
          </button>

          <button
            onClick={() => setActiveTab("architecture")}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-mono tracking-wider uppercase border-b-2 whitespace-nowrap transition-all cursor-pointer rounded-t ${
              activeTab === "architecture"
                ? "border-[#00D1FF] text-[#00D1FF] bg-[#00D1FF10] shadow-[0_4px_12px_rgba(0,209,255,0.1)]"
                : "border-transparent text-white/40 hover:text-white/80 hover:bg-[#ffffff05]"
            }`}
          >
            <GitCommit className="w-4 h-4 text-[#00D1FF]" />
            Architecture & Tuning
          </button>

          <button
            onClick={() => setActiveTab("dataset")}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-mono tracking-wider uppercase border-b-2 whitespace-nowrap transition-all cursor-pointer rounded-t ${
              activeTab === "dataset"
                ? "border-[#00D1FF] text-[#00D1FF] bg-[#00D1FF10] shadow-[0_4px_12px_rgba(0,209,255,0.1)]"
                : "border-transparent text-white/40 hover:text-white/80 hover:bg-[#ffffff05]"
            }`}
          >
            <Database className="w-4 h-4 text-[#00D1FF]" />
            Training Dataset
          </button>

          <button
            onClick={() => setActiveTab("code")}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-mono tracking-wider uppercase border-b-2 whitespace-nowrap transition-all cursor-pointer rounded-t ${
              activeTab === "code"
                ? "border-[#00D1FF] text-[#00D1FF] bg-[#00D1FF10] shadow-[0_4px_12px_rgba(0,209,255,0.1)]"
                : "border-transparent text-white/40 hover:text-white/80 hover:bg-[#ffffff05]"
            }`}
          >
            <Code className="w-4 h-4 text-[#00D1FF]" />
            Python Pipeline Code
          </button>

          <button
            onClick={() => setActiveTab("viva")}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-mono tracking-wider uppercase border-b-2 whitespace-nowrap transition-all cursor-pointer rounded-t ${
              activeTab === "viva"
                ? "border-[#00D1FF] text-[#00D1FF] bg-[#00D1FF10] shadow-[0_4px_12px_rgba(0,209,255,0.1)]"
                : "border-transparent text-white/40 hover:text-white/80 hover:bg-[#ffffff05]"
            }`}
          >
            <GraduationCap className="w-4 h-4 text-[#00D1FF]" />
            Report & Viva Prep
          </button>
        </div>

        {/* Tab View Container */}
        <div className="pt-2">
          {activeTab === "inference" && (
            <ModelInferenceTab project={currentProject} />
          )}

          {activeTab === "architecture" && (
            <ArchitectureTab project={currentProject} />
          )}

          {activeTab === "dataset" && (
            <DatasetTab project={currentProject} />
          )}

          {activeTab === "code" && (
            <CodeExportTab project={currentProject} />
          )}

          {activeTab === "viva" && (
            <VivaDefenseTab project={currentProject} />
          )}
        </div>
      </main>

      {/* Project Selector & Custom Name Modal */}
      <ProjectSelectorModal
        isOpen={isSelectorOpen}
        onClose={() => setIsSelectorOpen(false)}
        currentProjectId={currentProject.id}
        onSelectProject={handleSelectProject}
        onCustomProjectCreated={handleCustomProjectCreated}
      />

      {/* Immersive Cyan Terminal Status Bar Footer */}
      <footer className="w-full bg-[#00D1FF] text-black py-2 px-4 sm:px-8 mt-12 flex flex-col sm:flex-row items-center justify-between gap-2 text-[10px] font-bold uppercase tracking-widest font-mono shadow-[0_0_20px_rgba(0,209,255,0.3)]">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-black animate-pulse" />
          <span>Secure Transmission Node: 0x42-SEM2</span>
        </div>
        <div className="flex items-center gap-3">
          <span>Engine: Node/Express + Vite</span>
          <span>//</span>
          <span>Integrated via Gemini AI</span>
        </div>
      </footer>
    </div>
  );
}
