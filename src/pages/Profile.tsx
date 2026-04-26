import { useRef, useState } from "react";
import { motion } from "framer-motion";
import { useForm } from "react-hook-form";
import {
  User, Mail, Lock, Shield, Calendar, LogOut,
  Check, AlertCircle, Pencil, Camera, Upload,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api";

type ProfileForm = { name: string; email: string };
type PasswordForm = { current: string; newPw: string; confirm: string };

function UserAvatar({ name, src, size = "lg" }: { name: string; src?: string; size?: "sm" | "lg" }) {
  const initials = name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
  const cls = size === "lg" ? "w-20 h-20 text-2xl" : "w-9 h-9 text-sm";
  if (src) {
    return (
      <img
        src={src}
        alt={name}
        className={`${cls} rounded-full object-cover flex-shrink-0`}
      />
    );
  }
  return (
    <div className={`${cls} rounded-full bg-gradient-to-br from-sky-500 to-violet-600 flex items-center justify-center text-white font-bold flex-shrink-0`}>
      {initials || <User className="w-1/2 h-1/2" />}
    </div>
  );
}

export default function Profile() {
  const { user, logout, updateUser, isGuest } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();

  const [profileStatus, setProfileStatus] = useState<"idle" | "saving" | "ok" | "error">("idle");
  const [profileError, setProfileError] = useState<string | null>(null);
  const [pwStatus, setPwStatus] = useState<"idle" | "saving" | "ok" | "error">("idle");
  const [pwError, setPwError] = useState<string | null>(null);
  const [editMode, setEditMode] = useState(false);

  const [avatarMode, setAvatarMode] = useState<"url" | "upload">("url");
  const [avatarUrl, setAvatarUrl] = useState(user?.avatar ?? "");
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const profileForm = useForm<ProfileForm>({
    defaultValues: { name: user?.name ?? "", email: user?.email ?? "" },
  });

  const passwordForm = useForm<PasswordForm>();

  const handleOpenEditMode = () => {
    setAvatarUrl(user?.avatar ?? "");
    setAvatarMode("url");
    setAvatarError(null);
    setEditMode(true);
  };

  const handleAvatarFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarUploading(true);
    setAvatarError(null);
    try {
      const updated = await api.uploadAvatar(file);
      setAvatarUrl(updated.avatar ?? "");
      updateUser({ avatar: updated.avatar });
    } catch (err: any) {
      setAvatarError(err?.message ?? "Upload failed");
    } finally {
      setAvatarUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const onSaveProfile = profileForm.handleSubmit(async (data) => {
    setProfileStatus("saving");
    setProfileError(null);
    try {
      if (!isGuest) {
        const updated = await api.updateProfile({
          name: data.name,
          email: data.email,
          avatar: avatarUrl || null,
        });
        updateUser(updated);
      } else {
        updateUser({ name: data.name, email: data.email, avatar: avatarUrl || undefined });
      }
      setProfileStatus("ok");
      setEditMode(false);
      setTimeout(() => setProfileStatus("idle"), 2000);
    } catch (e: any) {
      setProfileError(e?.message ?? t.auth.errorDefault);
      setProfileStatus("error");
    }
  });

  const onChangePassword = passwordForm.handleSubmit(async (data) => {
    if (data.newPw !== data.confirm) {
      setPwError(t.auth.passwordMismatch);
      return;
    }
    setPwStatus("saving");
    setPwError(null);
    try {
      await api.changePassword(data.current, data.newPw);
      setPwStatus("ok");
      passwordForm.reset();
      setTimeout(() => setPwStatus("idle"), 2000);
    } catch (e: any) {
      setPwError(e?.message ?? t.auth.errorDefault);
      setPwStatus("error");
    }
  });

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  if (!user) return null;

  const joinedDate = user.joinedAt
    ? new Date(user.joinedAt).toLocaleDateString()
    : "—";

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header card */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl border border-border bg-card p-6"
      >
        <div className="flex items-start gap-5">
          <button
            type="button"
            className="relative group flex-shrink-0 rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            onClick={editMode ? undefined : handleOpenEditMode}
            title="Change avatar"
          >
            <UserAvatar name={user.name} src={user.avatar || undefined} size="lg" />
            {!editMode && (
              <span className="absolute inset-0 rounded-full bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <Camera className="w-5 h-5 text-white" />
              </span>
            )}
          </button>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h1 className="text-xl font-bold truncate">{user.name}</h1>
                <p className="text-muted-foreground text-sm mt-0.5">{user.email}</p>
                {user.role && (
                  <span className="inline-flex items-center gap-1.5 mt-2 text-xs font-medium px-2.5 py-1 rounded-full bg-sky-500/10 text-sky-400 border border-sky-500/20">
                    <Shield className="w-3 h-3" />
                    {user.role}
                  </span>
                )}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={editMode ? () => setEditMode(false) : handleOpenEditMode}
                className="flex-shrink-0"
              >
                <Pencil className="w-3.5 h-3.5 mr-1.5" />
                {editMode ? t.auth.cancel : t.auth.editProfile}
              </Button>
            </div>

            <div className="flex items-center gap-1.5 mt-4 text-xs text-muted-foreground">
              <Calendar className="w-3.5 h-3.5" />
              {t.auth.memberSince} {joinedDate}
            </div>
          </div>
        </div>

        {isGuest && (
          <div className="mt-4 flex items-center gap-2 text-sm text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            {t.auth.guestModeNote}
          </div>
        )}
      </motion.div>

      {/* Edit profile */}
      {editMode && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl border border-border bg-card p-6"
        >
          <div className="flex items-center gap-2 mb-5">
            <div className="w-7 h-7 rounded-lg bg-sky-500/15 flex items-center justify-center">
              <User className="w-3.5 h-3.5 text-sky-400" />
            </div>
            <h2 className="font-semibold">{t.auth.editProfile}</h2>
          </div>
          <form onSubmit={onSaveProfile} className="space-y-4">
            {/* Avatar section */}
            <div className="space-y-2">
              <Label>Avatar</Label>
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0">
                  <UserAvatar name={user.name} src={avatarUrl || undefined} size="lg" />
                </div>
                <div className="flex-1 space-y-2">
                  {/* Mode toggle */}
                  <div className="flex gap-1 p-1 bg-muted rounded-lg w-fit text-xs">
                    <button
                      type="button"
                      onClick={() => setAvatarMode("url")}
                      className={`px-3 py-1 rounded-md transition-colors ${avatarMode === "url" ? "bg-background shadow text-foreground" : "text-muted-foreground hover:text-foreground"}`}
                    >
                      Image URL
                    </button>
                    <button
                      type="button"
                      onClick={() => setAvatarMode("upload")}
                      className={`px-3 py-1 rounded-md transition-colors ${avatarMode === "upload" ? "bg-background shadow text-foreground" : "text-muted-foreground hover:text-foreground"}`}
                    >
                      Upload file
                    </button>
                  </div>

                  {avatarMode === "url" ? (
                    <Input
                      placeholder="https://example.com/avatar.jpg"
                      value={avatarUrl}
                      onChange={(e) => setAvatarUrl(e.target.value)}
                    />
                  ) : (
                    <label className="inline-flex items-center gap-2 cursor-pointer border border-border rounded-md px-3 py-1.5 text-sm hover:bg-muted transition-colors select-none">
                      <Upload className="w-3.5 h-3.5" />
                      {avatarUploading ? "Uploading…" : "Choose image"}
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/jpeg,image/png,image/gif,image/webp"
                        className="hidden"
                        disabled={avatarUploading}
                        onChange={handleAvatarFileChange}
                      />
                    </label>
                  )}

                  {avatarError && (
                    <p className="text-xs text-destructive">{avatarError}</p>
                  )}

                  {avatarUrl && (
                    <button
                      type="button"
                      onClick={() => setAvatarUrl("")}
                      className="text-xs text-muted-foreground hover:text-destructive transition-colors"
                    >
                      Remove avatar
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="prof-name">{t.auth.name}</Label>
                <Input id="prof-name" {...profileForm.register("name", { required: true })} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="prof-email">{t.auth.email}</Label>
                <Input id="prof-email" type="email" {...profileForm.register("email", { required: true })} />
              </div>
            </div>

            {profileError && (
              <p className="text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2">{profileError}</p>
            )}

            <div className="flex items-center gap-3">
              <Button type="submit" disabled={profileStatus === "saving"}>
                {profileStatus === "saving" ? (
                  <span className="flex items-center gap-2">
                    <span className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                    {t.auth.saving}
                  </span>
                ) : profileStatus === "ok" ? (
                  <span className="flex items-center gap-2">
                    <Check className="w-4 h-4" />
                    {t.auth.saved}
                  </span>
                ) : t.auth.saveChanges}
              </Button>
              <Button type="button" variant="ghost" onClick={() => setEditMode(false)}>
                {t.auth.cancel}
              </Button>
            </div>
          </form>
        </motion.div>
      )}

      {/* Change password – hidden for guests */}
      {!isGuest && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="rounded-2xl border border-border bg-card p-6"
        >
          <div className="flex items-center gap-2 mb-5">
            <div className="w-7 h-7 rounded-lg bg-violet-500/15 flex items-center justify-center">
              <Lock className="w-3.5 h-3.5 text-violet-400" />
            </div>
            <h2 className="font-semibold">{t.auth.changePassword}</h2>
          </div>
          <form onSubmit={onChangePassword} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="cur-pw">{t.auth.currentPassword}</Label>
              <Input id="cur-pw" type="password" autoComplete="current-password" {...passwordForm.register("current", { required: true })} />
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="new-pw">{t.auth.newPassword}</Label>
                <Input id="new-pw" type="password" autoComplete="new-password" {...passwordForm.register("newPw", { required: true, minLength: 6 })} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="conf-pw">{t.auth.confirmPassword}</Label>
                <Input id="conf-pw" type="password" autoComplete="new-password" {...passwordForm.register("confirm", { required: true })} />
              </div>
            </div>

            {pwError && (
              <p className="text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2">{pwError}</p>
            )}

            <Button type="submit" variant="outline" disabled={pwStatus === "saving"}>
              {pwStatus === "saving" ? (
                <span className="flex items-center gap-2">
                  <span className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  {t.auth.saving}
                </span>
              ) : pwStatus === "ok" ? (
                <span className="flex items-center gap-2">
                  <Check className="w-4 h-4" />
                  {t.auth.saved}
                </span>
              ) : t.auth.changePassword}
            </Button>
          </form>
        </motion.div>
      )}

      {/* Account info */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="rounded-2xl border border-border bg-card p-6"
      >
        <div className="flex items-center gap-2 mb-5">
          <div className="w-7 h-7 rounded-lg bg-emerald-500/15 flex items-center justify-center">
            <Mail className="w-3.5 h-3.5 text-emerald-400" />
          </div>
          <h2 className="font-semibold">{t.auth.accountInfo}</h2>
        </div>
        <dl className="space-y-3">
          {[
            { label: t.auth.name, value: user.name },
            { label: t.auth.email, value: user.email },
            { label: t.auth.role, value: user.role ?? "—" },
            { label: t.auth.userId, value: user.id },
            { label: t.auth.memberSince, value: joinedDate },
          ].map(({ label, value }) => (
            <div key={label} className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
              <dt className="text-sm text-muted-foreground">{label}</dt>
              <dd className="text-sm font-medium font-mono">{value}</dd>
            </div>
          ))}
        </dl>
      </motion.div>

      {/* Danger zone */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className="rounded-2xl border border-destructive/20 bg-destructive/5 p-6"
      >
        <h2 className="font-semibold text-destructive mb-1">{t.auth.dangerZone}</h2>
        <p className="text-sm text-muted-foreground mb-4">{t.auth.logoutDesc}</p>
        <Button variant="destructive" onClick={handleLogout}>
          <LogOut className="w-4 h-4 mr-2" />
          {t.auth.logoutBtn}
        </Button>
      </motion.div>
    </div>
  );
}
