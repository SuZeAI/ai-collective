import { motion } from "framer-motion";
import { Check, Clock, Copy, FlaskConical, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { type Staff, type Department } from "@/lib/api";
import { type DepartmentTestMessage } from "@/pages/DepartmentBuilder";

interface DepartmentTestDialogProps {
  testOpen: boolean;
  setTestOpen: (open: boolean) => void;
  stopDepartmentTest: () => void;
  testingDepartment: Department | null;
  testMessages: DepartmentTestMessage[];
  copyMessages: () => void;
  copied: boolean;
  testPrompt: string;
  setTestPrompt: (value: string) => void;
  isTesting: boolean;
  testStepLimit: string;
  setTestStepLimit: (value: string) => void;
  runDepartmentTest: () => void;
  testThinkingStaff: Set<string>;
  testError: string;
  staffById: Map<string, Staff>;
}

export function DepartmentTestDialog({
  testOpen, setTestOpen, stopDepartmentTest, testingDepartment, testMessages, copyMessages,
  copied, testPrompt, setTestPrompt, isTesting, testStepLimit, setTestStepLimit,
  runDepartmentTest, testThinkingStaff, testError, staffById,
}: DepartmentTestDialogProps) {
  return (
      <Dialog
        open={testOpen}
        onOpenChange={(next) => {
          setTestOpen(next);
          if (!next) stopDepartmentTest();
        }}
      >
        <DialogContent className="max-w-3xl max-h-[92vh] flex flex-col">
          <DialogHeader className="border-b pb-4">
            <div className="flex items-center justify-between">
              <div>
                <DialogTitle className="text-xl">Test Department Discussion</DialogTitle>
                {testingDepartment && (
                  <p className="text-sm text-muted-foreground mt-1">
                    {testingDepartment.name} • {testingDepartment.staff.length} members • {testingDepartment.mode}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2">
                {testMessages.length > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={copyMessages}
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
            <div className="flex flex-col gap-3">
              <div>
                <label className="text-sm font-semibold block mb-2">Discussion Prompt</label>
                <Textarea
                  value={testPrompt}
                  onChange={(e) => setTestPrompt(e.target.value)}
                  placeholder="What should this department discuss?"
                  className="min-h-[90px] text-sm resize-none border-2 border-border focus:border-primary"
                  disabled={isTesting}
                />
              </div>
              <div className="grid grid-cols-[120px_100px_1fr] gap-2 items-end">
                <div>
                  <label className="text-xs font-semibold text-muted-foreground mb-1 block">Max Steps</label>
                  <Input
                    type="number"
                    min={1}
                    max={10}
                    value={testStepLimit}
                    onChange={(e) => setTestStepLimit(e.target.value)}
                    disabled={isTesting}
                    className="text-sm border-2 border-border"
                  />
                </div>
                <Button
                  onClick={runDepartmentTest}
                  disabled={!testingDepartment || isTesting}
                  className="bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 h-9"
                >
                  <FlaskConical className="w-4 h-4 mr-1.5" />
                  {isTesting ? "Running" : "Run"}
                </Button>
                <Button
                  variant="outline"
                  onClick={stopDepartmentTest}
                  disabled={!isTesting}
                  className="h-9"
                >
                  <Square className="w-4 h-4 mr-1.5" />
                  Stop
                </Button>
              </div>
            </div>

            <div className="flex flex-col gap-2 flex-1 overflow-hidden">
              <div className="flex items-center justify-between">
                <label className="text-sm font-semibold">Discussion Output</label>
                <span className="text-xs px-2 py-1 rounded-full bg-primary/10 text-primary">
                  {testMessages.length} messages
                </span>
              </div>
              <div className="flex-1 rounded-lg border-2 border-border bg-muted/20 p-3 overflow-y-auto space-y-2">
                {testMessages.length > 0 || testThinkingStaff.size > 0 ? (
                  <>
                    {testMessages.map((m) => {
                      const staff = staffById.get(m.staffId);
                      const ts = new Date(m.timestamp);
                      return (
                        <motion.div
                          key={m.id}
                          initial={{ opacity: 0, y: 5 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="rounded-lg border border-border bg-card p-3 shadow-sm hover:shadow-md transition-shadow"
                        >
                          <div className="flex items-center gap-2 mb-2">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/10">
                              <span className="text-xs font-bold text-primary">#{m.step}</span>
                            </span>
                            <span className="text-sm font-semibold text-foreground">
                              {staff?.name ?? m.staffId}
                            </span>
                            <span className="text-xs text-muted-foreground ml-auto flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {isNaN(ts.getTime())
                                ? m.timestamp
                                : ts.toLocaleTimeString([], {
                                    hour: "2-digit",
                                    minute: "2-digit",
                                    second: "2-digit",
                                  })}
                            </span>
                          </div>
                          <p className="text-sm leading-relaxed whitespace-pre-wrap text-foreground/80">
                            {m.content}
                          </p>
                        </motion.div>
                      );
                    })}

                    {/* Thinking indicators for test */}
                    {testThinkingStaff.size > 0 && (
                      Array.from(testThinkingStaff).map((staffId) => {
                        const staff = staffById.get(staffId);
                        return (
                          <motion.div
                            key={`thinking-${staffId}`}
                            initial={{ opacity: 0, y: 5 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="rounded-lg border border-primary/20 bg-primary/8 p-3"
                          >
                            <div className="flex items-center gap-2">
                              <div className="flex items-center gap-1">
                                <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                                <span className="w-2 h-2 rounded-full bg-primary animate-pulse" style={{ animationDelay: "0.2s" }} />
                                <span className="w-2 h-2 rounded-full bg-primary animate-pulse" style={{ animationDelay: "0.4s" }} />
                              </div>
                              <span className="text-sm font-semibold text-primary">
                                {staff?.name ?? staffId} is working/thinking...
                              </span>
                            </div>
                          </motion.div>
                        );
                      })
                    )}
                  </>
                ) : isTesting ? (
                  <div className="flex items-center justify-center h-full">
                    <div className="text-center">
                      <div className="animate-spin w-8 h-8 border-2 border-muted border-t-primary rounded-full mx-auto mb-3" />
                      <p className="text-sm text-muted-foreground">Streaming discussion...</p>
                    </div>
                  </div>
                ) : testError ? (
                  <div className="flex items-center justify-center h-full">
                    <div className="text-center p-6 rounded-lg bg-destructive/8 border border-destructive/30">
                      <p className="text-sm font-semibold text-destructive mb-1">Error</p>
                      <p className="text-sm text-destructive/80">{testError}</p>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-full">
                    <p className="text-sm text-muted-foreground">Run test to start streaming the discussion...</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
  );
}
