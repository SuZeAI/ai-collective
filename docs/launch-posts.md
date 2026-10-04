# Launch posts — community publishing plan

Drafted copy for announcing the public (source-available) launch of **AI – Collective**
(`github.com/SuZeAI/ai-collective`), plus posting order and timing. Everything here uses
**"source-available"**, never "open source" — the license is a Non-Commercial / Academic
License (free for personal, academic, and research use; commercial use needs a separate
license from `suzeai545@gmail.com`). Getting this wrong in public is the fastest way to
lose credibility with this audience — say it right from the first post.

Visual asset for every platform that supports video: `videos/ai-collective-feed-promo/renders/ai-collective-feed-promo_2026-10-03_19-39-41.mp4`
(30s, 1080×1080, voiceover + music + SFX).

## Posting order and timing

```
Day 0 (Tue–Thu, 8–10am in your audience's primary timezone)
├─ LinkedIn — post first. Warmest network, sets the tone, gives you a link to
│  reference everywhere else.
└─ Twitter/X — post same day, a few hours after LinkedIn (not simultaneous —
   gives you a moment to react to early LinkedIn comments first).

Day 0 or Day 1
├─ Hacker News — "Show HN" post. Best traction Tue–Thu, US morning (~8–10am ET).
│  Avoid Friday/weekend (dead traffic) and Monday (crowded queue).
└─ Reddit — r/SideProject, r/LocalLLaMA (multi-LLM support is directly relevant),
   r/selfhosted (self-hostable via `make dev`). Post to ONE subreddit at a time,
   spaced a few hours apart, not all at once — looks like spam otherwise, and
   several of these subs rate-limit or remove simultaneous cross-posts.

Day 3–7 (once you have bandwidth to prep a gallery + reply fast on launch day)
└─ Product Hunt — needs more prep (gallery images, tagline, a maker comment
   ready to post the second it goes live). Don't rush this one out same-day.
```

General rules that apply to every platform:
- Reply to comments within the first few hours — algorithms (LinkedIn, HN ranking,
  Reddit) reward early engagement, and a fast founder response is itself part of
  the pitch.
- Watch GitHub Issues closely in the first 48h — the first few bug reports are a
  trust signal either way.
- Lead with the demo video or a screenshot, never a wall of text with no visual —
  it consistently outperforms text-only across every platform here.

---

## 1. LinkedIn

### Main post (English, founder voice)

> I spent the last few months building something I wanted to exist: a platform
> where you describe a company in a chat message, and AI designs its
> departments, staff, and skills — then actually runs it.
>
> AI – Collective lets AI "staff" collaborate through 6 orchestration topologies
> (sequential, ring, mesh, supervisor, tree, or a fully custom graph), execute
> real code in a sandbox — not just talk about it — and stream every turn live,
> with the ability to pause and step in mid-run.
>
> A few things I'm proud of under the hood:
> 🔹 LLM-agnostic — Gemini, Claude, GPT, DeepSeek, Kimi, GLM, or your own router
> 🔹 Scales from a laptop (in-memory, zero infra) to Kubernetes-backed sandboxes
> 🔹 Knowledge graph + long-term memory, so agents don't forget context across runs
> 🔹 A proper ports-and-adapters backend (FastAPI) + React frontend — I even
> wrote up the architecture as a short technical paper
>
> Today I'm making the source available: github.com/SuZeAI/ai-collective
>
> To be upfront: it's source-available, not OSI open-source — free for
> personal, academic, and research use, with a separate commercial license for
> production/SaaS use. I'd rather be clear about that than have anyone find out
> the hard way.
>
> It's still actively evolving (there's a public roadmap in the README), but
> `make dev` gets you a running instance in one command. Would love feedback,
> bug reports, or just thoughts from anyone who's built in this space.
>
> #AI #SourceAvailable #MultiAgent #LLM #BuildInPublic

### Short hook variant (A/B option, pair with the video as native upload)

> I asked myself: what if building a company was as easy as describing it in a
> chat?
>
> So I built AI – Collective — AI "staff" that design, staff, and run entire
> virtual companies, with real code execution and live human oversight.
> Source-available today: github.com/SuZeAI/ai-collective

Attach the video as a native LinkedIn upload (not a YouTube link) — native video
gets meaningfully better reach in-feed.

---

## 2. Twitter / X

Thread, not a single tweet — gives the video room to breathe and lets the
license disclaimer land as its own beat instead of a buried clause.

**Tweet 1** (attach the video natively here)
> Describe a company in a chat message. AI designs its departments, staff, and
> skills — then actually runs it.
>
> Built AI – Collective: multi-agent orchestration with real sandboxed code
> execution, not just chat.

**Tweet 2**
> 6 orchestration topologies (sequential, ring, mesh, supervisor, tree, custom
> graph), LLM-agnostic (Gemini / Claude / GPT / DeepSeek / Kimi / GLM), and you
> can pause + step into a run mid-execution.

**Tweet 3**
> Source-available today (not OSI open-source — free for personal, academic,
> and research use; commercial license available separately):
> github.com/SuZeAI/ai-collective
>
> `make dev` gets you running in one command. Feedback welcome.

---

## 3. Hacker News ("Show HN")

**Title:**
> Show HN: AI – Collective – describe a company in chat, AI staffs and runs it

**Post text** (HN strongly favors plain, low-hype, technical framing — no
emoji, no hashtags, lead with what it does and why you built it):

> AI – Collective is a platform for building and running "companies" — virtual
> organizations staffed entirely by AI. You describe what you want in chat, and
> it proposes departments, staff, and skills, then actually executes the work:
> real sandboxed code execution, streamed live, with the ability to pause and
> intervene mid-run.
>
> Staff run as LangGraph state machines, selectable per team as sequential,
> ring, mesh, supervisor, tree, or a fully custom DAG. It's LLM-agnostic
> (Gemini, Claude, GPT, DeepSeek, Kimi, GLM, or your own router), and the
> backend follows a fairly strict ports-and-adapters layout if that's of
> interest — architecture notes are in a short paper linked from the repo.
>
> It's source-available, not OSI open-source: free for personal, academic, and
> research use, commercial use needs a separate license (details in
> NOTICE/LICENSE). Wanted to be upfront about that here rather than let people
> find out after digging.
>
> `make dev` gets a full stack running locally. Happy to answer questions about
> the architecture, the sandboxing approach, or anything else.
>
> github.com/SuZeAI/ai-collective

No video on HN — link only, let the README and repo speak for themselves.

---

## 4. Reddit

Post to one subreddit at a time, a few hours apart. Each needs its own angle —
copy-pasting the same promo text across all three reads as spam and tends to
get auto-removed.

### r/SideProject

**Title:** Built an AI platform that designs, staffs, and runs entire virtual
companies from a chat description

**Body:**
> Spent the last few months on this: describe a company in chat, and AI
> proposes its departments, staff, and skills — then actually runs it, with
> real sandboxed code execution and live streaming of every step (you can
> pause and jump in mid-run).
>
> It's LLM-agnostic (Gemini/Claude/GPT/DeepSeek/Kimi/GLM) and supports 6
> different multi-agent orchestration patterns depending on how you want a
> team to collaborate.
>
> Just made the source available — it's source-available (not OSI
> open-source, free for personal/academic/research use, see the repo for the
> license). `make dev` gets a local instance running. Would love feedback:
> github.com/SuZeAI/ai-collective

### r/LocalLLaMA

**Title:** Multi-agent "virtual company" platform, LLM-agnostic (DeepSeek, GLM,
Kimi, GPT, Claude, Gemini, or bring your own router)

**Body:**
> Built a platform where AI staff collaborate through 6 orchestration
> topologies (sequential/ring/mesh/supervisor/tree/custom LangGraph DAG) to
> run actual work — real sandboxed code execution, not just chat completions.
>
> Model layer is fully provider-agnostic — config-driven, so swapping between
> DeepSeek, GLM, Kimi, GPT, Claude, Gemini, or a custom OpenAI-compatible
> router is a config change, not a code change. Curious what this community
> thinks of the orchestration approach, especially the mesh/custom-DAG modes.
>
> Source-available (not OSI open-source, see repo for exact terms), `make dev`
> to run locally: github.com/SuZeAI/ai-collective

### r/selfhosted

**Title:** Self-hostable multi-agent platform — AI designs and runs virtual
companies, LLM-agnostic, `make dev` to a running stack

**Body:**
> Fully self-hostable (Docker Compose for dev/prod, or bare `uvicorn`+`vite`
> with no infra at all for a quick local run). Describe a company in chat, AI
> designs the departments/staff/skills, then runs real tasks with sandboxed
> code execution.
>
> Config-driven storage/queue/lock backends (JSON files + in-memory by default,
> or Mongo/RabbitMQ/Redis if you want to scale it up), and it's LLM-agnostic so
> you're not locked into one provider.
>
> Source-available, not OSI open-source (license details in the repo — free
> for personal/academic/research use). Feedback welcome:
> github.com/SuZeAI/ai-collective

---

## 5. Product Hunt

Needs the most prep — a gallery (video + a few screenshots), a tagline under
60 characters, and a maker's first comment ready to post the moment it goes
live (sets the tone before anyone else comments).

**Tagline (≤60 chars):**
> Describe a company in chat. AI staffs and runs it.

**Description:**
> AI – Collective is a platform for building AI-powered companies — virtual
> organizations of any type (software, marketing, research, general) staffed
> entirely by AI. Describe what you want in a chat message; the platform
> proposes departments, staff, and skills, then actually runs the work with
> real sandboxed code execution, live streaming, and the ability to pause and
> intervene mid-run.
>
> - 6 staff orchestration topologies (sequential, ring, mesh, supervisor, tree,
>   custom LangGraph DAG)
> - LLM-agnostic: Gemini, Claude, GPT, DeepSeek, Kimi, GLM, or your own router
> - Real sandboxed code execution, not just chat
> - Scales from a zero-infra laptop setup to Kubernetes-backed sandboxes
> - Source-available — free for personal, academic, and research use

**Maker's first comment (post immediately on launch):**
> Hey everyone — maker here. Built this because I wanted a platform where
> describing a company was enough to get a working team on it, not just a
> chatbot that talks about doing work. Happy to answer anything about the
> architecture, the orchestration modes, or the sandboxing — and if you hit a
> bug, Issues are open and I'm watching them closely today.
