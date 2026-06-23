'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useCodeFlowStore } from '../../store/useCodeFlowStore';
import { createSpring, updateSpring } from '../../utils/spring';
import { Keyboard, RotateCcw, Play, Pause, ChevronLeft, ChevronRight } from 'lucide-react';
import { Variable, StackFrame, HeapObject } from '../../engine/types';

interface RenderNode {
  id: string;
  type: 'variable' | 'frame' | 'heap' | 'pointer';
  label: string;
  subLabel?: string;
  x: { current: number; target: number; velocity: number };
  y: { current: number; target: number; velocity: number };
  opacity: { current: number; target: number; velocity: number };
  isRemoving?: boolean;
  width: number;
  height: number;
  data: Variable | StackFrame | HeapObject;
  prevValue?: string;
  currentValue?: string;
  valueChangeTime?: number;
  slotFlashes?: Record<number, { changeTime: number; oldValue: string }>;
}

// Map variables/heap types to distinct educational colors
function getTypeTheme(type: string, value: unknown) {
  const typeLower = (type || '').toLowerCase();
  
  // Array/Vector types (Purple)
  if (
    typeLower.includes('[]') ||
    typeLower === 'array' ||
    typeLower.startsWith('vector') ||
    typeLower.startsWith('list') ||
    Array.isArray(value)
  ) {
    return {
      name: 'Array',
      bg: 'rgba(88, 28, 135, 0.45)',      // Deep purple
      border: '#8B5CF6',                  // Vibrant purple
      glow: 'rgba(139, 92, 246, 0.4)',
      accent: '#A78BFA'
    };
  }

  // Boolean types (Amber)
  if (
    typeLower === 'bool' ||
    typeLower === 'boolean' ||
    typeof value === 'boolean'
  ) {
    return {
      name: 'Boolean',
      bg: 'rgba(120, 53, 15, 0.45)',      // Deep amber
      border: '#F59E0B',                  // Vibrant amber
      glow: 'rgba(245, 158, 11, 0.4)',
      accent: '#FBBF24'
    };
  }

  // String/Character types (Green)
  if (
    typeLower === 'string' ||
    typeLower === 'char' ||
    typeLower === 'str' ||
    typeLower === 'character' ||
    typeof value === 'string'
  ) {
    return {
      name: 'String',
      bg: 'rgba(6, 78, 59, 0.45)',        // Deep emerald
      border: '#10B981',                  // Vibrant emerald
      glow: 'rgba(16, 185, 129, 0.4)',
      accent: '#34D399'
    };
  }

  // Number/Float/Double types (Blue)
  if (
    typeLower === 'int' ||
    typeLower === 'double' ||
    typeLower === 'float' ||
    typeLower === 'number' ||
    typeLower === 'long' ||
    typeLower === 'short' ||
    typeLower === 'byte' ||
    typeof value === 'number'
  ) {
    return {
      name: 'Number',
      bg: 'rgba(30, 58, 138, 0.45)',       // Deep blue
      border: '#3B82F6',                   // Vibrant blue
      glow: 'rgba(59, 130, 246, 0.4)',
      accent: '#60A5FA'
    };
  }

  // Objects/Structures/Pointers/Classes (Cyan)
  return {
    name: type || 'Object',
    bg: 'rgba(22, 78, 99, 0.45)',         // Deep cyan
    border: '#06B6D4',                    // Vibrant cyan
    glow: 'rgba(6, 182, 212, 0.4)',
    accent: '#22D3EE'
  };
}



export default function VisualizerCanvas() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const zoomSpanRef = useRef<HTMLSpanElement | null>(null);
  
  // Zustand State
  const {
    steps,
    currentStepIndex,
    awaitingInput,
    submitInput,
    selectedItem,
    setSelectedItem,
    playbackState,
    speed,
    setPlaybackState,
    setSpeed,
    stepForward,
    stepBackward
  } = useCodeFlowStore();

  // Auto-Fit Toggle State
  const [autoFit, setAutoFit] = useState(true);

  // Speed Dropdown State & Refs
  const [speedDropdownOpen, setSpeedDropdownOpen] = useState(false);
  const speedDropdownRef = useRef<HTMLDivElement>(null);

  // Close speed dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (speedDropdownRef.current && !speedDropdownRef.current.contains(event.target as Node)) {
        setSpeedDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const speeds = [0.25, 0.5, 1, 2];
  const speedLabels: Record<number, string> = {
    0.25: 'Slowest',
    0.5: 'Slower',
    1: 'Normal',
    2: 'Fastest'
  };

  const handlePlayPause = () => {
    if (playbackState === 'playing') {
      setPlaybackState('paused');
    } else {
      if (playbackState === 'finished' || steps.length === 0) {
        useCodeFlowStore.getState().runCode();
      } else {
        setPlaybackState('playing');
      }
    }
  };

  const isControlsDisabled = awaitingInput !== null || steps.length === 0;

  // Zoom & Pan Springs for ultra-smooth transitions
  const zoomSpringRef = useRef(createSpring(1));
  const panXSpringRef = useRef(createSpring(0));
  const panYSpringRef = useRef(createSpring(0));

  // User Pan Interaction States
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const clickPosRef = useRef({ x: 0, y: 0 });

  // Spring Node Map
  const nodesRef = useRef<Map<string, RenderNode>>(new Map());
  const animationFrameIdRef = useRef<number | null>(null);

  // Hover detection ref
  const hoveredNodeIdRef = useRef<string | null>(null);

  // Input Field State
  const [inputValue, setInputValue] = useState('');

  // Handle Resize using ResizeObserver on the container
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const canvas = canvasRef.current;
        if (!canvas) continue;
        const { width, height } = entry.contentRect;
        canvas.width = width;
        canvas.height = height;
      }
    });

    resizeObserver.observe(container);

    const canvas = canvasRef.current;
    if (canvas) {
      canvas.width = container.clientWidth;
      canvas.height = container.clientHeight;
    }

    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  // Update layout coordinates for active variables, stack frames, and heap objects
  const updateLayout = useCallback((width: number, height: number) => {
    if (steps.length === 0 || currentStepIndex >= steps.length) {
      // Fade out everything
      for (const [, node] of nodesRef.current) {
        node.opacity.target = 0;
        node.isRemoving = true;
      }
      return;
    }

    const step = steps[currentStepIndex];
    const { variables, callStack, heap } = step;
    const activeNodes = new Set<string>();

    // Design layout:
    // Left: Variables column (Globals + Current active Frame Locals)
    // Right: Call Stack (Function frames stacked vertically)
    // Center: Memory Heap (DYNAMIC heap cells)
    const margin = 50;
    const leftColWidth = 260;
    const rightColWidth = 220;
    const heapColWidth = 280;

    const varX = margin;
    const stackX = width - rightColWidth - margin;
    // Mathematically center the heap between the left column and right column
    const heapX = varX + leftColWidth + ((stackX - (varX + leftColWidth)) - heapColWidth) / 2;

    const stackFrameHeight = 70;
    const heapCardHeight = 135;

    // 1. Arrange Call Stack (Right Column)
    // Grow downwards, with the active frame (most recent, top of stack) at the very top
    const stackFrameY = 80;
    callStack.forEach((frame, index) => {
      const nodeId = `frame_${frame.functionName}_${index}`;
      activeNodes.add(nodeId);

      const targetX = stackX;
      // Stacking logic: reverse order so the top stack frame (length - 1 - index) is at the top of the column
      const targetY = stackFrameY + (callStack.length - 1 - index) * (stackFrameHeight + 15);

      let node = nodesRef.current.get(nodeId);
      if (!node) {
        node = {
          id: nodeId,
          type: 'frame',
          label: frame.functionName,
          x: createSpring(width + 100), // Slide in from right edge
          y: createSpring(targetY),
          opacity: createSpring(0),
          width: rightColWidth,
          height: stackFrameHeight,
          data: frame
        };
      }
      node.x.target = targetX;
      node.y.target = targetY;
      node.opacity.target = 1;
      node.data = frame;
      nodesRef.current.set(nodeId, node);
    });

    // 2. Arrange Variables (Left Column)
    let currentY = 80;
    const globals = variables.filter(v => v.scope === 'global');
    const locals = variables.filter(v => v.scope === 'local' || v.scope === 'parameter');

    // Add Globals
    if (globals.length > 0) {
      currentY += 25; // Space for header
      globals.forEach(v => {
        const nodeId = `var_${v.name}_${v.scope}`;
        activeNodes.add(nodeId);

        const cardH = (v.type.includes('[]') || v.type === 'array') ? 110 : 70;
        const targetX = varX;
        const targetY = currentY;
        currentY += cardH + 15;

        let node = nodesRef.current.get(nodeId);
        if (!node) {
          node = {
            id: nodeId,
            type: 'variable',
            label: v.name,
            x: createSpring(targetX - 100), // Slide in from left edge
            y: createSpring(targetY),
            opacity: createSpring(0),
            width: leftColWidth,
            height: cardH,
            data: v
          };
        }
        node.x.target = targetX;
        node.y.target = targetY;
        node.opacity.target = 1;

        // Track value changes
        if (node.data && node.data !== v) {
          const prevVar = node.data as Variable;
          if (prevVar.value !== v.value || prevVar.referencedId !== v.referencedId) {
            node.prevValue = prevVar.value === null ? 'null' : String(prevVar.value);
            node.currentValue = v.value === null ? 'null' : String(v.value);
            node.valueChangeTime = Date.now();
          }
        }
        node.data = v;
        nodesRef.current.set(nodeId, node);
      });
    }

    // Add Locals
    if (locals.length > 0) {
      currentY += 25; // Space for header
      locals.forEach(v => {
        const nodeId = `var_${v.name}_${v.scope}`;
        activeNodes.add(nodeId);

        const cardH = (v.type.includes('[]') || v.type === 'array') ? 110 : 70;
        const targetX = varX;
        const targetY = currentY;
        currentY += cardH + 15;

        let node = nodesRef.current.get(nodeId);
        if (!node) {
          node = {
            id: nodeId,
            type: 'variable',
            label: v.name,
            x: createSpring(targetX - 100),
            y: createSpring(targetY),
            opacity: createSpring(0),
            width: leftColWidth,
            height: cardH,
            data: v
          };
        }
        node.x.target = targetX;
        node.y.target = targetY;
        node.opacity.target = 1;

        // Track value changes
        if (node.data && node.data !== v) {
          const prevVar = node.data as Variable;
          if (prevVar.value !== v.value || prevVar.referencedId !== v.referencedId) {
            node.prevValue = prevVar.value === null ? 'null' : String(prevVar.value);
            node.currentValue = v.value === null ? 'null' : String(v.value);
            node.valueChangeTime = Date.now();
          }
        }
        node.data = v;
        nodesRef.current.set(nodeId, node);
      });
    }

    // 3. Arrange Heap (Center Column)
    const heapYStart = 80;
    heap.forEach((obj, index) => {
      const nodeId = `heap_${obj.id}`;
      activeNodes.add(nodeId);

      const targetX = heapX;
      const targetY = heapYStart + index * (heapCardHeight + 20);

      let node = nodesRef.current.get(nodeId);
      if (!node) {
        node = {
          id: nodeId,
          type: 'heap',
          label: obj.id,
          subLabel: obj.type,
          x: createSpring(targetX),
          y: createSpring(height + 100), // Slide in from bottom
          opacity: createSpring(0),
          width: heapColWidth,
          height: heapCardHeight,
          data: obj
        };
      }
      node.x.target = targetX;
      node.y.target = targetY;
      node.opacity.target = 1;

      // Track array slot changes
      const prevObj = node.data as HeapObject;
      if (prevObj && Array.isArray(prevObj.value) && Array.isArray(obj.value)) {
        if (!node.slotFlashes) node.slotFlashes = {};
        obj.value.forEach((newVal, idx) => {
          const oldVal = (prevObj.value as unknown[])[idx];
          if (oldVal !== undefined && oldVal !== newVal) {
            node.slotFlashes![idx] = {
              changeTime: Date.now(),
              oldValue: oldVal === null ? 'null' : String(oldVal)
            };
          }
        });
      }

      node.data = obj;
      nodesRef.current.set(nodeId, node);
    });

    // Remove inactive nodes
    for (const [id, node] of nodesRef.current) {
      if (!activeNodes.has(id)) {
        if (!node.isRemoving) {
          node.isRemoving = true;
          node.opacity.target = 0;
        }
      }
    }

    // 4. Compute Auto-Fit Camera Pan & Zoom bounds
    if (activeNodes.size > 0 && autoFit) {
      let minX = Infinity;
      let maxX = -Infinity;
      let minY = Infinity;
      let maxY = -Infinity;

      activeNodes.forEach(id => {
        const node = nodesRef.current.get(id);
        if (node) {
          minX = Math.min(minX, node.x.target);
          maxX = Math.max(maxX, node.x.target + node.width);
          minY = Math.min(minY, node.y.target);
          maxY = Math.max(maxY, node.y.target + node.height);
        }
      });

      if (minX !== Infinity) {
        const bboxW = maxX - minX;
        const bboxH = maxY - minY;
        const paddingX = 80;
        const paddingY = 80;

        let targetZoom = Math.min(
          width / (bboxW + paddingX * 2),
          height / (bboxH + paddingY * 2)
        );

        // Clamp auto-fit zoom between 0.8 and 1.1 to keep fonts readable and prevent motion sickness
        targetZoom = Math.max(0.8, Math.min(targetZoom, 1.1));

        const targetPanX = (width - bboxW * targetZoom) / 2 - minX * targetZoom;
        const targetPanY = (height - bboxH * targetZoom) / 2 - minY * targetZoom;

        zoomSpringRef.current.target = targetZoom;
        panXSpringRef.current.target = targetPanX;
        panYSpringRef.current.target = targetPanY;
      }
    }
  }, [steps, currentStepIndex, autoFit]);

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


      // Define layouts constants here
      const margin = 50;
      const leftColWidth = 260;
      const rightColWidth = 220;
      const heapColWidth = 280;

      const varX = margin;
      const stackX = canvas.width - rightColWidth - margin;

      // 1. Update Springs (Node positions + opacity)
      for (const [id, node] of nodesRef.current) {
        node.x = updateSpring(node.x);
        node.y = updateSpring(node.y);
        node.opacity = updateSpring(node.opacity);
        if (node.isRemoving && node.opacity.current < 0.05) {
          nodesRef.current.delete(id);
        }
      }

      // Update Camera Springs (stiffness = 0.08, damping = 0.8 for smooth buttery camera slides)
      zoomSpringRef.current = updateSpring(zoomSpringRef.current, 0.08, 0.8);
      panXSpringRef.current = updateSpring(panXSpringRef.current, 0.08, 0.8);
      panYSpringRef.current = updateSpring(panYSpringRef.current, 0.08, 0.8);

      const currentZoom = zoomSpringRef.current.current;
      const currentPanX = panXSpringRef.current.current;
      const currentPanY = panYSpringRef.current.current;

      // Update the DOM ref for Zoom text directly to bypass React renders
      if (zoomSpanRef.current) {
        zoomSpanRef.current.textContent = `${Math.round(currentZoom * 100)}%`;
      }

      // Draw solid clean debugger background
      ctx.fillStyle = '#0F172A';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.save();
      // Apply smooth Pan & Zoom
      ctx.translate(currentPanX, currentPanY);
      ctx.scale(currentZoom, currentZoom);

      // --- Subtle Grid (Subtle but sharp grid lines) ---
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.025)';
      ctx.lineWidth = 1;
      const gridSize = 50;
      // Grid coordinates mapped based on panning
      const startGridX = Math.floor((-currentPanX / currentZoom) / gridSize) * gridSize - gridSize;
      const endGridX = startGridX + (canvas.width / currentZoom) + gridSize * 2;
      const startGridY = Math.floor((-currentPanY / currentZoom) / gridSize) * gridSize - gridSize;
      const endGridY = startGridY + (canvas.height / currentZoom) + gridSize * 2;

      for (let x = startGridX; x < endGridX; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, startGridY);
        ctx.lineTo(x, endGridY);
        ctx.stroke();
      }
      for (let y = startGridY; y < endGridY; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(startGridX, y);
        ctx.lineTo(endGridX, y);
        ctx.stroke();
      }

      // Update Layout coordinates (runs layouts incrementally)
      updateLayout(canvas.width, canvas.height);

      // --- Compute Active Variables and Focus ---
      const activeVarNames = new Set<string>();
      const activeHeapIds = new Set<string>();
      const activeFrameIds = new Set<string>();

      const step = steps[currentStepIndex];
      if (step) {
        // Current stack top-most frame is active
        if (step.callStack.length > 0) {
          const topFrame = step.callStack[step.callStack.length - 1];
          activeFrameIds.add(`frame_${topFrame.functionName}_${step.callStack.length - 1}`);
        }

        // Compare values with previous step to see what changed
        const prevStep = currentStepIndex > 0 ? steps[currentStepIndex - 1] : null;
        if (prevStep) {
          step.variables.forEach(v => {
            const prevV = prevStep.variables.find(pv => pv.name === v.name && pv.scope === v.scope);
            if (!prevV || prevV.value !== v.value || prevV.referencedId !== v.referencedId) {
              activeVarNames.add(v.name);
              if (v.referencedId) {
                activeHeapIds.add(v.referencedId);
              }
            }
          });
          step.heap.forEach(h => {
            const prevH = prevStep.heap.find(ph => ph.id === h.id);
            if (!prevH || JSON.stringify(prevH.value) !== JSON.stringify(h.value)) {
              activeHeapIds.add(h.id);
            }
          });
        }

        // Fallback: match variables mentioned in step description
        if (activeVarNames.size === 0 && activeHeapIds.size === 0) {
          step.variables.forEach(v => {
            const regex = new RegExp(`\\b${v.name}\\b`);
            if (regex.test(step.description)) {
              activeVarNames.add(v.name);
              if (v.referencedId) {
                activeHeapIds.add(v.referencedId);
              }
            }
          });
        }
      }

      // --- Draw Nodes ---
      const nodes = Array.from(nodesRef.current.values());
      const varNodes = nodes.filter(n => n.type === 'variable');
      const frameNodes = nodes.filter(n => n.type === 'frame');
      const heapNodes = nodes.filter(n => n.type === 'heap');

      const activeFrameName = step?.callStack[step.callStack.length - 1]?.functionName || 'local';

      // 1. Column headers
      ctx.font = 'bold 11px Inter';
      ctx.fillStyle = '#64748B'; // slate-500
      ctx.letterSpacing = '1px';

      if (varNodes.length > 0) {
        const hasGlobals = varNodes.some(n => (n.data as Variable).scope === 'global');
        const hasLocals = varNodes.some(n => (n.data as Variable).scope !== 'global');
        if (hasGlobals) {
          ctx.fillText('GLOBAL VARIABLES', 50, 68);
        }
        if (hasLocals) {
          // Identify height dynamic offset for globals
          const globalsHeight = varNodes
            .filter(n => (n.data as Variable).scope === 'global')
            .reduce((acc, n) => acc + n.height + 15, 80);
          ctx.fillText(`LOCAL VARIABLES (${activeFrameName})`, 50, globalsHeight + 13);
        }
      }

      if (heapNodes.length > 0) {
        // Center header above heap column
        const headerX = varX + leftColWidth + ((stackX - (varX + leftColWidth)) - heapColWidth) / 2;
        ctx.fillText('DYNAMIC MEMORY (HEAP)', headerX, 68);
      }

      if (frameNodes.length > 0) {
        ctx.fillText('CALL STACK', stackX, 68);
      }
      ctx.letterSpacing = '0px'; // reset

      // Utility function to draw a modern card
      const drawCard = (
        n: RenderNode,
        theme: { bg: string; border: string; glow: string; accent: string },
        isFocused: boolean
      ) => {
        const x = n.x.current;
        const y = n.y.current;
        const w = n.width;
        const h = n.height;

        ctx.save();
        
        // Keep elements crisp and sharp (no active focus dimming on card bg)
        ctx.globalAlpha = n.opacity.current;

        // Draw solid background
        ctx.fillStyle = '#1E293B';
        ctx.beginPath();
        ctx.roundRect(x, y, w, h, 8); // Sharper corner radius
        ctx.fill();

        // High contrast border without shadow glow blur
        if (isFocused) {
          ctx.strokeStyle = theme.border;
          ctx.lineWidth = 2.0;
        } else {
          ctx.strokeStyle = '#334155';
          ctx.lineWidth = 1.2;
        }
        ctx.stroke();

        // Draw a clean accent colored bar on the left
        ctx.fillStyle = theme.accent;
        ctx.beginPath();
        ctx.roundRect(x + 1, y + 6, 4, h - 12, 1.5);
        ctx.fill();

        ctx.restore();
      };

      // 2. Draw Variable Cards (Left)
      varNodes.forEach(node => {
        const v = node.data as Variable;
        const x = node.x.current;
        const y = node.y.current;

        const isFocused = activeVarNames.has(v.name);
        const hoveredNode = hoveredNodeIdRef.current ? nodesRef.current.get(hoveredNodeIdRef.current) : null;
        
        let isHoverHighlight = false;
        if (hoveredNode) {
          if (hoveredNode.id === node.id) {
            isHoverHighlight = true;
          } else if (hoveredNode.type === 'heap' && v.isReference && v.referencedId === (hoveredNode.data as HeapObject).id) {
            isHoverHighlight = true;
          }
        }

        const isSelected = !!(selectedItem && selectedItem.type === 'variable' && selectedItem.name === v.name);
        const theme = getTypeTheme(v.type, v.value);
        
        // Highlight in orange when selected
        const cardTheme = isSelected ? {
          ...theme,
          border: '#F59E0B',
          glow: 'rgba(245, 158, 11, 0.7)'
        } : theme;

        drawCard(node, cardTheme, isFocused || isHoverHighlight || isSelected);

        ctx.save();
        ctx.globalAlpha = node.opacity.current;

        // Variable Name
        ctx.fillStyle = '#F8FAFC';
        ctx.font = 'bold 13px Inter';
        ctx.fillText(node.label, x + 16, y + 26);

        // Variable Type
        ctx.fillStyle = theme.accent;
        ctx.font = 'bold 9px Inter';
        ctx.fillText(theme.name.toUpperCase(), x + 16, y + 40);

        // Draw values (with old->new value change transitions)
        if (v.isReference && v.referencedId) {
          // Pointer value (Cyan or Green)
          ctx.fillStyle = '#22D3EE';
          ctx.font = 'bold 13px JetBrains Mono';
          ctx.fillText(`&${v.referencedId}`, x + node.width - 90, y + 36);
        } else {
          const valString = v.value === null ? 'null' : (typeof v.value === 'object' ? '{...}' : String(v.value));
          const textX = x + node.width - 20;
          const textY = y + 38;
          ctx.font = 'bold 14px JetBrains Mono';
          ctx.textAlign = 'right';

          const inTransition = node.valueChangeTime && (Date.now() - node.valueChangeTime < 1200);
          if (inTransition && node.prevValue !== undefined && node.prevValue !== valString) {
            const elapsed = Date.now() - node.valueChangeTime!;
            const progress = Math.min(elapsed / 1200, 1);
            
            const prevText = node.prevValue;
            const arrow = ' → ';
            const nextText = valString;
            
            ctx.font = 'bold 13px JetBrains Mono';
            const prevW = ctx.measureText(prevText).width;
            const arrowW = ctx.measureText(arrow).width;
            const nextW = ctx.measureText(nextText).width;
            const totalW = prevW + arrowW + nextW;
            
            const drawX = textX - totalW;

            // Previous value fading out
            ctx.fillStyle = '#EF4444';
            ctx.globalAlpha = node.opacity.current * (1 - progress * 0.5);
            ctx.fillText(prevText, drawX + prevW, textY);

            // Arrow
            ctx.fillStyle = '#94A3B8';
            ctx.globalAlpha = node.opacity.current;
            ctx.fillText(arrow, drawX + prevW + arrowW, textY);

            // New value fading in
            ctx.fillStyle = '#10B981';
            ctx.globalAlpha = node.opacity.current * (0.5 + progress * 0.5);
            ctx.fillText(nextText, drawX + prevW + arrowW + nextW, textY);
          } else {
            ctx.fillStyle = '#FFFFFF';
            ctx.fillText(valString, textX, textY);
          }
          ctx.textAlign = 'left';
        }
        ctx.restore();
      });

      // 3. Draw Call Stack Frames (Right)
      frameNodes.forEach((node, index) => {
        const x = node.x.current;
        const y = node.y.current;
        const isActive = index === frameNodes.length - 1; // Top frame is active
        
        const isSelected = !!(selectedItem && selectedItem.type === 'frame' && selectedItem.name === node.label);

        const theme = {
          bg: 'rgba(30, 41, 59, 0.4)',
          border: isSelected ? '#F59E0B' : '#3B82F6',
          glow: isSelected ? 'rgba(245, 158, 11, 0.7)' : 'rgba(59, 130, 246, 0.4)',
          accent: isSelected ? '#F59E0B' : (isActive ? '#F59E0B' : '#64748B')
        };

        drawCard(node, theme, isActive || isSelected);

        ctx.save();
        ctx.globalAlpha = node.opacity.current;

        ctx.fillStyle = isActive || isSelected ? '#F8FAFC' : '#94A3B8';
        ctx.font = 'bold 13px Inter';
        ctx.fillText(node.label, x + 16, y + 26);

        ctx.fillStyle = '#64748B';
        ctx.font = 'bold 9px Inter';
        ctx.fillText(`ACTIVE LINE ${ (node.data as StackFrame).line }`, x + 16, y + 42);

        ctx.restore();
      });

      // 4. Draw Heap Cards (Center)
      heapNodes.forEach(node => {
        const x = node.x.current;
        const y = node.y.current;
        const obj = node.data as HeapObject;

        const isFocused = activeHeapIds.has(obj.id);
        const hoveredNode = hoveredNodeIdRef.current ? nodesRef.current.get(hoveredNodeIdRef.current) : null;
        
        let isHoverHighlight = false;
        if (hoveredNode) {
          if (hoveredNode.id === node.id) {
            isHoverHighlight = true;
          } else if (hoveredNode.type === 'variable' && (hoveredNode.data as Variable).referencedId === obj.id) {
            isHoverHighlight = true;
          }
        }

        const isSelected = !!(selectedItem && (
          (selectedItem.type === 'variable' && selectedItem.name === obj.id) ||
          (selectedItem.type === 'array_element' && selectedItem.name.startsWith(obj.id))
        ));

        const theme = getTypeTheme(obj.type, obj.value);
        
        // Highlight in orange when selected
        const cardTheme = isSelected ? {
          ...theme,
          border: '#F59E0B',
          glow: 'rgba(245, 158, 11, 0.7)'
        } : theme;

        drawCard(node, cardTheme, isFocused || isHoverHighlight || isSelected);

        ctx.save();
        ctx.globalAlpha = node.opacity.current;

        // Hex Address/ID
        ctx.fillStyle = theme.accent;
        ctx.font = 'bold 11px JetBrains Mono';
        ctx.fillText(`@${obj.id}`, x + 16, y + 24);

        // Object Class Type
        ctx.fillStyle = '#64748B';
        ctx.font = 'bold 8px Inter';
        ctx.fillText(obj.type.toUpperCase(), x + 16, y + 36);

        // Render slots if array
        if (Array.isArray(obj.value)) {
          const slotWidth = 36;
          const slotHeight = 32;
          const slotY = y + 50;
          const maxSlots = 6;
          const itemsToRender = (obj.value as unknown[]).slice(0, maxSlots);
          const hasMore = (obj.value as unknown[]).length > maxSlots;

          itemsToRender.forEach((val: unknown, idx: number) => {
            const slotX = x + 16 + idx * (slotWidth + 6);
            
            // Check if this specific slot is selected in state
            const isSlotSelected = selectedItem && 
              selectedItem.type === 'array_element' && 
              selectedItem.name === `${obj.id}[${idx}]`;

            // Draw box slot
            ctx.fillStyle = '#0F172A';
            ctx.strokeStyle = isSlotSelected ? '#F59E0B' : '#334155';
            ctx.lineWidth = isSlotSelected ? 2 : 1;
            ctx.beginPath();
            ctx.roundRect(slotX, slotY, slotWidth, slotHeight, 6);
            ctx.fill();
            ctx.stroke();

            // Flash transition check
            const flash = node.slotFlashes?.[idx];
            const flashProgress = flash ? (Date.now() - flash.changeTime) / 800 : 1;
            if (flashProgress < 1) {
              ctx.save();
              ctx.fillStyle = `rgba(16, 185, 129, ${0.35 * (1 - flashProgress)})`;
              ctx.beginPath();
              ctx.roundRect(slotX, slotY, slotWidth, slotHeight, 6);
              ctx.fill();
              ctx.restore();
            }

            // Index labels
            ctx.fillStyle = isSlotSelected ? '#F59E0B' : '#475569';
            ctx.font = 'bold 9px JetBrains Mono';
            ctx.fillText(`[${idx}]`, slotX + slotWidth / 2 - 8, slotY + slotHeight + 13);

            // Value inside slot with transition
            const textX = slotX + slotWidth / 2;
            const textY = slotY + slotHeight / 2 + 4;
            ctx.font = 'bold 12px JetBrains Mono';
            ctx.textAlign = 'center';

            const valStr = val === null ? 'null' : String(val);

            if (flashProgress < 1 && flash && flash.oldValue !== valStr) {
              ctx.save();
              ctx.fillStyle = '#EF4444';
              ctx.globalAlpha = node.opacity.current * (1 - flashProgress);
              ctx.fillText(flash.oldValue, textX, textY - 6);
              ctx.restore();

              ctx.save();
              ctx.fillStyle = '#10B981';
              ctx.globalAlpha = node.opacity.current * flashProgress;
              ctx.fillText(valStr, textX, textY + 6);
              ctx.restore();
            } else {
              ctx.fillStyle = '#FFFFFF';
              ctx.fillText(valStr, textX, textY);
            }
            ctx.textAlign = 'left';
          });

          if (hasMore) {
            const slotX = x + 16 + maxSlots * (slotWidth + 6);
            ctx.fillStyle = '#0F172A';
            ctx.strokeStyle = '#334155';
            ctx.beginPath();
            ctx.roundRect(slotX, slotY, slotWidth, slotHeight, 6);
            ctx.fill();
            ctx.stroke();
            
            ctx.fillStyle = '#64748B';
            ctx.font = 'bold 12px JetBrains Mono';
            ctx.fillText('...', slotX + slotWidth / 2 - 8, slotY + slotHeight / 2 + 4);
          }
        } else if (obj.value && typeof obj.value === 'object') {
          // Struct/Object key-value properties
          ctx.font = 'bold 12px JetBrains Mono';
          let fieldY = y + 54;
          const valObj = obj.value as Record<string, unknown>;
          Object.keys(valObj).forEach((key) => {
            ctx.fillStyle = theme.accent;
            ctx.fillText(`${key}:`, x + 18, fieldY);

            ctx.fillStyle = '#FFFFFF';
            const valStr = valObj[key] === null ? 'null' : String(valObj[key]);
            ctx.fillText(` ${valStr}`, x + 18 + ctx.measureText(`${key}:`).width, fieldY);
            fieldY += 20;
          });
        }
        ctx.restore();
      });

      // 5. Draw Pointer Reference Arrows
      // Pointers flow horizontally from variables on the left, curving beautifully into the center heap
      ctx.shadowBlur = 0;
      varNodes.forEach(node => {
        const v = node.data as Variable;
        if (v.isReference && v.referencedId) {
          const targetNode = nodes.find(n => n.label === v.referencedId || n.id === `heap_${v.referencedId}`);
          
          if (targetNode) {
            ctx.save();
            const isFocused = activeVarNames.has(v.name) || activeHeapIds.has(v.referencedId);
            
            const hoveredNode = hoveredNodeIdRef.current ? nodesRef.current.get(hoveredNodeIdRef.current) : null;
            let isHoverHighlight = false;
            if (hoveredNode) {
              if (hoveredNode.id === node.id || hoveredNode.id === targetNode.id) {
                isHoverHighlight = true;
              }
            }

            // Check if pointer source or target is selected
            const isSelected = selectedItem && (
              (selectedItem.type === 'variable' && selectedItem.name === v.name) ||
              (selectedItem.type === 'variable' && selectedItem.name === targetNode.label) ||
              (selectedItem.type === 'array_element' && selectedItem.name.startsWith(targetNode.label))
            );

            const activeHighlight = isFocused || isHoverHighlight || isSelected;
            ctx.globalAlpha = Math.min(node.opacity.current, targetNode.opacity.current) * (activeVarNames.size > 0 && !activeHighlight ? 0.35 : 1);

            const startX = node.x.current + node.width - 8;
            const startY = node.y.current + node.height / 2;
            const endX = targetNode.x.current + 8;
            const endY = targetNode.y.current + 25; // Arrow targets top heading of heap cell

            ctx.strokeStyle = activeHighlight ? '#F59E0B' : '#10B981'; // Orange if selected/active, emerald green otherwise
            ctx.lineWidth = activeHighlight ? 2.5 : 1.5;

            // Draw a smooth bezier horizontal S-curve
            ctx.beginPath();
            ctx.moveTo(startX, startY);
            
            const cp1X = startX + (endX - startX) * 0.45;
            const cp1Y = startY;
            const cp2X = startX + (endX - startX) * 0.55;
            const cp2Y = endY;

            ctx.bezierCurveTo(cp1X, cp1Y, cp2X, cp2Y, endX, endY);
            ctx.stroke();

            // Arrow head
            const angle = Math.atan2(endY - cp2Y, endX - cp2X);
            ctx.fillStyle = activeHighlight ? '#F59E0B' : '#10B981';
            ctx.beginPath();
            ctx.moveTo(endX, endY);
            ctx.lineTo(endX - 8 * Math.cos(angle - Math.PI / 6), endY - 8 * Math.sin(angle - Math.PI / 6));
            ctx.lineTo(endX - 8 * Math.cos(angle + Math.PI / 6), endY - 8 * Math.sin(angle + Math.PI / 6));
            ctx.closePath();
            ctx.fill();

            ctx.restore();
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
  }, [currentStepIndex, steps, updateLayout, selectedItem]);

  // Zoom Handler
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const zoomFactor = 1.1;
    let newZoom = zoomSpringRef.current.target;
    if (e.deltaY < 0) {
      newZoom = Math.min(newZoom * zoomFactor, 2.0);
    } else {
      newZoom = Math.max(newZoom / zoomFactor, 0.5);
    }
    
    // Zoom centered around cursor
    zoomSpringRef.current.target = newZoom;
    setAutoFit(false); // Disable auto-fit on manual scroll
  };

  // Pan Handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    if (awaitingInput) return;
    isDraggingRef.current = true;
    clickPosRef.current = { x: e.clientX, y: e.clientY };

    dragStartRef.current = { 
      x: e.clientX - panXSpringRef.current.target, 
      y: e.clientY - panYSpringRef.current.target 
    };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    if (isDraggingRef.current) {
      const newPanX = e.clientX - dragStartRef.current.x;
      const newPanY = e.clientY - dragStartRef.current.y;
      
      panXSpringRef.current.target = newPanX;
      panYSpringRef.current.target = newPanY;
      
      // Stop tracking automatically on drag
      setAutoFit(false);
      return;
    }

    // Convert mouse event client coordinates to canvas world coordinates for hover highlights
    const rect = canvas.getBoundingClientRect();
    const currentZoom = zoomSpringRef.current.current;
    const currentPanX = panXSpringRef.current.current;
    const currentPanY = panYSpringRef.current.current;

    const mouseX = (e.clientX - rect.left - currentPanX) / currentZoom;
    const mouseY = (e.clientY - rect.top - currentPanY) / currentZoom;

    let foundHovered: string | null = null;
    for (const [id, node] of nodesRef.current) {
      if (node.isRemoving) continue;
      if (
        mouseX >= node.x.current &&
        mouseX <= node.x.current + node.width &&
        mouseY >= node.y.current &&
        mouseY <= node.y.current + node.height
      ) {
        foundHovered = id;
        break;
      }
    }
    
    if (hoveredNodeIdRef.current !== foundHovered) {
      hoveredNodeIdRef.current = foundHovered;
    }
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    isDraggingRef.current = false;
    // Check if it was a quick click rather than a pan drag
    const dragDist = Math.hypot(e.clientX - clickPosRef.current.x, e.clientY - clickPosRef.current.y);
    if (dragDist < 5) {
      handleCanvasClick(e);
    }
  };

  // Canvas Click Handler (Selects Variables, Frame, or Array element slots)
  const handleCanvasClick = (e: React.MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const currentZoom = zoomSpringRef.current.current;
    const currentPanX = panXSpringRef.current.current;
    const currentPanY = panYSpringRef.current.current;

    const clickX = (e.clientX - rect.left - currentPanX) / currentZoom;
    const clickY = (e.clientY - rect.top - currentPanY) / currentZoom;

    let clickedNode: RenderNode | null = null;
    const nodes = Array.from(nodesRef.current.values());
    for (const node of nodes) {
      if (node.isRemoving) continue;
      if (
        clickX >= node.x.current &&
        clickX <= node.x.current + node.width &&
        clickY >= node.y.current &&
        clickY <= node.y.current + node.height
      ) {
        clickedNode = node;
        break;
      }
    }

    if (clickedNode) {
      if (clickedNode.type === 'variable') {
        const v = clickedNode.data as Variable;
        setSelectedItem({
          name: v.name,
          type: 'variable',
          details: `type: ${v.type}, value: ${v.value}`
        });
      } else if (clickedNode.type === 'frame') {
        const frame = clickedNode.data as StackFrame;
        setSelectedItem({
          name: frame.functionName,
          type: 'frame',
          details: `line: ${frame.line}`
        });
      } else if (clickedNode.type === 'heap') {
        const obj = clickedNode.data as HeapObject;
        
        // Check if an array slot was clicked
        if (Array.isArray(obj.value)) {
          const slotWidth = 36;
          const slotHeight = 32;
          const slotY = clickedNode.y.current + 50;
          let clickedSlotIdx = -1;

          obj.value.slice(0, 6).forEach((val, idx) => {
            const slotX = clickedNode!.x.current + 16 + idx * (slotWidth + 6);
            if (
              clickX >= slotX &&
              clickX <= slotX + slotWidth &&
              clickY >= slotY &&
              clickY <= slotY + slotHeight
            ) {
              clickedSlotIdx = idx;
            }
          });

          if (clickedSlotIdx !== -1) {
            setSelectedItem({
              name: `${obj.id}[${clickedSlotIdx}]`,
              type: 'array_element',
              details: `value: ${obj.value[clickedSlotIdx]}`
            });
            return;
          }
        }

        // Default: dynamic object structure selection
        setSelectedItem({
          name: obj.id,
          type: 'variable',
          details: `type: ${obj.type}`
        });
      }
    } else {
      // Clicked in empty space -> Clear active context selection
      setSelectedItem(null);
    }
  };

  const handleInputSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputValue.trim()) {
      submitInput(inputValue);
      setInputValue('');
    }
  };

  const resetView = () => {
    zoomSpringRef.current.target = 1;
    panXSpringRef.current.target = 0;
    panYSpringRef.current.target = 0;
    setAutoFit(false);
  };

  return (
    <div 
      ref={containerRef}
      className="flex-1 min-h-[460px] bg-[#080C14] border border-slate-800/80 rounded-xl overflow-hidden shadow-2xl relative select-none"
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

      {/* Floating Canvas UI Controls: Playback, Auto-Fit Toggle, Speed Dropdown */}
      <div className="absolute top-4 left-4 flex items-center space-x-2 z-20">
        <div className="flex items-center space-x-2 bg-slate-950 border border-slate-800 rounded-full p-1.5 shadow-lg">
          {/* Previous Button */}
          <button
            onClick={stepBackward}
            disabled={isControlsDisabled}
            className="p-1 rounded-full text-slate-400 hover:text-slate-200 hover:bg-slate-850 disabled:opacity-40 disabled:hover:text-slate-400 disabled:hover:bg-transparent transition-colors cursor-pointer"
            title="Previous Step"
          >
            <ChevronLeft size={16} />
          </button>

          {/* Play/Pause Button */}
          <button
            onClick={handlePlayPause}
            disabled={awaitingInput !== null}
            className={`p-1.5 rounded-full text-white transition-all active:scale-95 cursor-pointer flex items-center justify-center ${
              awaitingInput
                ? 'bg-slate-750 opacity-60 shadow-none'
                : playbackState === 'playing'
                  ? 'bg-amber-600 hover:bg-amber-500 shadow-lg shadow-amber-900/35'
                  : 'bg-blue-600 hover:bg-blue-500 shadow-lg shadow-blue-900/35'
            }`}
            title={playbackState === 'playing' ? 'Pause (Space)' : 'Play (Space)'}
          >
            {awaitingInput ? (
              <span className="text-[8px] font-bold tracking-wider px-1">WAITING</span>
            ) : playbackState === 'playing' ? (
              <Pause size={12} fill="white" />
            ) : (
              <Play size={12} fill="white" />
            )}
          </button>

          {/* Next Button */}
          <button
            onClick={stepForward}
            disabled={isControlsDisabled}
            className="p-1 rounded-full text-slate-400 hover:text-slate-200 hover:bg-slate-850 disabled:opacity-40 disabled:hover:text-slate-400 disabled:hover:bg-transparent transition-colors cursor-pointer"
            title="Next Step"
          >
            <ChevronRight size={16} />
          </button>

          <div className="w-px h-4 bg-slate-800/80 mx-1" />

          {/* Auto Fit toggle */}
          <div className="flex items-center space-x-1.5 px-1.5">
            <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">
              Auto-Fit
            </span>
            <button
              onClick={() => setAutoFit(!autoFit)}
              className={`relative inline-flex h-4 w-7.5 shrink-0 cursor-pointer rounded-full border border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                autoFit ? 'bg-blue-600' : 'bg-slate-700'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-3 w-3 transform rounded-full bg-white shadow transition duration-200 ease-in-out ${
                  autoFit ? 'translate-x-3.5' : 'translate-x-0.5'
                } mt-[1px]`}
              />
            </button>
          </div>

          <div className="w-px h-4 bg-slate-800/80 mx-1" />

          {/* Speed Dropdown */}
          <div className="relative" ref={speedDropdownRef}>
            <button
              onClick={() => setSpeedDropdownOpen(!speedDropdownOpen)}
              disabled={awaitingInput !== null}
              className="flex items-center space-x-1 px-2.5 py-1 text-[10px] font-bold text-slate-300 hover:text-slate-100 hover:bg-slate-800/60 rounded-full transition-all cursor-pointer focus:outline-none disabled:opacity-40 select-none"
            >
              <span>Speed: {speedLabels[speed]}</span>
              <span className="text-[8px] text-slate-400">▼</span>
            </button>
            
            {speedDropdownOpen && (
              <div className="absolute left-0 mt-2 w-28 bg-slate-950 border border-slate-850 rounded-lg shadow-2xl py-1 z-30 animate-fade-in">
                {speeds.map((s) => (
                  <button
                    key={s}
                    onClick={() => {
                      setSpeed(s);
                      setSpeedDropdownOpen(false);
                    }}
                    className={`w-full flex items-center justify-between px-3 py-1.5 text-left text-[10px] font-bold transition-colors hover:bg-slate-800 hover:text-slate-100 ${
                      speed === s
                        ? 'bg-blue-600/10 text-blue-400'
                        : 'text-slate-400'
                    }`}
                  >
                    <span>{speedLabels[s]}</span>
                    {speed === s && <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Top Center: Floating Compressed "Current Action" Banner */}
      {steps.length > 0 && currentStepIndex < steps.length && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 flex items-center bg-slate-950 border border-slate-800 rounded-full px-5 py-2 z-20 shadow-2xl animate-scale-up border-b-blue-500/40">
          <p className="text-xs font-bold text-slate-100 font-mono tracking-wider">
            L{steps[currentStepIndex].lineNumber} &bull; {steps[currentStepIndex].operation.replace('_', ' ').toUpperCase()}
          </p>
        </div>
      )}

      {/* Top Right: Reset and Zoom Controls */}
      <div className="absolute top-4 right-4 flex items-center space-x-2 bg-slate-950 border border-slate-800 rounded-full p-1.5 z-20 shadow-lg">
        <button 
          onClick={resetView}
          title="Reset Camera"
          className="p-1 text-slate-400 hover:text-slate-200 transition-colors cursor-pointer rounded-full hover:bg-slate-800/60"
        >
          <RotateCcw size={13} />
        </button>
        <span 
          ref={zoomSpanRef}
          className="text-[10px] text-slate-400 font-mono select-none px-1.5 border-l border-slate-800"
        >
          100%
        </span>
      </div>

      {/* Interactive Input Overlay (dim background, slide-up modal) */}
      {awaitingInput && (
        <div className="absolute inset-0 bg-slate-950/85 flex items-center justify-center p-6 z-30 animate-fade-in">
          <form 
            onSubmit={handleInputSubmit}
            className="w-full max-w-sm bg-slate-900 border border-blue-500/35 rounded-xl p-5 shadow-2xl shadow-blue-500/10 flex flex-col space-y-4 animate-scale-up"
          >
            <div className="flex items-center space-x-3 text-blue-400">
              <Keyboard size={20} className="animate-pulse" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200">
                Awaiting Input
              </h3>
            </div>
            
            <p className="text-xs text-slate-300 font-medium font-mono leading-relaxed bg-slate-950/60 p-3 rounded-lg border border-slate-800">
              {awaitingInput.promptMessage}
            </p>

            <div className="flex flex-col space-y-1">
              <label className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">
                Value ({awaitingInput.expectedType})
              </label>
              <input
                type={awaitingInput.expectedType === 'string' ? 'text' : 'number'}
                step={awaitingInput.expectedType === 'float' ? 'any' : '1'}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder={`Enter ${awaitingInput.expectedType}...`}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-blue-500 transition-colors font-mono"
                autoFocus
                required
              />
            </div>

            <button
              type="submit"
              className="w-full bg-blue-600 hover:bg-blue-500 active:scale-95 text-white font-bold text-xs py-2 rounded-lg transition-all duration-200 cursor-pointer shadow-lg shadow-blue-900/35"
            >
              Submit Input
            </button>
          </form>
        </div>
      )}

      {/* Before Execution Overlay */}
      {steps.length === 0 && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/85 z-30 animate-fade-in p-6">
          <div className="text-center max-w-sm bg-slate-900 border border-slate-850 p-8 rounded-2xl shadow-2xl flex flex-col items-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 mb-1">
              <Play size={20} fill="currentColor" className="ml-0.5" />
            </div>
            <h3 className="text-sm font-bold text-slate-100 uppercase tracking-wider">
              ▶ Run Your Program
            </h3>
            <p className="text-xs text-slate-400 font-medium font-sans">
              Visual execution trace will appear here.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
