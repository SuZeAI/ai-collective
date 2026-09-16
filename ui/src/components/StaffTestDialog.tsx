import { Check, Copy, FlaskConical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { type Staff } from "@/lib/api";

interface StaffTestDialogProps {
  testOpen: boolean;
  setTestOpen: (open: boolean) => void;
  setIsTesting: (value: boolean) => void;
  setTestError: (value: string) => void;
  testingStaff: Staff | null;
  testOutput: string;
  testError: string;
  copyOutput: (text: string) => void;
  copied: boolean;
  testPrompt: string;
  setTestPrompt: (value: string) => void;
  isTesting: boolean;
  runStaffTest: () => void;
}

export function StaffTestDialog({
  testOpen, setTestOpen, setIsTesting, setTestError, testingStaff, testOutput, testError,
  copyOutput, copied, testPrompt, setTestPrompt, isTesting, runStaffTest,
}: StaffTestDialogProps) {
  return (
      <Dialog
        open={testOpen}
        onOpenChange={(next) => {
          setTestOpen(next);
          if (!next) {
            setIsTesting(false);
            setTestError("");
          }
        }}
      >
        <DialogContent className="max-w-3xl max-h-[92vh] flex flex-col">
          <DialogHeader className="border-b pb-4">
            <div className="flex items-center justify-between">
              <div>
                <DialogTitle className="text-xl">Test Capability</DialogTitle>
                {testingStaff && (
                  <p className="text-sm text-muted-foreground mt-1">
                    {testingStaff.name} • {testingStaff.role}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2">
                {testOutput && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => copyOutput(testOutput)}
                    className="h-8 w-8 p-0"
                  >
                    {copied ? (
                      <Check className="w-4 h-4 text-green-600" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </Button>
                )}
              </div>
            </div>
          </DialogHeader>

          <div className="flex-1 overflow-hidden flex flex-col gap-4 py-4 px-6">
            <div className="flex flex-col gap-2">
              <label className="text-sm font-semibold flex items-center gap-2">
                <FlaskConical className="w-4 h-4" /> Test Prompt
              </label>
              <Textarea
                value={testPrompt}
                onChange={(e) => setTestPrompt(e.target.value)}
                placeholder="Enter a prompt to test this person's capability..."
                className="min-h-[90px] text-sm resize-none border-border focus:border-primary"
                disabled={isTesting}
              />
              <Button
                onClick={runStaffTest}
                disabled={!testingStaff || !testPrompt.trim() || isTesting}
                className="w-full bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 h-9"
              >
                <FlaskConical className="w-4 h-4 mr-2" />
                {isTesting ? (
                  <>
                    <div className="animate-spin w-3 h-3 mr-2 border-2 border-white border-t-transparent rounded-full" />
                    Testing...
                  </>
                ) : (
                  "Run Test"
                )}
              </Button>
            </div>

            <div className="flex flex-col gap-2 flex-1 overflow-hidden">
              <label className="text-sm font-semibold">Output</label>
              {testError ? (
                <div className="flex-1 rounded-lg border border-destructive/30 bg-destructive/8 p-4 overflow-y-auto">
                  <p className="text-sm text-destructive font-mono font-semibold mb-2">🚨 Error</p>
                  <p className="text-sm text-destructive/80 whitespace-pre-wrap break-words">
                    {testError}
                  </p>
                </div>
              ) : testOutput ? (
                <div className="flex-1 rounded-lg border border-border bg-muted/30 p-4 overflow-y-auto">
                  <pre className="text-sm font-mono text-foreground whitespace-pre-wrap break-words leading-relaxed">
                    {testOutput}
                  </pre>
                </div>
              ) : (
                <div className="flex-1 rounded-lg border-2 border-dashed border-border bg-muted/20 p-4 flex items-center justify-center">
                  <p className="text-sm text-muted-foreground">Output will appear here after running test...</p>
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
  );
}
