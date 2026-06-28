import { create } from "zustand";
import { AccessStore } from "../../access/types/access.types";

export const useAccessStore = create<AccessStore>((set, get) => ({
  code: "",
  appendDigit: (digit: string) => {
    const currentCode = get().code;
    if (currentCode.length < 4 && /^\d$/.test(digit)) {
      set({ code: currentCode + digit });
    }
  },
  removeDigit: () => {
    const currentCode = get().code;
    set({ code: currentCode.slice(0, -1) });
  },
  clear: () => {
    set({ code: "" });
  },
  reset: () => {
    set({ code: "" });
  },
}));
