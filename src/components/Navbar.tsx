import { Cpu, Layers, Sparkles, Activity, Sliders, LogIn, LogOut, User as UserIcon } from "lucide-react";
import { Sem2Project } from "../types";
import { useAuth } from "../lib/AuthContext";

interface NavbarProps {
  currentProject: Sem2Project;
  onOpenModal?: () => void;
  hasApi: boolean;
}

export function Navbar({ currentProject, onOpenModal, hasApi }: NavbarProps) {
  const { user, signInWithGoogle, signOut, loading } = useAuth();

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
              <span className="px-2 py-0.5 text-[10px] bg-[#00D1FF20] text-[#00D1FF] border border-[#00D1FF40] rounded font-mono font-bold tracking-wider uppercase flex items-center gap-1">
                SEARCH & RESCUE
              </span>
            </div>
            <p className="text-[11px] text-white/40 font-mono hidden sm:block tracking-wide">
              TARGET PERSON LOCATOR // BELLMAN VALUE ITERATION & DEEP Q-LEARNING
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

          {/* Google Auth / Firebase Profile Button */}
          {user ? (
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-black/60 border border-emerald-500/40 text-xs font-mono">
                {user.photoURL ? (
                  <img
                    src={user.photoURL}
                    alt={user.displayName || "User"}
                    className="w-4 h-4 rounded-full border border-emerald-400"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <UserIcon className="w-3.5 h-3.5 text-emerald-400" />
                )}
                <span className="text-white max-w-[100px] truncate text-[11px]">
                  {user.displayName || user.email?.split("@")[0]}
                </span>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" title="Connected to Firebase" />
              </div>
              <button
                onClick={() => signOut()}
                className="p-1.5 rounded-lg bg-black/60 hover:bg-rose-950/40 border border-[#ffffff15] hover:border-rose-500 text-white/60 hover:text-rose-400 transition-colors cursor-pointer"
                title="Sign out of Firebase"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => signInWithGoogle()}
              disabled={loading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 border border-white/20 text-white text-xs font-mono font-bold transition-all cursor-pointer shadow-sm disabled:opacity-50"
              title="Sign in with Google to sync recent paths and custom maps with Firestore"
            >
              <LogIn className="w-3.5 h-3.5 text-[#00D1FF]" />
              <span>SIGN IN</span>
            </button>
          )}

          <button
            onClick={onOpenModal}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#ffffff08] hover:bg-[#00D1FF15] border border-[#00D1FF40] hover:border-[#00D1FF] text-xs font-mono text-white transition-all cursor-pointer shadow-sm group"
            title="Open Model Specifications & Calibration Modal"
          >
            <Sliders className="w-3.5 h-3.5 text-[#00D1FF] group-hover:rotate-45 transition-transform" />
            <span className="max-w-[120px] sm:max-w-[220px] truncate font-bold text-white">
              {currentProject.name}
            </span>
            <span className="px-1.5 py-0.5 rounded bg-[#00D1FF20] text-[10px] text-[#00D1FF] border border-[#00D1FF40] group-hover:bg-[#00D1FF] group-hover:text-black transition-colors font-bold">
              [CALIBRATE MODAL]
            </span>
          </button>
        </div>
      </div>
    </header>
  );
}

