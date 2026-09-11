import { H1, H2, P, OL, OLI, Callout, CodeBlock, NextSteps, NextStepCard, type DocPageProps } from "./_shared";

const TXT = {
  en: {
    intro: "Skills are the tools a Staff member can call during a run — everything from web search to a spreadsheet write to a function you wrote yourself. There are exactly two kinds: built-in integration skills, and fully custom JavaScript skills. This guide adds one of each, then explains the OAuth step that trips people up the first time.",

    builtinH2: "Path A: a built-in integration skill",
    builtinSteps: [
      "Open Skills and click New Skill.",
      "Set kind to integration and tool_name to one of the built-in tools — web_search, sheet, drive, browser_use, slack, and so on. tool_name is what actually wires this Skill to real code on the backend; name and description are just how it shows up in the UI.",
      "Fill in config with whatever that tool needs (an API key, a channel id, credentials — varies per tool_name).",
      "Save, then attach it to a Staff member from the Staff Builder. This step is easy to forget: a Skill sitting unattached in the Skills list does nothing — it only takes effect once its id is in a staff's skill_ids.",
    ],
    exampleP: "For our Research Team's web-research worker, that looks like:",

    oauthH2: "Why some integrations need OAuth first",
    oauthP: "A Skill's config dict can hold a static credential (an API key you paste in) or point at a live third-party account connection (Google Sheets, Drive, Calendar). The second kind can't work from just a config value — the platform needs a real, user-consented OAuth session with that account before any Staff can read or write to it on your behalf. That's a separate handshake from creating the Skill itself:",
    oauthSteps: [
      "Kick off the flow with POST /api/v1/auth/oauth/start, which returns a URL you visit to grant access.",
      "Poll GET /api/v1/auth/oauth/status until the connection shows as authorized.",
      "Only then attach the Skill to a Staff member — attaching it earlier just means the Staff's tool calls will fail with an auth error at run time instead of failing loudly up front.",
    ],
    oauthCallout: "If a Staff member's tool calls are silently failing on a Skill that looks correctly configured, this is the first thing to check — an unauthorized third-party connection is a much more common cause than a bad tool_name.",

    customH2: "Path B: a custom-js skill",
    customP1: "For anything the built-in tools don't cover, set kind to custom-js and write a run(input) function instead of picking a tool_name. This is a real escape hatch, not a toy — it's plain JavaScript, and it's how you'd wire in company-specific logic (a scoring formula, a lookup against a fixed internal list, format conversion) that doesn't warrant a full third-party integration.",
    customP2: "Where it executes matters: custom-js code never runs on the API host directly. It runs inside the sandbox — a local subprocess in development, or a dedicated Kubernetes pod in production, selected by sandbox.mode in config.yml — the same isolation boundary that bounds subagent-issued shell commands.",

    nextH2: "Next",
    nextSkillsConcept: "The full Skill schema and the 50+ toolkit categories available out of the box.",
  },
  vi: {
    intro: "Skills là các công cụ mà một Staff có thể gọi khi chạy — từ tìm kiếm web đến ghi vào spreadsheet đến một hàm bạn tự viết. Chỉ có đúng hai loại: skill tích hợp sẵn (built-in) và skill JavaScript tùy chỉnh hoàn toàn. Hướng dẫn này thêm mỗi loại một cái, rồi giải thích bước OAuth thường khiến người mới bối rối.",

    builtinH2: "Cách A: một skill tích hợp sẵn",
    builtinSteps: [
      "Mở Skills và bấm New Skill.",
      "Đặt kind là integration và tool_name là một trong các công cụ có sẵn — web_search, sheet, drive, browser_use, slack, v.v. tool_name là thứ thực sự nối Skill này với code thật ở backend; name và description chỉ là cách nó hiển thị trên UI.",
      "Điền config với những gì công cụ đó cần (API key, channel id, credentials — tùy tool_name).",
      "Lưu, rồi gắn nó cho một Staff từ Staff Builder. Bước này dễ bị quên: một Skill nằm trong danh sách Skills mà chưa được gắn thì không làm gì cả — nó chỉ có tác dụng khi id của nó nằm trong skill_ids của một staff.",
    ],
    exampleP: "Với worker nghiên cứu web của Research Team, sẽ giống thế này:",

    oauthH2: "Vì sao một số tích hợp cần OAuth trước",
    oauthP: "config của một Skill có thể chứa một credential tĩnh (API key bạn dán vào) hoặc trỏ tới một kết nối tài khoản bên thứ ba đang hoạt động (Google Sheets, Drive, Calendar). Loại thứ hai không thể hoạt động chỉ từ một giá trị config — nền tảng cần một phiên OAuth thật, có sự đồng ý của người dùng, với tài khoản đó trước khi bất kỳ Staff nào có thể đọc/ghi thay mặt bạn. Đây là một bước bắt tay riêng, tách biệt với việc tạo Skill:",
    oauthSteps: [
      "Bắt đầu luồng bằng POST /api/v1/auth/oauth/start, trả về một URL bạn truy cập để cấp quyền.",
      "Kiểm tra GET /api/v1/auth/oauth/status cho đến khi kết nối hiện trạng thái đã được cấp quyền.",
      "Chỉ khi đó mới gắn Skill cho một Staff — gắn sớm hơn chỉ khiến các lệnh gọi công cụ của Staff thất bại với lỗi xác thực lúc chạy thay vì báo lỗi rõ ràng ngay từ đầu.",
    ],
    oauthCallout: "Nếu các lệnh gọi công cụ của một Staff âm thầm thất bại trên một Skill trông có vẻ cấu hình đúng, đây là điều đầu tiên cần kiểm tra — một kết nối bên thứ ba chưa được cấp quyền là nguyên nhân phổ biến hơn nhiều so với một tool_name sai.",

    customH2: "Cách B: một skill custom-js",
    customP1: "Với những gì công cụ có sẵn chưa đáp ứng, đặt kind là custom-js và viết một hàm run(input) thay vì chọn tool_name. Đây là một lối thoát thực sự, không phải đồ chơi — đó là JavaScript thuần, và là cách bạn đưa vào logic riêng của công ty (một công thức chấm điểm, tra cứu trong một danh sách nội bộ cố định, chuyển đổi định dạng) mà không đáng để xây một tích hợp bên thứ ba đầy đủ.",
    customP2: "Nơi nó thực thi rất quan trọng: code custom-js không bao giờ chạy trực tiếp trên host API. Nó chạy bên trong sandbox — một subprocess cục bộ khi phát triển, hoặc một pod Kubernetes riêng khi production, được chọn bởi sandbox.mode trong config.yml — cùng ranh giới cô lập giới hạn các lệnh shell do subagent phát ra.",

    nextH2: "Tiếp theo",
    nextSkillsConcept: "Toàn bộ schema của Skill và hơn 50 nhóm toolkit có sẵn ngay từ đầu.",
  },
  zh: {
    intro: "Skills 是 Staff 在运行期间可以调用的工具——从网页搜索到写入表格，再到您自己编写的函数。恰好只有两种：内置集成技能，以及完全自定义的 JavaScript 技能。本指南各添加一个，然后解释新手第一次容易被绊倒的 OAuth 步骤。",

    builtinH2: "路径 A：内置集成技能",
    builtinSteps: [
      "打开 Skills 并点击 New Skill。",
      "将 kind 设为 integration，tool_name 设为内置工具之一——web_search、sheet、drive、browser_use、slack 等。tool_name 是真正将该 Skill 与后端实际代码连接起来的字段；name 和 description 只是它在界面上的展示方式。",
      "在 config 中填入该工具所需的内容（API key、频道 id、凭据——因 tool_name 而异）。",
      "保存后，在 Staff Builder 中将其绑定到某位员工。这一步很容易被忘记：一个未被绑定、只是静静躺在 Skills 列表中的 Skill 什么都不会做——只有当它的 id 出现在某个员工的 skill_ids 中时才会生效。",
    ],
    exampleP: "对我们 Research Team 负责网页调研的 worker 来说，配置如下：",

    oauthH2: "为什么某些集成需要先完成 OAuth",
    oauthP: "Skill 的 config 字典可以存放静态凭据（您粘贴进去的 API key），也可以指向一个实时的第三方账号连接（Google Sheets、Drive、Calendar）。第二种情况仅凭一个 config 值是无法工作的——平台需要与该账号建立一个真实的、经用户同意的 OAuth 会话，之后任何 Staff 才能代表您读写。这是与创建 Skill 本身分开的一次握手：",
    oauthSteps: [
      "通过 POST /api/v1/auth/oauth/start 发起流程，它会返回一个供您访问以授权的 URL。",
      "轮询 GET /api/v1/auth/oauth/status，直到连接显示为已授权。",
      "只有到那时才将该 Skill 绑定给员工——过早绑定只会导致员工的工具调用在运行时因鉴权错误而失败，而不是提前明确报错。",
    ],
    oauthCallout: "如果某个看起来配置正确的 Skill 上，员工的工具调用悄悄失败，这是首先要检查的地方——未授权的第三方连接远比 tool_name 写错更常见。",

    customH2: "路径 B：custom-js 技能",
    customP1: "对于内置工具无法覆盖的场景，将 kind 设为 custom-js 并编写一个 run(input) 函数，而不是选择 tool_name。这是一个真正的逃生口，不是玩具——它就是纯粹的 JavaScript，也是您接入公司特有逻辑（评分公式、对固定内部列表的查找、格式转换）的方式，这类逻辑不值得建一套完整的第三方集成。",
    customP2: "它在哪里执行很关键：custom-js 代码从不直接在 API 主机上运行。它在沙箱内执行——开发环境是本地子进程，生产环境是专用的 Kubernetes Pod，由 config.yml 中的 sandbox.mode 决定——与限制子智能体发出的 shell 命令的隔离边界相同。",

    nextH2: "下一步",
    nextSkillsConcept: "完整的 Skill 数据结构，以及开箱即用的 50 多个工具包分类。",
  },
  ja: {
    intro: "Skills は Staff が実行中に呼び出せるツールです——ウェブ検索からスプレッドシートへの書き込み、自分で書いた関数まで。種類はちょうど 2 つ：組み込みの統合スキルと、完全カスタムの JavaScript スキルです。このガイドではそれぞれ 1 つずつ追加し、初めてつまずきやすい OAuth のステップを説明します。",

    builtinH2: "パス A：組み込み統合スキル",
    builtinSteps: [
      "Skills を開き、New Skill をクリックします。",
      "kind を integration に、tool_name を組み込みツールのいずれかに設定します——web_search、sheet、drive、browser_use、slack など。tool_name は実際にこの Skill をバックエンドの実コードに結びつけるものです。name と description は UI 上の表示のためだけのものです。",
      "config にそのツールが必要とする内容（API キー、チャンネル id、認証情報——tool_name により異なる）を入力します。",
      "保存後、Staff Builder でスタッフに紐づけます。このステップは忘れやすい：Skills 一覧に紐づけられずに存在するだけの Skill は何もしません——スタッフの skill_ids にその id が入って初めて有効になります。",
    ],
    exampleP: "今回の Research Team のウェブ調査担当 worker では、次のようになります：",

    oauthH2: "一部の連携が先に OAuth を必要とする理由",
    oauthP: "Skill の config 辞書には、静的な認証情報（貼り付けた API キー）を入れることも、稼働中のサードパーティアカウント接続（Google Sheets、Drive、Calendar）を指すこともできます。後者は config の値だけでは動作しません——どの Staff もそのアカウントに代わって読み書きする前に、そのアカウントとの実際のユーザー同意済み OAuth セッションが必要です。これは Skill 自体の作成とは別のハンドシェイクです：",
    oauthSteps: [
      "POST /api/v1/auth/oauth/start でフローを開始します。アクセス許可のために訪問する URL が返されます。",
      "GET /api/v1/auth/oauth/status をポーリングし、接続が認可済みと表示されるまで待ちます。",
      "その後で初めて Skill をスタッフに紐づけます——早く紐づけても、スタッフのツール呼び出しが実行時に認証エラーで失敗するだけで、事前に明確なエラーにはなりません。",
    ],
    oauthCallout: "正しく設定されているように見える Skill でスタッフのツール呼び出しが静かに失敗している場合、まずここを確認してください——tool_name の誤りよりも、未認可のサードパーティ接続の方がはるかによくある原因です。",

    customH2: "パス B：custom-js スキル",
    customP1: "組み込みツールでカバーできない用途では、tool_name を選ぶ代わりに kind を custom-js に設定し、run(input) 関数を書きます。これはおもちゃではなく本物の抜け道です——純粋な JavaScript であり、フルのサードパーティ連携を組むほどでもない、会社固有のロジック（スコアリング式、固定の社内リストに対する照合、フォーマット変換）を組み込む方法です。",
    customP2: "どこで実行されるかが重要です：custom-js コードは API ホスト上で直接実行されることは決してありません。サンドボックス内で実行されます——開発環境ではローカルサブプロセス、本番環境では専用の Kubernetes Pod で、config.yml の sandbox.mode によって選択されます。サブエージェントが発行する shell コマンドを制限するのと同じ隔離境界です。",

    nextH2: "次に読む",
    nextSkillsConcept: "Skill の完全なスキーマと、標準搭載の 50 以上のツールキットカテゴリ。",
  },
} as const;

export default function GuideSkillsDoc({ lang, onNavigate }: DocPageProps) {
  const t = TXT[lang];
  return (
    <div>
      <H1>Add Skills & APIs</H1>
      <P>{t.intro}</P>

      <H2>{t.builtinH2}</H2>
      <OL>
        {t.builtinSteps.map((s, i) => <OLI key={i} n={i + 1}>{s}</OLI>)}
      </OL>
      <P>{t.exampleP}</P>
      <CodeBlock lang="json" title="POST /api/v1/skills" code={`{\n  "name": "Web Search",\n  "description": "Search the web and return summarized results.",\n  "kind": "integration",\n  "tool_name": "web_search",\n  "third_party": "",\n  "config": {}\n}`} />

      <H2>{t.oauthH2}</H2>
      <P>{t.oauthP}</P>
      <OL>
        {t.oauthSteps.map((s, i) => <OLI key={i} n={i + 1}>{s}</OLI>)}
      </OL>
      <Callout type="warning">{t.oauthCallout}</Callout>

      <H2>{t.customH2}</H2>
      <P>{t.customP1}</P>
      <P>{t.customP2}</P>
      <CodeBlock lang="javascript" title="custom-js skill" code={`function run(input) {\n  const data = JSON.parse(input);\n  return data\n    .filter(item => item.score > 0.8)\n    .map(item => item.name)\n    .join("\\n");\n}`} />

      <H2>{t.nextH2}</H2>
      <NextSteps>
        <NextStepCard id="skills" onNavigate={onNavigate} title="Skills" desc={t.nextSkillsConcept} />
      </NextSteps>
    </div>
  );
}
