import { useMutation } from "@tanstack/react-query";
import { verifyAccess } from "../api/access.api";
import { VerifyAccessResponse } from "../types/access.types";

export const useVerifyAccess = () => {
  const {
    mutateAsync: verify,
    isPending,
    error,
  } = useMutation<VerifyAccessResponse, Error, string>({
    mutationFn: (code: string) => verifyAccess(code),
  });

  return {
    verify,
    isPending,
    error,
  };
};
