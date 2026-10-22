import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import GoogleSignInButton from "../components/GoogleSignInButton";
import OtpModal from "../components/OtpModal";

const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [otpModalOpen, setOtpModalOpen] = useState(false);
  const [otpModalMode, setOtpModalMode] = useState("reset_password");

  const { login, googleLogin } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await login(email, password);
      navigate("/");
    } catch (err) {
      setError(
        err.response?.data?.message || "Login failed. Please try again."
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogleSuccess = async (credential) => {
    setError("");
    setSubmitting(true);
    try {
      await googleLogin(credential);
      navigate("/");
    } catch (err) {
      setError(
        err.response?.data?.message ||
          "Google sign-in failed. Please try again."
      );
    } finally {
      setSubmitting(false);
    }
  };

  const openForgotPassword = () => {
    setOtpModalMode("reset_password");
    setOtpModalOpen(true);
  };

  const openOtpLogin = () => {
    setOtpModalMode("login");
    setOtpModalOpen(true);
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
          <h1 className="font-display text-xl sm:text-2xl font-semibold text-ink">
            Welcome back
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-slate">Log in to your account.</p>

          {error && (
            <div className="mt-4 rounded-md bg-rust/10 border border-rust/20 px-3 py-2 text-xs sm:text-sm text-rust">
              {error}
            </div>
          )}

          {/* Google Sign In */}
          <div className="mt-5">
            <GoogleSignInButton
              text="signin_with"
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

          <form onSubmit={handleSubmit} className="mt-4">
            <div>
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
              <div className="mb-1.5 flex items-center justify-between">
                <label className="block text-xs font-medium uppercase tracking-wide text-slate">
                  Password
                </label>
                <button
                  type="button"
                  onClick={openForgotPassword}
                  className="text-xs text-ledger hover:underline font-medium"
                >
                  Forgot password?
                </button>
              </div>
              <input
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-md border border-ink/10 bg-white px-3 py-2 text-sm text-ink outline-none transition focus:border-ledger focus:ring-1 focus:ring-ledger"
                placeholder="••••••••"
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="mt-6 w-full rounded-md bg-ledger py-2.5 text-sm font-medium text-white transition hover:bg-ledger-dark disabled:opacity-60"
            >
              {submitting ? "Logging in…" : "Log in"}
            </button>
          </form>

          {/* OTP Quick Login Button */}
          <div className="mt-3 text-center">
            <button
              type="button"
              onClick={openOtpLogin}
              className="text-xs text-slate hover:text-ink transition font-medium"
            >
              ✉️ Sign in with One-Time Email Code (OTP)
            </button>
          </div>

          <p className="mt-6 text-center text-sm text-slate border-t border-ink/10 pt-4">
            Don't have an account?{" "}
            <Link
              to="/register"
              className="font-medium text-ledger hover:underline"
            >
              Sign up
            </Link>
          </p>
        </div>
      </div>

      {/* OTP Password Reset & Passwordless Login Modal */}
      <OtpModal
        isOpen={otpModalOpen}
        onClose={() => setOtpModalOpen(false)}
        initialMode={otpModalMode}
        onSuccessLogin={() => navigate("/")}
      />
    </div>
  );
};

export default Login;
