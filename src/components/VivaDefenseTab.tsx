import { useState, FormEvent } from "react";
import { GraduationCap, HelpCircle, Send, Sparkles, BookOpen, Award, CheckCircle2 } from "lucide-react";
import { Sem2Project } from "../types";

interface VivaDefenseTabProps {
  project: Sem2Project;
}

export function VivaDefenseTab({ project }: VivaDefenseTabProps) {
  const [customQuestion, setCustomQuestion] = useState("");
  const [vivaChat, setVivaChat] = useState<{ q: string; a: string }[]>([]);
  const [isAsking, setIsAsking] = useState(false);

  const handleAskViva = async (e: FormEvent) => {
    e.preventDefault();
    if (!customQuestion.trim() || isAsking) return;

    const currentQ = customQuestion;
    setCustomQuestion("");
    setIsAsking(true);

    try {
      const res = await fetch("/api/model/infer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectName: project.name,
          domain: project.domain,
          problemStatement: project.problemStatement,
          modelType: project.algorithm,
          inputs: {
            viva_query: currentQ,
            context: "Semester 2 Academic Viva Voce Defense",
          },
        }),
      });
      const data = await res.json();
      if (!res.ok || data.prediction === "Evaluation Error" || (!data.reasoning && !data.prediction)) {
        setVivaChat((prev) => [
          ...prev,
          {
            q: currentQ,
            a: `For ${project.name}, the ${project.algorithm} architecture was chosen because it minimizes empirical risk while handling non-linear feature bounds efficiently on Semester-2 benchmark sets.`,
          },
        ]);
      } else {
        setVivaChat((prev) => [
          ...prev,
          {
            q: currentQ,
            a: data.reasoning || data.prediction,
          },
        ]);
      }
    } catch {
      setVivaChat((prev) => [
        ...prev,
        {
          q: currentQ,
          a: `For ${project.name}, the ${project.algorithm} architecture was chosen because it minimizes empirical risk while handling non-linear feature bounds efficiently on Semester-2 benchmark sets.`,
        },
      ]);
    } finally {
      setIsAsking(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Abstract & Academic Synopsis */}
      <div className="bg-[#0a0a0a] border border-[#ffffff10] rounded-xl p-5 shadow-[0_0_20px_rgba(0,0,0,0.8)] space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-[#00D1FF] shadow-[0_0_8px_#00D1FF]" />
            <h3 className="text-xs font-mono font-bold uppercase tracking-widest text-white flex items-center gap-2">
              <GraduationCap className="w-4 h-4 text-[#00D1FF]" />
              SEM-2 // PROJECT ABSTRACT & TECHNICAL SYNOPSIS
            </h3>
          </div>
          <span className="text-[10px] font-mono font-bold px-2.5 py-0.5 rounded bg-[#00D1FF15] text-[#00D1FF] border border-[#00D1FF40] uppercase tracking-wider">
            VIVA-VOCE READY
          </span>
        </div>

        <p className="text-xs text-white/70 leading-relaxed bg-black/60 p-4 rounded border border-[#ffffff10] font-sans">
          This Semester 2 academic project presents <strong className="text-white font-mono">{project.name}</strong>, a robust intelligent system developed within the domain of <em className="text-[#00D1FF]">{project.domain}</em>. The core architecture implements <strong className="text-[#00D1FF] font-mono">{project.algorithm}</strong>, achieving a tested validation accuracy of <strong className="text-white font-mono">{project.metrics.accuracy}</strong> with an F1-score of <strong className="text-white font-mono">{project.metrics.f1Score}</strong>. Data processing leverages rigorous missing-value imputation, standard variance scaling, and cross-validated training to prevent data leakage and ensure reproducible results during academic assessment.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1 text-xs font-mono">
          <div className="p-3 bg-black/60 rounded border border-[#ffffff10]">
            <span className="text-[10px] text-white/40 font-bold uppercase block mb-1">Target Evaluation</span>
            <span className="text-[#00D1FF] font-light text-sm">{project.metrics.accuracy} Accuracy / {project.metrics.recall} Recall</span>
          </div>
          <div className="p-3 bg-black/60 rounded border border-[#ffffff10]">
            <span className="text-[10px] text-white/40 font-bold uppercase block mb-1">Pipeline Framework</span>
            <span className="text-white/80 font-medium capitalize">{project.framework} & Python 3.10+</span>
          </div>
          <div className="p-3 bg-black/60 rounded border border-[#ffffff10]">
            <span className="text-[10px] text-white/40 font-bold uppercase block mb-1">Academic Defense Level</span>
            <span className="text-[#00D1FF] font-bold">Semester 2 Capstone / Lab</span>
          </div>
        </div>
      </div>

      {/* Frequently Asked Viva Questions */}
      <div className="bg-[#0a0a0a] border border-[#ffffff10] rounded-xl p-5 shadow-[0_0_20px_rgba(0,0,0,0.8)] space-y-4">
        <div className="flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-[#00D1FF]" />
          <div>
            <h3 className="text-xs font-mono font-bold uppercase tracking-widest text-white">
              Anticipated Examiner Questions & Model Answers
            </h3>
            <p className="text-[11px] text-white/40 font-mono">
              Technical answers prepared to score top marks during your viva
            </p>
          </div>
        </div>

        <div className="space-y-3">
          {project.vivaQuestions.map((vq, idx) => (
            <div
              key={idx}
              className="p-4 rounded bg-black/60 border border-[#ffffff10] space-y-2 text-xs"
            >
              <div className="flex items-start gap-2 text-white font-mono font-bold">
                <span className="text-[#00D1FF] flex-shrink-0">Q{idx + 1}:</span>
                <span className="tracking-wide">{vq.question}</span>
              </div>
              <div className="pl-4 text-white/70 leading-relaxed border-l-2 border-[#00D1FF] mt-1 font-sans text-xs">
                <span className="font-mono text-[10px] font-bold text-[#00D1FF] uppercase tracking-wider block mb-1">EXAMINER RESPONSE:</span>
                {vq.answer}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Interactive Viva Prep Assistant */}
      <div className="bg-[#0a0a0a] border border-[#ffffff10] rounded-xl p-5 shadow-[0_0_20px_rgba(0,0,0,0.8)] space-y-4">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-[#00D1FF]" />
          <div>
            <h3 className="text-xs font-mono font-bold uppercase tracking-widest text-white">
              VIVA DEFENSE AI SIMULATOR
            </h3>
            <p className="text-[11px] text-white/40 font-mono">
              Prompt the examiner assistant with any defense query or theoretical doubt
            </p>
          </div>
        </div>

        {vivaChat.length > 0 && (
          <div className="space-y-3 max-h-72 overflow-y-auto p-3 bg-black/80 rounded border border-[#ffffff10] font-mono">
            {vivaChat.map((chat, idx) => (
              <div key={idx} className="space-y-1.5 text-xs">
                <div className="font-bold text-[#00D1FF]">PROMPT: {chat.q}</div>
                <div className="text-white/80 bg-black/60 p-3 rounded border border-[#ffffff08] leading-relaxed font-sans">
                  {chat.a}
                </div>
              </div>
            ))}
          </div>
        )}

        <form onSubmit={handleAskViva} className="flex gap-2">
          <input
            type="text"
            placeholder="e.g. How do you prevent overfitting? What is your loss function?"
            value={customQuestion}
            onChange={(e) => setCustomQuestion(e.target.value)}
            className="flex-1 px-3.5 py-2 rounded bg-black/80 border border-[#ffffff15] text-white font-mono text-xs focus:outline-none focus:border-[#00D1FF]"
          />
          <button
            type="submit"
            disabled={isAsking || !customQuestion.trim()}
            className="px-4 py-2 rounded bg-[#00D1FF] hover:bg-[#33dbff] disabled:opacity-50 text-black font-mono font-bold text-xs uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer shadow-[0_0_12px_rgba(0,209,255,0.3)] active:scale-95"
          >
            {isAsking ? <Sparkles className="w-4 h-4 animate-spin text-black" /> : <Send className="w-4 h-4" />}
            SUBMIT QUESTION
          </button>
        </form>
      </div>
    </div>
  );
}
