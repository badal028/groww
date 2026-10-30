import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";

type Props = {
  open: boolean;
  onClose: () => void;
  /** Visible height (px) in the initial, half-open state. */
  peek?: number;
  children: ReactNode;
};

const fullHeight = () => Math.round(window.innerHeight * 0.94);

export function BottomSheet({ open, onClose, peek, children }: Props) {
  const [mounted, setMounted] = useState(open);
  const [sheetH, setSheetH] = useState(fullHeight);
  const peekH = Math.min(peek ?? Math.round(window.innerHeight * 0.52), sheetH);
  const [offset, setOffset] = useState(sheetH);
  const [dragging, setDragging] = useState(false);
  const drag = useRef<{ y: number; off: number; t: number; lastY: number; lastT: number } | null>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onResize = () => setSheetH(fullHeight());
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useLayoutEffect(() => {
    if (open) {
      setMounted(true);
      setOffset(sheetH);
      const id = requestAnimationFrame(() => requestAnimationFrame(() => setOffset(sheetH - peekH)));
      if (contentRef.current) contentRef.current.scrollTop = 0;
      return () => cancelAnimationFrame(id);
    }
    setOffset(sheetH);
    const t = setTimeout(() => setMounted(false), 260);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const isFull = offset <= 2;

  const onPointerDown = (e: React.PointerEvent) => {
    if (isFull && contentRef.current && contentRef.current.contains(e.target as Node) && contentRef.current.scrollTop > 0) {
      return;
    }
    const target = e.target as HTMLElement;
    if (target.closest("button, input, a, [data-nodrag]")) return;
    drag.current = { y: e.clientY, off: offset, t: Date.now(), lastY: e.clientY, lastT: Date.now() };
    setDragging(true);
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const next = Math.max(0, Math.min(sheetH, d.off + (e.clientY - d.y)));
    d.lastY = e.clientY;
    d.lastT = Date.now();
    setOffset(next);
  };

  const onPointerUp = (e: React.PointerEvent) => {
    const d = drag.current;
    drag.current = null;
    setDragging(false);
    if (!d) return;
    const moved = e.clientY - d.y;
    const dt = Math.max(1, Date.now() - d.t);
    const v = moved / dt;
    const peekOff = sheetH - peekH;
    if (Math.abs(moved) < 4) {
      setOffset(d.off);
      return;
    }
    if (v > 0.8 || offset > peekOff + peekH * 0.35) {
      onClose();
      return;
    }
    if (v < -0.5 || offset < peekOff / 2) setOffset(0);
    else setOffset(peekOff);
  };

  if (!mounted) return null;
  const shown = 1 - offset / sheetH;

  return (
    <div className="sheet-root">
      <div className="sheet-overlay" style={{ opacity: Math.min(1, shown * 1.6) }} onClick={onClose} />
      <div
        className={`sheet${dragging ? " dragging" : ""}`}
        style={{ height: sheetH, transform: `translateY(${offset}px)` }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <div ref={contentRef} className="sheet-content" style={{ overflowY: isFull ? "auto" : "hidden", touchAction: isFull ? "pan-y" : "none" }}>
          {children}
        </div>
      </div>
    </div>
  );
}
