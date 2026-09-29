"use client";

import { useEffect, useRef, type CSSProperties, type ReactNode } from "react";

import { cardBands, pickCardBand } from "@/lib/card-stack";

const FAN_QUERY = "(min-width: 1024px)";

/**
 * Behaviour for the server-rendered card fan. It only writes data attributes
 * (`data-active` on the list, `data-fan` / `data-locked` on cards); CSS does
 * all motion. No React state changes on pointer movement.
 *
 * - Hover previews a card. Selection uses each card's resting band with
 *   hysteresis, so transitions never steal the pointer or flicker.
 * - Click on an example card locks it forward; click it again, press Escape
 *   or click outside the stack to release. The live card's click navigates.
 * - Keyboard focus previews exactly like hover; Enter/Space lock examples.
 * - Below 1024px the stack is a native scroll-snap strip: no hover preview,
 *   a tap emphasises a card.
 */
export function CardStack({ children, label, style }: { children: ReactNode; label: string; style?: CSSProperties }) {
  const ref = useRef<HTMLUListElement>(null);

  useEffect(() => {
    const list = ref.current;
    if (!list) return;
    // Visual order (resting position), independent of DOM/tab order.
    const cards = Array.from(list.querySelectorAll<HTMLElement>(":scope > [data-card-pos]"))
      .sort((a, b) => Number(a.dataset.cardPos) - Number(b.dataset.cardPos));
    if (!cards.length) return;
    const fanQuery = window.matchMedia(FAN_QUERY);
    let active: number | null = null, locked: number | null = null;
    let frame = 0, leaveTimer = 0, pointer: { x: number; y: number } | null = null;

    const apply = (next: number | null) => {
      if (next === active) return;
      active = next;
      if (next === null) delete list.dataset.active;
      else list.dataset.active = cards[next].dataset.profileCard;
      cards.forEach((card, index) => {
        if (next === null) delete card.dataset.fan;
        else card.dataset.fan = index === next ? "active" : index < next ? "before" : "after";
      });
    };
    const lock = (next: number | null) => {
      locked = next;
      cards.forEach((card, index) => { if (index === next) card.dataset.locked = ""; else delete card.dataset.locked; });
      if (next === null) delete list.dataset.locked; else list.dataset.locked = "";
      apply(next);
    };
    const indexOf = (target: EventTarget | null) => {
      const card = target instanceof Element ? target.closest<HTMLElement>("[data-card-pos]") : null;
      return card && list.contains(card) ? cards.indexOf(card) : -1;
    };
    const overCard = (x: number, y: number) => {
      const hit = document.elementFromPoint(x, y);
      return Boolean(hit && list.contains(hit) && hit.closest("[data-card-pos]"));
    };

    const update = () => {
      frame = 0;
      if (!pointer || locked !== null || !fanQuery.matches) return;
      const { x, y } = pointer;
      // Only a pointer on (or within 12px of) a card previews; gaps keep the current card.
      if (!overCard(x, y) && !overCard(x, y - 12) && !overCard(x, y + 12) && !overCard(x - 12, y) && !overCard(x + 12, y)) return;
      // Resting geometry: offsetLeft ignores transforms, so moving cards never shift bands.
      const origin = list.getBoundingClientRect().left;
      const last = cards[cards.length - 1];
      const bands = cardBands(cards.map((card) => origin + card.offsetLeft), origin + last.offsetLeft + last.offsetWidth);
      const step = bands.length > 1 ? bands[1].start - bands[0].start : last.offsetWidth;
      apply(pickCardBand(bands, x, active, step * 0.16));
    };

    const onMove = (event: PointerEvent) => {
      if (event.pointerType === "touch") return;
      window.clearTimeout(leaveTimer);
      pointer = { x: event.clientX, y: event.clientY };
      if (!frame) frame = requestAnimationFrame(update);
    };
    const onLeave = (event: PointerEvent) => {
      if (event.pointerType === "touch") return;
      pointer = null;
      // Short grace: brushing past an edge does not collapse the fan.
      leaveTimer = window.setTimeout(() => { if (!list.contains(document.activeElement)) apply(locked); }, 140);
    };
    const onClick = (event: MouseEvent) => {
      const index = indexOf(event.target);
      if (index < 0 || cards[index].querySelector("a[href]")) return; // The live card navigates.
      lock(locked === index ? null : index);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") { lock(null); return; }
      if (event.key !== "Enter" && event.key !== " ") return;
      const index = indexOf(event.target);
      if (index < 0 || cards[index].querySelector("a[href]")) return;
      event.preventDefault();
      lock(locked === index ? null : index);
    };
    const onFocusIn = (event: FocusEvent) => {
      const index = indexOf(event.target);
      if (index >= 0 && locked === null) apply(index);
    };
    const onFocusOut = (event: FocusEvent) => {
      if (!(event.relatedTarget instanceof Node) || !list.contains(event.relatedTarget)) apply(pointer ? active : locked);
    };
    const onOutside = (event: PointerEvent) => {
      if (locked !== null && !(event.target instanceof Node && list.contains(event.target))) lock(null);
    };
    const onMode = () => { lock(null); };

    list.addEventListener("pointermove", onMove, { passive: true });
    list.addEventListener("pointerleave", onLeave);
    list.addEventListener("click", onClick);
    list.addEventListener("keydown", onKey);
    list.addEventListener("focusin", onFocusIn);
    list.addEventListener("focusout", onFocusOut);
    document.addEventListener("pointerdown", onOutside);
    fanQuery.addEventListener("change", onMode);
    list.dataset.interactive = "true";
    return () => {
      list.removeEventListener("pointermove", onMove);
      list.removeEventListener("pointerleave", onLeave);
      list.removeEventListener("click", onClick);
      list.removeEventListener("keydown", onKey);
      list.removeEventListener("focusin", onFocusIn);
      list.removeEventListener("focusout", onFocusOut);
      document.removeEventListener("pointerdown", onOutside);
      fanQuery.removeEventListener("change", onMode);
      if (frame) cancelAnimationFrame(frame);
      window.clearTimeout(leaveTimer);
    };
  }, []);

  return <ul ref={ref} className="pcards" aria-label={label} style={style}>{children}</ul>;
}
