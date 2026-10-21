import { useEffect, useRef, useState } from "react";

const GOOGLE_CLIENT_ID =
  import.meta.env.VITE_GOOGLE_CLIENT_ID ||
  "802102326517-s2f90jhnsp39o6es8hkpu83k2rkisgup.apps.googleusercontent.com";

const GoogleSignInButton = ({
  onSuccess,
  onError,
  text = "signin_with", // "signin_with" | "signup_with" | "continue_with"
  disabled = false,
}) => {
  const containerRef = useRef(null);
  const successRef = useRef(onSuccess);
  const errorRef = useRef(onError);
  const [originNotice, setOriginNotice] = useState(false);
  const renderedRef = useRef(false);

  // Keep callback refs updated without re-triggering effects
  useEffect(() => {
    successRef.current = onSuccess;
  }, [onSuccess]);

  useEffect(() => {
    errorRef.current = onError;
  }, [onError]);

  useEffect(() => {
    let interval = null;
    let isCancelled = false;

    const setupGoogle = () => {
      if (
        !window.google?.accounts?.id ||
        !containerRef.current ||
        renderedRef.current ||
        disabled
      ) {
        return;
      }

      try {
        // Initialize once to prevent "[GSI_LOGGER]: google.accounts.id.initialize() is called multiple times"
        if (!window.__googleGsiInitialized) {
          window.google.accounts.id.initialize({
            client_id: GOOGLE_CLIENT_ID,
            callback: (response) => {
              if (response?.credential) {
                successRef.current?.(response.credential);
              } else {
                errorRef.current?.(
                  "Google sign-in did not return valid credentials."
                );
              }
            },
            auto_select: false,
          });
          window.__googleGsiInitialized = true;
        }

        // Render the official Google Identity button
        containerRef.current.innerHTML = "";
        window.google.accounts.id.renderButton(containerRef.current, {
          type: "standard",
          theme: "outline",
          size: "large",
          text,
          shape: "rectangular",
          width: containerRef.current.offsetWidth || 320,
          logo_alignment: "left",
        });

        renderedRef.current = true;

        // Verify if Google loaded the iframe or if origin was rejected (HTTP 403)
        setTimeout(() => {
          if (!isCancelled && containerRef.current) {
            const iframe = containerRef.current.querySelector("iframe");
            // If the iframe has height 0 or no iframe was created, origin is not authorized in Google Console
            if (!iframe || iframe.offsetHeight === 0) {
              setOriginNotice(true);
            }
          }
        }, 1800);
      } catch (err) {
        console.error("GIS render error:", err);
        setOriginNotice(true);
        errorRef.current?.("Could not initialize Google Sign-In.");
      }
    };

    if (window.google?.accounts?.id) {
      setupGoogle();
    } else {
      interval = setInterval(() => {
        if (window.google?.accounts?.id) {
          clearInterval(interval);
          setupGoogle();
        }
      }, 150);
    }

    return () => {
      isCancelled = true;
      if (interval) clearInterval(interval);
    };
  }, [text, disabled]);

  const handleCustomGoogleClick = () => {
    if (window.google?.accounts?.id) {
      try {
        window.google.accounts.id.prompt((notification) => {
          if (
            notification.isNotDisplayed() ||
            notification.isSkippedMoment()
          ) {
            setOriginNotice(true);
          }
        });
      } catch (err) {
        console.error("Prompt error:", err);
        setOriginNotice(true);
      }
    } else {
      errorRef.current?.("Google Sign-In is still loading. Please try again.");
    }
  };

  const currentOrigin =
    typeof window !== "undefined" ? window.location.origin : "http://localhost:5173";

  return (
    <div className="w-full flex flex-col items-center">
      {/* Container for Google GIS Rendered Button */}
      <div
        ref={containerRef}
        className="w-full flex justify-center min-h-[44px]"
      />

      {/* Fallback button if Google GIS button is blocked or fails */}
      {originNotice && (
        <div className="w-full mt-2">
          <button
            type="button"
            onClick={handleCustomGoogleClick}
            disabled={disabled}
            className="w-full flex items-center justify-center gap-2.5 rounded-md border border-ink/15 bg-white px-4 py-2.5 text-sm font-medium text-ink shadow-sm transition hover:bg-slate-50 disabled:opacity-60"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
              />
            </svg>
            <span>
              {text === "signup_with" ? "Sign up with Google" : "Sign in with Google"}
            </span>
          </button>

          {/* Setup Alert for Origin Authorization */}
          <div className="mt-2.5 rounded-md bg-amber-500/10 border border-amber-500/20 p-2.5 text-left text-xs text-amber-800">
            <p className="font-semibold text-amber-900 flex items-center gap-1">
              <span>⚠️</span> Google Cloud Console Origin Setup:
            </p>
            <p className="mt-1 text-slate leading-relaxed">
              Google blocked <code className="bg-white/80 px-1 py-0.5 rounded font-mono text-ink text-[11px]">{currentOrigin}</code> with:
              <br />
              <em className="text-amber-900 font-medium">"The given origin is not allowed for the given client ID."</em>
            </p>
            <p className="mt-1.5 text-slate leading-relaxed">
              <strong>Quick Fix:</strong> In your <a href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noopener noreferrer" className="text-ledger underline font-medium">Google Cloud Console → APIs &amp; Services → Credentials</a>, click your Client ID and add:
            </p>
            <ul className="mt-1 list-disc list-inside text-ink font-mono text-[11px] space-y-0.5">
              <li>{currentOrigin}</li>
              <li>http://localhost:5173</li>
              <li>http://localhost</li>
            </ul>
            <p className="mt-1 text-slate text-[11px]">
              under <strong>"Authorized JavaScript origins"</strong> and save.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default GoogleSignInButton;
