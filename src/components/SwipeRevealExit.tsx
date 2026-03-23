import React, { useCallback, useRef, useState } from "react";
import { Zap } from "lucide-react";
import { cn } from "@/lib/utils";

const PANEL = 72;

type Props = {
  children: React.ReactNode;
  onExit: () => void;
  disabled?: boolean;
  className?: string;
  /** When false, render children only (e.g. desktop). */
  enabled?: boolean;
};

/**
 * Mobile: swipe left to reveal Exit (reference: Groww positions).
 * Desktop: `enabled={false}` — no swipe, use inline actions instead.
 */
export default function SwipeRevealExit({ children, onExit, disabled, className, enabled = true }: Props) {
  const [dx, setDx] = useState(0);
  const startX = useRef(0);
  const startDx = useRef(0);

  const close = useCallback(() => setDx(0), []);

  const onTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (!enabled || disabled) return;
      startX.current = e.touches[0].clientX;
      startDx.current = dx;
    },
    [enabled, disabled, dx],
  );

  const onTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (!enabled || disabled) return;
      const x = e.touches[0].clientX;
      const delta = x - startX.current;
      let next = startDx.current + delta;
      if (next > 0) next = 0;
      if (next < -PANEL) next = -PANEL;
      setDx(next);
    },
    [enabled, disabled],
  );

  const onTouchEnd = useCallback(() => {
    if (!enabled || disabled) return;
    setDx((d) => (d < -PANEL / 2 ? -PANEL : 0));
  }, [enabled, disabled]);

  if (!enabled) {
    return <div className={cn("border-b border-border last:border-b-0", className)}>{children}</div>;
  }

  return (
    <div className={cn("relative overflow-hidden rounded-none", className)}>
      <div
        className="absolute inset-y-0 right-0 z-0 flex w-[72px] flex-col items-center justify-center gap-0.5 bg-[#fdf2ec] text-[#cd3d14] dark:bg-[#261410] dark:text-[#cd3d14]"
        style={{ width: PANEL }}
      >
        <button
          type="button"
          disabled={disabled}
          onClick={(e) => {
            e.stopPropagation();
            onExit();
            close();
          }}
          className="flex flex-col items-center justify-center gap-0.5 px-2 py-2 text-[11px] font-medium disabled:opacity-40"
        >
          <Zap className="h-5 w-5" />
          <span>Exit</span>
        </button>
      </div>

      <div
        role="presentation"
        className="relative z-10 bg-card"
        style={{ transform: `translateX(${dx}px)`, touchAction: "pan-y" }}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onTouchCancel={onTouchEnd}
      >
        {children}
      </div>
    </div>
  );
}
