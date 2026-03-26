import * as React from "react";
import { cn } from "./utils";

export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {}

export function Skeleton({ className, ...props }: SkeletonProps) {
  return (
    <div
      className={cn(
        "animate-pulse rounded-md bg-white/5",
        "before:block before:h-full before:w-full before:rounded-md before:bg-gradient-to-r before:from-transparent before:via-white/10 before:to-transparent before:animate-[shimmer_1.8s_ease-in-out_infinite]",
        className
      )}
      {...props}
    />
  );
}

// Shimmer keyframes (scoped)
const style = typeof window === "undefined" ? "" : `
@keyframes shimmer {
  0% { background-position: -200px 0; }
  100% { background-position: 200px 0; }
}`;

if (typeof document !== "undefined" && !document.getElementById("skeleton-shimmer")) {
  const tag = document.createElement("style");
  tag.id = "skeleton-shimmer";
  tag.innerHTML = style;
  document.head.appendChild(tag);
}
