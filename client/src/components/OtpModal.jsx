import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";

const OtpModal = ({ isOpen, onClose, initialMode = "reset_password", onSuccessLogin }) => {
  const [mode, setMode] = useState(initialMode); // "reset_password" | "login"
  const [step, setStep] = useState(1); // 1: Email, 2: OTP / New Password
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [countdown, setCountdown] = useState(0);

  const { sendOtp, resetPassword, loginWithOtp } = useAuth();

  useEffect(() => {
    if (isOpen) {
      setMode(initialMode);
      setStep(1);
      setOtp("");
      setNewPassword("");
      setConfirmPassword("");
      setError("");
      setSuccessMsg("");
    }
  }, [isOpen, initialMode]);

  // Resend countdown timer
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  if (!isOpen) return null;

  // Step 1: Send OTP to email
  const handleSendOtp = async (e) => {
    e?.preventDefault();
    if (!email) {
      setError("Please enter your email address.");
      return;
    }

    setError("");
    setSuccessMsg("");
    setSubmitting(true);

    try {
      await sendOtp(email, mode);
      setStep(2);
      setCountdown(60);
      setSuccessMsg(`A 6-digit verification code has been sent to ${email}`);
    } catch (err) {
      setError(
        err.response?.data?.message ||
          "Could not send verification email. Please check your address."
      );
    } finally {
      setSubmitting(false);
    }
  };

  // Step 2: Submit OTP for Login or Reset
  const handleSubmitOtp = async (e) => {
    e.preventDefault();
    setError("");
    setSuccessMsg("");

    if (!otp || otp.trim().length !== 6) {
      setError("Please enter the complete 6-digit verification code.");
      return;
    }

    if (mode === "reset_password") {
      if (!newPassword || newPassword.length < 6) {
        setError("New password must be at least 6 characters long.");
        return;
      }
      if (newPassword !== confirmPassword) {
        setError("Passwords do not match.");
        return;
      }
    }

    setSubmitting(true);

    try {
      if (mode === "reset_password") {
        await resetPassword(email, otp.trim(), newPassword);
        setSuccessMsg("Password successfully reset! You can now log in.");
        setTimeout(() => {
          onClose();
        }, 1800);
      } else {
        // Direct OTP login
        const userData = await loginWithOtp(email, otp.trim());
        setSuccessMsg("Logged in successfully! Redirecting...");
        setTimeout(() => {
          onSuccessLogin?.(userData);
          onClose();
        }, 800);
      }
    } catch (err) {
      setError(
        err.response?.data?.message || "Invalid or expired verification code."
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-3 sm:p-4">
      <div className="w-full max-w-md max-h-[92vh] overflow-y-auto rounded-xl bg-paper p-4 sm:p-6 shadow-2xl border border-ink/10 transition-all">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-ink/10 pb-3">
          <div>
            <h2 className="font-display text-lg font-semibold text-ink">
              {mode === "reset_password"
                ? "Reset Your Password"
                : "Sign In with Email OTP"}
            </h2>
            <p className="text-xs text-slate mt-0.5">
              Secure email code verification via SpendWise SMTP
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-1 text-slate hover:bg-ink/5 hover:text-ink transition"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Notifications */}
        {error && (
          <div className="mt-4 rounded-md bg-rust/10 border border-rust/20 px-3.5 py-2.5 text-xs text-rust">
            {error}
          </div>
        )}
        {successMsg && (
          <div className="mt-4 rounded-md bg-ledger/10 border border-ledger/20 px-3.5 py-2.5 text-xs text-ledger font-medium">
            {successMsg}
          </div>
        )}

        {/* Step 1: Request OTP */}
        {step === 1 && (
          <form onSubmit={handleSendOtp} className="mt-5 space-y-4">
            <div>
              <label className="block text-xs font-medium uppercase tracking-wide text-slate mb-1">
                Your Email Address
              </label>
              <input
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com"
                className="w-full rounded-md border border-ink/10 bg-white px-3 py-2 text-sm text-ink outline-none transition focus:border-ledger focus:ring-1 focus:ring-ledger"
              />
              <p className="mt-1.5 text-xs text-slate">
                We will deliver a 6-digit code from{" "}
                <span className="font-mono text-ink/70">
                  spendwise.global@gmail.com
                </span>
                .
              </p>
            </div>

            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                onClick={() =>
                  setMode(mode === "reset_password" ? "login" : "reset_password")
                }
                className="text-xs text-ledger hover:underline font-medium"
              >
                {mode === "reset_password"
                  ? "Prefer passwordless OTP sign-in?"
                  : "Need to reset password instead?"}
              </button>

              <button
                type="submit"
                disabled={submitting}
                className="rounded-md bg-ledger px-4 py-2 text-sm font-medium text-white transition hover:bg-ledger-dark disabled:opacity-60"
              >
                {submitting ? "Sending code…" : "Send Security Code"}
              </button>
            </div>
          </form>
        )}

        {/* Step 2: Verification and Password Input */}
        {step === 2 && (
          <form onSubmit={handleSubmitOtp} className="mt-5 space-y-4">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-medium uppercase tracking-wide text-slate">
                  6-Digit Verification Code
                </label>
                <button
                  type="button"
                  disabled={countdown > 0 || submitting}
                  onClick={handleSendOtp}
                  className="text-xs text-ledger hover:underline disabled:text-slate/60 font-medium"
                >
                  {countdown > 0 ? `Resend code in ${countdown}s` : "Resend code"}
                </button>
              </div>
              <input
                type="text"
                maxLength={6}
                required
                autoComplete="one-time-code"
                value={otp}
                onChange={(e) =>
                  setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))
                }
                placeholder="123456"
                className="w-full rounded-md border border-ink/10 bg-white px-3 py-2.5 text-center text-lg font-mono tracking-[0.3em] font-semibold text-ink outline-none transition focus:border-ledger focus:ring-1 focus:ring-ledger"
              />
            </div>

            {mode === "reset_password" && (
              <>
                <div>
                  <label className="block text-xs font-medium uppercase tracking-wide text-slate mb-1">
                    New Password
                  </label>
                  <input
                    type="password"
                    required
                    minLength={6}
                    autoComplete="new-password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="At least 6 characters"
                    className="w-full rounded-md border border-ink/10 bg-white px-3 py-2 text-sm text-ink outline-none transition focus:border-ledger focus:ring-1 focus:ring-ledger"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium uppercase tracking-wide text-slate mb-1">
                    Confirm New Password
                  </label>
                  <input
                    type="password"
                    required
                    minLength={6}
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-type new password"
                    className="w-full rounded-md border border-ink/10 bg-white px-3 py-2 text-sm text-ink outline-none transition focus:border-ledger focus:ring-1 focus:ring-ledger"
                  />
                </div>
              </>
            )}

            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="text-xs text-slate hover:text-ink font-medium transition"
              >
                ← Back to email
              </button>

              <button
                type="submit"
                disabled={submitting}
                className="rounded-md bg-ledger px-5 py-2 text-sm font-medium text-white transition hover:bg-ledger-dark disabled:opacity-60"
              >
                {submitting
                  ? "Processing…"
                  : mode === "reset_password"
                  ? "Update Password"
                  : "Verify & Log In"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default OtpModal;
