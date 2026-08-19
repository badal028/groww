import React from "react";
import { cn } from "@/lib/utils";

type Props = {
  show?: boolean;
  className?: string;
};

/** Groww-style "expiry" tag on index cards (shown only on expiry day IST). */
const IndexExpiryLabel: React.FC<Props> = ({ show, className }) => {
  if (!show) return null;
  return (
    <span
      className={cn(
        "shrink-0 text-[11px] font-medium lowercase leading-none tracking-tight text-muted-foreground",
        className,
      )}
    >
      expiry
    </span>
  );
};

export default IndexExpiryLabel;
