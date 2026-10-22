import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import GoogleSignInButton from "../components/GoogleSignInButton";
import { ShieldCheck, Mail, ArrowLeft, RefreshCw } from "lucide-react";

const Register = () => {
  const [step, setStep] = useState(1); // 1: Details, 2: OTP Verification
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [countdown, setCountdown] = useState(0);
  const [error, setError] = useState("");
  const [infoMessage, setInfoMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [resending, setResending] = useState(false);

  const { register, googleLogin, sendOtp } = useAuth();
  const navigate = useNavigate();

  // Resend countdown timer
  useEffect(() => {
    let timer;
    if (step === 2 && countdown > 0) {
      timer = setTimeout(() => setCountdown((prev) => prev - 1), 1000);
    }
    return () => clearTimeout(timer);
  }, [step, countdown]);

  // Step 1: Validate details and send OTP
  const handleProceedToOtp = async (e) => {
    e.preventDefault();
    setError("");
    setInfoMessage("");

    if (!name.trim()) {
      setError("Please enter your name.");
      return;
    }
    if (!email.trim()) {
      setError("Please enter your email address.");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters long.");
      return;
    }

    setSubmitting(true);
    try {
      await sendOtp(email.trim(), "verify_email", name.trim());
      setStep(2);
      setCountdown(60);
      setOtp("");
      setInfoMessage(`A 6-digit verification code has been sent to ${email.trim()}`);
    } catch (err) {
      setError(
        err.response?.data?.message ||
          "Could not send verification email. Please check your address."
      );
    } finally {
      setSubmitting(false);
    }
  };

  // Step 2: Resend OTP
  const handleResendOtp = async () => {
    setError("");
    setInfoMessage("");
    setResending(true);
    try {
      await sendOtp(email.trim(), "verify_email", name.trim());
      setCountdown(60);
      setInfoMessage(`A new 6-digit verification code has been sent to ${email.trim()}`);
    } catch (err) {
      setError(
        err.response?.data?.message ||
          "Failed to resend verification code. Please try again."
      );
    } finally {
      setResending(false);
    }
  };

  // Step 2: Submit OTP & complete registration
  const handleVerifyAndRegister = async (e) => {
    e.preventDefault();
    setError("");
    setInfoMessage("");

    const cleanOtp = otp.trim();
    if (!cleanOtp || cleanOtp.length !== 6) {
      setError("Please enter the complete 6-digit verification code.");
      return;
    }

    setSubmitting(true);
    try {
      await register(name.trim(), email.trim(), password, cleanOtp);
      navigate("/");
    } catch (err) {
      setError(
        err.response?.data?.message ||
          "Registration failed. Please check the code and try again."
      );
    } finally {
      setSubmitting(false);
    }
  };

  // Google OAuth Success
  const handleGoogleSuccess = async (credential) => {
    setError("");
    setSubmitting(true);
    try {
      await googleLogin(credential);
      navigate("/");
    } catch (err) {
      setError(
        err.response?.data?.message ||
          "Google sign-up failed. Please try again."
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-ink px-4 py-8">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <p className="font-display text-3xl font-semibold text-paper">
            Spendwise
          </p>
          <p className="mt-1 text-xs uppercase tracking-[0.2em] text-white/40">
            track smarter
          </p>
        </div>

        <div className="rounded-xl bg-paper p-5 sm:p-8 shadow-xl border border-ink/10">
          {/* Header */}
          {step === 1 ? (
            <div>
              <h1 className="font-display text-xl sm:text-2xl font-semibold text-ink">
                Create your account
              </h1>
              <p className="mt-1 text-xs sm:text-sm text-slate">
                Start tracking your money in minutes.
              </p>
            </div>
          ) : (
            <div>
              <div className="flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-ledger/10 text-ledger">
                  <ShieldCheck size={18} />
                </span>
                <h1 className="font-display text-xl font-semibold text-ink">
                  Verify your email
                </h1>
              </div>
              <p className="mt-1.5 text-xs text-slate">
                We sent a 6-digit security code to{" "}
                <span className="font-semibold text-ink break-all">{email}</span>
                <button
                  type="button"
                  onClick={() => {
                    setStep(1);
                    setError("");
                    setInfoMessage("");
                  }}
                  className="ml-2 font-medium text-ledger underline hover:text-ledger-dark"
                >
                  Edit
                </button>
              </p>
            </div>
          )}

          {/* Feedback Banners */}
          {error && (
            <div className="mt-4 rounded-md bg-rust/10 border border-rust/20 px-3 py-2 text-xs sm:text-sm text-rust">
              {error}
            </div>
          )}

          {infoMessage && (
            <div className="mt-4 rounded-md bg-ledger/10 border border-ledger/20 px-3 py-2 text-xs sm:text-sm text-ledger">
              {infoMessage}
            </div>
          )}

          {/* STEP 1: FORM */}
          {step === 1 && (
            <>
              {/* Google Sign Up */}
              <div className="mt-5">
                <GoogleSignInButton
                  text="signup_with"
                  disabled={submitting}
                  onSuccess={handleGoogleSuccess}
                  onError={setError}
                />
              </div>

              {/* Divider */}
              <div className="relative my-4 flex items-center justify-center">
                <div className="w-full border-t border-ink/10" />
                <span className="absolute bg-paper px-2 text-xs uppercase tracking-wider text-slate">
                  or continue with email
                </span>
              </div>

              <form onSubmit={handleProceedToOtp} className="mt-4">
                <div>
                  <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-slate">
                    Name
                  </label>
                  <input
                    type="text"
                    required
                    autoComplete="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full rounded-md border border-ink/10 bg-white px-3 py-2 text-sm text-ink outline-none transition focus:border-ledger focus:ring-1 focus:ring-ledger"
                    placeholder="Jordan Rivera"
                  />
                </div>

                <div className="mt-4">
                  <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-slate">
                    Email
                  </label>
                  <input
                    type="email"
                    required
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full rounded-md border border-ink/10 bg-white px-3 py-2 text-sm text-ink outline-none transition focus:border-ledger focus:ring-1 focus:ring-ledger"
                    placeholder="you@example.com"
                  />
                </div>

                <div className="mt-4">
                  <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-slate">
                    Password
                  </label>
                  <input
                    type="password"
                    required
                    minLength={6}
                    autoComplete="new-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full rounded-md border border-ink/10 bg-white px-3 py-2 text-sm text-ink outline-none transition focus:border-ledger focus:ring-1 focus:ring-ledger"
                    placeholder="At least 6 characters"
                  />
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="mt-6 flex w-full items-center justify-center gap-2 rounded-md bg-ledger py-2.5 text-sm font-medium text-white transition hover:bg-ledger-dark disabled:opacity-60"
                >
                  <Mail size={16} />
                  <span>
                    {submitting ? "Sending code…" : "Verify Email & Continue"}
                  </span>
                </button>
              </form>
            </>
          )}

          {/* STEP 2: OTP VERIFICATION */}
          {step === 2 && (
            <form onSubmit={handleVerifyAndRegister} className="mt-5 space-y-4">
              <div>
                <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-slate">
                  Enter 6-Digit Verification Code
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  inputMode="numeric"
                  maxLength={6}
                  value={otp}
                  onChange={(e) =>
                    setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))
                  }
                  placeholder="••••••"
                  className="w-full rounded-md border border-ink/20 bg-white py-3 text-center font-mono text-2xl font-bold tracking-[0.4em] text-ink outline-none transition focus:border-ledger focus:ring-2 focus:ring-ledger/20"
                />
                <p className="mt-1.5 text-center text-[11px] text-slate">
                  Check your inbox and spam folder for the security code.
                </p>
              </div>

              {/* Resend Code */}
              <div className="flex items-center justify-center pt-1 text-xs">
                {countdown > 0 ? (
                  <span className="text-slate">
                    Resend code in{" "}
                    <span className="font-semibold text-ink">
                      {countdown}s
                    </span>
                  </span>
                ) : (
                  <button
                    type="button"
                    disabled={resending}
                    onClick={handleResendOtp}
                    className="flex items-center gap-1 font-medium text-ledger hover:text-ledger-dark disabled:opacity-60"
                  >
                    <RefreshCw size={12} className={resending ? "animate-spin" : ""} />
                    <span>{resending ? "Sending…" : "Resend Verification Code"}</span>
                  </button>
                )}
              </div>

              <button
                type="submit"
                disabled={submitting || otp.trim().length !== 6}
                className="w-full rounded-md bg-ledger py-2.5 text-sm font-medium text-white transition hover:bg-ledger-dark disabled:opacity-50"
              >
                {submitting ? "Verifying & Creating Account…" : "Verify & Create Account"}
              </button>

              <button
                type="button"
                onClick={() => {
                  setStep(1);
                  setError("");
                  setInfoMessage("");
                }}
                className="flex w-full items-center justify-center gap-1 py-1 text-xs text-slate hover:text-ink transition"
              >
                <ArrowLeft size={13} />
                <span>Back to registration details</span>
              </button>
            </form>
          )}

          <p className="mt-6 text-center text-sm text-slate border-t border-ink/10 pt-4">
            Already have an account?{" "}
            <Link
              to="/login"
              className="font-medium text-ledger hover:underline"
            >
              Log in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Register;
