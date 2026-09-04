import { H1, H2, P, UL, LI, Callout, DocLink, NextSteps, NextStepCard, type DocPageProps } from "./_shared";

const TXT = {
  en: {
    intro: "AI Collective is source-available under a Non-Commercial / Academic license (see LICENSE and NOTICE). Self-hosting it for education, research, or evaluation is free, forever. Commercial use — products, services, SaaS, for-profit internal operations, consulting, or redistribution — is not granted by that license and requires a separate written commercial license.",

    whyH2: "Why non-commercial / academic",
    whyP: "Source-available and open-source aren't the same thing, and the distinction is deliberate here: you can read every line of server/ and ui/, run it, modify it, and study exactly how the six topologies or the knowledge graph work — that's the whole point of publishing the source. What the license withholds is the right to build a for-profit business on top of it without a separate agreement, which is what funds continued development.",

    whatCountsH2: "What counts as \"commercial\"",
    whatCountsP: "The line isn't always obvious, so here's how it actually splits:",
    needsLicense: [
      "Offering AI Collective (or a fork of it) as a paid product or SaaS to customers.",
      "Using it to run for-profit internal operations at a company — e.g. a marketing agency running real, billable client work through it.",
      "Consulting or reselling deployments of it for a fee.",
    ],
    doesNotNeed: [
      "Running it for coursework, a thesis, or a research paper.",
      "Personal projects and non-commercial prototypes.",
      "Evaluating it internally before deciding whether to purchase a commercial license.",
    ],

    plansH2: "Plans",
    plans: [
      { name: "Open Source", price: "Free", period: "forever", desc: "Self-host the full platform on your own infrastructure. Unlimited local companies, unlimited staff runs, community support.", features: ["Run every topology, skill, and storage backend", "JSON storage, in-memory queue, threading lock — zero extra infra", "Community support via GitHub"] },
      { name: "Pro", price: "$49", period: "per month", desc: "For teams running AI-powered companies in production.", features: ["Managed hosting with distributed backends (MongoDB, RabbitMQ, Redis)", "Up to 10 active companies", "Priority support"] },
      { name: "Enterprise", price: "Custom", period: "tailored pricing", desc: "For organizations that need a commercial license, dedicated infrastructure, or custom SLAs.", features: ["Commercial license for for-profit use", "Dedicated / on-premise deployment, SSO", "Guaranteed SLAs and a dedicated support contact"] },
    ],
    apiH2: "Model costs",
    apiP: "AI Collective doesn't mark up LLM usage. Every model call is billed at the provider's own rate; the admin monitoring dashboard (GET /api/v1/admin/monitoring/usage, /pricing) tracks token usage and cost per staff, department, and model so you can see exactly what a run cost.",
    contactCallout: "To request a commercial license or discuss Pro/Enterprise hosting, contact suzeai545@gmail.com.",

    nextQuickstart: "Get the free, self-hosted Open Source tier running locally.",
    nextContributing: "How contributions are licensed, and what that means for you.",
  },
  vi: {
    intro: "AI Collective là mã nguồn mở một phần (source-available) theo giấy phép Non-Commercial / Academic (xem LICENSE và NOTICE). Tự lưu trữ (self-host) cho mục đích giáo dục, nghiên cứu, hoặc đánh giá là miễn phí, vĩnh viễn. Sử dụng thương mại — sản phẩm, dịch vụ, SaaS, vận hành nội bộ vì lợi nhuận, tư vấn, hay phân phối lại — không được cấp phép bởi giấy phép này và cần một giấy phép thương mại riêng bằng văn bản.",

    whyH2: "Vì sao lại là non-commercial / academic",
    whyP: "Source-available và open-source không phải là một, và sự khác biệt ở đây là có chủ đích: bạn có thể đọc từng dòng trong server/ và ui/, chạy nó, sửa nó, và nghiên cứu chính xác sáu topology hay knowledge graph hoạt động ra sao — đó là toàn bộ mục đích của việc công bố mã nguồn. Điều giấy phép không cấp là quyền xây dựng một doanh nghiệp vì lợi nhuận trên nền tảng đó mà không có thỏa thuận riêng — chính khoản đó tài trợ cho việc phát triển tiếp tục.",

    whatCountsH2: "Thế nào được tính là \"thương mại\"",
    whatCountsP: "Ranh giới không phải lúc nào cũng rõ ràng, đây là cách nó thực sự được chia:",
    needsLicense: [
      "Cung cấp AI Collective (hoặc một bản fork của nó) như một sản phẩm trả phí hoặc SaaS cho khách hàng.",
      "Dùng nó để vận hành hoạt động nội bộ vì lợi nhuận tại một công ty — ví dụ một agency marketing chạy công việc khách hàng thật, có tính phí, qua nó.",
      "Tư vấn hoặc bán lại các bản triển khai của nó để lấy phí.",
    ],
    doesNotNeed: [
      "Chạy nó cho bài tập môn học, luận văn, hoặc một bài báo nghiên cứu.",
      "Dự án cá nhân và bản mẫu phi thương mại.",
      "Đánh giá nội bộ trước khi quyết định có mua giấy phép thương mại hay không.",
    ],

    plansH2: "Các gói",
    plans: [
      { name: "Open Source", price: "Miễn phí", period: "vĩnh viễn", desc: "Tự lưu trữ toàn bộ nền tảng trên hạ tầng của riêng bạn. Không giới hạn công ty cục bộ, không giới hạn lượt chạy staff, hỗ trợ cộng đồng.", features: ["Chạy mọi topology, skill, và storage backend", "Lưu trữ JSON, hàng đợi in-memory, khóa threading — không cần thêm hạ tầng", "Hỗ trợ cộng đồng qua GitHub"] },
      { name: "Pro", price: "$49", period: "mỗi tháng", desc: "Dành cho các đội nhóm vận hành công ty AI trong môi trường production.", features: ["Hosting được quản lý với các backend phân tán (MongoDB, RabbitMQ, Redis)", "Tối đa 10 công ty hoạt động", "Hỗ trợ ưu tiên"] },
      { name: "Enterprise", price: "Tùy chỉnh", period: "báo giá riêng", desc: "Dành cho tổ chức cần giấy phép thương mại, hạ tầng riêng, hoặc SLA tùy chỉnh.", features: ["Giấy phép thương mại cho mục đích lợi nhuận", "Triển khai riêng biệt / on-premise, SSO", "Cam kết SLA và đầu mối hỗ trợ riêng"] },
    ],
    apiH2: "Chi phí mô hình",
    apiP: "AI Collective không tính thêm phụ phí lên chi phí LLM. Mỗi lệnh gọi mô hình được tính đúng theo giá của nhà cung cấp; trang admin monitoring (GET /api/v1/admin/monitoring/usage, /pricing) theo dõi lượng token và chi phí theo từng staff, department, và model để bạn biết chính xác một phiên chạy tốn bao nhiêu.",
    contactCallout: "Để yêu cầu giấy phép thương mại hoặc trao đổi về hosting Pro/Enterprise, liên hệ suzeai545@gmail.com.",

    nextQuickstart: "Chạy gói Open Source miễn phí, tự lưu trữ, ngay trên máy của bạn.",
    nextContributing: "Đóng góp được cấp phép ra sao, và điều đó nghĩa là gì với bạn.",
  },
  zh: {
    intro: "AI Collective 依据 Non-Commercial / Academic 许可证以源码开放形式发布（详见 LICENSE 与 NOTICE）。出于教育、研究或评估目的自托管永久免费。商业用途——产品、服务、SaaS、以营利为目的的内部运营、咨询或再分发——不在该许可证授权范围内，需另行获得书面商业许可。",

    whyH2: "为什么选择 non-commercial / academic",
    whyP: "源码开放（source-available）与开源（open-source）并不是一回事，这里的区分是刻意的：您可以阅读 server/ 与 ui/ 中的每一行代码，运行它、修改它，并精确研究六种拓扑或知识图谱究竟是如何工作的——这正是公开源码的全部意义。而该许可证不授予的，是在没有另行协议的情况下，基于它构建营利性业务的权利——正是这部分收入资助了项目的持续开发。",

    whatCountsH2: "什么算是\"商业用途\"",
    whatCountsP: "这条界线并不总是显而易见，实际划分方式如下：",
    needsLicense: [
      "将 AI Collective（或其分支）作为付费产品或 SaaS 提供给客户。",
      "用它在公司内部运行营利性业务——例如一家营销代理机构通过它处理真实的、需向客户计费的工作。",
      "以收费方式提供咨询服务或转售其部署方案。",
    ],
    doesNotNeed: [
      "用于课程作业、毕业论文或研究论文。",
      "个人项目与非商业性原型。",
      "在决定是否购买商业许可之前，进行内部评估。",
    ],

    plansH2: "套餐",
    plans: [
      { name: "Open Source", price: "免费", period: "永久", desc: "在您自己的基础设施上自托管完整平台。不限本地公司数量，不限员工运行次数，社区支持。", features: ["运行所有拓扑、技能与存储后端", "JSON 存储、内存队列、线程锁——无需额外基础设施", "通过 GitHub 提供社区支持"] },
      { name: "Pro", price: "$49", period: "每月", desc: "适合在生产环境中运营 AI 驱动公司的团队。", features: ["托管式部署，配备分布式后端（MongoDB、RabbitMQ、Redis）", "最多 10 家活跃公司", "优先支持"] },
      { name: "Enterprise", price: "定制", period: "按需报价", desc: "适合需要商业许可、专属基础设施或定制 SLA 的组织。", features: ["面向营利用途的商业许可", "专属 / 本地部署，SSO", "SLA 保障与专属支持联系人"] },
    ],
    apiH2: "模型费用",
    apiP: "AI Collective 不会对 LLM 使用加价。每次模型调用都按提供方自身的费率计费；管理监控面板（GET /api/v1/admin/monitoring/usage、/pricing）会按员工、部门与模型追踪 token 用量与费用，让您清楚看到每次运行的实际花费。",
    contactCallout: "如需申请商业许可或洽谈 Pro/Enterprise 托管，请联系 suzeai545@gmail.com。",

    nextQuickstart: "在本地跑起免费、自托管的 Open Source 版本。",
    nextContributing: "贡献代码遵循怎样的许可条款，以及这对您意味着什么。",
  },
  ja: {
    intro: "AI Collective は Non-Commercial / Academic ライセンス（LICENSE と NOTICE を参照）のもとでソースアベイラブルとして公開されています。教育・研究・評価目的でのセルフホストは永久に無料です。商用利用（製品、サービス、SaaS、営利目的の社内運用、コンサルティング、再配布など）はこのライセンスでは許諾されておらず、別途書面による商用ライセンスが必要です。",

    whyH2: "なぜ non-commercial / academic なのか",
    whyP: "ソースアベイラブルとオープンソースは同じものではなく、この区別は意図的なものです。server/ と ui/ のすべての行を読み、実行し、修正し、6 つのトポロジーやナレッジグラフが実際にどう動くかを正確に研究できます——それがソースを公開する目的そのものです。ライセンスが与えないのは、別途契約なしにその上で営利ビジネスを構築する権利であり、それこそが継続的な開発を支える資金源になっています。",

    whatCountsH2: "何が「商用」に該当するか",
    whatCountsP: "その境界は必ずしも明確ではありません。実際の区分は次のとおりです。",
    needsLicense: [
      "AI Collective（またはそのフォーク）を有料製品や SaaS として顧客に提供する。",
      "会社内で営利目的の業務にそれを使用する——例えばマーケティングエージェンシーが実際の請求可能なクライアント業務をそれで処理する。",
      "その導入をコンサルティングまたは有料で再販する。",
    ],
    doesNotNeed: [
      "授業課題、卒業論文、研究論文のために実行する。",
      "個人プロジェクトや非商用のプロトタイプ。",
      "商用ライセンスを購入するか決める前に、社内で評価する。",
    ],

    plansH2: "プラン",
    plans: [
      { name: "Open Source", price: "無料", period: "永久", desc: "自社インフラでフルプラットフォームをセルフホスト。ローカル会社数無制限、スタッフ実行回数無制限、コミュニティサポート。", features: ["すべてのトポロジー・スキル・ストレージバックエンドを実行", "JSON ストレージ、インメモリキュー、スレッドロック — 追加インフラ不要", "GitHub 経由のコミュニティサポート"] },
      { name: "Pro", price: "$49", period: "月額", desc: "本番環境で AI 運営会社を運用するチーム向け。", features: ["分散バックエンド（MongoDB、RabbitMQ、Redis）を備えたマネージドホスティング", "最大 10 社のアクティブな会社", "優先サポート"] },
      { name: "Enterprise", price: "個別見積もり", period: "個別料金", desc: "商用ライセンス、専用インフラ、カスタム SLA が必要な組織向け。", features: ["営利目的利用のための商用ライセンス", "専用 / オンプレミス展開、SSO", "SLA の保証と専任サポート担当"] },
    ],
    apiH2: "モデル費用",
    apiP: "AI Collective は LLM 利用料に上乗せを行いません。各モデル呼び出しはプロバイダー自身の料金で課金され、管理モニタリングダッシュボード（GET /api/v1/admin/monitoring/usage, /pricing）がスタッフ・部門・モデルごとのトークン使用量とコストを追跡するため、各実行の正確なコストを把握できます。",
    contactCallout: "商用ライセンスの申請、または Pro/Enterprise ホスティングについては suzeai545@gmail.com までご連絡ください。",

    nextQuickstart: "無料でセルフホストできる Open Source プランをローカルで動かす。",
    nextContributing: "コントリビューションがどうライセンスされるか、それが何を意味するか。",
  },
} as const;

export default function PricingDoc({ lang, onNavigate }: DocPageProps) {
  const t = TXT[lang];
  return (
    <div>
      <H1>Pricing & Plans</H1>
      <P>{t.intro}</P>

      <H2>{t.whyH2}</H2>
      <P>{t.whyP}</P>

      <H2>{t.whatCountsH2}</H2>
      <P>{t.whatCountsP}</P>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 my-5">
        <div className="p-4 rounded-xl border border-amber-500/25 bg-amber-500/5">
          <div className="text-xs font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400 mb-2">{lang === "vi" ? "Cần giấy phép thương mại" : lang === "zh" ? "需要商业许可" : lang === "ja" ? "商用ライセンスが必要" : "Needs a commercial license"}</div>
          <UL>{t.needsLicense.map((f, i) => <LI key={i}>{f}</LI>)}</UL>
        </div>
        <div className="p-4 rounded-xl border border-emerald-500/25 bg-emerald-500/5">
          <div className="text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 mb-2">{lang === "vi" ? "Không cần" : lang === "zh" ? "无需许可" : lang === "ja" ? "不要" : "Doesn't need one"}</div>
          <UL>{t.doesNotNeed.map((f, i) => <LI key={i}>{f}</LI>)}</UL>
        </div>
      </div>

      <H2>{t.plansH2}</H2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 my-6">
        {t.plans.map((plan) => (
          <div key={plan.name} className="p-5 rounded-xl border border-border bg-card">
            <div className="font-bold text-lg mb-1">{plan.name}</div>
            <div className="text-2xl font-extrabold mb-1">{plan.price}</div>
            <div className="text-xs text-muted-foreground mb-3">{plan.period}</div>
            <p className="text-xs text-muted-foreground mb-4">{plan.desc}</p>
            <UL>{plan.features.map((f, i) => <LI key={i}>{f}</LI>)}</UL>
          </div>
        ))}
      </div>

      <H2>{t.apiH2}</H2>
      <P>{t.apiP}</P>
      <Callout type="tip">{t.contactCallout}</Callout>

      <NextSteps>
        <NextStepCard id="quickstart" onNavigate={onNavigate} title="Quickstart" desc={t.nextQuickstart} />
        <NextStepCard id="contributing-guide" onNavigate={onNavigate} title="Contributing" desc={t.nextContributing} />
      </NextSteps>
    </div>
  );
}
