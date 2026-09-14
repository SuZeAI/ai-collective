import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useLanguage } from "@/contexts/LanguageContext";

export function OkBadge({ ok, okLabel, badLabel }: { ok: boolean; okLabel?: string; badLabel?: string }) {
  const { t: lang } = useLanguage();
  return ok ? (
    <Badge className="bg-green-500/10 text-green-600 border-green-500/20 dark:text-green-400 hover:bg-green-500/10">
      <CheckCircle2 className="w-3 h-3 mr-1" />
      {okLabel ?? lang.adminMonitoringPage.okDefault}
    </Badge>
  ) : (
    <Badge className="bg-red-500/10 text-red-600 border-red-500/20 dark:text-red-400 hover:bg-red-500/10">
      <AlertTriangle className="w-3 h-3 mr-1" />
      {badLabel ?? lang.adminMonitoringPage.downDefault}
    </Badge>
  );
}
