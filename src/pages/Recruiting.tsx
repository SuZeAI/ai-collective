import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { CheckCircle2, Download, Loader2, ShoppingBag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StaffAvatar } from "@/components/StaffAvatar";
import { api, type Staff, type LibraryDocument, type Skill, type Task, type Department } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";
import { useCompanyScope } from "@/hooks/use-company-scope";

type Kind = "task" | "department" | "staff" | "skill" | "document";

// Page-local copy keyed by the active language (the global locales only carry
// the nav label). Keeps the page self-contained without bloating locales/index.
const COPY = {
  en: {
    subtitle: "Discover ready-made resources and copy them into your own business units.",
    search: "Search…",
    tabs: { task: "Projects", department: "Departments", staff: "Staff", skill: "Skills & Tools", document: "Documents" },
    copy: "Copy to my unit",
    copying: "Copying…",
    copied: "Copied",
    empty: "Nothing here yet.",
    toastOk: "Copied to your unit",
    toastDesc: "An independent copy was created — edit it freely without touching the original.",
    toastErr: "Copy failed",
    docNeedsCompany: "Select a company first to recruit a document into it.",
  },
  vi: {
    subtitle: "Khám phá các tài nguyên dựng sẵn và sao chép về đơn vị thành viên của bạn.",
    search: "Tìm kiếm…",
    tabs: { task: "Dự án", department: "Phòng ban", staff: "Hồ sơ Nhân sự Số", skill: "Nghiệp vụ & Công cụ", document: "Tài liệu" },
    copy: "Sao chép về đơn vị của tôi",
    copying: "Đang sao chép…",
    copied: "Đã sao chép",
    empty: "Chưa có gì ở đây.",
    toastOk: "Đã sao chép về đơn vị thành viên của bạn",
    toastDesc: "Một bản sao độc lập đã được tạo — bạn sửa thoải mái mà không ảnh hưởng bản gốc.",
    toastErr: "Sao chép thất bại",
    docNeedsCompany: "Hãy chọn một công ty trước để tuyển tài liệu vào đó.",
  },
  zh: {
    subtitle: "发现现成的资源并复制到你自己的成员单位。",
    search: "搜索…",
    tabs: { task: "项目", department: "部门架构", staff: "数字化员工", skill: "业务与工具", document: "文档" },
    copy: "复制到我的单位",
    copying: "复制中…",
    copied: "已复制",
    empty: "这里还没有内容。",
    toastOk: "已复制到你的成员单位",
    toastDesc: "已创建独立副本——可自由编辑而不影响原件。",
    toastErr: "复制失败",
    docNeedsCompany: "请先选择一家公司，再将文档招募进去。",
  },
  ja: {
    subtitle: "既製のリソースを見つけて、自分の拠点にコピーします。",
    search: "検索…",
    tabs: { task: "プロジェクト", department: "部門構成", staff: "デジタル人材", skill: "業務とツール", document: "ドキュメント" },
    copy: "自分の拠点にコピー",
    copying: "コピー中…",
    copied: "コピー済み",
    empty: "まだ何もありません。",
    toastOk: "拠点にコピーしました",
    toastDesc: "独立したコピーが作成されました。元に影響を与えずに自由に編集できます。",
    toastErr: "コピーに失敗しました",
    docNeedsCompany: "ドキュメントを採用するには、先に会社を選択してください。",
  },
} as const;

type CardData = {
  id: string;
  name: string;
  sub: string;
  badge?: string;
  avatarLike: { avatar?: string; avatar_icon?: string; avatar_color?: string; avatar_url?: string };
};

export default function Recruiting() {
  const { t, language } = useLanguage();
  const { toast } = useToast();
  const scope = useCompanyScope();
  const c = COPY[language] ?? COPY.en;

  const [skills, setSkills] = useState<Skill[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [documents, setDocuments] = useState<LibraryDocument[]>([]);
  const [search, setSearch] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [copiedIds, setCopiedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [sk, ag, tm, tk, dc] = await Promise.all([
          api.listRecruitingSkills(),
          api.listRecruitingStaff(),
          api.listRecruitingDepartments(),
          api.listRecruitingTasks(),
          api.listRecruitingDocuments(),
        ]);
        if (cancelled) return;
        setSkills(sk);
        setStaff(ag);
        setDepartments(tm);
        setTasks(tk);
        setDocuments(dc);
      } catch (e) {
        console.error("Failed to load recruiting:", e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleCopy = async (kind: Kind, id: string) => {
    // Documents are office-bound, so they copy into the active company.
    if (kind === "document" && !scope.company) {
      toast({ title: c.toastErr, description: c.docNeedsCompany, variant: "destructive" });
      return;
    }
    setBusyId(id);
    try {
      await api.copyFromRecruiting({
        type: kind,
        id,
        ...(scope.company ? { companyId: scope.company.id } : {}),
      });
      setCopiedIds((prev) => new Set(prev).add(id));
      toast({ title: c.toastOk, description: c.toastDesc });
    } catch (e) {
      const detail = e instanceof Error ? e.message : c.toastErr;
      toast({ title: c.toastErr, description: detail, variant: "destructive" });
    } finally {
      setBusyId(null);
    }
  };

  const cardsByKind = useMemo<Record<Kind, CardData[]>>(() => {
    const toCard = (
      id: string,
      name: string,
      sub: string,
      badge: string | undefined,
      avatarLike: CardData["avatarLike"],
    ): CardData => ({ id, name, sub, badge, avatarLike });
    return {
      task: tasks.map((x) =>
        toCard(x.id, x.title, x.description, x.status, { avatar: x.title?.[0]?.toUpperCase(), avatar_icon: "target" }),
      ),
      department: departments.map((x) =>
        toCard(x.id, x.name, x.description, x.mode, {
          avatar: x.avatar,
          avatar_icon: x.avatar_icon,
          avatar_color: x.avatar_color,
          avatar_url: x.avatar_url,
        }),
      ),
      staff: staff.map((x) =>
        toCard(x.id, x.name, x.role || x.description, undefined, {
          avatar: x.avatar,
          avatar_icon: x.avatar_icon,
          avatar_color: x.avatar_color,
          avatar_url: x.avatar_url,
        }),
      ),
      skill: skills.map((x) =>
        toCard(x.id, x.name, x.description, x.tool_name || x.third_party || x.kind, {
          avatar: x.avatar,
          avatar_icon: x.avatar_icon,
          avatar_color: x.avatar_color,
          avatar_url: x.avatar_url,
        }),
      ),
      document: documents.map((x) =>
        toCard(x.id, x.name, x.description || x.sourceUrl || "", x.source, {
          avatar: x.name?.[0]?.toUpperCase(),
          avatar_icon: "file-text",
        }),
      ),
    };
  }, [tasks, departments, staff, skills, documents]);

  const renderGrid = (kind: Kind) => {
    const q = search.trim().toLowerCase();
    const items = cardsByKind[kind].filter(
      (it) => !q || it.name.toLowerCase().includes(q) || it.sub.toLowerCase().includes(q),
    );
    if (items.length === 0) {
      return <div className="text-center py-16 text-sm text-muted-foreground">{c.empty}</div>;
    }
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
        {items.map((it, i) => {
          const copied = copiedIds.has(it.id);
          const busy = busyId === it.id;
          return (
            <motion.div
              key={it.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(i * 0.03, 0.3) }}
            >
              <div className="glass-card p-5 h-full flex flex-col">
                <div className="flex items-start gap-3">
                  <StaffAvatar staff={it.avatarLike} className="w-10 h-10 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold truncate">{it.name}</p>
                    {it.badge && (
                      <Badge variant="outline" className="mt-1 text-[10px]">
                        {it.badge}
                      </Badge>
                    )}
                  </div>
                </div>
                <p className="text-sm text-muted-foreground mt-3 line-clamp-3 flex-1">{it.sub}</p>
                <Button
                  className="mt-4 w-full"
                  variant={copied ? "outline" : "default"}
                  disabled={busy || copied}
                  onClick={() => handleCopy(kind, it.id)}
                >
                  {busy ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : copied ? (
                    <CheckCircle2 className="w-4 h-4 mr-2" />
                  ) : (
                    <Download className="w-4 h-4 mr-2" />
                  )}
                  {busy ? c.copying : copied ? c.copied : c.copy}
                </Button>
              </div>
            </motion.div>
          );
        })}
      </div>
    );
  };

  const order: Kind[] = ["task", "department", "staff", "skill", "document"];

  return (
    <div>
      <div className="flex items-center gap-3 mb-1">
        <ShoppingBag className="w-6 h-6" />
        <h1 className="text-2xl font-bold">{t.nav.recruiting}</h1>
      </div>
      <p className="text-muted-foreground mb-6">{c.subtitle}</p>

      <Tabs defaultValue="task" className="w-full">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-4">
          <TabsList>
            {order.map((k) => (
              <TabsTrigger key={k} value={k}>
                {c.tabs[k]} ({cardsByKind[k].length})
              </TabsTrigger>
            ))}
          </TabsList>
          <Input
            placeholder={c.search}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="sm:max-w-xs"
          />
        </div>
        {order.map((k) => (
          <TabsContent key={k} value={k}>
            {renderGrid(k)}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
