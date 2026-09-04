import { H1, H2, P, UL, LI, OL, OLI, Callout, CodeBlock, DocLink, NextSteps, NextStepCard, type DocPageProps } from "./_shared";

const TXT = {
  en: {
    licenseTitle: "Read this before you contribute",
    licenseP1: "AI Collective is released under the AI – Collective Non-Commercial / Academic License (see LICENSE), which is not an OSI-approved open-source license. In practice: running it, modifying it, and contributing back for non-commercial or academic purposes is free and welcome. Using it to build a paid product, an internal tool at a for-profit company, or any revenue-generating service is not covered by this license and needs a separate written commercial agreement.",
    licenseP2: "By submitting a contribution — a PR, a patch, a doc fix — you agree it's provided under that same license, and that the copyright holder (SuZeAI) may use, relicense, or offer it commercially, including your contribution. If you're contributing on behalf of an employer, or you're not sure whether your use case counts as commercial, reach out to suzeai545@gmail.com before you invest time in a PR.",

    waysH2: "Ways to contribute",
    waysP: "Code isn't the only useful contribution, and it usually isn't the highest-leverage one — a good bug report or a documentation fix that saves the next person an hour is worth just as much.",
    ways: [
      { t: "Bug reports", d: "Open a GitHub issue with concrete reproduction steps, what you expected vs. what happened, and relevant logs. \"It doesn't work\" is much harder to act on than a curl command that reproduces a 500." },
      { t: "Feature requests", d: "Describe the use case you're trying to solve, not just the API shape you imagine — the same underlying need can sometimes be met more simply than the specific feature you first thought of." },
      { t: "Code contributions", d: "Bug fixes, new Skill/toolkit integrations, topology improvements, frontend polish. See Development Setup for the conventions reviewers expect." },
      { t: "Documentation", d: "Both this docs site and the backend docs/ folder are fair game. An inaccuracy in the docs is a bug, not a nitpick — it costs the next reader real time." },
    ],

    prH2: "Pull request flow",
    prP: "The flow below isn't process for its own sake — each step exists because it makes review faster or cheaper for the person on the other end of your PR.",
    prSteps: [
      "Fork the repo and clone your fork, then branch off main with a name that says what the branch does (feat/mesh-fanout-limit, not patch-1).",
      "Make your change, keeping the diff to a single concern. A PR that fixes a bug and reformats an unrelated file is two PRs wearing a trenchcoat — it's harder to review and harder to revert if something's wrong.",
      "Commit with a Conventional Commits-style message (feat(...), fix(...), docs(...), refactor(...)) — this is what turns git log into a changelog someone can skim, instead of an archaeology project.",
      "Push your branch and open a PR against main. Describe the motivation (why, not just what) and, for anything behavior-changing, how you verified it — a failing test that now passes, a manual repro you can no longer trigger.",
    ],

    reviewH2: "What reviewers look for",
    review: [
      "Respect for the ports-and-adapters layer boundaries in the backend — domain never imports from app/api/infra.",
      "Tests for new behavior, or a clear note on why none were added.",
      "Consistent terminology — Staff/Department/Company/Meeting/Recruiting, not the old Agent/Team/Workspace/Conversation/Marketplace names.",
      "No secrets committed, and no unrelated formatting churn mixed into the diff.",
    ],
    architectureLink: "Architecture",
  },
  vi: {
    licenseTitle: "Đọc trước khi bạn đóng góp",
    licenseP1: "AI Collective được phát hành theo AI – Collective Non-Commercial / Academic License (xem LICENSE), không phải giấy phép mã nguồn mở được OSI chấp thuận. Trên thực tế: chạy nó, chỉnh sửa nó, và đóng góp lại vì mục đích phi thương mại hoặc học thuật là miễn phí và được hoan nghênh. Dùng nó để xây một sản phẩm trả phí, một công cụ nội bộ ở công ty vì lợi nhuận, hay bất kỳ dịch vụ tạo doanh thu nào đều không nằm trong phạm vi giấy phép này và cần một thỏa thuận thương mại bằng văn bản riêng.",
    licenseP2: "Khi gửi một đóng góp — một PR, một patch, một bản sửa tài liệu — bạn đồng ý rằng nó được cung cấp theo cùng giấy phép đó, và chủ sở hữu bản quyền (SuZeAI) có thể sử dụng, cấp lại giấy phép, hoặc thương mại hóa nó, bao gồm cả đóng góp của bạn. Nếu bạn đóng góp thay mặt cho một nhà tuyển dụng, hoặc không chắc use case của mình có tính là thương mại hay không, hãy liên hệ suzeai545@gmail.com trước khi đầu tư thời gian vào một PR.",

    waysH2: "Các cách đóng góp",
    waysP: "Code không phải là đóng góp hữu ích duy nhất, và thường cũng không phải là đóng góp có đòn bẩy cao nhất — một báo lỗi tốt hay một bản sửa tài liệu giúp người sau tiết kiệm một giờ đồng hồ cũng có giá trị tương đương.",
    ways: [
      { t: "Báo lỗi", d: "Mở một issue trên GitHub kèm các bước tái hiện cụ thể, điều bạn mong đợi so với điều thực sự xảy ra, và log liên quan. \"Nó không hoạt động\" khó hành động hơn nhiều so với một lệnh curl tái hiện được lỗi 500." },
      { t: "Đề xuất tính năng", d: "Mô tả use case bạn đang cố giải quyết, không chỉ hình dạng API bạn hình dung — cùng một nhu cầu cơ bản đôi khi có thể được đáp ứng đơn giản hơn tính năng cụ thể bạn nghĩ ra ban đầu." },
      { t: "Đóng góp code", d: "Sửa lỗi, tích hợp Skill/toolkit mới, cải tiến topology, hoàn thiện frontend. Xem Development Setup để biết các quy ước mà reviewer mong đợi." },
      { t: "Tài liệu", d: "Cả trang docs này lẫn thư mục docs/ ở backend đều có thể đóng góp. Thông tin sai trong tài liệu là bug, không phải chuyện vặt — nó tốn thời gian thật của người đọc sau." },
    ],

    prH2: "Quy trình pull request",
    prP: "Quy trình dưới đây không phải là thủ tục cho có — mỗi bước tồn tại vì nó giúp việc review nhanh hơn hoặc rẻ hơn cho người ở đầu bên kia PR của bạn.",
    prSteps: [
      "Fork repo và clone bản fork của bạn, rồi tạo nhánh từ main với tên nói rõ nhánh đó làm gì (feat/mesh-fanout-limit, không phải patch-1).",
      "Thực hiện thay đổi, giữ diff chỉ tập trung vào một vấn đề. Một PR vừa sửa lỗi vừa định dạng lại một file không liên quan thực chất là hai PR mặc chung một áo khoác — khó review hơn và khó revert hơn nếu có gì sai.",
      "Commit với thông điệp theo kiểu Conventional Commits (feat(...), fix(...), docs(...), refactor(...)) — đây là thứ biến git log thành một changelog có thể lướt qua, thay vì một dự án khảo cổ.",
      "Push nhánh và mở PR nhắm vào main. Mô tả động lực (tại sao, không chỉ là cái gì) và, nếu có thay đổi hành vi, cách bạn đã kiểm chứng — một test trước đó fail giờ đã pass, một cách tái hiện thủ công mà giờ không còn kích hoạt được nữa.",
    ],

    reviewH2: "Reviewer sẽ xem xét những gì",
    review: [
      "Tôn trọng ranh giới các lớp ports-and-adapters ở backend — domain không bao giờ import từ app/api/infra.",
      "Có test cho hành vi mới, hoặc ghi chú rõ vì sao chưa thêm test.",
      "Thuật ngữ nhất quán — Staff/Department/Company/Meeting/Recruiting, không dùng lại tên cũ Agent/Team/Workspace/Conversation/Marketplace.",
      "Không commit secret, và không có thay đổi định dạng không liên quan trộn lẫn trong diff.",
    ],
    architectureLink: "Architecture",
  },
  zh: {
    licenseTitle: "贡献前请先阅读",
    licenseP1: "AI Collective 依据 AI – Collective Non-Commercial / Academic License 发布（见 LICENSE），这不是 OSI 认可的开源许可证。实际来说：出于非商业或学术目的运行、修改并回馈贡献是免费且受欢迎的。用它来构建付费产品、营利性公司的内部工具，或任何产生收入的服务，都不在本许可证覆盖范围内，需要单独签署书面商业协议。",
    licenseP2: "提交贡献——PR、补丁、文档修复——即表示您同意该贡献以同一许可证提供，且版权所有者（SuZeAI）可以使用、重新授权或将其（包括您的贡献）商业化。如果您代表雇主贡献，或不确定自己的使用场景是否算作商业用途，请在投入时间提交 PR 之前联系 suzeai545@gmail.com。",

    waysH2: "贡献方式",
    waysP: "代码并不是唯一有用的贡献，通常也不是杠杆最大的那种——一份好的 Bug 报告，或一次为下一个人省下一小时的文档修复，价值同样不小。",
    ways: [
      { t: "报告 Bug", d: "在 GitHub 上创建 issue，附上具体的复现步骤、期望行为与实际行为，以及相关日志。\"它不工作\"比一条能复现 500 错误的 curl 命令难处理得多。" },
      { t: "功能请求", d: "描述您想解决的使用场景，而不仅仅是您想象中的 API 形态——同样的底层需求有时可以用比您最初设想的具体功能更简单的方式满足。" },
      { t: "代码贡献", d: "Bug 修复、新的 Skill/工具包集成、拓扑改进、前端优化。评审者期望的约定见 Development Setup。" },
      { t: "文档", d: "本文档站点与后端 docs/ 目录都欢迎贡献。文档中的不准确之处是 Bug，不是吹毛求疵——它会真实地占用下一位读者的时间。" },
    ],

    prH2: "Pull Request 流程",
    prP: "下面的流程不是为了走过场——每一步都是因为它能让 PR 另一端的评审者更快、更省力地完成审查。",
    prSteps: [
      "Fork 仓库并克隆您的 fork，然后从 main 拉出一个能说明分支用途的分支名（feat/mesh-fanout-limit，而不是 patch-1）。",
      "进行修改，让 diff 只聚焦一个问题。一个既修复 Bug 又重新格式化无关文件的 PR，本质上是两个 PR 披着一件风衣——更难评审，出问题时也更难回退。",
      "使用 Conventional Commits 风格的提交信息（feat(...)、fix(...)、docs(...)、refactor(...)）——这能让 git log 变成一份可以浏览的更新日志，而不是一场考古挖掘。",
      "推送分支并针对 main 打开 PR。说明改动动机（为什么，而不仅仅是做了什么），如果涉及行为变更，说明您是如何验证的——一个之前失败现在通过的测试，或一个您现在已无法再触发的手动复现步骤。",
    ],

    reviewH2: "评审关注点",
    review: [
      "遵守后端的 ports-and-adapters 分层边界——domain 绝不从 app/api/infra 导入任何内容。",
      "为新行为编写测试，或明确说明为何未添加测试。",
      "术语保持一致——使用 Staff/Department/Company/Meeting/Recruiting，而非旧名称 Agent/Team/Workspace/Conversation/Marketplace。",
      "不提交任何密钥，diff 中不混入无关的格式改动。",
    ],
    architectureLink: "Architecture",
  },
  ja: {
    licenseTitle: "貢献する前に読んでください",
    licenseP1: "AI Collective は AI – Collective Non-Commercial / Academic License（LICENSE 参照）の下で公開されており、OSI 承認のオープンソースライセンスではありません。実際には、非商用または学術目的での実行・改変・貢献の還元は無料で歓迎されます。有料製品の構築、営利企業の社内ツール、その他収益を生むサービスへの利用は本ライセンスの対象外であり、別途書面による商用契約が必要です。",
    licenseP2: "コントリビュート（PR、パッチ、ドキュメント修正）を送信することで、その貢献が同じライセンスの下で提供されること、および著作権者（SuZeAI）があなたの貢献を含めて使用・再ライセンス・商業提供できることに同意したものとみなされます。雇用主を代表して貢献する場合や、ご自身のユースケースが商用に該当するか不明な場合は、PR に時間を投資する前に suzeai545@gmail.com までご連絡ください。",

    waysH2: "貢献の方法",
    waysP: "コードだけが有用な貢献ではなく、多くの場合それが最もレバレッジの高いものでもありません。次の人の 1 時間を節約する優れたバグ報告やドキュメント修正も、同じくらい価値があります。",
    ways: [
      { t: "バグ報告", d: "具体的な再現手順、期待した動作と実際の動作、関連ログを添えて GitHub issue を作成してください。「動かない」だけでは、500 エラーを再現する curl コマンドに比べてはるかに対処しにくいものです。" },
      { t: "機能リクエスト", d: "思い描いている API の形だけでなく、解決したいユースケースを説明してください。同じ根本的なニーズが、最初に思いついた具体的な機能よりもシンプルな方法で満たせることもあります。" },
      { t: "コード貢献", d: "バグ修正、新しい Skill/ツールキット統合、トポロジーの改善、フロントエンドの改善など。レビュアーが期待する規約は Development Setup を参照してください。" },
      { t: "ドキュメント", d: "このドキュメントサイトとバックエンドの docs/ フォルダの両方が対象です。ドキュメントの不正確さはあら探しではなくバグであり、次の読者の実際の時間を奪います。" },
    ],

    prH2: "プルリクエストの流れ",
    prP: "以下の流れは形式のためだけのものではありません。各ステップは、PR の向こう側にいる人にとってレビューを速く、あるいは低コストにするために存在します。",
    prSteps: [
      "リポジトリを fork し、自分の fork を clone してから、ブランチが何をするか分かる名前で main から分岐させます（patch-1 ではなく feat/mesh-fanout-limit のように）。",
      "変更を行い、diff を 1 つの関心事に絞ります。バグ修正と無関係なファイルの再フォーマットを同時に行う PR は、実質的にトレンチコートを着た 2 つの PR です——レビューしにくく、何か問題があった場合の取り消しも難しくなります。",
      "Conventional Commits 形式のコミットメッセージ（feat(...)、fix(...)、docs(...)、refactor(...)）でコミットします。これにより git log は考古学的な発掘作業ではなく、ざっと目を通せる変更履歴になります。",
      "ブランチを push し、main に対して PR を開きます。動機（何をしたかだけでなく、なぜか）を説明し、動作が変わる変更については、どう検証したか（以前失敗していて今は通るテスト、もう再現できなくなった手動の再現手順など）を書いてください。",
    ],

    reviewH2: "レビュアーが確認すること",
    review: [
      "バックエンドの ports-and-adapters 層境界を尊重しているか——domain は決して app/api/infra からインポートしません。",
      "新しい動作に対するテストがあるか、なければその理由が明記されているか。",
      "用語の一貫性——旧名称の Agent/Team/Workspace/Conversation/Marketplace ではなく Staff/Department/Company/Meeting/Recruiting を使用しているか。",
      "シークレットがコミットされていないか、diff に無関係なフォーマット変更が混ざっていないか。",
    ],
    architectureLink: "Architecture",
  },
} as const;

export default function ContributingGuideDoc({ lang, onNavigate }: DocPageProps) {
  const t = TXT[lang];
  return (
    <div>
      <H1>How to Contribute</H1>
      <Callout type="warning">
        <strong>{t.licenseTitle}</strong>
      </Callout>
      <P>{t.licenseP1}</P>
      <P>{t.licenseP2}</P>

      <H2>{t.waysH2}</H2>
      <P>{t.waysP}</P>
      <UL>
        {t.ways.map(({ t: title, d }) => (
          <LI key={title}><strong>{title}</strong> — {d}</LI>
        ))}
      </UL>

      <H2>{t.prH2}</H2>
      <P>{t.prP}</P>
      <OL>{t.prSteps.map((s, i) => <OLI key={i} n={i + 1}>{s}</OLI>)}</OL>
      <CodeBlock lang="bash" code={`git clone https://github.com/YOUR_USERNAME/ai-collective.git\ncd ai-collective\ngit checkout -b feat/my-feature\n\n# ... make your changes ...\n\ngit commit -m "feat(staff): add my feature"\ngit push origin feat/my-feature\n# then open a PR against main on GitHub`} />

      <H2>{t.reviewH2}</H2>
      <UL>{t.review.map((r, i) => <LI key={i}>{r}</LI>)}</UL>
      <P><DocLink id="architecture" onNavigate={onNavigate}>{t.architectureLink}</DocLink></P>

      <NextSteps>
        <NextStepCard
          id="contributing-dev"
          onNavigate={onNavigate}
          title="Development Setup"
          desc={lang === "vi" ? "Pre-commit hook, cách chạy test, và quy ước code." : lang === "zh" ? "Pre-commit 钩子、如何运行测试，以及代码约定。" : lang === "ja" ? "pre-commit フック、テストの実行方法、コード規約。" : "Pre-commit hooks, how to run tests, and code conventions."}
        />
        <NextStepCard
          id="architecture"
          onNavigate={onNavigate}
          title="Architecture"
          desc={lang === "vi" ? "Ranh giới các lớp mà mọi PR backend cần tôn trọng." : lang === "zh" ? "每个后端 PR 都需要遵守的分层边界。" : lang === "ja" ? "すべてのバックエンド PR が尊重すべき層の境界。" : "The layer boundaries every backend PR needs to respect."}
        />
      </NextSteps>
    </div>
  );
}
