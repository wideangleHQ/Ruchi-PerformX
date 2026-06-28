import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface PageContainerProps {
  children: ReactNode;
  className?: string;
}

/**
 * Reusable container that constrains width and provides
 * consistent responsive horizontal and vertical padding.
 */
export const PageContainer = ({ children, className }: PageContainerProps) => {
  return (
    <div
      className={cn(
        "w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 lg:py-8",
        className
      )}
    >
      {children}
    </div>
  );
};
