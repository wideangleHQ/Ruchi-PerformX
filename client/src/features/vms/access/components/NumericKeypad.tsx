import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Delete, X } from "lucide-react";

interface NumericKeypadProps {
  value?: string;
  onNumber: (num: string) => void;
  onClear: () => void;
  onBackspace: () => void;
  className?: string;
}

export const NumericKeypad = ({
  value,
  onNumber,
  onClear,
  onBackspace,
  className,
}: NumericKeypadProps) => {
  const numbers = [
    ["1", "2", "3"],
    ["4", "5", "6"],
    ["7", "8", "9"],
  ];

  return (
    <div className={cn("w-full max-w-sm mx-auto grid grid-cols-3 gap-4", className)}>
      {numbers.flat().map((num) => (
        <Button
          key={num}
          variant="outline"
          className="h-16 text-2xl font-semibold rounded-xl hover:bg-gray-100 active:bg-gray-200 transition-colors"
          onClick={() => onNumber(num)}
        >
          {num}
        </Button>
      ))}
      <Button
        variant="outline"
        className="h-16 text-red-600 font-semibold rounded-xl hover:bg-red-50 active:bg-red-100 transition-colors"
        onClick={onClear}
      >
        <X className="h-6 w-6" />
      </Button>
      <Button
        variant="outline"
        className="h-16 text-2xl font-semibold rounded-xl hover:bg-gray-100 active:bg-gray-200 transition-colors"
        onClick={() => onNumber("0")}
      >
        0
      </Button>
      <Button
        variant="outline"
        className="h-16 text-black rounded-xl hover:bg-gray-100 active:bg-gray-200 transition-colors"
        onClick={onBackspace}
      >
        <Delete className="h-6 w-6" />
      </Button>
    </div>
  );
};
