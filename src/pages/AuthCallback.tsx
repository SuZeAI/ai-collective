import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

export default function AuthCallback() {
  const { loginWithToken } = useAuth();
  const navigate = useNavigate();
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    const params = new URLSearchParams(window.location.search);
    const token = params.get("token");
    const error = params.get("error");

    if (error) {
      navigate(`/login?error=${encodeURIComponent(error)}`, { replace: true });
      return;
    }

    if (!token) {
      navigate("/login?error=missing_token", { replace: true });
      return;
    }

    loginWithToken(token)
      .then(() => navigate("/dashboard", { replace: true }))
      .catch(() => navigate("/login?error=invalid_token", { replace: true }));
  }, [loginWithToken, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-4 text-muted-foreground">
        <span className="w-8 h-8 border-2 border-current border-t-transparent rounded-full animate-spin" />
        <p className="text-sm">Signing you in…</p>
      </div>
    </div>
  );
}
