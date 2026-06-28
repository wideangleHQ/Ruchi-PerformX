import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface PageContentProps {
  children: ReactNode;
  className?: string;
}

export const PageContent = ({ children, className }: PageContentProps) => {
  return (
    <div className={cn("flex flex-col w-full gap-6 sm:gap-8", className)}>
      {children}
    </div>
  );
};
