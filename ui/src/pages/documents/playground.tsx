import { H1, H2, P, UL, LI, OL, OLI, Callout, CodeBlock, InlineCode, ApiRow, DocLink, NextSteps, NextStepCard, type DocPageProps } from "./_shared";

const TXT = {
  en: {
    lead1: "Before a Staff member or a Department is trusted with a real, tracked Task, it usually passes through the Playground first. The Playground (labeled \"Training\" in the sidebar) is an interactive chat interface for exercising a Staff or a Department exactly the way a real run would — same model calls, same tool calls, same streaming — but without any of the bookkeeping a real Task carries with it.",
    lead2: "That last part matters more than it sounds. A real Task writes a Task record, accumulates knowledge-graph entries, and attributes every token to a TokenUsageRecord for cost tracking. None of that happens in the Playground. You can send the same prompt fifty times while you're tuning a system_prompt, and it costs you fifty LLM calls, not fifty Tasks cluttering your Task Board.",

    modesH2: "Two testing modes, two different questions",
    modesP: "The Playground actually answers two different questions, and it's worth being precise about which one you're asking before you start:",
    modes: [
      { t: "Single staff — \"does this Staff member behave correctly on its own?\"", d: "Send a one-off prompt straight to one Staff and get a synchronous reply. There's no orchestration and no topology in play — just that Staff's model, system_prompt, and bound Skills, in isolation. This is the mode you want when you're not sure whether a bug is in the Staff's prompt or in how a Department is routing to it." },
      { t: "Full department run — \"does this topology actually coordinate correctly?\"", d: "Exercise the real topology — sequential, ring, mesh, supervisor, tree, or custom — end to end, watching every turn stream in live exactly as it would inside a real Task. This is the only way to catch problems that only exist at the coordination layer: a supervisor that never emits <FINAL_ANSWER>, a mesh hub that loops between two spokes, a ring that never terminates." },
    ],

    endpointsH2: "What each mode actually calls",
    endpointsP: "Single-staff mode calls the plain chat endpoint. Full-department mode calls the exact same staff-graph endpoints a real Task run uses — which is why a Department that works in the Playground will behave identically once it's wired into a Task, and vice versa.",

    interjectH2: "Interrupting a run mid-stream",
    interjectP: "While a full department run is streaming, you're not locked out until it finishes. You can inject a human message into the conversation without stopping it — useful for testing how a supervisor or a mesh hub reacts to a human course-correction partway through — or pause the whole run and resume it later. This is the same mechanism a real, human-in-the-loop Task uses; the Playground just gives you a cheap, disposable place to rehearse it.",

    debugH2: "A typical debugging session",
    debugP: "Say a Staff member keeps answering in a tone that doesn't match the company you're building. Here's roughly how that gets fixed:",
    debugSteps: [
      "Open the Playground, switch to single-staff mode, and send it a representative prompt to confirm the tone problem reproduces outside of a real Task.",
      "Open the Staff Builder in another tab and edit its system_prompt — tighten the instructions about tone, add an example of the voice you want.",
      "Re-send the same prompt in the Playground. Because single-staff mode talks to the live Staff record, no restart or redeploy is needed — the very next call uses the edited prompt.",
      "Once the tone is right in isolation, switch to full-department mode and re-run the same scenario through the actual topology, to confirm the fix survives being one node among several rather than the only voice in the room.",
    ],
    debugP2: "The same loop works for a Skill that isn't firing: confirm in single-staff mode that the Staff even attempts to call it, check that tool_name on the Skill matches a real built-in tool (or that a custom-js Skill's code doesn't throw), and re-test.",

    whenH2: "When to reach for it instead of a real Task",
    whenP: "Use the Playground to refine a system_prompt or verify a Skill call behaves as expected, before wiring either into a real, multi-step Task that other people might be watching run. Once a Department is behaving the way you want in the Playground, creating the real ",
    tasksLink: "Task",
    whenP2: " is the natural next step — everything you just validated carries over unchanged, because it's the same code path underneath.",
  },
  vi: {
    lead1: "Trước khi một Staff hoặc một Department được tin tưởng giao cho một Task thật, có theo dõi đầy đủ, nó thường đi qua Playground trước. Playground (được gắn nhãn \"Training\" trên thanh điều hướng) là giao diện chat tương tác để thử nghiệm một Staff hoặc một Department đúng như cách nó chạy thật — cùng lệnh gọi model, cùng lệnh gọi tool, cùng streaming — nhưng không có bất kỳ sổ sách kế toán nào mà một Task thật mang theo.",
    lead2: "Điều cuối cùng đó quan trọng hơn nghe có vẻ vậy. Một Task thật ghi ra một bản ghi Task, tích lũy các mục trong knowledge graph, và gán từng token vào một TokenUsageRecord để theo dõi chi phí. Không điều gì trong số đó xảy ra ở Playground. Bạn có thể gửi cùng một prompt năm mươi lần trong lúc tinh chỉnh system_prompt, và cái giá phải trả là năm mươi lệnh gọi LLM, không phải năm mươi Task làm rối Task Board của bạn.",

    modesH2: "Hai chế độ thử nghiệm, hai câu hỏi khác nhau",
    modesP: "Playground thực ra trả lời hai câu hỏi khác nhau, và đáng để xác định rõ bạn đang hỏi câu nào trước khi bắt đầu:",
    modes: [
      { t: "Một staff đơn lẻ — \"Staff này có hành xử đúng khi đứng một mình không?\"", d: "Gửi thẳng một prompt một lần tới một Staff và nhận phản hồi đồng bộ. Không có orchestration, không có topology tham gia — chỉ là model, system_prompt, và các Skill đã gắn của Staff đó, đứng riêng lẻ. Đây là chế độ bạn cần khi không chắc lỗi nằm ở prompt của Staff hay ở cách một Department đang định tuyến tới nó." },
      { t: "Chạy toàn bộ department — \"topology này có thực sự phối hợp đúng không?\"", d: "Chạy thật topology — sequential, ring, mesh, supervisor, tree, hoặc custom — từ đầu đến cuối, xem từng lượt stream trực tiếp y hệt như khi chạy trong một Task thật. Đây là cách duy nhất để bắt được các vấn đề chỉ tồn tại ở tầng phối hợp: một supervisor không bao giờ phát ra <FINAL_ANSWER>, một hub mesh lặp vô hạn giữa hai spoke, một ring không bao giờ kết thúc." },
    ],

    endpointsH2: "Mỗi chế độ thực sự gọi gì",
    endpointsP: "Chế độ một staff gọi endpoint chat đơn giản. Chế độ chạy cả department gọi đúng những endpoint staff-graph mà một Task thật sử dụng — đó là lý do vì sao một Department chạy đúng trong Playground sẽ hành xử y hệt khi được gắn vào một Task, và ngược lại.",

    interjectH2: "Ngắt một phiên chạy giữa chừng",
    interjectP: "Trong lúc một phiên chạy cả department đang stream, bạn không bị khóa cho đến khi nó kết thúc. Bạn có thể chèn một tin nhắn của người dùng vào cuộc hội thoại mà không cần dừng nó lại — hữu ích để kiểm tra cách một supervisor hay một hub mesh phản ứng khi con người can thiệp giữa chừng — hoặc tạm dừng toàn bộ phiên chạy và tiếp tục sau. Đây là cùng cơ chế mà một Task thật, có con người can thiệp, sử dụng; Playground chỉ cho bạn một nơi rẻ và dùng-rồi-bỏ để tập dượt trước.",

    debugH2: "Một phiên gỡ lỗi điển hình",
    debugP: "Giả sử một Staff cứ trả lời với giọng điệu không khớp với công ty bạn đang xây dựng. Đây là cách nó thường được sửa:",
    debugSteps: [
      "Mở Playground, chuyển sang chế độ một staff, và gửi một prompt tiêu biểu để xác nhận vấn đề giọng điệu tái hiện được bên ngoài một Task thật.",
      "Mở Staff Builder ở một tab khác và chỉnh sửa system_prompt của nó — siết chặt chỉ dẫn về giọng điệu, thêm một ví dụ về văn phong bạn muốn.",
      "Gửi lại cùng prompt đó trong Playground. Vì chế độ một staff nói chuyện trực tiếp với bản ghi Staff đang sống, không cần khởi động lại hay triển khai lại — lệnh gọi tiếp theo ngay lập tức dùng prompt đã sửa.",
      "Khi giọng điệu đã đúng khi đứng riêng, chuyển sang chế độ chạy cả department và chạy lại đúng kịch bản đó qua topology thật, để xác nhận bản sửa vẫn đúng khi là một trong nhiều node chứ không phải giọng nói duy nhất trong phòng.",
    ],
    debugP2: "Vòng lặp tương tự áp dụng cho một Skill không được gọi: xác nhận ở chế độ một staff rằng Staff thậm chí có cố gọi nó không, kiểm tra tool_name trên Skill có khớp với một tool có sẵn thật hay không (hoặc một Skill custom-js có code không bị lỗi), rồi thử lại.",

    whenH2: "Khi nào nên dùng nó thay vì một Task thật",
    whenP: "Dùng Playground để tinh chỉnh một system_prompt hoặc xác nhận một lệnh gọi Skill hoạt động đúng như mong đợi, trước khi gắn chúng vào một Task thật, nhiều bước, mà người khác có thể đang theo dõi. Khi một Department đã hành xử đúng như bạn muốn trong Playground, tạo ",
    tasksLink: "Task",
    whenP2: " thật là bước tiếp theo tự nhiên — mọi thứ bạn vừa xác nhận sẽ giữ nguyên, vì đó là cùng một đường code bên dưới.",
  },
  zh: {
    lead1: "在一个 Staff 或一个 Department 被真正托付给一个真实、可追踪的 Task 之前，它通常会先经过 Playground。Playground（在侧边栏中标记为「Training」）是一个交互式聊天界面，用于按照真实运行完全相同的方式来试运行一个 Staff 或一个 Department——相同的模型调用、相同的工具调用、相同的流式传输——但不带真实 Task 所附带的任何簿记。",
    lead2: "最后这一点比听起来更重要。一个真实的 Task 会写入一条 Task 记录，累积知识图谱条目，并将每一个 token 归因到一条 TokenUsageRecord 中用于成本跟踪。这些在 Playground 中都不会发生。您可以在调优 system_prompt 时把同一个 prompt 发送五十次，代价是五十次 LLM 调用，而不是把您的 Task Board 塞满五十个 Task。",

    modesH2: "两种测试模式，两个不同的问题",
    modesP: "Playground 实际上回答两个不同的问题，在开始之前先弄清楚自己在问哪一个是值得的：",
    modes: [
      { t: "单个员工 ——「这个 Staff 单独工作时表现是否正确？」", d: "把一次性的 prompt 直接发送给某个 Staff，同步获得回复。这里没有编排、没有拓扑——只有该 Staff 独立的模型、system_prompt 和已绑定的 Skills。当您不确定问题出在 Staff 的 prompt 本身，还是出在 Department 如何路由到它时，就该用这个模式。" },
      { t: "完整部门运行 ——「这个拓扑是否真的能正确协调？」", d: "端到端地实际运行拓扑——sequential、ring、mesh、supervisor、tree 或 custom——实时观看每一回合的流式输出，与在真实 Task 中运行完全一致。这是捕捉那些只存在于协调层问题的唯一方式：一个从不发出 <FINAL_ANSWER> 的 supervisor、一个在两个 spoke 之间循环的 mesh hub、一个永不终止的 ring。" },
    ],

    endpointsH2: "每种模式实际调用什么",
    endpointsP: "单员工模式调用普通的 chat 接口。完整部门运行模式调用与真实 Task 运行完全相同的 staff-graph 接口——这正是为什么一个在 Playground 中运行正常的 Department，一旦接入 Task 后行为完全一致，反之亦然。",

    interjectH2: "在流式运行中途插话",
    interjectP: "在完整部门运行流式进行时，您并不会被锁在外面直到它结束。您可以在不中断的情况下向对话中插入一条人工消息——适合用来测试 supervisor 或 mesh hub 在运行到一半被人类纠正方向时的反应——或者直接暂停整个运行，稍后再恢复。这与真实的、有人工介入的 Task 所使用的机制完全相同；Playground 只是给您一个廉价、可随时丢弃的地方来提前演练。",

    debugH2: "一次典型的调试过程",
    debugP: "假设某个 Staff 一直以与您正在构建的公司不符的语气作答。以下是大致的修复过程：",
    debugSteps: [
      "打开 Playground，切换到单员工模式，发送一个具有代表性的 prompt，确认语气问题在真实 Task 之外也能重现。",
      "在另一个标签页打开 Staff Builder，编辑其 system_prompt——收紧关于语气的指示，添加一个您想要的语气示例。",
      "在 Playground 中重新发送同一个 prompt。由于单员工模式直接与实时的 Staff 记录对话，无需重启或重新部署——紧接着的下一次调用就会使用编辑后的 prompt。",
      "一旦语气在独立测试中正确了，切换到完整部门运行模式，通过真实拓扑重新运行同一场景，确认这个修复在成为多个节点之一而非房间里唯一的声音时依然成立。",
    ],
    debugP2: "同样的循环也适用于没有被触发的 Skill：先在单员工模式下确认 Staff 是否真的尝试调用它，检查该 Skill 的 tool_name 是否与某个真实的内置工具匹配（或者某个 custom-js Skill 的代码是否报错），然后重新测试。",

    whenH2: "什么时候该用它而不是真实 Task",
    whenP: "在把一个 system_prompt 或一次 Skill 调用接入真实的、可能有其他人正在关注的多步骤 Task 之前，先用 Playground 打磨和验证。一旦一个 Department 在 Playground 中的表现符合预期，创建真实的",
    tasksLink: "Task",
    whenP2: "就是自然而然的下一步——您刚刚验证过的一切都会原样延续，因为底层走的是同一条代码路径。",
  },
  ja: {
    lead1: "Staff や Department が実際に追跡される本物の Task を任される前に、たいてい最初に Playground を通ります。Playground（サイドバーでは「Training」と表示）は、実際の実行とまったく同じ方法——同じモデル呼び出し、同じツール呼び出し、同じストリーミング——で Staff や Department を試す対話型チャットインターフェースですが、実際の Task に伴うあらゆる帳簿処理を一切伴いません。",
    lead2: "この最後の点は見た目以上に重要です。実際の Task は Task レコードを書き込み、ナレッジグラフのエントリを蓄積し、コスト追跡のためにすべてのトークンを TokenUsageRecord に帰属させます。これらは Playground では一切起こりません。system_prompt を調整している間、同じプロンプトを 50 回送っても、かかるコストは 50 回の LLM 呼び出しだけで、Task Board を埋め尽くす 50 個の Task にはなりません。",

    modesH2: "2 つのテストモード、2 つの異なる問い",
    modesP: "Playground は実際には 2 つの異なる問いに答えます。始める前に、自分がどちらを問おうとしているのかをはっきりさせておく価値があります。",
    modes: [
      { t: "単一スタッフ ——「このスタッフは単独で正しく振る舞うか？」", d: "1 回限りのプロンプトを特定の Staff に直接送信し、同期的に応答を受け取ります。オーケストレーションもトポロジーも関与しません——そのスタッフ単体のモデル、system_prompt、紐づく Skills だけです。バグがスタッフのプロンプト自体にあるのか、それとも Department がそこへルーティングする方法にあるのか確信が持てないときに使うモードです。" },
      { t: "部門全体の実行 ——「このトポロジーは実際に正しく協調するか？」", d: "実際のトポロジー——sequential、ring、mesh、supervisor、tree、custom——をエンドツーエンドで実行し、実際の Task 実行時と同じように各ターンのストリーミングをリアルタイムで確認します。<FINAL_ANSWER> を決して出さない supervisor、2 つの spoke の間でループする mesh hub、決して終了しない ring——協調レイヤーにしか存在しない問題を捉える唯一の方法です。" },
    ],

    endpointsH2: "各モードが実際に呼び出すもの",
    endpointsP: "単一スタッフモードは通常の chat エンドポイントを呼び出します。部門全体の実行モードは、実際の Task 実行とまったく同じ staff-graph エンドポイント群を呼び出します——だからこそ、Playground で正しく動く Department は、Task に組み込まれた後もまったく同じように振る舞い、その逆も同様です。",

    interjectH2: "ストリーミングの途中で割り込む",
    interjectP: "部門全体の実行がストリーミング中でも、終わるまで締め出されるわけではありません。実行を止めずに人間のメッセージを会話に挿入できます——supervisor や mesh hub が途中で人間による軌道修正にどう反応するかをテストするのに便利です——あるいは実行全体を一時停止し、後で再開することもできます。これは、人間が介在する実際の Task が使うのと同じ仕組みであり、Playground は単に、それを事前に安価かつ使い捨てで練習できる場所を提供しているだけです。",

    debugH2: "典型的なデバッグセッション",
    debugP: "あるスタッフが、構築中の会社にそぐわないトーンで答え続けているとします。おおよそ次のように修正します。",
    debugSteps: [
      "Playground を開いて単一スタッフモードに切り替え、代表的なプロンプトを送信して、トーンの問題が実際の Task の外でも再現することを確認する。",
      "別のタブで Staff Builder を開き、system_prompt を編集する——トーンに関する指示を厳密にし、望む口調の例を追加する。",
      "Playground で同じプロンプトを再送信する。単一スタッフモードは生きた Staff レコードと直接やり取りするため、再起動もデプロイも不要です——次の呼び出しから即座に編集後のプロンプトが使われます。",
      "単独でトーンが正しくなったら、部門全体の実行モードに切り替え、同じシナリオを実際のトポロジーで再実行し、その修正が部屋の中で唯一の声ではなく複数ノードの 1 つになっても成立することを確認する。",
    ],
    debugP2: "呼び出されない Skill についても同じループが使えます。まず単一スタッフモードで、スタッフがそもそもそれを呼び出そうとしているかを確認し、その Skill の tool_name が実在する組み込みツールと一致しているか（あるいは custom-js の Skill のコードがエラーを起こしていないか）を確認して、再テストします。",

    whenH2: "実際の Task の代わりにいつ使うか",
    whenP: "system_prompt を調整したり、Skill 呼び出しが期待どおりに動くかを確認したりする際は、他の人が見ているかもしれない実際の複数ステップの Task に組み込む前に、Playground で試してください。Department が Playground で望みどおりに振る舞うようになったら、実際の",
    tasksLink: "Task",
    whenP2: "を作成するのが自然な次のステップです——検証済みのものはすべてそのまま引き継がれます。裏側では同じコードパスが使われているからです。",
  },
} as const;

export default function PlaygroundDoc({ lang, onNavigate }: DocPageProps) {
  const t = TXT[lang];
  return (
    <div>
      <H1>Playground</H1>
      <P>{t.lead1}</P>
      <P>{t.lead2}</P>

      <H2>{t.modesH2}</H2>
      <P>{t.modesP}</P>
      <UL>
        {t.modes.map(({ t: title, d }) => (
          <LI key={title}><strong>{title}</strong> {d}</LI>
        ))}
      </UL>

      <H2>{t.endpointsH2}</H2>
      <P>{t.endpointsP}</P>
      <div className="rounded-xl border border-border/60 overflow-hidden my-4 divide-y divide-border/40">
        <ApiRow method="POST" path="/api/v1/llm/chat" desc="Send a prompt to one specific staff" />
        <ApiRow method="POST" path="/api/v1/llm/staff-graph/run-stream" desc="Run a department's topology, streamed (SSE)" />
      </div>
      <CodeBlock lang="json" title="POST /api/v1/llm/chat" code={`{\n  "prompt": "What are the top Python web frameworks?",\n  "staffId": "staff_abc123"\n}`} />

      <H2>{t.interjectH2}</H2>
      <P>{t.interjectP}</P>
      <div className="rounded-xl border border-border/60 overflow-hidden my-4 divide-y divide-border/40">
        <ApiRow method="POST" path="/api/v1/llm/staff-graph/interject" desc="Merge a human message into an in-progress run" />
        <ApiRow method="POST" path="/api/v1/llm/staff-graph/pause" desc="Pause an in-progress run" />
        <ApiRow method="POST" path="/api/v1/llm/staff-graph/resume" desc="Resume a paused run" />
      </div>

      <H2>{t.debugH2}</H2>
      <P>{t.debugP}</P>
      <OL>
        {t.debugSteps.map((s, i) => <OLI key={i} n={i + 1}>{s}</OLI>)}
      </OL>
      <P>{t.debugP2}</P>

      <H2>{t.whenH2}</H2>
      <P>
        {t.whenP}
        <DocLink id="tasks" onNavigate={onNavigate}>{t.tasksLink}</DocLink>
        {t.whenP2}
      </P>
      <Callout type="tip">
        <InlineCode>system_prompt</InlineCode> · <InlineCode>skill_ids</InlineCode> — the two things you're almost always iterating on in the Playground.
      </Callout>

      <NextSteps>
        <NextStepCard id="staff" onNavigate={onNavigate} title="Staff" desc={lang === "vi" ? "Schema và system_prompt của một Staff." : lang === "zh" ? "Staff 的数据结构与 system_prompt。" : lang === "ja" ? "Staff のスキーマと system_prompt。" : "The Staff schema and system_prompt."} />
        <NextStepCard id="skills" onNavigate={onNavigate} title="Skills" desc={lang === "vi" ? "Gắn công cụ vào một Staff." : lang === "zh" ? "为 Staff 绑定工具。" : lang === "ja" ? "スタッフにツールを紐づける。" : "Bind tools to a Staff member."} />
        <NextStepCard id="departments" onNavigate={onNavigate} title="Departments" desc={lang === "vi" ? "Sáu topology mà một department có thể chạy." : lang === "zh" ? "部门可运行的六种拓扑。" : lang === "ja" ? "部門が実行できる 6 つのトポロジー。" : "The six topologies a department can run."} />
      </NextSteps>
    </div>
  );
}
