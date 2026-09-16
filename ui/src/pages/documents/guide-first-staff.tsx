import { H1, H2, P, OL, OLI, Callout, CodeBlock, InlineCode, DocLink, NextSteps, NextStepCard, type DocPageProps } from "./_shared";

const TXT = {
  en: {
    intro1: "This guide walks through creating a single Staff member by hand in the Staff Builder — name, role, system prompt, Skills, and (optionally) subagents. If you'd rather not do this manually, the AI Office Designer can generate a full roster of staff for a company from one chat description. This guide is for the times you want to add or fine-tune one yourself: a new hire for an existing company, or a rewrite of something the AI Office Designer got close but not quite right.",
    intro2: "We'll build one concrete example the whole way through: a Research Staff member for a small software company, whose job is to gather background before a Developer Staff starts writing code.",
    stepsH2: "Building the staff member",
    steps: [
      { h: "Name and describe the role", b: "Open Staff Builder and click New Staff. role is a free-text field, not a fixed enum — see " },
      { h: "Write the system prompt", b: "" },
      { h: "Attach Skills", b: "" },
      { h: "Decide on subagents", b: "" },
      { h: "Save", b: "" },
    ],
    step1b2: " for why. Type whatever actually fits: for our example, \"Research Staff\" and a description like \"Gathers background and prior art before implementation starts.\"",
    step2P: "The system prompt is the single field that most shapes how this staff member behaves during a run — more than the role name, more than the model. For our Research Staff, a workable prompt looks like: \"You research narrowly-scoped technical topics on request. Always cite sources. Return findings as a short bulleted list, not prose. If a question is ambiguous, ask a clarifying question instead of guessing.\" Notice what that prompt does: it constrains scope (narrowly-scoped), constrains format (bullets, not prose), and gives an explicit fallback (ask instead of guess). A vague prompt like \"You are a helpful researcher\" produces a generalist that drifts turn to turn; a prompt this specific produces a staff member whose output the rest of the department can rely on.",
    step3P: "Skills are the tools this staff member is allowed to call — web search, a spreadsheet integration, a custom JS function, and anything else in the ",
    step3P2: " catalog. For our Research Staff, attach at minimum a web-search Skill; if the company also has a Google Sheets skill for logging findings, attach that too. Only attach what the role actually needs — every attached Skill is something the model has to consider calling on every turn, so an over-attached staff member is slower and more likely to reach for the wrong tool.",
    step4P: "Turn on subagent_enabled only if this staff member's work genuinely decomposes into independent pieces on a given turn — \"research these five competitors\" is a good fit (five unrelated lookups that don't need to see each other), \"summarize this one document\" is not (there's nothing to parallelize). For our Research Staff, leave it off to start; you can always turn it on later once you see it consistently getting research requests that fan out.",
    step5P: "Saving in the UI performs the same operation as the REST call below — the same endpoint handles both creating a brand-new staff member and updating an existing one.",
    mistakesH2: "Common mistakes",
    mistakes: [
      "A system prompt that only restates the role (\"You are a Research Staff member\") gives the model nothing to actually follow — write behavioral instructions, not a job title in prose form.",
      "Attaching every available Skill \"just in case\" — this doesn't make the staff member more capable, it makes tool selection noisier and slower.",
      "Enabling subagents for a role that only ever does one thing per turn — the concurrency has nothing to parallelize and just adds overhead.",
    ],
    restH2: "The equivalent REST call",
    restP: "This is exactly what Staff Builder sends when you click Save:",
    calloutTitle: "Prefer not to build staff one at a time?",
    callout: "Describe the company you want in the AI Office Designer chat and it will propose a full set of staff, departments, and skills for you to review and apply in one shot — including a first draft of every system prompt.",
    idNote1: "an existing",
    idNote2: "in the request body means",
    idNote3: "instead of",
    idNote4: "— see the Staff API reference for details.",
    nextH2: "Next",
    nextDept: "Put your new staff member to work: build a Department and pick a topology.",
    nextSkills: "Build a custom Skill from scratch instead of using a built-in one.",
  },
  vi: {
    intro1: "Hướng dẫn này đi từng bước tạo thủ công một Staff trong Staff Builder — tên, role, system prompt, Skills, và (tùy chọn) subagent. Nếu không muốn làm thủ công, AI Office Designer có thể tự tạo toàn bộ đội ngũ nhân sự cho một công ty chỉ từ một mô tả trong chat. Hướng dẫn này dành cho khi bạn muốn tự thêm hoặc tinh chỉnh riêng một staff: một nhân sự mới cho công ty đã có, hoặc viết lại thứ mà AI Office Designer làm gần đúng nhưng chưa hoàn toàn chuẩn.",
    intro2: "Chúng ta sẽ xây dựng xuyên suốt một ví dụ cụ thể: một Research Staff cho một công ty phần mềm nhỏ, có nhiệm vụ thu thập thông tin nền trước khi một Developer Staff bắt đầu viết code.",
    stepsH2: "Xây dựng staff",
    steps: [
      { h: "Đặt tên và mô tả role", b: "Mở Staff Builder và bấm New Staff. role là trường văn bản tự do, không phải enum cố định — xem " },
      { h: "Viết system prompt", b: "" },
      { h: "Gắn Skills", b: "" },
      { h: "Quyết định về subagent", b: "" },
      { h: "Lưu", b: "" },
    ],
    step1b2: " để biết lý do. Nhập bất cứ gì thực sự phù hợp: với ví dụ của chúng ta là \"Research Staff\" và description kiểu \"Thu thập thông tin nền và các giải pháp trước đó trước khi bắt đầu triển khai.\"",
    step2P: "System prompt là trường có ảnh hưởng lớn nhất đến cách staff này hành xử khi chạy — hơn cả tên role, hơn cả model. Với Research Staff của chúng ta, một prompt khả dụng sẽ như: \"Bạn nghiên cứu các chủ đề kỹ thuật có phạm vi hẹp theo yêu cầu. Luôn trích nguồn. Trả lời dưới dạng danh sách gạch đầu dòng ngắn gọn, không viết văn xuôi. Nếu câu hỏi mơ hồ, hãy hỏi lại thay vì đoán.\" Hãy để ý prompt đó làm gì: nó giới hạn phạm vi (hẹp), giới hạn định dạng (gạch đầu dòng, không văn xuôi), và đưa ra phương án dự phòng rõ ràng (hỏi lại thay vì đoán). Một prompt mơ hồ như \"Bạn là một trợ lý nghiên cứu hữu ích\" sẽ tạo ra một staff generalist dễ lạc hướng qua từng lượt; một prompt cụ thể như trên tạo ra một staff mà phần còn lại của department có thể tin tưởng vào output.",
    step3P: "Skills là các công cụ mà staff này được phép gọi — tìm kiếm web, tích hợp spreadsheet, hàm JS tùy chỉnh, và bất cứ thứ gì khác trong catalog ",
    step3P2: ". Với Research Staff của chúng ta, hãy gắn ít nhất một Skill tìm kiếm web; nếu công ty cũng có skill Google Sheets để ghi lại kết quả, hãy gắn luôn skill đó. Chỉ gắn những gì role thực sự cần — mỗi Skill được gắn là một thứ mà model phải cân nhắc gọi ở mỗi lượt, nên một staff bị gắn quá nhiều skill sẽ chậm hơn và dễ chọn nhầm công cụ hơn.",
    step4P: "Chỉ bật subagent_enabled nếu công việc của staff này thực sự có thể tách thành các phần độc lập trong một lượt — \"nghiên cứu năm đối thủ này\" là phù hợp (năm tra cứu không liên quan, không cần thấy nhau), \"tóm tắt tài liệu này\" thì không (không có gì để chạy song song). Với Research Staff của chúng ta, hãy để tắt lúc đầu; bạn luôn có thể bật sau khi thấy nó liên tục nhận các yêu cầu nghiên cứu có thể tách nhánh.",
    step5P: "Lưu trên UI thực hiện đúng thao tác như lệnh REST bên dưới — cùng một endpoint xử lý cả việc tạo mới lẫn cập nhật một staff đã có.",
    mistakesH2: "Những lỗi thường gặp",
    mistakes: [
      "Một system prompt chỉ lặp lại role (\"Bạn là một Research Staff\") không cho model điều gì thực sự để tuân theo — hãy viết chỉ dẫn hành vi, không phải chức danh diễn giải bằng văn xuôi.",
      "Gắn mọi Skill có sẵn \"phòng khi cần\" — điều này không làm staff giỏi hơn, mà chỉ làm việc chọn công cụ nhiễu và chậm hơn.",
      "Bật subagent cho một role chỉ luôn làm một việc mỗi lượt — không có gì để chạy song song, chỉ thêm overhead.",
    ],
    restH2: "Lệnh REST tương ứng",
    restP: "Đây chính xác là những gì Staff Builder gửi đi khi bạn bấm Lưu:",
    calloutTitle: "Không muốn tạo staff từng người một?",
    callout: "Hãy mô tả công ty bạn muốn trong khung chat của AI Office Designer, nó sẽ đề xuất trọn bộ staff, department, và skill để bạn xem lại và áp dụng chỉ trong một lần — bao gồm cả bản nháp đầu tiên của mọi system prompt.",
    idNote1: "một id đã tồn tại",
    idNote2: "trong body nghĩa là",
    idNote3: "thay vì",
    idNote4: "— xem tham chiếu Staff API để biết chi tiết.",
    nextH2: "Tiếp theo",
    nextDept: "Đưa staff mới vào việc: xây dựng một Department và chọn một topology.",
    nextSkills: "Tự xây dựng một Skill tùy chỉnh từ đầu thay vì dùng skill có sẵn.",
  },
  zh: {
    intro1: "本指南将逐步演示如何在 Staff Builder 中手动创建一名 Staff——姓名、角色、系统提示词、Skills，以及（可选的）子智能体。如果不想手动操作，AI Office Designer 可以仅凭一次聊天描述就为一家公司生成整套员工。本指南适用于您想自行添加或微调某位员工的场景：为已有公司新增一名成员，或重写 AI Office Designer 生成得差强人意的内容。",
    intro2: "我们会用一个具体例子贯穿始终：为一家小型软件公司创建一名 Research Staff，其职责是在 Developer Staff 开始写代码之前先收集背景信息。",
    stepsH2: "构建这名员工",
    steps: [
      { h: "命名并描述角色", b: "打开 Staff Builder 并点击 New Staff。role 是自由文本字段而非固定枚举——原因见 " },
      { h: "编写 system prompt", b: "" },
      { h: "绑定 Skills", b: "" },
      { h: "决定是否需要子智能体", b: "" },
      { h: "保存", b: "" },
    ],
    step1b2: "。填写真正合适的内容：以我们的例子来说是 \"Research Staff\"，description 可以写成 \"在实现开始前收集背景信息与已有方案\"。",
    step2P: "system prompt 是最能决定该员工在运行期间行为的单一字段——比角色名称、甚至比模型本身影响更大。对我们的 Research Staff 来说，一个可用的提示词是：\"你按需研究范围狭窄的技术主题。始终标注来源。以简短的项目符号列表返回结果，而不是散文。如果问题含糊，请提出澄清问题而不是猜测。\" 注意这段提示词做了什么：限定范围（狭窄）、限定格式（项目符号而非散文），并给出明确的兜底方案（澄清而非猜测）。像\"你是一个乐于助人的研究员\"这样含糊的提示词会产生一个逐回合跑偏的通才；这样具体的提示词则会产生一个部门其他成员可以信赖其输出的员工。",
    step3P: "Skills 是该员工被允许调用的工具——网页搜索、表格集成、自定义 JS 函数，以及 ",
    step3P2: " 目录中的其他任何内容。对我们的 Research Staff，至少绑定一个网页搜索 Skill；如果公司也有用于记录结果的 Google 表格技能，也一并绑定。只绑定角色真正需要的技能——每绑定一个 Skill，模型在每个回合都要多考虑一次是否调用它，因此绑定过多技能的员工会更慢，也更容易选错工具。",
    step4P: "只有当该员工某次回合的工作确实可以拆分为互不相关的部分时，才开启 subagent_enabled——\"研究这五个竞争对手\"很适合（五次互不相关、无需彼此可见的查询），\"总结这一份文档\"则不适合（没有什么可以并行）。对我们的 Research Staff，先保持关闭；一旦发现它持续收到可以分支处理的研究请求，随时可以再打开。",
    step5P: "在界面中保存执行的操作与下面的 REST 调用完全相同——同一个接口既处理新建员工，也处理更新已有员工。",
    mistakesH2: "常见错误",
    mistakes: [
      "只是重复角色名称的 system prompt（\"你是一名 Research Staff\"）没有给模型任何真正可遵循的内容——要写行为指令，而不是用散文重述职位名称。",
      "\"以防万一\"绑定所有可用的 Skill——这不会让员工更有能力，只会让工具选择更嘈杂、更慢。",
      "为每回合只做一件事的角色开启子智能体——并发没有可并行的东西，只会增加开销。",
    ],
    restH2: "对应的 REST 调用",
    restP: "这正是您点击保存时 Staff Builder 发送的内容：",
    calloutTitle: "不想一个个手动创建员工？",
    callout: "在 AI Office Designer 的聊天框中描述您想要的公司，它会为您提出一整套员工、部门与技能，供您一次性审阅并应用——包括每个 system prompt 的初稿。",
    idNote1: "一个已存在的",
    idNote2: "放入请求体意味着",
    idNote3: "而非",
    idNote4: "——详见 Staff API 参考。",
    nextH2: "下一步",
    nextDept: "让新员工开始工作：构建一个 Department 并选择拓扑。",
    nextSkills: "从零构建一个自定义 Skill，而不是使用内置技能。",
  },
  ja: {
    intro1: "このガイドでは、Staff Builder で 1 人の Staff を手動作成する手順を説明します——名前、役割、システムプロンプト、Skills、そして（任意で）サブエージェント。手動で行いたくない場合、AI Office Designer はチャットでの説明 1 回だけで会社全体のスタッフ一式を生成できます。このガイドは、既存の会社に新しいメンバーを追加したい、または AI Office Designer が惜しいところまで生成したものを書き直したい、といった場合向けです。",
    intro2: "最初から最後まで 1 つの具体例で説明します：小さなソフトウェア会社の Research Staff で、Developer Staff がコードを書き始める前に背景情報を集める役割です。",
    stepsH2: "スタッフを構築する",
    steps: [
      { h: "名前と役割を記述する", b: "Staff Builder を開き、New Staff をクリックします。role は固定の列挙ではなく自由記述フィールドです——理由は " },
      { h: "system prompt を書く", b: "" },
      { h: "Skills を紐づける", b: "" },
      { h: "サブエージェントを検討する", b: "" },
      { h: "保存する", b: "" },
    ],
    step1b2: " を参照。実際に合う内容を入力してください：この例では \"Research Staff\"、description は「実装開始前に背景情報と既存事例を収集する」のように書きます。",
    step2P: "system prompt は、このスタッフが実行中にどう振る舞うかを最も左右する単一のフィールドです——役割名よりも、モデル自体よりも影響が大きい。今回の Research Staff なら、使えるプロンプトはこうなります：「要求に応じて範囲の狭い技術トピックを調査してください。必ず出典を示してください。結果は文章ではなく簡潔な箇条書きで返してください。質問が曖昧な場合は、推測せず確認の質問をしてください。」このプロンプトが何をしているか注目してください：範囲を制約し（狭い範囲）、形式を制約し（箇条書き、文章ではない）、明確なフォールバックを与えています（推測せず確認する）。「あなたは親切な研究者です」のような曖昧なプロンプトはターンごとにぶれるジェネラリストを生みますが、これほど具体的なプロンプトは、部門の他のメンバーが出力を信頼できるスタッフを生みます。",
    step3P: "Skills はこのスタッフが呼び出せるツールです——ウェブ検索、スプレッドシート連携、カスタム JS 関数、そして ",
    step3P2: " カタログ内のその他すべて。今回の Research Staff には、最低限ウェブ検索の Skill を紐づけてください。会社に結果を記録するための Google スプレッドシートのスキルがあれば、それも紐づけましょう。役割が本当に必要とするものだけを紐づけてください——紐づけた Skill が増えるほど、モデルは毎ターンそれを呼ぶかどうか検討しなければならず、過剰に紐づけられたスタッフは遅くなり、誤ったツールを選びやすくなります。",
    step4P: "このスタッフの作業が、あるターンで本当に独立した部分に分解できる場合にのみ subagent_enabled をオンにしてください——「この5社の競合を調査して」は良い例です（互いを見る必要のない5つの独立した調査）。「この1つの文書を要約して」は該当しません（並列化できるものがない）。今回の Research Staff では、最初はオフのままにしておき、分岐する調査依頼を継続的に受けるようになったら後でオンにすればよいでしょう。",
    step5P: "UI での保存は、下記の REST 呼び出しとまったく同じ操作を行います——新規作成と既存スタッフの更新を同じエンドポイントが処理します。",
    mistakesH2: "よくある間違い",
    mistakes: [
      "役割を繰り返すだけの system prompt（「あなたは Research Staff です」）はモデルが実際に従うべきものを何も与えません——職種を文章で言い換えるのではなく、行動指示を書きましょう。",
      "「念のため」すべての Skill を紐づける——これはスタッフの能力を高めるのではなく、ツール選択をノイズだらけで遅くするだけです。",
      "毎ターン 1 つのことしかしない役割にサブエージェントを有効化する——並列化できるものがなく、オーバーヘッドが増えるだけです。",
    ],
    restH2: "対応する REST 呼び出し",
    restP: "これは、保存をクリックしたときに Staff Builder が送信する内容そのものです：",
    calloutTitle: "スタッフを 1 人ずつ作りたくない場合は？",
    callout: "AI Office Designer のチャットで作りたい会社を説明してください。スタッフ・部門・スキル一式（すべての system prompt の初稿を含む）を提案してくれるので、まとめて確認して適用できます。",
    idNote1: "既存の",
    idNote2: "をリクエストボディに含めると",
    idNote3: "ではなく",
    idNote4: "を意味します——詳細は Staff API リファレンスを参照。",
    nextH2: "次に読む",
    nextDept: "新しいスタッフを働かせる：Department を構築してトポロジーを選ぶ。",
    nextSkills: "既製のものではなく、カスタム Skill をゼロから構築する。",
  },
} as const;

export default function GuideFirstStaffDoc({ lang, onNavigate }: DocPageProps) {
  const t = TXT[lang];
  return (
    <div>
      <H1>Create Your First Staff</H1>
      <P>{t.intro1}</P>
      <P>{t.intro2}</P>

      <H2>{t.stepsH2}</H2>
      <OL>
        <OLI n={1}>
          <strong>{t.steps[0].h}.</strong> {t.steps[0].b}<DocLink id="staff" onNavigate={onNavigate}>Staff</DocLink>{t.step1b2}
        </OLI>
        <OLI n={2}><strong>{t.steps[1].h}.</strong> {t.step2P}</OLI>
        <OLI n={3}><strong>{t.steps[2].h}.</strong> {t.step3P}<DocLink id="skills" onNavigate={onNavigate}>Skills</DocLink>{t.step3P2}</OLI>
        <OLI n={4}><strong>{t.steps[3].h}.</strong> {t.step4P}</OLI>
        <OLI n={5}><strong>{t.steps[4].h}.</strong> {t.step5P}</OLI>
      </OL>

      <Callout type="warning">
        <strong>{t.mistakesH2}</strong>
        <ul className="list-disc pl-5 mt-2 space-y-1">
          {t.mistakes.map((m, i) => <li key={i}>{m}</li>)}
        </ul>
      </Callout>

      <H2>{t.restH2}</H2>
      <P>{t.restP}</P>
      <CodeBlock lang="bash" title="POST /api/v1/staff" code={`curl -X POST http://localhost:8000/api/v1/staff \\\n  -H "Content-Type: application/json" \\\n  -d '{\n    "name": "Alice",\n    "role": "Research Staff",\n    "description": "Gathers background and prior art before implementation starts.",\n    "system_prompt": "You research narrowly-scoped technical topics on request. Always cite sources. Return findings as a short bulleted list, not prose. If a question is ambiguous, ask a clarifying question instead of guessing.",\n    "skill_ids": ["skill_web_search"],\n    "status": "idle",\n    "avatar": "A",\n    "subagent_enabled": false\n  }'`} />
      <P>
        {t.idNote1} <InlineCode>id</InlineCode> {t.idNote2} <InlineCode>update</InlineCode> {t.idNote3} <InlineCode>create</InlineCode> {t.idNote4}
      </P>

      <Callout type="tip"><strong>{t.calloutTitle}</strong> {t.callout}</Callout>

      <H2>{t.nextH2}</H2>
      <NextSteps>
        <NextStepCard id="guide-build-department" onNavigate={onNavigate} title="Build a Department" desc={t.nextDept} />
        <NextStepCard id="guide-skills" onNavigate={onNavigate} title="Add Skills & APIs" desc={t.nextSkills} />
      </NextSteps>
    </div>
  );
}
