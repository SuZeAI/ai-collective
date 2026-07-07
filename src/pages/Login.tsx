import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useForm } from "react-hook-form";
import { Eye, EyeOff, LogIn, UserPlus, ArrowRight, Bot, Phone, ChevronRight } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { getApiBase } from "@/lib/api-base";

type Tab = "login" | "register";
type LoginForm = { email: string; password: string };
type RegisterForm = { name: string; email: string; password: string; confirm: string };

const SOCIAL_PROVIDERS = [
  {
    id: "google",
    label: "Google",
    icon: (
      <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none">
        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
      </svg>
    ),
  },
  {
    id: "facebook",
    label: "Facebook",
    icon: (
      <svg viewBox="0 0 24 24" className="w-4 h-4" fill="#1877F2">
        <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
      </svg>
    ),
  },
  {
    id: "microsoft",
    label: "Microsoft",
    icon: (
      <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none">
        <rect x="1" y="1" width="10" height="10" fill="#F25022" />
        <rect x="13" y="1" width="10" height="10" fill="#7FBA00" />
        <rect x="1" y="13" width="10" height="10" fill="#00A4EF" />
        <rect x="13" y="13" width="10" height="10" fill="#FFB900" />
      </svg>
    ),
  },
  {
    id: "apple",
    label: "Apple",
    icon: (
      <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor">
        <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
      </svg>
    ),
  },
  {
    id: "github",
    label: "GitHub",
    icon: (
      <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor">
        <path d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.166 6.839 9.489.5.092.682-.217.682-.482 0-.237-.008-.866-.013-1.7-2.782.604-3.369-1.34-3.369-1.34-.454-1.156-1.11-1.462-1.11-1.462-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.578 9.578 0 0 1 12 6.836a9.59 9.59 0 0 1 2.504.337c1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.202 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.578.688.48C19.138 20.163 22 16.418 22 12c0-5.523-4.477-10-10-10z" />
      </svg>
    ),
  },
] as const;

export default function Login() {
  const { login, register, isLoading } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>("login");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [phoneStep, setPhoneStep] = useState<"idle" | "input" | "verify">("idle");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [phoneSending, setPhoneSending] = useState(false);
  const [socialToast, setSocialToast] = useState<string | null>(null);
  const [googleLoading, setGoogleLoading] = useState(false);

  const loginForm = useForm<LoginForm>();
  const registerForm = useForm<RegisterForm>();

  const onLogin = loginForm.handleSubmit(async (data) => {
    setError(null);
    try {
      await login(data.email, data.password);
      navigate("/dashboard");
    } catch (e: any) {
      setError(e?.message || t.auth.errorDefault);
    }
  });

  const onRegister = registerForm.handleSubmit(async (data) => {
    setError(null);
    if (data.password !== data.confirm) {
      setError(t.auth.passwordMismatch);
      return;
    }
    try {
      await register(data.name, data.email, data.password);
      navigate("/dashboard");
    } catch (e: any) {
      setError(e?.message || t.auth.errorDefault);
    }
  });

  const handleSocial = async (provider: string) => {
    if (provider === "Google") {
      setGoogleLoading(true);
      try {
        const base = getApiBase().replace(/\/$/, "");
        const res = await fetch(`${base}/auth/google/login`);
        if (!res.ok) throw new Error("Failed to start Google login");
        const { authorize_url } = await res.json();
        window.location.href = authorize_url;
      } catch {
        setSocialToast(t.auth.errorDefault);
        setTimeout(() => setSocialToast(null), 3000);
        setGoogleLoading(false);
      }
      return;
    }
    setSocialToast(`${provider}: ${t.auth.socialComingSoon}`);
    setTimeout(() => setSocialToast(null), 3000);
  };

  const handleSendCode = async () => {
    if (!phone.trim()) return;
    setPhoneSending(true);
    await new Promise((r) => setTimeout(r, 1200));
    setPhoneSending(false);
    setPhoneStep("verify");
  };

  const handleVerify = () => {
    setSocialToast(t.auth.socialComingSoon);
    setTimeout(() => setSocialToast(null), 3000);
  };

  return (
    <div className="min-h-screen bg-background flex">
      {/* Left panel – branding */}
      <div className="hidden lg:flex lg:w-[52%] flex-col relative overflow-hidden bg-[#141413] border-r border-[#262625]">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-[-10%] left-[-10%] w-[60%] h-[60%] rounded-full bg-accent/10 blur-3xl" />
          <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-[#faf9f5]/3 blur-3xl" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[40%] h-[40%] rounded-full bg-accent/5 blur-3xl" />
          <div
            className="absolute inset-0 opacity-[0.02]"
            style={{ backgroundImage: "linear-gradient(#fff 1px,transparent 1px),linear-gradient(90deg,#fff 1px,transparent 1px)", backgroundSize: "40px 40px" }}
          />
        </div>

        <div className="relative z-10 flex flex-col h-full p-12">
          <Link to="/" className="flex items-center gap-3 mb-auto">
            <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center p-1.5">
              <img src="/spider.png" alt="AI Collective" className="w-full h-full object-contain" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
            </div>
            <div>
              <div className="font-serif text-xl text-white leading-none">AI Collective</div>
              <div className="text-[10px] text-white/40 uppercase tracking-wider mt-0.5">{t.brand.subtitle}</div>
            </div>
          </Link>

          <div className="my-auto">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-accent/20 bg-accent/10 text-accent text-xs font-medium mb-6"
            >
              <Bot className="w-3.5 h-3.5" />
              {t.auth.badge}
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
              className="text-4xl font-medium font-serif text-white leading-tight mb-4"
            >
              {t.auth.heroTitle}
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="text-white/50 text-base leading-relaxed max-w-md"
            >
              {t.auth.heroSub}
            </motion.p>

            <motion.ul
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25 }}
              className="mt-8 space-y-3"
            >
              {t.auth.heroBullets.map((bullet, i) => (
                <li key={i} className="flex items-center gap-3 text-white/60 text-sm">
                  <span className="flex-shrink-0 w-5 h-5 rounded-full bg-accent flex items-center justify-center">
                    <ArrowRight className="w-2.5 h-2.5 text-white" />
                  </span>
                  {bullet}
                </li>
              ))}
            </motion.ul>
          </div>

          <p className="text-white/20 text-xs mt-auto">
            {t.landing.footer.copy}
          </p>
        </div>
      </div>

      {/* Right panel – form */}
      <div className="flex-1 flex items-center justify-center p-6 lg:p-12 bg-background overflow-y-auto">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="w-full max-w-md py-4"
        >
          {/* Mobile logo */}
          <div className="flex items-center gap-2.5 mb-8 lg:hidden">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-sky-500/20 to-blue-600/20 border border-border flex items-center justify-center p-1.5">
              <img src="/spider.png" alt="" className="w-full h-full object-contain" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
            </div>
            <span className="font-bold text-base">AI Collective</span>
          </div>

          {/* Tabs */}
          <div className="flex bg-muted rounded-xl p-1 mb-8">
            {(["login", "register"] as Tab[]).map((t_) => (
              <button
                key={t_}
                onClick={() => { setTab(t_); setError(null); setPhoneStep("idle"); }}
                className={cn(
                  "flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-all duration-200",
                  tab === t_
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {t_ === "login" ? t.auth.loginTab : t.auth.registerTab}
              </button>
            ))}
          </div>

          <AnimatePresence mode="wait">
            {tab === "login" ? (
              <motion.div
                key="login"
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 12 }}
                transition={{ duration: 0.18 }}
              >
                <h2 className="text-2xl font-bold mb-1">{t.auth.loginTitle}</h2>
                <p className="text-muted-foreground text-sm mb-6">{t.auth.loginSubtitle}</p>

                <form onSubmit={onLogin} className="space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="login-email">{t.auth.email}</Label>
                    <Input
                      id="login-email"
                      type="email"
                      placeholder="you@example.com"
                      autoComplete="email"
                      {...loginForm.register("email", { required: true })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="login-pw">{t.auth.password}</Label>
                    <div className="relative">
                      <Input
                        id="login-pw"
                        type={showPw ? "text" : "password"}
                        placeholder="••••••••"
                        autoComplete="current-password"
                        className="pr-10"
                        {...loginForm.register("password", { required: true })}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPw((v) => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                      >
                        {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {error && (
                    <p className="text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2">{error}</p>
                  )}

                  <Button type="submit" className="w-full" disabled={isLoading}>
                    {isLoading ? (
                      <span className="flex items-center gap-2">
                        <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                        {t.auth.loggingIn}
                      </span>
                    ) : (
                      <span className="flex items-center gap-2">
                        <LogIn className="w-4 h-4" />
                        {t.auth.loginBtn}
                      </span>
                    )}
                  </Button>
                </form>
              </motion.div>
            ) : (
              <motion.div
                key="register"
                initial={{ opacity: 0, x: 12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -12 }}
                transition={{ duration: 0.18 }}
              >
                <h2 className="text-2xl font-bold mb-1">{t.auth.registerTitle}</h2>
                <p className="text-muted-foreground text-sm mb-6">{t.auth.registerSubtitle}</p>

                <form onSubmit={onRegister} className="space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="reg-name">{t.auth.name}</Label>
                    <Input
                      id="reg-name"
                      type="text"
                      placeholder={t.auth.namePlaceholder}
                      autoComplete="name"
                      {...registerForm.register("name", { required: true })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="reg-email">{t.auth.email}</Label>
                    <Input
                      id="reg-email"
                      type="email"
                      placeholder="you@example.com"
                      autoComplete="email"
                      {...registerForm.register("email", { required: true })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="reg-pw">{t.auth.password}</Label>
                    <div className="relative">
                      <Input
                        id="reg-pw"
                        type={showPw ? "text" : "password"}
                        placeholder="••••••••"
                        autoComplete="new-password"
                        className="pr-10"
                        {...registerForm.register("password", { required: true, minLength: 6 })}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPw((v) => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                      >
                        {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="reg-confirm">{t.auth.confirmPassword}</Label>
                    <Input
                      id="reg-confirm"
                      type="password"
                      placeholder="••••••••"
                      autoComplete="new-password"
                      {...registerForm.register("confirm", { required: true })}
                    />
                  </div>

                  {error && (
                    <p className="text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2">{error}</p>
                  )}

                  <Button type="submit" className="w-full" disabled={isLoading}>
                    {isLoading ? (
                      <span className="flex items-center gap-2">
                        <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                        {t.auth.registering}
                      </span>
                    ) : (
                      <span className="flex items-center gap-2">
                        <UserPlus className="w-4 h-4" />
                        {t.auth.registerBtn}
                      </span>
                    )}
                  </Button>
                </form>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Social login divider */}
          <div className="my-6 flex items-center gap-3">
            <div className="flex-1 h-px bg-border" />
            <span className="text-xs text-muted-foreground whitespace-nowrap">{t.auth.orContinueWith}</span>
            <div className="flex-1 h-px bg-border" />
          </div>

          {/* Social buttons grid */}
          <div className="grid grid-cols-5 gap-2 mb-3">
            {SOCIAL_PROVIDERS.map((provider) => {
              const isGoogleLoading = provider.id === "google" && googleLoading;
              return (
                <button
                  key={provider.id}
                  type="button"
                  onClick={() => handleSocial(provider.label)}
                  title={provider.label}
                  disabled={isGoogleLoading}
                  className={cn(
                    "flex items-center justify-center h-10 rounded-lg border border-border bg-background",
                    "hover:bg-muted hover:border-border/80 transition-all duration-150",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    "disabled:opacity-60 disabled:cursor-not-allowed",
                  )}
                >
                  {isGoogleLoading
                    ? <span className="w-4 h-4 border-2 border-muted-foreground border-t-transparent rounded-full animate-spin" />
                    : provider.icon}
                </button>
              );
            })}
          </div>

          {/* Phone number login */}
          <AnimatePresence>
            {phoneStep === "idle" && (
              <motion.button
                key="phone-btn"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                type="button"
                onClick={() => setPhoneStep("input")}
                className={cn(
                  "w-full flex items-center justify-between px-4 h-10 rounded-lg border border-border bg-background",
                  "hover:bg-muted transition-all duration-150 text-sm text-muted-foreground hover:text-foreground",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                )}
              >
                <span className="flex items-center gap-2">
                  <Phone className="w-4 h-4" />
                  {t.auth.phoneBtn}
                </span>
                <ChevronRight className="w-4 h-4" />
              </motion.button>
            )}

            {phoneStep === "input" && (
              <motion.div
                key="phone-input"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <div className="border border-border rounded-lg p-4 space-y-3 bg-muted/30">
                  <p className="text-xs text-muted-foreground">{t.auth.phoneNote}</p>
                  <div className="flex gap-2">
                    <Input
                      type="tel"
                      placeholder={t.auth.phonePlaceholder}
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="flex-1"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleSendCode}
                      disabled={phoneSending || !phone.trim()}
                      className="shrink-0"
                    >
                      {phoneSending ? (
                        <span className="flex items-center gap-1.5">
                          <span className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
                          {t.auth.sendingCode}
                        </span>
                      ) : t.auth.sendCode}
                    </Button>
                  </div>
                  <button
                    type="button"
                    onClick={() => { setPhoneStep("idle"); setPhone(""); }}
                    className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {t.auth.cancel}
                  </button>
                </div>
              </motion.div>
            )}

            {phoneStep === "verify" && (
              <motion.div
                key="phone-verify"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <div className="border border-border rounded-lg p-4 space-y-3 bg-muted/30">
                  <p className="text-xs text-muted-foreground">{t.auth.verifyCode} — <span className="text-foreground font-medium">{phone}</span></p>
                  <div className="flex gap-2">
                    <Input
                      type="text"
                      inputMode="numeric"
                      maxLength={6}
                      placeholder={t.auth.codePlaceholder}
                      value={code}
                      onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                      className="flex-1 tracking-[0.4em] text-center font-mono text-lg"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleVerify}
                      disabled={code.length < 6}
                      className="shrink-0"
                    >
                      {t.auth.verifyBtn}
                    </Button>
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setPhoneStep("input")}
                      className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                    >
                      ← {t.auth.sendCode}
                    </button>
                    <button
                      type="button"
                      onClick={() => { setPhoneStep("idle"); setPhone(""); setCode(""); }}
                      className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {t.auth.cancel}
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

        </motion.div>
      </div>

      {/* Social toast */}
      <AnimatePresence>
        {socialToast && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-lg bg-foreground text-background text-sm font-medium shadow-lg"
          >
            {socialToast}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
