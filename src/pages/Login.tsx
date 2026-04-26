import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useForm } from "react-hook-form";
import { Eye, EyeOff, LogIn, UserPlus, ArrowRight, Bot } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type Tab = "login" | "register";

type LoginForm = { email: string; password: string };
type RegisterForm = { name: string; email: string; password: string; confirm: string };

export default function Login() {
  const { login, register, loginAsGuest, isLoading } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>("login");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  const handleGuest = () => {
    loginAsGuest();
    navigate("/dashboard");
  };

  return (
    <div className="min-h-screen bg-background flex">
      {/* Left panel – branding */}
      <div className="hidden lg:flex lg:w-[52%] flex-col relative overflow-hidden bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
        {/* Decorative blobs */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-[-10%] left-[-10%] w-[60%] h-[60%] rounded-full bg-sky-500/8 blur-3xl" />
          <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-violet-500/8 blur-3xl" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[40%] h-[40%] rounded-full bg-emerald-500/5 blur-3xl" />
          {/* Grid pattern */}
          <div
            className="absolute inset-0 opacity-[0.03]"
            style={{ backgroundImage: "linear-gradient(#fff 1px,transparent 1px),linear-gradient(90deg,#fff 1px,transparent 1px)", backgroundSize: "40px 40px" }}
          />
        </div>

        <div className="relative z-10 flex flex-col h-full p-12">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-3 mb-auto">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-sky-500/20 to-blue-600/20 border border-white/10 flex items-center justify-center p-1.5">
              <img src="/spider.png" alt="AI Collective" className="w-full h-full object-contain" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
            </div>
            <div>
              <div className="font-bold text-lg text-white leading-none">AI Collective</div>
              <div className="text-[10px] text-white/40 uppercase tracking-wider mt-0.5">{t.brand.subtitle}</div>
            </div>
          </Link>

          {/* Hero text */}
          <div className="my-auto">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-sky-500/20 bg-sky-500/10 text-sky-400 text-xs font-medium mb-6"
            >
              <Bot className="w-3.5 h-3.5" />
              {t.auth.badge}
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
              className="text-4xl font-bold text-white leading-tight mb-4"
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

            {/* Feature bullets */}
            <motion.ul
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25 }}
              className="mt-8 space-y-3"
            >
              {t.auth.heroBullets.map((bullet, i) => (
                <li key={i} className="flex items-center gap-3 text-white/60 text-sm">
                  <span className="flex-shrink-0 w-5 h-5 rounded-full bg-gradient-to-br from-sky-500 to-blue-600 flex items-center justify-center">
                    <ArrowRight className="w-2.5 h-2.5 text-white" />
                  </span>
                  {bullet}
                </li>
              ))}
            </motion.ul>
          </div>

          {/* Bottom note */}
          <p className="text-white/20 text-xs mt-auto">
            {t.landing.footer.copy}
          </p>
        </div>
      </div>

      {/* Right panel – form */}
      <div className="flex-1 flex items-center justify-center p-6 lg:p-12 bg-background">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="w-full max-w-md"
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
                onClick={() => { setTab(t_); setError(null); }}
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

          {/* Divider */}
          <div className="my-6 flex items-center gap-3">
            <div className="flex-1 h-px bg-border" />
            <span className="text-xs text-muted-foreground">{t.auth.or}</span>
            <div className="flex-1 h-px bg-border" />
          </div>

          {/* Guest login */}
          <Button variant="outline" className="w-full" onClick={handleGuest}>
            {t.auth.guestBtn}
          </Button>

          <p className="text-center text-xs text-muted-foreground mt-6">
            {t.auth.guestNote}
          </p>
        </motion.div>
      </div>
    </div>
  );
}
