import { H1, H2, P, UL, LI, OL, OLI, CodeBlock, ApiRow, Callout, DocLink, NextSteps, NextStepCard, type DocPageProps } from "./_shared";

const TXT = {
  en: {
    lead1: "A Company is the top-level organizational unit — the old internal name was \"Workspace,\" and you'll still see that word in a few backend paths, but everywhere user-facing it's Company now. Everything else in the platform — Departments, Staff, Tasks, Projects, Documents, Connections — is scoped underneath exactly one Company. There's no such thing as a Staff member that belongs to two companies at once, or a Task that floats outside of any company.",
    lead2: "This isolation is the whole point. You can create and run any number of companies side by side — a software startup, a marketing agency, a research lab, whatever you can describe — and none of them can see or affect each other's Departments, Staff, data, or spend. A bug in one company's custom Skill can't leak into another's.",

    scopesH2: "\"All\" vs. inside a company",
    scopesP: "The left rail switches between two fundamentally different modes, and the distinction matters more than it looks: it's persisted in localStorage.activeCompanyId (sentinel __overall__ means \"All\") and it changes what you're even allowed to do, not just what you see.",
    scopes: [
      { t: "\"All\" (Overall)", d: "The control-center view. Create, control, and monitor every company at once — but you cannot create a Task or a Staff member directly here. \"All\" is where you decide which company something belongs to, not where the work happens." },
      { t: "Inside a company", d: "Operate exactly one company: create Departments, Staff, Projects, and Tasks, all automatically scoped to it. This is where day-to-day work actually happens." },
    ],
    scopesExampleH2: "A concrete scenario",
    scopesExampleP: "An admin running five companies opens the dashboard in \"All\" and immediately sees an aggregate view — total task throughput, cost, and a grid of five company cards, each showing its own task/staff counts and type. Nothing they see there is editable in the day-to-day sense. To actually create a Task for the marketing company, they click that company's card, switch into its scope, and the same left rail now shows Departments, Staff, Task Board, and the rest — all automatically filtered to that one company.",

    typesH2: "What company type actually does",
    typesP1: "type defaults to \"general\" and is otherwise one of software, marketing, research. The important thing to understand is what type does not do: it never hides a feature. A \"marketing\" company can still open Task Board; a \"software\" company can still open Recruiting. type only does two things — it seeds what the AI Office Designer generates, and it puts a small \"Suggested\" star on the nav items that fit best.",
    typesP2: "Concretely, that means a software company gets Projects, Task Board, Skills & Tools, and Training starred in its sidebar (because engineering work tends to route through issue tracking and testable tools); a marketing company gets Projects, Meetings, Documents, and Recruiting starred (because campaigns tend to live in conversation threads and shared assets); a research company gets Documents, Task Board, and Meetings starred; and general gets no emphasis at all — every option is presented as equally relevant, which is the right default when you're not sure yet what shape the company will take.",

    createH2: "Creating a company, start to finish",
    createOfficeP: "The fast path is the AI Office Designer, and it's worth walking through what actually happens when you use it:",
    createSteps: [
      "You describe the company you want in a chat prompt — as loosely or precisely as you like, e.g. \"a three-person marketing agency focused on B2B SaaS launches.\"",
      "The AI proposes a full plan: a company type, a set of Departments, the Staff inside each one (with roles and system prompts already drafted), and the Skills each Staff would need.",
      "You review the plan in the chat UI — nothing is created yet at this point, it's a draft you can push back on (\"make the copywriter more senior\", \"add a paid-ads specialist\") before accepting it.",
      "Confirming calls the apply endpoint, which materializes the entire plan — the company row, every Department, every Staff member, every Skill binding — in one atomic operation, and automatically switches your active scope into the newly created company.",
    ],
    createManualP: "The alternative is Manage Companies — plain manual CRUD where you pick a name, description, and type yourself, or clone settings from an existing company instead of starting from a blank plan. This is the better fit when you already know exactly what you want, or when you're setting up a near-duplicate of a company you've already built.",
    createManualLink: "Recruiting",
    createManualP2: " is a third option worth knowing about: instead of generating a brand-new Department/Staff/Skill from scratch, you can browse the admin-curated shared catalog and clone existing building blocks straight into a company you're setting up manually.",

    schemaH2: "Schema",
    restH2: "REST API",
  },
  vi: {
    lead1: "Company là đơn vị tổ chức cấp cao nhất — tên nội bộ cũ là \"Workspace\", và bạn vẫn sẽ thấy từ đó ở một vài đường dẫn backend, nhưng ở mọi nơi hướng tới người dùng thì giờ đã là Company. Mọi thứ khác trong nền tảng — Department, Staff, Task, Project, Document, Connection — đều nằm trong đúng một Company. Không tồn tại một Staff thuộc về hai company cùng lúc, hay một Task trôi nổi ngoài mọi company.",
    lead2: "Sự tách biệt này chính là trọng tâm. Bạn có thể tạo và chạy bất kỳ số lượng company nào song song — một startup phần mềm, một agency marketing, một phòng nghiên cứu, bất cứ gì bạn mô tả được — và không company nào có thể thấy hay ảnh hưởng tới Department, Staff, dữ liệu, hay chi phí của company khác. Một lỗi trong Skill tùy chỉnh của company này không thể rò rỉ sang company kia.",

    scopesH2: "\"All\" so với bên trong một company",
    scopesP: "Thanh điều hướng bên trái chuyển giữa hai chế độ về căn bản khác nhau, và sự khác biệt này quan trọng hơn vẻ ngoài của nó: nó được lưu trong localStorage.activeCompanyId (sentinel __overall__ nghĩa là \"All\") và nó thay đổi cả những gì bạn được phép làm, không chỉ những gì bạn thấy.",
    scopes: [
      { t: "\"All\" (Overall)", d: "Màn hình trung tâm điều khiển. Tạo, kiểm soát và giám sát mọi company cùng lúc — nhưng bạn không thể tạo Task hay Staff trực tiếp ở đây. \"All\" là nơi bạn quyết định một thứ gì đó thuộc về company nào, không phải nơi công việc thực sự diễn ra." },
      { t: "Bên trong một company", d: "Vận hành đúng một company: tạo Department, Staff, Project, và Task, tất cả tự động thuộc phạm vi company đó. Đây là nơi công việc hàng ngày thực sự xảy ra." },
    ],
    scopesExampleH2: "Một kịch bản cụ thể",
    scopesExampleP: "Một admin đang chạy năm company mở dashboard ở chế độ \"All\" và lập tức thấy một góc nhìn tổng hợp — tổng thông lượng task, chi phí, và một lưới năm thẻ company, mỗi thẻ hiện số task/staff và type riêng. Không có gì họ thấy ở đó có thể chỉnh sửa theo nghĩa hàng ngày. Để thực sự tạo một Task cho company marketing, họ nhấp vào thẻ company đó, chuyển vào phạm vi của nó, và cùng thanh điều hướng bên trái giờ hiện Department, Staff, Task Board, và phần còn lại — tất cả tự động lọc theo đúng company đó.",

    typesH2: "Company type thực sự làm gì",
    typesP1: "type mặc định là \"general\", ngoài ra có thể là software, marketing, research. Điều quan trọng cần hiểu là type không làm gì: nó không bao giờ ẩn một tính năng. Một company \"marketing\" vẫn mở được Task Board; một company \"software\" vẫn mở được Recruiting. type chỉ làm hai việc — gợi ý cấu trúc mà AI Office Designer tạo ra, và gắn một ngôi sao \"Suggested\" nhỏ lên các mục nav phù hợp nhất.",
    typesP2: "Cụ thể, điều đó nghĩa là một company software có Projects, Task Board, Skills & Tools, và Training được đánh dấu sao trong sidebar (vì công việc kỹ thuật thường đi qua issue tracking và các công cụ có thể kiểm thử); một company marketing có Projects, Meetings, Documents, và Recruiting được đánh dấu sao (vì chiến dịch thường nằm trong các luồng hội thoại và tài sản dùng chung); một company research có Documents, Task Board, và Meetings được đánh dấu sao; và general thì không có gì được nhấn mạnh cả — mọi tùy chọn được trình bày đồng đều, đây là mặc định đúng khi bạn chưa chắc công ty sẽ có hình dạng ra sao.",

    createH2: "Tạo một company, từ đầu tới cuối",
    createOfficeP: "Đường nhanh nhất là AI Office Designer, và đáng để đi qua những gì thực sự xảy ra khi bạn dùng nó:",
    createSteps: [
      "Bạn mô tả công ty muốn tạo trong một prompt chat — lỏng lẻo hay chính xác tùy ý, ví dụ \"một agency marketing ba người tập trung vào launch B2B SaaS\".",
      "AI đề xuất một kế hoạch đầy đủ: một company type, một tập Department, các Staff bên trong mỗi cái (với role và system prompt đã được soạn sẵn), và các Skill mà mỗi Staff cần.",
      "Bạn xem lại kế hoạch ngay trong UI chat — chưa có gì được tạo ra tại thời điểm này, đó là một bản nháp bạn có thể phản hồi (\"cho copywriter dày dạn hơn\", \"thêm chuyên gia paid-ads\") trước khi chấp nhận.",
      "Khi xác nhận, hệ thống gọi endpoint apply, tạo ra toàn bộ kế hoạch — bản ghi company, mọi Department, mọi Staff, mọi liên kết Skill — trong một thao tác nguyên tử, và tự động chuyển phạm vi hoạt động của bạn vào company vừa tạo.",
    ],
    createManualP: "Lựa chọn thay thế là Manage Companies — CRUD thủ công đơn giản nơi bạn tự đặt tên, mô tả và type, hoặc sao chép cấu hình từ một company có sẵn thay vì bắt đầu từ một kế hoạch trống. Đây là lựa chọn tốt hơn khi bạn đã biết chính xác mình muốn gì, hoặc khi đang thiết lập một company gần giống hệt một cái đã xây trước đó.",
    createManualLink: "Recruiting",
    createManualP2: " là lựa chọn thứ ba đáng biết: thay vì tạo mới một Department/Staff/Skill từ đầu, bạn có thể duyệt catalog dùng chung do admin quản lý và clone thẳng các khối xây dựng có sẵn vào một company đang thiết lập thủ công.",

    schemaH2: "Schema",
    restH2: "REST API",
  },
  zh: {
    lead1: "Company（公司）是最高层级的组织单位——旧的内部名称是「Workspace」，您在少数后端路径中仍会看到这个词，但在所有面向用户的地方现在都叫 Company。平台中的其他一切——Department、Staff、Task、Project、Document、Connection——都归属于恰好一个 Company。不存在同时属于两个公司的 Staff，也不存在游离于任何公司之外的 Task。",
    lead2: "这种隔离正是整件事的核心。您可以并行创建和运行任意数量的公司——一家软件初创公司、一家营销代理、一家研究实验室，任何您能描述的——它们之间彼此无法看到或影响对方的 Department、Staff、数据或支出。一个公司自定义 Skill 中的 bug 不会泄漏到另一个公司。",

    scopesH2: "「All」与进入某个公司",
    scopesP: "左侧导航栏在两种本质上不同的模式之间切换，这种区别比看上去更重要：它保存在 localStorage.activeCompanyId 中（哨兵值 __overall__ 代表「All」），它改变的不仅是您能看到什么，还有您被允许做什么。",
    scopes: [
      { t: "「All」（全局）", d: "控制中心视图。同时创建、控制和监控所有公司——但无法在此处直接创建 Task 或 Staff。「All」是您决定某样东西属于哪个公司的地方，而不是实际工作发生的地方。" },
      { t: "进入某个公司", d: "运营恰好一个公司：创建 Department、Staff、Project 和 Task，全部自动限定在该公司范围内。这里才是日常工作真正发生的地方。" },
    ],
    scopesExampleH2: "一个具体场景",
    scopesExampleP: "一位管理着五家公司的管理员在「All」模式下打开仪表盘，立即看到一个聚合视图——总任务吞吐量、成本，以及一个由五张公司卡片组成的网格，每张卡片显示各自的任务/员工数量和类型。在那里看到的一切在日常意义上都不可编辑。要真正为营销公司创建一个 Task，他们需要点击该公司的卡片，切换进入其范围，此时同一个左侧导航栏会显示 Department、Staff、Task Board 等，全部自动过滤到那一家公司。",

    typesH2: "公司 type 实际做了什么",
    typesP1: "type 默认值为「general」，此外还可以是 software、marketing、research 之一。需要理解的重点是 type 不做什么：它从不隐藏任何功能。「marketing」类型的公司依然可以打开 Task Board；「software」类型的公司依然可以打开 Recruiting。type 只做两件事——为 AI Office Designer 生成的内容提供种子，并在最匹配的导航项上加一颗小小的「Suggested」星标。",
    typesP2: "具体来说，这意味着软件类型的公司在侧边栏中会为 Projects、Task Board、Skills & Tools 和 Training 加星（因为工程工作往往通过问题跟踪和可测试的工具进行）；营销类型的公司会为 Projects、Meetings、Documents 和 Recruiting 加星（因为营销活动往往存在于对话串和共享资产中）；研究类型的公司会为 Documents、Task Board 和 Meetings 加星；而 general 类型则完全不做任何强调——所有选项都以同等重要的方式呈现，这在您还不确定公司会呈现何种形态时是正确的默认行为。",

    createH2: "从头到尾创建一家公司",
    createOfficeP: "最快的路径是 AI Office Designer，值得梳理一下使用它时实际发生了什么：",
    createSteps: [
      "您在聊天 prompt 中描述想要的公司——可以随意宽泛或精确，例如「一家专注于 B2B SaaS 发布的三人营销代理」。",
      "AI 提出一个完整方案：一个公司类型、一组 Department、每个 Department 内的 Staff（角色和 system prompt 均已起草好），以及每位员工所需的 Skills。",
      "您在聊天界面中审阅该方案——此时尚未创建任何东西，这是一份可以在接受之前进行反馈的草案（「让文案更资深一点」「增加一位付费广告专家」）。",
      "确认后会调用 apply 接口，在一次原子操作中生成整个方案——公司记录、每个 Department、每位员工、每一个 Skill 绑定——并自动将您的活跃范围切换到新创建的公司。",
    ],
    createManualP: "另一种选择是 Manage Companies——纯粹的手动 CRUD，您自行设置名称、描述和类型，或者从已有公司克隆配置而不是从空白方案开始。当您已经确切知道自己想要什么，或者正在搭建一个与已有公司几乎相同的副本时，这是更合适的方式。",
    createManualLink: "Recruiting",
    createManualP2: "是值得了解的第三种选择：您不必从零生成全新的 Department/Staff/Skill，而是可以浏览管理员维护的共享目录，把现成的构建模块直接克隆进您正在手动搭建的公司中。",

    schemaH2: "数据结构",
    restH2: "REST API",
  },
  ja: {
    lead1: "Company（会社）は最上位の組織単位です——旧来の内部名称は「Workspace」で、一部のバックエンドのパスには今もその語が残っていますが、ユーザー向けの箇所ではすべて Company に統一されています。プラットフォーム内の他のすべて——Department、Staff、Task、Project、Document、Connection——は、必ずどれか 1 つの Company の配下にあります。2 つの会社に同時に属する Staff や、どの会社にも属さず浮遊する Task は存在しません。",
    lead2: "この分離こそが本質です。ソフトウェアスタートアップ、マーケティングエージェンシー、研究ラボなど、説明できるものなら何でも、いくつでも並行して会社を作成・運用できます。どの会社も他の会社の Department、Staff、データ、支出を見たり影響を与えたりすることはできません。ある会社のカスタム Skill のバグが別の会社に漏れることもありません。",

    scopesH2: "「All」と特定の会社の内部",
    scopesP: "左側のナビゲーションは本質的に異なる 2 つのモードを切り替えます。この区別は見た目以上に重要です。localStorage.activeCompanyId に保存され（センチネル値 __overall__ は「All」を意味します）、見えるものだけでなく、できることそのものも変わります。",
    scopes: [
      { t: "「All」（全体）", d: "コントロールセンタービュー。すべての会社を一括で作成・制御・監視しますが、ここで Task や Staff を直接作成することはできません。「All」は何かがどの会社に属するかを決める場所であり、実際の作業が行われる場所ではありません。" },
      { t: "特定の会社の内部", d: "ちょうど 1 つの会社を運用します。Department、Staff、Project、Task を作成でき、すべて自動的にその会社の範囲に限定されます。日々の作業が実際に行われるのはここです。" },
    ],
    scopesExampleH2: "具体的なシナリオ",
    scopesExampleP: "5 つの会社を運用している管理者が「All」でダッシュボードを開くと、すぐに集計ビュー——タスクの総処理量、コスト、そして各社のタスク/スタッフ数とタイプを示す 5 枚の会社カードのグリッド——が表示されます。そこで見えるものは日常的な意味では編集できません。マーケティング会社に実際に Task を作成するには、そのカードをクリックしてスコープを切り替えます。すると同じ左側ナビに Department、Staff、Task Board などが表示され、すべて自動的にその 1 社にフィルタされます。",

    typesH2: "会社の type が実際に行うこと",
    typesP1: "type のデフォルトは「general」で、それ以外は software、marketing、research のいずれかです。理解すべき重要な点は、type が何をしないかです。それは決して機能を非表示にしません。「marketing」タイプの会社でも Task Board を開けますし、「software」タイプの会社でも Recruiting を開けます。type が行うのは 2 つだけです。AI Office Designer が生成する内容の種になることと、最も適したナビ項目に小さな「Suggested」スターを付けることです。",
    typesP2: "具体的には、ソフトウェア会社では Projects、Task Board、Skills & Tools、Training がサイドバーでスター付きになります（エンジニアリング作業は課題管理とテスト可能なツールを経由する傾向があるため）。マーケティング会社では Projects、Meetings、Documents、Recruiting がスター付きになります（キャンペーンは会話スレッドや共有アセットの中に存在する傾向があるため）。研究会社では Documents、Task Board、Meetings がスター付きになります。そして general では一切強調がありません——すべてのオプションが同等に関連するものとして提示されます。会社がどのような形になるかまだわからない段階では、これが正しいデフォルトです。",

    createH2: "会社を最初から最後まで作成する",
    createOfficeP: "最速の道は AI Office Designer です。実際に使うと何が起きるかを見る価値があります。",
    createSteps: [
      "チャットのプロンプトで作りたい会社を説明します——「B2B SaaS のローンチに特化した 3 人のマーケティングエージェンシー」のように、緩くても厳密でも構いません。",
      "AI が完全なプランを提案します。会社タイプ、Department 一式、各 Department 内のスタッフ（役割と system prompt はすでに下書き済み）、そして各スタッフに必要な Skills です。",
      "チャット UI 内でプランを確認します——この時点ではまだ何も作成されていません。「コピーライターをもっとシニアにして」「有料広告の専門家を追加して」など、受け入れる前にフィードバックできる草案です。",
      "確定すると apply エンドポイントが呼ばれ、会社レコード、各 Department、各スタッフ、各 Skill の紐づけを含むプラン全体を 1 つの原子的操作で具体化し、アクティブなスコープを新しく作成された会社へ自動的に切り替えます。",
    ],
    createManualP: "もう 1 つの方法は Manage Companies です——白紙のプランから始める代わりに、名前・説明・type を自分で設定するか、既存の会社から設定を複製する、単純な手動 CRUD です。何が欲しいか正確にわかっている場合や、既に構築した会社とほぼ同じものをセットアップする場合はこちらの方が適しています。",
    createManualLink: "Recruiting",
    createManualP2: "は知っておく価値のある 3 つ目の選択肢です。新しい Department/Staff/Skill をゼロから生成する代わりに、管理者が管理する共有カタログを閲覧し、既存の構成要素を手動でセットアップ中の会社に直接クローンできます。",

    schemaH2: "スキーマ",
    restH2: "REST API",
  },
} as const;

export default function CompaniesDoc({ lang, onNavigate }: DocPageProps) {
  const t = TXT[lang];
  return (
    <div>
      <H1>Companies</H1>
      <P>{t.lead1}</P>
      <P>{t.lead2}</P>

      <H2>{t.scopesH2}</H2>
      <P>{t.scopesP}</P>
      <UL>
        {t.scopes.map(({ t: title, d }) => (
          <LI key={title}><strong>{title}:</strong> {d}</LI>
        ))}
      </UL>

      <H2>{t.scopesExampleH2}</H2>
      <P>{t.scopesExampleP}</P>

      <H2>{t.typesH2}</H2>
      <P>{t.typesP1}</P>
      <P>{t.typesP2}</P>
      <Callout type="tip">software · marketing · research · general — never exclusive, always just a suggestion.</Callout>

      <H2>{t.createH2}</H2>
      <P>{t.createOfficeP}</P>
      <OL>
        {t.createSteps.map((s, i) => <OLI key={i} n={i + 1}>{s}</OLI>)}
      </OL>
      <P>{t.createManualP}</P>
      <P>
        <DocLink id="recruiting" onNavigate={onNavigate}>{t.createManualLink}</DocLink>
        {t.createManualP2}
      </P>

      <H2>{t.schemaH2}</H2>
      <CodeBlock lang="python" title="server/domain/models.py" code={`@dataclass(frozen=True, slots=True)\nclass Company:\n    id: str\n    name: str\n    description: str\n    department_ids: list[str]\n    created_at: datetime\n    primary_department_id: str = ""\n    type: str = "general"   # "software" | "marketing" | "research" | "general"\n    owner_id: str = "default"`} />

      <H2>{t.restH2}</H2>
      <div className="rounded-xl border border-border/60 overflow-hidden my-4 divide-y divide-border/40">
        <ApiRow method="GET" path="/api/v1/companies" desc="List companies visible to you" />
        <ApiRow method="POST" path="/api/v1/companies" desc="Create or update a company (id in body = update)" />
        <ApiRow method="GET" path="/api/v1/companies/{'{id}'}" desc="Get one company" />
        <ApiRow method="GET" path="/api/v1/companies/platforms" desc="List messaging platforms available for hooks" />
        <ApiRow method="DELETE" path="/api/v1/companies/{'{id}'}" desc="Delete a company" />
        <ApiRow method="POST" path="/api/v1/office-builder/plan" desc="AI Office Designer: propose a company plan from chat" />
        <ApiRow method="POST" path="/api/v1/office-builder/apply" desc="Materialize a plan into a real company" />
      </div>
      <CodeBlock lang="bash" code={`curl -X POST http://localhost:8000/api/v1/companies \\\n  -H "Content-Type: application/json" \\\n  -d '{"name": "Nucleus Labs", "description": "A small research company.", "type": "research"}'`} />

      <NextSteps>
        <NextStepCard id="departments" onNavigate={onNavigate} title="Departments" desc={lang === "vi" ? "Sáu topology mà một department bên trong company có thể chạy." : lang === "zh" ? "公司内某个部门可运行的六种拓扑。" : lang === "ja" ? "会社内の部門が実行できる 6 つのトポロジー。" : "The six topologies a Department inside a company can run."} />
        <NextStepCard id="staff" onNavigate={onNavigate} title="Staff" desc={lang === "vi" ? "Đơn vị công việc nhỏ nhất bên trong một Department." : lang === "zh" ? "Department 内最小的工作单元。" : lang === "ja" ? "Department 内の最小の作業単位。" : "The smallest unit of work inside a Department."} />
        <NextStepCard id="recruiting" onNavigate={onNavigate} title="Recruiting" desc={lang === "vi" ? "Clone Department/Staff/Skill có sẵn thay vì tạo mới." : lang === "zh" ? "克隆现成的部门/员工/技能，而不是从零创建。" : lang === "ja" ? "既存の Department/Staff/Skill をクローンする。" : "Clone existing Departments/Staff/Skills instead of generating new ones."} />
      </NextSteps>
    </div>
  );
}
