import { useRef, useState, type ReactNode } from "react";
import { IconTrash } from "./Icons";

const PANEL = 84;

/** Swipe left: short swipe reveals Delete, long swipe deletes straight away. */
export function SwipeDelete({ children, onDelete }: { children: ReactNode; onDelete: () => void }) {
  const [dx, setDx] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [removing, setRemoving] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const start = useRef({ x: 0, y: 0, dx: 0 });
  const axis = useRef<"x" | "y" | null>(null);
  const moved = useRef(false);

  const remove = () => {
    const w = rootRef.current?.clientWidth || 360;
    setRemoving(true);
    setDx(-w);
    setTimeout(onDelete, 200);
  };

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
    setDx(Math.min(0, start.current.dx + ddx));
  };
  const onTouchEnd = () => {
    setDragging(false);
    axis.current = null;
    const w = rootRef.current?.clientWidth || 360;
    if (dx < -w * 0.4) remove();
    else if (dx < -PANEL / 2) setDx(-PANEL);
    else setDx(0);
  };

  return (
    <div ref={rootRef} className={`swipe-del${removing ? " removing" : ""}`}>
      <div className="sd-panel">
        <button
          type="button"
          className="sd-btn"
          onClick={(e) => {
            e.stopPropagation();
            remove();
          }}
        >
          <IconTrash size={18} />
          <span>Delete</span>
        </button>
      </div>
      <div
        className={`sd-front${dragging ? " dragging" : ""}`}
        style={{ transform: `translateX(${dx}px)` }}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onTouchCancel={onTouchEnd}
        onClickCapture={(e) => {
          if (moved.current || dx < 0) {
            e.stopPropagation();
            moved.current = false;
            if (dx < 0 && !removing) setDx(0);
          }
        }}
      >
        {children}
      </div>
    </div>
  );
}
