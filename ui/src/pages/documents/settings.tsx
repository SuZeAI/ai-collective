import { H1, H2, P, UL, LI, InlineCode, ApiRow, Callout, DocLink, NextSteps, NextStepCard, type DocPageProps } from "./_shared";

const TXT = {
  en: {
    lead1: "Settings covers what an individual signed-in user can actually change from the UI, and it's deliberately narrow. The temptation with a page called \"Settings\" is to dump every configurable knob in the whole system onto it; this platform resists that on purpose, because most of what looks like a \"setting\" actually belongs somewhere more specific — a Skill's own config, or config.yml at deploy time — and putting it there instead keeps the blast radius of any one change small.",
    lead2: "The clearest way to understand what's actually here is to ask who can change what:",
    tableWho: "Who",
    tableWhat: "What",
    tableWhere: "Where",
    rows: [
      { who: "Any signed-in user", what: "Own profile, password, avatar, display language, light/dark theme", where: "Settings (this page)" },
      { who: "Admin", what: "Which LLM model is active platform-wide, per-model price cards, org-wide usage/health monitoring", where: "Settings + /admin/monitoring" },
      { who: "Nobody, via UI", what: "Storage/task-queue/lock/sandbox backend selection, LLM provider API keys, Google OAuth credentials, JWT secret", where: "config.yml only, deploy time" },
    ],

    profileH2: "Profile — any user",
    profileP: "Standard account controls: display name, password, avatar image, plus the client-side preferences (language, theme) that live in localStorage rather than a server round-trip.",

    adminH2: "Admin: model activation and pricing",
    adminP: "Admins can flip which LLM model is active platform-wide and edit the per-model price cards used everywhere cost is estimated, without touching config.yml or restarting the service. This matters because it's the same escape hatch discussed in ",
    analyticsLink: "Performance & Cost / Usage & Billing",
    adminP2: " — provider pricing changes faster than this platform ships releases, so pricing has to be an editable record, not a constant baked into the code.",

    skillsH2: "Per-tool credentials live on the Skill, not here",
    skillsP1: "A Slack bot token, a Google Sheets OAuth grant, a Discord webhook URL — none of these are global settings, and that's a deliberate isolation boundary, not an oversight. Each credential is stored inside that specific ",
    skillsLink: "Skill's",
    skillsP2: " own config dict (DB-stored) and edited from the Skills page when you create or edit that particular Skill.",
    skillsP3: "The reason is blast radius: if every Skill's secrets lived in one global page, revoking a compromised Slack token would mean hunting through an undifferentiated list to find the right one, and a bug in how that page renders credentials could expose every integration at once. Scoping credentials to the Skill that owns them means revoking or rotating one integration's access never touches any other.",

    notH2: "config.yml-only — never a user setting",
    notP: "These are chosen once, at deploy time, by whoever runs the server — never exposed through the UI to any user, admin included:",
    notItems: [
      "Storage backend (json vs mongo), task queue (memory vs rabbitmq), distributed lock (threading vs redis), sandbox mode (local vs k8s).",
      "LLM provider API keys — config.yml's models: list, each referencing a ${VAR} resolved from .env.",
      "Google OAuth sign-in client ID/secret, and the JWT signing secret used for session tokens.",
    ],
    notP2: "The full reference for all of these lives in the ",
    configLink: "Configuration",
    notP3: " guide.",
  },
  vi: {
    lead1: "Settings bao gồm những gì một người dùng đã đăng nhập thực sự có thể thay đổi từ giao diện, và phạm vi này được thu hẹp có chủ đích. Cám dỗ với một trang tên \"Settings\" là dồn mọi nút điều chỉnh trong toàn hệ thống vào đó; nền tảng này cố tình tránh điều đó, vì phần lớn những gì trông giống một \"setting\" thực ra thuộc về một nơi cụ thể hơn — config riêng của một Skill, hoặc config.yml lúc triển khai — và đặt nó ở đó thay vì đây giúp phạm vi ảnh hưởng của bất kỳ thay đổi nào luôn nhỏ.",
    lead2: "Cách rõ ràng nhất để hiểu những gì thực sự nằm ở đây là hỏi ai được thay đổi cái gì:",
    tableWho: "Ai",
    tableWhat: "Cái gì",
    tableWhere: "Ở đâu",
    rows: [
      { who: "Bất kỳ người dùng đã đăng nhập", what: "Hồ sơ, mật khẩu, avatar, ngôn ngữ hiển thị, giao diện sáng/tối của chính họ", where: "Settings (trang này)" },
      { who: "Admin", what: "Model LLM nào đang hoạt động toàn nền tảng, bảng giá theo từng model, giám sát mức sử dụng/tình trạng toàn hệ thống", where: "Settings + /admin/monitoring" },
      { who: "Không ai, qua UI", what: "Chọn backend storage/task-queue/lock/sandbox, API key nhà cung cấp LLM, thông tin xác thực Google OAuth, JWT secret", where: "Chỉ config.yml, lúc triển khai" },
    ],

    profileH2: "Hồ sơ — mọi người dùng",
    profileP: "Các điều khiển tài khoản tiêu chuẩn: tên hiển thị, mật khẩu, ảnh avatar, cộng với các tùy chọn phía client (ngôn ngữ, giao diện) nằm trong localStorage thay vì gọi lên server.",

    adminH2: "Admin: kích hoạt model và giá",
    adminP: "Admin có thể chuyển đổi model LLM nào đang hoạt động trên toàn nền tảng và chỉnh sửa bảng giá theo từng model được dùng ở mọi nơi ước tính chi phí, mà không cần đụng vào config.yml hay khởi động lại dịch vụ. Điều này quan trọng vì đó chính là lối thoát hiểm được nhắc tới trong ",
    analyticsLink: "Performance & Cost / Usage & Billing",
    adminP2: " — giá của nhà cung cấp thay đổi nhanh hơn nền tảng này ra bản phát hành mới, nên giá phải là một bản ghi có thể chỉnh sửa, không phải một hằng số cứng trong code.",

    skillsH2: "Thông tin xác thực từng công cụ nằm ở Skill, không phải ở đây",
    skillsP1: "Token bot Slack, quyền OAuth của Google Sheets, URL webhook Discord — không cái nào trong số này là setting toàn cục, và đó là một ranh giới cô lập có chủ đích, không phải sơ suất. Mỗi thông tin xác thực được lưu bên trong config dict riêng của ",
    skillsLink: "Skill",
    skillsP2: " cụ thể đó (lưu trong DB) và được chỉnh sửa từ trang Skills khi bạn tạo hoặc sửa Skill đó.",
    skillsP3: "Lý do là phạm vi ảnh hưởng: nếu bí mật của mọi Skill nằm trên một trang toàn cục, thu hồi một token Slack bị lộ sẽ có nghĩa là phải lục qua một danh sách không phân biệt để tìm đúng cái, và một lỗi trong cách trang đó hiển thị thông tin xác thực có thể lộ mọi tích hợp cùng lúc. Giới hạn thông tin xác thực vào đúng Skill sở hữu nó nghĩa là thu hồi hay xoay vòng quyền truy cập của một tích hợp không bao giờ động chạm tới cái khác.",

    notH2: "Chỉ config.yml — không bao giờ là setting của người dùng",
    notP: "Những thứ này được chọn một lần, lúc triển khai, bởi người vận hành server — không bao giờ lộ ra qua UI cho bất kỳ người dùng nào, kể cả admin:",
    notItems: [
      "Storage backend (json hay mongo), task queue (memory hay rabbitmq), distributed lock (threading hay redis), sandbox mode (local hay k8s).",
      "API key của các nhà cung cấp LLM — nằm trong danh sách models: của config.yml, mỗi mục tham chiếu một ${VAR} được lấy từ .env.",
      "Client ID/secret đăng nhập Google OAuth, và secret ký JWT dùng cho token phiên đăng nhập.",
    ],
    notP2: "Tài liệu tham khảo đầy đủ cho tất cả những thứ này nằm trong hướng dẫn ",
    configLink: "Configuration",
    notP3: ".",
  },
  zh: {
    lead1: "Settings 涵盖已登录用户真正能从界面上更改的内容，而且其范围是刻意收窄的。一个名为「Settings」的页面很容易被塞进整个系统里所有可配置的旋钮；这个平台刻意避免了这一点，因为大多数看起来像「设置」的东西，实际上都属于更具体的地方——某个 Skill 自己的 config，或部署时的 config.yml——把它放在那里而不是这里，能让任何一次改动的影响范围保持很小。",
    lead2: "理解这里究竟有什么内容，最清晰的方式是问「谁能改什么」：",
    tableWho: "谁",
    tableWhat: "能改什么",
    tableWhere: "在哪里",
    rows: [
      { who: "任意已登录用户", what: "自己的资料、密码、头像、显示语言、明暗主题", where: "Settings（本页面）" },
      { who: "管理员", what: "平台范围内哪个 LLM 模型处于活跃状态、各模型价格卡、全组织的用量/健康监控", where: "Settings + /admin/monitoring" },
      { who: "任何人都无法通过 UI 修改", what: "存储/任务队列/锁/沙箱后端的选择、LLM 提供商 API 密钥、Google OAuth 凭据、JWT 密钥", where: "仅 config.yml，部署时配置" },
    ],

    profileH2: "个人资料 —— 所有用户",
    profileP: "标准的账户控制项：显示名称、密码、头像图片，以及存放在 localStorage 中而非需要服务端往返的客户端偏好设置（语言、主题）。",

    adminH2: "管理员：模型启用与定价",
    adminP: "管理员可以切换整个平台当前启用的 LLM 模型，并编辑用于所有成本估算场景的各模型价格卡，而无需改动 config.yml 或重启服务。这一点很重要，因为它正是",
    analyticsLink: "Performance & Cost / Usage & Billing",
    adminP2: "中提到的同一个逃生舱口——供应商定价的变化速度快于本平台发布新版本的速度，因此定价必须是一条可编辑的记录，而不是硬编码进代码里的常量。",

    skillsH2: "各工具的凭据存在 Skill 上，而不是这里",
    skillsP1: "Slack 机器人 token、Google Sheets 的 OAuth 授权、Discord webhook URL——这些都不是全局设置，这是一个刻意设计的隔离边界，而不是疏忽。每个凭据都存储在对应",
    skillsLink: "Skill",
    skillsP2: "自己的 config 字典中（存于数据库），并在创建或编辑该 Skill 时从 Skills 页面进行编辑。",
    skillsP3: "原因在于影响范围：如果每个 Skill 的密钥都放在一个全局页面上，撤销一个被泄露的 Slack token 就意味着要在一个未加区分的列表里翻找出正确的那一个，而该页面渲染凭据方式中的一个 bug 就可能一次性暴露所有集成。把凭据限定在拥有它的那个 Skill 范围内，意味着撤销或轮换某一个集成的访问权限永远不会波及其他集成。",

    notH2: "仅 config.yml —— 永远不是用户设置",
    notP: "以下内容由运行服务器的人在部署时一次性选定——永远不会通过 UI 暴露给任何用户，包括管理员：",
    notItems: [
      "存储后端（json 或 mongo）、任务队列（memory 或 rabbitmq）、分布式锁（threading 或 redis）、沙箱模式（local 或 k8s）。",
      "LLM 提供商 API 密钥——位于 config.yml 的 models: 列表中，每一项引用从 .env 解析出的 ${VAR}。",
      "Google OAuth 登录的 client ID/secret，以及用于会话令牌的 JWT 签名密钥。",
    ],
    notP2: "以上所有内容的完整参考位于",
    configLink: "Configuration",
    notP3: "指南中。",
  },
  ja: {
    lead1: "Settings は、サインイン済みの個々のユーザーが UI から実際に変更できる範囲をカバーしており、意図的に狭く保たれています。「Settings」という名前のページには、システム全体のあらゆる調整可能なつまみを詰め込みたくなるものですが、このプラットフォームは意図的にそれを避けています。「設定」に見えるものの多くは、実はもっと具体的などこか——ある Skill 自身の config、あるいはデプロイ時の config.yml——に属しており、そこに置くことで、どの変更の影響範囲も小さく保てるからです。",
    lead2: "ここに実際に何があるかを理解する最も明快な方法は、「誰が何を変更できるか」を問うことです。",
    tableWho: "誰が",
    tableWhat: "何を",
    tableWhere: "どこで",
    rows: [
      { who: "サインイン済みの任意のユーザー", what: "自分のプロフィール、パスワード、アバター、表示言語、ライト/ダークテーマ", where: "Settings（このページ）" },
      { who: "管理者", what: "プラットフォーム全体でどの LLM モデルが有効か、モデルごとの価格カード、組織全体の使用状況/健全性モニタリング", where: "Settings + /admin/monitoring" },
      { who: "誰も UI からは不可", what: "ストレージ/タスクキュー/ロック/サンドボックスのバックエンド選択、LLM プロバイダー API キー、Google OAuth 認証情報、JWT シークレット", where: "config.yml のみ、デプロイ時" },
    ],

    profileH2: "プロフィール —— 全ユーザー",
    profileP: "標準的なアカウント制御：表示名、パスワード、アバター画像、そしてサーバーへの往復ではなく localStorage に保存されるクライアント側の設定（言語、テーマ）。",

    adminH2: "管理者：モデルの有効化と価格設定",
    adminP: "管理者は config.yml を触ったりサービスを再起動したりせずに、プラットフォーム全体で有効な LLM モデルを切り替えたり、コスト見積もりに使われるモデルごとの価格カードを編集したりできます。これは重要な点です。なぜなら、これは",
    analyticsLink: "Performance & Cost / Usage & Billing",
    adminP2: "で触れたのと同じ逃げ道だからです——プロバイダーの価格はこのプラットフォームがリリースを出すよりも速く変わるため、価格はコードに焼き込まれた定数ではなく、編集可能なレコードでなければなりません。",

    skillsH2: "ツールごとの認証情報は Skill 側にあり、ここにはない",
    skillsP1: "Slack ボットトークン、Google Sheets の OAuth 認可、Discord の webhook URL——これらはいずれもグローバル設定ではありません。これは見落としではなく、意図的な分離境界です。各認証情報は、それを所有する特定の",
    skillsLink: "Skill",
    skillsP2: "自身の config 辞書（DB 保存）に格納され、その Skill を作成・編集する際に Skills ページから編集します。",
    skillsP3: "理由は影響範囲です。すべての Skill のシークレットが 1 つのグローバルページにあったら、漏洩した Slack トークンを取り消すには、区別のつかないリストの中から正しいものを探し回ることになり、そのページが認証情報を表示する方法にバグがあれば、すべての連携が一度に露出しかねません。認証情報をそれを所有する Skill に限定することで、ある連携のアクセスを取り消したりローテーションしたりしても、他の連携には決して影響しません。",

    notH2: "config.yml のみ —— 決してユーザー設定にはならない",
    notP: "これらはサーバーを運用する人がデプロイ時に一度だけ選択するものであり、管理者を含めどのユーザーにも UI 経由で公開されることはありません。",
    notItems: [
      "ストレージバックエンド（json か mongo）、タスクキュー（memory か rabbitmq）、分散ロック（threading か redis）、サンドボックスモード（local か k8s）。",
      "LLM プロバイダーの API キー — config.yml の models: リストにあり、それぞれ .env から解決される ${VAR} を参照します。",
      "Google OAuth サインインのクライアント ID/シークレット、およびセッショントークンに使われる JWT 署名シークレット。",
    ],
    notP2: "これらすべての完全なリファレンスは",
    configLink: "Configuration",
    notP3: "ガイドにあります。",
  },
} as const;

export default function SettingsDoc({ lang, onNavigate }: DocPageProps) {
  const t = TXT[lang];
  return (
    <div>
      <H1>Settings</H1>
      <P>{t.lead1}</P>
      <P>{t.lead2}</P>

      <div className="overflow-x-auto my-5">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left py-2 pr-4 font-semibold text-foreground/80">{t.tableWho}</th>
              <th className="text-left py-2 pr-4 font-semibold text-foreground/80">{t.tableWhat}</th>
              <th className="text-left py-2 font-semibold text-foreground/80">{t.tableWhere}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/40 text-[13px]">
            {t.rows.map((r) => (
              <tr key={r.who}>
                <td className="py-2.5 pr-4 text-foreground/80 font-medium align-top">{r.who}</td>
                <td className="py-2.5 pr-4 text-muted-foreground align-top">{r.what}</td>
                <td className="py-2.5 text-muted-foreground align-top">{r.where}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <H2>{t.profileH2}</H2>
      <P>{t.profileP}</P>
      <div className="rounded-xl border border-border/60 overflow-hidden my-4 divide-y divide-border/40">
        <ApiRow method="GET" path="/api/v1/auth/me" desc="Current user" />
        <ApiRow method="PATCH" path="/api/v1/auth/profile" desc="Update name / display fields" />
        <ApiRow method="PATCH" path="/api/v1/auth/password" desc="Change password" />
        <ApiRow method="POST" path="/api/v1/auth/avatar" desc="Upload a profile avatar" />
      </div>

      <H2>{t.adminH2}</H2>
      <P>
        {t.adminP}<DocLink id="analytics" onNavigate={onNavigate}>{t.analyticsLink}</DocLink>{t.adminP2}
      </P>
      <div className="rounded-xl border border-border/60 overflow-hidden my-4 divide-y divide-border/40">
        <ApiRow method="PUT" path="/api/v1/admin/monitoring/active-model" desc="Set the platform's active LLM model" />
        <ApiRow method="GET" path="/api/v1/admin/monitoring/pricing" desc="List model price cards" />
        <ApiRow method="PUT" path="/api/v1/admin/monitoring/pricing" desc="Edit a model's price card" />
      </div>

      <H2>{t.skillsH2}</H2>
      <P>
        {t.skillsP1}<DocLink id="skills" onNavigate={onNavigate}>{t.skillsLink}</DocLink>{t.skillsP2}
      </P>
      <P>{t.skillsP3}</P>

      <H2>{t.notH2}</H2>
      <P>{t.notP}</P>
      <UL>
        {t.notItems.map((item) => <LI key={item}>{item}</LI>)}
      </UL>
      <Callout type="warning">
        <InlineCode>config.yml</InlineCode> (at <InlineCode>.config/config.yml</InlineCode>) is the single, complete source for every deploy-time setting, including secrets referenced as <InlineCode>{"${VAR}"}</InlineCode>. {t.notP2}<DocLink id="configuration" onNavigate={onNavigate}>{t.configLink}</DocLink>{t.notP3}
      </Callout>

      <NextSteps>
        <NextStepCard id="configuration" onNavigate={onNavigate} title="Configuration" desc={lang === "vi" ? "Toàn bộ tham chiếu config.yml." : lang === "zh" ? "完整的 config.yml 参考。" : lang === "ja" ? "config.yml の完全なリファレンス。" : "The full config.yml reference."} />
        <NextStepCard id="skills" onNavigate={onNavigate} title="Skills" desc={lang === "vi" ? "Nơi thông tin xác thực từng công cụ thực sự sống." : lang === "zh" ? "各工具凭据实际存放的位置。" : lang === "ja" ? "ツールごとの認証情報が実際に存在する場所。" : "Where per-tool credentials actually live."} />
        <NextStepCard id="connections" onNavigate={onNavigate} title="Connections & Webhooks" desc={lang === "vi" ? "Tích hợp bên thứ ba khác với credential của Skill." : lang === "zh" ? "与 Skill 凭据不同的第三方集成。" : lang === "ja" ? "Skill の認証情報とは別の外部連携。" : "Third-party integrations, distinct from Skill credentials."} />
      </NextSteps>
    </div>
  );
}
