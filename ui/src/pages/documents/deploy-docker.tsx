import { H1, H2, P, UL, LI, OL, OLI, Callout, CodeBlock, InlineCode, NextSteps, NextStepCard, type DocPageProps } from "./_shared";

const TXT = {
  en: {
    lead1: "AI Collective ships two Docker Compose stacks that describe the same six services — frontend, backend, MongoDB, Redis, RabbitMQ, Nginx — configured two different ways. The dev stack optimizes for iteration speed: your source code is mounted straight into the containers, so a save on your host is a save inside the container, no rebuild involved. The production stack optimizes for the opposite: it bakes a frozen, optimized build into the image and throws the source away, trading iteration speed for a smaller, more predictable artifact you'd actually want to run on a server.",
    lead2: "Both stacks share the same entry point — everything is reachable through Nginx on port 2026 — so switching between them while you work doesn't change any URLs you've bookmarked or scripted against. What changes is what's underneath: whether Nginx is proxying to a Vite dev server doing hot module replacement, or serving pre-built static files.",

    whatH2: "What make dev actually does",
    whatP: "Running make dev (a thin wrapper over docker compose -f docker/docker-compose-dev.yaml up --build -d) walks through a fixed sequence:",
    whatSteps: [
      "Compose reads docker-compose-dev.yaml and, for any image that doesn't exist locally yet or whose Dockerfile changed, builds it — backend and frontend images, plus pulling MongoDB/Redis/RabbitMQ/Nginx from their official images.",
      "Containers start in dependency order — infra services (Mongo, Redis, RabbitMQ) first, then backend, then frontend, then Nginx last since it proxies to the other three.",
      "The backend and frontend containers mount server/ and ui/ from your host as volumes, so uvicorn's --reload and Vite's dev server pick up file changes instantly without a new build.",
      "Nginx starts fronting everything on :2026, and you're up — visit the app, hit the API, watch logs.",
    ],
    whatNote: "The -d flag detaches the containers to the background; use make dev-logs (or docker compose ... logs -f) to attach and watch output.",

    devH2: "Dev stack: what you get",
    devP: "Because server/ and ui/ are bind-mounted rather than copied into the image, changes on your host reflect immediately inside the running containers — you get the same edit-save-refresh loop as running things locally, just inside Docker. The exception is dependency changes: adding a new Python package or npm module still requires a rebuild (make dev-build), since installing dependencies happens at image-build time, not at container-start time.",
    devUrlsH2: "Dev URLs",
    devUrls: [
      { url: "http://localhost:2026", d: "Main application (through Nginx)" },
      { url: "http://localhost:2026/api/v1/docs", d: "Swagger UI" },
      { url: "http://localhost:2026/api/v1/redoc", d: "ReDoc" },
      { url: "http://localhost:15672", d: "RabbitMQ management UI (guest/guest)" },
      { url: "http://localhost:8083", d: "Redis Commander" },
      { url: "http://localhost:8081", d: "Mongo Express (admin/admin)" },
    ],
    devCmdsH2: "Dev commands",

    whyProfilesH2: "Why monitoring UIs are always-on in dev, but opt-in in prod",
    whyProfilesP: "This isn't an oversight — it's a deliberate default. In dev, you're the only one with access to your machine, so leaving RabbitMQ's management UI, Redis Commander, and Mongo Express reachable costs nothing and saves you a flag every time you want to peek at a queue or a collection. In production, those same UIs sitting open on a public host are a real attack surface (RabbitMQ's default guest/guest credentials, for one, are not something you want internet-reachable) — so the production compose file keeps them behind explicit PROFILES=tools / PROFILES=mongo-express flags you have to opt into, ideally from behind a VPN or an IP allowlist rather than the open internet.",

    prodH2: "Production stack",
    prodP: "make up builds optimized images — multi-stage Docker builds that discard build tooling and source maps from the final layer — and serves the built frontend as static files through Nginx rather than a dev server. The same six services, the same :2026 entry point, but nothing here expects you to edit code in the running containers; you rebuild and redeploy instead.",
    prodCmdsH2: "Production commands",

    profilesH2: "Optional profiles: AIO Sandbox vs. K8s Provisioner",
    profilesP: "Two extra services exist outside the core stack, and it's easy to conflate them with sandbox.mode in config.yml (which only ever accepts local or k8s — there's no docker sandbox mode). These profiles are about how you run the containers around the app, not about where a Staff member's code execution happens.",
    aioTitle: "AIO Sandbox — make dev-sandbox / make prod-sandbox",
    aioDesc: "A standalone code-execution container you can poke at directly for manual testing or debugging a sandboxed command by hand. It doesn't change sandbox.mode and isn't wired into a running Task automatically — reach for it when you want to reproduce what a Staff's shell/file tool would see, outside of an actual run.",
    k8sTitle: "K8s Provisioner — make dev-provisioner / make prod-provisioner",
    k8sDesc: "This is what actually backs sandbox.mode: k8s. Once running, the provisioner service spawns a fresh sandbox Pod per request on your Kubernetes cluster and tears it down when the Task's sandboxed command finishes — reach for this profile when you've set sandbox.mode: k8s in config.yml and need the provisioner it talks to.",

    nextConfig: "The full config.yml reference — models, storage, sandbox mode, and everything else.",
    nextEnv: "Which env vars config.yml actually references, and why the rest don't matter.",
  },
  vi: {
    lead1: "AI Collective cung cấp hai stack Docker Compose mô tả cùng sáu dịch vụ — frontend, backend, MongoDB, Redis, RabbitMQ, Nginx — nhưng được cấu hình theo hai cách khác nhau. Dev stack tối ưu cho tốc độ lặp: source code của bạn được mount thẳng vào container, nên lưu file trên host cũng chính là lưu file trong container, không cần rebuild. Production stack tối ưu cho điều ngược lại: nó đóng gói một bản build cố định, tối ưu vào image và bỏ source đi, đánh đổi tốc độ lặp lấy một artifact nhỏ gọn, dễ đoán hơn — thứ bạn thực sự muốn chạy trên server.",
    lead2: "Cả hai stack dùng chung một điểm vào — mọi thứ đều truy cập được qua Nginx ở cổng 2026 — nên chuyển đổi giữa chúng khi làm việc không thay đổi bất kỳ URL nào bạn đã bookmark hay script sẵn. Thứ thay đổi là những gì bên dưới: liệu Nginx đang proxy tới một Vite dev server làm hot module replacement, hay đang phục vụ các file static đã build sẵn.",

    whatH2: "make dev thực sự làm gì",
    whatP: "Chạy make dev (một wrapper mỏng của docker compose -f docker/docker-compose-dev.yaml up --build -d) đi qua một chuỗi cố định:",
    whatSteps: [
      "Compose đọc docker-compose-dev.yaml và, với bất kỳ image nào chưa tồn tại ở local hoặc có Dockerfile thay đổi, build nó — image backend và frontend, cộng với việc pull MongoDB/Redis/RabbitMQ/Nginx từ image chính thức của chúng.",
      "Container khởi động theo thứ tự phụ thuộc — dịch vụ hạ tầng (Mongo, Redis, RabbitMQ) trước, rồi backend, rồi frontend, rồi Nginx cuối cùng vì nó proxy tới ba dịch vụ kia.",
      "Container backend và frontend mount server/ và ui/ từ host của bạn dưới dạng volume, nên --reload của uvicorn và dev server của Vite bắt được thay đổi file ngay lập tức mà không cần build mới.",
      "Nginx bắt đầu đứng trước tất cả ở :2026, và thế là xong — truy cập ứng dụng, gọi API, theo dõi log.",
    ],
    whatNote: "Cờ -d tách container chạy nền; dùng make dev-logs (hoặc docker compose ... logs -f) để attach và theo dõi output.",

    devH2: "Dev stack: bạn nhận được gì",
    devP: "Vì server/ và ui/ được bind-mount thay vì copy vào image, các thay đổi trên host phản ánh ngay lập tức bên trong container đang chạy — bạn có cùng vòng lặp sửa-lưu-refresh như chạy cục bộ, chỉ khác là ở trong Docker. Ngoại lệ là thay đổi dependency: thêm một package Python mới hay module npm mới vẫn cần rebuild (make dev-build), vì việc cài dependency diễn ra ở thời điểm build image, không phải khi container khởi động.",
    devUrlsH2: "URL trong Dev",
    devUrls: [
      { url: "http://localhost:2026", d: "Ứng dụng chính (qua Nginx)" },
      { url: "http://localhost:2026/api/v1/docs", d: "Swagger UI" },
      { url: "http://localhost:2026/api/v1/redoc", d: "ReDoc" },
      { url: "http://localhost:15672", d: "Giao diện quản trị RabbitMQ (guest/guest)" },
      { url: "http://localhost:8083", d: "Redis Commander" },
      { url: "http://localhost:8081", d: "Mongo Express (admin/admin)" },
    ],
    devCmdsH2: "Lệnh Dev",

    whyProfilesH2: "Vì sao giao diện giám sát luôn bật trong dev nhưng lại opt-in trong prod",
    whyProfilesP: "Đây không phải là thiếu sót — mà là một lựa chọn mặc định có chủ đích. Trong dev, chỉ bạn có quyền truy cập máy của mình, nên việc để giao diện quản trị RabbitMQ, Redis Commander, và Mongo Express luôn truy cập được không tốn gì cả và giúp bạn khỏi phải thêm cờ mỗi lần muốn xem một queue hay một collection. Trong production, cùng những giao diện đó nằm mở trên một host công khai lại là một bề mặt tấn công thật sự (thông tin đăng nhập mặc định guest/guest của RabbitMQ, chẳng hạn, không phải thứ bạn muốn ai cũng truy cập được từ internet) — vì vậy file compose production giữ chúng phía sau cờ PROFILES=tools / PROFILES=mongo-express rõ ràng mà bạn phải chủ động bật, lý tưởng nhất là từ sau VPN hoặc danh sách IP được phép thay vì internet mở.",

    prodH2: "Production stack",
    prodP: "make up build các image tối ưu — build Docker nhiều giai đoạn (multi-stage) loại bỏ công cụ build và source map khỏi layer cuối cùng — và phục vụ frontend đã build dưới dạng file static qua Nginx thay vì dev server. Cùng sáu dịch vụ, cùng điểm vào :2026, nhưng ở đây không có gì mong đợi bạn sửa code trong container đang chạy; thay vào đó bạn rebuild và redeploy.",
    prodCmdsH2: "Lệnh Production",

    profilesH2: "Các profile tùy chọn: AIO Sandbox và K8s Provisioner",
    profilesP: "Có hai dịch vụ bổ sung nằm ngoài stack chính, và rất dễ nhầm chúng với sandbox.mode trong config.yml (vốn chỉ nhận local hoặc k8s — không có chế độ sandbox docker). Các profile này nói về cách bạn chạy các container xung quanh ứng dụng, không phải về nơi mã của một Staff thực thi.",
    aioTitle: "AIO Sandbox — make dev-sandbox / make prod-sandbox",
    aioDesc: "Một container thực thi code độc lập mà bạn có thể thao tác trực tiếp để test thủ công hoặc debug một lệnh sandbox bằng tay. Nó không thay đổi sandbox.mode và không tự động được nối vào một Task đang chạy — dùng nó khi bạn muốn tái hiện những gì công cụ shell/file của một Staff sẽ thấy, bên ngoài một phiên chạy thật.",
    k8sTitle: "K8s Provisioner — make dev-provisioner / make prod-provisioner",
    k8sDesc: "Đây mới là thứ thực sự đứng sau sandbox.mode: k8s. Khi chạy, dịch vụ provisioner sinh ra một Pod sandbox mới cho mỗi request trên cụm Kubernetes của bạn và dọn dẹp nó khi lệnh sandbox của Task hoàn tất — dùng profile này khi bạn đã đặt sandbox.mode: k8s trong config.yml và cần provisioner mà nó giao tiếp cùng.",

    nextConfig: "Tham chiếu đầy đủ config.yml — models, storage, chế độ sandbox, và mọi thứ khác.",
    nextEnv: "config.yml thực sự tham chiếu những biến môi trường nào, và vì sao phần còn lại không quan trọng.",
  },
  zh: {
    lead1: "AI Collective 提供两套 Docker Compose 技术栈，描述的是同样的六个服务——frontend、backend、MongoDB、Redis、RabbitMQ、Nginx——但配置方式不同。开发栈针对迭代速度做了优化：您的源代码直接挂载进容器，因此在宿主机上保存文件就等于在容器内保存文件，无需重新构建。生产栈则针对相反的目标做了优化：它将一个冻结的、优化过的构建产物打包进镜像并丢弃源代码，用迭代速度换取更小、更可预测的产物——这才是您真正想要部署到服务器上的东西。",
    lead2: "两套栈共享同一个入口——一切都通过 2026 端口的 Nginx 访问——因此在工作时切换栈不会改变您已收藏或写进脚本的任何 URL。变化的是底层：Nginx 代理的是做热模块替换的 Vite 开发服务器，还是提供预构建好的静态文件。",

    whatH2: "make dev 到底做了什么",
    whatP: "运行 make dev（对 docker compose -f docker/docker-compose-dev.yaml up --build -d 的一层简单封装）会经历一个固定的流程：",
    whatSteps: [
      "Compose 读取 docker-compose-dev.yaml，对任何本地尚不存在或 Dockerfile 发生变化的镜像进行构建——backend 和 frontend 镜像，同时从官方镜像拉取 MongoDB/Redis/RabbitMQ/Nginx。",
      "容器按依赖顺序启动——先是基础设施服务（Mongo、Redis、RabbitMQ），然后是 backend，然后是 frontend，最后是 Nginx，因为它要代理前面三者。",
      "backend 和 frontend 容器将宿主机上的 server/ 和 ui/ 作为卷挂载进去，因此 uvicorn 的 --reload 和 Vite 的开发服务器能立即感知文件变化，无需重新构建。",
      "Nginx 开始在 :2026 上统一对外服务，一切就绪——访问应用、调用 API、查看日志。",
    ],
    whatNote: "-d 标志会让容器在后台分离运行；使用 make dev-logs（或 docker compose ... logs -f）来附加并查看输出。",

    devH2: "开发栈：您能获得什么",
    devP: "由于 server/ 和 ui/ 是绑定挂载而非复制进镜像，宿主机上的更改会立即反映在运行中的容器内——您获得的是与本地运行完全相同的编辑-保存-刷新循环，只是发生在 Docker 里。例外是依赖变更：新增一个 Python 包或 npm 模块仍需要重新构建（make dev-build），因为安装依赖发生在镜像构建阶段，而非容器启动阶段。",
    devUrlsH2: "开发环境 URL",
    devUrls: [
      { url: "http://localhost:2026", d: "主应用（经由 Nginx）" },
      { url: "http://localhost:2026/api/v1/docs", d: "Swagger UI" },
      { url: "http://localhost:2026/api/v1/redoc", d: "ReDoc" },
      { url: "http://localhost:15672", d: "RabbitMQ 管理界面（guest/guest）" },
      { url: "http://localhost:8083", d: "Redis Commander" },
      { url: "http://localhost:8081", d: "Mongo Express（admin/admin）" },
    ],
    devCmdsH2: "开发命令",

    whyProfilesH2: "为什么监控界面在开发环境始终开启，在生产环境却是可选项",
    whyProfilesP: "这不是疏忽，而是刻意为之的默认设置。在开发环境中，只有您自己能访问自己的机器，因此让 RabbitMQ 管理界面、Redis Commander 和 Mongo Express 保持可访问不会带来任何成本，还省去了每次想查看队列或集合时都要加标志的麻烦。而在生产环境中，同样的这些界面暴露在公网主机上就是实实在在的攻击面（比如 RabbitMQ 默认的 guest/guest 凭据，绝不是您想让互联网可访问的东西）——因此生产环境的 compose 文件将它们保留在明确的 PROFILES=tools / PROFILES=mongo-express 标志之后，需要您主动开启，理想情况下应该放在 VPN 或 IP 白名单之后，而不是暴露在公网。",

    prodH2: "生产栈",
    prodP: "make up 构建优化镜像——多阶段 Docker 构建会从最终层中剔除构建工具和 source map——并通过 Nginx 以静态文件形式提供已构建好的前端，而非开发服务器。同样的六个服务，同样的 :2026 入口，但这里不期望您在运行中的容器内编辑代码；您应该重新构建并重新部署。",
    prodCmdsH2: "生产命令",

    profilesH2: "可选 Profile：AIO Sandbox 与 K8s Provisioner",
    profilesP: "核心技术栈之外还有两个额外服务，很容易与 config.yml 中的 sandbox.mode（只接受 local 或 k8s——没有 docker 沙箱模式）混淆。这些 profile 关心的是您如何运行应用周围的容器，而不是员工的代码在哪里执行。",
    aioTitle: "AIO Sandbox — make dev-sandbox / make prod-sandbox",
    aioDesc: "一个可以直接手动操作的独立代码执行容器，用于手动测试或手动调试某个沙箱命令。它不会改变 sandbox.mode，也不会自动接入正在运行的 Task——当您想在真实运行之外，重现某个员工的 shell/文件工具将看到的内容时，可以使用它。",
    k8sTitle: "K8s Provisioner — make dev-provisioner / make prod-provisioner",
    k8sDesc: "这才是真正支撑 sandbox.mode: k8s 的东西。运行后，provisioner 服务会在您的 Kubernetes 集群上为每个请求生成一个全新的沙箱 Pod，并在 Task 的沙箱命令完成后将其销毁——当您在 config.yml 中设置了 sandbox.mode: k8s 并需要与之对话的 provisioner 时，启用这个 profile。",

    nextConfig: "完整的 config.yml 参考——models、storage、沙箱模式，以及其他一切。",
    nextEnv: "config.yml 究竟引用了哪些环境变量，以及为什么其余的都无关紧要。",
  },
  ja: {
    lead1: "AI Collective には 2 つの Docker Compose スタックがあり、どちらも同じ 6 つのサービス——frontend、backend、MongoDB、Redis、RabbitMQ、Nginx——を、異なる方法で構成しています。開発スタックは反復速度を最適化します。ソースコードがコンテナに直接マウントされるため、ホスト側での保存はそのままコンテナ内での保存になり、リビルドは不要です。本番スタックはその逆を最適化します。固定化・最適化されたビルドをイメージに焼き込みソースを破棄し、反復速度と引き換えに、より小さく予測可能な、実際にサーバーで動かしたい成果物を得ます。",
    lead2: "両スタックは同じエントリポイントを共有しており——すべてポート 2026 の Nginx 経由でアクセスできます——作業中に切り替えてもブックマークやスクリプトの URL は変わりません。変わるのはその下にあるもの、つまり Nginx がホットモジュールリプレースメントを行う Vite の開発サーバーにプロキシしているのか、それとも事前ビルド済みの静的ファイルを配信しているのかという点です。",

    whatH2: "make dev が実際に行うこと",
    whatP: "make dev（docker compose -f docker/docker-compose-dev.yaml up --build -d の薄いラッパー）を実行すると、決まった手順で進みます。",
    whatSteps: [
      "Compose が docker-compose-dev.yaml を読み込み、ローカルにまだ存在しない、または Dockerfile が変更されたイメージをビルドします——backend と frontend のイメージに加え、MongoDB/Redis/RabbitMQ/Nginx は公式イメージから取得されます。",
      "コンテナは依存順に起動します——まずインフラサービス（Mongo、Redis、RabbitMQ）、次に backend、次に frontend、最後に他の 3 つにプロキシする Nginx が起動します。",
      "backend と frontend コンテナはホストの server/ と ui/ をボリュームとしてマウントするため、uvicorn の --reload と Vite の開発サーバーはファイル変更を新しいビルドなしに即座に検知します。",
      "Nginx が :2026 ですべての前段に立ち、準備完了です——アプリにアクセスし、API を叩き、ログを確認できます。",
    ],
    whatNote: "-d フラグはコンテナをバックグラウンドでデタッチします。出力をアタッチして見るには make dev-logs（または docker compose ... logs -f）を使ってください。",

    devH2: "開発スタック：得られるもの",
    devP: "server/ と ui/ はイメージにコピーされるのではなくバインドマウントされるため、ホスト側の変更は実行中のコンテナ内に即座に反映されます——ローカルで動かすのと同じ編集・保存・リフレッシュのループが、Docker の中で得られます。例外は依存関係の変更です。新しい Python パッケージや npm モジュールを追加する場合は、依存関係のインストールがコンテナ起動時ではなくイメージビルド時に行われるため、依然としてリビルド（make dev-build）が必要です。",
    devUrlsH2: "開発環境の URL",
    devUrls: [
      { url: "http://localhost:2026", d: "メインアプリケーション（Nginx 経由）" },
      { url: "http://localhost:2026/api/v1/docs", d: "Swagger UI" },
      { url: "http://localhost:2026/api/v1/redoc", d: "ReDoc" },
      { url: "http://localhost:15672", d: "RabbitMQ 管理 UI（guest/guest）" },
      { url: "http://localhost:8083", d: "Redis Commander" },
      { url: "http://localhost:8081", d: "Mongo Express（admin/admin）" },
    ],
    devCmdsH2: "開発コマンド",

    whyProfilesH2: "監視 UI が開発環境では常時有効で、本番環境ではオプトインである理由",
    whyProfilesP: "これは見落としではなく、意図的なデフォルトです。開発環境では自分のマシンにアクセスできるのは自分だけなので、RabbitMQ の管理 UI、Redis Commander、Mongo Express を常にアクセス可能にしておいてもコストはゼロで、キューやコレクションを覗きたいたびにフラグを追加する手間が省けます。本番環境では、同じ UI が公開ホスト上に開いていることは実際の攻撃対象になります（例えば RabbitMQ のデフォルトの guest/guest 認証情報は、インターネットからアクセス可能にしたいものではありません）——そのため本番用の compose ファイルでは、明示的な PROFILES=tools / PROFILES=mongo-express フラグの背後にそれらを置き、理想的には公開インターネットではなく VPN や IP 許可リストの背後から、意図的に有効化するようになっています。",

    prodH2: "本番スタック",
    prodP: "make up は最適化イメージをビルドします——マルチステージ Docker ビルドにより、最終レイヤーからビルドツールと source map を除去します——そして、ビルド済みフロントエンドを開発サーバーではなく Nginx 経由の静的ファイルとして配信します。同じ 6 つのサービス、同じ :2026 エントリポイントですが、ここでは実行中のコンテナ内でコードを編集することは想定されていません。代わりにリビルドして再デプロイします。",
    prodCmdsH2: "本番コマンド",

    profilesH2: "オプションのプロファイル：AIO Sandbox と K8s Provisioner",
    profilesP: "コアスタックの外側に 2 つの追加サービスがあり、config.yml の sandbox.mode（local か k8s のみを受け付け、docker サンドボックスモードは存在しません）と混同しがちです。これらのプロファイルは、スタッフのコード実行がどこで行われるかではなく、アプリを取り巻くコンテナをどう動かすかについてのものです。",
    aioTitle: "AIO Sandbox — make dev-sandbox / make prod-sandbox",
    aioDesc: "手動テストやサンドボックスコマンドの手動デバッグのために直接操作できる、スタンドアロンのコード実行コンテナです。sandbox.mode は変更されず、実行中の Task に自動的には接続されません——実際の実行の外で、スタッフの shell/ファイルツールが見るものを再現したいときに使います。",
    k8sTitle: "K8s Provisioner — make dev-provisioner / make prod-provisioner",
    k8sDesc: "これが sandbox.mode: k8s を実際に支えているものです。起動すると、provisioner サービスは Kubernetes クラスター上でリクエストごとに新しいサンドボックス Pod を生成し、Task のサンドボックスコマンドが完了すると破棄します——config.yml で sandbox.mode: k8s を設定し、それが通信する provisioner が必要なときにこのプロファイルを使います。",

    nextConfig: "完全な config.yml リファレンス — models、storage、サンドボックスモード、その他すべて。",
    nextEnv: "config.yml が実際に参照している環境変数と、それ以外が重要でない理由。",
  },
} as const;

export default function DeployDockerDoc({ lang, onNavigate }: DocPageProps) {
  const t = TXT[lang];
  return (
    <div>
      <H1>Deploying with Docker</H1>
      <P>{t.lead1}</P>
      <P>{t.lead2}</P>

      <H2>{t.whatH2}</H2>
      <P>{t.whatP}</P>
      <OL>{t.whatSteps.map((s, i) => <OLI key={i} n={i + 1}>{s}</OLI>)}</OL>
      <Callout type="tip">{t.whatNote}</Callout>
      <CodeBlock lang="bash" title="Dev stack" code={`cp .env.template .env\n# Fill in a provider key (e.g. GOOGLE_API_KEY) referenced by config.yml's models: list\n\nmake dev\n# or: docker compose -f docker/docker-compose-dev.yaml up --build -d`} />

      <H2>{t.devH2}</H2>
      <P>{t.devP}</P>

      <H2>{t.devUrlsH2}</H2>
      <UL>
        {t.devUrls.map(({ url, d }) => (
          <LI key={url}><InlineCode>{url}</InlineCode> — {d}</LI>
        ))}
      </UL>

      <H2>{t.devCmdsH2}</H2>
      <CodeBlock lang="bash" code={`make dev-down          # stop + remove dev containers\nmake dev-logs          # tail all dev logs\nmake dev-logs-backend  # tail only backend logs\nmake dev-ps            # show container status`} />

      <H2>{t.whyProfilesH2}</H2>
      <P>{t.whyProfilesP}</P>

      <H2>{t.prodH2}</H2>
      <P>{t.prodP}</P>
      <CodeBlock lang="bash" title="Production stack" code={`cp .env.template .env\n# Fill in a provider key and a strong JWT_SECRET_KEY\n\nmake up\n# or: docker compose -f docker/docker-compose.yaml up -d\n# App: http://localhost:2026`} />

      <H2>{t.prodCmdsH2}</H2>
      <CodeBlock lang="bash" code={`make down     # stop + remove production containers\nmake logs     # tail all production logs\nmake restart  # restart all containers\nmake ps       # show container status`} />

      <H2>{t.profilesH2}</H2>
      <P>{t.profilesP}</P>

      <P><strong>{t.aioTitle}</strong> — {t.aioDesc}</P>
      <CodeBlock lang="bash" code={`make dev-sandbox    # or: make prod-sandbox`} />

      <P><strong>{t.k8sTitle}</strong> — {t.k8sDesc}</P>
      <CodeBlock lang="bash" code={`make dev-provisioner    # or: make prod-provisioner\n\n# Then in config.yml:\n# sandbox:\n#   mode: k8s\n#   provisioner_url: http://provisioner:8002`} />

      <NextSteps>
        <NextStepCard id="configuration" onNavigate={onNavigate} title="Configuration" desc={t.nextConfig} />
        <NextStepCard id="deploy-env" onNavigate={onNavigate} title="Environment Variables" desc={t.nextEnv} />
      </NextSteps>
    </div>
  );
}
