import { H1, H2, P, OL, OLI, Callout, CodeBlock, InlineCode, ApiRow, DocLink, NextSteps, NextStepCard, type DocPageProps } from "./_shared";

const TXT = {
  en: {
    intro: "Connection is a single, unified model for every third-party integration a company can have — both the webhook endpoint that lets outside platforms message your staff, and outbound integrations your staff call out to. It merges two formerly-separate models: kind=\"inbound_webhook\" (previously PlatformHook, embedded on Company) and kind=\"outbound\" (previously a standalone ThirdPartyConnection). The unification means one page, one schema, and one REST surface for anything the word \"integration\" could mean in this system.",
    schemaH2: "Schema",
    schemaP: "company_id=\"\" means the connection is global/account-scoped rather than tied to one company. A Connection row is configuration only — it never carries live message traffic itself.",
    twoKindsH2: "Two kinds, one model",
    inboundP: "kind=\"inbound_webhook\" is a receiving endpoint: register one per messaging platform your company wants to be reachable on (Slack, Telegram, WhatsApp Business...), and outside users can message your staff through that platform exactly like they would through the in-app chat.",
    outboundP: "kind=\"outbound\" is the reverse direction: a Staff member's Skill calls out through it. Concretely, a Skill with tool_name pointing at a messaging integration reads its bot token / webhook URL / API key from a Connection's config field rather than having credentials hardcoded anywhere — so, for example, a \"Post to Slack\" Skill attached to a Staff member resolves which Slack workspace and channel to post to by looking up the outbound Connection configured for that company.",
    routingH2: "Per-connection routing overrides",
    routingP: "By default, an inbound message goes to the company's primary_department_id. Set routing_department_id or routing_staff_ids on a specific connection to send that platform's messages somewhere else instead — useful when, say, your Discord bot should talk to a different department than your WhatsApp number.",
    walkthroughH2: "Walking through an inbound message",
    walkthroughP: "Here's what actually happens between a user typing a message on, say, WhatsApp and a Staff member replying:",
    walkthroughSteps: [
      { h: "The platform delivers the message.", d: "WhatsApp (or Slack, Telegram, etc.) sends a POST to /api/v1/webhook/{platform}/{company_id}/{hook_id} — a public, unauthenticated URL you registered with that platform when you set up the Connection." },
      { h: "The per-platform processor verifies it.", d: "server/domain/third_party/ has a processor for each supported platform. It checks the request's signature against the Connection's config before trusting anything in the payload." },
      { h: "The message is routed.", d: "If the Connection that owns this hook has routing_department_id or routing_staff_ids set, the message goes there. Otherwise it falls back to the company's primary_department_id." },
      { h: "A Staff member handles it and can reply.", d: "The routed Department (or specific Staff) processes the message like any other Task input, and — depending on the platform integration — can send a reply back out through the same Connection." },
    ],
    platformsP: "Supported messaging platforms include Discord, Slack, Telegram, WhatsApp Business, Signal, Microsoft Teams, WeChat, Zalo, Line, and Viber.",
    restH2: "Managing connections",
    nextH2: "Next",
    nextCompanies: "primary_department_id and the routing fallback in context.",
    nextSkills: "How a Skill actually resolves credentials from an outbound Connection.",
  },
  vi: {
    intro: "Connection là một model thống nhất duy nhất cho mọi tích hợp bên thứ ba mà một công ty có thể có — vừa là endpoint webhook cho phép các nền tảng bên ngoài gửi tin nhắn tới staff của bạn, vừa là các tích hợp gửi-đi mà staff của bạn gọi ra ngoài. Nó gộp hai model trước đây tách biệt: kind=\"inbound_webhook\" (trước đây là PlatformHook, gắn trên Company) và kind=\"outbound\" (trước đây là một ThirdPartyConnection độc lập). Việc hợp nhất này nghĩa là một trang, một schema, và một bề mặt REST duy nhất cho bất cứ điều gì từ \"tích hợp\" có thể ám chỉ trong hệ thống này.",
    schemaH2: "Schema",
    schemaP: "company_id=\"\" nghĩa là connection này ở phạm vi toàn cục/tài khoản thay vì gắn với một công ty cụ thể. Một dòng Connection chỉ là cấu hình — nó không bao giờ tự mang lưu lượng tin nhắn thật sự.",
    twoKindsH2: "Hai loại, một model",
    inboundP: "kind=\"inbound_webhook\" là một endpoint tiếp nhận: đăng ký một cái cho mỗi nền tảng nhắn tin mà công ty bạn muốn có thể được liên hệ (Slack, Telegram, WhatsApp Business...), và người dùng bên ngoài có thể nhắn tin cho staff của bạn qua nền tảng đó y hệt như qua khung chat trong app.",
    outboundP: "kind=\"outbound\" là chiều ngược lại: một Skill của Staff gọi ra ngoài qua nó. Cụ thể, một Skill có tool_name trỏ tới một tích hợp nhắn tin sẽ đọc bot token / webhook URL / API key từ trường config của một Connection thay vì hardcode credentials ở bất cứ đâu — ví dụ, một Skill \"Post to Slack\" gắn cho một Staff sẽ xác định workspace và channel Slack nào để đăng bằng cách tra cứu Connection outbound đã cấu hình cho công ty đó.",
    routingH2: "Ghi đè định tuyến theo từng connection",
    routingP: "Mặc định, một tin nhắn đến sẽ được gửi tới primary_department_id của công ty. Đặt routing_department_id hoặc routing_staff_ids trên một connection cụ thể để gửi tin nhắn từ nền tảng đó tới nơi khác — hữu ích khi, chẳng hạn, bot Discord của bạn cần nói chuyện với một department khác so với số WhatsApp.",
    walkthroughH2: "Đi qua một tin nhắn đến",
    walkthroughP: "Đây là những gì thực sự xảy ra giữa lúc một người dùng gõ tin nhắn trên, ví dụ, WhatsApp và lúc một Staff trả lời:",
    walkthroughSteps: [
      { h: "Nền tảng giao tin nhắn.", d: "WhatsApp (hoặc Slack, Telegram, v.v.) gửi POST tới /api/v1/webhook/{platform}/{company_id}/{hook_id} — một URL công khai, không yêu cầu xác thực, mà bạn đã đăng ký với nền tảng đó khi thiết lập Connection." },
      { h: "Processor riêng cho từng nền tảng xác minh nó.", d: "server/domain/third_party/ có một processor cho mỗi nền tảng được hỗ trợ. Nó kiểm tra chữ ký của request so với config của Connection trước khi tin bất cứ điều gì trong payload." },
      { h: "Tin nhắn được định tuyến.", d: "Nếu Connection sở hữu hook này có đặt routing_department_id hoặc routing_staff_ids, tin nhắn sẽ đi tới đó. Nếu không, nó rơi về primary_department_id của công ty." },
      { h: "Một Staff xử lý và có thể trả lời.", d: "Department (hoặc Staff cụ thể) được định tuyến xử lý tin nhắn như bất kỳ đầu vào Task nào khác, và — tùy vào tích hợp nền tảng — có thể gửi trả lời ngược lại qua chính Connection đó." },
    ],
    platformsP: "Các nền tảng nhắn tin được hỗ trợ gồm Discord, Slack, Telegram, WhatsApp Business, Signal, Microsoft Teams, WeChat, Zalo, Line, và Viber.",
    restH2: "Quản lý connection",
    nextH2: "Tiếp theo",
    nextCompanies: "primary_department_id và cơ chế fallback định tuyến trong bối cảnh rộng hơn.",
    nextSkills: "Cách một Skill thực sự lấy credentials từ một Connection outbound.",
  },
  zh: {
    intro: "Connection 是公司可拥有的每一种第三方集成的统一模型——既包括让外部平台向您的员工发消息的 webhook 端点，也包括员工对外调用的出站集成。它合并了此前两个独立的模型：kind=\"inbound_webhook\"（原先是嵌入在 Company 上的 PlatformHook）和 kind=\"outbound\"（原先是独立的 ThirdPartyConnection）。这次统一意味着在这个系统中，\"集成\"这个词无论指什么，都只对应一个页面、一种数据结构、一套 REST 接口。",
    schemaH2: "数据结构",
    schemaP: "company_id=\"\" 表示该连接是全局/账户级别的，而非绑定到某个公司。一条 Connection 记录只是配置——它本身从不承载实际的消息流量。",
    twoKindsH2: "两种类型，一个模型",
    inboundP: "kind=\"inbound_webhook\" 是一个接收端点：为公司希望可被联系到的每个消息平台（Slack、Telegram、WhatsApp Business……）各注册一个，外部用户就可以通过该平台给您的员工发消息，效果与通过应用内聊天完全一样。",
    outboundP: "kind=\"outbound\" 是相反的方向：员工的某个 Skill 通过它对外调用。具体来说，一个 tool_name 指向消息集成的 Skill，会从某个 Connection 的 config 字段中读取 bot token / webhook URL / API key，而不是把凭据硬编码在任何地方——例如，绑定在某员工上的\"发布到 Slack\"Skill，会通过查找该公司配置的出站 Connection 来确定要发布到哪个 Slack 工作区和频道。",
    routingH2: "按连接的路由覆盖",
    routingP: "默认情况下，入站消息会发送到公司的 primary_department_id。在某个具体连接上设置 routing_department_id 或 routing_staff_ids，可以将该平台的消息改发到别处——例如当您的 Discord 机器人需要与和 WhatsApp 号码不同的部门对接时会很有用。",
    walkthroughH2: "跟随一条入站消息走一遍",
    walkthroughP: "以下是用户在（比如）WhatsApp 上输入一条消息，到员工回复之间实际发生的事情：",
    walkthroughSteps: [
      { h: "平台投递消息。", d: "WhatsApp（或 Slack、Telegram 等）向 /api/v1/webhook/{platform}/{company_id}/{hook_id} 发送 POST 请求——这是一个公开、无需鉴权的 URL，是您设置 Connection 时向该平台注册的。" },
      { h: "平台专属处理器进行校验。", d: "server/domain/third_party/ 中为每个受支持的平台准备了一个处理器。它会先对照 Connection 的 config 校验请求签名，然后才信任 payload 中的任何内容。" },
      { h: "消息被路由。", d: "如果拥有该 hook 的 Connection 设置了 routing_department_id 或 routing_staff_ids，消息就会发往那里；否则会回退到公司的 primary_department_id。" },
      { h: "员工处理消息并可以回复。", d: "被路由到的 Department（或特定员工）像处理其他任何 Task 输入一样处理这条消息，并且——取决于平台集成——可以通过同一个 Connection 把回复发送出去。" },
    ],
    platformsP: "支持的消息平台包括 Discord、Slack、Telegram、WhatsApp Business、Signal、Microsoft Teams、微信、Zalo、Line 和 Viber。",
    restH2: "管理连接",
    nextH2: "下一步",
    nextCompanies: "把 primary_department_id 和路由回退机制放到更大的语境中理解。",
    nextSkills: "一个 Skill 究竟是如何从出站 Connection 中解析出凭据的。",
  },
  ja: {
    intro: "Connection は、会社が持ちうるあらゆるサードパーティ連携を表す単一の統合モデルです——外部プラットフォームがスタッフにメッセージを送るための webhook エンドポイントと、スタッフが外部を呼び出すアウトバウンド連携の両方を含みます。これは以前は別々だった 2 つのモデルを統合したものです：kind=\"inbound_webhook\"（以前は Company に埋め込まれた PlatformHook）と kind=\"outbound\"（以前は独立した ThirdPartyConnection）。この統合により、このシステムで「連携」という言葉が意味しうるものはすべて、1 つのページ、1 つのスキーマ、1 つの REST サーフェスに集約されます。",
    schemaH2: "スキーマ",
    schemaP: "company_id=\"\" は、この接続が特定の会社に紐づかない、グローバル／アカウントスコープであることを意味します。Connection レコードは設定にすぎず、実際のメッセージトラフィックを自ら運ぶことはありません。",
    twoKindsH2: "2 種類、1 つのモデル",
    inboundP: "kind=\"inbound_webhook\" は受信用エンドポイントです。会社が連絡を受けたいメッセージングプラットフォーム（Slack、Telegram、WhatsApp Business……）ごとに 1 つ登録すれば、外部ユーザーはアプリ内チャットとまったく同じようにそのプラットフォーム経由でスタッフにメッセージを送れます。",
    outboundP: "kind=\"outbound\" は逆方向です。スタッフの Skill がこれを通じて外部を呼び出します。具体的には、メッセージング連携を指す tool_name を持つ Skill は、認証情報をどこかにハードコードするのではなく、Connection の config フィールドから bot トークン／webhook URL／API キーを読み取ります。例えば、あるスタッフに紐づけられた「Slack に投稿」Skill は、その会社向けに設定されたアウトバウンド Connection を参照して、どの Slack ワークスペース・チャンネルに投稿するかを決定します。",
    routingH2: "接続ごとのルーティング上書き",
    routingP: "デフォルトでは、受信メッセージは会社の primary_department_id に送られます。特定の接続に routing_department_id または routing_staff_ids を設定すると、そのプラットフォームのメッセージを別の場所に送れます——例えば Discord ボットを WhatsApp とは別の部門に対応させたい場合に便利です。",
    walkthroughH2: "インバウンドメッセージの流れを追う",
    walkthroughP: "例えば WhatsApp でユーザーがメッセージを入力してから、スタッフが返信するまでに実際に起きていることは次の通りです。",
    walkthroughSteps: [
      { h: "プラットフォームがメッセージを配信します。", d: "WhatsApp（あるいは Slack、Telegram など）が /api/v1/webhook/{platform}/{company_id}/{hook_id} に POST を送信します——これは Connection を設定した際にそのプラットフォームに登録した、認証不要の公開 URL です。" },
      { h: "プラットフォーム専用プロセッサが検証します。", d: "server/domain/third_party/ には対応プラットフォームごとのプロセッサがあります。ペイロードの内容を信頼する前に、Connection の config と照合してリクエストの署名を検証します。" },
      { h: "メッセージがルーティングされます。", d: "この hook を所有する Connection に routing_department_id または routing_staff_ids が設定されていればそこへ送られ、なければ会社の primary_department_id にフォールバックします。" },
      { h: "スタッフが処理し、返信できます。", d: "ルーティングされた Department（または特定のスタッフ）は、他の Task 入力と同様にこのメッセージを処理し、プラットフォーム連携の内容次第では同じ Connection を通じて返信を送り返せます。" },
    ],
    platformsP: "対応するメッセージングプラットフォームには Discord、Slack、Telegram、WhatsApp Business、Signal、Microsoft Teams、WeChat、Zalo、Line、Viber などがあります。",
    restH2: "接続の管理",
    nextH2: "次に読む",
    nextCompanies: "primary_department_id とルーティングのフォールバックを全体像の中で理解する。",
    nextSkills: "Skill がアウトバウンド Connection から実際にどう認証情報を解決するか。",
  },
} as const;

export default function ConnectionsDoc({ lang, onNavigate }: DocPageProps) {
  const t = TXT[lang];
  return (
    <div>
      <H1>Connections &amp; Webhooks</H1>
      <P>{t.intro}</P>

      <H2>{t.schemaH2}</H2>
      <P>{t.schemaP}</P>
      <CodeBlock lang="python" title="server/domain/models.py" code={`@dataclass(frozen=True, slots=True)\nclass Connection:\n    id: str\n    platform: str\n    name: str\n    config: dict[str, Any]\n    created_at: datetime\n    description: str = ""\n    enabled: bool = True\n    kind: str = "outbound"      # "inbound_webhook" | "outbound"\n    company_id: str = ""        # "" = global/account-scoped\n    owner_id: str = "default"\n    routing_department_id: str = ""\n    routing_staff_ids: list[str] = field(default_factory=list)`} />

      <H2>{t.twoKindsH2}</H2>
      <P><InlineCode>kind="inbound_webhook"</InlineCode> — {t.inboundP}</P>
      <P><InlineCode>kind="outbound"</InlineCode> — {t.outboundP}</P>

      <H2>{t.routingH2}</H2>
      <P>{t.routingP} <InlineCode>routing_department_id</InlineCode> / <InlineCode>routing_staff_ids</InlineCode>.</P>

      <H2>{t.walkthroughH2}</H2>
      <P>{t.walkthroughP}</P>
      <OL>
        {t.walkthroughSteps.map(({ h, d }, i) => (
          <OLI key={h} n={i + 1}><strong>{h}</strong> {d}</OLI>
        ))}
      </OL>
      <Callout type="info">{t.platformsP}</Callout>

      <H2>{t.restH2}</H2>
      <div className="rounded-xl border border-border/60 overflow-hidden my-4 divide-y divide-border/40">
        <ApiRow method="GET" path="/api/v1/connections" desc="List connections" />
        <ApiRow method="POST" path="/api/v1/connections" desc="Create or update a connection (id in body = update)" />
        <ApiRow method="DELETE" path="/api/v1/connections/:id" desc="Delete connection" />
      </div>
      <CodeBlock lang="bash" title="Register an outbound connection" code={`curl -X POST http://localhost:8000/api/v1/connections \\\n  -H "Content-Type: application/json" \\\n  -d '{\n    "platform": "slack",\n    "name": "#support channel",\n    "kind": "outbound",\n    "config": {"webhook_url": "https://hooks.slack.com/..."},\n    "company_id": "company_abc"\n  }'`} />

      <H2>{t.nextH2}</H2>
      <NextSteps>
        <NextStepCard id="companies" onNavigate={onNavigate} title="Companies" desc={t.nextCompanies} />
        <NextStepCard id="skills" onNavigate={onNavigate} title="Skills" desc={t.nextSkills} />
      </NextSteps>
    </div>
  );
}
