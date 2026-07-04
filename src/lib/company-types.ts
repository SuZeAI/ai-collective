import { Code2, Megaphone, FlaskConical, Building2, type LucideIcon } from "lucide-react";
import type { CompanyType } from "@/lib/api";

// The four company types. `suggested` lists nav-item keys that are *highlighted*
// inside a company of this type (flexible rule — nothing is ever hidden; the
// type only marks which operational options fit best). Display labels come from
// i18n (`t.companyTypes[value]`); this module owns the icon/accent/suggested.
export type CompanyTypeDef = {
  value: CompanyType;
  icon: LucideIcon;
  suggested: string[]; // AppLayout NavItemKey values
  accent: string; // tailwind classes for the type badge
};

export const COMPANY_TYPES: CompanyTypeDef[] = [
  {
    value: "software",
    icon: Code2,
    suggested: ["projects", "tasks", "skills", "playground"],
    accent: "bg-sky-500/15 text-sky-500 border-sky-500/30",
  },
  {
    value: "marketing",
    icon: Megaphone,
    suggested: ["projects", "conversations", "documentLibrary", "marketplace"],
    accent: "bg-pink-500/15 text-pink-500 border-pink-500/30",
  },
  {
    value: "research",
    icon: FlaskConical,
    suggested: ["documentLibrary", "tasks", "conversations"],
    accent: "bg-violet-500/15 text-violet-500 border-violet-500/30",
  },
  {
    value: "general",
    icon: Building2,
    suggested: [],
    accent: "bg-muted text-muted-foreground border-border",
  },
];

export const COMPANY_TYPE_MAP = Object.fromEntries(
  COMPANY_TYPES.map((t) => [t.value, t]),
) as Record<CompanyType, CompanyTypeDef>;

/** Resolve a workspace's type, falling back to "general" for missing/unknown. */
export const companyTypeOf = (ws?: { type?: CompanyType } | null): CompanyType =>
  ws?.type && COMPANY_TYPE_MAP[ws.type] ? ws.type : "general";

/** Set of nav-item keys suggested for a given type. */
export const suggestedNavKeys = (type: CompanyType): Set<string> =>
  new Set(COMPANY_TYPE_MAP[type].suggested);
