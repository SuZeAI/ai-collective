import {
  Bot,
  Brain,
  Briefcase,
  Cpu,
  Code2,
  Database,
  Globe,
  Handshake,
  Headphones,
  Layers3,
  Megaphone,
  Network,
  Scale,
  Search,
  Server,
  Settings2,
  ShieldCheck,
  Target,
  Terminal,
  Users,
  Workflow,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

type AgentAvatarLike = {
  avatar?: string;
  avatar_icon?: string;
  avatar_color?: string;
  avatar_url?: string;
};

const iconRegistry: Record<string, LucideIcon> = {
  // Generic / skill-tool icons
  wrench: Wrench,
  globe: Globe,
  terminal: Terminal,
  database: Database,
  server: Server,
  cpu: Cpu,

  bot: Bot,
  brain: Brain,
  search: Search,
  code2: Code2,
  megaphone: Megaphone,
  shield: ShieldCheck,
  headphones: Headphones,
  handshake: Handshake,
  briefcase: Briefcase,
  settings: Settings2,
  scale: Scale,
  users: Users,
  network: Network,
  workflow: Workflow,
  layers: Layers3,
  target: Target,
};

export const avatarIconOptions = [
  { value: "bot", label: "Bot" },
  { value: "brain", label: "Brain" },
  { value: "search", label: "Search" },
  { value: "code2", label: "Code" },
  { value: "megaphone", label: "Marketing" },
  { value: "shield", label: "Review" },
  { value: "headphones", label: "Support" },
  { value: "handshake", label: "Community" },
  { value: "briefcase", label: "Business" },
  { value: "settings", label: "Ops" },
  { value: "scale", label: "Finance" },
] as const;

export const skillAvatarIconOptions = [
  { value: "wrench", label: "Tool" },
  { value: "globe", label: "Web" },
  { value: "terminal", label: "Terminal" },
  { value: "database", label: "Database" },
  { value: "server", label: "API" },
  { value: "cpu", label: "Automation" },
  { value: "search", label: "Search" },
  { value: "code2", label: "Code" },
  { value: "brain", label: "Prompt" },
  { value: "settings", label: "System" },
] as const;

export const teamAvatarIconOptions = [
  { value: "users", label: "Team" },
  { value: "network", label: "Network" },
  { value: "workflow", label: "Workflow" },
  { value: "layers", label: "Squad" },
  { value: "target", label: "Mission" },
  { value: "briefcase", label: "Business" },
  { value: "settings", label: "Ops" },
] as const;

function isValidHexColor(input?: string): input is string {
  if (!input) return false;
  return /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(input.trim());
}

function getContrastingTextColor(bgColor: string): string {
  const hex = bgColor.replace("#", "");
  const normalized =
    hex.length === 3
      ? `${hex[0]}${hex[0]}${hex[1]}${hex[1]}${hex[2]}${hex[2]}`
      : hex;
  const r = Number.parseInt(normalized.slice(0, 2), 16);
  const g = Number.parseInt(normalized.slice(2, 4), 16);
  const b = Number.parseInt(normalized.slice(4, 6), 16);

  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.6 ? "#111827" : "#F9FAFB";
}

export function AgentAvatar({
  agent,
  className,
  iconClassName,
}: {
  agent: AgentAvatarLike;
  className?: string;
  iconClassName?: string;
}) {
  const hasImage = Boolean(agent.avatar_url && agent.avatar_url.trim());
  const normalizedIcon = (agent.avatar_icon || "").toLowerCase();
  const Icon = iconRegistry[normalizedIcon];

  const color = isValidHexColor(agent.avatar_color)
    ? agent.avatar_color.trim()
    : undefined;
  const textColor = color ? getContrastingTextColor(color) : undefined;
  const fallbackText = (agent.avatar || "?").slice(0, 1).toUpperCase();

  return (
    <div
      className={cn(
        "rounded-lg flex items-center justify-center text-sm font-bold overflow-hidden",
        className
      )}
      style={
        color
          ? {
              backgroundColor: color,
              color: textColor,
            }
          : undefined
      }
    >
      {hasImage ? (
        <img
          src={agent.avatar_url}
          alt="avatar"
          className="h-full w-full object-cover"
          loading="lazy"
          referrerPolicy="no-referrer"
        />
      ) : Icon ? (
        <Icon className={cn("w-4 h-4", iconClassName)} />
      ) : (
        fallbackText
      )}
    </div>
  );
}
