import { H1, H2, P, UL, LI, Callout, CodeBlock, ApiRow, DocLink, NextSteps, NextStepCard, type DocPageProps } from "./_shared";

const TXT = {
  en: {
    intro: "Meetings (renamed from \"Conversations\") is the message log for a task or company. The name suggests something you'd start deliberately, but in practice most Messages in a Meeting are written automatically: every turn a Staff produces while a Department runs a Task lands here as a Message row, right alongside any explicit human messages you typed in. It's what the chat view in the UI reads from — the transcript of everything that was said, by anyone, human or Staff.",
    sourcesH2: "What actually writes a Message",
    sourcesP: "Three things append to a Meeting, and it's worth being explicit about all three because they're easy to conflate:",
    sources: [
      { h: "Staff turns during a run.", d: "Every time a Staff member produces output as part of a Department's topology executing a Task, that output is persisted as a Message. This is the bulk of what you'll see in most Meetings." },
      { h: "Human messages sent from the UI.", d: "Whatever you type in the chat view — including a mid-run interjection while a Task is actively streaming — is posted the same way, through the same POST /api/v1/meetings endpoint." },
      { h: "Inbound platform messages.", d: "A message that arrives through a Connection (Discord, WhatsApp, etc.) is routed to a Department or Staff and, once processed, also becomes part of the same Message log — see Connections for the full delivery path." },
    ],
    schemaH2: "Schema",
    schemaP: "task_id is optional — a message can be scoped to a task's run, or stand alone as a general company-level message that isn't tied to any particular execution.",
    liveH2: "Live streaming vs. the persisted log",
    liveP: "While a Task is actively running, you watch it over Server-Sent Events — turn-by-turn, with intermediate event types like llm_request_start and turn_complete giving you visibility into what's happening before the final text even arrives. That stream is ephemeral: it's how you watch something unfold in real time. The Meeting is what's left afterward — the permanent, ordered record of every Message that stream ever produced, which is exactly what lets you close the tab mid-run, come back later, and scroll back through the whole conversation as if you'd been watching the whole time.",
    filesH2: "File attachments",
    filesP: "A meeting thread can carry file attachments alongside messages — useful for a Staff to hand back a generated document (a report, a spreadsheet, an export) or for a human to drop reference files into the conversation for Staff to read.",
    restH2: "REST API",
    nextH2: "Next",
    nextTasks: "How a Task's run actually produces the turns that populate a Meeting.",
    nextPlayground: "Test a Staff or Department's chat behavior without a formal Task.",
  },
  vi: {
    intro: "Meetings (đổi tên từ \"Conversations\") là nhật ký tin nhắn cho một task hoặc công ty. Cái tên gợi ý một thứ bạn chủ động bắt đầu, nhưng trên thực tế phần lớn Message trong một Meeting được ghi tự động: mỗi lượt mà một Staff tạo ra trong khi một Department chạy một Task đều trở thành một dòng Message ở đây, nằm cạnh bất kỳ tin nhắn nào của con người mà bạn gõ vào một cách rõ ràng. Đây chính là nguồn dữ liệu mà khung chat trên UI đọc từ đó — bản ghi đầy đủ mọi thứ đã được nói, bởi bất kỳ ai, người hay Staff.",
    sourcesH2: "Những gì thực sự ghi ra một Message",
    sourcesP: "Có ba nguồn thêm vào một Meeting, và đáng để nói rõ cả ba vì chúng dễ bị nhầm lẫn với nhau:",
    sources: [
      { h: "Lượt của Staff trong một phiên chạy.", d: "Mỗi khi một Staff tạo ra output như một phần của việc topology thuộc Department thực thi một Task, output đó được lưu lại thành một Message. Đây là phần lớn những gì bạn sẽ thấy trong hầu hết các Meeting." },
      { h: "Tin nhắn của con người gửi từ UI.", d: "Bất cứ điều gì bạn gõ trong khung chat — kể cả một sự can thiệp giữa chừng khi một Task đang stream — đều được đăng theo cùng cách, qua cùng endpoint POST /api/v1/meetings." },
      { h: "Tin nhắn đến từ nền tảng bên ngoài.", d: "Một tin nhắn đến qua một Connection (Discord, WhatsApp, v.v.) được định tuyến tới một Department hoặc Staff, và sau khi được xử lý, cũng trở thành một phần của cùng nhật ký Message này — xem Connections để biết toàn bộ đường đi." },
    ],
    schemaH2: "Schema",
    schemaP: "task_id là tùy chọn — một tin nhắn có thể gắn với phiên chạy của một task, hoặc đứng độc lập như một tin nhắn cấp công ty chung không gắn với bất kỳ lần thực thi cụ thể nào.",
    liveH2: "Stream trực tiếp so với nhật ký được lưu lại",
    liveP: "Trong khi một Task đang chạy, bạn theo dõi nó qua Server-Sent Events — từng lượt một, với các loại sự kiện trung gian như llm_request_start và turn_complete cho bạn thấy điều gì đang diễn ra trước cả khi văn bản cuối cùng đến. Stream đó là nhất thời: đó là cách bạn theo dõi điều gì đó diễn ra trong thời gian thực. Meeting là những gì còn lại sau đó — bản ghi vĩnh viễn, có thứ tự của mọi Message mà stream đó từng tạo ra, chính điều này cho phép bạn đóng tab giữa chừng, quay lại sau, và cuộn lại xem toàn bộ cuộc trò chuyện như thể bạn đã theo dõi suốt từ đầu.",
    filesH2: "Tệp đính kèm",
    filesP: "Một luồng meeting có thể mang theo tệp đính kèm song song với tin nhắn — hữu ích khi một Staff trả lại một tài liệu được tạo ra (báo cáo, bảng tính, file export) hoặc khi người dùng thả file tham khảo vào cuộc trò chuyện để Staff đọc.",
    restH2: "REST API",
    nextH2: "Tiếp theo",
    nextTasks: "Cách phiên chạy của một Task thực sự tạo ra các lượt lấp đầy một Meeting.",
    nextPlayground: "Thử nghiệm hành vi chat của một Staff hoặc Department mà không cần một Task chính thức.",
  },
  zh: {
    intro: "Meetings（由\"Conversations\"更名而来）是某个任务或公司的消息日志。这个名字听起来像是需要您主动发起的东西，但实际上一次 Meeting 中的大多数 Message 都是自动写入的：Department 执行 Task 期间，员工产生的每一轮输出都会作为一条 Message 记录落在这里，与您明确输入的任何人工消息并排存在。UI 中的聊天视图正是从这里读取数据的——它是所有人（无论是人还是员工）说过的一切的完整记录。",
    sourcesH2: "究竟是什么在写入 Message",
    sourcesP: "有三种来源会向一个 Meeting 追加内容，值得把三者都说清楚，因为它们很容易被混为一谈：",
    sources: [
      { h: "运行过程中的员工轮次。", d: "每当员工作为 Department 拓扑执行 Task 的一部分产生输出时，该输出都会作为 Message 被持久化。这构成了您在大多数 Meeting 中看到内容的主体。" },
      { h: "从 UI 发送的人工消息。", d: "您在聊天视图中输入的任何内容——包括在 Task 正在流式运行时的中途插话——都会通过同样的 POST /api/v1/meetings 接口以同样的方式发布。" },
      { h: "来自外部平台的入站消息。", d: "通过某个 Connection（Discord、WhatsApp 等）到达的消息会被路由给某个 Department 或员工，处理完成后同样会成为这条 Message 日志的一部分——完整的投递路径见 Connections 页面。" },
    ],
    schemaH2: "数据结构",
    schemaP: "task_id 是可选的——一条消息可以归属于某个任务的运行，也可以作为独立的、不关联任何具体执行的公司级消息存在。",
    liveH2: "实时流式传输与持久化日志",
    liveP: "当一个 Task 正在运行时，您通过 Server-Sent Events 逐轮观看它——诸如 llm_request_start 和 turn_complete 之类的中间事件类型，会在最终文本到达之前就让您看到正在发生的事情。这条流是短暂的：它是您实时观看事情展开的方式。而 Meeting 是之后留下来的东西——那条流曾经产生的每一条 Message 的永久、有序记录，这正是让您可以中途关闭标签页、之后再回来、把整段对话从头滚动看一遍（就像您一直在旁观一样）的原因所在。",
    filesH2: "文件附件",
    filesP: "一个 meeting 会话线程可以与消息一起携带文件附件——便于员工回传生成的文档（报告、表格、导出文件），或让人工把参考文件放入对话中供员工阅读。",
    restH2: "REST API",
    nextH2: "下一步",
    nextTasks: "Task 的运行究竟如何产生填充 Meeting 的那些轮次。",
    nextPlayground: "在没有正式 Task 的情况下测试员工或部门的聊天行为。",
  },
  ja: {
    intro: "Meetings（旧称「Conversations」）は、タスクや会社のメッセージログです。この名前は意図的に始めるものを連想させますが、実際には Meeting 内のほとんどの Message は自動的に書き込まれます。Department が Task を実行している間に Staff が生成する各ターンはここに Message レコードとして記録され、あなたが明示的に入力した人間のメッセージと並びます。UI のチャットビューはここから読み込んでいます——人間かスタッフかを問わず、誰かが発したすべての完全な記録です。",
    sourcesH2: "実際に Message を書き込むもの",
    sourcesP: "Meeting に追記する経路は 3 つあり、混同しやすいのですべて明示しておく価値があります。",
    sources: [
      { h: "実行中のスタッフのターン。", d: "Department のトポロジーが Task を実行する一部としてスタッフが出力を生成するたびに、その出力は Message として永続化されます。これがほとんどの Meeting で見る内容の大部分を占めます。" },
      { h: "UI から送信された人間のメッセージ。", d: "チャットビューで入力する内容は——Task がストリーミング中の割り込みも含めて——同じ POST /api/v1/meetings エンドポイントを通じて同じように投稿されます。" },
      { h: "外部プラットフォームからのインバウンドメッセージ。", d: "Connection（Discord、WhatsApp など）経由で届いたメッセージは Department またはスタッフにルーティングされ、処理が完了すると同様に同じ Message ログの一部になります——配信経路の詳細は Connections ページを参照。" },
    ],
    schemaH2: "スキーマ",
    schemaP: "task_id は任意です——メッセージはタスクの実行に紐づくこともあれば、特定の実行に紐づかない会社レベルの一般メッセージとして単独で存在することもあります。",
    liveH2: "ライブストリーミングと永続化されたログ",
    liveP: "Task が実行中の間は、Server-Sent Events を通じてターンごとに観察します——llm_request_start や turn_complete のような中間イベントタイプによって、最終的なテキストが届く前から何が起きているかが見えます。このストリームは一時的なもので、リアルタイムで物事が展開する様子を見るための手段です。Meeting はその後に残るもの——そのストリームがかつて生成したすべての Message の、永続的で順序づけられた記録です。だからこそ、実行途中でタブを閉じ、後で戻ってきて、まるでずっと見ていたかのように会話全体をスクロールして振り返ることができます。",
    filesH2: "ファイル添付",
    filesP: "meeting のスレッドはメッセージと並んでファイル添付を保持できます——スタッフが生成したドキュメント（レポート、表計算、エクスポートファイル）を返す際や、人間が参考ファイルを会話に投下してスタッフに読ませる際に便利です。",
    restH2: "REST API",
    nextH2: "次に読む",
    nextTasks: "Task の実行が Meeting を埋めるターンを実際にどう生み出すか。",
    nextPlayground: "正式な Task なしでスタッフや部門のチャット挙動をテストする。",
  },
} as const;

export default function MeetingsDoc({ lang, onNavigate }: DocPageProps) {
  const t = TXT[lang];
  return (
    <div>
      <H1>Meetings</H1>
      <P>{t.intro}</P>

      <H2>{t.sourcesH2}</H2>
      <P>{t.sourcesP}</P>
      <UL>
        {t.sources.map(({ h, d }) => (
          <LI key={h}><strong>{h}</strong> {d}</LI>
        ))}
      </UL>

      <H2>{t.schemaH2}</H2>
      <P>{t.schemaP}</P>
      <CodeBlock lang="python" title="server/domain/models.py" code={`@dataclass(frozen=True, slots=True)\nclass Message:\n    id: str\n    staff_id: str\n    content: str\n    timestamp: datetime\n    task_id: str | None = None`} />

      <H2>{t.liveH2}</H2>
      <P>{t.liveP}</P>

      <H2>{t.filesH2}</H2>
      <P>{t.filesP}</P>
      <div className="rounded-xl border border-border/60 overflow-hidden my-4 divide-y divide-border/40">
        <ApiRow method="GET" path="/api/v1/meetings/{task_id}/files" desc="List a meeting's file attachments" />
        <ApiRow method="POST" path="/api/v1/meetings/{task_id}/files" desc="Upload a file attachment" />
        <ApiRow method="GET" path="/api/v1/meetings/{task_id}/files/download" desc="Download an attachment" />
      </div>

      <H2>{t.restH2}</H2>
      <div className="rounded-xl border border-border/60 overflow-hidden my-4 divide-y divide-border/40">
        <ApiRow method="GET" path="/api/v1/meetings" desc="List messages (filterable by task/company)" />
        <ApiRow method="POST" path="/api/v1/meetings" desc="Post a message" />
      </div>
      <CodeBlock lang="bash" title="Post a message" code={`curl -X POST http://localhost:8000/api/v1/meetings \\\n  -H "Content-Type: application/json" \\\n  -d '{"staffId":"staff_abc","content":"Draft is ready for review.","taskId":"task_123"}'`} />

      <H2>{t.nextH2}</H2>
      <NextSteps>
        <NextStepCard id="tasks" onNavigate={onNavigate} title="Tasks" desc={t.nextTasks} />
        <NextStepCard id="playground" onNavigate={onNavigate} title="Playground" desc={t.nextPlayground} />
      </NextSteps>
    </div>
  );
}
