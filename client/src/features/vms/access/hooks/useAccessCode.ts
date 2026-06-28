import { useAccessStore } from "../../shared/store/access.store";
import { AccessSubmitHandler } from "../types/access.types";

interface UseAccessCodeProps {
  onSubmit?: AccessSubmitHandler;
}

export const useAccessCode = ({ onSubmit }: UseAccessCodeProps = {}) => {
  const code = useAccessStore((state) => state.code);
  const appendDigit = useAccessStore((state) => state.appendDigit);
  const removeDigit = useAccessStore((state) => state.removeDigit);
  const clear = useAccessStore((state) => state.clear);
  const reset = useAccessStore((state) => state.reset);

  const canSubmit = code.length === 3 || code.length === 4;

  const submit = async () => {
    if (canSubmit && onSubmit) {
      await onSubmit(code);
    }
  };

  return {
    code,
    appendDigit,
    removeDigit,
    clear,
    reset,
    canSubmit,
    submit,
  };
};
