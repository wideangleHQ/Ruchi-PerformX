import axiosClient from "@/api/client";
import { VerifyAccessRequest, VerifyAccessResponse } from "../types/access.types";

export const verifyAccess = async (code: string): Promise<VerifyAccessResponse> => {
  const request: VerifyAccessRequest = { code };
  const response = await axiosClient.post<VerifyAccessResponse>("/vms/access/verify", request);
  return response.data;
};
