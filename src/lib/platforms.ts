// Shared platform presentation helpers (icon emoji + gradient color per platform)
// and the inbound-webhook URL builder. Used by the per-company Platform page,
// the Companies manager, and the global Settings connections page so the visual
// language for telegram/discord/slack/… stays consistent in one place.

const API_BASE =
  ((import.meta as any).env?.VITE_API_BASE_URL as string) || "/api/v1";

export const PLATFORM_ICONS: Record<string, string> = {
  telegram: "✈️", discord: "🎮", slack: "💬", departments: "🟦",
  whatsapp_business: "💚", facebook_messenger: "💙", instagram: "📸",
  line_messaging: "🟢", viber_messaging: "💜", zalo_messaging: "🔵",
  signal_messaging: "🔒", skype_messaging: "🌐", wire_messaging: "⚡",
  wechat_messaging: "🟩", snapchat_messaging: "👻",
};

export const PLATFORM_COLORS: Record<string, string> = {
  telegram: "from-sky-500 to-blue-600",
  discord: "from-indigo-500 to-violet-600",
  slack: "from-amber-500 to-orange-500",
  departments: "from-blue-500 to-indigo-600",
  whatsapp_business: "from-emerald-500 to-green-600",
  facebook_messenger: "from-blue-400 to-indigo-500",
  instagram: "from-pink-500 to-rose-600",
  line_messaging: "from-green-500 to-teal-600",
  viber_messaging: "from-violet-500 to-purple-600",
  zalo_messaging: "from-blue-500 to-sky-600",
  signal_messaging: "from-slate-500 to-gray-600",
  skype_messaging: "from-sky-400 to-blue-500",
  wire_messaging: "from-zinc-500 to-slate-600",
  wechat_messaging: "from-green-400 to-emerald-500",
  snapchat_messaging: "from-yellow-400 to-amber-500",
};

/** Icon emoji for a platform, with a neutral link fallback. */
export const platformIcon = (platform: string): string =>
  PLATFORM_ICONS[platform] || "🔗";

/** Gradient color classes for a platform, with a neutral fallback. */
export const platformColor = (platform: string): string =>
  PLATFORM_COLORS[platform] || "from-slate-500 to-gray-600";

/** Inbound-webhook endpoint for a company connection. */
export function getWebhookUrl(
  companyId: string,
  hookId: string,
  platform: string,
): string {
  return `${API_BASE}/webhook/${platform}/${companyId}/${hookId}`;
}
