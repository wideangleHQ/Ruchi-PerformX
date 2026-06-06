'use client';

import { Suspense, useState, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { authApi } from '@/api/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

type PageState = 'verify' | 'pending_approval' | 'success';

function VerifyOtpForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const email = searchParams.get('email') || '';
  const type = searchParams.get('type') || 'registration'; // 'registration' | 'reset'

  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [pageState, setPageState] = useState<PageState>('verify');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Redirect if no email
  useEffect(() => {
    if (!email) {
      router.replace('/signup');
    }
  }, [email, router]);

  // Cooldown timer for resend
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setInterval(() => setResendCooldown((c) => c - 1), 1000);
    return () => clearInterval(t);
  }, [resendCooldown]);

  const otpValue = otp.join('');

  const handleOtpChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return; // digits only
    const next = [...otp];
    next[index] = value.slice(-1);
    setOtp(next);
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (pasted.length === 6) {
      setOtp(pasted.split(''));
      inputRefs.current[5]?.focus();
    }
  };

  const handleVerify = async () => {
    if (otpValue.length !== 6) {
      setError('Please enter the 6-digit OTP');
      return;
    }
    try {
      setError(null);
      setIsLoading(true);

      if (type === 'reset') {
        await authApi.verifyResetOtp({ email, otp: otpValue });
        // Redirect to reset-password page with email
        router.push(`/reset-password?email=${encodeURIComponent(email)}`);
        return;
      }

      // Registration OTP
      const res = await authApi.verifyOtp({ email, otp: otpValue });

      // Check backend message to determine next state
      if (res.message.toLowerCase().includes('pending')) {
        setPageState('pending_approval');
      } else {
        setPageState('success');
        setTimeout(() => router.push('/login'), 2000);
      }
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Invalid OTP. Please try again.';
      setError(Array.isArray(msg) ? msg.join(', ') : msg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleResend = async () => {
    // Resend by re-registering isn't exposed; user must restart signup
    // For reset flow, re-trigger forgot-password
    // For now show instruction
    setError(null);
    setResendCooldown(60);
    // TODO: add a dedicated resend-otp endpoint when available
  };

  // ─── Pending HOD Approval State ───────────────────────────────────────────
  if (pageState === 'pending_approval') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white px-4 py-12">
        <div className="w-full max-w-md text-center">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-yellow-100">
            <svg className="h-8 w-8 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-900">Email Verified!</h2>
          <p className="mt-3 text-gray-600">
            Your email has been verified successfully. Your account is now{' '}
            <span className="font-medium text-yellow-700">pending HOD approval</span>.
          </p>
          <p className="mt-2 text-sm text-gray-500">
            You will be notified at <span className="font-medium">{email}</span> once your HOD
            approves your account. This usually takes 1–2 business days.
          </p>
          <div className="mt-8 rounded-lg bg-yellow-50 border border-yellow-200 p-4 text-left">
            <h3 className="text-sm font-semibold text-yellow-800">What happens next?</h3>
            <ul className="mt-2 space-y-1 text-sm text-yellow-700">
              <li>• Your HOD reviews your registration request</li>
              <li>• Once approved, your account becomes active</li>
              <li>• You'll receive an email notification to login</li>
            </ul>
          </div>
          <a
            href="/login"
            className="mt-6 block text-sm font-medium text-green-600 hover:text-green-700"
          >
            Back to Login
          </a>
        </div>
      </div>
    );
  }

  // ─── Success State (non-employee roles) ──────────────────────────────────
  if (pageState === 'success') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white px-4 py-12">
        <div className="w-full max-w-md text-center">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
            <svg className="h-8 w-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-900">Account Activated!</h2>
          <p className="mt-3 text-gray-600">Your email is verified. Redirecting to login...</p>
        </div>
      </div>
    );
  }

  // ─── OTP Entry State ──────────────────────────────────────────────────────
  return (
    <div className="flex min-h-screen items-center justify-center bg-white px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-green-100">
            <svg className="h-7 w-7 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Check your email</h1>
          <p className="mt-2 text-gray-600">
            We sent a 6-digit code to
          </p>
          <p className="font-medium text-gray-900">{email}</p>
          <p className="mt-1 text-sm text-gray-500">The code expires in 10 minutes</p>
        </div>

        <div className="space-y-6">
          {error && (
            <div className="rounded-md bg-red-50 border border-red-200 p-4">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          {/* OTP Input Boxes */}
          <div>
            <label className="mb-3 block text-center text-sm font-medium text-gray-700">
              Enter verification code
            </label>
            <div className="flex justify-center gap-3" onPaste={handlePaste}>
              {otp.map((digit, i) => (
                <input
                  key={i}
                  ref={(el) => { inputRefs.current[i] = el; }}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handleOtpChange(i, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(i, e)}
                  className="h-12 w-12 rounded-lg border-2 border-gray-300 text-center text-lg font-bold text-gray-900 focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-200 disabled:bg-gray-50"
                  disabled={isLoading}
                />
              ))}
            </div>
          </div>

          <Button
            onClick={handleVerify}
            disabled={isLoading || otpValue.length !== 6}
            className="w-full bg-green-600 hover:bg-green-700"
          >
            {isLoading ? 'Verifying...' : 'Verify OTP'}
          </Button>

          <div className="text-center">
            <p className="text-sm text-gray-600">
              Didn&apos;t receive the code?{' '}
              {resendCooldown > 0 ? (
                <span className="text-gray-400">Resend in {resendCooldown}s</span>
              ) : (
                <button
                  onClick={handleResend}
                  className="font-medium text-green-600 hover:text-green-700"
                >
                  Resend OTP
                </button>
              )}
            </p>
          </div>

          <div className="text-center">
            <a href="/signup" className="text-sm text-gray-500 hover:text-gray-700">
              ← Back to signup
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function VerifyOtpPage() {
  return (
    <Suspense fallback={null}>
      <VerifyOtpForm />
    </Suspense>
  );
}
