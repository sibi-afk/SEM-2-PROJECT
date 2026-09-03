import { useState, useEffect, useRef, useMemo } from "react";
import * as d3 from "d3";
import {
  Layers,
  Cpu,
  Zap,
  Maximize2,
  Play,
  Pause,
  Info,
  Table as TableIcon,
  Activity,
  CheckCircle2,
  Database,
} from "lucide-react";
import { NetworkLayer, Sem2Project } from "../types";
import { getProjectLayers } from "../utils/architectureLayers";

interface NetworkArchitectureD3Props {
  project: Sem2Project;
  batchSize?: number;
}

export function NetworkArchitectureD3({ project, batchSize = 32 }: NetworkArchitectureD3Props) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [selectedLayerId, setSelectedLayerId] = useState<string | null>(null);
  const [hoveredLayerId, setHoveredLayerId] = useState<string | null>(null);
  const [isFlowing, setIsFlowing] = useState<boolean>(true);
  const [viewMode, setViewMode] = useState<"graph" | "table">("graph");
  const [dimensions, setDimensions] = useState<{ width: number; height: number }>({
    width: 900,
    height: 480,
  });

  // Dynamically derive layers for the currently selected project
  const layers: NetworkLayer[] = useMemo(() => {
    return getProjectLayers(project, { batchSize });
  }, [project, batchSize]);

  // Set default selected layer on load or when project changes
  useEffect(() => {
    if (layers.length > 0) {
      // default select first dense layer or input layer
      const firstDense = layers.find((l) => l.type.includes("Dense") || l.weightsCount > 0);
      setSelectedLayerId(firstDense ? firstDense.id : layers[0].id);
    }
  }, [layers]);

  // Measure container dimensions with ResizeObserver
  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width } = entry.contentRect;
        if (width > 0) {
          setDimensions({
            width: Math.max(720, Math.floor(width)),
            height: 440,
          });
        }
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  // Summary Metrics
  const totalParams = useMemo(() => layers.reduce((acc, l) => acc + l.totalParams, 0), [layers]);
  const trainableParams = useMemo(
    () => layers.filter((l) => l.trainable).reduce((acc, l) => acc + l.totalParams, 0),
    [layers]
  );
  const memoryKb = useMemo(() => ((totalParams * 4) / 1024).toFixed(1), [totalParams]);

  // Currently inspected layer
  const activeLayer = useMemo(() => {
    return (
      layers.find((l) => l.id === (hoveredLayerId || selectedLayerId)) || layers[0] || null
    );
  }, [layers, hoveredLayerId, selectedLayerId]);

  // D3 Rendering effect
  useEffect(() => {
    if (viewMode !== "graph" || !svgRef.current || layers.length === 0) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const { width, height } = dimensions;
    const margin = { top: 75, right: 50, bottom: 65, left: 50 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    // Defs for gradients, glowing filters, and markers
    const defs = svg.append("defs");

    // Glow filter
    const filter = defs.append("filter").attr("id", "cyan-glow").attr("x", "-50%").attr("y", "-50%").attr("width", "200%").attr("height", "200%");
    filter.append("feGaussianBlur").attr("stdDeviation", "3").attr("result", "coloredBlur");
    const feMerge = filter.append("feMerge");
    feMerge.append("feMergeNode").attr("in", "coloredBlur");
    feMerge.append("feMergeNode").attr("in", "SourceGraphic");

    // Grid pattern background inside graph
    const pattern = defs
      .append("pattern")
      .attr("id", "d3-grid")
      .attr("width", 24)
      .attr("height", 24)
      .attr("patternUnits", "userSpaceOnUse");
    pattern
      .append("circle")
      .attr("cx", 1.5)
      .attr("cy", 1.5)
      .attr("r", 1)
      .attr("fill", "#00D1FF")
      .attr("opacity", 0.12);

    // Background rect
    svg
      .append("rect")
      .attr("width", width)
      .attr("height", height)
      .attr("fill", "#040404");

    svg
      .append("rect")
      .attr("width", width)
      .attr("height", height)
      .attr("fill", "url(#d3-grid)");

    const g = svg
      .append("g")
      .attr("transform", `translate(${margin.left}, ${margin.top})`);

    // X Scale for Layer Columns
    const numLayers = layers.length;
    const xStep = numLayers > 1 ? innerWidth / (numLayers - 1) : innerWidth / 2;

    // Node count visualization per layer: sample between 3 and 7 node dots
    const layerPositions = layers.map((layer, index) => {
      const x = index * xStep;
      // determine number of visual neuron circles to show (capped between 3 and 6)
      const visualNodeCount = Math.min(6, Math.max(3, Math.min(layer.units, 6)));
      const nodeSpacing = innerHeight / (visualNodeCount + 1);
      const nodes = d3.range(visualNodeCount).map((i) => ({
        id: `${layer.id}_n${i}`,
        layerId: layer.id,
        layerIndex: index,
        x,
        y: (i + 1) * nodeSpacing,
      }));

      return {
        ...layer,
        index,
        x,
        nodes,
        visualNodeCount,
      };
    });

    // 1. Draw Synaptic Links between adjacent layers
    const linkGroup = g.append("g").attr("class", "links-group");

    for (let i = 0; i < layerPositions.length - 1; i++) {
      const sourceLayer = layerPositions[i];
      const targetLayer = layerPositions[i + 1];

      // Draw bezier curves between nodes
      sourceLayer.nodes.forEach((sNode) => {
        targetLayer.nodes.forEach((tNode) => {
          const isConnectedToSelected =
            selectedLayerId === sourceLayer.id || selectedLayerId === targetLayer.id;
          const isConnectedToHovered =
            hoveredLayerId === sourceLayer.id || hoveredLayerId === targetLayer.id;

          const isHighlighted = isConnectedToHovered || isConnectedToSelected;

          const pathD = d3.linkHorizontal()({
            source: [sNode.x, sNode.y],
            target: [tNode.x, tNode.y],
          });

          linkGroup
            .append("path")
            .attr("d", pathD as string)
            .attr("fill", "none")
            .attr("stroke", isHighlighted ? "#00D1FF" : "#ffffff")
            .attr("stroke-width", isHighlighted ? 1.5 : 0.6)
            .attr("stroke-opacity", isHighlighted ? 0.65 : 0.12)
            .attr("class", `link link-${sourceLayer.id} link-${targetLayer.id}`)
            .style("transition", "stroke-opacity 0.2s, stroke-width 0.2s");
        });
      });
    }

    // 2. Optional Flow animation particles along synaptic pathways
    if (isFlowing) {
      const flowGroup = g.append("g").attr("class", "flow-group");
      for (let i = 0; i < layerPositions.length - 1; i++) {
        const sourceLayer = layerPositions[i];
        const targetLayer = layerPositions[i + 1];

        // create 2 animated flow lines per layer bridge
        const sNode = sourceLayer.nodes[Math.floor(sourceLayer.nodes.length / 2)];
        const tNode = targetLayer.nodes[Math.floor(targetLayer.nodes.length / 2)];

        const pathD = d3.linkHorizontal()({
          source: [sNode.x, sNode.y],
          target: [tNode.x, tNode.y],
        });

        const flowPath = flowGroup
          .append("path")
          .attr("d", pathD as string)
          .attr("fill", "none")
          .attr("stroke", "#00D1FF")
          .attr("stroke-width", 2)
          .attr("stroke-dasharray", "6,12")
          .attr("stroke-opacity", 0.8)
          .attr("filter", "url(#cyan-glow)");

        // Animate stroke dashoffset
        function animateFlow() {
          flowPath
            .attr("stroke-dashoffset", 36)
            .transition()
            .duration(1600 + i * 200)
            .ease(d3.easeLinear)
            .attr("stroke-dashoffset", 0)
            .on("end", animateFlow);
        }
        animateFlow();
      }
    }

    // 3. Draw Layer Cards & Visual Nodes
    const layerGroup = g.append("g").attr("class", "layers-group");

    layerPositions.forEach((l) => {
      const isSelected = selectedLayerId === l.id;
      const isHovered = hoveredLayerId === l.id;
      const active = isSelected || isHovered;

      // Column Group
      const colG = layerGroup
        .append("g")
        .attr("class", `layer-col layer-${l.id}`)
        .attr("cursor", "pointer")
        .on("mouseenter", () => setHoveredLayerId(l.id))
        .on("mouseleave", () => setHoveredLayerId(null))
        .on("click", () => setSelectedLayerId(l.id));

      // Layer Boundary Card Track
      const cardWidth = Math.min(130, Math.max(90, xStep - 20));
      const cardX = l.x - cardWidth / 2;
      const cardHeight = innerHeight + 10;
      const cardY = -5;

      // Ambient background glow for active layer
      if (active) {
        colG
          .append("rect")
          .attr("x", cardX - 3)
          .attr("y", cardY - 3)
          .attr("width", cardWidth + 6)
          .attr("height", cardHeight + 6)
          .attr("rx", 10)
          .attr("fill", "none")
          .attr("stroke", "#00D1FF")
          .attr("stroke-width", 1.5)
          .attr("opacity", 0.6)
          .attr("filter", "url(#cyan-glow)");
      }

      // Column Container Box
      colG
        .append("rect")
        .attr("x", cardX)
        .attr("y", cardY)
        .attr("width", cardWidth)
        .attr("height", cardHeight)
        .attr("rx", 8)
        .attr("fill", active ? "#00D1FF0c" : "#080808c0")
        .attr("stroke", active ? "#00D1FF" : "#ffffff15")
        .attr("stroke-width", active ? 1.5 : 1)
        .style("transition", "all 0.2s");

      // Column Header: Layer Tag (L0, L1...)
      colG
        .append("text")
        .attr("x", l.x)
        .attr("y", -18)
        .attr("text-anchor", "middle")
        .attr("fill", active ? "#00D1FF" : "#ffffff60")
        .attr("font-size", "10px")
        .attr("font-family", "monospace")
        .attr("font-weight", "bold")
        .text(`[L${l.index}]`);

      // Column Header: Layer Name (truncated if needed)
      const cleanName = l.name.length > 14 ? l.name.slice(0, 13) + "…" : l.name;
      colG
        .append("text")
        .attr("x", l.x)
        .attr("y", -32)
        .attr("text-anchor", "middle")
        .attr("fill", active ? "#ffffff" : "#ffffffb0")
        .attr("font-size", "11px")
        .attr("font-family", "monospace")
        .attr("font-weight", "bold")
        .text(cleanName);

      // Activation Badge inside top of card
      if (l.activation && l.activation !== "None") {
        const actBadgeY = 12;
        const actBgColor =
          l.activation.includes("Softmax")
            ? "#F59E0B25"
            : l.activation.includes("GELU")
            ? "#A855F725"
            : l.activation.includes("Sigmoid")
            ? "#38BDF825"
            : "#00D1FF25";

        const actTextColor =
          l.activation.includes("Softmax")
            ? "#F59E0B"
            : l.activation.includes("GELU")
            ? "#C084FC"
            : l.activation.includes("Sigmoid")
            ? "#38BDF8"
            : "#00D1FF";

        colG
          .append("rect")
          .attr("x", l.x - 38)
          .attr("y", actBadgeY)
          .attr("width", 76)
          .attr("height", 18)
          .attr("rx", 4)
          .attr("fill", actBgColor)
          .attr("stroke", actTextColor)
          .attr("stroke-width", 0.75);

        colG
          .append("text")
          .attr("x", l.x)
          .attr("y", actBadgeY + 12)
          .attr("text-anchor", "middle")
          .attr("fill", actTextColor)
          .attr("font-size", "9px")
          .attr("font-family", "monospace")
          .attr("font-weight", "bold")
          .text(l.activation);
      } else {
        // Linear / Identity
        colG
          .append("text")
          .attr("x", l.x)
          .attr("y", 24)
          .attr("text-anchor", "middle")
          .attr("fill", "#ffffff35")
          .attr("font-size", "9px")
          .attr("font-family", "monospace")
          .text("Linear / Id");
      }

      // Neuron Dots inside column
      l.nodes.forEach((node) => {
        // Outer halo on active
        if (active) {
          colG
            .append("circle")
            .attr("cx", node.x)
            .attr("cy", node.y)
            .attr("r", 7)
            .attr("fill", "none")
            .attr("stroke", "#00D1FF")
            .attr("stroke-width", 1)
            .attr("opacity", 0.5)
            .attr("filter", "url(#cyan-glow)");
        }

        // Inner neuron circle
        colG
          .append("circle")
          .attr("cx", node.x)
          .attr("cy", node.y)
          .attr("r", 4.5)
          .attr("fill", active ? "#00D1FF" : "#1a1a1a")
          .attr("stroke", active ? "#ffffff" : "#ffffff40")
          .attr("stroke-width", 1.2);
      });

      // Unit count indicator between or below nodes
      colG
        .append("text")
        .attr("x", l.x)
        .attr("y", innerHeight - 24)
        .attr("text-anchor", "middle")
        .attr("fill", active ? "#00D1FF" : "#ffffff80")
        .attr("font-size", "10px")
        .attr("font-family", "monospace")
        .attr("font-weight", "600")
        .text(`${l.units} Units`);

      // Parameter Count Badge at the bottom of the card
      const paramText =
        l.totalParams > 0 ? `${d3.format(",")(l.totalParams)} params` : "0 params";

      colG
        .append("rect")
        .attr("x", l.x - cardWidth / 2 + 6)
        .attr("y", innerHeight - 12)
        .attr("width", cardWidth - 12)
        .attr("height", 16)
        .attr("rx", 3)
        .attr("fill", l.totalParams > 0 ? (active ? "#00D1FF20" : "#ffffff08") : "#00000040")
        .attr("stroke", l.totalParams > 0 ? (active ? "#00D1FF50" : "#ffffff15") : "#ffffff08")
        .attr("stroke-width", 0.75);

      colG
        .append("text")
        .attr("x", l.x)
        .attr("y", innerHeight)
        .attr("text-anchor", "middle")
        .attr("fill", l.totalParams > 0 ? (active ? "#00D1FF" : "#ffffff90") : "#ffffff30")
        .attr("font-size", "8.5px")
        .attr("font-family", "monospace")
        .text(paramText);

      // Bottom Dimension Subtitle: e.g. [B, 64]
      colG
        .append("text")
        .attr("x", l.x)
        .attr("y", innerHeight + 22)
        .attr("text-anchor", "middle")
        .attr("fill", "#ffffff50")
        .attr("font-size", "9.5px")
        .attr("font-family", "monospace")
        .text(l.shape);
    });
  }, [dimensions, layers, selectedLayerId, hoveredLayerId, isFlowing, viewMode]);

  return (
    <div className="bg-[#0a0a0a] border border-[#ffffff10] rounded-xl p-5 shadow-[0_0_25px_rgba(0,0,0,0.85)] space-y-5">
      {/* Top Header & Architectural Telemetry */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-[#ffffff10] pb-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-2.5 h-2.5 rounded-full bg-[#00D1FF] shadow-[0_0_8px_#00D1FF] animate-pulse" />
            <h3 className="text-xs font-mono font-bold uppercase tracking-widest text-white flex items-center gap-2">
              <Cpu className="w-4 h-4 text-[#00D1FF]" />
              D3 // TENSOR NETWORK TOPOLOGY & ACTIVATIONS
            </h3>
          </div>
          <p className="text-[11px] text-white/40 font-mono">
            Interactive computational graph: layer depths, activation functions, and exact parameter matrices
          </p>
        </div>

        {/* View Mode & Animation Controls */}
        <div className="flex items-center gap-2 self-start lg:self-auto">
          <div className="flex items-center bg-black/80 p-1 rounded border border-[#ffffff15]">
            <button
              onClick={() => setViewMode("graph")}
              className={`px-3 py-1 rounded text-xs font-mono flex items-center gap-1.5 transition-all cursor-pointer ${
                viewMode === "graph"
                  ? "bg-[#00D1FF20] text-[#00D1FF] border border-[#00D1FF40] shadow-[0_0_8px_rgba(0,209,255,0.2)]"
                  : "text-white/40 hover:text-white"
              }`}
            >
              <Activity className="w-3.5 h-3.5" />
              D3 Graph
            </button>
            <button
              onClick={() => setViewMode("table")}
              className={`px-3 py-1 rounded text-xs font-mono flex items-center gap-1.5 transition-all cursor-pointer ${
                viewMode === "table"
                  ? "bg-[#00D1FF20] text-[#00D1FF] border border-[#00D1FF40] shadow-[0_0_8px_rgba(0,209,255,0.2)]"
                  : "text-white/40 hover:text-white"
              }`}
            >
              <TableIcon className="w-3.5 h-3.5" />
              Tensor Schema
            </button>
          </div>

          {viewMode === "graph" && (
            <button
              onClick={() => setIsFlowing(!isFlowing)}
              title={isFlowing ? "Pause Tensor Forward-Pass Animation" : "Resume Tensor Forward-Pass Animation"}
              className={`p-1.5 rounded border transition-all cursor-pointer ${
                isFlowing
                  ? "bg-[#00D1FF15] border-[#00D1FF40] text-[#00D1FF]"
                  : "bg-black/60 border-[#ffffff15] text-white/40 hover:text-white"
              }`}
            >
              {isFlowing ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
            </button>
          )}
        </div>
      </div>

      {/* Model Parameter & Capacity Telemetry Banner */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 font-mono text-xs">
        <div className="p-3 bg-black/60 rounded border border-[#ffffff10]">
          <span className="text-[10px] text-white/40 uppercase block mb-1">TOTAL PARAMS</span>
          <span className="text-base font-light text-[#00D1FF]">
            {d3.format(",")(totalParams)}
          </span>
        </div>
        <div className="p-3 bg-black/60 rounded border border-[#ffffff10]">
          <span className="text-[10px] text-white/40 uppercase block mb-1">TRAINABLE PARAMS</span>
          <span className="text-base font-light text-white">
            {d3.format(",")(trainableParams)}
          </span>
        </div>
        <div className="p-3 bg-black/60 rounded border border-[#ffffff10]">
          <span className="text-[10px] text-white/40 uppercase block mb-1">NETWORK DEPTH</span>
          <span className="text-base font-light text-[#00D1FF]">
            {layers.length} Layers
          </span>
        </div>
        <div className="p-3 bg-black/60 rounded border border-[#ffffff10]">
          <span className="text-[10px] text-white/40 uppercase block mb-1">EST. MEMORY (FP32)</span>
          <span className="text-base font-light text-white">
            ~{memoryKb} KB
          </span>
        </div>
        <div className="p-3 bg-black/60 rounded border border-[#ffffff10] col-span-2 sm:col-span-1">
          <span className="text-[10px] text-white/40 uppercase block mb-1">BATCH SHAPE</span>
          <span className="text-base font-light text-[#00D1FF]">
            B = {batchSize}
          </span>
        </div>
      </div>

      {/* Primary Visualization Area */}
      {viewMode === "graph" ? (
        <div
          ref={containerRef}
          className="w-full relative border border-[#ffffff10] rounded-xl overflow-hidden bg-black/90 shadow-[inset_0_0_30px_rgba(0,0,0,0.9)]"
        >
          {/* Subtle Top Legend Bar */}
          <div className="absolute top-2.5 left-3 right-3 z-10 flex items-center justify-between pointer-events-none">
            <div className="text-[10px] font-mono text-white/40 uppercase tracking-wider flex items-center gap-2">
              <span className="inline-block w-2 h-2 rounded-full bg-[#00D1FF]" />
              <span>Forward Synaptic Flow // Click any layer to inspect parameter math</span>
            </div>
            <div className="hidden sm:flex items-center gap-3 text-[10px] font-mono text-white/40">
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-sm bg-[#00D1FF]" /> ReLU/Linear
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-sm bg-[#F59E0B]" /> Softmax
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-sm bg-[#A855F7]" /> GELU
              </span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <svg
              ref={svgRef}
              width={dimensions.width}
              height={dimensions.height}
              className="w-full block select-none"
            />
          </div>
        </div>
      ) : (
        /* Tabular Tensor Schema View */
        <div className="border border-[#ffffff10] rounded-xl overflow-x-auto bg-black/80 font-mono text-xs">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[#ffffff15] bg-[#050505] text-[10px] text-white/40 uppercase tracking-widest">
                <th className="p-3">Layer (Type)</th>
                <th className="p-3">Output Shape</th>
                <th className="p-3">Activation</th>
                <th className="p-3 text-right">Weights</th>
                <th className="p-3 text-right">Biases</th>
                <th className="p-3 text-right">Total Params</th>
                <th className="p-3">Trainable</th>
                <th className="p-3">Inspect</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#ffffff08]">
              {layers.map((l, idx) => {
                const isSelected = selectedLayerId === l.id;
                return (
                  <tr
                    key={l.id}
                    onClick={() => setSelectedLayerId(l.id)}
                    className={`transition-colors cursor-pointer ${
                      isSelected
                        ? "bg-[#00D1FF10] text-white"
                        : "hover:bg-white/5 text-white/70"
                    }`}
                  >
                    <td className="p-3 font-semibold">
                      <div className="flex items-center gap-2">
                        <span className="text-[#00D1FF] text-[10px]">L{idx}</span>
                        <div>
                          <div className="text-white">{l.name}</div>
                          <div className="text-[10px] text-white/40">{l.type}</div>
                        </div>
                      </div>
                    </td>
                    <td className="p-3 text-white/80 font-mono">{l.shape}</td>
                    <td className="p-3">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          l.activation.includes("Softmax")
                            ? "bg-amber-950/40 text-amber-400 border border-amber-800"
                            : l.activation.includes("GELU")
                            ? "bg-purple-950/40 text-purple-400 border border-purple-800"
                            : l.activation !== "None"
                            ? "bg-[#00D1FF15] text-[#00D1FF] border border-[#00D1FF40]"
                            : "bg-white/5 text-white/40 border border-white/10"
                        }`}
                      >
                        {l.activation}
                      </span>
                    </td>
                    <td className="p-3 text-right text-white/70">
                      {d3.format(",")(l.weightsCount)}
                    </td>
                    <td className="p-3 text-right text-white/70">
                      {d3.format(",")(l.biasesCount)}
                    </td>
                    <td className="p-3 text-right font-bold text-[#00D1FF]">
                      {d3.format(",")(l.totalParams)}
                    </td>
                    <td className="p-3">
                      {l.trainable ? (
                        <span className="text-emerald-400 flex items-center gap-1 text-[11px]">
                          <CheckCircle2 className="w-3.5 h-3.5" /> True
                        </span>
                      ) : (
                        <span className="text-white/30 text-[11px]">Fixed / False</span>
                      )}
                    </td>
                    <td className="p-3">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedLayerId(l.id);
                        }}
                        className="px-2 py-1 rounded bg-black/60 border border-[#ffffff15] hover:border-[#00D1FF] text-[10px] text-white/60 hover:text-[#00D1FF]"
                      >
                        Select
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Selected Layer Tensor Inspector Panel */}
      {activeLayer && (
        <div className="bg-black/60 border border-[#ffffff15] rounded-xl p-4 font-mono text-xs space-y-3 relative overflow-hidden">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#ffffff10] pb-2.5">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded bg-[#00D1FF20] text-[#00D1FF] border border-[#00D1FF40] font-bold text-[10px]">
                INSPECTING // {activeLayer.name}
              </span>
              <span className="text-white/40 text-[11px]">({activeLayer.type})</span>
            </div>
            <div className="flex items-center gap-3 text-[11px]">
              <span className="text-white/50">Tensor Shape:</span>
              <span className="text-white font-bold bg-white/5 px-2 py-0.5 rounded border border-white/10">
                {activeLayer.shape}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
            {/* Column 1: Mathematical Formula & Function */}
            <div className="p-3 rounded bg-[#ffffff03] border border-[#ffffff08] space-y-1.5">
              <span className="text-[10px] text-[#00D1FF] font-bold uppercase tracking-wider block">
                01 // Mathematical Transformation
              </span>
              <div className="p-2 rounded bg-black border border-[#ffffff10] text-[#00D1FF] text-xs font-mono">
                {activeLayer.formula || "y = f(Wx + b)"}
              </div>
              <p className="text-[11px] text-white/60 font-sans leading-relaxed">
                {activeLayer.description}
              </p>
            </div>

            {/* Column 2: Activation Function & Derivatives */}
            <div className="p-3 rounded bg-[#ffffff03] border border-[#ffffff08] space-y-1.5">
              <span className="text-[10px] text-[#00D1FF] font-bold uppercase tracking-wider block">
                02 // Activation Mechanics
              </span>
              <div className="flex items-center justify-between">
                <span className="text-white/70">Activation Strategy:</span>
                <span className="text-white font-bold px-2 py-0.5 rounded bg-white/10 text-[11px]">
                  {activeLayer.activation}
                </span>
              </div>
              <div className="text-[11px] text-white/50 font-sans leading-relaxed pt-1">
                {activeLayer.activation === "ReLU" &&
                  "Rectified Linear Unit computes f(x) = max(0, x), preventing vanishing gradients for positive activations."}
                {activeLayer.activation === "Softmax" &&
                  "Normalizes unscaled logits into a valid probability distribution summing to exactly 1.0."}
                {activeLayer.activation === "LeakyReLU" &&
                  "Allows a small non-zero gradient (α=0.01) when x < 0, resolving the 'dying ReLU' neuron issue."}
                {activeLayer.activation === "GELU" &&
                  "Gaussian Error Linear Unit weights inputs by their value rather than gating by sign, standard in modern Transformers."}
                {activeLayer.activation === "Sigmoid" &&
                  "Squashes activations between (0, 1), acting as a logistic probability gate."}
                {activeLayer.activation === "Linear" &&
                  "Identity pass-through preserving unconstrained real-valued latent vector coordinates."}
                {activeLayer.activation === "None" &&
                  "Non-activated layer (e.g. raw input features, pooling, or spatial re-sampling)."}
              </div>
            </div>

            {/* Column 3: Parameter Decomposition & Memory */}
            <div className="p-3 rounded bg-[#ffffff03] border border-[#ffffff08] space-y-2">
              <span className="text-[10px] text-[#00D1FF] font-bold uppercase tracking-wider block">
                03 // Parameter Decomposition
              </span>
              <div className="space-y-1 text-[11px]">
                <div className="flex justify-between">
                  <span className="text-white/50">Weight Matrix (W):</span>
                  <span className="text-white font-mono">
                    {d3.format(",")(activeLayer.weightsCount)} params
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-white/50">Bias Vector (b):</span>
                  <span className="text-white font-mono">
                    {d3.format(",")(activeLayer.biasesCount)} params
                  </span>
                </div>
                <div className="flex justify-between border-t border-white/10 pt-1">
                  <span className="text-[#00D1FF] font-bold">Total Layer Params:</span>
                  <span className="text-[#00D1FF] font-bold font-mono">
                    {d3.format(",")(activeLayer.totalParams)}
                  </span>
                </div>
                <div className="flex justify-between text-[10px] text-white/40 pt-0.5">
                  <span>FP32 Memory:</span>
                  <span>{((activeLayer.totalParams * 4) / 1024).toFixed(2)} KB</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
