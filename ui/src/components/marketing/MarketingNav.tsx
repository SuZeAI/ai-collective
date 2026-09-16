import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ThemeToggle } from "@/components/ThemeToggle";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { useLanguage } from "@/contexts/LanguageContext";

export function FadeIn({
  children,
  delay = 0,
  className = "",
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay, ease: "easeOut" }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

export function MarketingNav({
  secondaryLabel,
  secondaryHref = "/login",
  ctaLabel,
  ctaHref = "/dashboard",
}: {
  secondaryLabel?: string;
  secondaryHref?: string;
  ctaLabel?: string;
  ctaHref?: string;
}) {
  const { t } = useLanguage();
  const m = t.marketing;

  return (
    <div className="border-b border-border/60 bg-background/90 backdrop-blur-xl sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2">
          <img src="/spider.png" alt="AI Collective" className="h-6 w-6 object-contain" />
          <span className="font-serif text-lg font-medium">AI Collective</span>
        </Link>
        <div className="flex items-center gap-3">
          <LanguageSwitcher />
          <ThemeToggle />
          <Link to={secondaryHref} className="text-sm text-muted-foreground hover:text-foreground transition-colors">
            {secondaryLabel ?? m.common.login}
          </Link>
          <Link
            to={ctaHref}
            className="inline-flex h-9 px-4 items-center justify-center rounded-lg bg-foreground text-background text-sm font-semibold hover:opacity-90 transition-opacity"
          >
            {ctaLabel ?? m.common.startBuilding}
          </Link>
        </div>
      </div>
    </div>
  );
}
