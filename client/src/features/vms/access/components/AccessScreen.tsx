"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PageContainer } from "../../shared/components/PageContainer";
import { PageContent } from "../../shared/components/PageContent";
import { CompanyLogo } from "./CompanyLogo";
import { AccessCodeInput } from "./AccessCodeInput";
import { NumericKeypad } from "./NumericKeypad";
import { Button } from "@/components/ui/button";
import { useVerifyAccess } from "../hooks/useVerifyAccess";
import { Loader2 } from "lucide-react";

export const AccessScreen = () => {
  const [code, setCode] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const router = useRouter();
  
  const { verify, isPending } = useVerifyAccess();

  const handleNumber = (num: string) => {
    if (code.length < 4 && !isPending) {
      setCode((prev) => prev + num);
      setErrorMessage("");
    }
  };

  const handleBackspace = () => {
    if (!isPending) {
      setCode((prev) => prev.slice(0, -1));
      setErrorMessage("");
    }
  };

  const handleClear = () => {
    if (!isPending) {
      setCode("");
      setErrorMessage("");
    }
  };

  const handleContinue = async () => {
    try {
      setErrorMessage("");
      const response = await verify(code);
      
      if (response.success && response.accessToken && response.redirectTo) {
        // Always clear stale tokens before storing the fresh one.
        // This prevents old sessions (with PIN codes in sub) from persisting.
        localStorage.removeItem('vmsAccessToken');
        localStorage.removeItem('vmsAccessType');

        localStorage.setItem('vmsAccessToken', response.accessToken);
        if (response.accessType) {
          localStorage.setItem('vmsAccessType', response.accessType);
        }
        router.push(response.redirectTo);
      } else {
        setErrorMessage(response.message || "Invalid Access Code");
      }
    } catch (err: any) {
      setErrorMessage(err?.response?.data?.message || err.message || "Verification failed");
    }
  };

  const canSubmit = (code.length === 3 || code.length === 4) && !isPending;

  return (
    <PageContainer>
      <PageContent>
        <div className="flex flex-col items-center justify-center min-h-[calc(100vh-4rem)] sm:min-h-[calc(100vh-8rem)]">
          <div className="w-full max-w-md bg-white p-8 rounded-2xl shadow-sm border border-gray-100">
            <CompanyLogo className="mb-10" />
            
            <div className="space-y-8">
              <div className="space-y-2 text-center">
                <AccessCodeInput value={code} />
                {errorMessage && (
                  <p className="text-red-500 text-sm font-medium animate-in fade-in slide-in-from-top-1">
                    {errorMessage}
                  </p>
                )}
              </div>
              
              <NumericKeypad
                value={code}
                onNumber={handleNumber}
                onBackspace={handleBackspace}
                onClear={handleClear}
              />
              
              <div className="w-full max-w-sm mx-auto">
                <Button
                  className="w-full h-14 text-lg font-medium bg-green-600 hover:bg-green-700 text-white rounded-xl transition-colors"
                  disabled={!canSubmit}
                  onClick={handleContinue}
                >
                  {isPending ? <Loader2 className="h-6 w-6 animate-spin" /> : "Continue"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </PageContent>
    </PageContainer>
  );
};
