import { useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Mail, ArrowLeft, Lock } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog";

const ACCESS_REQUEST_EMAIL = "suzeai545@gmail.com";

export default function RequestAccess() {
  const { t } = useLanguage();
  const ra = t.requestAccess;
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [whoFor, setWhoFor] = useState("");
  const [workTypes, setWorkTypes] = useState<string[]>([]);
  const [message, setMessage] = useState("");

  const toggleWorkType = (option: string) => {
    setWorkTypes((prev) => (prev.includes(option) ? prev.filter((o) => o !== option) : [...prev, option]));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const body = [
      `${ra.emailLabel}: ${email}`,
      `${ra.whoForLabel} ${whoFor}`,
      `${ra.workTypesLabel} ${workTypes.join(", ")}`,
      ...(message.trim() ? ["", `${ra.messageLabel}`, message] : []),
    ].join("\n");
    const mailtoHref = `mailto:${ACCESS_REQUEST_EMAIL}?subject=${encodeURIComponent(ra.emailSubject)}&body=${encodeURIComponent(body)}`;
    window.location.href = mailtoHref;
    setOpen(false);
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
              <Lock className="w-3.5 h-3.5" />
              {ra.badge}
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
              className="text-4xl font-medium font-serif text-white leading-tight mb-4"
            >
              {ra.title}
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="text-white/50 text-base leading-relaxed max-w-md"
            >
              {ra.subtitle}
            </motion.p>
          </div>

          <p className="text-white/20 text-xs mt-auto">
            {t.landing.footer.copy}
          </p>
        </div>
      </div>

      {/* Right panel – request access */}
      <div className="flex-1 flex items-center justify-center p-6 lg:p-12 bg-background">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="w-full max-w-md py-4 text-center"
        >
          {/* Mobile logo */}
          <div className="flex items-center justify-center gap-2.5 mb-8 lg:hidden">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-sky-500/20 to-blue-600/20 border border-border flex items-center justify-center p-1.5">
              <img src="/spider.png" alt="" className="w-full h-full object-contain" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
            </div>
            <span className="font-bold text-base">AI Collective</span>
          </div>

          <div className="w-14 h-14 rounded-2xl bg-accent/10 border border-accent/20 flex items-center justify-center mx-auto mb-6">
            <Lock className="w-6 h-6 text-accent" />
          </div>

          <h2 className="text-2xl font-bold mb-2">{ra.title}</h2>
          <p className="text-muted-foreground text-sm mb-8 leading-relaxed">{ra.message}</p>

          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="w-full h-11">
                <Mail className="w-4 h-4" />
                {ra.emailBtn}
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md text-left">
              <DialogHeader>
                <DialogTitle className="text-xl">{ra.dialogTitle}</DialogTitle>
                <DialogDescription>{ra.dialogSubtitle}</DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="space-y-1.5">
                  <Label htmlFor="ra-email">{ra.emailLabel}</Label>
                  <Input
                    id="ra-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder={ra.emailPlaceholder}
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <Label>{ra.whoForLabel}</Label>
                  <Select value={whoFor} onValueChange={setWhoFor}>
                    <SelectTrigger>
                      <SelectValue placeholder={ra.whoForPlaceholder} />
                    </SelectTrigger>
                    <SelectContent>
                      {ra.whoForOptions.map((option) => (
                        <SelectItem key={option} value={option}>{option}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>{ra.workTypesLabel}</Label>
                  <div className="flex flex-wrap gap-2">
                    {ra.workTypesOptions.map((option) => (
                      <button
                        key={option}
                        type="button"
                        onClick={() => toggleWorkType(option)}
                        className={cn(
                          "px-3.5 py-1.5 rounded-full text-sm border transition-colors",
                          workTypes.includes(option)
                            ? "bg-accent text-white border-accent font-medium"
                            : "bg-transparent text-muted-foreground border-border hover:border-accent/40 hover:text-foreground",
                        )}
                      >
                        {option}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="ra-message">{ra.messageLabel}</Label>
                  <Textarea
                    id="ra-message"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder={ra.messagePlaceholder}
                    rows={4}
                  />
                </div>

                <Button type="submit" className="w-full">
                  {ra.submitLabel}
                </Button>
              </form>
            </DialogContent>
          </Dialog>

          <Link
            to="/"
            className="mt-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            {ra.backToHome}
          </Link>
        </motion.div>
      </div>
    </div>
  );
}
