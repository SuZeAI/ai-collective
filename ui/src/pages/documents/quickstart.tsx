import { H1, H2, P, Callout, CodeBlock, DocLink, NextSteps, NextStepCard, type DocPageProps } from "./_shared";

const TXT = {
  en: {
    intro1: "This is the fastest path to a running instance: no Docker, no external infrastructure, nothing to provision. The local backend defaults to a JSON storage backend, an in-memory task queue, and a threading lock, so the only external dependencies you actually need are Python, Node, and one LLM provider key.",
    intro2: "That default stack is a deliberate tradeoff, not a limitation you'll immediately outgrow — it's the same code path that runs in production, just pointed at simpler backends. When you're ready for something that survives a restart or scales past a single process, you flip three lines in config.yml rather than changing any application code — see ",
    introConfigLink: "Configuration",
    intro3: " for that.",

    step1H2: "1. Clone the repo",
    step1P: "Nothing unusual here — the backend (server/) and frontend (ui/) live in the same repository.",

    step2H2: "2. Install backend dependencies",
    step2P: "uv sync --all-extras resolves and installs everything in pyproject.toml, including the optional extras (provider SDKs for LangChain/LangGraph, the spaCy model for static knowledge-graph extraction, etc). Plain uv sync would skip those extras and you'd hit import errors the first time a code path needs one.",

    step3H2: "3. Install frontend dependencies",
    step3P: "npm ci rather than npm install: it installs exactly what's in package-lock.json instead of re-resolving the dependency tree, which is both faster and reproducible — the same lockfile that's committed is what CI builds against.",

    step4H2: "4. Configure a provider key",
    step4P: "Copy the env template, then fill in at least one provider key referenced by config.yml's models: list — GOOGLE_API_KEY is the one the shipped config.yml already wires up to an enabled: true entry, so it's the path of least resistance for a first run. Anthropic, OpenAI, and OpenRouter keys work too, but you'd need to flip enabled: true onto that provider's entry in config.yml yourself.",
    step4Callout: "If the app boots but no Staff ever produces a response, this is almost always the cause: either no key is set for the model that has enabled: true, or the key is set but that model's enabled flag is still false. Check both.",

    step5H2: "5. Start the backend",
    step5P: "This runs on :8000 with --reload, so editing anything under server/ restarts the process automatically. It boots with the in-memory task queue and threading lock — no separate worker process to start.",

    step6H2: "6. Start the frontend",
    step6P: "Vite's dev server on :8080, with hot module replacement — most UI edits show up without a full page reload. It talks to the backend over a same-origin /api/v1 by default; for this split local setup you don't need to change anything since Vite proxies it, but see the frontend .env note in Configuration if you ever run frontend and backend on genuinely different hosts.",

    doneH2: "What you'll have running",
    doneP1: "Two processes talking to each other: the React app at http://localhost:8080, and the FastAPI backend at http://localhost:8000, with interactive API docs at http://localhost:8000/docs. The first thing worth doing once both are up is opening the AI Office Designer and describing a company in a sentence or two — that exercises the whole stack (LLM call, company/department/staff creation, persistence) in one action, which is a faster sanity check than clicking through individual pages.",

    tip: "No Redis or RabbitMQ needed for this path — storage.backend defaults to json, task_queue.backend to memory, and lock.backend to threading. Those are real production-capable defaults for a single-process deployment, not just a dev convenience.",

    nextH2: "Next",
    nextInstall: "Version requirements and what each dependency actually installs.",
    nextConfig: "The full config.yml model — providers, storage, queue, lock, sandbox.",
    nextGuide: "Create your first Staff member once the app is running.",
  },
  vi: {
    intro1: "Đây là con đường nhanh nhất để có một instance chạy được: không Docker, không hạ tầng ngoài, không có gì cần provision. Backend cục bộ mặc định dùng storage backend JSON, hàng đợi tác vụ in-memory, và khóa (lock) kiểu threading, nên các phụ thuộc bên ngoài thực sự cần chỉ là Python, Node, và một khóa API của nhà cung cấp LLM.",
    intro2: "Stack mặc định đó là một đánh đổi có chủ đích, không phải một giới hạn mà bạn sẽ vượt qua ngay lập tức — đó chính là đường code chạy trong production, chỉ là trỏ tới các backend đơn giản hơn. Khi sẵn sàng cho thứ gì đó sống sót qua một lần restart hoặc mở rộng vượt quá một process đơn, bạn chỉ cần đổi ba dòng trong config.yml thay vì sửa bất kỳ code ứng dụng nào — xem ",
    introConfigLink: "Configuration",
    intro3: " để biết chi tiết.",

    step1H2: "1. Clone repo",
    step1P: "Không có gì đặc biệt ở đây — backend (server/) và frontend (ui/) nằm trong cùng một repository.",

    step2H2: "2. Cài dependency cho backend",
    step2P: "uv sync --all-extras resolve và cài mọi thứ trong pyproject.toml, bao gồm cả các extra tùy chọn (SDK nhà cung cấp cho LangChain/LangGraph, model spaCy cho trích xuất knowledge graph kiểu static, v.v). Chỉ chạy uv sync suông sẽ bỏ qua các extra đó và bạn sẽ gặp lỗi import ngay lần đầu một đường code nào đó cần tới chúng.",

    step3H2: "3. Cài dependency cho frontend",
    step3P: "npm ci thay vì npm install: nó cài đúng những gì có trong package-lock.json thay vì resolve lại cây dependency, vừa nhanh hơn vừa đảm bảo tái lập được — chính lockfile đã commit là thứ CI dùng để build.",

    step4H2: "4. Cấu hình khóa API nhà cung cấp",
    step4P: "Sao chép file env mẫu, sau đó điền ít nhất một khóa API được tham chiếu trong danh sách models: của config.yml — GOOGLE_API_KEY là khóa mà config.yml mặc định đã nối sẵn vào một entry có enabled: true, nên đây là con đường ít trở ngại nhất cho lần chạy đầu tiên. Khóa Anthropic, OpenAI, OpenRouter cũng dùng được, nhưng bạn cần tự bật enabled: true cho entry của nhà cung cấp đó trong config.yml.",
    step4Callout: "Nếu app khởi động được nhưng không Staff nào tạo ra phản hồi, đây gần như luôn là nguyên nhân: hoặc không có khóa nào được đặt cho model đang có enabled: true, hoặc khóa đã đặt nhưng cờ enabled của model đó vẫn là false. Kiểm tra cả hai.",

    step5H2: "5. Chạy backend",
    step5P: "Chạy trên cổng :8000 với --reload, nên chỉnh sửa bất cứ gì trong server/ sẽ tự động restart process. Nó khởi động với hàng đợi tác vụ in-memory và khóa threading — không cần chạy riêng một worker process nào.",

    step6H2: "6. Chạy frontend",
    step6P: "Dev server của Vite trên cổng :8080, với hot module replacement — hầu hết chỉnh sửa UI hiện ra mà không cần reload lại toàn trang. Nó giao tiếp với backend qua /api/v1 cùng-origin theo mặc định; với thiết lập cục bộ tách rời này bạn không cần đổi gì vì Vite đã proxy sẵn, nhưng xem ghi chú .env cho frontend trong Configuration nếu bạn từng chạy frontend và backend trên các host thực sự khác nhau.",

    doneH2: "Bạn sẽ có gì đang chạy",
    doneP1: "Hai process nói chuyện với nhau: app React tại http://localhost:8080, và backend FastAPI tại http://localhost:8000, với tài liệu API tương tác tại http://localhost:8000/docs. Việc đáng làm đầu tiên khi cả hai đã lên là mở AI Office Designer và mô tả một công ty trong một hai câu — thao tác đó chạm vào toàn bộ stack (gọi LLM, tạo company/department/staff, lưu trữ) chỉ trong một hành động, là một cách kiểm tra nhanh hơn nhiều so với việc click qua từng trang riêng lẻ.",

    tip: "Không cần Redis hay RabbitMQ cho đường dẫn này — storage.backend mặc định là json, task_queue.backend là memory, và lock.backend là threading. Đó là những mặc định thực sự dùng được cho production với một deployment một-process, không chỉ là tiện lợi cho dev.",

    nextH2: "Tiếp theo",
    nextInstall: "Yêu cầu phiên bản và mỗi dependency thực sự cài những gì.",
    nextConfig: "Toàn bộ mô hình config.yml — provider, storage, queue, lock, sandbox.",
    nextGuide: "Tạo Staff đầu tiên của bạn khi app đã chạy.",
  },
  zh: {
    intro1: "这是让实例跑起来的最快路径：无需 Docker，无需外部基础设施，无需预先配置任何东西。本地后端默认使用 JSON 存储后端、内存任务队列和线程锁，因此您实际需要的外部依赖只有 Python、Node，以及一个 LLM 提供商密钥。",
    intro2: "这套默认技术栈是刻意的权衡，而不是您很快就会用完的临时方案——它正是生产环境所使用的同一套代码路径，只是指向更简单的后端。当您准备好需要在重启后仍然存活、或需要扩展到单进程之外的方案时，只需在 config.yml 中改三行，无需改动任何应用代码——详见",
    introConfigLink: "Configuration",
    intro3: "。",

    step1H2: "1. 克隆仓库",
    step1P: "这里没有什么特别的——后端（server/）和前端（ui/）位于同一个仓库中。",

    step2H2: "2. 安装后端依赖",
    step2P: "uv sync --all-extras 会解析并安装 pyproject.toml 中的一切，包括可选的 extras（LangChain/LangGraph 的提供商 SDK、用于静态知识图谱抽取的 spaCy 模型等）。仅运行 uv sync 会跳过这些 extras，一旦某条代码路径需要它们，您就会立刻遇到导入错误。",

    step3H2: "3. 安装前端依赖",
    step3P: "使用 npm ci 而非 npm install：它会精确安装 package-lock.json 中的内容，而不是重新解析依赖树，这样既更快也更可复现——已提交的 lockfile 正是 CI 构建所依赖的那一份。",

    step4H2: "4. 配置提供商密钥",
    step4P: "复制环境变量模板，然后填入 config.yml 的 models: 列表中引用的至少一个提供商密钥——GOOGLE_API_KEY 是随附 config.yml 已经默认接好、且对应条目 enabled: true 的那一个，因此是首次运行阻力最小的路径。Anthropic、OpenAI、OpenRouter 的密钥同样可用，但您需要自己在 config.yml 中把对应提供商条目的 enabled 打开为 true。",
    step4Callout: "如果应用能启动，但没有任何 Staff 产生响应，几乎总是这个原因：要么 enabled: true 的那个模型没有配置密钥，要么密钥已配置但该模型的 enabled 仍为 false。两者都要检查。",

    step5H2: "5. 启动后端",
    step5P: "在 :8000 端口以 --reload 方式运行，因此修改 server/ 下的任何内容都会自动重启进程。它以内存任务队列和线程锁启动——无需单独启动 worker 进程。",

    step6H2: "6. 启动前端",
    step6P: "Vite 的开发服务器运行在 :8080，支持热模块替换——大多数 UI 修改无需整页刷新即可生效。默认情况下它通过同源的 /api/v1 与后端通信；对于这种本地分离式设置，您不需要改动任何东西，因为 Vite 已经做了代理，但如果前后端确实运行在不同主机上，请参阅 Configuration 中关于前端 .env 的说明。",

    doneH2: "启动后您会得到什么",
    doneP1: "两个相互通信的进程：位于 http://localhost:8080 的 React 应用，以及位于 http://localhost:8000 的 FastAPI 后端，交互式 API 文档在 http://localhost:8000/docs。两者都启动后，最值得先做的事是打开 AI Office Designer，用一两句话描述一家公司——这一个动作会串起整条链路（LLM 调用、公司/部门/员工创建、持久化），比逐页点击更快地验证整个系统是否正常。",

    tip: "此路径无需 Redis 或 RabbitMQ —— storage.backend 默认是 json，task_queue.backend 默认是 memory，lock.backend 默认是 threading。这些是真正可用于单进程生产部署的默认值，而不仅仅是开发时的便利选项。",

    nextH2: "下一步",
    nextInstall: "版本要求，以及每个依赖实际安装了什么。",
    nextConfig: "完整的 config.yml 模型——提供商、存储、队列、锁、沙箱。",
    nextGuide: "应用运行起来后，创建您的第一个员工。",
  },
  ja: {
    intro1: "これはインスタンスを最速で立ち上げる方法です。Docker も外部インフラも不要で、事前にプロビジョニングするものもありません。ローカルバックエンドはデフォルトで JSON ストレージバックエンド、インメモリタスクキュー、スレッドロックを使うため、実際に必要な外部依存は Python、Node、そして 1 つの LLM プロバイダーキーだけです。",
    intro2: "このデフォルト構成はすぐに卒業するような制約ではなく、意図的なトレードオフです——本番環境で動くのと同じコードパスであり、単により単純なバックエンドを指しているだけです。再起動しても消えないもの、単一プロセスを超えてスケールするものが必要になったら、アプリケーションコードを一切変更せず config.yml の 3 行を切り替えるだけです。詳細は",
    introConfigLink: "Configuration",
    intro3: " を参照してください。",

    step1H2: "1. リポジトリをクローン",
    step1P: "特に変わったことはありません — バックエンド（server/）とフロントエンド（ui/）は同じリポジトリに存在します。",

    step2H2: "2. バックエンドの依存関係をインストール",
    step2P: "uv sync --all-extras は pyproject.toml のすべて（LangChain/LangGraph のプロバイダー SDK、静的なナレッジグラフ抽出用の spaCy モデルなど、オプションの extras を含む）を解決してインストールします。単なる uv sync ではこれらの extras がスキップされ、あるコードパスがそれらを必要とした瞬間にインポートエラーになります。",

    step3H2: "3. フロントエンドの依存関係をインストール",
    step3P: "npm install ではなく npm ci を使います。依存ツリーを再解決するのではなく package-lock.json の内容をそのままインストールするため、より高速で再現性があります — コミットされているのと同じロックファイルを CI もビルドに使います。",

    step4H2: "4. プロバイダーキーを設定",
    step4P: "env テンプレートをコピーし、config.yml の models: リストが参照するプロバイダーキーを少なくとも 1 つ入力します。GOOGLE_API_KEY は同梱の config.yml がすでに enabled: true のエントリに紐づけているキーなので、初回実行では最も抵抗の少ない経路です。Anthropic、OpenAI、OpenRouter のキーも使えますが、その場合は config.yml 内の該当プロバイダーのエントリの enabled を自分で true にする必要があります。",
    step4Callout: "アプリは起動するのにどの Staff も応答を生成しない場合、ほぼ常にこれが原因です。enabled: true になっているモデルにキーが設定されていないか、キーは設定されているもののそのモデルの enabled フラグがまだ false のどちらかです。両方を確認してください。",

    step5H2: "5. バックエンドを起動",
    step5P: "--reload 付きで :8000 で動作するため、server/ 配下を編集するとプロセスが自動的に再起動します。インメモリタスクキューとスレッドロックで起動するため、別途 worker プロセスを立ち上げる必要はありません。",

    step6H2: "6. フロントエンドを起動",
    step6P: "Vite の開発サーバーが :8080 で動作し、ホットモジュールリプレースメントに対応しています — ほとんどの UI 編集はページ全体のリロードなしで反映されます。デフォルトでは同一オリジンの /api/v1 経由でバックエンドと通信します。このようにローカルで分離したセットアップでは Vite がプロキシしてくれるため何も変更する必要はありませんが、フロントエンドとバックエンドを本当に異なるホストで動かす場合は Configuration のフロントエンド .env に関する注記を参照してください。",

    doneH2: "起動後の状態",
    doneP1: "互いに通信する 2 つのプロセス：http://localhost:8080 の React アプリと、http://localhost:8000 の FastAPI バックエンド（インタラクティブな API ドキュメントは http://localhost:8000/docs）。両方が起動したら最初にやる価値があるのは、AI Office Designer を開いて会社を一文か二文で説明することです — この 1 つの操作でスタック全体（LLM 呼び出し、company/department/staff の作成、永続化）を通しで確認でき、個々のページをクリックして回るより速い健全性チェックになります。",

    tip: "このパスでは Redis や RabbitMQ は不要です —— storage.backend はデフォルトで json、task_queue.backend は memory、lock.backend は threading です。これらは単なる開発の便宜ではなく、単一プロセスのデプロイに対して実際に本番運用可能なデフォルト値です。",

    nextH2: "次に読む",
    nextInstall: "バージョン要件と、各依存関係が実際に何をインストールするか。",
    nextConfig: "config.yml の完全なモデル — プロバイダー、ストレージ、キュー、ロック、サンドボックス。",
    nextGuide: "アプリが起動したら最初のスタッフを作成する。",
  },
} as const;

export default function QuickstartDoc({ lang, onNavigate }: DocPageProps) {
  const t = TXT[lang];
  return (
    <div>
      <H1>Quick Start</H1>
      <P>
        {t.intro1}
      </P>
      <P>
        {t.intro2}
        <DocLink id="configuration" onNavigate={onNavigate}>{t.introConfigLink}</DocLink>
        {t.intro3}
      </P>

      <H2>{t.step1H2}</H2>
      <P>{t.step1P}</P>
      <CodeBlock lang="bash" code={`git clone https://github.com/SuZeAI/ai-collective.git\ncd ai-collective`} />

      <H2>{t.step2H2}</H2>
      <P>{t.step2P}</P>
      <CodeBlock lang="bash" code={`uv sync --all-extras`} />

      <H2>{t.step3H2}</H2>
      <P>{t.step3P}</P>
      <CodeBlock lang="bash" code={`npm --prefix ui ci`} />

      <H2>{t.step4H2}</H2>
      <P>{t.step4P}</P>
      <CodeBlock lang="bash" code={`cp .env.template .env`} />
      <CodeBlock lang="bash" title=".env" code={`GOOGLE_API_KEY=...`} />
      <Callout type="warning">{t.step4Callout}</Callout>

      <H2>{t.step5H2}</H2>
      <P>{t.step5P}</P>
      <CodeBlock lang="bash" title="Terminal 1" code={`uv run uvicorn server.api.main:app --reload --port 8000`} />

      <H2>{t.step6H2}</H2>
      <P>{t.step6P}</P>
      <CodeBlock lang="bash" title="Terminal 2" code={`npm --prefix ui run dev -- --host 0.0.0.0 --port 8080`} />

      <H2>{t.doneH2}</H2>
      <P>{t.doneP1}</P>
      <Callout type="tip">{t.tip}</Callout>

      <H2>{t.nextH2}</H2>
      <NextSteps>
        <NextStepCard id="installation" onNavigate={onNavigate} title="Installation" desc={t.nextInstall} />
        <NextStepCard id="configuration" onNavigate={onNavigate} title="Configuration" desc={t.nextConfig} />
        <NextStepCard id="guide-first-staff" onNavigate={onNavigate} title={lang === "vi" ? "Hướng dẫn" : lang === "zh" ? "指南" : lang === "ja" ? "ガイド" : "Guide"} desc={t.nextGuide} />
      </NextSteps>
    </div>
  );
}
