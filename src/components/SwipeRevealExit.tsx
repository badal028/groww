import React, { useCallback, useRef, useState } from "react";
import { X, Zap } from "lucide-react";
import { cn } from "@/lib/utils";

const PANEL = 78;

type Props = {
  children: React.ReactNode;
  onExit?: () => void;
  onClear?: () => void;
  /** When false, Clear swipe/button is shown but disabled (open positions). */
  clearReady?: boolean;
  disabled?: boolean;
  className?: string;
  /** When false, render children only (e.g. desktop). */
  enabled?: boolean;
};

/**
 * Mobile swipe actions for position rows.
 * - Swipe left (finger → left) → Exit on the right
 * - Swipe right (finger → right) → Clear on the left
 */
export default function SwipeRevealExit({
  children,
  onExit,
  onClear,
  clearReady = true,
  disabled,
  className,
  enabled = true,
}: Props) {
  const [dx, setDx] = useState(0);
  const startX = useRef(0);
  const startY = useRef(0);
  const startDx = useRef(0);
  const axisLock = useRef<"x" | "y" | null>(null);

  const hasExit = Boolean(onExit);
  const hasClear = Boolean(onClear);
  const hasSwipe = hasExit || hasClear;

  const close = useCallback(() => setDx(0), []);

  const clampDx = useCallback(
    (value: number) => {
      let next = value;
      const min = hasExit ? -PANEL : 0;
      const max = hasClear ? PANEL : 0;
      if (next < min) next = min;
      if (next > max) next = max;
      return next;
    },
    [hasExit, hasClear],
  );

  const onTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (!enabled || disabled || !hasSwipe) return;
      startX.current = e.touches[0].clientX;
      startY.current = e.touches[0].clientY;
      startDx.current = dx;
      axisLock.current = null;
    },
    [enabled, disabled, hasSwipe, dx],
  );

  const onTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (!enabled || disabled || !hasSwipe) return;
      const x = e.touches[0].clientX;
      const y = e.touches[0].clientY;
      const deltaX = x - startX.current;
      const deltaY = y - startY.current;

      if (!axisLock.current) {
        if (Math.abs(deltaX) < 6 && Math.abs(deltaY) < 6) return;
        axisLock.current = Math.abs(deltaX) > Math.abs(deltaY) ? "x" : "y";
      }
      if (axisLock.current !== "x") return;

      e.preventDefault();
      setDx(clampDx(startDx.current + deltaX));
    },
    [enabled, disabled, hasSwipe, clampDx],
  );

  const onTouchEnd = useCallback(() => {
    if (!enabled || disabled || !hasSwipe) return;
    axisLock.current = null;
    setDx((d) => {
      if (d < -PANEL / 2 && hasExit) return -PANEL;
      if (d > PANEL / 2 && hasClear) return PANEL;
      return 0;
    });
  }, [enabled, disabled, hasSwipe, hasExit, hasClear]);

  if (!enabled || !hasSwipe) {
    return <div className={cn("border-b border-border last:border-b-0", className)}>{children}</div>;
  }

  return (
    <div className={cn("relative overflow-hidden rounded-none", className)}>
      {hasClear ? (
        <div
          className="absolute inset-y-0 left-0 z-0 flex items-center justify-start pl-2"
          style={{ width: PANEL }}
        >
          <button
            type="button"
            disabled={disabled || !clearReady}
            onClick={(e) => {
              e.stopPropagation();
              if (!clearReady) return;
              onClear?.();
              close();
            }}
            className={cn(
              "flex h-[88%] w-[56px] flex-col items-center justify-center gap-1 rounded-2xl px-2 py-2 text-[11px] font-medium disabled:opacity-40",
              clearReady
                ? "bg-muted text-muted-foreground dark:bg-[#1e2428]"
                : "bg-muted/60 text-muted-foreground/50",
            )}
          >
            <X className="h-5 w-5" />
            <span>Clear</span>
          </button>
        </div>
      ) : null}

      {hasExit ? (
        <div
          className="absolute inset-y-0 right-0 z-0 flex items-center justify-end pr-2"
          style={{ width: PANEL }}
        >
          <button
            type="button"
            disabled={disabled}
            onClick={(e) => {
              e.stopPropagation();
              onExit?.();
              close();
            }}
            className="flex h-[88%] w-[56px] flex-col items-center justify-center gap-1 rounded-2xl bg-[#fdf2ec] px-2 py-2 text-[11px] font-medium text-[#cd3d14] disabled:opacity-40 dark:bg-[#2C1811] dark:text-[#FE9479]"
          >
            <Zap className="h-5 w-5 text-[#cd3d14] dark:text-[#FE9479]" />
            <span>Exit</span>
          </button>
        </div>
      ) : null}

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
