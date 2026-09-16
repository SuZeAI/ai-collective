import { H1, H2, P, UL, LI, Callout, CodeBlock, InlineCode, ApiRow, DocLink, NextSteps, NextStepCard, type DocPageProps } from "./_shared";

const TXT = {
  en: {
    intro: "Recruiting (renamed from \"Marketplace\") is how a company reuses existing, curated building blocks instead of generating brand-new ones. It's the counterpart to the AI Office Designer: the Designer generates fresh departments, staff, and skills from a chat description; Recruiting lets you browse an admin-curated shared catalog and clone specific items straight into your own company, untouched by any generation step.",
    ownershipH2: "The ownership model behind it",
    ownershipP: "Every user-creatable entity in AI Collective carries an owner_id. \"default\" marks shared, system-seeded items visible to everyone — but visibility and ownership are deliberately two different things, enforced by two different rules in server/domain/models.py:",
    ownershipRules: [
      { fn: "is_visible_to(owner_id, entity_owner_id)", d: "True if the entity is shared (\"default\") or owned by the caller — this is what lets any user read and browse the shared catalog in the first place." },
      { fn: "can_delete / can_modify (owner_id, entity_owner_id)", d: "True only if the entity's owner_id exactly matches the caller — shared items can only be edited or deleted by the default/admin account itself, never by a regular company." },
    ],
    scenarioH2: "A concrete scenario",
    scenarioP: "Alice runs a marketing agency, Bob runs a small dev shop — two separate companies, two separate owner_id scopes. The admin has published a \"Content Writer\" Staff template into the shared default catalog. Both Alice and Bob can see it in Recruiting and both can clone it: Alice gets her own Content Writer staff owned by her company, Bob gets a completely independent one owned by his. Neither can delete the shared original, and neither can touch the other's copy — cloning is what turns something merely visible into something you actually own, free to edit or delete from that point on.",
    vsH2: "Recruiting vs. the AI Office Designer",
    vsP: "Both let you populate a company with departments, staff, and skills — the difference is generation versus reuse. Reach for the ",
    officeBuilderLink: "AI Office Designer",
    vsP2: " when you're starting from a description of a company that doesn't exist yet and want the AI to propose a full structure from scratch. Reach for Recruiting when a good building block already exists — in the shared catalog, or in another company you have access to — and copying it is faster and more consistent than generating something similar from a prompt. Many companies end up using both: the Designer for the initial skeleton, Recruiting afterward to pull in a proven Staff template someone else already refined.",
    catalogH2: "What you can browse and clone",
    catalogP: "Six resource types, each with its own read-only list endpoint plus one shared copy endpoint. Cloning cascades sensibly: cloning a department brings its bound staff along with it, and cloning a staff member brings its bound skills along with it, so you don't end up with a department full of staff IDs that don't resolve to anything in your company.",
    restH2: "REST API",
    copyP: "POST /api/v1/recruiting/copy takes a resource kind and a list of ids and clones each into the caller's scope, stamping every new record with the caller's own owner_id.",
    nextH2: "Next",
    nextStaff: "What actually gets cloned when you copy a shared Staff template.",
    nextDepartments: "Where a cloned Staff member ends up working once you assign it.",
    nextCompanies: "How company scopes and ownership fit into the bigger picture.",
  },
  vi: {
    intro: "Recruiting (đổi tên từ \"Marketplace\") là cách một công ty tái sử dụng những khối xây dựng có sẵn, đã được chọn lọc, thay vì tạo mới hoàn toàn. Đây là đối trọng của AI Office Designer: Designer sinh ra department, staff, và skill mới từ mô tả trong chat; Recruiting cho phép bạn duyệt qua một catalog dùng chung do admin chọn lọc và sao chép trực tiếp các mục cụ thể vào công ty của bạn, không qua bất kỳ bước sinh nào.",
    ownershipH2: "Mô hình sở hữu đằng sau nó",
    ownershipP: "Mọi entity do người dùng tạo trong AI Collective đều có owner_id. \"default\" đánh dấu các mục dùng chung, được hệ thống seed sẵn và hiển thị cho tất cả mọi người — nhưng khả năng nhìn thấy và quyền sở hữu là hai điều cố tình tách biệt, được thực thi bởi hai quy tắc khác nhau trong server/domain/models.py:",
    ownershipRules: [
      { fn: "is_visible_to(owner_id, entity_owner_id)", d: "True nếu entity là dùng chung (\"default\") hoặc thuộc về người gọi — đây là điều cho phép bất kỳ user nào đọc và duyệt catalog dùng chung ngay từ đầu." },
      { fn: "can_delete / can_modify (owner_id, entity_owner_id)", d: "Chỉ True khi owner_id của entity khớp chính xác với người gọi — các mục dùng chung chỉ có thể được sửa hoặc xóa bởi chính tài khoản default/admin, không bao giờ bởi một công ty thông thường." },
    ],
    scenarioH2: "Một tình huống cụ thể",
    scenarioP: "Alice điều hành một agency marketing, Bob điều hành một xưởng dev nhỏ — hai công ty riêng biệt, hai phạm vi owner_id riêng biệt. Admin đã xuất bản một mẫu Staff \"Content Writer\" vào catalog dùng chung mặc định. Cả Alice và Bob đều thấy nó trong Recruiting và cả hai đều có thể sao chép: Alice nhận một Staff Content Writer của riêng mình do công ty cô sở hữu, Bob nhận một bản hoàn toàn độc lập do công ty anh sở hữu. Không ai có thể xóa bản gốc dùng chung, và không ai có thể chạm vào bản sao của người kia — sao chép chính là thứ biến một thứ chỉ \"nhìn thấy được\" thành một thứ bạn thực sự sở hữu, được tự do sửa hoặc xóa từ đó trở đi.",
    vsH2: "Recruiting so với AI Office Designer",
    vsP: "Cả hai đều giúp bạn lấp đầy một công ty bằng department, staff, và skill — khác biệt nằm ở việc sinh mới so với tái sử dụng. Dùng ",
    officeBuilderLink: "AI Office Designer",
    vsP2: " khi bạn bắt đầu từ một mô tả về một công ty chưa tồn tại và muốn AI đề xuất toàn bộ cấu trúc từ đầu. Dùng Recruiting khi đã có sẵn một khối xây dựng tốt — trong catalog dùng chung, hoặc trong một công ty khác mà bạn có quyền truy cập — và sao chép nó nhanh hơn, nhất quán hơn so với việc tạo ra thứ tương tự từ một prompt. Nhiều công ty rốt cuộc dùng cả hai: Designer cho bộ khung ban đầu, Recruiting sau đó để kéo về một mẫu Staff đã được ai đó tinh chỉnh sẵn.",
    catalogH2: "Những gì bạn có thể duyệt và sao chép",
    catalogP: "Sáu loại tài nguyên, mỗi loại có endpoint liệt kê chỉ-đọc riêng, cộng với một endpoint sao chép dùng chung. Việc sao chép lan tỏa một cách hợp lý: sao chép một department sẽ mang theo staff được gắn của nó; sao chép một staff sẽ mang theo skill được gắn của nó, để bạn không bao giờ có một department đầy staff ID không trỏ tới bất cứ thứ gì trong công ty của mình.",
    restH2: "REST API",
    copyP: "POST /api/v1/recruiting/copy nhận vào một loại tài nguyên và danh sách id, rồi sao chép từng cái vào phạm vi của người gọi, gắn owner_id của chính người gọi lên mỗi bản ghi mới.",
    nextH2: "Tiếp theo",
    nextStaff: "Những gì thực sự được sao chép khi bạn clone một mẫu Staff dùng chung.",
    nextDepartments: "Một Staff được clone rồi sẽ làm việc ở đâu khi bạn gán nó.",
    nextCompanies: "Phạm vi công ty và quyền sở hữu khớp với bức tranh lớn hơn như thế nào.",
  },
  zh: {
    intro: "Recruiting（由\"Marketplace\"更名而来）是公司复用已有、经过筛选的构建块的方式，而不是从零生成全新的。它与 AI Office Designer 相辅相成：Designer 根据聊天描述生成全新的部门、员工与技能；Recruiting 则让您浏览由管理员维护的共享目录，直接将特定条目克隆到自己的公司，完全不经过任何生成步骤。",
    ownershipH2: "背后的所有权模型",
    ownershipP: "AI Collective 中每个用户可创建的实体都带有 owner_id。\"default\" 标记系统预置、对所有人可见的共享条目——但\"可见\"与\"拥有\"被刻意设计为两回事，由 server/domain/models.py 中两条不同的规则强制执行：",
    ownershipRules: [
      { fn: "is_visible_to(owner_id, entity_owner_id)", d: "若该实体为共享（\"default\"）或归调用者所有，则返回 True——这正是让任何用户都能读取、浏览共享目录的原因。" },
      { fn: "can_delete / can_modify (owner_id, entity_owner_id)", d: "仅当实体的 owner_id 与调用者完全匹配时才为 True——共享条目只能由 default/admin 账户本身编辑或删除，普通公司永远无法触碰。" },
    ],
    scenarioH2: "一个具体场景",
    scenarioP: "Alice 经营一家营销代理公司，Bob 经营一家小型开发工作室——两家独立的公司，两个独立的 owner_id 作用域。管理员在共享的 default 目录中发布了一个\"内容撰稿人\"Staff 模板。Alice 和 Bob 都能在 Recruiting 中看到它，也都能克隆它：Alice 得到一个归她公司所有的独立内容撰稿人员工，Bob 得到一个完全独立、归他公司所有的员工。谁都不能删除共享的原始条目，谁也碰不到对方的副本——克隆正是把\"仅仅可见\"变成\"真正拥有\"的那个动作，从那一刻起您可以自由编辑或删除它。",
    vsH2: "Recruiting 与 AI Office Designer 的区别",
    vsP: "两者都能帮您为一家公司填充部门、员工与技能——区别在于生成还是复用。当您从一个尚不存在的公司描述出发，希望 AI 从零提出完整结构时，使用",
    officeBuilderLink: "AI Office Designer",
    vsP2: "。当一个好用的构建块已经存在——无论是在共享目录中，还是在您有权访问的另一家公司中——直接复制它比根据提示词重新生成类似的东西更快、也更一致，这时使用 Recruiting。许多公司最终两者都会用到：先用 Designer 搭出初始骨架，之后再用 Recruiting 引入别人已经打磨好的 Staff 模板。",
    catalogH2: "可浏览与克隆的内容",
    catalogP: "六种资源类型，每种都有各自的只读列表接口，外加一个共用的复制接口。克隆会合理地级联：克隆一个部门会一并带上其绑定的员工；克隆一个员工会一并带上其绑定的技能，这样您就不会得到一个满是无法解析的 staff ID 的部门。",
    restH2: "REST API",
    copyP: "POST /api/v1/recruiting/copy 接收资源类型和一组 id，将每一个克隆到调用者的作用域，并给每条新记录打上调用者自己的 owner_id。",
    nextH2: "下一步",
    nextStaff: "克隆一个共享 Staff 模板时究竟复制了什么。",
    nextDepartments: "被克隆的员工被分配后会在哪里工作。",
    nextCompanies: "公司作用域与所有权如何融入更大的图景。",
  },
  ja: {
    intro: "Recruiting（旧称「Marketplace」）は、ゼロから新規生成する代わりに、既存の厳選済みビルディングブロックを再利用する仕組みです。AI Office Designer と対をなします——Designer はチャットの説明から新しい部門・スタッフ・スキルを生成し、Recruiting は管理者が整備した共有カタログを閲覧し、生成ステップを一切経ずに特定の項目を自社に直接クローンできます。",
    ownershipH2: "背後にある所有権モデル",
    ownershipP: "AI Collective でユーザーが作成するすべてのエンティティには owner_id が付与されます。「default」はシステムがシードした、全員に表示される共有アイテムを示します——ただし「見える」ことと「所有する」ことは意図的に別物として扱われ、server/domain/models.py 内の 2 つの異なるルールで強制されます。",
    ownershipRules: [
      { fn: "is_visible_to(owner_id, entity_owner_id)", d: "エンティティが共有（\"default\"）または呼び出し元の所有である場合に True——これによってあらゆるユーザーがそもそも共有カタログを読み取り・閲覧できます。" },
      { fn: "can_delete / can_modify (owner_id, entity_owner_id)", d: "エンティティの owner_id が呼び出し元と完全一致する場合のみ True——共有アイテムは default/admin アカウント自身のみが編集・削除でき、通常の会社は決して触れられません。" },
    ],
    scenarioH2: "具体的なシナリオ",
    scenarioP: "Alice はマーケティング代理店を、Bob は小さな開発ショップを経営しています——2 つの別々の会社、2 つの別々の owner_id スコープです。管理者は共有の default カタログに「コンテンツライター」Staff テンプレートを公開しました。Alice も Bob もそれを Recruiting で見ることができ、どちらもクローンできます。Alice は自分の会社が所有する独自のコンテンツライタースタッフを、Bob は自分の会社が所有する完全に独立したものを手に入れます。どちらも共有の元データを削除できず、相手のコピーにも触れられません。クローンこそが「見えるだけ」のものを「実際に所有する」ものへと変える操作であり、その瞬間から自由に編集・削除できるようになります。",
    vsH2: "Recruiting と AI Office Designer の違い",
    vsP: "どちらも会社に部門・スタッフ・スキルを充填する手段ですが、違いは生成か再利用かです。まだ存在しない会社の説明から出発し、AI にゼロから完全な構造を提案してほしい場合は",
    officeBuilderLink: "AI Office Designer",
    vsP2: "を使います。すでに良いビルディングブロックが存在する場合——共有カタログ内でも、アクセス権のある別の会社内でも——それをコピーする方が、プロンプトから似たものを生成するより速く、一貫性も保てます。この場合は Recruiting を使います。多くの会社は結局両方を使うことになります。最初の骨格作りには Designer を、その後は誰かがすでに磨き上げた Staff テンプレートを取り込むために Recruiting を使う、というように。",
    catalogH2: "閲覧・クローンできるもの",
    catalogP: "6 種類のリソースがあり、それぞれ専用の読み取り専用一覧エンドポイントと、共通のコピーエンドポイントを持ちます。クローンは理にかなった形で連鎖します。部門をクローンすると紐づくスタッフも一緒に、スタッフをクローンすると紐づくスキルも一緒に複製されるため、自社内で解決できない staff ID だらけの部門になることはありません。",
    restH2: "REST API",
    copyP: "POST /api/v1/recruiting/copy はリソース種別と id のリストを受け取り、それぞれを呼び出し元のスコープにクローンし、新しい各レコードに呼び出し元自身の owner_id を付与します。",
    nextH2: "次に読む",
    nextStaff: "共有 Staff テンプレートをクローンすると実際に何が複製されるか。",
    nextDepartments: "クローンされたスタッフは割り当て後どこで働くことになるか。",
    nextCompanies: "会社スコープと所有権が全体像にどう組み込まれるか。",
  },
} as const;

export default function RecruitingDoc({ lang, onNavigate }: DocPageProps) {
  const t = TXT[lang];
  return (
    <div>
      <H1>Recruiting</H1>
      <P>{t.intro}</P>

      <H2>{t.ownershipH2}</H2>
      <P>{t.ownershipP}</P>
      <UL>
        {t.ownershipRules.map(({ fn, d }) => (
          <LI key={fn}><InlineCode>{fn}</InlineCode> — {d}</LI>
        ))}
      </UL>

      <H2>{t.scenarioH2}</H2>
      <Callout type="info">{t.scenarioP}</Callout>

      <H2>{t.vsH2}</H2>
      <P>
        {t.vsP}
        <DocLink id="companies" onNavigate={onNavigate}>{t.officeBuilderLink}</DocLink>
        {t.vsP2}
      </P>

      <H2>{t.catalogH2}</H2>
      <P>{t.catalogP}</P>

      <H2>{t.restH2}</H2>
      <div className="rounded-xl border border-border/60 overflow-hidden my-4 divide-y divide-border/40">
        <ApiRow method="GET" path="/api/v1/recruiting/skills" desc="Shared skills catalog" />
        <ApiRow method="GET" path="/api/v1/recruiting/staff" desc="Shared staff catalog" />
        <ApiRow method="GET" path="/api/v1/recruiting/departments" desc="Shared departments catalog" />
        <ApiRow method="GET" path="/api/v1/recruiting/tasks" desc="Shared task templates" />
        <ApiRow method="GET" path="/api/v1/recruiting/projects" desc="Shared project templates" />
        <ApiRow method="GET" path="/api/v1/recruiting/documents" desc="Shared document library" />
        <ApiRow method="POST" path="/api/v1/recruiting/copy" desc="Clone selected items into the caller's company" />
      </div>
      <P>{t.copyP}</P>
      <CodeBlock lang="bash" title="Clone two shared departments into your company" code={`curl -X POST http://localhost:8000/api/v1/recruiting/copy \\\n  -H "Content-Type: application/json" \\\n  -d '{"kind":"departments","ids":["dept_shared_1","dept_shared_2"],"company_id":"company_abc"}'`} />

      <H2>{t.nextH2}</H2>
      <NextSteps>
        <NextStepCard id="staff" onNavigate={onNavigate} title="Staff" desc={t.nextStaff} />
        <NextStepCard id="departments" onNavigate={onNavigate} title="Departments" desc={t.nextDepartments} />
        <NextStepCard id="companies" onNavigate={onNavigate} title="Companies" desc={t.nextCompanies} />
      </NextSteps>
    </div>
  );
}
