import { H1, H2, P, UL, LI, CodeBlock, InlineCode, NextSteps, NextStepCard, type DocPageProps } from "./_shared";

const TXT = {
  en: {
    intro: "The requirements and what each install step actually pulls in — read this if the one-liners in Quick Start work but you want to understand why, or if you're setting up a machine that doesn't already have a Python/Node toolchain.",

    reqH2: "Requirements",
    reqP: "Nothing here is exotic — this is a standard FastAPI + React stack. The version floors matter more than they might look: LangGraph's API surface moved meaningfully across 0.2.x, and Pydantic 2's validation model is a hard dependency of every API schema in server/api/schemas/.",
    tableHeaders: ["Requirement", "Minimum", "Recommended", "Why it matters"],
    rows: [
      ["Python", "3.11", "3.12+", "match/case in domain logic, modern typing (X | None) throughout models.py"],
      ["Node.js", "18.x", "20.x LTS", "Vite 6 and the frontend's tooling target this baseline"],
      ["uv", "any recent", "latest", "the only supported way to install Python deps — no requirements.txt in this repo"],
      ["RAM", "2 GB", "4 GB+", "LangGraph state + an in-memory JSON store both live in the backend process's memory"],
    ],

    pythonH2: "Python environment",
    pythonP1: "Dependencies are managed by uv from pyproject.toml, not pip and requirements.txt — uv resolves the full dependency graph once, locks it, and installs from that lock deterministically, which is both much faster than pip on a cold install and reproducible across machines.",
    pythonP2: "uv sync --all-extras is the command that matters (not plain uv sync): it pulls in the optional extras alongside the core deps — the LangChain/LangGraph provider packages, the spaCy model used by the static (non-LLM) knowledge-graph build mode, and anything else gated behind an extras group in pyproject.toml. Skip --all-extras and you'll get an ImportError the first time a code path actually needs one of those, usually well after the app has already booted.",
    pythonCode: `uv sync --all-extras`,

    nodeH2: "Frontend environment",
    nodeP1: "React 18 + TypeScript 5.8, built with Vite 6, styled with Tailwind CSS, animated with Framer Motion, built on Radix UI primitives for accessible unstyled components.",
    nodeP2: "npm ci rather than npm install here too, for the same lockfile-fidelity reason as the backend: it installs exactly what package-lock.json says, failing loudly if that file and package.json have drifted, instead of silently re-resolving and potentially installing something different from what CI tested against.",
    nodeCode: `npm --prefix ui ci`,

    infraH2: "Optional infrastructure — and when you'd actually need it",
    infraP1: "The default local setup needs none of this: storage.backend=json (an in-memory store rewritten to disk on update), task_queue.backend=memory (a ThreadPoolExecutor), lock.backend=threading. That combination is genuinely fine for a single developer, a demo, or even a small single-instance production deployment — it's not a toy mode.",
    infraP2: "You'd reach for the alternatives specifically when:",
    infraReasons: [
      "storage.backend: mongo — you need durability across process restarts beyond what JSON-on-disk gives you, or multiple backend replicas need to share state.",
      "task_queue.backend: rabbitmq — you're running more than one backend process and need task execution distributed across them, not just concurrent within one.",
      "lock.backend: redis — multiple backend processes need to coordinate mutual exclusion on the same staff-graph run, which a local threading.Lock can't do across processes.",
    ],
    infraP3: "Start the infra containers only once you're actually about to flip those config.yml values — there's no benefit to running Redis/RabbitMQ locally if the backend is still pointed at the in-memory defaults.",
    infraCode: `make infra   # redis + rabbitmq via Docker Compose\n# or:\ndocker compose -f docker/docker-compose-dev.yaml up -d redis rabbitmq`,
    infraStop: "Stop them the same way:",

    nextH2: "Next",
    nextQuickstart: "The condensed step-by-step to get something running.",
    nextConfig: "Point storage/queue/lock at the backends you just installed.",
    nextDeploy: "Run the whole stack, including Mongo/Redis/RabbitMQ, in Docker instead.",
  },
  vi: {
    intro: "Yêu cầu hệ thống và những gì mỗi bước cài đặt thực sự kéo về — đọc trang này nếu các lệnh một dòng trong Quick Start chạy được nhưng bạn muốn hiểu tại sao, hoặc nếu bạn đang thiết lập một máy chưa có sẵn toolchain Python/Node.",

    reqH2: "Yêu cầu",
    reqP: "Không có gì lạ ở đây — đây là một stack FastAPI + React tiêu chuẩn. Các mốc phiên bản tối thiểu quan trọng hơn vẻ ngoài của chúng: bề mặt API của LangGraph đã thay đổi đáng kể qua các bản 0.2.x, và mô hình validation của Pydantic 2 là phụ thuộc bắt buộc của mọi schema API trong server/api/schemas/.",
    tableHeaders: ["Yêu cầu", "Tối thiểu", "Khuyến nghị", "Vì sao quan trọng"],
    rows: [
      ["Python", "3.11", "3.12+", "match/case trong domain logic, kiểu dữ liệu hiện đại (X | None) xuyên suốt models.py"],
      ["Node.js", "18.x", "20.x LTS", "Vite 6 và tooling của frontend nhắm đến baseline này"],
      ["uv", "phiên bản gần đây bất kỳ", "mới nhất", "cách duy nhất được hỗ trợ để cài dependency Python — repo này không có requirements.txt"],
      ["RAM", "2 GB", "4 GB+", "state của LangGraph và một JSON store in-memory đều sống trong bộ nhớ của process backend"],
    ],

    pythonH2: "Môi trường Python",
    pythonP1: "Dependency được uv quản lý từ pyproject.toml, không phải pip và requirements.txt — uv resolve toàn bộ đồ thị dependency một lần, khóa lại, và cài từ lockfile đó một cách xác định, vừa nhanh hơn nhiều so với pip khi cài lần đầu vừa tái lập được trên các máy khác nhau.",
    pythonP2: "uv sync --all-extras mới là lệnh quan trọng (không phải uv sync suông): nó kéo về các extra tùy chọn cùng với dependency lõi — gói provider của LangChain/LangGraph, model spaCy dùng cho chế độ build knowledge-graph kiểu static (không dùng LLM), và bất cứ thứ gì khác nằm sau một extras group trong pyproject.toml. Bỏ qua --all-extras và bạn sẽ gặp ImportError ngay lần đầu một đường code nào đó thực sự cần một trong số chúng, thường là khá lâu sau khi app đã khởi động xong.",
    pythonCode: `uv sync --all-extras`,

    nodeH2: "Môi trường Frontend",
    nodeP1: "React 18 + TypeScript 5.8, build bằng Vite 6, style bằng Tailwind CSS, hiệu ứng bằng Framer Motion, dựng trên các primitive không style của Radix UI để có component accessible.",
    nodeP2: "Ở đây cũng dùng npm ci thay vì npm install, cùng lý do đảm bảo lockfile như backend: nó cài đúng những gì package-lock.json ghi, báo lỗi rõ ràng nếu file đó và package.json đã lệch nhau, thay vì âm thầm resolve lại và có thể cài thứ khác với những gì CI đã test.",
    nodeCode: `npm --prefix ui ci`,

    infraH2: "Hạ tầng tùy chọn — và khi nào bạn thực sự cần",
    infraP1: "Thiết lập cục bộ mặc định không cần bất kỳ thứ gì ở đây: storage.backend=json (một store in-memory được ghi lại ra đĩa mỗi khi cập nhật), task_queue.backend=memory (một ThreadPoolExecutor), lock.backend=threading. Tổ hợp đó thực sự ổn cho một developer đơn lẻ, một bản demo, hay thậm chí một deployment production nhỏ chạy một instance — không phải chế độ đồ chơi.",
    infraP2: "Bạn sẽ cần tới các phương án thay thế cụ thể khi:",
    infraReasons: [
      "storage.backend: mongo — bạn cần độ bền dữ liệu qua các lần restart process vượt quá những gì JSON-trên-đĩa mang lại, hoặc nhiều replica backend cần chia sẻ state.",
      "task_queue.backend: rabbitmq — bạn chạy nhiều hơn một process backend và cần việc thực thi task được phân tán qua chúng, không chỉ đồng thời trong một process.",
      "lock.backend: redis — nhiều process backend cần phối hợp loại trừ lẫn nhau trên cùng một staff-graph run, điều mà threading.Lock cục bộ không thể làm được xuyên process.",
    ],
    infraP3: "Chỉ khởi động các container hạ tầng khi bạn thực sự sắp chuyển các giá trị config.yml đó — không có lợi ích gì khi chạy Redis/RabbitMQ cục bộ nếu backend vẫn đang trỏ tới các giá trị mặc định in-memory.",
    infraCode: `make infra   # redis + rabbitmq qua Docker Compose\n# hoặc:\ndocker compose -f docker/docker-compose-dev.yaml up -d redis rabbitmq`,
    infraStop: "Dừng chúng theo cùng cách:",

    nextH2: "Tiếp theo",
    nextQuickstart: "Các bước rút gọn để có thứ gì đó chạy được.",
    nextConfig: "Trỏ storage/queue/lock tới các backend bạn vừa cài.",
    nextDeploy: "Chạy toàn bộ stack, kể cả Mongo/Redis/RabbitMQ, bằng Docker thay vì cục bộ.",
  },
  zh: {
    intro: "系统要求，以及每个安装步骤实际拉取的内容——如果 Quick Start 中的单行命令能跑通、但您想了解原因，或者您正在一台还没有 Python/Node 工具链的机器上做初始设置，请阅读本页。",

    reqH2: "系统要求",
    reqP: "这里没有什么特别的——这是一套标准的 FastAPI + React 技术栈。版本下限比看起来更重要：LangGraph 的 API 在 0.2.x 系列中有过实质性变化，而 Pydantic 2 的校验模型是 server/api/schemas/ 中每一个 API schema 的硬依赖。",
    tableHeaders: ["要求", "最低配置", "推荐配置", "重要原因"],
    rows: [
      ["Python", "3.11", "3.12+", "domain 逻辑中的 match/case，models.py 中随处可见的现代类型标注（X | None）"],
      ["Node.js", "18.x", "20.x LTS", "Vite 6 及前端工具链以此为基线"],
      ["uv", "任意较新版本", "最新版", "本仓库安装 Python 依赖的唯一受支持方式——没有 requirements.txt"],
      ["RAM", "2 GB", "4 GB+", "LangGraph 的状态与内存中的 JSON 存储都驻留在后端进程的内存里"],
    ],

    pythonH2: "Python 环境",
    pythonP1: "依赖由 uv 根据 pyproject.toml 管理，而不是 pip 加 requirements.txt——uv 一次性解析完整依赖图并锁定，再从该锁定文件确定性地安装，这既比 pip 冷安装快得多，也能跨机器复现。",
    pythonP2: "真正重要的命令是 uv sync --all-extras（而非普通的 uv sync）：它会连同核心依赖一起拉取可选的 extras——LangChain/LangGraph 的提供商包、用于静态（非 LLM）知识图谱构建模式的 spaCy 模型，以及 pyproject.toml 中任何被归入 extras 分组的内容。跳过 --all-extras，一旦某条代码路径真正需要其中之一，您就会遇到 ImportError，而这通常发生在应用已经启动很久之后。",
    pythonCode: `uv sync --all-extras`,

    nodeH2: "前端环境",
    nodeP1: "React 18 + TypeScript 5.8，使用 Vite 6 构建，Tailwind CSS 负责样式，Framer Motion 提供动画，基于 Radix UI 的无样式基础组件构建以获得可访问性。",
    nodeP2: "这里同样使用 npm ci 而非 npm install，原因与后端相同——保证 lockfile 的一致性：它精确安装 package-lock.json 中的内容，如果该文件与 package.json 已经不一致会明确报错，而不是悄悄重新解析、装出与 CI 测试时不同的内容。",
    nodeCode: `npm --prefix ui ci`,

    infraH2: "可选基础设施——以及您何时真正需要它",
    infraP1: "默认的本地设置不需要以下任何一项：storage.backend=json（一个更新时重写到磁盘的内存存储）、task_queue.backend=memory（一个 ThreadPoolExecutor）、lock.backend=threading。对单个开发者、一次演示，甚至一个小型单实例生产部署来说，这套组合是真正可用的——不是玩具模式。",
    infraP2: "您会在以下具体情况下才需要替代方案：",
    infraReasons: [
      "storage.backend: mongo —— 您需要超出磁盘 JSON 所能提供的、跨进程重启的持久性，或者多个后端副本需要共享状态。",
      "task_queue.backend: rabbitmq —— 您运行的后端进程不止一个，需要把任务执行分散到它们之间，而不仅仅是单进程内的并发。",
      "lock.backend: redis —— 多个后端进程需要在同一个 staff-graph 运行上协调互斥，而本地的 threading.Lock 无法跨进程做到这一点。",
    ],
    infraP3: "只有在您确实即将切换这些 config.yml 值时才启动这些基础设施容器——如果后端仍然指向内存默认值，本地运行 Redis/RabbitMQ 没有任何好处。",
    infraCode: `make infra   # 通过 Docker Compose 启动 redis + rabbitmq\n# 或者：\ndocker compose -f docker/docker-compose-dev.yaml up -d redis rabbitmq`,
    infraStop: "用同样的方式停止它们：",

    nextH2: "下一步",
    nextQuickstart: "精简的分步指南，快速跑起来。",
    nextConfig: "把 storage/queue/lock 指向您刚安装的后端。",
    nextDeploy: "改用 Docker 运行整套技术栈，包括 Mongo/Redis/RabbitMQ。",
  },
  ja: {
    intro: "要件と、各インストール手順が実際に何を取得するか。Quick Start のワンライナーは動くけれど理由を理解したい場合や、Python/Node のツールチェーンがまだ入っていないマシンをセットアップする場合はこのページを読んでください。",

    reqH2: "要件",
    reqP: "特に変わったものはありません — 標準的な FastAPI + React スタックです。バージョンの下限は見た目以上に重要です。LangGraph の API は 0.2.x 系列で実質的な変更がありましたし、Pydantic 2 のバリデーションモデルは server/api/schemas/ のすべての API スキーマのハード依存です。",
    tableHeaders: ["要件", "最小構成", "推奨構成", "重要な理由"],
    rows: [
      ["Python", "3.11", "3.12+", "ドメインロジックでの match/case、models.py 全体で使われるモダンな型（X | None）"],
      ["Node.js", "18.x", "20.x LTS", "Vite 6 とフロントエンドのツールチェーンがこのベースラインを対象としている"],
      ["uv", "比較的新しいバージョン", "最新版", "本リポジトリで Python 依存をインストールする唯一のサポート方法 — requirements.txt はない"],
      ["RAM", "2 GB", "4 GB+", "LangGraph の状態とインメモリ JSON ストアはどちらもバックエンドプロセスのメモリ上に存在する"],
    ],

    pythonH2: "Python 環境",
    pythonP1: "依存関係は pip や requirements.txt ではなく、pyproject.toml に基づき uv が管理します — uv は依存関係グラフ全体を一度解決してロックし、そのロックから決定論的にインストールします。これは pip でのコールドインストールより大幅に速く、マシン間でも再現可能です。",
    pythonP2: "重要なのは（単なる uv sync ではなく）uv sync --all-extras です。コアの依存関係に加えて、オプションの extras — LangChain/LangGraph のプロバイダーパッケージ、静的（LLM を使わない）ナレッジグラフ構築モードで使う spaCy モデル、pyproject.toml の extras グループに入っているその他諸々 — も取得します。--all-extras を省略すると、あるコードパスが実際にそれらのいずれかを必要とした瞬間に ImportError になります。多くの場合、それはアプリがすでに起動してからしばらく経ってからです。",
    pythonCode: `uv sync --all-extras`,

    nodeH2: "フロントエンド環境",
    nodeP1: "React 18 + TypeScript 5.8。Vite 6 でビルドし、Tailwind CSS でスタイリングし、Framer Motion でアニメーションし、アクセシブルなスタイルなしコンポーネントのために Radix UI プリミティブの上に構築されています。",
    nodeP2: "ここでも npm install ではなく npm ci を使う理由はバックエンドと同じく lockfile の忠実性のためです。package-lock.json に書かれている内容を正確にインストールし、そのファイルと package.json がずれていれば黙って再解決するのではなく明確にエラーを出します。",
    nodeCode: `npm --prefix ui ci`,

    infraH2: "オプションのインフラ — 実際に必要になるとき",
    infraP1: "デフォルトのローカル設定ではこれらは一切不要です：storage.backend=json（更新のたびにディスクへ書き戻されるインメモリストア）、task_queue.backend=memory（ThreadPoolExecutor）、lock.backend=threading。この組み合わせは、単独の開発者、デモ、あるいは単一インスタンスの小規模な本番デプロイにとっても十分実用的です — おもちゃのモードではありません。",
    infraP2: "具体的に代替手段が必要になるのは次のような場合です。",
    infraReasons: [
      "storage.backend: mongo —— ディスク上の JSON が提供する以上の、プロセス再起動をまたぐ永続性が必要な場合、または複数のバックエンドレプリカが状態を共有する必要がある場合。",
      "task_queue.backend: rabbitmq —— 複数のバックエンドプロセスを実行しており、1 プロセス内の並行処理だけでなく、それらの間でタスク実行を分散させる必要がある場合。",
      "lock.backend: redis —— 複数のバックエンドプロセスが同じ staff-graph 実行に対して相互排他を調整する必要がある場合。ローカルの threading.Lock はプロセスをまたいでそれができません。",
    ],
    infraP3: "これらの config.yml の値を実際に切り替える直前になってから、インフラのコンテナを起動してください。バックエンドがまだインメモリのデフォルトを指しているなら、ローカルで Redis/RabbitMQ を動かすメリットはありません。",
    infraCode: `make infra   # Docker Compose 経由で redis + rabbitmq\n# または:\ndocker compose -f docker/docker-compose-dev.yaml up -d redis rabbitmq`,
    infraStop: "停止も同じ方法で:",

    nextH2: "次に読む",
    nextQuickstart: "とにかく何かを動かすための凝縮されたステップバイステップ。",
    nextConfig: "今インストールしたバックエンドに storage/queue/lock を向ける。",
    nextDeploy: "Mongo/Redis/RabbitMQ を含むスタック全体を代わりに Docker で実行する。",
  },
} as const;

export default function InstallationDoc({ lang, onNavigate }: DocPageProps) {
  const t = TXT[lang];
  return (
    <div>
      <H1>Installation</H1>
      <P>{t.intro}</P>

      <H2>{t.reqH2}</H2>
      <P>{t.reqP}</P>
      <div className="overflow-x-auto my-4">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b border-border">
              {t.tableHeaders.map((h) => (
                <th key={h} className="text-left py-2 pr-6 font-semibold text-foreground/80">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="text-muted-foreground divide-y divide-border/40">
            {t.rows.map(([name, min, rec, why]) => (
              <tr key={name}>
                <td className="py-2 pr-6 font-mono text-foreground/70 whitespace-nowrap">{name}</td>
                <td className="py-2 pr-6 whitespace-nowrap">{min}</td>
                <td className="py-2 pr-6 whitespace-nowrap">{rec}</td>
                <td className="py-2 text-[13px]">{why}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <H2>{t.pythonH2}</H2>
      <P>{t.pythonP1}</P>
      <P>{t.pythonP2}</P>
      <CodeBlock lang="bash" code={t.pythonCode} />

      <H2>{t.nodeH2}</H2>
      <P>{t.nodeP1}</P>
      <P>{t.nodeP2}</P>
      <CodeBlock lang="bash" code={t.nodeCode} />

      <H2>{t.infraH2}</H2>
      <P>{t.infraP1}</P>
      <P>{t.infraP2}</P>
      <UL>
        {t.infraReasons.map((r) => <LI key={r}>{r}</LI>)}
      </UL>
      <P>{t.infraP3}</P>
      <CodeBlock lang="bash" code={t.infraCode} />
      <P>{t.infraStop} <InlineCode>make infra-down</InlineCode></P>

      <H2>{t.nextH2}</H2>
      <NextSteps>
        <NextStepCard id="quickstart" onNavigate={onNavigate} title="Quick Start" desc={t.nextQuickstart} />
        <NextStepCard id="configuration" onNavigate={onNavigate} title="Configuration" desc={t.nextConfig} />
        <NextStepCard id="deploy-docker" onNavigate={onNavigate} title="Docker" desc={t.nextDeploy} />
      </NextSteps>
    </div>
  );
}
