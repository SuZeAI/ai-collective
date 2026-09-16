import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";
import { api, type ModelPricing } from "@/lib/api";

export const EMPTY_PRICING: ModelPricing = {
  model: "",
  provider: "",
  inputPricePerMillion: 0,
  outputPricePerMillion: 0,
};

export function PricingDialog({
  open,
  initial,
  onClose,
  onSaved,
}: {
  open: boolean;
  initial: ModelPricing | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { t: lang } = useLanguage();
  const { toast } = useToast();
  const [form, setForm] = useState<ModelPricing>(EMPTY_PRICING);
  const [saving, setSaving] = useState(false);
  const isNew = !initial;

  useEffect(() => {
    setForm(initial ?? EMPTY_PRICING);
  }, [initial, open]);

  const save = async () => {
    if (!form.model.trim()) {
      toast({ title: lang.adminMonitoringPage.modelNameRequired, variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      await api.upsertModelPricing({
        ...form,
        model: form.model.trim(),
        provider: form.provider.trim(),
        inputPricePerMillion: Number(form.inputPricePerMillion) || 0,
        outputPricePerMillion: Number(form.outputPricePerMillion) || 0,
      });
      toast({ title: lang.adminMonitoringPage.pricingSaved.replace("{model}", form.model) });
      onSaved();
      onClose();
    } catch (e) {
      toast({ title: lang.adminMonitoringPage.pricingSaveFailed, description: String(e), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isNew
              ? lang.adminMonitoringPage.addModelPricingTitle
              : lang.adminMonitoringPage.editPricingTitle.replace("{model}", initial?.model ?? "")}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="pricing-model">{lang.adminMonitoringPage.modelLabel}</Label>
            <Input
              id="pricing-model"
              placeholder={lang.adminMonitoringPage.modelPlaceholder}
              value={form.model}
              disabled={!isNew}
              onChange={(e) => setForm({ ...form, model: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pricing-provider">{lang.adminMonitoringPage.providerLabel}</Label>
            <Select value={form.provider || undefined} onValueChange={(v) => setForm({ ...form, provider: v })}>
              <SelectTrigger id="pricing-provider">
                <SelectValue placeholder={lang.adminMonitoringPage.selectProvider} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="anthropic">Anthropic</SelectItem>
                <SelectItem value="openai">OpenAI</SelectItem>
                <SelectItem value="google">Google</SelectItem>
                <SelectItem value="open_weight">Open Weight </SelectItem>
                <SelectItem value="kimi">Kimi (Moonshot)</SelectItem>
                <SelectItem value="deepseek">DeepSeek</SelectItem>
                <SelectItem value="glm">GLM (Zhipu)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="pricing-input">{lang.adminMonitoringPage.inputPerMLabel}</Label>
              <Input
                id="pricing-input"
                type="number"
                min={0}
                step={0.01}
                value={form.inputPricePerMillion}
                onChange={(e) => setForm({ ...form, inputPricePerMillion: Number(e.target.value) })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pricing-output">{lang.adminMonitoringPage.outputPerMLabel}</Label>
              <Input
                id="pricing-output"
                type="number"
                min={0}
                step={0.01}
                value={form.outputPricePerMillion}
                onChange={(e) => setForm({ ...form, outputPricePerMillion: Number(e.target.value) })}
              />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>{lang.adminMonitoringPage.cancel}</Button>
          <Button onClick={save} disabled={saving}>{saving ? lang.adminMonitoringPage.saving : lang.adminMonitoringPage.save}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
