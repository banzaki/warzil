import { useCallback, useEffect, useRef, useState } from 'react';

// Zoom and pan for the map only. Pinch (two fingers) zooms around the fingers,
// one finger drags once zoomed in, and the +/- buttons work everywhere. The page
// itself keeps the browser's own zoom: the map just stops passing pinches to it
// (CSS touch-action), so the panels never get magnified by a pinch on the map.
export const FULL = { x: 0, y: 0, w: 660, h: 639 };
const MAX_SCALE = 4;
// A finger moving more than this (px) is a drag, not a tap.
const DRAG_PX = 8;

function clampView(v) {
  const w = Math.min(FULL.w, Math.max(FULL.w / MAX_SCALE, v.w));
  const h = (w * FULL.h) / FULL.w;
  return {
    w,
    h,
    x: Math.min(FULL.w - w, Math.max(0, v.x)),
    y: Math.min(FULL.h - h, Math.max(0, v.y)),
  };
}

// Zoom by `factor` keeping the map point (px, py) under the same screen spot.
const zoomAround = (v, factor, px, py) =>
  clampView({
    w: v.w / factor,
    x: px - (px - v.x) / factor,
    y: py - (py - v.y) / factor,
  });

export function useMapZoom() {
  const svgRef = useRef(null);
  const [view, setView] = useState(FULL);
  const viewRef = useRef(view);
  viewRef.current = view;
  const pointers = useRef(new Map());
  const gesture = useRef(null);
  const suppressClick = useRef(false);

  // Screen point -> map units.
  const toMap = useCallback((clientX, clientY, v = viewRef.current) => {
    const rect = svgRef.current.getBoundingClientRect();
    return {
      x: v.x + ((clientX - rect.left) / rect.width) * v.w,
      y: v.y + ((clientY - rect.top) / rect.height) * v.h,
    };
  }, []);

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return undefined;

    const start = () => {
      const pts = [...pointers.current.values()];
      const v = viewRef.current;
      if (pts.length >= 2) {
        const [a, b] = pts;
        gesture.current = {
          kind: 'pinch',
          view: v,
          dist: Math.hypot(a.x - b.x, a.y - b.y),
          mid: toMap((a.x + b.x) / 2, (a.y + b.y) / 2, v),
        };
      } else if (pts.length === 1) {
        gesture.current = { kind: 'pan', view: v, from: pts[0], moved: false };
      } else {
        gesture.current = null;
      }
    };

    const down = (e) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pointers.current.size === 1) suppressClick.current = false;
      start();
    };

    const move = (e) => {
      if (!pointers.current.has(e.pointerId)) return;
      pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      const g = gesture.current;
      if (!g) return;
      const rect = svg.getBoundingClientRect();
      if (g.kind === 'pinch') {
        const [a, b] = [...pointers.current.values()];
        const dist = Math.hypot(a.x - b.x, a.y - b.y);
        if (!g.dist) return;
        suppressClick.current = true;
        if (!svg.hasPointerCapture(e.pointerId)) svg.setPointerCapture(e.pointerId);
        const zoomed = zoomAround(g.view, dist / g.dist, g.mid.x, g.mid.y);
        // Keep the pinch midpoint under the fingers while they move.
        const mx = (a.x + b.x) / 2;
        const my = (a.y + b.y) / 2;
        const now = {
          x: zoomed.x + ((mx - rect.left) / rect.width) * zoomed.w,
          y: zoomed.y + ((my - rect.top) / rect.height) * zoomed.h,
        };
        setView(
          clampView({
            ...zoomed,
            x: zoomed.x + g.mid.x - now.x,
            y: zoomed.y + g.mid.y - now.y,
          }),
        );
        return;
      }
      // One finger (or the mouse) drags only when zoomed in.
      if (g.view.w >= FULL.w) return;
      const dx = e.clientX - g.from.x;
      const dy = e.clientY - g.from.y;
      if (!g.moved && Math.hypot(dx, dy) < DRAG_PX) return;
      if (!g.moved) {
        g.moved = true;
        suppressClick.current = true;
        svg.setPointerCapture(e.pointerId);
      }
      setView(
        clampView({
          ...g.view,
          x: g.view.x - (dx / rect.width) * g.view.w,
          y: g.view.y - (dy / rect.height) * g.view.h,
        }),
      );
    };

    const up = (e) => {
      pointers.current.delete(e.pointerId);
      start();
    };

    // A drag or pinch must not end as a tap on a state.
    const click = (e) => {
      if (!suppressClick.current) return;
      suppressClick.current = false;
      e.stopPropagation();
      e.preventDefault();
    };

    svg.addEventListener('pointerdown', down);
    svg.addEventListener('pointermove', move);
    svg.addEventListener('pointerup', up);
    svg.addEventListener('pointercancel', up);
    svg.addEventListener('click', click, true);
    return () => {
      svg.removeEventListener('pointerdown', down);
      svg.removeEventListener('pointermove', move);
      svg.removeEventListener('pointerup', up);
      svg.removeEventListener('pointercancel', up);
      svg.removeEventListener('click', click, true);
    };
  }, [toMap]);

  const zoomBy = useCallback((factor) => {
    setView((v) => zoomAround(v, factor, v.x + v.w / 2, v.y + v.h / 2));
  }, []);
  const reset = useCallback(() => setView(FULL), []);

  return {
    svgRef,
    view,
    zoomed: view.w < FULL.w - 0.5,
    scale: FULL.w / view.w,
    zoomBy,
    reset,
  };
}
