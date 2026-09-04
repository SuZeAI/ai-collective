import { H1, H2, P, UL, LI, Pill, Callout, CodeBlock, InlineCode, DocLink, NextSteps, NextStepCard, type DocPageProps } from "./_shared";

const TXT = {
  en: {
    intro1: "A Department groups Staff into a topology — a graph that decides who talks to whom, in what order, until the work is done. Picking the wrong topology is the single most common reason a department under- or over-performs, so this guide spends most of its time on that choice, not the mechanics of clicking Save.",
    intro2: "We'll build one concrete example: a \"Research Team\" department for a software company, meant to take an incoming research request, gather findings from a couple of angles, and hand back one synthesized answer.",
    step1H2: "1. Name the department and add staff",
    step1P: "Give it a name and description, then add two or more existing Staff members — create them first via ",
    step1P2: " or the AI Office Designer if you haven't already. For our Research Team: a lead Research Staff member, plus two specialist workers (one for web research, one for reading internal docs).",
    modesH2: "2. Pick a topology (mode)",
    modesP: "The mode determines how staff hand off work. Pick based on the shape of the workflow, not habit — each shape below is a genuinely different collaboration pattern, not a difficulty tier:",
    modes: [
      { m: "sequential", d: "A single staff member handles the whole request. Simplest, fastest, most predictable — good for a one-person job." },
      { m: "ring", d: "Staff take turns in a fixed circular order, each seeing the full history so far. Good for iterative refinement / debate." },
      { m: "mesh", d: "One hub staff routes work to whichever spoke staff fits, dynamically. Good for a coordinator dispatching to specialists." },
      { m: "supervisor", d: "A lead delegates to workers and synthesizes their results before answering. Good for classic manager/worker breakdowns." },
      { m: "tree", d: "Staff form a parent/child hierarchy; results roll up from leaves to root. Good for multi-level delegation." },
      { m: "custom", d: "You draw the graph yourself as a flow diagram — for anything the five built-in shapes don't fit." },
    ],
    chooseH2: "Why supervisor fits our example",
    chooseP: "Our Research Team's job — one lead breaking a request into a couple of independent lookups, then combining the results into a single answer — is exactly the manager/worker shape supervisor is built for. mesh would also technically work, but supervisor's explicit <DELEGATE_TO>/<FINAL_ANSWER> protocol makes the hand-off and synthesis steps more predictable than mesh's dynamic routing, which is worth it here since we want one clean synthesized answer, not an open-ended discussion.",
    step3H2: "3. Set max_steps",
    step3P: "max_steps caps the total number of graph steps/turns a run can take before it's forced to stop — a safety net against runaway loops, especially in ring and mesh modes where there's no natural termination condition besides this cap and any explicit end signal the staff emit. For a two-worker supervisor department, 6-8 steps is usually plenty (delegate → worker A → worker B → synthesize, with a little headroom).",
    step4H2: "4. Save",
    step4P: "Saving in the UI issues the same request shown below.",
    mistakesH2: "Common mistakes",
    mistakes: [
      "Picking mesh out of habit for anything with more than one staff member — mesh is for open-ended coordination between specialists, not simple divide-and-conquer, where supervisor is usually a better fit.",
      "Setting max_steps too low for the topology — ring and mesh departments especially can legitimately need several rounds before converging.",
      "Adding staff to a department without giving the lead (in supervisor/tree modes) a system prompt that actually explains when to delegate to each one.",
    ],
    fullSeeP1: "See the ",
    fullSeeP2: " concept page for the full picture of what each mode does under the hood, including the exact control blocks each one uses.",
    nextH2: "Next",
    nextRunTask: "Create a Task against this department and watch it run.",
  },
  vi: {
    intro1: "Một Department nhóm các Staff lại thành một topology — một đồ thị quyết định ai nói chuyện với ai, theo thứ tự nào, cho đến khi công việc hoàn tất. Chọn sai topology là lý do phổ biến nhất khiến một department hoạt động kém hoặc thừa thãi, nên hướng dẫn này dành phần lớn thời lượng cho lựa chọn đó, chứ không phải các thao tác bấm Lưu.",
    intro2: "Chúng ta sẽ xây một ví dụ cụ thể: department \"Research Team\" cho một công ty phần mềm, có nhiệm vụ nhận một yêu cầu nghiên cứu, thu thập thông tin từ vài góc độ, và trả về một câu trả lời tổng hợp.",
    step1H2: "1. Đặt tên department và thêm staff",
    step1P: "Đặt tên và mô tả, sau đó thêm từ hai Staff có sẵn trở lên — tạo trước qua ",
    step1P2: " hoặc AI Office Designer nếu chưa có. Với Research Team của chúng ta: một Research Staff làm lead, cộng hai worker chuyên biệt (một cho nghiên cứu web, một cho đọc tài liệu nội bộ).",
    modesH2: "2. Chọn một topology (mode)",
    modesP: "mode quyết định cách các staff chuyển giao công việc cho nhau. Hãy chọn dựa trên hình dạng của luồng công việc, không phải theo thói quen — mỗi hình dạng dưới đây là một kiểu cộng tác thực sự khác nhau, không phải một cấp độ khó:",
    modes: [
      { m: "sequential", d: "Một staff duy nhất xử lý toàn bộ yêu cầu. Đơn giản nhất, nhanh nhất, dễ đoán nhất — phù hợp việc một người làm." },
      { m: "ring", d: "Các staff luân phiên theo thứ tự vòng tròn cố định, mỗi lượt thấy toàn bộ lịch sử trước đó. Phù hợp tinh chỉnh lặp lại / tranh luận." },
      { m: "mesh", d: "Một staff trung tâm (hub) định tuyến công việc động đến staff nhánh (spoke) phù hợp. Phù hợp một điều phối viên phân việc cho các chuyên gia." },
      { m: "supervisor", d: "Một lead ủy quyền cho các worker rồi tổng hợp kết quả trước khi trả lời. Phù hợp mô hình quản lý/nhân viên cổ điển." },
      { m: "tree", d: "Các staff tạo thành cây cha/con; kết quả dồn từ lá lên gốc. Phù hợp ủy quyền nhiều tầng." },
      { m: "custom", d: "Bạn tự vẽ đồ thị dưới dạng flow diagram — cho những trường hợp năm dạng có sẵn không phù hợp." },
    ],
    chooseH2: "Vì sao supervisor phù hợp với ví dụ của chúng ta",
    chooseP: "Công việc của Research Team — một lead chia một yêu cầu thành vài tra cứu độc lập, rồi gộp kết quả thành một câu trả lời — chính xác là hình dạng manager/worker mà supervisor được thiết kế cho. mesh về mặt kỹ thuật cũng chạy được, nhưng giao thức <DELEGATE_TO>/<FINAL_ANSWER> tường minh của supervisor làm các bước chuyển giao và tổng hợp dễ đoán hơn so với định tuyến động của mesh — điều này đáng giá ở đây vì ta muốn một câu trả lời tổng hợp gọn gàng, không phải một cuộc thảo luận mở.",
    step3H2: "3. Đặt max_steps",
    step3P: "max_steps giới hạn tổng số bước/lượt của đồ thị mà một phiên chạy có thể thực hiện trước khi bị buộc dừng lại — một lớp an toàn chống vòng lặp chạy mãi, đặc biệt ở mode ring và mesh vốn không có điều kiện dừng tự nhiên ngoài giới hạn này và tín hiệu kết thúc rõ ràng do staff phát ra. Với một department supervisor hai worker, 6-8 bước thường là đủ (ủy quyền → worker A → worker B → tổng hợp, cộng thêm chút dư).",
    step4H2: "4. Lưu",
    step4P: "Lưu trên UI thực chất phát ra cùng một request như bên dưới.",
    mistakesH2: "Những lỗi thường gặp",
    mistakes: [
      "Chọn mesh theo thói quen cho bất cứ thứ gì có hơn một staff — mesh dành cho điều phối mở giữa các chuyên gia, không phải chia-để-trị đơn giản, nơi supervisor thường phù hợp hơn.",
      "Đặt max_steps quá thấp so với topology — đặc biệt department ring và mesh có thể thực sự cần vài vòng mới hội tụ.",
      "Thêm staff vào department mà không cho lead (ở mode supervisor/tree) một system prompt thực sự giải thích khi nào nên ủy quyền cho ai.",
    ],
    fullSeeP1: "Xem trang khái niệm ",
    fullSeeP2: " để biết đầy đủ về những gì mỗi mode làm bên dưới, bao gồm các control block chính xác mà mỗi mode sử dụng.",
    nextH2: "Tiếp theo",
    nextRunTask: "Tạo một Task cho department này và xem nó chạy.",
  },
  zh: {
    intro1: "Department 将 Staff 组织成一种拓扑（topology）——一张决定谁与谁对话、按什么顺序进行，直到工作完成的图。选错拓扑是部门表现不佳或效率低下最常见的原因，因此本指南把大部分篇幅放在这个选择上，而不是点击保存的操作细节。",
    intro2: "我们会构建一个具体例子：为一家软件公司创建 \"Research Team\" 部门，用于接收一个研究请求，从几个角度收集信息，并返回一份综合答案。",
    step1H2: "1. 命名部门并添加员工",
    step1P: "填写名称与描述，然后添加两名或以上已有的 Staff——如果还没有，请先通过 ",
    step1P2: " 或 AI Office Designer 创建。对我们的 Research Team 来说：一名 Research Staff 担任 lead，再加两名专职 worker（一名负责网页研究，一名负责阅读内部文档）。",
    modesH2: "2. 选择拓扑（mode）",
    modesP: "mode 决定员工之间如何交接工作。请根据工作流的形态来选择，而不是凭习惯——下面每一种形态都是真正不同的协作模式，而不是难度等级：",
    modes: [
      { m: "sequential", d: "由单个员工处理整个请求。最简单、最快、最可预测——适合一人可完成的工作。" },
      { m: "ring", d: "员工按固定的环形顺序轮流发言，每轮都能看到目前为止的完整历史。适合迭代式打磨/辩论。" },
      { m: "mesh", d: "一个中心（hub）员工动态地将工作路由给合适的分支（spoke）员工。适合协调者向各专家分派工作。" },
      { m: "supervisor", d: "一名 lead 将任务委派给多个 worker，并在回答前综合他们的结果。适合经典的经理/员工分工模式。" },
      { m: "tree", d: "员工组成父子层级；结果从叶子节点向根节点汇总。适合多层级委派。" },
      { m: "custom", d: "您自己以流程图的形式绘制拓扑图——适用于以上五种内置形态都不合适的情形。" },
    ],
    chooseH2: "为什么 supervisor 适合我们的例子",
    chooseP: "我们 Research Team 的工作——一名 lead 将请求拆成几个独立的查询，再把结果合并成一个答案——正是 supervisor 为之设计的经理/员工形态。mesh 在技术上也能工作，但 supervisor 明确的 <DELEGATE_TO>/<FINAL_ANSWER> 协议让交接与综合步骤比 mesh 的动态路由更可预测——这在这里很值得，因为我们想要一个干净的综合答案，而不是一场开放式讨论。",
    step3H2: "3. 设置 max_steps",
    step3P: "max_steps 限制一次运行可执行的图步骤/轮次总数，超过后会被强制停止——这是防止无限循环的安全网，在 ring 和 mesh 模式下尤为重要，因为除了这个上限和员工发出的明确结束信号外，没有天然的终止条件。对于一个两名 worker 的 supervisor 部门，6-8 步通常足够（委派 → worker A → worker B → 综合，再加一点余量）。",
    step4H2: "4. 保存",
    step4P: "在界面中保存实际上发出的是下面这个相同的请求。",
    mistakesH2: "常见错误",
    mistakes: [
      "只要有一个以上的员工就习惯性选择 mesh——mesh 适合专家之间的开放式协调，而不是简单的分而治之，后者通常 supervisor 更合适。",
      "为拓扑设置过低的 max_steps——尤其是 ring 和 mesh 部门，可能确实需要好几轮才能收敛。",
      "给部门添加员工，却没有为 lead（在 supervisor/tree 模式下）写一个真正说明何时委派给谁的 system prompt。",
    ],
    fullSeeP1: "关于每种 mode 底层具体做什么、各自使用哪些确切的控制块，请参见 ",
    fullSeeP2: " 概念页面获取完整说明。",
    nextH2: "下一步",
    nextRunTask: "为这个部门创建一个 Task 并观察它运行。",
  },
  ja: {
    intro1: "Department は Staff をトポロジー（誰が誰と、どの順番で対話し、作業が完了するまでの流れを決めるグラフ）にまとめたものです。トポロジーの選択を誤ることは、部門の性能が出ない、あるいは過剰になる最も一般的な原因なので、このガイドは保存ボタンを押す操作より、この選択に大半の時間を割きます。",
    intro2: "具体例を 1 つ構築します：ソフトウェア会社向けの「Research Team」部門で、入ってきた調査依頼を受け取り、いくつかの角度から情報を集め、1 つに統合した回答を返すことを目的とします。",
    step1H2: "1. 部門を命名しスタッフを追加する",
    step1P: "名前と説明を入力し、既存の Staff を 2 人以上追加します——まだ作成していない場合は先に ",
    step1P2: " または AI Office Designer で作成してください。今回の Research Team では：lead 役の Research Staff 1 人と、専門の worker 2 人（ウェブ調査担当と社内文書読解担当）。",
    modesH2: "2. トポロジー（mode）を選ぶ",
    modesP: "mode はスタッフ間の作業の受け渡し方を決めます。習慣ではなくワークフローの形に基づいて選びましょう——以下の各形状は難易度の段階ではなく、それぞれ本当に異なる協働パターンです。",
    modes: [
      { m: "sequential", d: "単一のスタッフがリクエスト全体を処理します。最もシンプルで高速、予測しやすい——1 人で完結する仕事向け。" },
      { m: "ring", d: "スタッフが固定の円環順で交代し、各ターンでこれまでの全履歴を参照します。反復的な改善・議論に向く。" },
      { m: "mesh", d: "ハブとなるスタッフが動的に適切なスポークスタッフへ作業をルーティングします。コーディネーターが専門家に振り分ける用途に向く。" },
      { m: "supervisor", d: "リードがワーカーに委任し、結果を統合してから回答します。古典的なマネージャー/ワーカー型に向く。" },
      { m: "tree", d: "スタッフが親子階層を形成し、結果は葉からルートへ集約されます。多段階の委任に向く。" },
      { m: "custom", d: "フロー図として自分でグラフを描きます——他の 5 つの組み込み形状が合わない場合向け。" },
    ],
    chooseH2: "この例で supervisor が適している理由",
    chooseP: "今回の Research Team の仕事——lead がリクエストをいくつかの独立した調査に分割し、結果を 1 つの回答にまとめる——は、まさに supervisor が想定するマネージャー/ワーカー型です。mesh も技術的には動作しますが、supervisor の明示的な <DELEGATE_TO>/<FINAL_ANSWER> プロトコルは、mesh の動的ルーティングよりも受け渡しと統合のステップを予測可能にします。オープンエンドな議論ではなく、1 つのきれいに統合された回答が欲しい今回はこれが有効です。",
    step3H2: "3. max_steps を設定する",
    step3P: "max_steps は 1 回の実行が取れるグラフのステップ/ターン総数の上限で、超えると強制停止します。特に ring・mesh モードでは、この上限とスタッフが発する明示的な終了シグナル以外に自然な終了条件がないため、暴走ループに対する安全策になります。worker 2 人の supervisor 部門なら、6〜8 ステップで通常十分です（委任 → worker A → worker B → 統合、に少し余裕を持たせる）。",
    step4H2: "4. 保存",
    step4P: "UI での保存は、下記と同じリクエストを発行します。",
    mistakesH2: "よくある間違い",
    mistakes: [
      "スタッフが 2 人以上いれば習慣的に mesh を選ぶ——mesh は専門家間のオープンエンドな調整向けであり、単純な分割統治には supervisor の方が通常適しています。",
      "トポロジーに対して max_steps を低く設定しすぎる——特に ring・mesh 部門は収束までに正当に複数ラウンド必要な場合があります。",
      "部門にスタッフを追加しても、（supervisor/tree モードの）lead に、いつ誰に委任すべきかを実際に説明する system prompt を与えていない。",
    ],
    fullSeeP1: "各 mode が内部で具体的に何をするか、それぞれが使う正確な制御ブロックについては、",
    fullSeeP2: " のコンセプトページを参照してください。",
    nextH2: "次に読む",
    nextRunTask: "この部門に対して Task を作成し、実行の様子を見る。",
  },
} as const;

export default function GuideBuildDepartmentDoc({ lang, onNavigate }: DocPageProps) {
  const t = TXT[lang];
  return (
    <div>
      <H1>Build a Department</H1>
      <P>{t.intro1}</P>
      <P>{t.intro2}</P>

      <H2>{t.step1H2}</H2>
      <P>{t.step1P}<DocLink id="staff" onNavigate={onNavigate}>Staff Builder</DocLink>{t.step1P2}</P>

      <H2>{t.modesH2}</H2>
      <P>{t.modesP}</P>
      <UL>
        {t.modes.map(({ m, d }) => (
          <LI key={m}><Pill color="blue">{m}</Pill> {d}</LI>
        ))}
      </UL>

      <H2>{t.chooseH2}</H2>
      <P>{t.chooseP}</P>

      <H2>{t.step3H2}</H2>
      <P>{t.step3P}</P>

      <H2>{t.step4H2}</H2>
      <P>{t.step4P}</P>
      <CodeBlock lang="bash" title="POST /api/v1/departments" code={`curl -X POST http://localhost:8000/api/v1/departments \\\n  -H "Content-Type: application/json" \\\n  -d '{\n    "name": "Research Team",\n    "description": "Gathers, verifies, and writes up findings.",\n    "staff": ["staff_alice", "staff_bob", "staff_carol"],\n    "mode": "supervisor",\n    "max_steps": 8\n  }'`} />

      <Callout type="warning">
        <strong>{t.mistakesH2}</strong>
        <ul className="list-disc pl-5 mt-2 space-y-1">
          {t.mistakes.map((m, i) => <li key={i}>{m}</li>)}
        </ul>
      </Callout>

      <P>{t.fullSeeP1}<DocLink id="departments" onNavigate={onNavigate}>Departments</DocLink>{t.fullSeeP2}</P>

      <H2>{t.nextH2}</H2>
      <NextSteps>
        <NextStepCard id="guide-run-task" onNavigate={onNavigate} title="Run a Task" desc={t.nextRunTask} />
      </NextSteps>
    </div>
  );
}
