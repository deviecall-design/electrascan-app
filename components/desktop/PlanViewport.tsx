import React, { useRef, useState } from "react";

/**
 * Pinch-zoom and one-finger pan for the plan. A tap that does not drag
 * still reaches the symbol buttons and the plan's add handler.
 */
export default function PlanViewport({ children }: { children: React.ReactNode }) {
  const [view, setView] = useState({ x: 0, y: 0, scale: 1 });
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef({ dist: 0, moved: false });

  function clamp(scale: number) {
    return Math.min(4, Math.max(1, scale));
  }

  function onPointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if ((event.target as HTMLElement).closest("button")) return;
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    gesture.current.moved = false;
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      gesture.current.dist = Math.hypot(a.x - b.x, a.y - b.y) || 1;
    }
  }

  function onPointerMove(event: React.PointerEvent<HTMLDivElement>) {
    const prev = pointers.current.get(event.pointerId);
    if (!prev) return;
    const next = { x: event.clientX, y: event.clientY };
    pointers.current.set(event.pointerId, next);
    const dx = next.x - prev.x;
    const dy = next.y - prev.y;
    if (Math.hypot(dx, dy) > 8) gesture.current.moved = true;

    if (pointers.current.size >= 2) {
      const [a, b] = [...pointers.current.values()];
      const dist = Math.hypot(a.x - b.x, a.y - b.y) || 1;
      const ratio = dist / (gesture.current.dist || dist);
      gesture.current.dist = dist;
      setView(current => ({ ...current, scale: clamp(current.scale * ratio) }));
      return;
    }
    if (pointers.current.size === 1 && gesture.current.moved) {
      setView(current => ({ ...current, x: current.x + dx, y: current.y + dy }));
    }
  }

  function onPointerUp(event: React.PointerEvent<HTMLDivElement>) {
    pointers.current.delete(event.pointerId);
  }

  function onClickCapture(event: React.MouseEvent) {
    if (!gesture.current.moved) return;
    event.preventDefault();
    event.stopPropagation();
    gesture.current.moved = false;
  }

  return (
    <div className="es-plan-viewport">
      <div
        className="es-plan-stage-clip"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onClickCapture={onClickCapture}
      >
        <div
          className="es-plan-stage"
          style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})` }}
        >
          {children}
        </div>
      </div>
      <div className="es-plan-zoom" role="group" aria-label="Plan zoom">
        <button type="button" aria-label="Zoom out" onClick={() => setView(current => ({ ...current, scale: clamp(current.scale / 1.25) }))}>−</button>
        <button type="button" aria-label="Reset plan view" onClick={() => setView({ x: 0, y: 0, scale: 1 })}>Fit</button>
        <button type="button" aria-label="Zoom in" onClick={() => setView(current => ({ ...current, scale: clamp(current.scale * 1.25) }))}>+</button>
      </div>
    </div>
  );
}
