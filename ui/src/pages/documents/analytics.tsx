import { H1, H2, P, UL, LI, CodeBlock, InlineCode, ApiRow, Callout, DocLink, NextSteps, NextStepCard, type DocPageProps } from "./_shared";

const TXT = {
  en: {
    lead: "\"How is my company doing\" splits into two genuinely different questions, and AI Collective keeps them as two separate pages rather than one crowded dashboard: Performance & Cost (Analytics) answers \"is the work getting done,\" and Usage & Billing (Consumption) answers \"what is it costing to get it done.\" Both are scoped to whichever company is currently active.",

    analyticsH2: "Performance & Cost — who reads this and why",
    analyticsP1: "GET /api/v1/analytics returns a single execution snapshot for the active company. This is the page a Department lead or a company owner checks to answer operational questions: are Tasks actually finishing, how long is a typical Task taking, and which Staff members are carrying the most load.",
    analyticsP2: "department_efficiency is the number worth watching over time — a sustained drop usually means either a topology is spending too many turns on coordination overhead relative to actual output, or a Staff member's system_prompt has drifted and is producing work that needs more back-and-forth to land. staff_productivity gives you the per-Staff breakdown to figure out which.",

    consumptionH2: "Usage & Billing — who reads this and why",
    consumptionP1: "GET /api/v1/consumption answers a different question entirely: what did all of this actually cost. It's built from TokenUsageRecord rows — one row is written every single time any Staff makes an LLM request, whether that request came from a real Task, a Playground session, or a subagent. This is the page a finance or ops person checks, not a Department lead.",
    consumptionP2: "Because every record carries staff_name and department_id, a cost spike is traceable back to a specific Staff or Department rather than showing up as an unexplained platform-wide number — useful when one experimental Department with subagent_enabled turned on for every Staff turns out to be burning far more tokens than the rest of the company combined.",

    cacheH2: "Why cache_read_tokens and cache_creation_tokens exist",
    cacheP: "A Staff's system_prompt gets re-sent to the LLM provider on every single turn — it's part of what defines that Staff. Without prompt caching, a long system_prompt with several Skills' worth of tool definitions attached would be billed at full price on every turn of every run, even though it's identical text turn after turn. cache_read_tokens and cache_creation_tokens are ",
    cacheStrong: "subsets of input_tokens, not additive on top of it",
    cacheP2: " — they tell you how much of a given call's input was served from (or written to) the provider's prompt cache, which is billed at a fraction of the normal input rate. A department with high cache_read_tokens relative to input_tokens is one that's benefiting heavily from caching; one with consistently near-zero cache activity might be structured in a way that defeats caching (e.g. a system_prompt that changes on every turn).",

    adminH2: "Admin monitoring: the cross-company view",
    adminP1: "Everything above is scoped to one company. Admins additionally get a separate surface under /admin/monitoring that looks across every company at once — total platform usage, per-user activity, file-storage backend stats, and overall system health (which storage/queue/lock/sandbox backends are actually configured and reachable).",
    adminP2: "The price cards under /admin/monitoring/pricing are admin-editable for a practical reason: LLM providers change their per-token pricing more often than this platform ships a new release. If cost estimates were hardcoded at build time, they'd silently drift out of date the moment a provider updated a price sheet. Making pricing an editable record instead means an admin can correct it in seconds, and every cost figure across every company recalculates from the same source of truth immediately — no code change, no deploy, no restart required, which ties into the same ",
    settingsLink: "Settings",
    adminP3: " model where admin-level platform controls live outside of config.yml specifically so they can change without a deploy.",
  },
  vi: {
    lead: "\"Công ty tôi đang hoạt động ra sao\" thực ra tách thành hai câu hỏi khác nhau, và AI Collective giữ chúng ở hai trang riêng biệt thay vì dồn vào một dashboard chật chội: Performance & Cost (Analytics) trả lời \"công việc có đang được hoàn thành không\", còn Usage & Billing (Consumption) trả lời \"hoàn thành công việc đó tốn bao nhiêu\". Cả hai đều giới hạn trong phạm vi công ty đang hoạt động.",

    analyticsH2: "Performance & Cost — ai đọc trang này và tại sao",
    analyticsP1: "GET /api/v1/analytics trả về một snapshot thực thi duy nhất cho công ty đang hoạt động. Đây là trang mà một Department lead hay chủ công ty kiểm tra để trả lời các câu hỏi vận hành: Task có thực sự hoàn thành không, một Task điển hình mất bao lâu, và Staff nào đang gánh nhiều việc nhất.",
    analyticsP2: "department_efficiency là con số đáng theo dõi theo thời gian — một đợt giảm kéo dài thường có nghĩa là hoặc topology đang tốn quá nhiều lượt vào chi phí phối hợp so với sản lượng thực tế, hoặc system_prompt của một Staff đã lệch hướng và tạo ra công việc cần qua lại nhiều hơn mới xong. staff_productivity cho bạn số liệu chi tiết theo từng Staff để tìm ra nguyên nhân là gì.",

    consumptionH2: "Usage & Billing — ai đọc trang này và tại sao",
    consumptionP1: "GET /api/v1/consumption trả lời một câu hỏi hoàn toàn khác: tất cả điều này thực sự tốn bao nhiêu. Nó được dựng từ các dòng TokenUsageRecord — một dòng được ghi mỗi khi bất kỳ Staff nào thực hiện một yêu cầu LLM, bất kể yêu cầu đó đến từ một Task thật, một phiên Playground, hay một subagent. Đây là trang mà người phụ trách tài chính/vận hành kiểm tra, không phải Department lead.",
    consumptionP2: "Vì mỗi bản ghi mang theo staff_name và department_id, một đợt tăng chi phí có thể truy ngược lại đúng một Staff hay Department cụ thể thay vì hiện ra như một con số bí ẩn trên toàn nền tảng — hữu ích khi một Department thử nghiệm bật subagent_enabled cho mọi Staff hóa ra đang tiêu tốn token nhiều hơn hẳn phần còn lại của cả công ty cộng lại.",

    cacheH2: "Vì sao có cache_read_tokens và cache_creation_tokens",
    cacheP: "system_prompt của một Staff được gửi lại cho nhà cung cấp LLM ở mỗi lượt — nó là một phần định nghĩa nên Staff đó. Nếu không có prompt caching, một system_prompt dài kèm định nghĩa tool của nhiều Skill sẽ bị tính giá đầy đủ ở mỗi lượt của mỗi phiên chạy, dù văn bản đó giống hệt nhau lượt này qua lượt khác. cache_read_tokens và cache_creation_tokens là ",
    cacheStrong: "tập con của input_tokens, không cộng dồn thêm vào đó",
    cacheP2: " — chúng cho biết bao nhiêu phần input của một lệnh gọi được phục vụ từ (hoặc ghi vào) cache prompt của nhà cung cấp, vốn được tính giá chỉ bằng một phần nhỏ so với mức giá input thông thường. Một department có cache_read_tokens cao so với input_tokens là một department đang hưởng lợi lớn từ caching; một department có hoạt động cache gần như bằng không liên tục có thể đang được cấu trúc theo cách vô hiệu hóa caching (ví dụ system_prompt thay đổi ở mỗi lượt).",

    adminH2: "Giám sát cấp Admin: góc nhìn xuyên công ty",
    adminP1: "Tất cả những gì ở trên đều giới hạn trong một công ty. Admin có thêm một bề mặt riêng dưới /admin/monitoring nhìn xuyên suốt mọi công ty cùng lúc — tổng mức sử dụng toàn nền tảng, hoạt động theo từng người dùng, số liệu backend lưu trữ file, và tình trạng hệ thống tổng thể (storage/queue/lock/sandbox backend nào thực sự đang được cấu hình và có thể truy cập).",
    adminP2: "Bảng giá dưới /admin/monitoring/pricing được admin chỉnh sửa được vì một lý do thực tế: nhà cung cấp LLM thay đổi giá theo token thường xuyên hơn nền tảng này ra bản phát hành mới. Nếu ước tính chi phí được hardcode lúc build, chúng sẽ âm thầm lỗi thời ngay khi nhà cung cấp cập nhật bảng giá. Biến giá thành một bản ghi có thể chỉnh sửa nghĩa là admin có thể sửa nó trong vài giây, và mọi con số chi phí trên mọi công ty tính lại ngay lập tức từ cùng một nguồn sự thật — không cần đổi code, không cần deploy, không cần khởi động lại, gắn liền với cùng mô hình ",
    settingsLink: "Settings",
    adminP3: " nơi các điều khiển cấp nền tảng của admin nằm ngoài config.yml chính là để có thể thay đổi mà không cần deploy.",
  },
  zh: {
    lead: "「我的公司运营得怎么样」实际上拆分成两个真正不同的问题，AI Collective 将它们分为两个独立的页面，而不是塞进一个拥挤的仪表盘：Performance & Cost（Analytics）回答「工作是否真的在完成」，Usage & Billing（Consumption）回答「完成这些工作花了多少钱」。两者都限定在当前活跃的公司范围内。",

    analyticsH2: "Performance & Cost —— 谁会看、为什么看",
    analyticsP1: "GET /api/v1/analytics 返回当前活跃公司的单个执行快照。这是 Department 负责人或公司所有者用来回答运营问题的页面：任务是否真的在完成、一个典型任务通常需要多长时间、哪些员工承担的工作量最大。",
    analyticsP2: "department_efficiency 是值得长期观察的数字——持续下降通常意味着某个拓扑在协调开销上花费的回合相对于实际产出过多，或者某个 Staff 的 system_prompt 已经跑偏，产出的工作需要更多来回才能落地。staff_productivity 提供按员工细分的数据，帮助您判断到底是哪种情况。",

    consumptionH2: "Usage & Billing —— 谁会看、为什么看",
    consumptionP1: "GET /api/v1/consumption 回答的是完全不同的问题：这一切实际花了多少钱。它由 TokenUsageRecord 记录构建而成——每当任何 Staff 发起一次 LLM 请求，无论这个请求来自真实的 Task、Playground 会话还是子智能体，都会写入一条记录。这是财务或运营人员会查看的页面，而不是 Department 负责人。",
    consumptionP2: "由于每条记录都带有 staff_name 和 department_id，成本激增可以精确追溯到具体的某个 Staff 或 Department，而不是显示为一个无法解释的平台级总数——当某个为每位员工都开启了 subagent_enabled 的实验性部门，结果消耗的 token 远超公司其余部分总和时，这一点尤其有用。",

    cacheH2: "为什么会有 cache_read_tokens 和 cache_creation_tokens",
    cacheP: "Staff 的 system_prompt 会在每一个回合都重新发送给 LLM 提供商——它是定义该员工的一部分。如果没有提示词缓存，一个附带多个 Skill 工具定义的长 system_prompt，会在每次运行的每个回合都按全价计费，尽管这段文本回合与回合之间完全相同。cache_read_tokens 和 cache_creation_tokens 是",
    cacheStrong: "input_tokens 的子集，而不是在其之上额外叠加",
    cacheP2: "——它们说明某次调用的输入有多少是从提供商的提示词缓存中读取（或写入）的，而这部分按远低于正常输入价格的费率计费。cache_read_tokens 相对 input_tokens 较高的部门正在从缓存中大量受益；持续接近零缓存活动的部门，其结构可能恰好使缓存失效（例如 system_prompt 在每个回合都发生变化）。",

    adminH2: "管理员监控：跨公司视角",
    adminP1: "以上所有内容都限定在单个公司范围内。管理员还额外拥有 /admin/monitoring 下的独立视图，可以同时查看所有公司——平台总用量、按用户划分的活动、文件存储后端统计，以及整体系统健康状况（实际配置并可访问的存储/队列/锁/沙箱后端）。",
    adminP2: "/admin/monitoring/pricing 下的价格卡之所以可由管理员编辑，是出于实际考虑：LLM 提供商调整每 token 价格的频率，往往比本平台发布新版本更频繁。如果成本估算在构建时就写死，一旦提供商更新价目表，估算就会在无声无息中过时。把定价做成可编辑的记录，意味着管理员可以在几秒钟内纠正它，而所有公司的每一个成本数字都会立即从同一个真相来源重新计算——无需改代码、无需部署、无需重启，这与",
    settingsLink: "Settings",
    adminP3: "中的同一套模型一脉相承：管理员级别的平台控制之所以放在 config.yml 之外，正是为了能够在不部署的情况下更改。",
  },
  ja: {
    lead: "「自社の状況はどうか」は実際には 2 つのまったく異なる問いに分かれます。AI Collective はそれらを 1 つの混雑したダッシュボードではなく、2 つの独立したページとして保持しています。Performance & Cost（Analytics）は「仕事は実際に片付いているか」に答え、Usage & Billing（Consumption）は「それにいくらかかっているか」に答えます。どちらも現在アクティブな会社の範囲に限定されます。",

    analyticsH2: "Performance & Cost —— 誰が、なぜ見るか",
    analyticsP1: "GET /api/v1/analytics は、アクティブな会社の単一の実行スナップショットを返します。これは Department のリーダーや会社のオーナーが、タスクは実際に完了しているか、典型的なタスクにどれくらい時間がかかっているか、どのスタッフが最も多くの負荷を担っているかといった運用上の疑問に答えるために確認するページです。",
    analyticsP2: "department_efficiency は時間経過とともに注視する価値のある数値です——持続的な低下は通常、トポロジーが実際の成果に対して協調オーバーヘッドに費やすターンが多すぎるか、あるいはあるスタッフの system_prompt がずれてしまい、着地までにより多くのやり取りを要する成果を生んでいることを意味します。staff_productivity はスタッフごとの内訳を示し、どちらが原因かを突き止める手がかりになります。",

    consumptionH2: "Usage & Billing —— 誰が、なぜ見るか",
    consumptionP1: "GET /api/v1/consumption はまったく別の問いに答えます。これらすべてに実際いくらかかったか、です。これは TokenUsageRecord のレコードから構築されます——実際の Task であれ、Playground セッションであれ、サブエージェントであれ、任意のスタッフが LLM リクエストを行うたびに 1 行が書き込まれます。このページを確認するのは Department リーダーではなく、財務や運用の担当者です。",
    consumptionP2: "すべてのレコードが staff_name と department_id を持つため、コストの急増は説明のつかないプラットフォーム全体の数値としてではなく、特定のスタッフや部門に遡って追跡できます——すべてのスタッフで subagent_enabled を有効にした実験的な部門が、会社の他の部分を合わせたよりもはるかに多くのトークンを消費していたことが判明する場合などに役立ちます。",

    cacheH2: "cache_read_tokens と cache_creation_tokens が存在する理由",
    cacheP: "スタッフの system_prompt は毎ターン LLM プロバイダーに再送信されます——それはそのスタッフを定義するものの一部です。プロンプトキャッシュがなければ、複数の Skill のツール定義を含む長い system_prompt は、ターンごとに毎回同一のテキストであるにもかかわらず、実行のすべてのターンで満額課金されてしまいます。cache_read_tokens と cache_creation_tokens は",
    cacheStrong: "input_tokens の部分集合であり、それに加算されるものではありません",
    cacheP2: "——ある呼び出しの入力のうち、どれだけがプロバイダーのプロンプトキャッシュから提供された（あるいは書き込まれた）かを示し、これは通常の入力料金のごく一部で課金されます。input_tokens に対して cache_read_tokens が高い部門はキャッシュから大きな恩恵を受けています。逆に常にほぼゼロのキャッシュ活動しかない部門は、キャッシュを無効化してしまう構造（例えば毎ターン変化する system_prompt）になっている可能性があります。",

    adminH2: "管理者モニタリング：会社を横断した視点",
    adminP1: "上記はすべて 1 つの会社に限定されます。管理者はさらに、/admin/monitoring 配下に、すべての会社を一度に見渡せる別の画面を持ちます——プラットフォーム全体の使用量、ユーザーごとの活動、ファイルストレージバックエンドの統計、そして全体的なシステムの健全性（実際に設定され到達可能なストレージ/キュー/ロック/サンドボックスのバックエンド）です。",
    adminP2: "/admin/monitoring/pricing にある価格カードが管理者によって編集可能なのには実務上の理由があります。LLM プロバイダーがトークンあたりの料金を変更する頻度は、このプラットフォームが新しいリリースを出す頻度より高いのが普通です。コスト見積もりがビルド時にハードコードされていたら、プロバイダーが価格表を更新した瞬間に気づかぬうちに古くなってしまいます。価格を編集可能なレコードにすることで、管理者は数秒で修正でき、すべての会社のすべてのコスト数値が同じ信頼できる情報源から即座に再計算されます——コード変更もデプロイも再起動も不要です。これは、管理者レベルのプラットフォーム制御が config.yml の外に置かれているのと同じ",
    settingsLink: "Settings",
    adminP3: "のモデルにつながっています。まさにデプロイなしで変更できるようにするためです。",
  },
} as const;

export default function AnalyticsDoc({ lang, onNavigate }: DocPageProps) {
  const t = TXT[lang];
  return (
    <div>
      <H1>Performance &amp; Cost / Usage &amp; Billing</H1>
      <P>{t.lead}</P>

      <H2>{t.analyticsH2}</H2>
      <P>{t.analyticsP1}</P>
      <P>{t.analyticsP2}</P>
      <CodeBlock lang="python" title="server/domain/models.py" code={`@dataclass(frozen=True, slots=True)\nclass Analytics:\n    tasks_completed: int\n    avg_completion_time: str\n    department_efficiency: int\n    staff_productivity: dict[str, int]   # staff_id -> completed count`} />
      <div className="rounded-xl border border-border/60 overflow-hidden my-4 divide-y divide-border/40">
        <ApiRow method="GET" path="/api/v1/analytics" desc="Current company's analytics snapshot" />
      </div>

      <H2>{t.consumptionH2}</H2>
      <P>{t.consumptionP1}</P>
      <P>{t.consumptionP2}</P>
      <CodeBlock lang="python" title="server/domain/models.py" code={`@dataclass(frozen=True, slots=True)\nclass TokenUsageRecord:\n    id: str\n    provider: str          # "anthropic" | "openai" | "google" | "open_weight"\n    model: str\n    input_tokens: int\n    output_tokens: int\n    total_tokens: int\n    user_id: str            # "system" if unattributed to a human\n    timestamp: datetime\n    staff_name: str = ""\n    department_id: str = ""\n    cache_read_tokens: int = 0\n    cache_creation_tokens: int = 0`} />
      <div className="rounded-xl border border-border/60 overflow-hidden my-4 divide-y divide-border/40">
        <ApiRow method="GET" path="/api/v1/consumption" desc="Token usage & cost rollups for the current company" />
      </div>

      <H2>{t.cacheH2}</H2>
      <P>
        {t.cacheP}<strong>{t.cacheStrong}</strong>{t.cacheP2}
      </P>

      <H2>{t.adminH2}</H2>
      <P>{t.adminP1}</P>
      <div className="rounded-xl border border-border/60 overflow-hidden my-4 divide-y divide-border/40">
        <ApiRow method="GET" path="/api/v1/admin/monitoring/usage" desc="Platform-wide usage summary" />
        <ApiRow method="GET" path="/api/v1/admin/monitoring/pricing" desc="List per-model price cards (USD / 1M tokens)" />
        <ApiRow method="PUT" path="/api/v1/admin/monitoring/pricing" desc="Edit a model's price card" />
        <ApiRow method="PUT" path="/api/v1/admin/monitoring/active-model" desc="Switch the platform's active LLM model" />
        <ApiRow method="GET" path="/api/v1/admin/monitoring/users" desc="Per-user activity" />
        <ApiRow method="GET" path="/api/v1/admin/monitoring/file-storage" desc="File storage backend stats" />
        <ApiRow method="GET" path="/api/v1/admin/monitoring/health" desc="System health (storage/queue/lock/sandbox backends)" />
      </div>
      <P>
        {t.adminP2}<DocLink id="settings" onNavigate={onNavigate}>{t.settingsLink}</DocLink>{t.adminP3}
      </P>
      <Callout type="info">
        <InlineCode>cache_read_tokens</InlineCode> / <InlineCode>cache_creation_tokens</InlineCode> ⊂ <InlineCode>input_tokens</InlineCode> — never add them on top when computing a total.
      </Callout>

      <NextSteps>
        <NextStepCard id="settings" onNavigate={onNavigate} title="Settings" desc={lang === "vi" ? "Admin bật model và chỉnh bảng giá ở đâu." : lang === "zh" ? "管理员在哪里启用模型和调整价格。" : lang === "ja" ? "管理者がモデルと価格を設定する場所。" : "Where an admin activates models and edits pricing."} />
        <NextStepCard id="tasks" onNavigate={onNavigate} title="Tasks" desc={lang === "vi" ? "Nguồn gốc của phần lớn hoạt động được đo ở đây." : lang === "zh" ? "这里所度量的大部分活动的来源。" : lang === "ja" ? "ここで計測される活動の大半の発生源。" : "The source of most of the activity measured here."} />
      </NextSteps>
    </div>
  );
}
