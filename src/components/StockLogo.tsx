import React, { useEffect, useMemo, useState } from "react";
import { LineChart } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Stock } from "@/data/mockData";
import { getStockLogoUrlCandidates, stockLogoInitial } from "@/utils/stockLogos";

type StockLogoProps = {
  stock: Pick<Stock, "symbol" | "sector" | "name">;
  size?: number;
  className?: string;
  rounded?: "md" | "full";
};

const StockLogo: React.FC<StockLogoProps> = ({
  stock,
  size = 40,
  className,
  rounded = "full",
}) => {
  const [urlIndex, setUrlIndex] = useState(0);
  const urls = useMemo(
    () => getStockLogoUrlCandidates(stock.symbol, stock.sector, stock.name),
    [stock.symbol, stock.sector, stock.name],
  );

  useEffect(() => {
    setUrlIndex(0);
  }, [stock.symbol, stock.sector, stock.name]);

  const roundClass = rounded === "full" ? "rounded-full" : "rounded-md";
  const boxStyle = { width: size, height: size, minWidth: size, minHeight: size };

  if (stock.sector === "Index") {
    return (
      <div
        className={cn(
          "flex items-center justify-center border border-primary/40 bg-muted text-primary",
          roundClass,
          className,
        )}
        style={boxStyle}
        aria-hidden
      >
        <LineChart className="text-muted-foreground" style={{ width: size * 0.45, height: size * 0.45 }} />
      </div>
    );
  }

  if (urlIndex >= urls.length) {
    const initial = stockLogoInitial(stock.name, stock.symbol);
    return (
      <div
        className={cn(
          "flex items-center justify-center border border-primary bg-muted text-xs font-bold text-muted-foreground",
          roundClass,
          className,
        )}
        style={boxStyle}
      >
        {initial}
      </div>
    );
  }

  return (
    <img
      src={urls[urlIndex]}
      alt=""
      width={size}
      height={size}
      className={cn(
        "border border-primary/30 bg-muted object-contain p-[2px]",
        roundClass,
        className,
      )}
      style={boxStyle}
      onError={() => setUrlIndex((i) => i + 1)}
      loading="lazy"
      decoding="async"
    />
  );
};

export default StockLogo;
