import Image from "next/image";

import { cn } from "@/lib/utils";

type BrandMarkProps = {
  size?: "sm" | "md" | "lg" | "xl";
  showText?: boolean;
  className?: string;
  textClassName?: string;
};

const sizeClasses = {
  sm: "size-10",
  md: "size-14",
  lg: "size-20",
  xl: "size-32",
} as const;

function BrandMark({ size = "md", showText = true, className, textClassName }: BrandMarkProps) {
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <span
        className={cn(
          "relative flex shrink-0 items-center justify-center overflow-hidden border border-primary/50 bg-background/80 p-1.5 shadow-[0_0_22px_rgba(205,242,32,0.14)]",
          sizeClasses[size],
        )}
      >
        <Image
          src="/ietelogo.png"
          alt="IETE Students' Forum logo"
          width={148}
          height={140}
          className="h-full w-full object-contain"
          priority={size === "xl"}
        />
      </span>
      {showText ? (
        <span className={cn("flex min-w-0 flex-col uppercase leading-none", textClassName)}>
          <span className="font-mono-data text-[10px] font-bold tracking-[0.22em] text-primary">IETE SF</span>
          <span className="mt-1 text-sm font-bold tracking-[0.12em] text-foreground">DigiHunt</span>
        </span>
      ) : null}
    </div>
  );
}

export { BrandMark, type BrandMarkProps };
