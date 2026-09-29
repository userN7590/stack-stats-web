"use client";

import { useEffect } from "react";

/** Pointer distance (CSS px) within which a structural line responds. */
export const GRID_SIGNAL_RADIUS = 130;

/**
 * Structural-grid proximity: nearby rails, column guides and section rules
 * show a short blue segment around the pointer. One shared listener, at most
 * one measurement per animation frame, and only CSS custom properties and a
 * class are written, so React never re-renders. The gradients themselves
 * (globals.css) provide the localized falloff. Disabled for touch/coarse
 * pointers and reduced motion; cleared when the pointer leaves or the page is
 * hidden. Renders nothing.
 */
export function GridSignal() {
  useEffect(() => {
    const fine = window.matchMedia("(hover: hover) and (pointer: fine)");
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
    const root = document.documentElement;
    let frame = 0, pointer: { x: number; y: number } | null = null;
    let near = new Set<HTMLElement>();
    const R = GRID_SIGNAL_RADIUS;

    const clear = () => {
      if (frame) cancelAnimationFrame(frame);
      frame = 0;
      pointer = null;
      near.forEach((element) => element.classList.remove("grid-near"));
      near = new Set();
    };
    const enabled = () => fine.matches && !reduce.matches;
    const sync = () => {
      if (enabled()) root.dataset.gridSignal = "on";
      else { delete root.dataset.gridSignal; clear(); }
    };

    const update = () => {
      frame = 0;
      if (!pointer) return;
      const { x, y } = pointer, next = new Set<HTMLElement>();
      const set = (element: HTMLElement, values: Record<string, number>) => {
        for (const [name, value] of Object.entries(values)) element.style.setProperty(name, `${Math.round(value * 10) / 10}px`);
        next.add(element);
      };
      // Outer rails: the left and right edges of each framed band.
      for (const element of document.querySelectorAll<HTMLElement>(".site-frame, .nav-rails")) {
        const box = element.getBoundingClientRect();
        if (y < box.top - R || y > box.bottom + R || Math.min(Math.abs(x - box.left), Math.abs(x - box.right)) > R) continue;
        set(element, { "--gxl": x - box.left + 1, "--gxr": x - box.right + 1, "--gy": y - box.top });
      }
      // Full-bleed horizontal rules at section boundaries (and under the nav).
      for (const element of document.querySelectorAll<HTMLElement>(".site-section, .grid-rule")) {
        const box = element.getBoundingClientRect();
        if (Math.abs(y - box.bottom) > R) continue;
        set(element, { "--gx": x - box.left, "--gyb": y - box.bottom });
      }
      // Internal column guides.
      for (const element of document.querySelectorAll<HTMLElement>(".site-guides")) {
        const box = element.getBoundingClientRect();
        if (!box.width || x < box.left - R || x > box.right + R || y < box.top - R || y > box.bottom + R) continue;
        set(element, { "--gx": x - box.left, "--gy": y - box.top, "--gw": box.width });
      }
      near.forEach((element) => { if (!next.has(element)) element.classList.remove("grid-near"); });
      next.forEach((element) => element.classList.add("grid-near"));
      near = next;
    };
    const schedule = () => { if (pointer && !frame) frame = requestAnimationFrame(update); };
    const onMove = (event: PointerEvent) => {
      if (event.pointerType !== "mouse" && event.pointerType !== "pen") return;
      if (!enabled()) return;
      pointer = { x: event.clientX, y: event.clientY };
      schedule();
    };
    const onOut = (event: PointerEvent) => { if (!event.relatedTarget) clear(); };
    const onHidden = () => { if (document.hidden) clear(); };

    sync();
    fine.addEventListener("change", sync);
    reduce.addEventListener("change", sync);
    document.addEventListener("pointermove", onMove, { passive: true });
    document.addEventListener("pointerout", onOut);
    document.addEventListener("visibilitychange", onHidden);
    // Lines move under a still pointer while scrolling: re-measure only if lit.
    window.addEventListener("scroll", schedule, { passive: true });
    return () => {
      fine.removeEventListener("change", sync);
      reduce.removeEventListener("change", sync);
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerout", onOut);
      document.removeEventListener("visibilitychange", onHidden);
      window.removeEventListener("scroll", schedule);
      clear();
      delete root.dataset.gridSignal;
    };
  }, []);

  return null;
}
