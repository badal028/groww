import { useEffect, useRef, useState } from "react";
import { IconChevronRight } from "./Icons";

type Props = {
  side: "BUY" | "SELL";
  loading: boolean;
  onSwipe: () => void;
};

const KNOB = 40;
const PAD = 3;

export function SwipeButton({ side, loading, onSwipe }: Props) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [x, setX] = useState(0);
  const [drag, setDrag] = useState(false);
  const start = useRef<{ px: number; x: number } | null>(null);

  useEffect(() => {
    if (!loading) setX(0);
  }, [loading]);

  const maxX = () => Math.max(0, (trackRef.current?.clientWidth || 0) - KNOB - PAD * 2);

  const down = (e: React.PointerEvent) => {
    if (loading) return;
    start.current = { px: e.clientX, x };
    setDrag(true);
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
  };
  const move = (e: React.PointerEvent) => {
    if (!start.current) return;
    setX(Math.max(0, Math.min(maxX(), start.current.x + e.clientX - start.current.px)));
  };
  const up = () => {
    if (!start.current) return;
    start.current = null;
    setDrag(false);
    const m = maxX();
    if (m > 0 && x >= m * 0.82) {
      setX(m);
      onSwipe();
    } else {
      setX(0);
    }
  };

  const label = side === "BUY" ? "SWIPE TO BUY" : "SWIPE TO SELL";
  const progress = maxX() ? x / maxX() : 0;

  return (
    <div className={`swipe ${side === "BUY" ? "buy" : "sell"}${loading ? " loading" : ""}`} ref={trackRef}>
      {loading ? (
        <span className="spinner" />
      ) : (
        <>
          <span className="swipe-label" style={{ opacity: 1 - progress * 0.9 }}>
            {label}
          </span>
          <span
            className={`swipe-knob${drag ? " dragging" : ""}`}
            style={{ transform: `translateX(${x}px)` }}
            onPointerDown={down}
            onPointerMove={move}
            onPointerUp={up}
            onPointerCancel={up}
          >
            <IconChevronRight size={20} strokeWidth={2} />
          </span>
        </>
      )}
    </div>
  );
}
