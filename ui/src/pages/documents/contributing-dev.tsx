import { H1, H2, P, UL, LI, CodeBlock, DocLink, NextSteps, NextStepCard, type DocPageProps } from "./_shared";

const TXT = {
  en: {
    hooksH2: "Pre-commit hooks",
    hooksP: "pre-commit install wires formatting and lint checks to run automatically before every commit. The point isn't ceremony — it's catching a stray print statement or an unformatted file locally, in the second it takes to run a hook, instead of a minute later in CI, or worse, in review where a human has to point it out.",
    testsH2: "Running tests",
    testsP1: "Backend tests live in test/ at the repo root, not server/ — despite the Makefile target being named test, server/ itself has no test files. The split within test/ mirrors how the tests actually exercise the system: test/api/ drives requests through a shared client TestClient fixture (plus admin_headers/user_headers fixtures) and asserts on HTTP responses, the same way a real client would; test/unit/ tests domain/app logic directly, without going through HTTP, for everything that doesn't need a full request/response round-trip. test/manual/ is ad-hoc debug scripts you run by hand — pytest doesn't collect it.",
    testsP2: "That split matters when you're deciding where to put a new test: if you're verifying a router's status codes, validation errors, or auth gating, it belongs in api/; if you're verifying a pure function or a service method's logic in isolation, unit/ is faster to run and easier to pin down a failure in.",
    styleH2: "Code style",
    style: [
      { t: "Backend layering", d: "domain imports nothing from app/api/infra; app depends only on app.ports.* Protocols, never concrete adapters. This isn't bureaucracy — it's what lets you swap JSON storage for Mongo, or a threading lock for Redis, by changing a config value instead of hunting through business logic for hardcoded assumptions, and what lets domain logic be unit-tested without spinning up a database." },
      { t: "Async I/O", d: "Keep functions that touch I/O async; never block the event loop with a synchronous network or file call — one blocking call in a hot path stalls every other request being served by that worker." },
      { t: "LangGraph state", d: "Never mutate state in place — build new containers when updating collections in state. LangGraph relies on this to detect what changed between steps; mutating in place can produce nodes that silently see stale data." },
      { t: "Frontend", d: "Keep components modular and fully typed (TypeScript); match the surrounding style rather than reformatting untouched code — a diff that's 90% whitespace changes is a diff nobody can review properly." },
      { t: "Secrets", d: "Never commit secrets — .env is gitignored; add new keys to .env.template (with no real value) instead, so config.yml's ${VAR} references stay documented without leaking anything." },
    ],
    ciH2: "What CI runs",
    ciP: "On every push to main: pytest test/ -v on the backend, and npm run test plus npm run build in ui/. Frontend lint is non-blocking in CI — it won't fail your build — but make lint (ruff for the backend, eslint for the frontend) is expected to pass locally before you open a PR; reviewers will ask you to fix lint issues CI didn't catch.",
    nextArch: "The layer boundaries this page's style rules are actually enforcing.",
    nextGuide: "License terms, ways to contribute, and the PR flow itself.",
  },
  vi: {
    hooksH2: "Pre-commit hooks",
    hooksP: "pre-commit install gắn các kiểm tra định dạng và lint để tự động chạy trước mỗi lần commit. Mục đích không phải là hình thức — mà là bắt được một câu print thừa hay một file chưa định dạng ngay tại local, trong khoảnh khắc chạy hook, thay vì một phút sau ở CI, hay tệ hơn, khi review khi một người khác phải chỉ ra nó.",
    testsH2: "Chạy test",
    testsP1: "Test backend nằm ở test/ tại thư mục gốc repo, không phải server/ — dù target trong Makefile được đặt tên là test, bản thân server/ không có file test nào. Cách chia trong test/ phản ánh đúng cách các test thực sự kiểm tra hệ thống: test/api/ gửi request qua fixture client TestClient dùng chung (cùng fixture admin_headers/user_headers) và assert trên response HTTP, giống hệt một client thật; test/unit/ kiểm tra logic domain/app trực tiếp, không qua HTTP, cho mọi thứ không cần một vòng request/response đầy đủ. test/manual/ là các script debug thủ công mà bạn tự chạy tay — pytest không thu thập nó.",
    testsP2: "Cách chia này quan trọng khi bạn quyết định đặt một test mới ở đâu: nếu bạn đang kiểm tra status code, lỗi validation, hay việc chặn quyền của một router, nó thuộc về api/; nếu bạn đang kiểm tra một hàm thuần hay logic của một service method một cách độc lập, unit/ chạy nhanh hơn và dễ khoanh vùng lỗi hơn.",
    styleH2: "Quy ước code",
    style: [
      { t: "Phân lớp backend", d: "domain không import gì từ app/api/infra; app chỉ phụ thuộc vào các Protocol trong app.ports.*, không bao giờ phụ thuộc adapter cụ thể. Đây không phải thủ tục hành chính — nó cho phép bạn đổi storage JSON sang Mongo, hay lock threading sang Redis, chỉ bằng cách đổi một giá trị config thay vì lùng sục qua business logic tìm các giả định hardcode, và cho phép logic domain được unit-test mà không cần khởi động database." },
      { t: "I/O async", d: "Giữ các hàm chạm I/O ở dạng async; không bao giờ chặn event loop bằng lệnh gọi network/file đồng bộ — một lệnh gọi blocking trên hot path làm nghẽn mọi request khác mà worker đó đang phục vụ." },
      { t: "State của LangGraph", d: "Không bao giờ mutate state tại chỗ — hãy tạo container mới khi cập nhật các collection trong state. LangGraph dựa vào điều này để phát hiện những gì đã thay đổi giữa các bước; mutate tại chỗ có thể khiến một số node âm thầm thấy dữ liệu cũ." },
      { t: "Frontend", d: "Giữ component modular và có kiểu dữ liệu đầy đủ (TypeScript); bám theo style xung quanh thay vì định dạng lại code không liên quan — một diff mà 90% là thay đổi khoảng trắng là một diff không ai review nổi." },
      { t: "Secret", d: "Không bao giờ commit secret — .env đã bị gitignore; thêm key mới vào .env.template (không kèm giá trị thật) thay vào đó, để các tham chiếu ${VAR} trong config.yml vẫn được ghi lại mà không lộ gì cả." },
    ],
    ciH2: "CI chạy những gì",
    ciP: "Với mỗi lần push lên main: pytest test/ -v ở backend, và npm run test cùng npm run build trong ui/. Lint frontend không chặn CI — nó sẽ không làm build fail — nhưng make lint (ruff cho backend, eslint cho frontend) cần chạy pass ở local trước khi bạn mở PR; reviewer sẽ yêu cầu bạn sửa các vấn đề lint mà CI không bắt được.",
    nextArch: "Ranh giới các lớp mà quy ước code ở trang này thực sự đang thực thi.",
    nextGuide: "Điều khoản giấy phép, các cách đóng góp, và chính quy trình PR.",
  },
  zh: {
    hooksH2: "Pre-commit 钩子",
    hooksP: "pre-commit install 会将格式化和 lint 检查接入每次提交前自动运行。这样做的意义不在于走形式——而是能在本地、在运行钩子的那一秒内，就抓住一个多余的 print 语句或未格式化的文件，而不是一分钟后在 CI 中才发现，或者更糟，在评审时由别人替您指出来。",
    testsH2: "运行测试",
    testsP1: "后端测试位于仓库根目录的 test/ 下，而非 server/ ——尽管 Makefile 目标名为 test，server/ 本身并没有测试文件。test/ 内部的划分反映了测试实际验证系统的方式：test/api/ 通过共享的 client TestClient fixture（以及 admin_headers/user_headers fixture）发起请求，并断言 HTTP 响应，就像真实客户端一样；test/unit/ 直接测试 domain/app 逻辑，不经过 HTTP，适用于所有不需要完整请求/响应往返的场景。test/manual/ 是手动运行的临时调试脚本——pytest 不会收集它。",
    testsP2: "在决定新测试放在哪里时，这个划分很关键：如果您在验证某个路由的状态码、校验错误或鉴权拦截，它属于 api/；如果您在独立验证一个纯函数或某个 service 方法的逻辑，unit/ 运行更快，也更容易定位失败原因。",
    styleH2: "代码风格",
    style: [
      { t: "后端分层", d: "domain 不导入 app/api/infra 中的任何内容；app 仅依赖 app.ports.* 中的 Protocol，绝不依赖具体适配器。这并非官僚形式——它让您可以只通过修改一个配置值就把 JSON 存储换成 Mongo，或把 threading 锁换成 Redis，而不必在业务逻辑中翻找硬编码的假设，也让 domain 逻辑无需启动数据库就能进行单元测试。" },
      { t: "异步 I/O", d: "涉及 I/O 的函数保持 async；绝不用同步的网络或文件调用阻塞事件循环——热路径上的一次阻塞调用会拖住该 worker 正在处理的所有其他请求。" },
      { t: "LangGraph 的 state", d: "绝不能原地修改 state——更新 state 中的集合时应构建新的容器。LangGraph 依赖这一点来检测各步骤之间发生了什么变化；原地修改可能导致某些节点悄无声息地看到过期数据。" },
      { t: "前端", d: "保持组件模块化并完整添加类型（TypeScript）；遵循周围代码风格，而不是对未改动的代码重新格式化——一个 90% 都是空白改动的 diff，没有人能真正评审好它。" },
      { t: "密钥", d: "绝不提交任何密钥——.env 已加入 .gitignore；新增密钥请改为加入 .env.template（不带真实值），这样 config.yml 中的 ${VAR} 引用仍有文档记录，同时不会泄露任何内容。" },
    ],
    ciH2: "CI 运行内容",
    ciP: "每次推送到 main 时：后端运行 pytest test/ -v，ui/ 中运行 npm run test 和 npm run build。前端 lint 在 CI 中不会阻断构建——它不会让您的构建失败——但在提交 PR 前，本地运行 make lint（后端用 ruff，前端用 eslint）应当通过；评审者会要求您修复 CI 未捕获到的 lint 问题。",
    nextArch: "本页代码风格规则实际在强制执行的分层边界。",
    nextGuide: "许可条款、贡献方式，以及 PR 流程本身。",
  },
  ja: {
    hooksH2: "Pre-commit フック",
    hooksP: "pre-commit install は、フォーマットと lint のチェックを各コミット前に自動実行するよう組み込みます。これは形式的なものではなく、フックの実行にかかる 1 秒の間にローカルで、余分な print 文やフォーマットされていないファイルを捕まえるためのものです。1 分後の CI で、あるいはもっと悪いことにレビューで人間に指摘されるよりずっと良いのです。",
    testsH2: "テストの実行",
    testsP1: "バックエンドのテストはリポジトリルートの test/ にあり、server/ にはありません — Makefile のターゲット名が test であるにもかかわらず、server/ 自体にはテストファイルがありません。test/ 内の分割は、テストが実際にシステムをどう検証するかを反映しています。test/api/ は共有の client TestClient フィクスチャ（および admin_headers/user_headers フィクスチャ）を通じてリクエストを送り、実際のクライアントと同様に HTTP レスポンスをアサートします。test/unit/ は HTTP を経由せず、domain/app のロジックを直接テストします。完全なリクエスト/レスポンスの往復を必要としないものすべてが対象です。test/manual/ は手動で実行する場当たり的なデバッグスクリプトで、pytest には収集されません。",
    testsP2: "新しいテストをどこに置くか決める際、この分割は重要です。あるルーターのステータスコード、バリデーションエラー、認可のゲーティングを検証しているなら api/ に属します。純粋関数やサービスメソッドのロジックを単体で検証しているなら、unit/ の方が実行が速く、失敗箇所も特定しやすくなります。",
    styleH2: "コードスタイル",
    style: [
      { t: "バックエンドのレイヤリング", d: "domain は app/api/infra から何もインポートしません。app は app.ports.* の Protocol のみに依存し、具体的なアダプターには依存しません。これは官僚的な形式ではありません——ビジネスロジックの中でハードコードされた前提を探し回ることなく、設定値を変更するだけで JSON ストレージを Mongo に、あるいは threading ロックを Redis に切り替えられるようにし、データベースを起動せずに domain ロジックを単体テストできるようにするためのものです。" },
      { t: "非同期 I/O", d: "I/O に触れる関数は async のままにし、同期的なネットワーク/ファイル呼び出しでイベントループをブロックしないこと——ホットパス上の 1 回のブロッキング呼び出しは、その worker が処理している他のすべてのリクエストを止めてしまいます。" },
      { t: "LangGraph の state", d: "state をその場で変更してはいけません — state 内のコレクションを更新する際は新しいコンテナを構築してください。LangGraph はステップ間で何が変わったかを検出するためにこれに依存しており、その場での変更はノードが古いデータを気づかぬうちに見てしまう原因になります。" },
      { t: "フロントエンド", d: "コンポーネントはモジュール化し、完全に型付け（TypeScript）すること。変更していないコードを再フォーマットせず、周囲のスタイルに合わせること——90% が空白の変更である diff は、誰もまともにレビューできません。" },
      { t: "シークレット", d: "シークレットは絶対にコミットしないこと——.env は gitignore 対象です。新しいキーは実際の値なしで .env.template に追加してください。そうすれば config.yml の ${VAR} 参照は何も漏らさずに文書化されたままになります。" },
    ],
    ciH2: "CI が実行する内容",
    ciP: "main へのすべての push で: バックエンドは pytest test/ -v、ui/ では npm run test と npm run build が実行されます。フロントエンドの lint は CI ではブロッキングではなく、ビルドを失敗させることはありませんが、PR を開く前にローカルで make lint（バックエンドは ruff、フロントエンドは eslint）が通ることが期待されます。レビュアーは CI が捕捉しなかった lint の問題の修正を求めることがあります。",
    nextArch: "このページのコードスタイルルールが実際に強制しているレイヤー境界。",
    nextGuide: "ライセンス条項、貢献の方法、そして PR フローそのもの。",
  },
} as const;

export default function ContributingDevDoc({ lang, onNavigate }: DocPageProps) {
  const t = TXT[lang];
  return (
    <div>
      <H1>Development Setup</H1>

      <H2>{t.hooksH2}</H2>
      <CodeBlock lang="bash" code={`pip install pre-commit\npre-commit install`} />
      <P>{t.hooksP}</P>

      <H2>{t.testsH2}</H2>
      <P>{t.testsP1}</P>
      <P>{t.testsP2}</P>
      <CodeBlock lang="bash" title="Backend" code={`PYTHONPATH=. uv run pytest test/ -v\nPYTHONPATH=. uv run pytest test/unit/test_foo.py -v          # single file\nPYTHONPATH=. uv run pytest test/api/test_foo.py -k name -vv  # single test`} />
      <CodeBlock lang="bash" title="Frontend (from ui/)" code={`npm run test\nnpm run test:watch\nnpx vitest run src/path/to/file.test.ts`} />

      <H2>{t.styleH2}</H2>
      <UL>
        {t.style.map(({ t: title, d }) => (
          <LI key={title}><strong>{title}</strong> — {d}</LI>
        ))}
      </UL>
      <P><DocLink id="architecture" onNavigate={onNavigate}>Architecture</DocLink></P>

      <H2>{t.ciH2}</H2>
      <P>{t.ciP}</P>
      <CodeBlock lang="bash" title="Lint / build" code={`make lint            # ruff (backend) + eslint (frontend)\ncd ui && npm run build`} />

      <NextSteps>
        <NextStepCard id="architecture" onNavigate={onNavigate} title="Architecture" desc={t.nextArch} />
        <NextStepCard id="contributing-guide" onNavigate={onNavigate} title="How to Contribute" desc={t.nextGuide} />
      </NextSteps>
    </div>
  );
}
