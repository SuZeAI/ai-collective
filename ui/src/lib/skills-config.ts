import { type SkillToolPreset } from "@/lib/api";

export type ToolConfigValue = string | boolean;

export const GOOGLE_TOOL_NAMES = new Set(["sheet", "drive", "docs", "slides", "calendar"]);

export type GoogleAuthConfig = {
  auth_email: string;
  token_path: string;
  credentials_path: string;
  service_account_path: string;
};

export function toTitleCaseFromToolName(value: string): string {
  return value
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1).toLowerCase()}`)
    .join(" ");
}

export function toToolPreset(toolName: string): SkillToolPreset {
  const title = toTitleCaseFromToolName(toolName);
  return {
    tool_name: toolName,
    label: title,
    third_party: title,
    config_fields: [],
  };
}

export function boolFromUnknown(value: unknown, fallback: boolean): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true") return true;
    if (normalized === "false") return false;
  }
  return fallback;
}

export function getConfigVariableNames(config: Record<string, unknown> | undefined): string[] {
  if (!config) return [];
  return Object.keys(config).filter((key) => key.trim().length > 0);
}

export function isHexColor(value: string): boolean {
  return /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(value.trim());
}

export function sanitizeEmailForTokenPath(email: string): string {
  const normalized = String(email || "").trim().toLowerCase();
  const safe = normalized.replace(/[^a-zA-Z0-9._-]/g, "_");
  return safe || "default";
}

export function ensureGoogleAuthConfig(
  config: Record<string, unknown>,
  toolName: string,
  oauthAuthEmail: string,
  oauthTokenPath: string,
  oauthCredentialsPath: string,
  oauthServiceAccountPath: string,
): Record<string, unknown> {
  if (!GOOGLE_TOOL_NAMES.has(toolName)) {
    return config;
  }

  const authEmail = String(oauthAuthEmail || config.auth_email || "").trim();
  const fallbackTokenPath = `secrets/google/${toolName}/token_${sanitizeEmailForTokenPath(authEmail)}.json`;
  const tokenPath = String(oauthTokenPath || config.token_path || fallbackTokenPath).trim();
  const credentialsPath = String(oauthCredentialsPath || config.credentials_path || "").trim();
  const serviceAccountPath = String(oauthServiceAccountPath || config.service_account_path || "").trim();

  const googleAuthConfig: GoogleAuthConfig = {
    auth_email: authEmail,
    token_path: tokenPath,
    credentials_path: credentialsPath,
    service_account_path: serviceAccountPath,
  };

  return {
    ...config,
    ...googleAuthConfig,
  };
}

export function buildDefaultConfigValues(preset: SkillToolPreset | undefined): Record<string, ToolConfigValue> {
  if (!preset) return {};
  const next: Record<string, ToolConfigValue> = {};

  for (const field of preset.config_fields || []) {
    if (field.input === "boolean") {
      next[field.key] = boolFromUnknown(field.default, false);
      continue;
    }
    next[field.key] = String(field.default ?? "");
  }

  return next;
}

export function buildConfigValuesForEdit(
  preset: SkillToolPreset | undefined,
  config: Record<string, unknown> | undefined,
): Record<string, ToolConfigValue> {
  const defaults = buildDefaultConfigValues(preset);
  if (!preset || !config) return defaults;

  const next = { ...defaults };
  for (const field of preset.config_fields || []) {
    const current = config[field.key];
    if (current === undefined || current === null) continue;
    if (field.input === "boolean") {
      next[field.key] = boolFromUnknown(current, boolFromUnknown(field.default, false));
      continue;
    }
    next[field.key] = String(current);
  }
  return next;
}

export function buildConfigFromValues(
  preset: SkillToolPreset | undefined,
  values: Record<string, ToolConfigValue>,
): Record<string, unknown> {
  if (!preset) return {};
  const config: Record<string, unknown> = {};

  for (const field of preset.config_fields || []) {
    const value = values[field.key];
    if (field.input === "boolean") {
      config[field.key] = Boolean(value);
      continue;
    }
    config[field.key] = String(value ?? "").trim();
  }

  return config;
}

export function validateRequiredConfig(
  preset: SkillToolPreset | undefined,
  values: Record<string, ToolConfigValue>,
): boolean {
  if (!preset) return true;

  for (const field of preset.config_fields || []) {
    if (!field.required) continue;

    const value = values[field.key];
    if (field.input === "boolean") continue;
    if (!String(value ?? "").trim()) return false;
  }

  return true;
}
