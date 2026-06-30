import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import type { Project } from "@/lib/api";

type Tab = "board" | "backlog" | "roadmap" | "reports";

const TABS: { key: Tab; label: string }[] = [
  { key: "board", label: "Board" },
  { key: "backlog", label: "Backlog" },
  { key: "roadmap", label: "Roadmap" },
  { key: "reports", label: "Reports" },
];

/** Shared header for project-scoped pages (Backlog / Roadmap / Reports). */
export function ProjectSubnav({
  project,
  projectKey,
  active,
  children,
}: {
  project?: Project;
  projectKey: string;
  active: Tab;
  children?: React.ReactNode;
}) {
  return (
    <div className="px-5 py-3 border-b border-border flex items-center gap-3 flex-shrink-0 flex-wrap">
      <div className="mr-auto">
        <h1 className="text-base font-bold tracking-tight text-foreground leading-none">
          <span className="font-mono text-primary mr-1.5">{project?.key ?? projectKey}</span>
          {project?.name ?? "Project"}
        </h1>
        <div className="flex items-center gap-2 mt-1.5">
          {TABS.map((t) => (
            <Link
              key={t.key}
              to={`/projects/${projectKey}/${t.key}`}
              className={cn(
                "text-[10px] pb-0.5",
                t.key === active
                  ? "font-semibold text-primary border-b-2 border-primary"
                  : "font-medium text-muted-foreground hover:text-foreground",
              )}
            >
              {t.label}
            </Link>
          ))}
        </div>
      </div>
      {children}
    </div>
  );
}
