import { useRef, useState, type ReactNode } from "react";
import { IconClose } from "./Icons";

const PANEL = 84;

type Props = {
  children: ReactNode;
  /** Swipe right reveals Clear (only when provided). */
  onClear?: () => void;
  /** Swipe left reveals Clear (only when provided). */
  onClearLeft?: () => void;
  busy?: boolean;
};

export function SwipeClear({ children, onClear, onClearLeft, busy }: Props) {
  const [dx, setDx] = useState(0);
  const [dragging, setDragging] = useState(false);
  const start = useRef({ x: 0, y: 0, dx: 0 });
  const axis = useRef<"x" | "y" | null>(null);
  const moved = useRef(false);

  if (!onClear && !onClearLeft) return <>{children}</>;

  const minDx = onClearLeft ? -PANEL : 0;
  const maxDx = onClear ? PANEL : 0;

  const onTouchStart = (e: React.TouchEvent) => {
    start.current = { x: e.touches[0].clientX, y: e.touches[0].clientY, dx };
    axis.current = null;
    moved.current = false;
  };
  const onTouchMove = (e: React.TouchEvent) => {
    const ddx = e.touches[0].clientX - start.current.x;
    const ddy = e.touches[0].clientY - start.current.y;
    if (!axis.current) {
      if (Math.abs(ddx) < 6 && Math.abs(ddy) < 6) return;
      axis.current = Math.abs(ddx) > Math.abs(ddy) ? "x" : "y";
    }
    if (axis.current !== "x") return;
    moved.current = true;
    setDragging(true);
    setDx(Math.max(minDx, Math.min(maxDx, start.current.dx + ddx)));
  };
  const onTouchEnd = () => {
    setDragging(false);
    axis.current = null;
    setDx((d) => {
      if (d > PANEL / 2) return PANEL;
      if (d < -PANEL / 2) return -PANEL;
      return 0;
    });
  };

  const fire = (fn?: () => void) => {
    setDx(0);
    fn?.();
  };

  return (
    <div className="swipe-clear">
      {onClear && (
        <div className="sc-panel sc-panel-right" style={{ width: PANEL }}>
          <button
            type="button"
            className="sc-btn"
            disabled={busy}
            onClick={(e) => {
              e.stopPropagation();
              fire(onClear);
            }}
          >
            <IconClose size={18} />
            <span>Clear</span>
          </button>
        </div>
      )}
      {onClearLeft && (
        <div className="sc-panel sc-panel-left" style={{ width: PANEL }}>
          <button
            type="button"
            className="sc-btn sc-btn-left"
            disabled={busy}
            onClick={(e) => {
              e.stopPropagation();
              fire(onClearLeft);
            }}
          >
            <IconClose size={18} />
            <span>Clear</span>
          </button>
        </div>
      )}
      <div
        className={`sc-front${dragging ? " dragging" : ""}`}
        style={{ transform: `translateX(${dx}px)` }}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onTouchCancel={onTouchEnd}
        onClickCapture={(e) => {
          if (moved.current || dx !== 0) {
            e.stopPropagation();
            moved.current = false;
            if (dx !== 0) setDx(0);
          }
        }}
      >
        {children}
      </div>
    </div>
  );
}
