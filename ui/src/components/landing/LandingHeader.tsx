import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Menu, X, ChevronDown, ExternalLink, Star } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { type LandingCopy } from "./landing-copy";
import { GITHUB_URL, GithubIcon, fmt, useGitHubStats } from "./landing-helpers";

export function LandingHeader({ t }: { t: LandingCopy }) {
  const { stars } = useGitHubStats();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const [activeMobileSection, setActiveMobileSection] = useState<string | null>(null);
  const headerRef = useRef<HTMLElement>(null);

  // Reset active mobile accordion section when menu is closed
  useEffect(() => {
    if (!mobileMenuOpen) {
      setActiveMobileSection(null);
    }
  }, [mobileMenuOpen]);

  const toggleMobileSection = (section: string) => {
    setActiveMobileSection(activeMobileSection === section ? null : section);
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (headerRef.current && !headerRef.current.contains(e.target as Node)) {
        setActiveDropdown(null);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

return (
      <header ref={headerRef} className="sticky top-0 z-50 border-b border-[#e8e6dc]/80 dark:border-[#2e2e2d]/60 bg-background/90 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 shrink-0 group">
            {/* Spider logo - original blue/green color */}
            <div className="relative w-6 h-6 flex items-center justify-center">
              <img
                src="/spider.png"
                alt="AI Collective Logo"
                className="h-6 w-6 object-contain opacity-95"
              />
            </div>
            <span className="font-serif text-lg tracking-tight font-medium text-foreground">AI Collective</span>
          </Link>

          {/* Right Side: Nav items + CTA Buttons */}
          <div className="hidden md:flex items-center gap-6 text-sm font-medium relative">
            <nav className="flex items-center gap-6 text-muted-foreground">

              {/* Meet Collective */}
              <div className="relative" onMouseEnter={() => setActiveDropdown('meet')} onMouseLeave={() => setActiveDropdown(null)}>
                <span className={`flex items-center gap-1 cursor-pointer transition-colors whitespace-nowrap hover:text-foreground ${activeDropdown === 'meet' ? 'text-foreground' : ''}`}>
                  {t.header.meetCollective}
                  <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${activeDropdown === 'meet' ? 'rotate-180 opacity-100' : 'opacity-60'}`} />
                </span>
                <AnimatePresence>
                  {activeDropdown === 'meet' && (
                    <motion.div
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 6 }}
                      transition={{ duration: 0.15 }}
                      className="absolute top-full left-0 mt-3 w-[520px] bg-background border border-[#e8e6dc] dark:border-[#2e2e2d] rounded-xl shadow-xl p-5 z-50"
                    >
                      <div className="grid grid-cols-3 gap-6">
                        <div>
                          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest mb-3">{t.header.products}</p>
                          <div className="space-y-2.5">
                            <Link to="/meet" className="block text-sm text-foreground hover:text-accent transition-colors font-medium">AI Collective</Link>
                            <Link to="/meet" className="block text-sm text-muted-foreground hover:text-foreground transition-colors">Staff Mesh</Link>
                          </div>
                        </div>
                        <div>
                          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest mb-3">{t.header.features}</p>
                          <div className="space-y-2.5">
                            <Link to="/meet" className="block text-sm text-muted-foreground hover:text-foreground cursor-pointer transition-colors">{t.tools.list[0].name}</Link>
                            <Link to="/meet" className="block text-sm text-muted-foreground hover:text-foreground cursor-pointer transition-colors">{t.tools.list[5].name}</Link>
                            <Link to="/meet" className="block text-sm text-muted-foreground hover:text-foreground cursor-pointer transition-colors">{t.tools.list[4].name}</Link>
                          </div>
                        </div>
                        <div>
                          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest mb-3">{t.header.models}</p>
                          <div className="space-y-2.5">
                            <Link to="/meet" className="block text-sm text-muted-foreground hover:text-foreground cursor-pointer transition-colors">{t.models.list[0].name}</Link>
                            <Link to="/meet" className="block text-sm text-muted-foreground hover:text-foreground cursor-pointer transition-colors">{t.models.list[1].name}</Link>
                            <Link to="/meet" className="block text-sm text-muted-foreground hover:text-foreground cursor-pointer transition-colors">{t.models.list[2].name}</Link>
                            <Link to="/meet" className="block text-sm text-muted-foreground hover:text-foreground cursor-pointer transition-colors">{t.models.list[3].name}</Link>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Platform */}
              <div className="relative" onMouseEnter={() => setActiveDropdown('platform')} onMouseLeave={() => setActiveDropdown(null)}>
                <span className={`flex items-center gap-1 cursor-pointer whitespace-nowrap font-semibold transition-colors ${activeDropdown === 'platform' ? 'text-foreground' : 'text-foreground'}`}>
                  {t.header.platform}
                  <ChevronDown className={`w-3.5 h-3.5 text-accent transition-transform duration-200 ${activeDropdown === 'platform' ? 'rotate-180' : ''}`} />
                </span>
                <AnimatePresence>
                  {activeDropdown === 'platform' && (
                    <motion.div
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 6 }}
                      transition={{ duration: 0.15 }}
                      className="absolute top-full left-0 mt-3 w-52 bg-background border border-[#e8e6dc] dark:border-[#2e2e2d] rounded-xl shadow-xl py-2 z-50"
                    >
                      <Link to="/" className="flex items-center justify-between px-4 py-2.5 text-sm text-foreground hover:bg-muted/50 transition-colors">{t.header.overview}</Link>
                      <Link to="/docs" className="flex items-center justify-between px-4 py-2.5 text-sm text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors">
                        {t.header.devDocs}
                      </Link>
                      <Link to="/pricing" className="flex items-center justify-between px-4 py-2.5 text-sm text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors">{t.header.pricing}</Link>
                      <div className="my-1 border-t border-[#e8e6dc] dark:border-[#2e2e2d]" />
                      <Link to="/dashboard" className="flex items-center justify-between px-4 py-2.5 text-sm text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors">
                        {t.header.consoleLogin} <ExternalLink className="w-3.5 h-3.5" />
                      </Link>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Solutions */}
              <div className="relative" onMouseEnter={() => setActiveDropdown('solutions')} onMouseLeave={() => setActiveDropdown(null)}>
                <span className={`flex items-center gap-1 cursor-pointer transition-colors whitespace-nowrap hover:text-foreground ${activeDropdown === 'solutions' ? 'text-foreground' : ''}`}>
                  {t.header.solutions}
                  <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${activeDropdown === 'solutions' ? 'rotate-180 opacity-100' : 'opacity-60'}`} />
                </span>
                <AnimatePresence>
                  {activeDropdown === 'solutions' && (
                    <motion.div
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 6 }}
                      transition={{ duration: 0.15 }}
                      className="absolute top-full left-0 mt-3 w-[560px] bg-background border border-[#e8e6dc] dark:border-[#2e2e2d] rounded-xl shadow-xl p-5 z-50"
                    >
                      <div className="grid grid-cols-4 gap-5">
                        <div>
                          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest mb-3">{t.header.useCases}</p>
                          <div className="space-y-2.5">
                            <Link to="/solutions" className="block text-sm text-muted-foreground hover:text-foreground cursor-pointer transition-colors">{t.header.aiStaff}</Link>
                            <Link to="/solutions" className="block text-sm text-muted-foreground hover:text-foreground cursor-pointer transition-colors">{t.header.dataPipelines}</Link>
                            <Link to="/solutions" className="block text-sm text-muted-foreground hover:text-foreground cursor-pointer transition-colors">{t.header.codeReview}</Link>
                          </div>
                        </div>
                        <div>
                          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest mb-3">{t.header.companySize}</p>
                          <div className="space-y-2.5">
                            <Link to="/solutions" className="block text-sm text-muted-foreground hover:text-foreground cursor-pointer transition-colors">{t.header.startups}</Link>
                            <Link to="/solutions" className="block text-sm text-muted-foreground hover:text-foreground cursor-pointer transition-colors">{t.header.enterprise}</Link>
                          </div>
                        </div>
                        <div>
                          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest mb-3">{t.header.departments}</p>
                          <div className="space-y-2.5">
                            <Link to="/solutions" className="block text-sm text-muted-foreground hover:text-foreground cursor-pointer transition-colors">{t.header.engineering}</Link>
                            <Link to="/solutions" className="block text-sm text-muted-foreground hover:text-foreground cursor-pointer transition-colors">{t.header.research}</Link>
                          </div>
                        </div>
                        <div>
                          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest mb-3">{t.header.industries}</p>
                          <div className="space-y-2.5">
                            <Link to="/solutions" className="block text-sm text-muted-foreground hover:text-foreground cursor-pointer transition-colors">{t.header.fintech}</Link>
                            <Link to="/solutions" className="block text-sm text-muted-foreground hover:text-foreground cursor-pointer transition-colors">{t.header.legal}</Link>
                            <Link to="/solutions" className="block text-sm text-muted-foreground hover:text-foreground cursor-pointer transition-colors">{t.header.healthcare}</Link>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Pricing - no dropdown */}
              <Link to="/pricing" className="hover:text-foreground cursor-pointer transition-colors whitespace-nowrap">{t.header.pricing}</Link>

              {/* Resources */}
              <div className="relative" onMouseEnter={() => setActiveDropdown('resources')} onMouseLeave={() => setActiveDropdown(null)}>
                <span className={`flex items-center gap-1 cursor-pointer transition-colors whitespace-nowrap hover:text-foreground ${activeDropdown === 'resources' ? 'text-foreground' : ''}`}>
                  {t.header.resources}
                  <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${activeDropdown === 'resources' ? 'rotate-180 opacity-100' : 'opacity-60'}`} />
                </span>
                <AnimatePresence>
                  {activeDropdown === 'resources' && (
                    <motion.div
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 6 }}
                      transition={{ duration: 0.15 }}
                      className="absolute top-full left-0 mt-3 w-48 bg-background border border-[#e8e6dc] dark:border-[#2e2e2d] rounded-xl shadow-xl py-2 z-50"
                    >
                      <Link to="/resources" className="flex items-center px-4 py-2.5 text-sm text-foreground hover:bg-muted/50 cursor-pointer transition-colors">{t.header.overview}</Link>
                      <a href={GITHUB_URL} target="_blank" rel="noopener noreferrer" className="flex items-center justify-between px-4 py-2.5 text-sm text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors">
                        GitHub <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                      <Link to="/docs" className="flex items-center justify-between px-4 py-2.5 text-sm text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors">
                        {t.header.devDocs}
                      </Link>
                      <div className="my-1 border-t border-[#e8e6dc] dark:border-[#2e2e2d]" />
                      <Link to="/changelog" className="flex items-center px-4 py-2.5 text-sm text-muted-foreground hover:text-foreground hover:bg-muted/50 cursor-pointer transition-colors">{t.header.changelog}</Link>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </nav>

            {/* Divider */}
            <div className="h-4 w-px bg-[#e8e6dc]/80 dark:bg-[#2e2e2d]/60" />

            {/* CTA Group */}
            <div className="flex items-center gap-3">
              <Link to="/login" className="text-muted-foreground hover:text-foreground transition-colors whitespace-nowrap text-sm">
                {t.header.login}
              </Link>
              <Link
                to="/contact-sales"
                className="inline-flex items-center justify-center h-9 px-4 rounded-lg border border-[#c4c2ba] dark:border-[#4d4d4b] hover:bg-muted/60 transition-colors whitespace-nowrap text-sm text-foreground"
              >
                {t.header.contactSales}
              </Link>
              <Link
                to="/dashboard"
                className="inline-flex items-center justify-center h-9 px-4 rounded-lg bg-[#141413] dark:bg-[#faf9f5] text-[#faf9f5] dark:text-[#141413] hover:opacity-90 transition-opacity shadow-sm whitespace-nowrap text-sm font-semibold"
              >
                {t.header.startBuilding}
              </Link>
            </div>
          </div>

          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-1.5 rounded-lg border border-border md:hidden hover:bg-muted/50 text-foreground"
          >
            {mobileMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
          </button>
        </div>

        {/* Secondary Header Platform Strip */}
        <div className="border-t border-[#e8e6dc]/80 dark:border-[#2e2e2d]/60 bg-[#f6f5ee]/40 dark:bg-[#181817]/20 py-2">
          <div className="max-w-7xl mx-auto px-6 flex items-center justify-between text-[13px] text-muted-foreground">
            <div className="flex items-center gap-4">
              <span className="text-foreground font-semibold">{t.header.platform}</span>
              <div className="flex items-center gap-1 hover:text-foreground cursor-pointer font-medium">
                <span>{t.header.exploreHere}</span>
                <ChevronDown className="w-3.5 h-3.5 opacity-60" />
              </div>
            </div>
            <div className="hidden sm:flex items-center gap-4">
              <a
                href={GITHUB_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center h-7 rounded-lg overflow-hidden border border-border/60 text-xs font-semibold hover:border-border transition-all group"
              >
                <span className="flex items-center gap-1.5 px-2.5 h-full bg-muted/60 hover:bg-muted transition-colors text-muted-foreground group-hover:text-foreground border-r border-border/60">
                  <GithubIcon className="w-3 h-3" />
                  {t.header.star}
                </span>
                <span className="flex items-center gap-1 px-2 h-full text-foreground font-bold">
                  {stars === null
                    ? <span className="w-6 h-2 rounded bg-muted animate-pulse" />
                    : <><Star className="w-3 h-3 text-accent" />{fmt(stars)}</>
                  }
                </span>
              </a>
              <LanguageSwitcher />
              <ThemeToggle />
            </div>
          </div>
        </div>

        {/* Mobile Menu */}
        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="md:hidden absolute top-full left-0 right-0 border-b border-[#e8e6dc]/80 dark:border-[#2e2e2d]/60 bg-background px-6 py-5 space-y-3 flex flex-col font-medium text-sm text-muted-foreground shadow-2xl z-50 max-h-[75vh] overflow-y-auto"
            >
              {/* Meet Collective */}
              <div className="w-full">
                <button
                  onClick={() => toggleMobileSection("meet")}
                  className="flex items-center justify-between w-full py-1.5 text-foreground hover:text-accent transition-colors"
                >
                  <span>{t.header.meetCollective}</span>
                  <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${activeMobileSection === "meet" ? "rotate-180" : "opacity-60"}`} />
                </button>
                <AnimatePresence>
                  {activeMobileSection === "meet" && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.15 }}
                      className="overflow-hidden pl-4 border-l border-[#e8e6dc] dark:border-[#2e2e2d] space-y-4 py-2 mt-1"
                    >
                      <div>
                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1.5">{t.header.products}</p>
                        <div className="flex flex-col gap-2">
                          <Link to="/meet" onClick={() => setMobileMenuOpen(false)} className="text-sm text-foreground hover:text-accent transition-colors font-medium">AI Collective</Link>
                          <Link to="/meet" onClick={() => setMobileMenuOpen(false)} className="text-sm text-muted-foreground hover:text-foreground transition-colors">Staff Mesh</Link>
                        </div>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1.5">{t.header.features}</p>
                        <div className="flex flex-col gap-2">
                          <Link to="/meet" onClick={() => setMobileMenuOpen(false)} className="text-sm text-muted-foreground hover:text-foreground transition-colors">{t.tools.list[0].name}</Link>
                          <Link to="/meet" onClick={() => setMobileMenuOpen(false)} className="text-sm text-muted-foreground hover:text-foreground transition-colors">{t.tools.list[5].name}</Link>
                          <Link to="/meet" onClick={() => setMobileMenuOpen(false)} className="text-sm text-muted-foreground hover:text-foreground transition-colors">{t.tools.list[4].name}</Link>
                        </div>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1.5">{t.header.models}</p>
                        <div className="flex flex-col gap-2">
                          <Link to="/meet" onClick={() => setMobileMenuOpen(false)} className="text-sm text-muted-foreground hover:text-foreground transition-colors">{t.models.list[0].name}</Link>
                          <Link to="/meet" onClick={() => setMobileMenuOpen(false)} className="text-sm text-muted-foreground hover:text-foreground transition-colors">{t.models.list[1].name}</Link>
                          <Link to="/meet" onClick={() => setMobileMenuOpen(false)} className="text-sm text-muted-foreground hover:text-foreground transition-colors">{t.models.list[2].name}</Link>
                          <Link to="/meet" onClick={() => setMobileMenuOpen(false)} className="text-sm text-muted-foreground hover:text-foreground transition-colors">{t.models.list[3].name}</Link>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Platform */}
              <div className="w-full">
                <button
                  onClick={() => toggleMobileSection("platform")}
                  className="flex items-center justify-between w-full py-1.5 text-foreground hover:text-accent transition-colors"
                >
                  <span>{t.header.platform}</span>
                  <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${activeMobileSection === "platform" ? "rotate-180" : "opacity-60"}`} />
                </button>
                <AnimatePresence>
                  {activeMobileSection === "platform" && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.15 }}
                      className="overflow-hidden pl-4 border-l border-[#e8e6dc] dark:border-[#2e2e2d] space-y-2 py-2 mt-1 flex flex-col"
                    >
                      <Link to="/" onClick={() => setMobileMenuOpen(false)} className="text-sm text-foreground hover:text-accent transition-colors">{t.header.overview}</Link>
                      <Link to="/docs" onClick={() => setMobileMenuOpen(false)} className="text-sm text-muted-foreground hover:text-foreground flex items-center justify-between pr-4 transition-colors">
                        {t.header.devDocs}
                      </Link>
                      <Link to="/pricing" onClick={() => setMobileMenuOpen(false)} className="text-sm text-muted-foreground hover:text-foreground transition-colors">{t.header.pricing}</Link>
                      <div className="my-1 border-t border-[#e8e6dc]/40 dark:border-[#2e2e2d]/40" />
                      <Link to="/dashboard" onClick={() => setMobileMenuOpen(false)} className="text-sm text-muted-foreground hover:text-foreground flex items-center justify-between pr-4 transition-colors">
                        {t.header.consoleLogin} <ExternalLink className="w-3.5 h-3.5" />
                      </Link>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Solutions */}
              <div className="w-full">
                <button
                  onClick={() => toggleMobileSection("solutions")}
                  className="flex items-center justify-between w-full py-1.5 text-foreground hover:text-accent transition-colors"
                >
                  <span>{t.header.solutions}</span>
                  <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${activeMobileSection === "solutions" ? "rotate-180" : "opacity-60"}`} />
                </button>
                <AnimatePresence>
                  {activeMobileSection === "solutions" && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.15 }}
                      className="overflow-hidden pl-4 border-l border-[#e8e6dc] dark:border-[#2e2e2d] space-y-4 py-2 mt-1"
                    >
                      <div>
                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1.5">{t.header.useCases}</p>
                        <div className="flex flex-col gap-2">
                          <Link to="/solutions" onClick={() => setMobileMenuOpen(false)} className="text-sm text-muted-foreground hover:text-foreground transition-colors">{t.header.aiStaff}</Link>
                          <Link to="/solutions" onClick={() => setMobileMenuOpen(false)} className="text-sm text-muted-foreground hover:text-foreground transition-colors">{t.header.dataPipelines}</Link>
                          <Link to="/solutions" onClick={() => setMobileMenuOpen(false)} className="text-sm text-muted-foreground hover:text-foreground transition-colors">{t.header.codeReview}</Link>
                        </div>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1.5">{t.header.companySize}</p>
                        <div className="flex flex-col gap-2">
                          <Link to="/solutions" onClick={() => setMobileMenuOpen(false)} className="text-sm text-muted-foreground hover:text-foreground transition-colors">{t.header.startups}</Link>
                          <Link to="/solutions" onClick={() => setMobileMenuOpen(false)} className="text-sm text-muted-foreground hover:text-foreground transition-colors">{t.header.enterprise}</Link>
                        </div>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1.5">{t.header.departments}</p>
                        <div className="flex flex-col gap-2">
                          <Link to="/solutions" onClick={() => setMobileMenuOpen(false)} className="text-sm text-muted-foreground hover:text-foreground transition-colors">{t.header.engineering}</Link>
                          <Link to="/solutions" onClick={() => setMobileMenuOpen(false)} className="text-sm text-muted-foreground hover:text-foreground transition-colors">{t.header.research}</Link>
                        </div>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1.5">{t.header.industries}</p>
                        <div className="flex flex-col gap-2">
                          <Link to="/solutions" onClick={() => setMobileMenuOpen(false)} className="text-sm text-muted-foreground hover:text-foreground transition-colors">{t.header.fintech}</Link>
                          <Link to="/solutions" onClick={() => setMobileMenuOpen(false)} className="text-sm text-muted-foreground hover:text-foreground transition-colors">{t.header.legal}</Link>
                          <Link to="/solutions" onClick={() => setMobileMenuOpen(false)} className="text-sm text-muted-foreground hover:text-foreground transition-colors">{t.header.healthcare}</Link>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Pricing */}
              <Link
                to="/pricing"
                onClick={() => setMobileMenuOpen(false)}
                className="block py-1.5 text-foreground hover:text-accent transition-colors"
              >
                {t.header.pricing}
              </Link>

              {/* Resources */}
              <div className="w-full">
                <button
                  onClick={() => toggleMobileSection("resources")}
                  className="flex items-center justify-between w-full py-1.5 text-foreground hover:text-accent transition-colors"
                >
                  <span>{t.header.resources}</span>
                  <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${activeMobileSection === "resources" ? "rotate-180" : "opacity-60"}`} />
                </button>
                <AnimatePresence>
                  {activeMobileSection === "resources" && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.15 }}
                      className="overflow-hidden pl-4 border-l border-[#e8e6dc] dark:border-[#2e2e2d] space-y-2 py-2 mt-1 flex flex-col"
                    >
                      <Link to="/resources" onClick={() => setMobileMenuOpen(false)} className="text-sm text-foreground hover:text-accent transition-colors">{t.header.overview}</Link>
                      <a href={GITHUB_URL} target="_blank" rel="noopener noreferrer" onClick={() => setMobileMenuOpen(false)} className="text-sm text-muted-foreground hover:text-foreground flex items-center justify-between pr-4 transition-colors">
                        GitHub <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                      <Link to="/docs" onClick={() => setMobileMenuOpen(false)} className="text-sm text-muted-foreground hover:text-foreground flex items-center justify-between pr-4 transition-colors">
                        {t.header.devDocs}
                      </Link>
                      <div className="my-1 border-t border-[#e8e6dc]/40 dark:border-[#2e2e2d]/40" />
                      <Link to="/changelog" onClick={() => setMobileMenuOpen(false)} className="text-sm text-muted-foreground hover:text-foreground transition-colors">{t.header.changelog}</Link>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <hr className="border-[#e8e6dc] dark:border-[#2e2e2d]" />

              <div className="flex flex-col gap-3 pt-1">
                <Link to="/login" onClick={() => setMobileMenuOpen(false)} className="text-foreground hover:text-accent transition-colors py-1">
                  {t.header.login}
                </Link>
                <Link
                  to="/contact-sales"
                  onClick={() => setMobileMenuOpen(false)}
                  className="inline-flex items-center justify-center h-10 rounded-lg border border-[#c4c2ba] dark:border-[#4d4d4b] hover:bg-muted/60 transition-colors text-foreground"
                >
                  {t.header.contactSales}
                </Link>
                <Link
                  to="/dashboard"
                  onClick={() => setMobileMenuOpen(false)}
                  className="inline-flex items-center justify-center h-10 rounded-lg bg-[#141413] dark:bg-[#faf9f5] text-[#faf9f5] dark:text-[#141413] hover:opacity-90 transition-opacity font-semibold shadow-sm"
                >
                  {t.header.startBuilding}
                </Link>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </header>
  );
}
