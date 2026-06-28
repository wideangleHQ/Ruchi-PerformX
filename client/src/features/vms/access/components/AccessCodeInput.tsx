import { cn } from "@/lib/utils";

interface AccessCodeInputProps {
  value: string;
  className?: string;
}

export const AccessCodeInput = ({ value, className }: AccessCodeInputProps) => {
  return (
    <div className={cn("w-full max-w-sm mx-auto", className)}>
      <div 
        className="bg-white border-2 border-gray-200 rounded-xl px-4 py-6 text-center shadow-sm h-[92px] flex items-center justify-center focus-within:border-green-500 focus-within:ring-2 focus-within:ring-green-200 transition-all cursor-default"
        tabIndex={0}
      >
        <span className="text-4xl font-bold tracking-[0.5em] text-black select-none">
          {value || " "}
        </span>
      </div>
    </div>
  );
};
