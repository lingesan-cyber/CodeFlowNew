'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useCodeFlowStore } from '../../store/useCodeFlowStore';
import { createSpring, updateSpring } from '../../utils/spring';
import { Keyboard } from 'lucide-react';
import { Variable, StackFrame, HeapObject } from '../../engine/types';

interface RenderNode {
  id: string;
  type: 'variable' | 'frame' | 'heap' | 'pointer';
  label: string;
  subLabel?: string;
  x: { current: number; target: number; velocity: number };
  y: { current: number; target: number; velocity: number };
  width: number;
  height: number;
  data: Variable | StackFrame | HeapObject;
}

export default function VisualizerCanvas() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  
  // Zustand State
  const {
    steps,
    currentStepIndex,
    awaitingInput,
    submitInput
  } = useCodeFlowStore();

  // Zoom & Pan State
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef({ x: 0, y: 0 });

  // Spring Node Map
  const nodesRef = useRef<Map<string, RenderNode>>(new Map());
  const animationFrameIdRef = useRef<number | null>(null);

  // Input Field State
  const [inputValue, setInputValue] = useState('');

  // Handle Resize
  useEffect(() => {
    const handleResize = () => {
      const canvas = canvasRef.current;
      const container = containerRef.current;
      if (!canvas || !container) return;
      canvas.width = container.clientWidth;
      canvas.height = container.clientHeight;
    };

    window.addEventListener('resize', handleResize);
    handleResize();

    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  // Update layout coordinates for active variables, stack frames, and heap objects
  const updateLayout = useCallback((width: number, height: number) => {
    if (steps.length === 0 || currentStepIndex >= steps.length) {
      nodesRef.current.clear();
      return;
    }

    const step = steps[currentStepIndex];
    const { variables, callStack, heap } = step;

    // We will define target layouts:
    // 1. Stack frames (parameters & locals) -> Left-Center column
    // 2. Global variables -> Top-Left area
    // 3. Heap objects -> Bottom area
    // 4. Call Stack (functions) -> Right column

    const activeNodes = new Set<string>();

    // Position helper offsets
    const globalX = 50;
    let globalY = 60;
    const globalWidth = 240;

    const localX = 320;
    let localY = 60;
    const localWidth = 240;

    const stackFrameX = 600;
    const stackFrameY = 60;
    const stackFrameWidth = 180;
    const stackFrameHeight = 60;

    const heapXStart = 80;
    const heapY = height - 180;
    const heapWidth = 220;
    const heapHeight = 110;

    // --- Process Globals and Locals ---
    variables.forEach((v) => {
      const isGlobal = v.scope === 'global';
      const nodeId = `var_${v.name}_${v.scope}`;
      activeNodes.add(nodeId);

      const targetX = isGlobal ? globalX : localX;
      const targetY = isGlobal ? globalY : localY;
      const w = isGlobal ? globalWidth : localWidth;
      let h = 55;

      if (v.type.includes('[]') || v.type === 'array') {
        h = 80; // Expand for array indexing boxes
      }

      if (isGlobal) {
        globalY += h + 15;
      } else {
        localY += h + 15;
      }

      let node = nodesRef.current.get(nodeId);
      if (!node) {
        // Spawn from side
        node = {
          id: nodeId,
          type: 'variable',
          label: v.name,
          x: createSpring(targetX - 100),
          y: createSpring(targetY),
          width: w,
          height: h,
          data: v
        };
      }
      node.x.target = targetX;
      node.y.target = targetY;
      node.data = v; // Update dynamic value
      nodesRef.current.set(nodeId, node);
    });

    // --- Process Call Stack ---
    callStack.forEach((frame, index) => {
      const nodeId = `frame_${frame.functionName}_${index}`;
      activeNodes.add(nodeId);

      const targetX = stackFrameX;
      const targetY = stackFrameY + index * (stackFrameHeight + 15);

      let node = nodesRef.current.get(nodeId);
      if (!node) {
        node = {
          id: nodeId,
          type: 'frame',
          label: frame.functionName,
          x: createSpring(width + 100),
          y: createSpring(targetY),
          width: stackFrameWidth,
          height: stackFrameHeight,
          data: frame
        };
      }
      node.x.target = targetX;
      node.y.target = targetY;
      node.data = frame;
      nodesRef.current.set(nodeId, node);
    });

    // --- Process Heap ---
    heap.forEach((obj, index) => {
      const nodeId = `heap_${obj.id}`;
      activeNodes.add(nodeId);

      const targetX = heapXStart + index * (heapWidth + 25);
      const targetY = heapY;

      let node = nodesRef.current.get(nodeId);
      if (!node) {
        node = {
          id: nodeId,
          type: 'heap',
          label: obj.id,
          subLabel: obj.type,
          x: createSpring(targetX),
          y: createSpring(height + 100),
          width: heapWidth,
          height: heapHeight,
          data: obj
        };
      }
      node.x.target = targetX;
      node.y.target = targetY;
      node.data = obj;
      nodesRef.current.set(nodeId, node);
    });

    // Remove inactive nodes
    for (const [id] of nodesRef.current) {
      if (!activeNodes.has(id)) {
        nodesRef.current.delete(id);
      }
    }
  }, [steps, currentStepIndex]);

  // Main Canvas Render Loop
  useEffect(() => {
    let active = true;

    const render = () => {
      if (!active) return;
      
      const canvas = canvasRef.current;
      if (!canvas) {
        animationFrameIdRef.current = requestAnimationFrame(render);
        return;
      }
      
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        animationFrameIdRef.current = requestAnimationFrame(render);
        return;
      }

      // 1. Update Springs
      for (const [, node] of nodesRef.current) {
        node.x = updateSpring(node.x);
        node.y = updateSpring(node.y);
      }

      // Clean screen
      ctx.fillStyle = '#0F172A';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.save();
      // Apply Pan & Zoom
      ctx.translate(pan.x, pan.y);
      ctx.scale(zoom, zoom);

      // --- Draw Grid ---
      ctx.strokeStyle = '#1E293B';
      ctx.lineWidth = 1;
      const gridSize = 40;
      for (let x = -pan.x; x < canvas.width / zoom - pan.x; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, -pan.y);
        ctx.lineTo(x, canvas.height / zoom - pan.y);
        ctx.stroke();
      }
      for (let y = -pan.y; y < canvas.height / zoom - pan.y; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(-pan.x, y);
        ctx.lineTo(canvas.width / zoom - pan.x, y);
        ctx.stroke();
      }

      // Update Layout
      updateLayout(canvas.width / zoom, canvas.height / zoom);

      // --- Draw Nodes ---
      const nodes = Array.from(nodesRef.current.values());

      // Separate nodes by type
      const varNodes = nodes.filter(n => n.type === 'variable');
      const frameNodes = nodes.filter(n => n.type === 'frame');
      const heapNodes = nodes.filter(n => n.type === 'heap');

      // 1. Draw Global & Local Variable Panels Headers
      ctx.font = 'bold 11px Inter';
      ctx.fillStyle = '#94A3B8';
      if (varNodes.some(n => (n.data as Variable).scope === 'global')) {
        ctx.fillText('GLOBAL VARIABLES', 50, 40);
      }
      if (varNodes.some(n => (n.data as Variable).scope === 'local' || (n.data as Variable).scope === 'parameter')) {
        ctx.fillText('STACK FRAME LOCALS', 320, 40);
      }
      if (frameNodes.length > 0) {
        ctx.fillText('CALL STACK', 600, 40);
      }
      if (heapNodes.length > 0) {
        ctx.fillText('MEMORY HEAP (DYNAMIC)', 80, canvas.height / zoom - 210);
      }

      // 2. Draw Variable Cards
      varNodes.forEach(node => {
        const v = node.data as Variable;
        const x = node.x.current;
        const y = node.y.current;

        // Glassmorphism card drawing
        ctx.fillStyle = '#1E293B';
        ctx.strokeStyle = '#334155';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.roundRect(x, y, node.width, node.height, 8);
        ctx.fill();
        ctx.stroke();

        // Left color stripe
        ctx.fillStyle = v.scope === 'parameter' ? '#F59E0B' : '#3B82F6';
        ctx.beginPath();
        ctx.roundRect(x, y, 4, node.height, [8, 0, 0, 8]);
        ctx.fill();

        // Label name
        ctx.fillStyle = '#F8FAFC';
        ctx.font = 'semibold 13px Inter';
        ctx.fillText(node.label, x + 15, y + 22);

        // Type label
        ctx.fillStyle = '#64748B';
        ctx.font = 'bold 9px Inter';
        ctx.fillText(v.type.toUpperCase(), x + 15, y + 36);

        // Draw Value or Array Box
        if (v.type.includes('[]') || v.type === 'array') {
          // It's an array reference (points to heap object)
          // Draw small indexing boxes
          const arrayRef = v.value; // e.g. "0x1000"
          ctx.fillStyle = '#10B981';
          ctx.font = '12px JetBrains Mono';
          ctx.fillText(`ptr -> ${arrayRef || 'NULL'}`, x + node.width - 100, y + 26);
        } else {
          // Standard value
          ctx.fillStyle = '#E2E8F0';
          ctx.font = '500 13px JetBrains Mono';
          const valString = v.value === null ? 'null' : (typeof v.value === 'object' ? '{...}' : String(v.value));
          ctx.fillText(valString, x + node.width - 90, y + 26);
        }
      });

      // 3. Draw Call Stack Frames
      frameNodes.forEach((node, index) => {
        const x = node.x.current;
        const y = node.y.current;
        const isActive = index === frameNodes.length - 1;

        ctx.fillStyle = isActive ? '#1E293B' : '#0F172A';
        ctx.strokeStyle = isActive ? '#3B82F6' : '#334155';
        ctx.lineWidth = isActive ? 2 : 1;
        
        ctx.beginPath();
        ctx.roundRect(x, y, node.width, node.height, 8);
        ctx.fill();
        ctx.stroke();

        // Glow effect for active frame
        if (isActive) {
          ctx.shadowColor = 'rgba(59, 130, 246, 0.4)';
          ctx.shadowBlur = 10;
          ctx.beginPath();
          ctx.roundRect(x, y, node.width, node.height, 8);
          ctx.stroke();
          ctx.shadowBlur = 0; // reset
        }

        ctx.fillStyle = isActive ? '#F8FAFC' : '#94A3B8';
        ctx.font = 'bold 13px Inter';
        ctx.fillText(node.label, x + 15, y + 25);

        ctx.fillStyle = '#64748B';
        ctx.font = '11px Inter';
        ctx.fillText(`Line ${(node.data as StackFrame).line}`, x + 15, y + 42);
      });

      // 4. Draw Heap Cards
      heapNodes.forEach(node => {
        const x = node.x.current;
        const y = node.y.current;
        const obj = node.data as HeapObject;

        ctx.fillStyle = '#0B1329';
        ctx.strokeStyle = '#10B981';
        ctx.lineWidth = 1.5;
        
        ctx.beginPath();
        ctx.roundRect(x, y, node.width, node.height, 8);
        ctx.fill();
        ctx.stroke();

        // Hex Address
        ctx.fillStyle = '#10B981';
        ctx.font = 'bold 10px JetBrains Mono';
        ctx.fillText(node.label, x + 12, y + 20);

        // Class type
        ctx.fillStyle = '#64748B';
        ctx.font = '9px Inter';
        ctx.fillText(node.subLabel?.toUpperCase() || 'OBJECT', x + 12, y + 32);

        // If it's an array type, render slot grid
        if (Array.isArray(obj.value)) {
          const slotWidth = 32;
          const slotHeight = 30;
          const slotY = y + 50;
          
          (obj.value as unknown[]).slice(0, 5).forEach((val: unknown, idx: number) => {
            const slotX = x + 12 + idx * (slotWidth + 4);
            
            // Draw box slot
            ctx.fillStyle = '#1E293B';
            ctx.strokeStyle = '#334155';
            ctx.beginPath();
            ctx.roundRect(slotX, slotY, slotWidth, slotHeight, 4);
            ctx.fill();
            ctx.stroke();

            // Index number below
            ctx.fillStyle = '#475569';
            ctx.font = '9px JetBrains Mono';
            ctx.fillText(`[${idx}]`, slotX + 8, slotY + slotHeight + 12);

            // Value inside slot
            ctx.fillStyle = '#10B981';
            ctx.font = 'bold 11px JetBrains Mono';
            ctx.fillText(val === null ? 'n' : String(val), slotX + 10, slotY + 18);
          });
        } else if (obj.value && typeof obj.value === 'object') {
          // Object key-value pairs
          ctx.fillStyle = '#E2E8F0';
          ctx.font = '11px JetBrains Mono';
          let fieldY = y + 50;
          const valObj = obj.value as Record<string, unknown>;
          Object.keys(valObj).forEach((key) => {
            ctx.fillText(`${key}: ${valObj[key]}`, x + 12, fieldY);
            fieldY += 16;
          });
        }
      });

      // 5. Draw Pointer Arrows
      ctx.shadowBlur = 0;
      varNodes.forEach(node => {
        const v = node.data as Variable;
        if (v.isReference && v.referencedId) {
          // Find target node coordinates
          const targetNode = nodes.find(n => n.label === v.referencedId || n.id === `heap_${v.referencedId}`);
          
          if (targetNode) {
            const startX = node.x.current + node.width - 20;
            const startY = node.y.current + 22;
            const endX = targetNode.x.current + 20;
            const endY = targetNode.y.current + 25;

            // Draw line
            ctx.strokeStyle = '#10B981';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(startX, startY);
            
            // Quadratic curve
            const cpX = (startX + endX) / 2;
            const cpY = (startY + endY) / 2 - 40;
            ctx.quadraticCurveTo(cpX, cpY, endX, endY);
            ctx.stroke();

            // Arrow head
            const angle = Math.atan2(endY - cpY, endX - cpX);
            ctx.fillStyle = '#10B981';
            ctx.beginPath();
            ctx.moveTo(endX, endY);
            ctx.lineTo(endX - 10 * Math.cos(angle - Math.PI / 6), endY - 10 * Math.sin(angle - Math.PI / 6));
            ctx.lineTo(endX - 10 * Math.cos(angle + Math.PI / 6), endY - 10 * Math.sin(angle + Math.PI / 6));
            ctx.closePath();
            ctx.fill();
          }
        }
      });

      ctx.restore();

      animationFrameIdRef.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      active = false;
      if (animationFrameIdRef.current) {
        cancelAnimationFrame(animationFrameIdRef.current);
      }
    };
  }, [currentStepIndex, steps, zoom, pan, updateLayout]);

  // Zoom Handler
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const zoomFactor = 1.1;
    let newZoom = zoom;
    if (e.deltaY < 0) {
      newZoom = Math.min(zoom * zoomFactor, 2.0);
    } else {
      newZoom = Math.max(zoom / zoomFactor, 0.5);
    }
    setZoom(newZoom);
  };

  // Pan Handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    if (awaitingInput) return; // Disable pan/zoom interaction when inputting
    isDraggingRef.current = true;
    dragStartRef.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDraggingRef.current) return;
    setPan({
      x: e.clientX - dragStartRef.current.x,
      y: e.clientY - dragStartRef.current.y
    });
  };

  const handleMouseUp = () => {
    isDraggingRef.current = false;
  };

  const handleInputSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputValue.trim()) {
      submitInput(inputValue);
      setInputValue('');
    }
  };

  return (
    <div 
      ref={containerRef}
      className="flex-1 min-h-[400px] bg-[#0F172A] border border-slate-700/60 rounded-xl overflow-hidden shadow-2xl relative select-none"
    >
      {/* Canvas Element */}
      <canvas
        ref={canvasRef}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        className="block cursor-grab active:cursor-grabbing w-full h-full"
      />

      {/* Floating Canvas UI Controls */}
      <div className="absolute top-4 right-4 flex items-center space-x-2 bg-slate-900/80 border border-slate-800 rounded-lg p-1.5 backdrop-blur-md">
        <button 
          onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }}
          className="px-2 py-1 text-[10px] font-bold text-slate-400 hover:text-slate-200 uppercase tracking-wider transition-colors cursor-pointer"
        >
          Reset View
        </button>
        <span className="text-[10px] text-slate-500 font-mono select-none px-1">
          {Math.round(zoom * 100)}%
        </span>
      </div>

      {/* Interactive Input Overlay (dim background, slide-up modal) */}
      {awaitingInput && (
        <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-6 z-30 animate-fade-in">
          <form 
            onSubmit={handleInputSubmit}
            className="w-full max-w-md bg-slate-900 border border-blue-500/40 rounded-xl p-6 shadow-2xl shadow-blue-500/10 flex flex-col space-y-4 animate-scale-up"
          >
            <div className="flex items-center space-x-3 text-blue-400">
              <Keyboard size={22} className="animate-pulse" />
              <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-200">
                Awaiting Input
              </h3>
            </div>
            
            <p className="text-sm text-slate-300 font-medium font-mono leading-relaxed bg-slate-950/50 p-3 rounded-lg border border-slate-800">
              {awaitingInput.promptMessage}
            </p>

            <div className="flex flex-col space-y-1">
              <label className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                Value ({awaitingInput.expectedType})
              </label>
              <input
                type={awaitingInput.expectedType === 'string' ? 'text' : 'number'}
                step={awaitingInput.expectedType === 'float' ? 'any' : '1'}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder={`Enter your ${awaitingInput.expectedType} value...`}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-blue-500 transition-colors font-mono"
                autoFocus
                required
              />
            </div>

            <button
              type="submit"
              className="w-full bg-blue-600 hover:bg-blue-500 active:scale-95 text-white font-bold text-sm py-2 rounded-lg transition-all duration-200 cursor-pointer shadow-lg shadow-blue-900/35"
            >
              Submit Input
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
