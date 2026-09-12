import { motion, useReducedMotion } from "motion/react";
import type { ReactNode } from "react";

import { cn } from "cn";

interface BlurFadeProps {
  children: ReactNode;
  className?: string;
  delay?: number;
}

// Adapted from Magic UI's BlurFade pattern for restrained, accessible entry motion.
export function BlurFade({ children, className, delay = 0 }: BlurFadeProps) {
  const reduceMotion = useReducedMotion();

  return (
    <motion.div
      className={cn(className)}
      initial={reduceMotion ? false : { opacity: 0, y: 8, filter: "blur(4px)" }}
      animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      transition={reduceMotion ? { duration: 0 } : { delay, duration: 0.35, ease: "easeOut" }}
    >
      {children}
    </motion.div>
  );
}
