import { H1, H2, P, InlineCode, Callout, NextSteps, NextStepCard, type DocPageProps } from "./_shared";

const TXT = {
  en: {
    lead1: "config.yml (.config/config.yml, committed to git) is the single, complete source for every backend setting — including secrets. An environment variable only reaches the app if config.yml references it inline with ${VAR} (or ${VAR:-default}); nothing reads a bare OS/.env variable directly. .env (gitignored, seeded from .env.template) is just where those referenced secrets live locally — it has no effect on its own.",
    calloutTitle: "config.yml is the source of truth — not the environment",
    callout: "If you're used to 12-factor apps where every setting is an env var, note that AI Collective inverts this: config.yml (checked into git, safe because secrets are only $-references) is authoritative, and .env exists purely to supply the values those references resolve to. This has a practical consequence: setting an env var that config.yml doesn't reference does nothing at all, no matter how correctly named it is.",

    llmH2: "LLM provider keys",
    llmP: "Every models: entry in config.yml references one of these via api_key: $VARNAME. You only need the key matching whichever entry has enabled: true — if you're running the default Gemini setup, GOOGLE_API_KEY is the only one that actually gets read. Set an unused one and it just sits there unreferenced.",
    llmTable: [
      ["GOOGLE_API_KEY", "Yes*", "Google Gemini API key — referenced by the models: entry with provider_name: Google"],
      ["ANTHROPIC_API_KEY", "Yes*", "Anthropic Claude API key"],
      ["OPENAI_API_KEY", "Yes*", "OpenAI API key"],
      ["OPENROUTER_API_KEY", "Yes*", "OpenRouter API key"],
    ],

    backendH2: "Storage, queue, and lock secrets",
    backendP: "These three only matter if you've actually switched the corresponding backend in config.yml away from its zero-setup default (json storage, in-memory queue, threading lock). Leave the defaults alone and none of these three are read — the backend never even checks for them.",
    backendTable: [
      ["MONGO_URI", "No", "MongoDB connection URI — read only if storage.backend: mongo"],
      ["RABBITMQ_URL", "No", "RabbitMQ connection string — read only if task_queue.backend: rabbitmq"],
      ["REDIS_URL", "No", "Redis connection string — read only if lock.backend: redis"],
    ],

    authH2: "Auth secrets",
    authP: "auth.jwt_secret_key signs every session token the app issues. It ships referencing JWT_SECRET_KEY with a placeholder default so local dev works out of the box — but leaving that placeholder in production means anyone who reads your config.yml (or guesses the well-known default) can forge valid sessions. Change it before you deploy anywhere reachable by someone other than you.",
    authTable: [
      ["JWT_SECRET_KEY", "Recommended", "auth.jwt_secret_key — change this from the placeholder before deploying to production"],
      ["GOOGLE_LOGIN_CLIENT_ID / _SECRET", "No", "Google OAuth credentials — only needed if you enable google_login sign-in in config.yml's auth section"],
    ],

    footnote: "* At least one LLM provider key is required — specifically, a key matching whichever models: entry has enabled: true. This table only covers .env secrets; which storage/queue/lock/sandbox backend is active (json vs mongo, memory vs rabbitmq, threading vs redis, local vs k8s) is chosen directly in config.yml, not through an environment variable.",

    nextConfig: "The full config.yml reference — where every one of these variables gets referenced.",
    nextDocker: "Docker Compose setup, where .env gets loaded for both dev and prod stacks.",
  },
  vi: {
    lead1: "config.yml (tại .config/config.yml, được commit vào git) là nguồn duy nhất và đầy đủ cho mọi cấu hình backend — kể cả secrets. Một biến môi trường chỉ có tác dụng nếu config.yml tham chiếu nó trực tiếp bằng ${VAR} (hoặc ${VAR:-default}); không có phần nào đọc thẳng biến OS/.env. .env (bị gitignore, khởi tạo từ .env.template) chỉ là nơi lưu các giá trị secret được tham chiếu đó ở local — tự nó không có tác dụng gì.",
    calloutTitle: "config.yml mới là nguồn sự thật — không phải biến môi trường",
    callout: "Nếu bạn quen với các ứng dụng kiểu 12-factor nơi mọi cấu hình đều là biến môi trường, hãy lưu ý AI Collective làm ngược lại: config.yml (được commit vào git, an toàn vì secret chỉ là tham chiếu $) mới có thẩm quyền, còn .env chỉ tồn tại để cung cấp giá trị mà các tham chiếu đó phân giải tới. Điều này có một hệ quả thực tế: đặt một biến môi trường mà config.yml không tham chiếu tới sẽ không có tác dụng gì cả, dù bạn đặt tên đúng đến đâu.",

    llmH2: "Key của nhà cung cấp LLM",
    llmP: "Mỗi mục models: trong config.yml tham chiếu một trong các biến này qua api_key: $TÊNBIẾN. Bạn chỉ cần key khớp với mục đang có enabled: true — nếu bạn đang chạy cấu hình Gemini mặc định, GOOGLE_API_KEY là biến duy nhất thực sự được đọc. Đặt một biến không dùng đến thì nó chỉ nằm đó, không được tham chiếu.",
    llmTable: [
      ["GOOGLE_API_KEY", "Có*", "API key Google Gemini — được tham chiếu bởi mục models: có provider_name: Google"],
      ["ANTHROPIC_API_KEY", "Có*", "API key Anthropic Claude"],
      ["OPENAI_API_KEY", "Có*", "API key OpenAI"],
      ["OPENROUTER_API_KEY", "Có*", "API key OpenRouter"],
    ],

    backendH2: "Secret cho storage, queue, và lock",
    backendP: "Ba biến này chỉ quan trọng nếu bạn thực sự đã chuyển backend tương ứng trong config.yml khỏi giá trị mặc định không cần cài đặt gì (storage json, queue in-memory, lock threading). Giữ nguyên mặc định thì không biến nào trong ba biến này được đọc — backend thậm chí không kiểm tra tới chúng.",
    backendTable: [
      ["MONGO_URI", "Không", "Chuỗi kết nối MongoDB — chỉ đọc khi storage.backend: mongo"],
      ["RABBITMQ_URL", "Không", "Chuỗi kết nối RabbitMQ — chỉ đọc khi task_queue.backend: rabbitmq"],
      ["REDIS_URL", "Không", "Chuỗi kết nối Redis — chỉ đọc khi lock.backend: redis"],
    ],

    authH2: "Secret cho auth",
    authP: "auth.jwt_secret_key ký mọi session token mà ứng dụng phát hành. Nó mặc định tham chiếu JWT_SECRET_KEY với một giá trị placeholder để dev local chạy được ngay — nhưng để nguyên placeholder đó ở production nghĩa là bất kỳ ai đọc được config.yml của bạn (hoặc đoán được giá trị mặc định phổ biến) đều có thể giả mạo session hợp lệ. Hãy đổi nó trước khi triển khai ở bất kỳ đâu mà người khác ngoài bạn có thể truy cập.",
    authTable: [
      ["JWT_SECRET_KEY", "Khuyến nghị", "auth.jwt_secret_key — cần đổi khỏi giá trị placeholder trước khi triển khai production"],
      ["GOOGLE_LOGIN_CLIENT_ID / _SECRET", "Không", "Thông tin xác thực Google OAuth — chỉ cần khi bật đăng nhập google_login trong phần auth của config.yml"],
    ],

    footnote: "* Cần ít nhất một API key nhà cung cấp LLM — cụ thể là key khớp với mục models: nào đang có enabled: true. Bảng này chỉ liệt kê các secret trong .env; việc chọn backend storage/queue/lock/sandbox nào đang hoạt động (json hay mongo, memory hay rabbitmq, threading hay redis, local hay k8s) được thiết lập trực tiếp trong config.yml, không phải qua biến môi trường.",

    nextConfig: "Tham chiếu đầy đủ config.yml — nơi mỗi biến trong số này được tham chiếu tới.",
    nextDocker: "Cài đặt Docker Compose, nơi .env được nạp cho cả dev và prod stack.",
  },
  zh: {
    lead1: "config.yml（位于 .config/config.yml，纳入版本控制）是所有后端设置——包括密钥在内——唯一且完整的来源。只有当 config.yml 用 ${VAR}（或 ${VAR:-default}）内联引用某个环境变量时，该变量才会生效；没有任何部分会直接读取裸的操作系统/.env 变量。.env（已加入 .gitignore，从 .env.template 初始化）只是本地存放这些被引用密钥的地方——它本身不会产生任何效果。",
    calloutTitle: "config.yml 才是唯一可信来源——而非环境变量",
    callout: "如果您习惯于 12-factor 应用中每个设置都是环境变量的模式，请注意 AI Collective 反其道而行之：config.yml（已纳入 git，因为其中的密钥只是 $ 引用所以是安全的）具有权威性，.env 的存在仅仅是为了提供这些引用所解析出的值。这带来一个实际后果：设置一个 config.yml 并未引用的环境变量完全没有任何作用，无论命名多么正确。",

    llmH2: "LLM 提供商密钥",
    llmP: "config.yml 中每个 models: 条目都通过 api_key: $变量名 引用其中一个变量。您只需要与 enabled: true 的那个条目相匹配的密钥——如果您运行的是默认的 Gemini 配置，那么只有 GOOGLE_API_KEY 会真正被读取。设置一个未被引用的变量，它只会闲置在那里。",
    llmTable: [
      ["GOOGLE_API_KEY", "是*", "Google Gemini API 密钥——由 provider_name: Google 的 models: 条目引用"],
      ["ANTHROPIC_API_KEY", "是*", "Anthropic Claude API 密钥"],
      ["OPENAI_API_KEY", "是*", "OpenAI API 密钥"],
      ["OPENROUTER_API_KEY", "是*", "OpenRouter API 密钥"],
    ],

    backendH2: "存储、队列与锁的密钥",
    backendP: "这三个变量只有在您真正将 config.yml 中对应的后端从零配置默认值（json 存储、内存队列、threading 锁）切换出去时才重要。保持默认设置，这三个变量都不会被读取——后端甚至不会去检查它们。",
    backendTable: [
      ["MONGO_URI", "否", "MongoDB 连接 URI——仅当 storage.backend: mongo 时才会读取"],
      ["RABBITMQ_URL", "否", "RabbitMQ 连接字符串——仅当 task_queue.backend: rabbitmq 时才会读取"],
      ["REDIS_URL", "否", "Redis 连接字符串——仅当 lock.backend: redis 时才会读取"],
    ],

    authH2: "认证密钥",
    authP: "auth.jwt_secret_key 为应用签发的每个会话令牌签名。它默认引用 JWT_SECRET_KEY 并带有一个占位值，让本地开发开箱即用——但如果在生产环境中保留该占位值，意味着任何能读取您 config.yml（或猜到那个众所周知的默认值）的人都能伪造有效会话。在部署到您以外的任何人可访问的环境之前，请务必修改它。",
    authTable: [
      ["JWT_SECRET_KEY", "建议", "auth.jwt_secret_key ——部署到生产环境前务必从占位值修改"],
      ["GOOGLE_LOGIN_CLIENT_ID / _SECRET", "否", "Google OAuth 凭据——仅在 config.yml 的 auth 部分启用 google_login 登录时需要"],
    ],

    footnote: "* 至少需要一个 LLM 提供商密钥——具体来说，需与 models: 中 enabled: true 的条目相匹配。此表仅涵盖 .env 中的密钥；storage/queue/lock/sandbox 具体使用哪个后端（json 还是 mongo、memory 还是 rabbitmq、threading 还是 redis、local 还是 k8s）直接在 config.yml 中选择，而不是通过环境变量。",

    nextConfig: "完整的 config.yml 参考——这些变量分别在哪里被引用。",
    nextDocker: "Docker Compose 搭建方式，.env 在开发与生产两套栈中分别是如何加载的。",
  },
  ja: {
    lead1: "config.yml（.config/config.yml にあり、git にコミットされます）は、シークレットを含むすべてのバックエンド設定の唯一かつ完全なソースです。環境変数は、config.yml が ${VAR}（または ${VAR:-default}）でインラインに参照している場合にのみアプリに届きます。裸の OS/.env 変数を直接読み取る箇所はありません。.env（gitignore 対象、.env.template から作成）は、それらの参照先の値をローカルに置く場所にすぎず、それ単体では何の効果もありません。",
    calloutTitle: "唯一の信頼できる情報源は config.yml — 環境変数ではない",
    callout: "すべての設定が環境変数である 12-factor アプリに慣れている場合、AI Collective はこれを逆転させている点に注意してください。config.yml（シークレットは $ 参照のみなので git にコミットしても安全）が正であり、.env はその参照先の値を提供するためだけに存在します。これには実務上の帰結があります。config.yml が参照していない環境変数を設定しても、どれほど正しい名前を付けていても、まったく何も起こりません。",

    llmH2: "LLM プロバイダーキー",
    llmP: "config.yml 内の各 models: エントリは api_key: $変数名 でこれらのいずれかを参照します。必要なのは enabled: true になっているエントリに対応するキーだけです——デフォルトの Gemini 構成を使っている場合、実際に読み取られるのは GOOGLE_API_KEY だけです。使われていないキーを設定しても、参照されないままそこにあるだけです。",
    llmTable: [
      ["GOOGLE_API_KEY", "はい*", "Google Gemini API キー — provider_name: Google の models: エントリから参照される"],
      ["ANTHROPIC_API_KEY", "はい*", "Anthropic Claude API キー"],
      ["OPENAI_API_KEY", "はい*", "OpenAI API キー"],
      ["OPENROUTER_API_KEY", "はい*", "OpenRouter API キー"],
    ],

    backendH2: "storage・queue・lock のシークレット",
    backendP: "これら 3 つは、config.yml で対応するバックエンドをゼロ設定のデフォルト（json ストレージ、インメモリキュー、threading ロック）から実際に切り替えた場合にのみ意味を持ちます。デフォルトのままなら、これら 3 つはいずれも読み取られません——バックエンドはチェックすらしません。",
    backendTable: [
      ["MONGO_URI", "いいえ", "MongoDB 接続 URI — storage.backend: mongo のときのみ読み込まれる"],
      ["RABBITMQ_URL", "いいえ", "RabbitMQ 接続文字列 — task_queue.backend: rabbitmq のときのみ読み込まれる"],
      ["REDIS_URL", "いいえ", "Redis 接続文字列 — lock.backend: redis のときのみ読み込まれる"],
    ],

    authH2: "認証シークレット",
    authP: "auth.jwt_secret_key は、アプリが発行するすべてのセッショントークンに署名します。ローカル開発がすぐに動くよう、プレースホルダーのデフォルト値で JWT_SECRET_KEY を参照した状態で出荷されますが、本番環境でそのプレースホルダーを残しておくと、config.yml を読める人（あるいはよく知られたデフォルト値を推測できる人）が有効なセッションを偽造できてしまいます。自分以外の誰かがアクセスできる場所にデプロイする前に必ず変更してください。",
    authTable: [
      ["JWT_SECRET_KEY", "推奨", "auth.jwt_secret_key — 本番デプロイ前にプレースホルダーから変更すること"],
      ["GOOGLE_LOGIN_CLIENT_ID / _SECRET", "いいえ", "Google OAuth 認証情報 — config.yml の auth セクションで google_login サインインを有効化した場合のみ必要"],
    ],

    footnote: "* 少なくとも1つの LLM プロバイダーキーが必要です — 具体的には models: で enabled: true になっているエントリに対応するキーです。この表は .env のシークレットのみを扱います。storage/queue/lock/sandbox のどのバックエンドが有効か（json か mongo か、memory か rabbitmq か、threading か redis か、local か k8s か）は環境変数ではなく config.yml で直接選択します。",

    nextConfig: "完全な config.yml リファレンス — これらの変数がそれぞれどこで参照されているか。",
    nextDocker: "Docker Compose のセットアップ。開発・本番どちらのスタックでも .env はここで読み込まれます。",
  },
} as const;

function EnvTable({ rows }: { rows: readonly (readonly string[])[] }) {
  return (
    <div className="overflow-x-auto my-4">
      <table className="w-full text-sm border-collapse">
        <tbody className="divide-y divide-border/40 text-[13px]">
          {rows.map(([v, r, d]) => (
            <tr key={v}>
              <td className="py-2 pr-4 font-mono text-primary/80 whitespace-nowrap align-top">{v}</td>
              <td className="py-2 pr-4 text-muted-foreground whitespace-nowrap align-top">{r}</td>
              <td className="py-2 text-muted-foreground align-top">{d}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function DeployEnvDoc({ lang, onNavigate }: DocPageProps) {
  const t = TXT[lang];
  return (
    <div>
      <H1>Environment Variables</H1>
      <P>{t.lead1}</P>

      <Callout type="warning">
        <strong>{t.calloutTitle}</strong> — {t.callout}
      </Callout>

      <H2>{t.llmH2}</H2>
      <P>{t.llmP}</P>
      <EnvTable rows={t.llmTable} />

      <H2>{t.backendH2}</H2>
      <P>{t.backendP}</P>
      <EnvTable rows={t.backendTable} />

      <H2>{t.authH2}</H2>
      <P>{t.authP}</P>
      <EnvTable rows={t.authTable} />

      <p className="text-xs text-muted-foreground mt-2 mb-4">
        {t.footnote.split("config.yml").map((part, i, arr) => (
          <span key={i}>{part}{i < arr.length - 1 && <InlineCode>config.yml</InlineCode>}</span>
        ))}
      </p>

      <NextSteps>
        <NextStepCard id="configuration" onNavigate={onNavigate} title="Configuration" desc={t.nextConfig} />
        <NextStepCard id="deploy-docker" onNavigate={onNavigate} title="Deploying with Docker" desc={t.nextDocker} />
      </NextSteps>
    </div>
  );
}
