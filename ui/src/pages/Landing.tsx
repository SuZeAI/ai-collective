import { Link } from "react-router-dom";
import {
  ArrowRight, Bot, Check,
  Play, Sparkles,
  Mail, ArrowUpRight
} from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { LandingHeader } from "@/components/landing/LandingHeader";
import { FadeIn, ProviderIcon, PROVIDER_LOGOS, type ProviderLogoKey } from "@/components/landing/landing-helpers";
import { getLandingCopy } from "@/components/landing/landing-copy";

export default function Landing() {
  const { language } = useLanguage();
  const t = getLandingCopy(language);

  return (
    <div className="min-h-screen bg-[#faf9f5] dark:bg-[#141413] text-foreground font-sans relative overflow-x-hidden transition-colors duration-300">
      {/* Background Dots Grid */}
      <div
        className="pointer-events-none fixed inset-0 opacity-[0.02] dark:opacity-[0.03]"
        style={{
          backgroundImage:
            "linear-gradient(hsl(var(--foreground)/.15) 1px,transparent 1px),linear-gradient(90deg,hsl(var(--foreground)/.15) 1px,transparent 1px)",
          backgroundSize: "40px 40px",
        }}
      />

      {/* Global Header */}
      <LandingHeader t={t} />

      {/* 1. Left-aligned Hero Section with Vector Illustration on the right */}
      <section className="pt-24 pb-20 px-6 relative max-w-7xl mx-auto">
        <div className="pointer-events-none absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[300px] bg-[radial-gradient(ellipse_at_center,hsl(var(--accent)/0.035),transparent_70%)]" />

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-16 lg:gap-20 items-center">
          <div className="lg:col-span-6 text-left space-y-6">
            <FadeIn>
              <h1 className="text-5xl md:text-[68px] font-medium tracking-tight leading-[1.05] text-foreground font-serif">
                {t.hero.h1}
              </h1>
            </FadeIn>

            <FadeIn delay={0.08}>
              <p className="text-lg text-[#6b6960] dark:text-[#a3a197] leading-relaxed max-w-xl">
                {t.hero.sub}
              </p>
            </FadeIn>

            <FadeIn delay={0.15}>
              <div className="flex flex-wrap items-center gap-3.5 pt-2">
                <Link
                  to="/dashboard"
                  className="inline-flex items-center justify-center h-11 px-6 rounded-lg bg-[#141413] dark:bg-[#faf9f5] text-[#faf9f5] dark:text-[#141413] font-semibold text-sm hover:opacity-90 transition-opacity shadow-sm"
                >
                  {t.hero.cta1}
                </Link>
                <Link
                  to="/docs"
                  className="inline-flex items-center justify-center h-11 px-6 rounded-lg border border-[#c4c2ba] dark:border-[#4d4d4b] bg-transparent text-foreground/80 font-semibold text-sm hover:bg-muted/30 transition-all shadow-xs"
                >
                  {t.hero.cta2}
                </Link>
              </div>
            </FadeIn>
          </div>

          <div className="lg:col-span-6 flex justify-center">
            <FadeIn delay={0.1}>
              {/* Balanced Dynamic Spiderweb Multi-Staff Mesh with Descending Spider */}
              <div className="relative w-full max-w-[500px] aspect-square flex items-center justify-center bg-transparent">
                <svg viewBox="0 0 400 400" className="w-full h-full text-foreground" fill="none">
                  <style>{`
                    @keyframes spiderAdventure {
                      0% {
                        transform: translate(0px, -210px) rotate(0deg);
                      }
                      10% {
                        transform: translate(0px, 0px) rotate(0deg);
                      }
                      14% {
                        transform: translate(0px, -48px) rotate(0deg);
                      }
                      16% {
                        transform: translate(0px, -48px) rotate(125deg);
                      }
                      19% {
                        transform: translate(52px, -12px) rotate(125deg);
                      }
                      20% {
                        transform: translate(52px, -12px) rotate(200deg);
                      }
                      23% {
                        transform: translate(32px, 40px) rotate(200deg);
                      }
                      24% {
                        transform: translate(32px, 40px) rotate(270deg);
                      }
                      27% {
                        transform: translate(-32px, 40px) rotate(270deg);
                      }
                      28% {
                        transform: translate(-32px, 40px) rotate(340deg);
                      }
                      31% {
                        transform: translate(-52px, -12px) rotate(340deg);
                      }
                      32% {
                        transform: translate(-52px, -12px) rotate(415deg);
                      }
                      34% {
                        transform: translate(0px, -48px) rotate(415deg);
                      }
                      34.5% {
                        transform: translate(0px, -48px) rotate(0deg);
                      }
                      36.5% {
                        transform: translate(0px, -84px) rotate(0deg);
                      }
                      37.5% {
                        transform: translate(0px, -84px) rotate(125deg);
                      }
                      41.5% {
                        transform: translate(91px, -21px) rotate(125deg);
                      }
                      42.5% {
                        transform: translate(91px, -21px) rotate(200deg);
                      }
                      46.5% {
                        transform: translate(56px, 70px) rotate(200deg);
                      }
                      47.5% {
                        transform: translate(56px, 70px) rotate(270deg);
                      }
                      51.5% {
                        transform: translate(-56px, 70px) rotate(270deg);
                      }
                      52.5% {
                        transform: translate(-56px, 70px) rotate(340deg);
                      }
                      56.5% {
                        transform: translate(-91px, -21px) rotate(340deg);
                      }
                      57.5% {
                        transform: translate(-91px, -21px) rotate(415deg);
                      }
                      59.5% {
                        transform: translate(0px, -84px) rotate(415deg);
                      }
                      60% {
                        transform: translate(0px, -84px) rotate(0deg);
                      }
                      62% {
                        transform: translate(0px, -120px) rotate(0deg);
                      }
                      63% {
                        transform: translate(0px, -120px) rotate(125deg);
                      }
                      67% {
                        transform: translate(130px, -30px) rotate(125deg);
                      }
                      68% {
                        transform: translate(130px, -30px) rotate(200deg);
                      }
                      72% {
                        transform: translate(80px, 100px) rotate(200deg);
                      }
                      73% {
                        transform: translate(80px, 100px) rotate(270deg);
                      }
                      77% {
                        transform: translate(-80px, 100px) rotate(270deg);
                      }
                      78% {
                        transform: translate(-80px, 100px) rotate(340deg);
                      }
                      82% {
                        transform: translate(-130px, -30px) rotate(340deg);
                      }
                      83% {
                        transform: translate(-130px, -30px) rotate(415deg);
                      }
                      85% {
                        transform: translate(0px, -120px) rotate(415deg);
                      }
                      86% {
                        transform: translate(0px, -120px) rotate(180deg);
                      }
                      89% {
                        transform: translate(0px, -50px) rotate(180deg);
                      }
                      90% {
                        transform: translate(0px, -50px) rotate(0deg);
                      }
                      100% {
                        transform: translate(0px, -50px) rotate(0deg);
                      }
                    }
                    @keyframes threadScale {
                      0% {
                        transform: scaleY(0);
                      }
                      10% {
                        transform: scaleY(1);
                      }
                      85% {
                        transform: scaleY(1);
                      }
                      89% {
                        transform: scaleY(0.76);
                      }
                      100% {
                        transform: scaleY(0.76);
                      }
                    }
                    @keyframes drawSpoke {
                      0% {
                        stroke-dashoffset: 140;
                        opacity: 0.1;
                      }
                      10%, 94% {
                        stroke-dashoffset: 0;
                        opacity: 0.35;
                      }
                      98%, 100% {
                        stroke-dashoffset: 140;
                        opacity: 0.1;
                      }
                    }
                    @keyframes drawInner {
                      0%, 16% {
                        stroke-dashoffset: 302;
                        opacity: 0.15;
                        stroke: currentColor;
                      }
                      16.1% {
                        stroke-dashoffset: 302;
                        opacity: 1;
                        stroke: hsl(var(--accent));
                      }
                      34%, 94% {
                        stroke-dashoffset: 0;
                        opacity: 1;
                        stroke: hsl(var(--accent));
                      }
                      98%, 100% {
                        stroke-dashoffset: 302;
                        opacity: 0.15;
                        stroke: currentColor;
                      }
                    }
                    @keyframes drawMiddle {
                      0%, 37.5% {
                        stroke-dashoffset: 529;
                        opacity: 0.15;
                        stroke: currentColor;
                      }
                      37.6% {
                        stroke-dashoffset: 529;
                        opacity: 1;
                        stroke: hsl(var(--accent));
                      }
                      59.5%, 94% {
                        stroke-dashoffset: 0;
                        opacity: 1;
                        stroke: hsl(var(--accent));
                      }
                      98%, 100% {
                        stroke-dashoffset: 529;
                        opacity: 0.15;
                        stroke: currentColor;
                      }
                    }
                    @keyframes drawOuter {
                      0%, 63% {
                        stroke-dashoffset: 754;
                        opacity: 0.15;
                        stroke: currentColor;
                      }
                      63.1% {
                        stroke-dashoffset: 754;
                        opacity: 1;
                        stroke: hsl(var(--accent));
                      }
                      85%, 94% {
                        stroke-dashoffset: 0;
                        opacity: 1;
                        stroke: hsl(var(--accent));
                      }
                      98%, 100% {
                        stroke-dashoffset: 754;
                        opacity: 0.15;
                        stroke: currentColor;
                      }
                    }
                    @keyframes pulseGlow {
                      0%, 100% {
                        opacity: 0.3;
                        transform: scale(1);
                      }
                      50% {
                        opacity: 0.6;
                        transform: scale(1.06);
                      }
                    }
                    .spider-group {
                      animation: spiderAdventure 36s linear infinite;
                      transform-origin: 0px 0px;
                    }
                    .spider-thread {
                      animation: threadScale 36s linear infinite;
                      transform-origin: 200px 0px;
                    }
                    .pulse-circle {
                      animation: pulseGlow 4s ease-in-out infinite;
                      transform-origin: center;
                    }
                    .spoke-line {
                      stroke-dasharray: 140;
                      animation: drawSpoke 36s linear infinite;
                    }
                    .ring-inner {
                      stroke-dasharray: 302;
                      animation: drawInner 36s linear infinite;
                    }
                    .ring-middle {
                      stroke-dasharray: 529;
                      animation: drawMiddle 36s linear infinite;
                    }
                    .ring-outer {
                      stroke-dasharray: 754;
                      animation: drawOuter 36s linear infinite;
                    }
                    .staff-text {
                      font-family: var(--font-mono, monospace);
                      font-weight: 700;
                      font-size: 13.5px;
                      fill: currentColor !important;
                      letter-spacing: 0.05em;
                    }
                    /* --- SPIDER ALTERNATING TETRAPOD GAIT ---
                       Group A (swing phase 0  ): L1, L3, R2, R4
                       Group B (swing phase 0.5): L2, L4, R1, R3
                       Each leg: sweeps forward (lift) → plants → pushes back → lifts again
                    */
                    @keyframes legStrideA {
                      0%   { transform: rotate(-18deg) scaleY(0.90); }
                      15%  { transform: rotate(-18deg) scaleY(1.08); }
                      45%  { transform: rotate( 16deg) scaleY(0.96); }
                      50%  { transform: rotate( 18deg) scaleY(0.90); }
                      65%  { transform: rotate( 18deg) scaleY(1.06); }
                      95%  { transform: rotate(-16deg) scaleY(0.96); }
                      100% { transform: rotate(-18deg) scaleY(0.90); }
                    }
                    @keyframes legStrideB {
                      0%   { transform: rotate( 18deg) scaleY(0.90); }
                      15%  { transform: rotate( 18deg) scaleY(1.06); }
                      45%  { transform: rotate(-16deg) scaleY(0.96); }
                      50%  { transform: rotate(-18deg) scaleY(0.90); }
                      65%  { transform: rotate(-18deg) scaleY(1.08); }
                      95%  { transform: rotate( 16deg) scaleY(0.96); }
                      100% { transform: rotate( 18deg) scaleY(0.90); }
                    }
                    /* Front legs sweep wider; back legs push harder */
                    @keyframes legStrideFront {
                      0%   { transform: rotate(-22deg) scaleY(0.88); }
                      15%  { transform: rotate(-22deg) scaleY(1.10); }
                      45%  { transform: rotate( 18deg) scaleY(0.95); }
                      50%  { transform: rotate( 22deg) scaleY(0.88); }
                      65%  { transform: rotate( 22deg) scaleY(1.08); }
                      95%  { transform: rotate(-18deg) scaleY(0.95); }
                      100% { transform: rotate(-22deg) scaleY(0.88); }
                    }
                    @keyframes legStrideFrontB {
                      0%   { transform: rotate( 22deg) scaleY(0.88); }
                      15%  { transform: rotate( 22deg) scaleY(1.08); }
                      45%  { transform: rotate(-18deg) scaleY(0.95); }
                      50%  { transform: rotate(-22deg) scaleY(0.88); }
                      65%  { transform: rotate(-22deg) scaleY(1.10); }
                      95%  { transform: rotate( 18deg) scaleY(0.95); }
                      100% { transform: rotate( 22deg) scaleY(0.88); }
                    }
                    @keyframes palpReach {
                      0%, 100% { transform: rotate(-10deg) scaleY(0.92); }
                      50%      { transform: rotate( 10deg) scaleY(1.05); }
                    }
                    /* Group A — phase 0 */
                    .leg-l1 {
                      animation: legStrideFront 0.72s ease-in-out infinite 0s;
                      transform-origin: -3px -4px;
                    }
                    .leg-l3 {
                      animation: legStrideA 0.72s ease-in-out infinite 0s;
                      transform-origin: -4px 2px;
                    }
                    .leg-r2 {
                      animation: legStrideA 0.72s ease-in-out infinite 0s;
                      transform-origin: 4px -1px;
                    }
                    .leg-r4 {
                      animation: legStrideA 0.72s ease-in-out infinite 0s;
                      transform-origin: 3px 5px;
                    }
                    /* Group B — phase 0.36s (half of 0.72s) */
                    .leg-l2 {
                      animation: legStrideB 0.72s ease-in-out infinite 0.36s;
                      transform-origin: -4px -1px;
                    }
                    .leg-l4 {
                      animation: legStrideB 0.72s ease-in-out infinite 0.36s;
                      transform-origin: -3px 5px;
                    }
                    .leg-r1 {
                      animation: legStrideFrontB 0.72s ease-in-out infinite 0.36s;
                      transform-origin: 3px -4px;
                    }
                    .leg-r3 {
                      animation: legStrideB 0.72s ease-in-out infinite 0.36s;
                      transform-origin: 4px 2px;
                    }
                    /* Pedipalps — alternating reach */
                    .palp-l {
                      animation: palpReach 0.72s ease-in-out infinite 0s;
                      transform-origin: -1.5px -8px;
                    }
                    .palp-r {
                      animation: palpReach 0.72s ease-in-out infinite 0.36s;
                      transform-origin: 1.5px -8px;
                    }
                  `}</style>

                  {/* Soft accent gradient backgrounds for shapes */}
                  <defs>
                    <radialGradient id="tealGradCenter" cx="50%" cy="50%" r="50%">
                      <stop offset="0%" stopColor="hsl(var(--accent)/0.5)" />
                      <stop offset="100%" stopColor="hsl(var(--accent)/0.0)" />
                    </radialGradient>
                    <radialGradient id="tealGradNode" cx="50%" cy="50%" r="50%">
                      <stop offset="0%" stopColor="hsl(var(--accent)/0.65)" />
                      <stop offset="100%" stopColor="hsl(var(--accent)/0.1)" />
                    </radialGradient>
                    <linearGradient id="spiderThreadGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                      <stop offset="0%" stopColor="hsl(var(--accent)/0.1)" />
                      <stop offset="100%" stopColor="hsl(var(--accent)/0.8)" />
                    </linearGradient>
                  </defs>

                  {/* Large Center Glow */}
                  <circle cx="200" cy="200" r="140" fill="url(#tealGradCenter)" className="pulse-circle" />

                  {/* Glowing Node Backgrounds */}
                  <g className="pulse-circle">
                    <circle cx="200" cy="90" r="30" fill="url(#tealGradNode)" />
                    <circle cx="330" cy="180" r="30" fill="url(#tealGradNode)" />
                    <circle cx="280" cy="310" r="30" fill="url(#tealGradNode)" />
                    <circle cx="120" cy="310" r="30" fill="url(#tealGradNode)" />
                    <circle cx="70" cy="180" r="30" fill="url(#tealGradNode)" />
                  </g>

                  {/* Spiderweb Structural Grid */}
                  <g>
                    {/* Radial spokes extending from center (200, 210) to nodes */}
                    <line x1="200" y1="210" x2="200" y2="90" stroke="currentColor" strokeWidth="1" className="spoke-line" />
                    <line x1="200" y1="210" x2="330" y2="180" stroke="currentColor" strokeWidth="1" className="spoke-line" />
                    <line x1="200" y1="210" x2="280" y2="310" stroke="currentColor" strokeWidth="1" className="spoke-line" />
                    <line x1="200" y1="210" x2="120" y2="310" stroke="currentColor" strokeWidth="1" className="spoke-line" />
                    <line x1="200" y1="210" x2="70" y2="180" stroke="currentColor" strokeWidth="1" className="spoke-line" />

                    {/* Concentric Spiderweb Rings (Straight pentagon styles) */}
                    <path
                      d="M 200 162 L 252 198 L 232 250 L 168 250 L 148 198 Z"
                      stroke="currentColor"
                      strokeWidth="1.2"
                      fill="none"
                      className="ring-inner"
                    />
                    <path
                      d="M 200 126 L 291 189 L 256 280 L 144 280 L 109 189 Z"
                      stroke="currentColor"
                      strokeWidth="1.2"
                      fill="none"
                      className="ring-middle"
                    />
                    <path
                      d="M 200 90 L 330 180 L 280 310 L 120 310 L 70 180 Z"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      fill="none"
                      className="ring-outer"
                    />
                  </g>

                  {/* Extra cross-mesh shortcuts to represent mesh orchestrator topology */}
                  <g opacity="0.4">
                    <line x1="200" y1="90" x2="280" y2="310" stroke="currentColor" strokeWidth="1" strokeDasharray="3,6" />
                    <line x1="330" y1="180" x2="120" y2="310" stroke="currentColor" strokeWidth="1" strokeDasharray="3,6" />
                    <line x1="70" y1="180" x2="280" y2="310" stroke="currentColor" strokeWidth="1" strokeDasharray="3,6" />
                  </g>

                  {/* Staff Mesh Nodes */}

                  {/* 1. Company node */}
                  <g className="cursor-pointer">
                    <circle cx="200" cy="90" r="10" fill="currentColor" />
                    <circle cx="200" cy="90" r="18" stroke="currentColor" strokeWidth="1.5" opacity="0.4" />
                    <text x="200" y="62" textAnchor="middle" className="staff-text">
                      COMPANY
                    </text>
                  </g>

                  {/* 2. Project node */}
                  <g className="cursor-pointer">
                    <circle cx="330" cy="180" r="8" fill="currentColor" />
                    <circle cx="330" cy="180" r="14" stroke="currentColor" strokeWidth="1.5" opacity="0.4" />
                    <text x="355" y="184" textAnchor="start" className="staff-text">
                      STAFF
                    </text>
                  </g>

                  {/* 3. Department node */}
                  <g className="cursor-pointer">
                    <circle cx="280" cy="310" r="8" fill="currentColor" />
                    <circle cx="280" cy="310" r="14" stroke="currentColor" strokeWidth="1.5" opacity="0.4" />
                    <text x="280" y="342" textAnchor="middle" className="staff-text">
                      DEPARTMENT
                    </text>
                  </g>

                  {/* 4. Staff node */}
                  <g className="cursor-pointer">
                    <circle cx="120" cy="310" r="8" fill="currentColor" />
                    <circle cx="120" cy="310" r="14" stroke="currentColor" strokeWidth="1.5" opacity="0.4" />
                    <text x="120" y="342" textAnchor="middle" className="staff-text">
                      PROJECT
                    </text>
                  </g>

                  {/* 5. Skill node */}
                  <g className="cursor-pointer">
                    <circle cx="70" cy="180" r="8" fill="currentColor" />
                    <circle cx="70" cy="180" r="14" stroke="currentColor" strokeWidth="1.5" opacity="0.4" />
                    <text x="45" y="184" textAnchor="end" className="staff-text">
                      SKILL
                    </text>
                  </g>

                  {/* Center Node (representing the core orchestrator mesh hub) */}
                  <g>
                    <circle cx="200" cy="210" r="6" fill="currentColor" className="text-accent" />
                    <circle cx="200" cy="210" r="12" stroke="currentColor" strokeWidth="1" className="text-accent" opacity="0.5" />
                  </g>

                  {/* Glowing silk thread descending from the top, reaching near the center */}
                  <line x1="200" y1="0" x2="200" y2="210" stroke="url(#spiderThreadGrad)" strokeWidth="1.5" className="spider-thread" />

                  {/* Spider Group (Centered around the outer web-center translate container) */}
                  <g transform="translate(200, 210)">
                    <g className="spider-group">
                      {/* Legs (8 legs) */}
                      {/* Left legs */}
                      <path d="M -3 -4 Q -12 -9 -14 -2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" fill="none" className="leg-l1" />
                      <path d="M -4 -1 Q -15 -3 -16 4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" fill="none" className="leg-l2" />
                      <path d="M -4 2 Q -15 5 -13 12" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" fill="none" className="leg-l3" />
                      <path d="M -4 5 Q -11 11 -8 17" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" fill="none" className="leg-l4" />

                      {/* Right legs */}
                      <path d="M 3 -4 Q 12 -9 14 -2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" fill="none" className="leg-r1" />
                      <path d="M 4 -1 Q 15 -3 16 4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" fill="none" className="leg-r2" />
                      <path d="M 4 2 Q 15 5 13 12" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" fill="none" className="leg-r3" />
                      <path d="M 3 5 Q 11 11 8 17" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" fill="none" className="leg-r4" />

                      {/* Pedipalps (front feelers) */}
                      <path d="M -1.5 -8 Q -3.5 -11 -2 -13" stroke="currentColor" strokeWidth="1" strokeLinecap="round" fill="none" className="palp-l" />
                      <path d="M 1.5 -8 Q 3.5 -11 2 -13" stroke="currentColor" strokeWidth="1" strokeLinecap="round" fill="none" className="palp-r" />

                      {/* Head (Cephalothorax) */}
                      <circle cx="0" cy="-4" r="4.5" fill="currentColor" />

                      {/* Abdomen */}
                      <ellipse cx="0" cy="4" rx="6" ry="7.5" fill="currentColor" />

                      {/* Accent color dot on the back */}
                      <circle cx="0" cy="3" r="2" fill="hsl(var(--accent))" />
                    </g>
                  </g>
                </svg>
              </div>
            </FadeIn>
          </div>
        </div>
      </section>

      {/* 2. Real Platform Capabilities Marquee */}
      <style>{`
        @keyframes landingMarquee {
          0% { transform: translateX(-50%); }
          100% { transform: translateX(0%); }
        }
        .landing-marquee-track {
          animation: landingMarquee 18s linear infinite;
        }
        .landing-marquee-track:hover {
          animation-play-state: paused;
        }
        .landing-marquee-mask {
          -webkit-mask-image: linear-gradient(to right, transparent, black 10%, black 90%, transparent);
          mask-image: linear-gradient(to right, transparent, black 10%, black 90%, transparent);
        }
      `}</style>
      <section className="py-14">
        <div className="max-w-7xl mx-auto px-6 overflow-hidden landing-marquee-mask">
          <div className="flex w-max gap-10 landing-marquee-track">
            {[...t.highlights, ...t.highlights].map((item, idx) => (
              <div key={idx} className="flex items-center gap-2.5 shrink-0 text-sm text-muted-foreground whitespace-nowrap">
                <Sparkles className="w-3.5 h-3.5 text-accent shrink-0" />
                <span>{item}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 3. Choose How to Get Started */}
      <section className="px-6 py-20 bg-muted/15">
        <div className="max-w-5xl mx-auto">
          <FadeIn className="mb-12 text-center">
            <h2 className="text-3xl font-medium tracking-tight text-foreground font-serif">
              {t.started.title}
            </h2>
          </FadeIn>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Build on your own */}
            <FadeIn delay={0.05} className="h-full">
              <div className="bg-card border border-border/70 rounded-2xl p-8 flex flex-col h-full hover:border-accent/40 transition-colors shadow-sm">
                <h3 className="text-xl font-medium text-foreground mb-3 font-serif">{t.started.buildOwn.title}</h3>
                <p className="text-sm text-muted-foreground mb-6">{t.started.buildOwn.sub}</p>
                <ul className="space-y-3 mb-8 flex-1">
                  {t.started.buildOwn.bullets.map((b, idx) => (
                    <li key={idx} className="flex items-start gap-2.5 text-sm text-foreground/80">
                      <Check className="w-4 h-4 text-accent shrink-0 mt-0.5" />
                      <span>{b}</span>
                    </li>
                  ))}
                </ul>
                <Link
                  to="/dashboard"
                  className="w-full inline-flex items-center justify-center gap-2 h-10 rounded-lg bg-primary text-primary-foreground font-medium text-sm hover:opacity-90 transition-opacity shadow"
                >
                  {t.started.buildOwn.cta}
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </FadeIn>

            {/* Support */}
            <FadeIn delay={0.1} className="h-full">
              <div className="bg-card border border-border/70 rounded-2xl p-8 flex flex-col h-full hover:border-accent/40 transition-colors shadow-sm">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-accent/5 border border-accent/15 text-xs text-accent font-semibold mb-4 w-fit">
                  <Sparkles className="w-3.5 h-3.5" />
                  {t.started.support.comingSoonBadge}
                </div>
                <h3 className="text-xl font-medium text-foreground mb-3 font-serif">{t.started.support.title}</h3>
                <p className="text-sm text-muted-foreground mb-6">{t.started.support.sub}</p>
                <ul className="space-y-3 mb-8 flex-1">
                  {t.started.support.bullets.map((b, idx) => (
                    <li key={idx} className="flex items-start gap-2.5 text-sm text-foreground/80">
                      <Check className="w-4 h-4 text-accent shrink-0 mt-0.5" />
                      <span>{b}</span>
                    </li>
                  ))}
                </ul>
                <Link
                  to="/login"
                  className="w-full inline-flex items-center justify-center gap-2 h-10 rounded-lg bg-secondary text-secondary-foreground font-medium text-sm hover:bg-secondary/80 border border-border/40 transition-all shadow-sm"
                >
                  {t.started.support.cta}
                </Link>
              </div>
            </FadeIn>
          </div>
        </div>
      </section>

      {/* 4. Claude Models Section */}
      <section className="px-6 py-24 max-w-5xl mx-auto">
        <FadeIn className="mb-12">
          <h2 className="text-3xl font-medium tracking-tight text-foreground font-serif mb-3">
            {t.models.title}
          </h2>
          <p className="text-muted-foreground max-w-2xl leading-relaxed text-sm sm:text-base">
            {t.models.sub}
          </p>
        </FadeIn>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          {t.models.list.map((m, idx) => (
            <FadeIn key={idx} delay={idx * 0.05} className="h-full">
              <div className="bg-card border border-[#e8e6dc]/80 dark:border-[#2e2e2d]/60 rounded-2xl p-6 flex flex-col h-full shadow-sm hover:border-border transition-all">
                <div className="mb-3 flex items-center gap-2.5">
                  <span
                    className="inline-flex items-center justify-center w-8 h-8 rounded-lg shrink-0"
                    style={{ backgroundColor: `${PROVIDER_LOGOS[m.icon as ProviderLogoKey].color}1A` }}
                  >
                    <ProviderIcon slug={m.icon as ProviderLogoKey} className="w-4 h-4" />
                  </span>
                  <h3 className="text-lg font-semibold text-foreground font-serif">{m.name}</h3>
                </div>
                <div className="h-[72px] flex items-start mb-4 overflow-hidden">
                  <p className="text-xs text-muted-foreground leading-relaxed">{m.desc}</p>
                </div>
                <div className="border-t border-[#e8e6dc]/80 dark:border-[#2e2e2d]/60 pt-4 flex-1">
                  <span className="block text-[11px] font-semibold text-foreground/70 mb-2">{t.models.capabilitiesHeader}</span>
                  <ul className="space-y-2 text-xs text-muted-foreground list-disc pl-4 leading-relaxed">
                    {m.capabilities.map((cap, cidx) => (
                      <li key={cidx}>{cap}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </FadeIn>
          ))}
        </div>

        <FadeIn>
          <div className="bg-accent/5 border border-accent/15 rounded-xl px-4 py-3 text-xs text-accent flex items-center gap-2">
            <Sparkles className="w-4 h-4 shrink-0" />
            <span>{t.models.batch}</span>
          </div>
        </FadeIn>
      </section>

      {/* 5. Do more with built-in tools */}
      <section className="px-6 py-20 bg-muted/10">
        <div className="max-w-5xl mx-auto">
          <FadeIn className="flex flex-col sm:flex-row sm:items-end justify-between gap-6 mb-12">
            <div>
              <h2 className="text-3xl font-medium tracking-tight text-foreground font-serif mb-2">
                {t.tools.title}
              </h2>
              <p className="text-muted-foreground text-sm max-w-xl">
                {t.tools.sub}
              </p>
            </div>
            <Link
              to="/dashboard"
              className="inline-flex items-center gap-1 px-4 py-2 rounded-lg bg-secondary text-secondary-foreground border border-border/40 hover:bg-secondary/80 text-xs font-semibold transition-all shadow-sm"
            >
              {t.tools.cta}
              <ArrowUpRight className="w-3.5 h-3.5" />
            </Link>
          </FadeIn>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {t.tools.list.map((tool, idx) => (
              <FadeIn key={idx} delay={idx * 0.03} className="h-full">
                <div className="bg-card border border-border/60 rounded-xl p-5 h-full hover:border-accent/30 hover:shadow-sm transition-all duration-200">
                  <h3 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2 font-serif">
                    <span className="w-1.5 h-1.5 rounded-full bg-accent" />
                    {tool.name}
                  </h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">{tool.desc}</p>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* 6. Dashboard preview section */}
      <section className="px-6 py-24 max-w-5xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <FadeIn>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/5 border border-primary/10 text-xs text-primary font-semibold mb-6">
              <Bot className="w-3.5 h-3.5" />
              {t.console.devTitle}
            </div>
            <h2 className="text-3xl md:text-4xl font-medium tracking-tight text-foreground font-serif leading-tight mb-4">
              {t.console.title}
            </h2>
            <p className="text-muted-foreground leading-relaxed text-sm mb-8">
              {t.console.sub}
            </p>
            <div className="space-y-4 border-l-2 border-accent/40 pl-4">
              <span className="text-xs font-bold text-accent uppercase tracking-wider block">{t.console.desc}</span>
              <ul className="space-y-3">
                {t.console.bullets.map((b, idx) => (
                  <li key={idx} className="flex items-start gap-2.5 text-sm text-foreground/80">
                    <Check className="w-4 h-4 text-accent shrink-0 mt-0.5" />
                    <span>{b}</span>
                  </li>
                ))}
              </ul>
            </div>
          </FadeIn>

          <FadeIn delay={0.1}>
            {/* Console Workbench Simulator */}
            <div className="bg-zinc-950 border border-white/10 rounded-2xl overflow-hidden shadow-xl text-xs font-mono text-zinc-400">
              <div className="flex items-center justify-between px-4 py-3 bg-zinc-900 border-b border-white/5">
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                  <span className="ml-2 text-[10px] text-zinc-500">AI Collective Dashboard · Mesh Workbench</span>
                </div>
                <div className="px-2 py-0.5 rounded bg-white/5 text-[9px] text-zinc-500">v0.2.6</div>
              </div>
              <div className="p-4 space-y-4">
                <div className="space-y-1.5">
                  <div className="text-[10px] text-zinc-500 uppercase font-semibold flex items-center justify-between">
                    <span>Task Objective</span>
                    <span className="text-accent text-[9px] px-1.5 py-0.5 rounded bg-accent/10 border border-accent/25">Supervisor Mode</span>
                  </div>
                  <div className="bg-zinc-900 border border-white/5 rounded-lg p-3 text-zinc-300">
                    Analyze user auth logic, execute vulnerability tests in sandbox, and patch SQL injection vectors.
                  </div>
                </div>
                <div className="space-y-1.5">
                  <div className="text-[10px] text-zinc-500 uppercase font-semibold">Active Staff Department</div>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="bg-zinc-900 border border-white/5 rounded-lg px-2.5 py-1.5 text-[10px]">
                      <span className="text-zinc-500 font-semibold block text-[8px] uppercase">Lead</span>
                      <span className="text-zinc-300 font-medium">Orchestrator</span>
                    </div>
                    <div className="bg-zinc-900 border border-white/5 rounded-lg px-2.5 py-1.5 text-[10px]">
                      <span className="text-zinc-500 font-semibold block text-[8px] uppercase">Sandbox Exec</span>
                      <span className="text-zinc-300 font-medium">Coder Staff</span>
                    </div>
                    <div className="bg-zinc-900 border border-white/5 rounded-lg px-2.5 py-1.5 text-[10px]">
                      <span className="text-accent font-semibold block text-[8px] uppercase">Human-In-Loop</span>
                      <span className="text-zinc-300 font-medium">Auditor Staff</span>
                    </div>
                  </div>
                </div>
                <div className="space-y-1">
                  <div className="text-[10px] text-zinc-500 uppercase font-semibold">Real-Time Streaming Events</div>
                  <div className="bg-zinc-900 border border-white/5 rounded-lg p-3 space-y-2 text-[10px]">
                    <div className="flex items-start gap-2">
                      <span className="text-emerald-500 font-semibold uppercase text-[8px] mt-0.5 px-1 rounded bg-emerald-500/10 border border-emerald-500/20">SSE</span>
                      <span className="text-zinc-400">Event: <span className="text-zinc-300">staff_turn_start</span> ➔ Coder Staff</span>
                    </div>
                    <div className="flex items-start gap-2 pl-4 border-l border-zinc-800">
                      <span className="text-zinc-500 mt-0.5">&gt;</span>
                      <span className="text-zinc-500 italic">Spawning Docker Sandbox. Executing target code...</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="text-emerald-500 font-semibold uppercase text-[8px] mt-0.5 px-1 rounded bg-emerald-500/10 border border-emerald-500/20">SSE</span>
                      <span className="text-zinc-400">Event: <span className="text-zinc-300">turn_complete</span> ➔ Patch written to db.py.</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <div className="text-zinc-500 text-[10px]">Routed via Gemini 2.0 + Claude 3.5</div>
                  <button className="flex items-center gap-1.5 px-3 py-1 rounded bg-accent text-white font-semibold text-[11px] hover:bg-accent/80 transition-colors">
                    <Play className="w-3 h-3 fill-current" />
                    Run Orchestrator
                  </button>
                </div>
              </div>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* 7. Use cases for Claude */}
      <section className="px-6 py-20 bg-muted/15">
        <div className="max-w-5xl mx-auto">
          <FadeIn className="mb-12">
            <h2 className="text-3xl font-medium tracking-tight text-foreground font-serif">
              {t.usecases.title}
            </h2>
          </FadeIn>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {t.usecases.list.map((uc, idx) => (
              <FadeIn key={idx} delay={idx * 0.05} className="h-full">
                <div className="flex flex-col h-full">
                  <h3 className="text-base font-semibold text-foreground mb-2 font-serif flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-accent" />
                    {uc.name}
                  </h3>
                  <p className="text-xs text-muted-foreground leading-relaxed flex-1">{uc.desc}</p>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* 8. Footer start building cta */}
      <section className="bg-zinc-950 text-white py-24 px-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-[radial-gradient(circle_at_top_right,rgba(217,119,87,0.06),transparent_60%)] pointer-events-none" />

        <div className="max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          <FadeIn>
            <h2 className="text-4xl sm:text-5xl font-medium tracking-tight font-serif text-white mb-6">
              {t.footer.ctaTitle}
            </h2>
            <div className="flex flex-wrap items-center gap-4">
              <Link
                to="/dashboard"
                className="inline-flex items-center gap-2 h-10 px-6 rounded-lg bg-white text-zinc-950 font-medium text-sm hover:bg-zinc-200 transition-colors shadow animate-pulse"
              >
                {t.hero.cta1}
                <ArrowRight className="w-4 h-4 text-zinc-950" />
              </Link>
              <Link
                to="/contact-sales"
                className="inline-flex items-center gap-2 h-10 px-6 rounded-lg border border-white/20 bg-transparent text-white font-medium text-sm hover:bg-white/5 transition-colors"
              >
                {t.header.contactSales}
              </Link>
            </div>
          </FadeIn>

          <FadeIn delay={0.1}>
            <div className="bg-white/5 border border-white/10 rounded-2xl p-8 space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-white font-serif mb-1 flex items-center gap-2">
                  <Mail className="w-4 h-4 text-accent" />
                  {t.footer.newsTitle}
                </h3>
                <p className="text-xs text-zinc-400">{t.footer.newsSub}</p>
              </div>
              <div className="flex gap-2">
                <input
                  type="email"
                  placeholder={t.footer.newsPlaceholder}
                  className="flex-1 bg-zinc-900 border border-white/10 rounded-lg px-3 text-xs focus:outline-none focus:border-accent text-white"
                />
                <button className="px-4 py-2 rounded-lg bg-accent text-white text-xs font-semibold hover:bg-accent/80 transition-colors shadow-sm">
                  {t.footer.newsButton}
                </button>
              </div>
              <p className="text-[10px] text-zinc-500 leading-normal">{t.footer.newsDisclaimer}</p>
            </div>
          </FadeIn>
        </div>

        {/* Global Sitemap Columns */}
        <div className="max-w-5xl mx-auto mt-20 pt-16 border-t border-white/5 grid grid-cols-2 md:grid-cols-5 gap-8 text-xs text-zinc-400">
          <div className="col-span-2 space-y-4">
            <Link to="/" className="flex items-center gap-2 text-white">
              <img src="/spider.png" alt="" className="h-5 w-5 object-contain opacity-90" />
              <span className="font-serif text-sm tracking-tight font-medium">AI Collective</span>
            </Link>
            <p className="text-[10px] text-zinc-600 leading-normal max-w-xs">
              © {new Date().getFullYear()} AI Collective. {t.footerSitemap.rights}
            </p>
          </div>
          <div className="space-y-3">
            <span className="block font-semibold text-white uppercase tracking-wider text-[10px]">{t.footerSitemap.products}</span>
            <span className="block hover:text-white cursor-pointer">{t.footerSitemap.orchestrator}</span>
            <span className="block hover:text-white cursor-pointer">{t.footerSitemap.pricing}</span>
            <span className="block hover:text-white cursor-pointer">{t.footerSitemap.documentation}</span>
          </div>
          <div className="space-y-3">
            <span className="block font-semibold text-white uppercase tracking-wider text-[10px]">{t.footerSitemap.solutions}</span>
            <span className="block hover:text-white cursor-pointer">{t.footerSitemap.enterprise}</span>
            <span className="block hover:text-white cursor-pointer">{t.footerSitemap.education}</span>
            <span className="block hover:text-white cursor-pointer">{t.footerSitemap.financial}</span>
          </div>
          <div className="space-y-3">
            <span className="block font-semibold text-white uppercase tracking-wider text-[10px]">{t.footerSitemap.company}</span>
            <span className="block hover:text-white cursor-pointer">{t.footerSitemap.aboutUs}</span>
            <span className="block hover:text-white cursor-pointer">{t.footerSitemap.careers}</span>
            <span className="block hover:text-white cursor-pointer">{t.footerSitemap.press}</span>
          </div>
        </div>
      </section>
    </div>
  );
}
