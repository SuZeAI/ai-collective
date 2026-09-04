import { H1, H2, P, OL, OLI, Callout, CodeBlock, InlineCode, DocLink, NextSteps, NextStepCard, type DocPageProps } from "./_shared";

const TXT = {
  en: {
    intro: "A Department sitting idle isn't doing anything — a Task is what actually puts it to work. This guide creates a Task against the \"Research Team\" department from the previous guide, watches it run, and shows what's left behind once it's done.",
    stepsH2: "From creation to completion",
    step1: "Open Task Board inside the company, click New Task, give it a title and description, and assign it to the Research Team department — or, if you want to bypass the topology entirely and talk to one specific staff member, set assignee_id instead of department_id. Priority, due_date, and labels are the same Jira-style fields available on every Task; set them if useful, they don't affect execution.",
    step2: "Opening the task subscribes the UI to POST /api/v1/llm/staff-graph/run-stream, which streams Server-Sent Events turn by turn as the department's topology executes: context_building while it looks up prior knowledge-graph context, llm_request_start / llm_response_complete around each model call, turn_complete once a staff member finishes speaking, and — since this is a supervisor department — fanout_start/fanout_complete when the lead delegates. You'll see status flip between idle/thinking/active on each staff avatar in real time.",
    step3: "You're not locked out while it runs. Inject a message mid-run to redirect it (human-in-the-loop), or pause and resume it, from the same screen — both go through the same run-stream connection, no separate task restart needed.",
    step4: "Once the run finishes, every task has accumulated a knowledge graph — entities and relationships extracted from the conversation as staff worked through it. Fetch it directly to see what the department actually learned, independent of the final answer text.",
    restH2: "The REST equivalent",
    restP: "Same operation, without the UI:",
    graphH2: "Inspecting what the task learned",
    graphP: "There's no single-task GET by id — list tasks with GET /api/v1/tasks and filter client-side, or, once you have the id, pull its accumulated context directly:",
    restartH2: "Restarting a finished task",
    restartP: "Setting a completed or stopped task back to in-progress doesn't wipe anything — message history and the knowledge graph both survive, with a session-divider message inserted so it's clear where the new run picked up. If you genuinely want a clean slate, that's a separate, explicit, owner/admin-gated call:",
    restartCallout: "This distinction matters: restarting is the normal way to give a department more direction after it finishes (\"actually, also check the EU pricing page\"), while wiping history is a deliberate reset you reach for on purpose, not a side effect of restarting.",
    nextH2: "Next",
    nextSkills: "Give staff more tools before the next run.",
    nextPlayground: "Test a staff member or department interactively without creating a formal task.",
  },
  vi: {
    intro: "Một Department nằm không thì chẳng làm gì cả — Task mới là thứ thực sự đưa nó vào hoạt động. Hướng dẫn này tạo một Task cho department \"Research Team\" từ hướng dẫn trước, theo dõi nó chạy, và cho biết những gì còn lại sau khi hoàn tất.",
    stepsH2: "Từ lúc tạo đến khi hoàn tất",
    step1: "Mở Task Board bên trong công ty, bấm New Task, đặt tiêu đề và mô tả, rồi gán cho department Research Team — hoặc, nếu muốn bỏ qua hoàn toàn topology và làm việc trực tiếp với một staff cụ thể, đặt assignee_id thay vì department_id. priority, due_date, và labels là các trường kiểu Jira có sẵn trên mọi Task; đặt nếu cần, chúng không ảnh hưởng đến việc thực thi.",
    step2: "Mở task sẽ khiến UI đăng ký nhận POST /api/v1/llm/staff-graph/run-stream, phát Server-Sent Events theo từng lượt khi topology của department thực thi: context_building khi nó tra cứu ngữ cảnh từ knowledge graph trước đó, llm_request_start / llm_response_complete quanh mỗi lệnh gọi model, turn_complete khi một staff phát biểu xong — và vì đây là department supervisor — fanout_start/fanout_complete khi lead ủy quyền. Bạn sẽ thấy status chuyển giữa idle/thinking/active trên từng avatar staff theo thời gian thực.",
    step3: "Bạn không bị khóa lại trong khi nó chạy. Chèn một tin nhắn giữa chừng để điều hướng lại (human-in-the-loop), hoặc pause rồi resume, ngay trên cùng màn hình — cả hai đều đi qua cùng kết nối run-stream, không cần restart task riêng.",
    step4: "Khi phiên chạy kết thúc, mỗi task đã tích lũy một knowledge graph — các thực thể và quan hệ được trích xuất từ cuộc hội thoại khi staff xử lý nó. Lấy trực tiếp để xem department thực sự đã học được gì, độc lập với văn bản câu trả lời cuối cùng.",
    restH2: "Lệnh REST tương ứng",
    restP: "Cùng thao tác, không cần UI:",
    graphH2: "Xem những gì task đã học được",
    graphP: "Không có endpoint GET theo id cho một task đơn lẻ — liệt kê task bằng GET /api/v1/tasks rồi lọc phía client, hoặc khi đã có id, lấy trực tiếp ngữ cảnh đã tích lũy của nó:",
    restartH2: "Khởi động lại một task đã hoàn tất",
    restartP: "Đặt một task đã completed hoặc stopped trở lại in-progress không xóa bất cứ thứ gì — cả lịch sử tin nhắn lẫn knowledge graph đều được giữ lại, kèm một tin nhắn phân cách phiên (session-divider) được chèn vào để rõ ràng nơi phiên chạy mới bắt đầu. Nếu bạn thực sự muốn làm sạch hoàn toàn, đó là một lệnh riêng, tường minh, chỉ owner/admin mới được phép:",
    restartCallout: "Sự khác biệt này quan trọng: restart là cách bình thường để cho department thêm chỉ dẫn sau khi nó hoàn tất (\"à, kiểm tra thêm cả trang giá ở EU\"), còn xóa lịch sử là một lần reset có chủ đích bạn tự chọn thực hiện, không phải tác dụng phụ của việc restart.",
    nextH2: "Tiếp theo",
    nextSkills: "Cho staff thêm công cụ trước lần chạy tiếp theo.",
    nextPlayground: "Thử nghiệm một staff hoặc department tương tác mà không cần tạo task chính thức.",
  },
  zh: {
    intro: "空闲的 Department 什么都不会做——真正让它开始工作的是 Task。本指南针对上一篇指南中的 \"Research Team\" 部门创建一个 Task，观察其运行，并展示运行结束后留下了什么。",
    stepsH2: "从创建到完成",
    step1: "在公司内打开 Task Board，点击 New Task，填写标题和描述，然后分配给 Research Team 部门——或者，如果想完全跳过拓扑、直接与某个特定员工沟通，设置 assignee_id 而非 department_id。priority、due_date、labels 是每个 Task 都具备的 Jira 风格字段；如有需要可以设置，它们不影响执行本身。",
    step2: "打开任务会让 UI 订阅 POST /api/v1/llm/staff-graph/run-stream，随着部门拓扑的执行按回合流式推送 Server-Sent Events：查找此前知识图谱上下文时的 context_building，每次模型调用前后的 llm_request_start / llm_response_complete，某员工发言完毕时的 turn_complete——由于这是一个 supervisor 部门，lead 委派时还有 fanout_start/fanout_complete。您会看到每个员工头像的状态在 idle/thinking/active 之间实时切换。",
    step3: "运行期间您并非被锁在外面。可以在运行途中插入一条消息来重新引导它（人工介入），或在同一界面暂停并恢复——两者都通过同一个 run-stream 连接完成，无需单独重启任务。",
    step4: "运行结束后，每个任务都已经积累了一个知识图谱——员工在处理过程中从对话中提取的实体与关系。直接获取它，可以查看部门实际学到了什么，这与最终答案文本本身是独立的。",
    restH2: "对应的 REST 调用",
    restP: "相同操作，无需 UI：",
    graphH2: "查看任务学到了什么",
    graphP: "没有按 id 获取单个任务的 GET 接口——请用 GET /api/v1/tasks 列出任务并在客户端过滤，或者拿到 id 后直接获取其累积的上下文：",
    restartH2: "重启一个已完成的任务",
    restartP: "把一个 completed 或 stopped 的任务重新设为 in-progress 不会清除任何内容——消息历史和知识图谱都会保留，并插入一条会话分隔消息，清楚标明新一轮运行从哪里开始。如果您确实想要完全清空，那是一个单独的、显式的、仅限所有者/管理员的调用：",
    restartCallout: "这个区别很重要：重启是任务完成后给部门更多指示的常规方式（\"其实，再查一下欧盟定价页面\"），而清空历史是您主动选择执行的重置，而不是重启的副作用。",
    nextH2: "下一步",
    nextSkills: "在下一次运行前为员工添加更多工具。",
    nextPlayground: "无需创建正式任务即可交互式测试某个员工或部门。",
  },
  ja: {
    intro: "アイドル状態の Department は何もしません——実際にそれを動かすのが Task です。このガイドでは前のガイドの「Research Team」部門に対して Task を作成し、実行を見守り、完了後に何が残るかを示します。",
    stepsH2: "作成から完了まで",
    step1: "会社内で Task Board を開き、New Task をクリックしてタイトルと説明を入力し、Research Team 部門に割り当てます——トポロジーを完全にバイパスして特定のスタッフと直接やり取りしたい場合は、department_id の代わりに assignee_id を設定します。priority、due_date、labels はすべての Task が持つ Jira 風フィールドです。必要に応じて設定してください、実行自体には影響しません。",
    step2: "タスクを開くと UI は POST /api/v1/llm/staff-graph/run-stream を購読し、部門のトポロジーが実行されるにつれてターンごとに Server-Sent Events をストリーミングします：以前のナレッジグラフのコンテキストを検索する際の context_building、各モデル呼び出し前後の llm_request_start / llm_response_complete、あるスタッフの発言が完了した際の turn_complete——そしてこれは supervisor 部門なので、lead が委任する際の fanout_start/fanout_complete も。各スタッフのアバターの状態が idle/thinking/active の間でリアルタイムに切り替わるのが見えます。",
    step3: "実行中もロックアウトされるわけではありません。実行途中にメッセージを差し込んで方向転換したり（human-in-the-loop）、同じ画面から一時停止・再開したりできます——どちらも同じ run-stream 接続を通じて行われ、別途タスクを再起動する必要はありません。",
    step4: "実行が終わると、各タスクはナレッジグラフを蓄積しています——スタッフが処理する中で会話から抽出されたエンティティと関係です。最終的な回答のテキストとは独立して、部門が実際に何を学んだかを見るために直接取得できます。",
    restH2: "対応する REST 呼び出し",
    restP: "UI なしで同じ操作を行います：",
    graphH2: "タスクが学習した内容を確認する",
    graphP: "id で単一タスクを取得する GET はありません——GET /api/v1/tasks で一覧を取得してクライアント側でフィルタするか、id を得たら蓄積されたコンテキストを直接取得してください：",
    restartH2: "完了したタスクを再開する",
    restartP: "completed または stopped のタスクを in-progress に戻しても何も消去されません——メッセージ履歴とナレッジグラフの両方が保持され、新しい実行がどこから始まったかを明確にするセッション区切りメッセージが挿入されます。本当にまっさらな状態に戻したい場合は、それは別の、明示的な、owner/admin 限定の呼び出しです：",
    restartCallout: "この違いは重要です：再開はタスク完了後に部門へさらなる指示を与える通常の方法（「実は EU の価格ページも確認して」）であり、履歴の消去は意図的に選んで行うリセットであって、再開の副作用ではありません。",
    nextH2: "次に読む",
    nextSkills: "次の実行の前にスタッフへツールを追加する。",
    nextPlayground: "正式なタスクを作成せずに、スタッフや部門をインタラクティブにテストする。",
  },
} as const;

export default function GuideRunTaskDoc({ lang, onNavigate }: DocPageProps) {
  const t = TXT[lang];
  return (
    <div>
      <H1>Run a Task</H1>
      <P>{t.intro}</P>

      <H2>{t.stepsH2}</H2>
      <OL>
        <OLI n={1}>{t.step1}</OLI>
        <OLI n={2}>{t.step2}</OLI>
        <OLI n={3}>{t.step3}</OLI>
        <OLI n={4}>{t.step4}</OLI>
      </OL>

      <H2>{t.restH2}</H2>
      <P>{t.restP}</P>
      <CodeBlock lang="bash" title="POST /api/v1/tasks" code={`curl -X POST http://localhost:8000/api/v1/tasks \\\n  -H "Content-Type: application/json" \\\n  -d '{\n    "title": "Q3 market research",\n    "description": "Summarize competitor pricing changes this quarter.",\n    "department_id": "department_research_team",\n    "priority": "high"\n  }'`} />

      <H2>{t.graphH2}</H2>
      <P>{t.graphP}</P>
      <CodeBlock lang="bash" title="GET /api/v1/tasks/{id}/graph-context" code={`curl http://localhost:8000/api/v1/tasks/{task_id}/graph-context`} />

      <H2>{t.restartH2}</H2>
      <P>{t.restartP}</P>
      <CodeBlock lang="bash" title="Full history wipe (owner/admin only)" code={`curl -X DELETE http://localhost:8000/api/v1/tasks/{task_id}/history`} />
      <Callout type="tip">{t.restartCallout}</Callout>

      <H2>{t.nextH2}</H2>
      <NextSteps>
        <NextStepCard id="guide-skills" onNavigate={onNavigate} title="Add Skills & APIs" desc={t.nextSkills} />
        <NextStepCard id="playground" onNavigate={onNavigate} title="Playground" desc={t.nextPlayground} />
      </NextSteps>
    </div>
  );
}
