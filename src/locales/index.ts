export type Language = "en" | "vi" | "zh" | "ja";

export const LANGUAGES: { code: Language; label: string; flag: string }[] = [
  { code: "en", label: "English", flag: "🇺🇸" },
  { code: "vi", label: "Tiếng Việt", flag: "🇻🇳" },
  { code: "zh", label: "中文", flag: "🇨🇳" },
  { code: "ja", label: "日本語", flag: "🇯🇵" },
];

export type AuthTranslations = {
  badge: string;
  heroTitle: string;
  heroSub: string;
  heroBullets: string[];
  loginTab: string;
  registerTab: string;
  loginTitle: string;
  loginSubtitle: string;
  registerTitle: string;
  registerSubtitle: string;
  email: string;
  password: string;
  name: string;
  namePlaceholder: string;
  confirmPassword: string;
  loginBtn: string;
  registerBtn: string;
  loggingIn: string;
  registering: string;
  or: string;
  profileBtn: string;
  logoutBtn: string;
  editProfile: string;
  changePassword: string;
  currentPassword: string;
  newPassword: string;
  saveChanges: string;
  saving: string;
  saved: string;
  cancel: string;
  accountInfo: string;
  role: string;
  userId: string;
  memberSince: string;
  dangerZone: string;
  logoutDesc: string;
  passwordMismatch: string;
  errorDefault: string;
  orContinueWith: string;
  socialComingSoon: string;
  phoneBtn: string;
  phonePlaceholder: string;
  sendCode: string;
  sendingCode: string;
  verifyCode: string;
  codePlaceholder: string;
  verifyBtn: string;
  phoneNote: string;
};

export type Translations = {
  auth: AuthTranslations;
  nav: {
    label: string;
    dashboard: string;
    agents: string;
    skills: string;
    teams: string;
    tasks: string;
    projects: string;
    conversations: string;
    analytics: string;
    playground: string;
    workspaces: string;
    officeBuilder: string;
    virtualOffice: string;
    marketplace: string;
    documentLibrary: string;
    settings: string;
    overviewGroup: string;
    companiesGroup: string;
    catalogGroup: string;
    operationsGroup: string;
    orgGroup: string;
    officeGroup: string;
    devGroup: string;
    systemGroup: string;
    adminGroup: string;
    monitoring: string;
    consumption: string;
    manageWorkspaces: string;
    monitoringBadge: string;
    selectCompanyToManage: string;
    suggestedBadge: string;
  };
  companyTypeLabel: string;
  companyTypes: { software: string; marketing: string; research: string; general: string };
  documentLibrary: {
    title: string;
    subtitle: string;
    overallScopeHint: string;
    selectUnitFirst: string;
    upload: string;
    addFromUrl: string;
    urlPlaceholder: string;
    search: string;
    empty: string;
    emptyHint: string;
    download: string;
    delete: string;
    deleteConfirm: string;
    attachToProject: string;
    selectProject: string;
    attach: string;
    cancel: string;
    add: string;
    uploading: string;
    dropHint: string;
    descriptionOptional: string;
    tagsOptional: string;
    nameOptional: string;
    uploadedBy: string;
    attachSuccess: string;
    uploadSuccess: string;
    deleteSuccess: string;
    all: string;
    types: { pdf: string; excel: string; doc: string; image: string; link: string; other: string };
  };
  status: { allSystemsOnline: string };
  brand: { subtitle: string };
  landing: {
    nav: { getStarted: string };
    hero: {
      badge: string;
      h1: [string, string, string];
      sub: string;
      cta1: string;
      cta2: string;
    };
    features: {
      label: string;
      title: string;
      items: Array<{ title: string; desc: string }>;
    };
    modular: {
      label: string;
      title: string;
      desc: string;
      bullets: [string, string, string, string];
    };
    openSource: {
      label: string;
      title: string;
      desc: string;
      stars: string;
      forks: string;
      issues: string;
      starCta: string;
      launch: string;
    };
    footer: { copy: string };
  };
  marketing: {
    common: { login: string; startBuilding: string; contactSales: string; devDocs: string; viewPricing: string };
    meet: {
      badge: string; h1: string; sub: string;
      productsLabel: string; productsTitle: string;
      product1Name: string; product1Desc: string; product1Cta: string;
      product2Name: string; product2Desc: string; product2Cta: string;
      featuresLabel: string; featuresTitle: string;
      modelsLabel: string; modelsTitle: string; modelsSub: string;
      ctaTitle: string; ctaSub: string; ctaFree: string;
    };
    pricing: {
      badge: string; h1: string; sub: string;
      plan1Name: string; plan1Price: string; plan1Period: string; plan1Desc: string; plan1Cta: string;
      plan2Name: string; plan2Price: string; plan2Period: string; plan2Desc: string; plan2Cta: string;
      plan3Name: string; plan3Price: string; plan3Period: string; plan3Desc: string; plan3Cta: string;
      apiLabel: string; apiTitle: string; apiSub: string;
      ctaTitle: string; ctaSub: string; ctaGithub: string;
    };
    solutions: {
      badge: string; h1: string; sub: string;
      useCasesLabel: string; useCasesTitle: string;
      sizeLabel: string; sizeTitle: string;
      industriesLabel: string; industriesTitle: string;
      ctaTitle: string; ctaSub: string;
    };
    resources: {
      badge: string; h1: string; sub: string;
      card1Label: string; card1Title: string; card1Desc: string; card1Cta: string;
      card2Label: string; card2Title: string; card2Desc: string; card2Cta: string;
      card3Label: string; card3Title: string; card3Desc: string; card3Cta: string;
      articlesLabel: string; articlesTitle: string;
      newsletterTitle: string; newsletterSub: string; newsletterBtn: string; newsletterNote: string;
    };
    changelog: {
      badge: string; h1: string; sub: string; viewGithub: string;
    };
    contactSales: {
      badge: string;
      h1: string;
      sub: string;
      supportCardTitle: string;
      supportCardDesc: string;
      supportCardCta: string;
      formHelpLabel: string;
      formHelpPlaceholder: string;
      options: {
        sales: string;
        limits: string;
        baa: string;
        zdr: string;
        support: string;
      };
      firstName: string;
      lastName: string;
      email: string;
      emailHint: string;
      phone: string;
      companyName: string;
      companyWebsite: string;
      jobTitle: string;
      industry: string;
      hq: string;
      interest: string;
      employees: string;
      journey: string;
      message: string;
      source: string;
      submitBtn: string;
      submitting: string;
      successTitle: string;
      successDesc: string;
    };
  };
  docs: {
    ui: {
      search: string;
      backToSite: string;
      openApp: string;
      docsLabel: string;
      documentation: string;
      previous: string;
      next: string;
      editOnGitHub: string;
      noResults: string;
      pageNotFound: string;
      comingSoon: string;
    };
    nav: {
      sections: Record<string, string>;
      items: Record<string, string>;
    };
    content: {
      "what-is": {
        h1: string; p1: string; p2: string; callout: string;
        keyFeaturesH2: string; features: string[];
        whoForH2: string; audience: Array<{ title: string; desc: string }>;
      };
      architecture: {
        h1: string; p1: string;
        lifecycleH2: string; lifecycleP: string; lifecycle: string[];
      };
      "key-concepts": {
        h1: string; p1: string;
        concepts: Array<{ title: string; desc: string }>;
      };
      quickstart: {
        h1: string; p1: string; callout: string;
        cloneH2: string; backendH2: string; envH2: string;
        startBackendH2: string; startFrontendH2: string; tipCallout: string;
      };
      installation: {
        h1: string;
        requirementsH2: string; tableHeaders: [string, string, string];
        pythonH2: string; pythonP: string;
        frontendH2: string; frontendP: string;
        rabbitH2: string; rabbitP: string;
      };
      configuration: {
        h1: string; p1: string;
        apiKeysH2: string; frontendH2: string; frontendP: string;
      };
      agents: {
        h1: string; p1: string; schemaH2: string;
        rolesH2: string; rolesP: string; callout: string;
        lifecycleH2: string; restH2: string;
      };
      skills: {
        h1: string; p1: string; typesH2: string;
        types: Array<{ desc: string }>; toolsH2: string; schemaH2: string;
      };
      teams: {
        h1: string; p1: string; modesH2: string;
        mesh: { title: string; desc: string };
        sequential: { title: string; desc: string };
        schemaH2: string;
      };
      tasks: {
        h1: string; p1: string; lifecycleH2: string; schemaH2: string;
        graphH2: string; graphP: string; graphCallout: string;
      };
      conversations: {
        h1: string; p1: string; formatH2: string;
        filterH2: string; filterP: string;
      };
      "guide-first-agent": {
        h1: string; p1: string;
        step1H2: string; step1P: string;
        step2H2: string;
        step3H2: string; step3P: string;
        step4H2: string; step4P: string;
        step5H2: string; step5P: string; callout: string;
      };
      "guide-build-team": {
        h1: string; p1: string; compositionH2: string;
        teamRoles: Array<{ role: string; purpose: string }>;
        createH2: string; createP: string;
      };
      "guide-run-task": {
        h1: string; p1: string;
        uiH2: string; uiP: string;
        restH2: string; monitorH2: string; monitorP: string;
      };
      "guide-skills": {
        h1: string; p1: string;
        webSearchH2: string; webSearchP: string;
        sheetsH2: string; sheetsCallout: string; customH2: string;
      };
      "api-agents": { h1: string; p1: string; endpointsH2: string; createH2: string };
      "api-skills": { h1: string; presetsH2: string };
      "api-teams": { h1: string };
      "api-tasks": { h1: string };
      "api-chat": { h1: string; p1: string };
      "deploy-docker": { h1: string; p1: string };
      "deploy-env": { h1: string };
      "contributing-guide": {
        h1: string; p1: string; waysH2: string; ways: string[];
        prH2: string; callout: string;
      };
      "contributing-dev": {
        h1: string; hooksH2: string; hooksP: string;
        testsH2: string; styleH2: string; style: string[];
      };
    };
  };
};

export const translations: Record<Language, Translations> = {
  en: {
    auth: {
      badge: "Multi-Agent AI Platform",
      heroTitle: "Build AI agent teams that work together",
      heroSub: "Orchestrate specialized AI agents — researcher, developer, reviewer — to collaborate and complete complex tasks autonomously.",
      heroBullets: ["40+ built-in agent role templates", "Skill system with 10+ integrations", "Real-time task graph visualization", "Self-hosted & MIT licensed"],
      loginTab: "Sign In",
      registerTab: "Register",
      loginTitle: "Welcome back",
      loginSubtitle: "Sign in to continue to AI Collective",
      registerTitle: "Create an account",
      registerSubtitle: "Start building your AI agent team",
      email: "Email",
      password: "Password",
      name: "Full Name",
      namePlaceholder: "John Doe",
      confirmPassword: "Confirm Password",
      loginBtn: "Sign In",
      registerBtn: "Create Account",
      loggingIn: "Signing in…",
      registering: "Creating account…",
      or: "or",
      profileBtn: "My Profile",
      logoutBtn: "Sign Out",
      editProfile: "Edit Profile",
      changePassword: "Change Password",
      currentPassword: "Current Password",
      newPassword: "New Password",
      saveChanges: "Save Changes",
      saving: "Saving…",
      saved: "Saved!",
      cancel: "Cancel",
      accountInfo: "Account Information",
      role: "Role",
      userId: "User ID",
      memberSince: "Member since",
      dangerZone: "Danger Zone",
      logoutDesc: "Sign out of your account on this device.",
      passwordMismatch: "Passwords do not match.",
      errorDefault: "Something went wrong. Please try again.",
      orContinueWith: "Or continue with",
      socialComingSoon: "Social login coming soon",
      phoneBtn: "Phone Number",
      phonePlaceholder: "+1 (555) 000-0000",
      sendCode: "Send Code",
      sendingCode: "Sending…",
      verifyCode: "Enter verification code",
      codePlaceholder: "000000",
      verifyBtn: "Verify",
      phoneNote: "We'll send a verification code to your number.",
    },
    nav: {
      label: "Navigation", dashboard: "Company Overview", agents: "Staff",
      skills: "Skills & Tools", teams: "Departments", tasks: "Task Board", projects: "Projects",
      conversations: "Meetings", analytics: "Performance & Cost", playground: "Training", workspaces: "Manage Companies",
      officeBuilder: "AI Office Designer",
      virtualOffice: "Office Map",
      marketplace: "Recruiting",
      documentLibrary: "Documents",
      settings: "Settings",
      overviewGroup: "Overview",
      companiesGroup: "Companies",
      catalogGroup: "Catalog",
      operationsGroup: "Operations",
      orgGroup: "Organization",
      officeGroup: "Workspace",
      devGroup: "System Setup",
      systemGroup: "Tools",
      adminGroup: "Administration",
      monitoring: "System Monitoring",
      consumption: "Usage & Billing",
      manageWorkspaces: "Manage Companies",
      monitoringBadge: "Monitoring",
      selectCompanyToManage: "Select a company to open this page.",
      suggestedBadge: "Suggested for this company type",
    },
    companyTypeLabel: "Company type",
    companyTypes: { software: "Software", marketing: "Marketing", research: "Research", general: "General" },
    documentLibrary: {
      title: "Document Library",
      subtitle: "Shared documents for this business unit — reusable across its projects.",
      overallScopeHint: "Select a business unit to manage its document library.",
      selectUnitFirst: "Select a business unit first.",
      upload: "Upload document",
      addFromUrl: "Add from link",
      urlPlaceholder: "https://example.com/article",
      search: "Search documents…",
      empty: "No documents yet",
      emptyHint: "Upload a file or add a link to build this unit's library.",
      download: "Download",
      delete: "Delete",
      deleteConfirm: "Delete this document?",
      attachToProject: "Attach to project",
      selectProject: "Select a project",
      attach: "Attach",
      cancel: "Cancel",
      add: "Add",
      uploading: "Uploading…",
      dropHint: "Drag & drop a file here, or click to choose",
      descriptionOptional: "Description (optional)",
      tagsOptional: "Tags, comma separated (optional)",
      nameOptional: "Name (optional)",
      uploadedBy: "Uploaded by",
      attachSuccess: "Document attached to project.",
      uploadSuccess: "Document uploaded.",
      deleteSuccess: "Document deleted.",
      all: "All",
      types: { pdf: "PDF", excel: "Excel", doc: "Document", image: "Image", link: "Link", other: "Other" },
    },
    status: { allSystemsOnline: "All systems online" },
    brand: { subtitle: "Company Builder" },
    landing: {
      nav: { getStarted: "Get Started" },
      hero: {
        badge: "Open Source · MIT License",
        h1: ["An open-source AI collective", "that researches, codes,", "and creates"],
        sub: "Build specialized agent teams — each with their own role, skills, and memory. Submit a task, watch them collaborate, get production-ready results.",
        cta1: "Get Started", cta2: "Read the Docs",
      },
      features: {
        label: "What's included",
        title: "Everything you need to build\nAI-powered workflows",
        items: [
          { title: "Multi-Agent Architecture", desc: "Specialized agents with distinct roles — PM, Researcher, Developer, Reviewer — each with a focused system prompt." },
          { title: "Skill System", desc: "Attach tools and integrations to any agent: web search, Google Sheets, code execution, REST APIs, browser automation." },
          { title: "Team Execution Modes", desc: "Mesh mode for open collaboration or sequential mode for strict pipelines. Configure per team." },
          { title: "Real-time Task Graph", desc: "SVG visualization of agent interactions with pan & zoom. Watch your agents work in real time." },
          { title: "LangGraph Powered", desc: "The orchestration layer is built on LangGraph — battle-tested, composable, and production-ready." },
          { title: "Self-Hosted & MIT", desc: "Full control over your data and infrastructure. No vendor lock-in. Deploy on any cloud or on-premise." },
        ],
      },
      modular: {
        label: "Modular by design",
        title: "Compose agents,\nskills, and teams",
        desc: "Every agent is a configurable unit. Assign any combination of skills — web search, code execution, Google integrations, custom APIs — and compose them into teams with a single config.",
        bullets: ["40+ built-in agent role templates", "10+ integrations out of the box", "Custom JavaScript skill support", "REST API for programmatic control"],
      },
      openSource: {
        label: "Open Source",
        title: "Originated from Open Source,\ngive back to Open Source",
        desc: "AI Collective is MIT-licensed and built in public. Star the repo, fork it, open issues, or contribute — this is your platform too.",
        stars: "Stars", forks: "Forks", issues: "Open Issues",
        starCta: "Star on GitHub", launch: "Launch App",
      },
      footer: { copy: "© 2026 AI Collective · MIT License" },
    },
    marketing: {
      common: { login: "Login", startBuilding: "Start building", contactSales: "Contact sales", devDocs: "Developer docs", viewPricing: "View pricing" },
      meet: {
        badge: "Meet AI Collective", h1: "A new era of programmable AI",
        sub: "AI Collective is a high-performance multi-agent orchestration platform that lets you deploy, coordinate, and scale AI workforces — with full control over topology, tools, and execution environment.",
        productsLabel: "Products", productsTitle: "Two ways to deploy",
        product1Name: "AI Collective", product1Desc: "The full platform — build, configure, and monitor multi-agent teams via dashboard and REST API.", product1Cta: "Open console",
        product2Name: "Agent Mesh", product2Desc: "A standalone mesh orchestrator layer for integrating multi-agent routing into your existing stack.", product2Cta: "Read the docs",
        featuresLabel: "Features", featuresTitle: "Everything you need to orchestrate AI",
        modelsLabel: "Models", modelsTitle: "Fully LLM-agnostic", modelsSub: "Configure, swap, or route model engines at runtime — no code changes required.",
        ctaTitle: "Ready to build?", ctaSub: "Deploy your first multi-agent workforce in minutes.", ctaFree: "Start building free",
      },
      pricing: {
        badge: "Pricing", h1: "Simple, transparent pricing", sub: "Start free with open source. Scale with managed hosting. Grow with enterprise.",
        plan1Name: "Open Source", plan1Price: "Free", plan1Period: "forever", plan1Desc: "Self-host the full AI Collective platform on your own infrastructure.", plan1Cta: "Get started on GitHub",
        plan2Name: "Pro", plan2Price: "$49", plan2Period: "per month", plan2Desc: "Managed hosting, distributed backends, and priority support for growing teams.", plan2Cta: "Start free trial",
        plan3Name: "Enterprise", plan3Price: "Custom", plan3Period: "tailored pricing", plan3Desc: "Dedicated infrastructure, custom integrations, and guaranteed SLAs for large deployments.", plan3Cta: "Contact sales",
        apiLabel: "API Pricing", apiTitle: "Pay-as-you-go model costs", apiSub: "LLM token costs are passed through at provider rates. No markup.",
        ctaTitle: "Have questions?", ctaSub: "Our team is ready to help you find the right plan.", ctaGithub: "Explore on GitHub",
      },
      solutions: {
        badge: "Solutions", h1: "AI Collective for every team", sub: "From startup prototyping to enterprise-grade orchestration — deploy the right multi-agent solution for your use case.",
        useCasesLabel: "Use Cases", useCasesTitle: "What teams build with AI Collective",
        sizeLabel: "Company Size", sizeTitle: "Right for your scale",
        industriesLabel: "Industries", industriesTitle: "Built for regulated, high-stakes domains",
        ctaTitle: "Find your solution", ctaSub: "Talk to our team to design the right agent architecture.",
      },
      resources: {
        badge: "Resources", h1: "Everything you need to ship faster", sub: "Guides, reference docs, the changelog, and community resources — all in one place.",
        card1Label: "Documentation", card1Title: "Developer Docs", card1Desc: "Full API reference, topology guides, tool integration recipes, and deployment playbooks.", card1Cta: "Open docs",
        card2Label: "Open Source", card2Title: "GitHub Repository", card2Desc: "Explore the source code, contribute, file issues, and track development on GitHub.", card2Cta: "View on GitHub",
        card3Label: "Updates", card3Title: "Changelog", card3Desc: "Follow every release — new topologies, toolkit additions, performance improvements, and breaking changes.", card3Cta: "See changelog",
        articlesLabel: "From the Team", articlesTitle: "Latest articles & guides",
        newsletterTitle: "Stay up to date", newsletterSub: "Product updates, new toolkits, and engineering deep-dives — monthly, no spam.", newsletterBtn: "Subscribe", newsletterNote: "Unsubscribe at any time.",
      },
      changelog: {
        badge: "Changelog", h1: "What's new in AI Collective", sub: "Every release, every improvement, every fix — documented in one place.", viewGithub: "View on GitHub",
      },
      contactSales: {
        badge: "Contact Sales",
        h1: "Contact sales",
        sub: "Our sales team can provide resources for custom support with the AI Collective API or large, complex deployments. Or to get started now, explore our self-serve plans.",
        supportCardTitle: "More help, right this way",
        supportCardDesc: "Browse articles, see product details, and get answers to technical questions.",
        supportCardCta: "Visit support center",
        formHelpLabel: "What can we help you with?",
        formHelpPlaceholder: "Please select",
        options: {
          sales: "Contact sales",
          limits: "Increase rate limits",
          baa: "Business associate agreement (BAA)",
          zdr: "Zero data retention (ZDR)",
          support: "Product support",
        },
        firstName: "First name",
        lastName: "Last name",
        email: "Business email",
        emailHint: "If you're an existing user, please enter your account email.",
        phone: "Phone number",
        companyName: "Company or organization name",
        companyWebsite: "Company or organization website",
        jobTitle: "Job title",
        industry: "Industry",
        hq: "Company headquarters location",
        interest: "Primary product interest",
        employees: "What is your company's employee count?",
        journey: "Where are you in your evaluation journey?",
        message: "Please share a bit more about why you're contacting us...",
        source: "How did you hear about us?",
        submitBtn: "Submit",
        submitting: "Submitting...",
        successTitle: "Thank you!",
        successDesc: "Your request has been submitted. Our team will review it and contact you shortly.",
      },
    },
    docs: {
      ui: {
        search: "Search docs...", backToSite: "Back to site", openApp: "Open App",
        docsLabel: "Docs", documentation: "Documentation", previous: "Previous", next: "Next",
        editOnGitHub: "Edit this page on GitHub", noResults: "No results found",
        pageNotFound: "Page not found", comingSoon: "This section is coming soon.",
      },
      nav: {
        sections: { intro: "Introduction", "getting-started": "Getting Started", concepts: "Core Concepts", guides: "Guides", "api-reference": "API Reference", deployment: "Deployment", contributing: "Contributing" },
        items: { "what-is": "What is AI Collective?", architecture: "Architecture", "key-concepts": "Key Concepts", quickstart: "Quick Start", installation: "Installation", configuration: "Configuration", agents: "Agents", skills: "Skills", teams: "Teams", tasks: "Tasks", conversations: "Conversations", "guide-first-agent": "Create Your First Agent", "guide-build-team": "Build a Team", "guide-run-task": "Run a Task", "guide-skills": "Add Skills & APIs", "api-agents": "Agents API", "api-skills": "Skills API", "api-teams": "Teams API", "api-tasks": "Tasks API", "api-chat": "Chat API", "deploy-docker": "Docker", "deploy-env": "Environment Variables", "contributing-guide": "How to Contribute", "contributing-dev": "Development Setup" },
      },
      content: {
        "what-is": {
          h1: "What is AI Collective?",
          p1: "AI Collective is an open-source multi-agent orchestration platform that lets you build teams of specialized AI agents which collaborate autonomously to complete complex tasks — just like a real project team.",
          p2: "Instead of using a single monolithic AI, AI Collective distributes work across purpose-built agents: a Project Manager agent that plans, a Research agent that gathers information, a Developer agent that writes code, and a Reviewer agent that validates every output before delivery.",
          callout: "AI Collective is self-hosted and fully open source (MIT License). You can run it locally in minutes or deploy it on any cloud provider.",
          keyFeaturesH2: "Key Features",
          features: ["Multi-agent collaboration — agents communicate through an event-driven message bus (RabbitMQ)", "Customizable roles — 40+ built-in role templates from PM to Doctor to Lawyer, or define your own", "Skill system — attach integrations (Google Sheets, APIs, web browsing) to individual agents", "Team modes — choose between mesh (all agents collaborate) or sequential (pipeline) execution", "Real-time task graph — visualize agent activity with pan & zoom graph view", "LangChain / LangGraph backend — powered by battle-tested AI orchestration primitives", "React + FastAPI stack — modern, maintainable codebase with TypeScript and Python"],
          whoForH2: "Who is it for?",
          audience: [{ title: "Developers", desc: "Build AI-powered workflows without managing complex agent infrastructure." }, { title: "Teams", desc: "Automate research, writing, coding, and review pipelines with AI specialists." }, { title: "Researchers", desc: "Experiment with multi-agent architectures and collaboration strategies." }],
        },
        architecture: {
          h1: "Architecture",
          p1: "AI Collective is split into two layers: a FastAPI backend that runs the AI agents, and a React frontend that provides the visual management interface.",
          lifecycleH2: "Request Lifecycle",
          lifecycleP: "When you submit a task, this is what happens:",
          lifecycle: ["Frontend sends a POST /api/tasks request with the task description and assigned team", "The Task Runner spins up a LangGraph graph with each agent as a node", "Agents receive messages, process them via the LLM provider, and emit events to RabbitMQ", "The Event Bus routes agent outputs to dependent agents (e.g., PM → Developer)", "Each agent's tool calls (web search, code execution, API calls) are handled by the Skill Executor", "Final output is collected by the Reviewer agent and returned to the frontend via REST"],
        },
        "key-concepts": {
          h1: "Key Concepts",
          p1: "Before diving in, here are the five primitives that make up every AI Collective deployment:",
          concepts: [{ title: "Agent", desc: "An AI worker with a defined role, personality, and set of skills. Each agent has its own system prompt and tool access." }, { title: "Skill", desc: "A capability you attach to an agent — a web search tool, a Google Sheets integration, a custom JavaScript function, or a REST API call." }, { title: "Team", desc: "A named group of agents that collaborate on tasks. Teams can run in mesh mode (all-to-all) or sequential mode (pipeline)." }, { title: "Task", desc: "A unit of work assigned to a team. Tasks have a lifecycle: pending → in-progress → completed (or paused / stopped)." }, { title: "Conversation", desc: "The full message history of every agent interaction during a task. Browse and replay any agent conversation." }],
        },
        quickstart: {
          h1: "Quick Start", p1: "Get AI Collective running locally in under 5 minutes.",
          callout: "Prerequisites: Python 3.11+, Node.js 18+, and an Anthropic or OpenAI API key.",
          cloneH2: "1. Clone the repository", backendH2: "2. Set up the backend",
          envH2: "3. Configure environment", startBackendH2: "4. Start the backend",
          startFrontendH2: "5. Start the frontend",
          tipCallout: "The frontend development server proxies API requests to localhost:8000 automatically. No CORS configuration needed.",
        },
        installation: {
          h1: "Installation", requirementsH2: "System Requirements",
          tableHeaders: ["Component", "Minimum", "Recommended"],
          pythonH2: "Python dependencies", pythonP: "The backend is managed with pyproject.toml. Key dependencies:",
          frontendH2: "Frontend dependencies", frontendP: "The frontend uses React 18, Vite, shadcn/ui, and Tailwind CSS.",
          rabbitH2: "Optional: RabbitMQ", rabbitP: "For multi-agent event broadcasting, you can run RabbitMQ locally via Docker:",
        },
        configuration: {
          h1: "Configuration", p1: "All configuration is done through environment variables in a .env file at the project root.",
          apiKeysH2: "API Keys", frontendH2: "Frontend configuration",
          frontendP: "The Vite dev server runs on port 8080 and expects the backend at localhost:8000. To change these:",
        },
        agents: {
          h1: "Agents", p1: "An agent is an AI worker with a defined role, a personality expressed through its system prompt, and a set of skills (tools) it can use to complete work.",
          schemaH2: "Agent schema", rolesH2: "Agent roles", rolesP: "AI Collective ships with 40+ built-in role templates. Here are the most common ones:",
          callout: "You can type any custom role name — the built-in list is just a starting suggestion.",
          lifecycleH2: "Agent status lifecycle", restH2: "Create via REST API",
        },
        skills: {
          h1: "Skills", p1: "A skill is a capability you attach to an agent — it can be a third-party API integration, a browser automation tool, a custom JavaScript function, or any other action the agent can invoke.",
          typesH2: "Skill types",
          types: [{ desc: "Connect to external services: Google Sheets, Slack, Notion, Airtable, REST APIs, and more." }, { desc: "Write custom JavaScript code that runs server-side. Great for data transformation or business logic." }],
          toolsH2: "Available built-in tools", schemaH2: "Skill schema",
        },
        teams: {
          h1: "Teams", p1: "A team is a named group of agents that collaborate on tasks. Teams are the unit of execution — you assign tasks to a team, not to individual agents.",
          modesH2: "Team modes",
          mesh: { title: "Mesh mode", desc: "All agents can communicate with each other. Best for creative or research tasks where agents need to debate and refine ideas together." },
          sequential: { title: "Sequential mode", desc: "Agents run in a defined pipeline order. Best for structured workflows: Research → Write → Review → Publish." },
          schemaH2: "Team schema",
        },
        tasks: {
          h1: "Tasks", p1: "A task is a unit of work you submit to a team. It has a title, description, and a lifecycle that progresses from pending to completed.",
          lifecycleH2: "Task lifecycle", schemaH2: "Task schema",
          graphH2: "Task graph visualization", graphP: "The Task Manager page shows a real-time SVG graph of agent interactions. Each node is an agent, and edges show message flow between them. You can pan and zoom to explore large agent networks.",
          graphCallout: "The graph uses a force-directed layout powered by a custom SVG renderer — no third-party graph library required.",
        },
        conversations: {
          h1: "Conversations", p1: "Every message exchanged between agents during a task is recorded as a conversation. The Conversations page lets you browse, filter, and replay all agent communications.",
          formatH2: "Message format", filterH2: "Filtering",
          filterP: "Filter conversations by agent name, role, task, or date range. Messages support full-text search and are rendered with Markdown formatting.",
        },
        "guide-first-agent": {
          h1: "Create Your First Agent", p1: "This guide walks you through creating a Research Agent from scratch using the UI.",
          step1H2: "Step 1: Open Agent Builder", step1P: "Navigate to Agents in the sidebar, then click New Agent in the top right.",
          step2H2: "Step 2: Fill in the details",
          step3H2: "Step 3: Choose an avatar", step3P: "Select icon mode and pick the search icon. Choose a teal background color to match the Research Agent role.",
          step4H2: "Step 4: Assign skills", step4P: "Check Web Search and Web Scrape skills from the skill panel. If you don't have skills yet, go to the Skills page first.",
          step5H2: "Step 5: Save", step5P: "Click Create Agent. Alice will now appear in your agent roster with an idle status.",
          callout: "Test Alice immediately by clicking the Test button on her card and entering a research question.",
        },
        "guide-build-team": {
          h1: "Build a Team", p1: "Teams combine multiple agents into a collaborative unit. Let's build a research & writing team.",
          compositionH2: "Recommended team composition",
          teamRoles: [{ role: "Project Manager", purpose: "Coordinates task breakdown and delegates to other agents" }, { role: "Research Agent", purpose: "Gathers information from the web and synthesizes findings" }, { role: "Developer Agent", purpose: "Writes code or technical documentation" }, { role: "Reviewer Agent", purpose: "Validates all outputs before delivery" }],
          createH2: "Create the team", createP: "Go to Teams → New Team, add all four agents in order, select mesh mode for collaborative tasks, then save.",
        },
        "guide-run-task": {
          h1: "Run a Task", p1: "With a team built, submit your first task.",
          uiH2: "Via the UI", uiP: "Navigate to Tasks → New Task, fill in a title and description, assign your team, and click Create Task. The task will move to in-progress status and you can watch the agent graph animate in real time.",
          restH2: "Via REST API", monitorH2: "Monitor progress", monitorP: "Poll the task status endpoint, or watch the live graph in the Tasks UI:",
        },
        "guide-skills": {
          h1: "Add Skills & APIs", p1: "Skills extend what agents can do. Here's how to add a web search skill.",
          webSearchH2: "Create a web search skill", webSearchP: "Navigate to Skills → New Skill:",
          sheetsH2: "Create a Google Sheets integration",
          sheetsCallout: "Google OAuth requires setting up a project in Google Cloud Console and downloading credentials.json. See the Google integration guide for details.",
          customH2: "Custom JavaScript skill",
        },
        "api-agents": { h1: "Agents API", p1: "Base URL: http://localhost:8000/api", endpointsH2: "Endpoints", createH2: "Create agent" },
        "api-skills": { h1: "Skills API", presetsH2: "Get tool presets" },
        "api-teams": { h1: "Teams API" },
        "api-tasks": { h1: "Tasks API" },
        "api-chat": { h1: "Chat API", p1: "Test individual agents directly without creating a full task." },
        "deploy-docker": { h1: "Docker Deployment", p1: "Deploy the entire stack with Docker Compose." },
        "deploy-env": { h1: "Environment Variables" },
        "contributing-guide": {
          h1: "How to Contribute", p1: "AI Collective welcomes contributions of all kinds: bug fixes, new features, documentation improvements, and more.",
          waysH2: "Ways to contribute",
          ways: ["⭐ Star the repo on GitHub to help others discover the project", "🐛 Report bugs by opening a GitHub issue with a reproduction case", "💡 Request features by opening a discussion in the GitHub Discussions tab", "🔧 Fix bugs by submitting a pull request", "📝 Improve docs — even fixing typos is valuable!"],
          prH2: "Pull request process", callout: "All PRs run through CI: backend linting (ruff), frontend type-checking (tsc), and tests (vitest). Make sure all checks pass before requesting review.",
        },
        "contributing-dev": {
          h1: "Development Setup", hooksH2: "Pre-commit hooks",
          hooksP: "This installs hooks for: Python formatting (ruff), trailing whitespace, end-of-file newlines, and YAML/TOML validation.",
          testsH2: "Run tests", styleH2: "Code style",
          style: ["Python: ruff for linting and formatting", "TypeScript: ESLint + TypeScript strict mode", "Commits: conventional commits format (feat:, fix:, docs:)"],
        },
      },
    },
  },

  vi: {
    auth: {
      badge: "Nền tảng AI đa tác nhân",
      heroTitle: "Xây dựng nhóm tác nhân AI cộng tác cùng nhau",
      heroSub: "Điều phối các tác nhân AI chuyên biệt — nhà nghiên cứu, nhà phát triển, người kiểm duyệt — để cộng tác và hoàn thành các nhiệm vụ phức tạp tự động.",
      heroBullets: ["Hơn 40 mẫu vai trò tác nhân tích hợp", "Hệ thống kỹ năng với 10+ tích hợp", "Trực quan hóa đồ thị nhiệm vụ thời gian thực", "Tự lưu trữ & giấy phép MIT"],
      loginTab: "Đăng nhập",
      registerTab: "Đăng ký",
      loginTitle: "Chào mừng trở lại",
      loginSubtitle: "Đăng nhập để tiếp tục sử dụng AI Collective",
      registerTitle: "Tạo tài khoản",
      registerSubtitle: "Bắt đầu xây dựng nhóm tác nhân AI của bạn",
      email: "Email",
      password: "Mật khẩu",
      name: "Họ và tên",
      namePlaceholder: "Nguyễn Văn A",
      confirmPassword: "Xác nhận mật khẩu",
      loginBtn: "Đăng nhập",
      registerBtn: "Tạo tài khoản",
      loggingIn: "Đang đăng nhập…",
      registering: "Đang tạo tài khoản…",
      or: "hoặc",
      profileBtn: "Hồ sơ của tôi",
      logoutBtn: "Đăng xuất",
      editProfile: "Chỉnh sửa hồ sơ",
      changePassword: "Đổi mật khẩu",
      currentPassword: "Mật khẩu hiện tại",
      newPassword: "Mật khẩu mới",
      saveChanges: "Lưu thay đổi",
      saving: "Đang lưu…",
      saved: "Đã lưu!",
      cancel: "Hủy",
      accountInfo: "Thông tin tài khoản",
      role: "Vai trò",
      userId: "ID người dùng",
      memberSince: "Thành viên từ",
      dangerZone: "Vùng nguy hiểm",
      logoutDesc: "Đăng xuất khỏi tài khoản của bạn trên thiết bị này.",
      passwordMismatch: "Mật khẩu không khớp.",
      errorDefault: "Đã xảy ra lỗi. Vui lòng thử lại.",
      orContinueWith: "Hoặc tiếp tục với",
      socialComingSoon: "Đăng nhập mạng xã hội sắp ra mắt",
      phoneBtn: "Số điện thoại",
      phonePlaceholder: "+84 (90) 000-0000",
      sendCode: "Gửi mã",
      sendingCode: "Đang gửi…",
      verifyCode: "Nhập mã xác minh",
      codePlaceholder: "000000",
      verifyBtn: "Xác minh",
      phoneNote: "Chúng tôi sẽ gửi mã xác minh đến số của bạn.",
    },
    nav: {
      label: "Điều hướng", dashboard: "Tổng quan Công ty", agents: "Nhân sự",
      skills: "Nghiệp vụ & Công cụ", teams: "Phòng ban", tasks: "Bảng Công việc", projects: "Dự án",
      conversations: "Cuộc họp", analytics: "Hiệu suất & Chi phí", playground: "Đào tạo", workspaces: "Quản lý Công ty",
      officeBuilder: "AI Thiết kế Công ty",
      virtualOffice: "Sơ đồ Văn phòng",
      marketplace: "Tuyển dụng",
      documentLibrary: "Tài liệu",
      settings: "Cài đặt",
      overviewGroup: "Tổng quan",
      companiesGroup: "Công ty",
      catalogGroup: "Danh mục",
      operationsGroup: "Vận hành",
      orgGroup: "Tổ chức",
      officeGroup: "Không gian",
      devGroup: "Thiết lập Hệ thống",
      systemGroup: "Công cụ",
      adminGroup: "Quản trị",
      monitoring: "Giám sát hệ thống",
      consumption: "Sử dụng & Chi phí",
      manageWorkspaces: "Quản lý Công ty",
      monitoringBadge: "Giám sát",
      selectCompanyToManage: "Chọn một company để mở trang này.",
      suggestedBadge: "Đề xuất cho loại công ty này",
    },
    companyTypeLabel: "Loại công ty",
    companyTypes: { software: "Phần mềm", marketing: "Marketing", research: "Nghiên cứu", general: "Tổng quát" },
    documentLibrary: {
      title: "Kho tài liệu",
      subtitle: "Tài liệu dùng chung của đơn vị này — tái sử dụng cho mọi dự án bên trong.",
      overallScopeHint: "Chọn một đơn vị thành viên để quản lý kho tài liệu của nó.",
      selectUnitFirst: "Hãy chọn một đơn vị thành viên trước.",
      upload: "Tải tài liệu lên",
      addFromUrl: "Thêm từ đường link",
      urlPlaceholder: "https://vidu.com/bai-viet",
      search: "Tìm tài liệu…",
      empty: "Chưa có tài liệu nào",
      emptyHint: "Tải tệp lên hoặc thêm đường link để xây dựng kho tài liệu cho đơn vị này.",
      download: "Tải về",
      delete: "Xoá",
      deleteConfirm: "Xoá tài liệu này?",
      attachToProject: "Đính kèm vào dự án",
      selectProject: "Chọn một dự án",
      attach: "Đính kèm",
      cancel: "Huỷ",
      add: "Thêm",
      uploading: "Đang tải lên…",
      dropHint: "Kéo & thả tệp vào đây, hoặc bấm để chọn",
      descriptionOptional: "Mô tả (không bắt buộc)",
      tagsOptional: "Thẻ, cách nhau bởi dấu phẩy (không bắt buộc)",
      nameOptional: "Tên (không bắt buộc)",
      uploadedBy: "Người tải lên",
      attachSuccess: "Đã đính kèm tài liệu vào dự án.",
      uploadSuccess: "Đã tải tài liệu lên.",
      deleteSuccess: "Đã xoá tài liệu.",
      all: "Tất cả",
      types: { pdf: "PDF", excel: "Excel", doc: "Tài liệu", image: "Hình ảnh", link: "Liên kết", other: "Khác" },
    },
    status: { allSystemsOnline: "Tất cả hệ thống hoạt động" },
    brand: { subtitle: "Kiến tạo doanh nghiệp" },
    landing: {
      nav: { getStarted: "Bắt đầu" },
      hero: {
        badge: "Mã nguồn mở · Giấy phép MIT",
        h1: ["Một tập thể AI mã nguồn mở", "nghiên cứu, lập trình,", "và sáng tạo"],
        sub: "Xây dựng nhóm tác nhân chuyên biệt — mỗi nhóm có vai trò, kỹ năng và bộ nhớ riêng. Giao nhiệm vụ, theo dõi sự cộng tác, nhận kết quả sẵn sàng triển khai.",
        cta1: "Bắt đầu", cta2: "Đọc tài liệu",
      },
      features: {
        label: "Bao gồm những gì",
        title: "Tất cả những gì bạn cần để xây dựng\nluồng công việc AI",
        items: [
          { title: "Kiến trúc đa tác nhân", desc: "Các tác nhân chuyên biệt với vai trò riêng — PM, Nghiên cứu, Phát triển, Kiểm duyệt — mỗi người có một system prompt tập trung." },
          { title: "Hệ thống kỹ năng", desc: "Gắn công cụ và tích hợp cho bất kỳ tác nhân nào: tìm kiếm web, Google Sheets, thực thi mã, REST API, tự động hóa trình duyệt." },
          { title: "Chế độ thực thi nhóm", desc: "Chế độ mesh cho cộng tác mở hoặc chế độ tuần tự cho pipeline nghiêm ngặt. Cấu hình theo từng nhóm." },
          { title: "Đồ thị nhiệm vụ thời gian thực", desc: "Trực quan hóa SVG về tương tác tác nhân với pan & zoom. Xem tác nhân làm việc theo thời gian thực." },
          { title: "Được hỗ trợ bởi LangGraph", desc: "Lớp điều phối được xây dựng trên LangGraph — đã được kiểm chứng, có thể kết hợp và sẵn sàng cho sản xuất." },
          { title: "Tự lưu trữ & MIT", desc: "Toàn quyền kiểm soát dữ liệu và hạ tầng của bạn. Không bị ràng buộc nhà cung cấp. Triển khai trên bất kỳ cloud nào hoặc on-premise." },
        ],
      },
      modular: {
        label: "Thiết kế theo mô-đun",
        title: "Kết hợp tác nhân,\nkỹ năng và nhóm",
        desc: "Mỗi tác nhân là một đơn vị có thể cấu hình. Gán bất kỳ kết hợp kỹ năng nào — tìm kiếm web, thực thi mã, tích hợp Google, API tùy chỉnh — và kết hợp chúng thành các nhóm với một cấu hình duy nhất.",
        bullets: ["Hơn 40 mẫu vai trò tác nhân tích hợp", "Hơn 10 tích hợp sẵn có", "Hỗ trợ kỹ năng JavaScript tùy chỉnh", "REST API để kiểm soát lập trình"],
      },
      openSource: {
        label: "Mã nguồn mở",
        title: "Sinh ra từ mã nguồn mở,\nđóng góp lại cho mã nguồn mở",
        desc: "AI Collective được cấp phép MIT và được xây dựng công khai. Đánh dấu sao repo, fork, mở issue, hoặc đóng góp — đây cũng là nền tảng của bạn.",
        stars: "Sao", forks: "Fork", issues: "Vấn đề mở",
        starCta: "Đánh sao trên GitHub", launch: "Mở ứng dụng",
      },
      footer: { copy: "© 2026 AI Collective · Giấy phép MIT" },
    },
    marketing: {
      common: { login: "Đăng nhập", startBuilding: "Bắt đầu xây dựng", contactSales: "Liên hệ kinh doanh", devDocs: "Tài liệu kỹ thuật", viewPricing: "Xem giá" },
      meet: {
        badge: "Giới thiệu AI Collective", h1: "Kỷ nguyên mới của AI lập trình được",
        sub: "AI Collective là nền tảng điều phối đa tác nhân hiệu suất cao cho phép bạn triển khai, điều phối và mở rộng lực lượng lao động AI — với toàn quyền kiểm soát topo, công cụ và môi trường thực thi.",
        productsLabel: "Sản phẩm", productsTitle: "Hai cách triển khai",
        product1Name: "AI Collective", product1Desc: "Nền tảng đầy đủ — xây dựng, cấu hình và giám sát nhóm đa tác nhân qua dashboard và REST API.", product1Cta: "Mở bảng điều khiển",
        product2Name: "Agent Mesh", product2Desc: "Lớp điều phối mesh độc lập để tích hợp định tuyến đa tác nhân vào stack hiện có của bạn.", product2Cta: "Xem tài liệu",
        featuresLabel: "Tính năng", featuresTitle: "Tất cả những gì bạn cần để điều phối AI",
        modelsLabel: "Mô hình", modelsTitle: "Hoàn toàn linh hoạt về LLM", modelsSub: "Cấu hình, hoán đổi hoặc định tuyến engine mô hình khi chạy — không cần thay đổi code.",
        ctaTitle: "Sẵn sàng xây dựng?", ctaSub: "Triển khai lực lượng lao động đa tác nhân đầu tiên của bạn trong vài phút.", ctaFree: "Bắt đầu miễn phí",
      },
      pricing: {
        badge: "Giá cả", h1: "Giá đơn giản, minh bạch", sub: "Bắt đầu miễn phí với mã nguồn mở. Mở rộng với hosting được quản lý. Phát triển với doanh nghiệp.",
        plan1Name: "Mã nguồn mở", plan1Price: "Miễn phí", plan1Period: "mãi mãi", plan1Desc: "Tự lưu trữ toàn bộ nền tảng AI Collective trên hạ tầng của bạn.", plan1Cta: "Bắt đầu trên GitHub",
        plan2Name: "Pro", plan2Price: "$49", plan2Period: "mỗi tháng", plan2Desc: "Hosting được quản lý, backend phân tán và hỗ trợ ưu tiên cho nhóm đang phát triển.", plan2Cta: "Dùng thử miễn phí",
        plan3Name: "Doanh nghiệp", plan3Price: "Tùy chỉnh", plan3Period: "giá linh hoạt", plan3Desc: "Hạ tầng riêng, tích hợp tùy chỉnh và SLA đảm bảo cho triển khai quy mô lớn.", plan3Cta: "Liên hệ kinh doanh",
        apiLabel: "Giá API", apiTitle: "Chi phí mô hình theo sử dụng", apiSub: "Chi phí token LLM được tính theo giá nhà cung cấp. Không có phụ phí.",
        ctaTitle: "Có câu hỏi?", ctaSub: "Đội ngũ của chúng tôi sẵn sàng giúp bạn tìm gói phù hợp.", ctaGithub: "Khám phá trên GitHub",
      },
      solutions: {
        badge: "Giải pháp", h1: "AI Collective cho mọi nhóm", sub: "Từ nguyên mẫu startup đến điều phối cấp doanh nghiệp — triển khai giải pháp đa tác nhân phù hợp với trường hợp sử dụng của bạn.",
        useCasesLabel: "Trường hợp sử dụng", useCasesTitle: "Các nhóm xây dựng gì với AI Collective",
        sizeLabel: "Quy mô công ty", sizeTitle: "Phù hợp với quy mô của bạn",
        industriesLabel: "Ngành nghề", industriesTitle: "Được xây dựng cho các lĩnh vực có độ rủi ro cao",
        ctaTitle: "Tìm giải pháp của bạn", ctaSub: "Nói chuyện với đội ngũ để thiết kế kiến trúc tác nhân phù hợp.",
      },
      resources: {
        badge: "Tài nguyên", h1: "Tất cả những gì bạn cần để triển khai nhanh hơn", sub: "Hướng dẫn, tài liệu tham chiếu, changelog và tài nguyên cộng đồng — tất cả ở một nơi.",
        card1Label: "Tài liệu", card1Title: "Tài liệu kỹ thuật", card1Desc: "Tham chiếu API đầy đủ, hướng dẫn topo, công thức tích hợp công cụ và sách hướng dẫn triển khai.", card1Cta: "Mở tài liệu",
        card2Label: "Mã nguồn mở", card2Title: "Kho GitHub", card2Desc: "Khám phá mã nguồn, đóng góp, báo cáo lỗi và theo dõi phát triển trên GitHub.", card2Cta: "Xem trên GitHub",
        card3Label: "Cập nhật", card3Title: "Nhật ký thay đổi", card3Desc: "Theo dõi mọi phiên bản — topo mới, bổ sung bộ công cụ, cải tiến hiệu suất và các thay đổi phá vỡ.", card3Cta: "Xem changelog",
        articlesLabel: "Từ đội ngũ", articlesTitle: "Bài viết & hướng dẫn mới nhất",
        newsletterTitle: "Luôn cập nhật", newsletterSub: "Cập nhật sản phẩm, bộ công cụ mới và nghiên cứu kỹ thuật — hàng tháng, không spam.", newsletterBtn: "Đăng ký", newsletterNote: "Hủy đăng ký bất kỳ lúc nào.",
      },
      changelog: {
        badge: "Nhật ký thay đổi", h1: "Có gì mới trong AI Collective", sub: "Mọi phiên bản, mọi cải tiến, mọi bản sửa lỗi — được ghi lại ở một nơi.", viewGithub: "Xem trên GitHub",
      },
      contactSales: {
        badge: "Liên Hệ",
        h1: "Liên hệ kinh doanh",
        sub: "Đội ngũ kinh doanh của chúng tôi có thể cung cấp tài nguyên để hỗ trợ tùy chỉnh với AI Collective API hoặc các triển khai lớn, phức tạp. Hoặc để bắt đầu ngay bây giờ, hãy khám phá các gói tự phục vụ của chúng tôi.",
        supportCardTitle: "Cần trợ giúp khác?",
        supportCardDesc: "Duyệt qua các bài viết, xem chi tiết sản phẩm và nhận câu trả lời cho các câu hỏi kỹ thuật.",
        supportCardCta: "Truy cập trung tâm hỗ trợ",
        formHelpLabel: "Chúng tôi có thể giúp gì cho bạn?",
        formHelpPlaceholder: "Vui lòng chọn",
        options: {
          sales: "Liên hệ kinh doanh",
          limits: "Tăng giới hạn tỷ lệ (Rate limits)",
          baa: "Thỏa thuận liên kết kinh doanh (BAA)",
          zdr: "Không lưu trữ dữ liệu (ZDR)",
          support: "Hỗ trợ sản phẩm",
        },
        firstName: "Tên",
        lastName: "Họ",
        email: "Email doanh nghiệp",
        emailHint: "Nếu bạn đã là người dùng, vui lòng nhập email tài khoản của bạn.",
        phone: "Số điện thoại",
        companyName: "Tên công ty hoặc tổ chức",
        companyWebsite: "Trang web công ty hoặc tổ chức",
        jobTitle: "Chức danh công việc",
        industry: "Ngành nghề",
        hq: "Vị trí trụ sở chính của công ty",
        interest: "Mối quan tâm chính về sản phẩm",
        employees: "Số lượng nhân viên của công ty bạn?",
        journey: "Bạn đang ở đâu trong hành trình đánh giá?",
        message: "Vui lòng chia sẻ thêm một chút về lý do bạn liên hệ với chúng tôi...",
        source: "Bạn biết đến chúng tôi qua đâu?",
        submitBtn: "Gửi",
        submitting: "Đang gửi...",
        successTitle: "Cảm ơn bạn!",
        successDesc: "Yêu cầu của bạn đã được gửi. Đội ngũ của chúng tôi sẽ xem xét và liên hệ với bạn sớm nhất có thể.",
      },
    },
    docs: {
      ui: {
        search: "Tìm kiếm tài liệu...", backToSite: "Về trang chủ", openApp: "Mở ứng dụng",
        docsLabel: "Tài liệu", documentation: "Tài liệu", previous: "Trước", next: "Tiếp",
        editOnGitHub: "Chỉnh sửa trang này trên GitHub", noResults: "Không tìm thấy kết quả",
        pageNotFound: "Không tìm thấy trang", comingSoon: "Mục này sẽ sớm ra mắt.",
      },
      nav: {
        sections: { intro: "Giới thiệu", "getting-started": "Bắt đầu", concepts: "Khái niệm cơ bản", guides: "Hướng dẫn", "api-reference": "Tham chiếu API", deployment: "Triển khai", contributing: "Đóng góp" },
        items: { "what-is": "AI Collective là gì?", architecture: "Kiến trúc", "key-concepts": "Khái niệm chính", quickstart: "Khởi động nhanh", installation: "Cài đặt", configuration: "Cấu hình", agents: "Tác nhân", skills: "Kỹ năng", teams: "Nhóm", tasks: "Nhiệm vụ", conversations: "Hội thoại", "guide-first-agent": "Tạo tác nhân đầu tiên", "guide-build-team": "Xây dựng nhóm", "guide-run-task": "Chạy nhiệm vụ", "guide-skills": "Thêm kỹ năng & API", "api-agents": "API Tác nhân", "api-skills": "API Kỹ năng", "api-teams": "API Nhóm", "api-tasks": "API Nhiệm vụ", "api-chat": "API Trò chuyện", "deploy-docker": "Docker", "deploy-env": "Biến môi trường", "contributing-guide": "Cách đóng góp", "contributing-dev": "Thiết lập môi trường phát triển" },
      },
      content: {
        "what-is": {
          h1: "AI Collective là gì?",
          p1: "AI Collective là nền tảng điều phối đa tác nhân mã nguồn mở, cho phép xây dựng các nhóm tác nhân AI chuyên biệt cộng tác tự động để hoàn thành các nhiệm vụ phức tạp — giống như một nhóm dự án thực sự.",
          p2: "Thay vì dùng một AI đơn lẻ, AI Collective phân phối công việc cho các tác nhân chuyên biệt: tác nhân Quản lý Dự án lên kế hoạch, tác nhân Nghiên cứu thu thập thông tin, tác nhân Phát triển viết mã, và tác nhân Kiểm duyệt xác thực từng kết quả trước khi bàn giao.",
          callout: "AI Collective tự lưu trữ và hoàn toàn mã nguồn mở (Giấy phép MIT). Bạn có thể chạy cục bộ trong vài phút hoặc triển khai trên bất kỳ nhà cung cấp đám mây nào.",
          keyFeaturesH2: "Tính năng chính",
          features: ["Cộng tác đa tác nhân — các tác nhân giao tiếp qua bus thông điệp hướng sự kiện (RabbitMQ)", "Vai trò tùy chỉnh — hơn 40 mẫu vai trò từ PM đến Bác sĩ đến Luật sư, hoặc tự định nghĩa", "Hệ thống kỹ năng — gắn tích hợp (Google Sheets, API, duyệt web) cho từng tác nhân", "Chế độ nhóm — chọn mesh (tất cả cộng tác) hoặc sequential (pipeline)", "Đồ thị nhiệm vụ thời gian thực — trực quan hóa hoạt động tác nhân với pan & zoom", "Backend LangChain / LangGraph — được hỗ trợ bởi các nguyên thủy điều phối AI đã kiểm chứng", "Stack React + FastAPI — mã nguồn hiện đại với TypeScript và Python"],
          whoForH2: "Dành cho ai?",
          audience: [{ title: "Nhà phát triển", desc: "Xây dựng luồng công việc AI mà không cần quản lý hạ tầng tác nhân phức tạp." }, { title: "Nhóm", desc: "Tự động hóa nghiên cứu, viết lách, lập trình và quy trình kiểm duyệt với các chuyên gia AI." }, { title: "Nhà nghiên cứu", desc: "Thử nghiệm với các kiến trúc đa tác nhân và chiến lược cộng tác." }],
        },
        architecture: {
          h1: "Kiến trúc",
          p1: "AI Collective được chia thành hai lớp: backend FastAPI chạy các tác nhân AI, và frontend React cung cấp giao diện quản lý trực quan.",
          lifecycleH2: "Vòng đời yêu cầu",
          lifecycleP: "Khi bạn gửi một nhiệm vụ, đây là những gì xảy ra:",
          lifecycle: ["Frontend gửi yêu cầu POST /api/tasks với mô tả nhiệm vụ và nhóm được giao", "Task Runner khởi tạo đồ thị LangGraph với mỗi tác nhân là một nút", "Các tác nhân nhận thông điệp, xử lý qua nhà cung cấp LLM, và phát sự kiện đến RabbitMQ", "Event Bus định tuyến đầu ra tác nhân đến các tác nhân phụ thuộc (ví dụ: PM → Developer)", "Lệnh gọi công cụ của tác nhân (tìm kiếm web, thực thi mã, gọi API) được Skill Executor xử lý", "Đầu ra cuối cùng được tác nhân Reviewer thu thập và trả về frontend qua REST"],
        },
        "key-concepts": {
          h1: "Khái niệm chính",
          p1: "Trước khi bắt đầu, đây là năm nguyên thủy tạo nên mọi triển khai AI Collective:",
          concepts: [{ title: "Tác nhân", desc: "Một AI worker với vai trò, cá tính và bộ kỹ năng xác định. Mỗi tác nhân có system prompt và quyền truy cập công cụ riêng." }, { title: "Kỹ năng", desc: "Khả năng bạn gắn cho tác nhân — công cụ tìm kiếm web, tích hợp Google Sheets, hàm JavaScript tùy chỉnh, hoặc lệnh gọi REST API." }, { title: "Nhóm", desc: "Nhóm tác nhân được đặt tên cộng tác trên các nhiệm vụ. Nhóm có thể chạy ở chế độ mesh (all-to-all) hoặc sequential (pipeline)." }, { title: "Nhiệm vụ", desc: "Đơn vị công việc được giao cho nhóm. Nhiệm vụ có vòng đời: pending → in-progress → completed (hoặc paused / stopped)." }, { title: "Hội thoại", desc: "Lịch sử thông điệp đầy đủ của mọi tương tác tác nhân trong nhiệm vụ. Duyệt và phát lại bất kỳ hội thoại nào." }],
        },
        quickstart: {
          h1: "Khởi động nhanh", p1: "Chạy AI Collective cục bộ trong dưới 5 phút.",
          callout: "Yêu cầu: Python 3.11+, Node.js 18+, và API key của Anthropic hoặc OpenAI.",
          cloneH2: "1. Clone repository", backendH2: "2. Thiết lập backend",
          envH2: "3. Cấu hình môi trường", startBackendH2: "4. Khởi động backend",
          startFrontendH2: "5. Khởi động frontend",
          tipCallout: "Dev server frontend tự động proxy yêu cầu API đến localhost:8000. Không cần cấu hình CORS.",
        },
        installation: {
          h1: "Cài đặt", requirementsH2: "Yêu cầu hệ thống",
          tableHeaders: ["Thành phần", "Tối thiểu", "Khuyến nghị"],
          pythonH2: "Phụ thuộc Python", pythonP: "Backend được quản lý bằng pyproject.toml. Các phụ thuộc chính:",
          frontendH2: "Phụ thuộc Frontend", frontendP: "Frontend sử dụng React 18, Vite, shadcn/ui và Tailwind CSS.",
          rabbitH2: "Tùy chọn: RabbitMQ", rabbitP: "Để phát sóng sự kiện đa tác nhân, bạn có thể chạy RabbitMQ cục bộ qua Docker:",
        },
        configuration: {
          h1: "Cấu hình", p1: "Tất cả cấu hình được thực hiện qua biến môi trường trong file .env ở thư mục gốc dự án.",
          apiKeysH2: "API Keys", frontendH2: "Cấu hình Frontend",
          frontendP: "Dev server Vite chạy trên cổng 8080 và mong đợi backend tại localhost:8000. Để thay đổi:",
        },
        agents: {
          h1: "Tác nhân", p1: "Tác nhân là AI worker với vai trò xác định, cá tính được thể hiện qua system prompt, và bộ kỹ năng (công cụ) để hoàn thành công việc.",
          schemaH2: "Schema tác nhân", rolesH2: "Vai trò tác nhân", rolesP: "AI Collective đi kèm với hơn 40 mẫu vai trò tích hợp. Đây là các vai trò phổ biến nhất:",
          callout: "Bạn có thể nhập bất kỳ tên vai trò tùy chỉnh nào — danh sách tích hợp chỉ là gợi ý ban đầu.",
          lifecycleH2: "Vòng đời trạng thái tác nhân", restH2: "Tạo qua REST API",
        },
        skills: {
          h1: "Kỹ năng", p1: "Kỹ năng là khả năng bạn gắn cho tác nhân — có thể là tích hợp API bên thứ ba, công cụ tự động hóa trình duyệt, hàm JavaScript tùy chỉnh, hoặc bất kỳ hành động nào tác nhân có thể gọi.",
          typesH2: "Loại kỹ năng",
          types: [{ desc: "Kết nối với các dịch vụ bên ngoài: Google Sheets, Slack, Notion, Airtable, REST API, và nhiều hơn nữa." }, { desc: "Viết mã JavaScript tùy chỉnh chạy phía server. Phù hợp cho chuyển đổi dữ liệu hoặc logic nghiệp vụ." }],
          toolsH2: "Công cụ tích hợp sẵn", schemaH2: "Schema kỹ năng",
        },
        teams: {
          h1: "Nhóm", p1: "Nhóm là một tập hợp tác nhân được đặt tên cộng tác trên các nhiệm vụ. Nhóm là đơn vị thực thi — bạn giao nhiệm vụ cho nhóm, không phải tác nhân riêng lẻ.",
          modesH2: "Chế độ nhóm",
          mesh: { title: "Chế độ Mesh", desc: "Tất cả tác nhân có thể giao tiếp với nhau. Tốt nhất cho các nhiệm vụ sáng tạo hoặc nghiên cứu nơi các tác nhân cần tranh luận và tinh chỉnh ý tưởng cùng nhau." },
          sequential: { title: "Chế độ Tuần tự", desc: "Các tác nhân chạy theo thứ tự pipeline xác định. Tốt nhất cho các luồng công việc có cấu trúc: Nghiên cứu → Viết → Kiểm duyệt → Xuất bản." },
          schemaH2: "Schema nhóm",
        },
        tasks: {
          h1: "Nhiệm vụ", p1: "Nhiệm vụ là đơn vị công việc bạn gửi cho nhóm. Nó có tiêu đề, mô tả, và vòng đời tiến từ pending đến completed.",
          lifecycleH2: "Vòng đời nhiệm vụ", schemaH2: "Schema nhiệm vụ",
          graphH2: "Trực quan hóa đồ thị nhiệm vụ", graphP: "Trang Task Manager hiển thị đồ thị SVG thời gian thực về tương tác tác nhân. Mỗi nút là một tác nhân, và các cạnh hiển thị luồng thông điệp giữa chúng. Bạn có thể pan và zoom để khám phá các mạng tác nhân lớn.",
          graphCallout: "Đồ thị sử dụng bố cục lực hướng được hỗ trợ bởi renderer SVG tùy chỉnh — không cần thư viện đồ thị bên thứ ba.",
        },
        conversations: {
          h1: "Hội thoại", p1: "Mọi thông điệp được trao đổi giữa các tác nhân trong quá trình thực hiện nhiệm vụ đều được ghi lại như một hội thoại. Trang Hội thoại cho phép bạn duyệt, lọc và phát lại tất cả giao tiếp của tác nhân.",
          formatH2: "Định dạng thông điệp", filterH2: "Lọc",
          filterP: "Lọc hội thoại theo tên tác nhân, vai trò, nhiệm vụ hoặc khoảng thời gian. Thông điệp hỗ trợ tìm kiếm toàn văn và được hiển thị với định dạng Markdown.",
        },
        "guide-first-agent": {
          h1: "Tạo tác nhân đầu tiên", p1: "Hướng dẫn này giúp bạn tạo một Research Agent từ đầu bằng giao diện người dùng.",
          step1H2: "Bước 1: Mở Agent Builder", step1P: "Điều hướng đến Tác nhân trong thanh bên, sau đó nhấp Tác nhân mới ở trên cùng bên phải.",
          step2H2: "Bước 2: Điền thông tin chi tiết",
          step3H2: "Bước 3: Chọn avatar", step3P: "Chọn chế độ icon và chọn icon search. Chọn màu nền teal để phù hợp với vai trò Research Agent.",
          step4H2: "Bước 4: Gán kỹ năng", step4P: "Chọn kỹ năng Web Search và Web Scrape từ panel kỹ năng. Nếu chưa có kỹ năng, hãy vào trang Kỹ năng trước.",
          step5H2: "Bước 5: Lưu", step5P: "Nhấp Tạo tác nhân. Alice sẽ xuất hiện trong danh sách tác nhân với trạng thái idle.",
          callout: "Thử ngay Alice bằng cách nhấp nút Thử nghiệm trên thẻ của cô ấy và nhập câu hỏi nghiên cứu.",
        },
        "guide-build-team": {
          h1: "Xây dựng nhóm", p1: "Nhóm kết hợp nhiều tác nhân thành một đơn vị cộng tác. Hãy xây dựng nhóm nghiên cứu & viết lách.",
          compositionH2: "Thành phần nhóm được khuyến nghị",
          teamRoles: [{ role: "Project Manager", purpose: "Phối hợp phân công nhiệm vụ và ủy quyền cho các tác nhân khác" }, { role: "Research Agent", purpose: "Thu thập thông tin từ web và tổng hợp kết quả" }, { role: "Developer Agent", purpose: "Viết mã hoặc tài liệu kỹ thuật" }, { role: "Reviewer Agent", purpose: "Xác thực tất cả đầu ra trước khi bàn giao" }],
          createH2: "Tạo nhóm", createP: "Vào Nhóm → Nhóm mới, thêm tất cả bốn tác nhân theo thứ tự, chọn chế độ mesh cho các nhiệm vụ cộng tác, sau đó lưu.",
        },
        "guide-run-task": {
          h1: "Chạy nhiệm vụ", p1: "Với nhóm đã được xây dựng, hãy gửi nhiệm vụ đầu tiên của bạn.",
          uiH2: "Qua giao diện người dùng", uiP: "Điều hướng đến Nhiệm vụ → Nhiệm vụ mới, điền tiêu đề và mô tả, gán nhóm của bạn, và nhấp Tạo nhiệm vụ. Nhiệm vụ sẽ chuyển sang trạng thái in-progress và bạn có thể xem đồ thị tác nhân hoạt động theo thời gian thực.",
          restH2: "Qua REST API", monitorH2: "Theo dõi tiến độ", monitorP: "Poll endpoint trạng thái nhiệm vụ, hoặc xem đồ thị trực tiếp trong giao diện Nhiệm vụ:",
        },
        "guide-skills": {
          h1: "Thêm kỹ năng & API", p1: "Kỹ năng mở rộng những gì tác nhân có thể làm. Đây là cách thêm kỹ năng tìm kiếm web.",
          webSearchH2: "Tạo kỹ năng tìm kiếm web", webSearchP: "Điều hướng đến Kỹ năng → Kỹ năng mới:",
          sheetsH2: "Tạo tích hợp Google Sheets",
          sheetsCallout: "Google OAuth yêu cầu thiết lập dự án trong Google Cloud Console và tải xuống credentials.json. Xem hướng dẫn tích hợp Google để biết chi tiết.",
          customH2: "Kỹ năng JavaScript tùy chỉnh",
        },
        "api-agents": { h1: "API Tác nhân", p1: "URL cơ sở: http://localhost:8000/api", endpointsH2: "Các endpoint", createH2: "Tạo tác nhân" },
        "api-skills": { h1: "API Kỹ năng", presetsH2: "Lấy preset công cụ" },
        "api-teams": { h1: "API Nhóm" },
        "api-tasks": { h1: "API Nhiệm vụ" },
        "api-chat": { h1: "API Trò chuyện", p1: "Thử nghiệm các tác nhân trực tiếp mà không cần tạo nhiệm vụ đầy đủ." },
        "deploy-docker": { h1: "Triển khai Docker", p1: "Triển khai toàn bộ stack với Docker Compose." },
        "deploy-env": { h1: "Biến môi trường" },
        "contributing-guide": {
          h1: "Cách đóng góp", p1: "AI Collective chào đón mọi loại đóng góp: sửa lỗi, tính năng mới, cải thiện tài liệu, và nhiều hơn nữa.",
          waysH2: "Cách để đóng góp",
          ways: ["⭐ Đánh sao repo trên GitHub để giúp người khác khám phá dự án", "🐛 Báo cáo lỗi bằng cách mở GitHub issue với trường hợp tái hiện", "💡 Yêu cầu tính năng bằng cách mở thảo luận trong tab GitHub Discussions", "🔧 Sửa lỗi bằng cách gửi pull request", "📝 Cải thiện tài liệu — ngay cả việc sửa lỗi chính tả cũng có giá trị!"],
          prH2: "Quy trình pull request", callout: "Tất cả PR chạy qua CI: linting backend (ruff), kiểm tra kiểu frontend (tsc) và test (vitest). Đảm bảo tất cả kiểm tra đều vượt qua trước khi yêu cầu review.",
        },
        "contributing-dev": {
          h1: "Thiết lập môi trường phát triển", hooksH2: "Pre-commit hooks",
          hooksP: "Điều này cài đặt hooks cho: định dạng Python (ruff), khoảng trắng cuối dòng, newlines cuối file, và xác thực YAML/TOML.",
          testsH2: "Chạy kiểm thử", styleH2: "Phong cách mã",
          style: ["Python: ruff để linting và định dạng", "TypeScript: ESLint + chế độ strict của TypeScript", "Commits: định dạng conventional commits (feat:, fix:, docs:)"],
        },
      },
    },
  },

  zh: {
    auth: {
      badge: "多智能体AI平台",
      heroTitle: "构建协同工作的AI智能体团队",
      heroSub: "协调专业AI智能体——研究员、开发者、审核者——自主协作完成复杂任务。",
      heroBullets: ["40+内置智能体角色模板", "10+集成的技能系统", "实时任务图可视化", "自托管 & MIT许可"],
      loginTab: "登录",
      registerTab: "注册",
      loginTitle: "欢迎回来",
      loginSubtitle: "登录以继续使用AI Collective",
      registerTitle: "创建账户",
      registerSubtitle: "开始构建您的AI智能体团队",
      email: "邮箱",
      password: "密码",
      name: "姓名",
      namePlaceholder: "张三",
      confirmPassword: "确认密码",
      loginBtn: "登录",
      registerBtn: "创建账户",
      loggingIn: "登录中…",
      registering: "创建账户中…",
      or: "或",
      profileBtn: "我的资料",
      logoutBtn: "退出登录",
      editProfile: "编辑资料",
      changePassword: "修改密码",
      currentPassword: "当前密码",
      newPassword: "新密码",
      saveChanges: "保存更改",
      saving: "保存中…",
      saved: "已保存！",
      cancel: "取消",
      accountInfo: "账户信息",
      role: "角色",
      userId: "用户ID",
      memberSince: "加入时间",
      dangerZone: "危险区域",
      logoutDesc: "在此设备上退出您的账户。",
      passwordMismatch: "密码不匹配。",
      errorDefault: "出现错误，请重试。",
      orContinueWith: "或继续使用",
      socialComingSoon: "社交登录即将推出",
      phoneBtn: "手机号码",
      phonePlaceholder: "+86 (138) 0000-0000",
      sendCode: "发送验证码",
      sendingCode: "发送中…",
      verifyCode: "输入验证码",
      codePlaceholder: "000000",
      verifyBtn: "验证",
      phoneNote: "我们将向您的号码发送验证码。",
    },
    nav: {
      label: "导航", dashboard: "公司概览", agents: "员工",
      skills: "业务与工具", teams: "部门", tasks: "任务看板", projects: "项目",
      conversations: "会议", analytics: "绩效与成本", playground: "培训", workspaces: "管理公司",
      officeBuilder: "AI 公司设计师",
      virtualOffice: "办公室平面图",
      marketplace: "招聘",
      documentLibrary: "文档",
      settings: "系统设置",
      overviewGroup: "概览",
      companiesGroup: "公司",
      catalogGroup: "目录",
      operationsGroup: "运营",
      orgGroup: "组织",
      officeGroup: "空间",
      devGroup: "系统设置",
      systemGroup: "工具",
      adminGroup: "管理",
      monitoring: "系统监控",
      consumption: "用量与账单",
      manageWorkspaces: "管理公司",
      monitoringBadge: "监控",
      selectCompanyToManage: "请选择一个公司以打开此页面。",
      suggestedBadge: "适合此公司类型",
    },
    companyTypeLabel: "公司类型",
    companyTypes: { software: "软件", marketing: "营销", research: "研究", general: "通用" },
    documentLibrary: {
      title: "文档库",
      subtitle: "本业务单元的共享文档 — 可在其所有项目中复用。",
      overallScopeHint: "请选择一个业务单元以管理其文档库。",
      selectUnitFirst: "请先选择一个业务单元。",
      upload: "上传文档",
      addFromUrl: "从链接添加",
      urlPlaceholder: "https://example.com/article",
      search: "搜索文档…",
      empty: "暂无文档",
      emptyHint: "上传文件或添加链接以构建本单元的文档库。",
      download: "下载",
      delete: "删除",
      deleteConfirm: "删除此文档？",
      attachToProject: "附加到项目",
      selectProject: "选择项目",
      attach: "附加",
      cancel: "取消",
      add: "添加",
      uploading: "上传中…",
      dropHint: "将文件拖放到此处，或点击选择",
      descriptionOptional: "描述（可选）",
      tagsOptional: "标签，用逗号分隔（可选）",
      nameOptional: "名称（可选）",
      uploadedBy: "上传者",
      attachSuccess: "文档已附加到项目。",
      uploadSuccess: "文档已上传。",
      deleteSuccess: "文档已删除。",
      all: "全部",
      types: { pdf: "PDF", excel: "Excel", doc: "文档", image: "图片", link: "链接", other: "其他" },
    },
    status: { allSystemsOnline: "所有系统运行正常" },
    brand: { subtitle: "公司构建器" },
    landing: {
      nav: { getStarted: "立即开始" },
      hero: {
        badge: "开源 · MIT 许可证",
        h1: ["一个开源 AI 协作系统", "研究、编程，", "并创造"],
        sub: "构建专业化的智能体团队 — 每个成员有各自的角色、技能与记忆。提交任务，观察它们协作，获取可投入生产的成果。",
        cta1: "立即开始", cta2: "阅读文档",
      },
      features: {
        label: "功能一览",
        title: "构建 AI 工作流\n所需的一切",
        items: [
          { title: "多智能体架构", desc: "具有不同角色的专业智能体 — PM、研究员、开发者、审查员 — 每个都有专注的系统提示词。" },
          { title: "技能系统", desc: "为任意智能体附加工具和集成：网络搜索、Google 表格、代码执行、REST API、浏览器自动化。" },
          { title: "团队执行模式", desc: "开放协作的网状模式或严格流水线的顺序模式。按团队配置。" },
          { title: "实时任务图", desc: "支持平移缩放的智能体交互 SVG 可视化。实时观察智能体工作。" },
          { title: "LangGraph 驱动", desc: "编排层构建于 LangGraph 之上 — 经过实战检验、可组合、生产就绪。" },
          { title: "自托管 & MIT", desc: "完全掌控您的数据和基础设施。无供应商锁定。部署在任何云端或本地。" },
        ],
      },
      modular: {
        label: "模块化设计",
        title: "组合智能体、\n技能与团队",
        desc: "每个智能体都是可配置的单元。分配任意技能组合 — 网络搜索、代码执行、Google 集成、自定义 API — 通过单一配置将它们组合成团队。",
        bullets: ["40+ 内置智能体角色模板", "10+ 开箱即用的集成", "支持自定义 JavaScript 技能", "可编程控制的 REST API"],
      },
      openSource: {
        label: "开源",
        title: "源于开源，\n回馈开源",
        desc: "AI Collective 采用 MIT 许可证，公开构建。Star 仓库、Fork、提 issue 或贡献代码 — 这也是您的平台。",
        stars: "Star", forks: "Fork", issues: "待解决问题",
        starCta: "在 GitHub 上 Star", launch: "启动应用",
      },
      footer: { copy: "© 2026 AI Collective · MIT 许可证" },
    },
    marketing: {
      common: { login: "登录", startBuilding: "开始构建", contactSales: "联系销售", devDocs: "开发者文档", viewPricing: "查看定价" },
      meet: {
        badge: "认识 AI Collective", h1: "可编程 AI 的新时代",
        sub: "AI Collective 是一个高性能多智能体编排平台，让您可以部署、协调和扩展 AI 劳动力——完全控制拓扑、工具和执行环境。",
        productsLabel: "产品", productsTitle: "两种部署方式",
        product1Name: "AI Collective", product1Desc: "完整平台——通过仪表盘和 REST API 构建、配置和监控多智能体团队。", product1Cta: "打开控制台",
        product2Name: "Agent Mesh", product2Desc: "独立的 Mesh 编排层，用于将多智能体路由集成到现有技术栈中。", product2Cta: "阅读文档",
        featuresLabel: "功能", featuresTitle: "编排 AI 所需的一切",
        modelsLabel: "模型", modelsTitle: "完全 LLM 无关", modelsSub: "在运行时配置、交换或路由模型引擎——无需更改代码。",
        ctaTitle: "准备好构建了吗？", ctaSub: "在几分钟内部署您的第一个多智能体劳动力。", ctaFree: "免费开始构建",
      },
      pricing: {
        badge: "定价", h1: "简单透明的定价", sub: "从开源免费开始。通过托管服务扩展。随企业成长。",
        plan1Name: "开源", plan1Price: "免费", plan1Period: "永久", plan1Desc: "在您自己的基础设施上自托管完整的 AI Collective 平台。", plan1Cta: "在 GitHub 上开始",
        plan2Name: "专业版", plan2Price: "$49", plan2Period: "每月", plan2Desc: "托管服务、分布式后端以及针对成长中团队的优先支持。", plan2Cta: "开始免费试用",
        plan3Name: "企业版", plan3Price: "定制", plan3Period: "定制定价", plan3Desc: "用于大规模部署的专属基础设施、定制集成和 SLA 保证。", plan3Cta: "联系销售",
        apiLabel: "API 定价", apiTitle: "按使用量计费的模型成本", apiSub: "LLM 令牌成本按提供商费率直接传递。无额外加价。",
        ctaTitle: "有疑问？", ctaSub: "我们的团队随时准备帮您找到合适的方案。", ctaGithub: "在 GitHub 上探索",
      },
      solutions: {
        badge: "解决方案", h1: "适合每个团队的 AI Collective", sub: "从初创原型到企业级编排——为您的用例部署正确的多智能体解决方案。",
        useCasesLabel: "使用场景", useCasesTitle: "团队用 AI Collective 构建什么",
        sizeLabel: "公司规模", sizeTitle: "适合您的规模",
        industriesLabel: "行业", industriesTitle: "专为高风险领域打造",
        ctaTitle: "找到您的解决方案", ctaSub: "与我们的团队交流，为您的组织设计合适的智能体架构。",
      },
      resources: {
        badge: "资源", h1: "快速交付所需的一切", sub: "指南、参考文档、变更日志和社区资源——一站汇聚。",
        card1Label: "文档", card1Title: "开发者文档", card1Desc: "完整的 API 参考、拓扑指南、工具集成方法和部署手册。", card1Cta: "打开文档",
        card2Label: "开源", card2Title: "GitHub 仓库", card2Desc: "探索源代码、贡献代码、提交 Issue 并跟踪 GitHub 上的开发进度。", card2Cta: "在 GitHub 上查看",
        card3Label: "更新", card3Title: "变更日志", card3Desc: "跟踪每个版本——新拓扑、工具包新增、性能改进和破坏性变更。", card3Cta: "查看变更日志",
        articlesLabel: "来自团队", articlesTitle: "最新文章和指南",
        newsletterTitle: "保持更新", newsletterSub: "产品更新、新工具包和工程深度分析——每月一期，不发垃圾邮件。", newsletterBtn: "订阅", newsletterNote: "随时可以取消订阅。",
      },
      changelog: {
        badge: "变更日志", h1: "AI Collective 的新功能", sub: "每个版本、每项改进、每个修复——都记录在一处。", viewGithub: "在 GitHub 上查看",
      },
      contactSales: {
        badge: "联系销售",
        h1: "联系销售",
        sub: "我们的销售团队可以为您提供关于 AI Collective API 或大型复杂部署的定制化支持资源。或者，您也可以立即探索我们的自助服务方案。",
        supportCardTitle: "需要其他帮助？",
        supportCardDesc: "浏览文章、查看产品详情并获取技术问题的解答。",
        supportCardCta: "访问支持中心",
        formHelpLabel: "我们能帮您做些什么？",
        formHelpPlaceholder: "请选择",
        options: {
          sales: "联系销售",
          limits: "提高速率限制 (Rate limits)",
          baa: "商业伙伴协议 (BAA)",
          zdr: "零数据保留 (ZDR)",
          support: "产品支持",
        },
        firstName: "名字",
        lastName: "姓氏",
        email: "业务邮箱",
        emailHint: "如果您是现有用户，请输入您的账户邮箱。",
        phone: "电话号码",
        companyName: "公司或组织名称",
        companyWebsite: "公司或组织网站",
        jobTitle: "职位名称",
        industry: "行业",
        hq: "公司总部所在地",
        interest: "主要产品兴趣",
        employees: "您公司的员工人数是多少？",
        journey: "您目前处于评估流程的哪个阶段？",
        message: "请具体分享一下您联系我们的原因...",
        source: "您是如何得知我们的？",
        submitBtn: "提交",
        submitting: "正在提交...",
        successTitle: "非常感谢！",
        successDesc: "您的请求已提交。我们的团队会尽快评估并与您取得联系。",
      },
    },
    docs: {
      ui: {
        search: "搜索文档...", backToSite: "返回首页", openApp: "打开应用",
        docsLabel: "文档", documentation: "文档", previous: "上一页", next: "下一页",
        editOnGitHub: "在 GitHub 上编辑此页", noResults: "未找到结果",
        pageNotFound: "页面未找到", comingSoon: "该章节即将推出。",
      },
      nav: {
        sections: { intro: "介绍", "getting-started": "快速入门", concepts: "核心概念", guides: "指南", "api-reference": "API 参考", deployment: "部署", contributing: "贡献" },
        items: { "what-is": "什么是 AI Collective？", architecture: "架构", "key-concepts": "关键概念", quickstart: "快速开始", installation: "安装", configuration: "配置", agents: "智能体", skills: "技能", teams: "团队", tasks: "任务", conversations: "对话", "guide-first-agent": "创建第一个智能体", "guide-build-team": "构建团队", "guide-run-task": "运行任务", "guide-skills": "添加技能与 API", "api-agents": "智能体 API", "api-skills": "技能 API", "api-teams": "团队 API", "api-tasks": "任务 API", "api-chat": "聊天 API", "deploy-docker": "Docker", "deploy-env": "环境变量", "contributing-guide": "如何贡献", "contributing-dev": "开发环境配置" },
      },
      content: {
        "what-is": {
          h1: "什么是 AI Collective？",
          p1: "AI Collective 是一个开源的多智能体编排平台，让您可以构建专业化 AI 智能体团队，这些团队自主协作完成复杂任务 — 就像真实的项目团队一样。",
          p2: "AI Collective 不使用单一的整体 AI，而是将工作分配给专业构建的智能体：负责规划的项目经理智能体、负责收集信息的研究智能体、负责编写代码的开发智能体，以及在交付前验证每个输出的审查智能体。",
          callout: "AI Collective 自托管且完全开源（MIT 许可证）。您可以在几分钟内本地运行，或部署到任何云服务商。",
          keyFeaturesH2: "主要功能",
          features: ["多智能体协作 — 智能体通过事件驱动的消息总线（RabbitMQ）进行通信", "可自定义角色 — 40+ 内置角色模板，从 PM 到医生到律师，或自定义定义", "技能系统 — 为各个智能体附加集成（Google 表格、API、网页浏览）", "团队模式 — 在网状（所有智能体协作）或顺序（流水线）执行之间选择", "实时任务图 — 用平移缩放图视图可视化智能体活动", "LangChain/LangGraph 后端 — 由久经考验的 AI 编排原语驱动", "React + FastAPI 技术栈 — 使用 TypeScript 和 Python 的现代可维护代码库"],
          whoForH2: "适合哪些人？",
          audience: [{ title: "开发者", desc: "构建 AI 驱动的工作流，无需管理复杂的智能体基础设施。" }, { title: "团队", desc: "使用 AI 专家自动化研究、写作、编码和审查流水线。" }, { title: "研究人员", desc: "试验多智能体架构和协作策略。" }],
        },
        architecture: {
          h1: "架构",
          p1: "AI Collective 分为两层：运行 AI 智能体的 FastAPI 后端，以及提供可视化管理界面的 React 前端。",
          lifecycleH2: "请求生命周期",
          lifecycleP: "当您提交任务时，会发生以下情况：",
          lifecycle: ["前端发送带有任务描述和分配团队的 POST /api/tasks 请求", "Task Runner 以每个智能体为节点启动 LangGraph 图", "智能体接收消息，通过 LLM 提供商处理，并向 RabbitMQ 发出事件", "Event Bus 将智能体输出路由到依赖的智能体（例如 PM → Developer）", "智能体的工具调用（网络搜索、代码执行、API 调用）由 Skill Executor 处理", "最终输出由 Reviewer 智能体收集并通过 REST 返回前端"],
        },
        "key-concepts": {
          h1: "关键概念",
          p1: "在深入了解之前，这里是构成每个 AI Collective 部署的五个基本要素：",
          concepts: [{ title: "智能体", desc: "具有定义角色、个性和技能集的 AI 工作者。每个智能体有自己的系统提示和工具访问权限。" }, { title: "技能", desc: "您附加到智能体的能力 — 网络搜索工具、Google 表格集成、自定义 JavaScript 函数或 REST API 调用。" }, { title: "团队", desc: "协作完成任务的命名智能体组。团队可以在网状模式（全对全）或顺序模式（流水线）下运行。" }, { title: "任务", desc: "分配给团队的工作单元。任务有生命周期：待处理 → 进行中 → 已完成（或暂停/停止）。" }, { title: "对话", desc: "任务期间每次智能体交互的完整消息历史。浏览和重放任何智能体对话。" }],
        },
        quickstart: {
          h1: "快速开始", p1: "在 5 分钟内本地运行 AI Collective。",
          callout: "前提条件：Python 3.11+、Node.js 18+，以及 Anthropic 或 OpenAI 的 API 密钥。",
          cloneH2: "1. 克隆仓库", backendH2: "2. 配置后端",
          envH2: "3. 配置环境", startBackendH2: "4. 启动后端",
          startFrontendH2: "5. 启动前端",
          tipCallout: "前端开发服务器会自动将 API 请求代理到 localhost:8000，无需 CORS 配置。",
        },
        installation: {
          h1: "安装", requirementsH2: "系统要求",
          tableHeaders: ["组件", "最低要求", "推荐"],
          pythonH2: "Python 依赖", pythonP: "后端使用 pyproject.toml 管理。主要依赖：",
          frontendH2: "前端依赖", frontendP: "前端使用 React 18、Vite、shadcn/ui 和 Tailwind CSS。",
          rabbitH2: "可选：RabbitMQ", rabbitP: "对于多智能体事件广播，您可以通过 Docker 在本地运行 RabbitMQ：",
        },
        configuration: {
          h1: "配置", p1: "所有配置通过项目根目录中 .env 文件的环境变量完成。",
          apiKeysH2: "API 密钥", frontendH2: "前端配置",
          frontendP: "Vite 开发服务器运行在 8080 端口，期望后端在 localhost:8000。若需更改：",
        },
        agents: {
          h1: "智能体", p1: "智能体是具有定义角色、通过系统提示表达的个性，以及用于完成工作的技能（工具）集的 AI 工作者。",
          schemaH2: "智能体 Schema", rolesH2: "智能体角色", rolesP: "AI Collective 内置 40+ 角色模板。以下是最常用的：",
          callout: "您可以输入任何自定义角色名称 — 内置列表只是起始建议。",
          lifecycleH2: "智能体状态生命周期", restH2: "通过 REST API 创建",
        },
        skills: {
          h1: "技能", p1: "技能是您附加到智能体的能力 — 可以是第三方 API 集成、浏览器自动化工具、自定义 JavaScript 函数，或智能体可以调用的任何其他操作。",
          typesH2: "技能类型",
          types: [{ desc: "连接到外部服务：Google 表格、Slack、Notion、Airtable、REST API 等。" }, { desc: "编写在服务器端运行的自定义 JavaScript 代码。非常适合数据转换或业务逻辑。" }],
          toolsH2: "可用内置工具", schemaH2: "技能 Schema",
        },
        teams: {
          h1: "团队", p1: "团队是协作完成任务的命名智能体组。团队是执行单元 — 您将任务分配给团队，而不是单个智能体。",
          modesH2: "团队模式",
          mesh: { title: "网状模式", desc: "所有智能体可以相互通信。最适合需要智能体共同讨论和完善想法的创意或研究任务。" },
          sequential: { title: "顺序模式", desc: "智能体按照定义的流水线顺序运行。最适合结构化工作流：研究 → 撰写 → 审查 → 发布。" },
          schemaH2: "团队 Schema",
        },
        tasks: {
          h1: "任务", p1: "任务是您提交给团队的工作单元。它有标题、描述，以及从待处理到完成的生命周期。",
          lifecycleH2: "任务生命周期", schemaH2: "任务 Schema",
          graphH2: "任务图可视化", graphP: "任务管理器页面显示智能体交互的实时 SVG 图。每个节点是一个智能体，边显示它们之间的消息流。您可以平移和缩放以探索大型智能体网络。",
          graphCallout: "该图使用由自定义 SVG 渲染器驱动的力导向布局 — 无需第三方图库。",
        },
        conversations: {
          h1: "对话", p1: "任务期间智能体之间交换的每条消息都被记录为对话。对话页面让您浏览、过滤和重放所有智能体通信。",
          formatH2: "消息格式", filterH2: "过滤",
          filterP: "按智能体名称、角色、任务或日期范围过滤对话。消息支持全文搜索并以 Markdown 格式渲染。",
        },
        "guide-first-agent": {
          h1: "创建第一个智能体", p1: "本指南带您从头使用 UI 创建一个研究智能体。",
          step1H2: "第 1 步：打开智能体构建器", step1P: "在侧边栏导航到智能体，然后点击右上角的新建智能体。",
          step2H2: "第 2 步：填写详细信息",
          step3H2: "第 3 步：选择头像", step3P: "选择图标模式并选择搜索图标。选择青色背景以匹配研究智能体角色。",
          step4H2: "第 4 步：分配技能", step4P: "从技能面板勾选网络搜索和网络抓取技能。如果还没有技能，请先前往技能页面。",
          step5H2: "第 5 步：保存", step5P: "点击创建智能体。Alice 现在将以 idle 状态出现在您的智能体列表中。",
          callout: "通过点击 Alice 卡片上的测试按钮并输入研究问题来立即测试 Alice。",
        },
        "guide-build-team": {
          h1: "构建团队", p1: "团队将多个智能体组合成一个协作单元。让我们构建一个研究与写作团队。",
          compositionH2: "推荐的团队构成",
          teamRoles: [{ role: "项目经理", purpose: "协调任务分解并委派给其他智能体" }, { role: "研究智能体", purpose: "从网络收集信息并综合研究发现" }, { role: "开发智能体", purpose: "编写代码或技术文档" }, { role: "审查智能体", purpose: "在交付前验证所有输出" }],
          createH2: "创建团队", createP: "前往团队 → 新建团队，按顺序添加所有四个智能体，为协作任务选择网状模式，然后保存。",
        },
        "guide-run-task": {
          h1: "运行任务", p1: "团队构建完成后，提交您的第一个任务。",
          uiH2: "通过 UI", uiP: "导航到任务 → 新建任务，填写标题和描述，分配您的团队，然后点击创建任务。任务将进入进行中状态，您可以实时观察智能体图的动画。",
          restH2: "通过 REST API", monitorH2: "监控进度", monitorP: "轮询任务状态端点，或在任务 UI 中观看实时图：",
        },
        "guide-skills": {
          h1: "添加技能与 API", p1: "技能扩展了智能体可以做的事情。以下是如何添加网络搜索技能。",
          webSearchH2: "创建网络搜索技能", webSearchP: "导航到技能 → 新建技能：",
          sheetsH2: "创建 Google 表格集成",
          sheetsCallout: "Google OAuth 需要在 Google Cloud Console 中设置项目并下载 credentials.json。详情请参阅 Google 集成指南。",
          customH2: "自定义 JavaScript 技能",
        },
        "api-agents": { h1: "智能体 API", p1: "基础 URL：http://localhost:8000/api", endpointsH2: "端点", createH2: "创建智能体" },
        "api-skills": { h1: "技能 API", presetsH2: "获取工具预设" },
        "api-teams": { h1: "团队 API" },
        "api-tasks": { h1: "任务 API" },
        "api-chat": { h1: "聊天 API", p1: "无需创建完整任务即可直接测试单个智能体。" },
        "deploy-docker": { h1: "Docker 部署", p1: "使用 Docker Compose 部署整个技术栈。" },
        "deploy-env": { h1: "环境变量" },
        "contributing-guide": {
          h1: "如何贡献", p1: "AI Collective 欢迎各种贡献：bug 修复、新功能、文档改进等。",
          waysH2: "贡献方式",
          ways: ["⭐ 在 GitHub 上给仓库 Star，帮助他人发现该项目", "🐛 通过开启带有复现案例的 GitHub issue 来报告 bug", "💡 在 GitHub Discussions 标签页开启讨论来请求新功能", "🔧 通过提交 pull request 修复 bug", "📝 改进文档 — 即使修复错别字也很有价值！"],
          prH2: "Pull Request 流程", callout: "所有 PR 都经过 CI：后端检查（ruff）、前端类型检查（tsc）和测试（vitest）。请确保在请求审查前所有检查均通过。",
        },
        "contributing-dev": {
          h1: "开发环境配置", hooksH2: "Pre-commit Hooks",
          hooksP: "这将安装以下 hooks：Python 格式化（ruff）、行尾空白、文件末尾换行，以及 YAML/TOML 验证。",
          testsH2: "运行测试", styleH2: "代码风格",
          style: ["Python：使用 ruff 进行检查和格式化", "TypeScript：ESLint + TypeScript 严格模式", "提交：conventional commits 格式（feat:、fix:、docs:）"],
        },
      },
    },
  },

  ja: {
    auth: {
      badge: "マルチエージェントAIプラットフォーム",
      heroTitle: "協調して動くAIエージェントチームを構築",
      heroSub: "研究者・開発者・レビュアーなど専門AIエージェントを調整し、複雑なタスクを自律的に完成させます。",
      heroBullets: ["40以上のエージェントロールテンプレート", "10以上の統合スキルシステム", "リアルタイムタスクグラフ可視化", "セルフホスト & MITライセンス"],
      loginTab: "ログイン",
      registerTab: "登録",
      loginTitle: "おかえりなさい",
      loginSubtitle: "AI Collectiveにサインインして続ける",
      registerTitle: "アカウント作成",
      registerSubtitle: "AIエージェントチームの構築を始める",
      email: "メールアドレス",
      password: "パスワード",
      name: "氏名",
      namePlaceholder: "山田太郎",
      confirmPassword: "パスワード確認",
      loginBtn: "ログイン",
      registerBtn: "アカウントを作成",
      loggingIn: "ログイン中…",
      registering: "アカウント作成中…",
      or: "または",
      profileBtn: "マイプロフィール",
      logoutBtn: "サインアウト",
      editProfile: "プロフィール編集",
      changePassword: "パスワード変更",
      currentPassword: "現在のパスワード",
      newPassword: "新しいパスワード",
      saveChanges: "変更を保存",
      saving: "保存中…",
      saved: "保存済み！",
      cancel: "キャンセル",
      accountInfo: "アカウント情報",
      role: "ロール",
      userId: "ユーザーID",
      memberSince: "参加日",
      dangerZone: "危険ゾーン",
      logoutDesc: "このデバイスからサインアウトします。",
      passwordMismatch: "パスワードが一致しません。",
      errorDefault: "エラーが発生しました。もう一度お試しください。",
      orContinueWith: "または以下で続ける",
      socialComingSoon: "ソーシャルログインは近日公開予定",
      phoneBtn: "電話番号",
      phonePlaceholder: "+81 (90) 0000-0000",
      sendCode: "コードを送信",
      sendingCode: "送信中…",
      verifyCode: "確認コードを入力",
      codePlaceholder: "000000",
      verifyBtn: "確認",
      phoneNote: "お使いの番号に確認コードを送信します。",
    },
    nav: {
      label: "ナビゲーション", dashboard: "会社概要", agents: "スタッフ",
      skills: "業務とツール", teams: "部門", tasks: "タスクボード", projects: "プロジェクト",
      conversations: "ミーティング", analytics: "実績とコスト", playground: "トレーニング", workspaces: "会社管理",
      officeBuilder: "AI 会社デザイナー",
      virtualOffice: "オフィス図面",
      marketplace: "採用",
      documentLibrary: "ドキュメント",
      settings: "システム設定",
      overviewGroup: "概要",
      companiesGroup: "会社",
      catalogGroup: "カタログ",
      operationsGroup: "オペレーション",
      orgGroup: "組織",
      officeGroup: "スペース",
      devGroup: "システム設定",
      systemGroup: "ツール",
      adminGroup: "管理",
      monitoring: "システム監視",
      consumption: "使用量と請求",
      manageWorkspaces: "会社管理",
      monitoringBadge: "監視",
      selectCompanyToManage: "このページを開くには会社を選択してください。",
      suggestedBadge: "この会社タイプにおすすめ",
    },
    companyTypeLabel: "会社タイプ",
    companyTypes: { software: "ソフトウェア", marketing: "マーケティング", research: "リサーチ", general: "汎用" },
    documentLibrary: {
      title: "ドキュメントライブラリ",
      subtitle: "このビジネスユニットの共有ドキュメント — 配下の全プロジェクトで再利用できます。",
      overallScopeHint: "ドキュメントライブラリを管理するビジネスユニットを選択してください。",
      selectUnitFirst: "先にビジネスユニットを選択してください。",
      upload: "ドキュメントをアップロード",
      addFromUrl: "リンクから追加",
      urlPlaceholder: "https://example.com/article",
      search: "ドキュメントを検索…",
      empty: "ドキュメントがありません",
      emptyHint: "ファイルをアップロードするか、リンクを追加してライブラリを作成します。",
      download: "ダウンロード",
      delete: "削除",
      deleteConfirm: "このドキュメントを削除しますか？",
      attachToProject: "プロジェクトに添付",
      selectProject: "プロジェクトを選択",
      attach: "添付",
      cancel: "キャンセル",
      add: "追加",
      uploading: "アップロード中…",
      dropHint: "ここにファイルをドラッグ＆ドロップ、またはクリックして選択",
      descriptionOptional: "説明（任意）",
      tagsOptional: "タグ（カンマ区切り、任意）",
      nameOptional: "名前（任意）",
      uploadedBy: "アップロード者",
      attachSuccess: "ドキュメントをプロジェクトに添付しました。",
      uploadSuccess: "ドキュメントをアップロードしました。",
      deleteSuccess: "ドキュメントを削除しました。",
      all: "すべて",
      types: { pdf: "PDF", excel: "Excel", doc: "ドキュメント", image: "画像", link: "リンク", other: "その他" },
    },
    status: { allSystemsOnline: "全システム稼働中" },
    brand: { subtitle: "会社ビルダ" },
    landing: {
      nav: { getStarted: "始める" },
      hero: {
        badge: "オープンソース · MIT ライセンス",
        h1: ["オープンソースの AI コレクティブ", "調査し、コーディングし、", "そして創造する"],
        sub: "専門化されたエージェントチームを構築しましょう — それぞれに役割、スキル、メモリがあります。タスクを送信し、連携を見守り、本番対応の成果を受け取りましょう。",
        cta1: "始める", cta2: "ドキュメントを読む",
      },
      features: {
        label: "含まれる機能",
        title: "AI ワークフロー構築に\n必要なすべて",
        items: [
          { title: "マルチエージェントアーキテクチャ", desc: "異なる役割を持つ専門エージェント — PM、研究者、開発者、レビュアー — それぞれに専用のシステムプロンプト。" },
          { title: "スキルシステム", desc: "任意のエージェントにツールと統合を付加：ウェブ検索、Google スプレッドシート、コード実行、REST API、ブラウザ自動化。" },
          { title: "チーム実行モード", desc: "オープンな協力のためのメッシュモード、または厳密なパイプラインのためのシーケンシャルモード。チームごとに設定。" },
          { title: "リアルタイムタスクグラフ", desc: "パン＆ズーム対応のエージェント連携 SVG 可視化。エージェントのリアルタイム動作を観察。" },
          { title: "LangGraph 搭載", desc: "オーケストレーション層は LangGraph 上に構築 — 実績があり、組み合わせ可能で、本番対応。" },
          { title: "セルフホスト & MIT", desc: "データとインフラの完全なコントロール。ベンダーロックインなし。任意のクラウドまたはオンプレミスに展開。" },
        ],
      },
      modular: {
        label: "モジュラー設計",
        title: "エージェント、スキル、\nチームを組み合わせる",
        desc: "すべてのエージェントは設定可能なユニットです。スキルの任意の組み合わせを割り当て — ウェブ検索、コード実行、Google 統合、カスタム API — 単一の設定でチームに組み込みます。",
        bullets: ["40以上の組み込みエージェント役割テンプレート", "10以上の標準統合", "カスタム JavaScript スキルサポート", "プログラム制御用 REST API"],
      },
      openSource: {
        label: "オープンソース",
        title: "オープンソースから生まれ、\nオープンソースに還元する",
        desc: "AI Collective は MIT ライセンスで公開開発されています。リポジトリにスターを付け、フォークし、issue を開き、または貢献してください — これはあなたのプラットフォームでもあります。",
        stars: "スター", forks: "フォーク", issues: "オープンな Issue",
        starCta: "GitHub でスターを付ける", launch: "アプリを起動",
      },
      footer: { copy: "© 2026 AI Collective · MIT ライセンス" },
    },
    docs: {
      ui: {
        search: "ドキュメントを検索...", backToSite: "サイトに戻る", openApp: "アプリを開く",
        docsLabel: "ドキュメント", documentation: "ドキュメント", previous: "前へ", next: "次へ",
        editOnGitHub: "GitHub でこのページを編集", noResults: "結果が見つかりません",
        pageNotFound: "ページが見つかりません", comingSoon: "このセクションは近日公開予定です。",
      },
      nav: {
        sections: { intro: "はじめに", "getting-started": "スタートガイド", concepts: "コアコンセプト", guides: "ガイド", "api-reference": "API リファレンス", deployment: "デプロイ", contributing: "コントリビューション" },
        items: { "what-is": "AI Collective とは？", architecture: "アーキテクチャ", "key-concepts": "キーコンセプト", quickstart: "クイックスタート", installation: "インストール", configuration: "設定", agents: "エージェント", skills: "スキル", teams: "チーム", tasks: "タスク", conversations: "会話", "guide-first-agent": "最初のエージェントを作成", "guide-build-team": "チームを構築", "guide-run-task": "タスクを実行", "guide-skills": "スキルと API を追加", "api-agents": "エージェント API", "api-skills": "スキル API", "api-teams": "チーム API", "api-tasks": "タスク API", "api-chat": "チャット API", "deploy-docker": "Docker", "deploy-env": "環境変数", "contributing-guide": "コントリビューション方法", "contributing-dev": "開発環境のセットアップ" },
      },
      content: {
        "what-is": {
          h1: "AI Collective とは？",
          p1: "AI Collective は、専門化された AI エージェントのチームを構築し、複雑なタスクを自律的に協力して完了させることができるオープンソースのマルチエージェントオーケストレーションプラットフォームです — まるで本物のプロジェクトチームのように。",
          p2: "単一の AI を使う代わりに、AI Collective は目的別に構築されたエージェントに作業を分散します：計画を立てるプロジェクトマネージャーエージェント、情報を収集するリサーチエージェント、コードを書く開発者エージェント、そして納品前にすべての出力を検証するレビュアーエージェント。",
          callout: "AI Collective はセルフホスト型で、完全にオープンソース（MIT ライセンス）です。数分でローカルに起動するか、任意のクラウドプロバイダーにデプロイできます。",
          keyFeaturesH2: "主な機能",
          features: ["マルチエージェント協力 — エージェントはイベント駆動型メッセージバス（RabbitMQ）を通じて通信", "カスタマイズ可能な役割 — PM から医師、弁護士まで 40 以上の組み込み役割テンプレート、または独自定義", "スキルシステム — 個々のエージェントに統合（Google スプレッドシート、API、ウェブブラウジング）を付加", "チームモード — メッシュ（全エージェント協力）またはシーケンシャル（パイプライン）実行から選択", "リアルタイムタスクグラフ — パン＆ズームグラフビューでエージェントの活動を可視化", "LangChain/LangGraph バックエンド — 実績ある AI オーケストレーションプリミティブで動作", "React + FastAPI スタック — TypeScript と Python による現代的で保守性の高いコードベース"],
          whoForH2: "誰のために？",
          audience: [{ title: "開発者", desc: "複雑なエージェントインフラを管理せずに AI 駆動のワークフローを構築。" }, { title: "チーム", desc: "AI スペシャリストで研究、執筆、コーディング、レビューパイプラインを自動化。" }, { title: "研究者", desc: "マルチエージェントアーキテクチャと協力戦略を実験。" }],
        },
        architecture: {
          h1: "アーキテクチャ",
          p1: "AI Collective は 2 つのレイヤーに分かれています：AI エージェントを実行する FastAPI バックエンドと、視覚的な管理インターフェースを提供する React フロントエンド。",
          lifecycleH2: "リクエストライフサイクル",
          lifecycleP: "タスクを送信すると、以下のことが起こります：",
          lifecycle: ["フロントエンドがタスクの説明と割り当てられたチームと共に POST /api/tasks リクエストを送信", "Task Runner が各エージェントをノードとした LangGraph グラフを起動", "エージェントはメッセージを受信し、LLM プロバイダー経由で処理し、RabbitMQ にイベントを発行", "Event Bus がエージェント出力を依存エージェントにルーティング（例：PM → Developer）", "エージェントのツール呼び出し（ウェブ検索、コード実行、API 呼び出し）は Skill Executor が処理", "最終出力は Reviewer エージェントが収集し、REST 経由でフロントエンドに返送"],
        },
        "key-concepts": {
          h1: "キーコンセプト",
          p1: "始める前に、すべての AI Collective デプロイを構成する 5 つの基本要素を紹介します：",
          concepts: [{ title: "エージェント", desc: "定義された役割、個性、スキルセットを持つ AI ワーカー。各エージェントには独自のシステムプロンプトとツールアクセスがあります。" }, { title: "スキル", desc: "エージェントに付加する能力 — ウェブ検索ツール、Google スプレッドシート統合、カスタム JavaScript 関数、または REST API 呼び出し。" }, { title: "チーム", desc: "タスクで協力する名前付きエージェントのグループ。チームはメッシュモード（全対全）またはシーケンシャルモード（パイプライン）で実行できます。" }, { title: "タスク", desc: "チームに割り当てられた作業単位。タスクにはライフサイクルがあります：保留中 → 進行中 → 完了（または一時停止/停止）。" }, { title: "会話", desc: "タスク中のすべてのエージェント交流の完全なメッセージ履歴。任意のエージェント会話を閲覧・再生できます。" }],
        },
        quickstart: {
          h1: "クイックスタート", p1: "5 分以内に AI Collective をローカルで起動します。",
          callout: "前提条件：Python 3.11+、Node.js 18+、そして Anthropic または OpenAI の API キー。",
          cloneH2: "1. リポジトリをクローン", backendH2: "2. バックエンドをセットアップ",
          envH2: "3. 環境を設定", startBackendH2: "4. バックエンドを起動",
          startFrontendH2: "5. フロントエンドを起動",
          tipCallout: "フロントエンド開発サーバーは API リクエストを自動的に localhost:8000 にプロキシします。CORS 設定は不要です。",
        },
        installation: {
          h1: "インストール", requirementsH2: "システム要件",
          tableHeaders: ["コンポーネント", "最低要件", "推奨"],
          pythonH2: "Python 依存関係", pythonP: "バックエンドは pyproject.toml で管理されています。主な依存関係：",
          frontendH2: "フロントエンド依存関係", frontendP: "フロントエンドは React 18、Vite、shadcn/ui、Tailwind CSS を使用。",
          rabbitH2: "オプション：RabbitMQ", rabbitP: "マルチエージェントイベントブロードキャストのために、Docker でローカルに RabbitMQ を実行できます：",
        },
        configuration: {
          h1: "設定", p1: "すべての設定はプロジェクトルートの .env ファイルの環境変数で行います。",
          apiKeysH2: "API キー", frontendH2: "フロントエンド設定",
          frontendP: "Vite 開発サーバーはポート 8080 で動作し、バックエンドが localhost:8000 にあることを期待します。変更するには：",
        },
        agents: {
          h1: "エージェント", p1: "エージェントは定義された役割、システムプロンプトで表現された個性、そして作業を完了するためのスキル（ツール）セットを持つ AI ワーカーです。",
          schemaH2: "エージェントスキーマ", rolesH2: "エージェントの役割", rolesP: "AI Collective には 40 以上の組み込み役割テンプレートが付属しています。最も一般的なものを紹介します：",
          callout: "任意のカスタム役割名を入力できます — 組み込みリストは出発点の提案にすぎません。",
          lifecycleH2: "エージェントステータスのライフサイクル", restH2: "REST API で作成",
        },
        skills: {
          h1: "スキル", p1: "スキルはエージェントに付加する能力です — サードパーティ API 統合、ブラウザ自動化ツール、カスタム JavaScript 関数、またはエージェントが呼び出せる任意のアクション。",
          typesH2: "スキルの種類",
          types: [{ desc: "外部サービスに接続：Google スプレッドシート、Slack、Notion、Airtable、REST API など。" }, { desc: "サーバーサイドで実行されるカスタム JavaScript コードを記述。データ変換やビジネスロジックに最適。" }],
          toolsH2: "利用可能な組み込みツール", schemaH2: "スキルスキーマ",
        },
        teams: {
          h1: "チーム", p1: "チームはタスクで協力する名前付きエージェントのグループです。チームは実行単位 — 個々のエージェントではなく、チームにタスクを割り当てます。",
          modesH2: "チームモード",
          mesh: { title: "メッシュモード", desc: "すべてのエージェントが相互に通信できます。エージェントがアイデアを議論・洗練する必要があるクリエイティブまたはリサーチタスクに最適。" },
          sequential: { title: "シーケンシャルモード", desc: "エージェントは定義されたパイプライン順に実行されます。構造化されたワークフローに最適：リサーチ → 執筆 → レビュー → 公開。" },
          schemaH2: "チームスキーマ",
        },
        tasks: {
          h1: "タスク", p1: "タスクはチームに送信する作業単位です。タイトル、説明、および保留中から完了まで進むライフサイクルがあります。",
          lifecycleH2: "タスクライフサイクル", schemaH2: "タスクスキーマ",
          graphH2: "タスクグラフの可視化", graphP: "タスクマネージャーページにはエージェント連携のリアルタイム SVG グラフが表示されます。各ノードはエージェントで、エッジはそれらの間のメッセージフローを示します。パン＆ズームで大規模なエージェントネットワークを探索できます。",
          graphCallout: "グラフはカスタム SVG レンダラーによるフォースダイレクトレイアウトを使用 — サードパーティグラフライブラリ不要。",
        },
        conversations: {
          h1: "会話", p1: "タスク中にエージェント間で交わされたすべてのメッセージは会話として記録されます。会話ページで、すべてのエージェント通信を閲覧、フィルタリング、再生できます。",
          formatH2: "メッセージフォーマット", filterH2: "フィルタリング",
          filterP: "エージェント名、役割、タスク、または日付範囲で会話をフィルタリング。メッセージは全文検索をサポートし、Markdown 形式でレンダリングされます。",
        },
        "guide-first-agent": {
          h1: "最初のエージェントを作成", p1: "このガイドでは、UI を使用してゼロからリサーチエージェントを作成する方法を説明します。",
          step1H2: "ステップ 1：エージェントビルダーを開く", step1P: "サイドバーのエージェントに移動し、右上の新規エージェントをクリックします。",
          step2H2: "ステップ 2：詳細を入力",
          step3H2: "ステップ 3：アバターを選択", step3P: "アイコンモードを選択し、検索アイコンを選びます。リサーチエージェントの役割に合うティール色の背景を選択します。",
          step4H2: "ステップ 4：スキルを割り当て", step4P: "スキルパネルからウェブ検索とウェブスクレイプスキルにチェックを入れます。スキルがない場合は、まずスキルページに移動してください。",
          step5H2: "ステップ 5：保存", step5P: "エージェントを作成をクリックします。Alice が idle ステータスでエージェントリストに表示されます。",
          callout: "Alice のカードのテストボタンをクリックしてリサーチの質問を入力することで、すぐに Alice をテストできます。",
        },
        "guide-build-team": {
          h1: "チームを構築", p1: "チームは複数のエージェントを協力単位に組み合わせます。リサーチ＆ライティングチームを構築しましょう。",
          compositionH2: "推奨チーム構成",
          teamRoles: [{ role: "プロジェクトマネージャー", purpose: "タスクの分解を調整し、他のエージェントに委任" }, { role: "リサーチエージェント", purpose: "ウェブから情報を収集し、発見を統合" }, { role: "開発者エージェント", purpose: "コードまたは技術ドキュメントを作成" }, { role: "レビュアーエージェント", purpose: "納品前にすべての出力を検証" }],
          createH2: "チームを作成", createP: "チーム → 新規チームに移動し、4 つのエージェントを順番に追加し、協力タスクのためにメッシュモードを選択して保存します。",
        },
        "guide-run-task": {
          h1: "タスクを実行", p1: "チームが構築できたら、最初のタスクを送信しましょう。",
          uiH2: "UI 経由", uiP: "タスク → 新規タスクに移動し、タイトルと説明を入力し、チームを割り当て、タスクを作成をクリックします。タスクは進行中ステータスに移行し、エージェントグラフのリアルタイムアニメーションを観察できます。",
          restH2: "REST API 経由", monitorH2: "進捗を監視", monitorP: "タスクステータスエンドポイントをポーリングするか、タスク UI のライブグラフを観察：",
        },
        "guide-skills": {
          h1: "スキルと API を追加", p1: "スキルはエージェントができることを拡張します。ウェブ検索スキルの追加方法を紹介します。",
          webSearchH2: "ウェブ検索スキルを作成", webSearchP: "スキル → 新規スキルに移動：",
          sheetsH2: "Google スプレッドシート統合を作成",
          sheetsCallout: "Google OAuth は Google Cloud Console でプロジェクトを設定し credentials.json をダウンロードする必要があります。詳細は Google 統合ガイドを参照してください。",
          customH2: "カスタム JavaScript スキル",
        },
        "api-agents": { h1: "エージェント API", p1: "ベース URL：http://localhost:8000/api", endpointsH2: "エンドポイント", createH2: "エージェントを作成" },
        "api-skills": { h1: "スキル API", presetsH2: "ツールプリセットを取得" },
        "api-teams": { h1: "チーム API" },
        "api-tasks": { h1: "タスク API" },
        "api-chat": { h1: "チャット API", p1: "完全なタスクを作成せずに個々のエージェントを直接テストします。" },
        "deploy-docker": { h1: "Docker デプロイ", p1: "Docker Compose でスタック全体をデプロイします。" },
        "deploy-env": { h1: "環境変数" },
        "contributing-guide": {
          h1: "コントリビューション方法", p1: "AI Collective はあらゆる種類のコントリビューションを歓迎します：バグ修正、新機能、ドキュメント改善など。",
          waysH2: "コントリビューション方法",
          ways: ["⭐ GitHub でリポジトリにスターを付けて、他の人がプロジェクトを発見できるようにする", "🐛 再現ケースを添えた GitHub issue を開いてバグを報告する", "💡 GitHub Discussions タブでディスカッションを開いて機能をリクエストする", "🔧 プルリクエストを送信してバグを修正する", "📝 ドキュメントを改善する — タイポを修正するだけでも価値があります！"],
          prH2: "プルリクエストプロセス", callout: "すべての PR は CI を通過します：バックエンドリンティング（ruff）、フロントエンド型チェック（tsc）、テスト（vitest）。レビューをリクエストする前にすべてのチェックが通過することを確認してください。",
        },
        "contributing-dev": {
          h1: "開発環境のセットアップ", hooksH2: "Pre-commit フック",
          hooksP: "これにより以下のフックがインストールされます：Python フォーマット（ruff）、行末の空白、ファイル末尾の改行、YAML/TOML 検証。",
          testsH2: "テストを実行", styleH2: "コードスタイル",
          style: ["Python：リンティングとフォーマットに ruff を使用", "TypeScript：ESLint + TypeScript ストリクトモード", "コミット：conventional commits フォーマット（feat:、fix:、docs:）"],
        },
      },
    },
    marketing: {
      common: { login: "ログイン", startBuilding: "構築を始める", contactSales: "営業に連絡", devDocs: "開発者ドキュメント", viewPricing: "料金を見る" },
      meet: {
        badge: "AI Collective を紹介", h1: "プログラマブル AI の新時代",
        sub: "AI Collective は高性能なマルチエージェント編成プラットフォームで、AI 労働力を展開・調整・拡張できます — トポロジー、ツール、実行環境を完全にコントロール。",
        productsLabel: "製品", productsTitle: "2 つの展開方法",
        product1Name: "AI Collective", product1Desc: "完全なプラットフォーム — ダッシュボードと REST API でマルチエージェントチームを構築・設定・監視。", product1Cta: "コンソールを開く",
        product2Name: "Agent Mesh", product2Desc: "既存のスタックにマルチエージェントルーティングを統合するためのスタンドアロン Mesh 編成レイヤー。", product2Cta: "ドキュメントを読む",
        featuresLabel: "機能", featuresTitle: "AI を編成するために必要なすべて",
        modelsLabel: "モデル", modelsTitle: "完全 LLM 非依存", modelsSub: "実行時にモデルエンジンを設定・交換・ルーティング — コード変更不要。",
        ctaTitle: "構築する準備はできましたか？", ctaSub: "数分で最初のマルチエージェント労働力を展開しましょう。", ctaFree: "無料で構築を始める",
      },
      pricing: {
        badge: "料金", h1: "シンプルで透明な料金", sub: "オープンソースで無料から始める。マネージドホスティングでスケール。エンタープライズで成長。",
        plan1Name: "オープンソース", plan1Price: "無料", plan1Period: "永久", plan1Desc: "自社インフラで AI Collective プラットフォーム全体をセルフホスト。", plan1Cta: "GitHub で始める",
        plan2Name: "プロ", plan2Price: "$49", plan2Period: "月額", plan2Desc: "成長するチームのためのマネージドホスティング、分散バックエンド、優先サポート。", plan2Cta: "無料トライアルを開始",
        plan3Name: "エンタープライズ", plan3Price: "カスタム", plan3Period: "カスタム料金", plan3Desc: "大規模展開のための専用インフラ、カスタム統合、SLA 保証。", plan3Cta: "営業に連絡",
        apiLabel: "API 料金", apiTitle: "従量課金モデルコスト", apiSub: "LLM トークンコストはプロバイダー料率で直接転嫁。マークアップなし。",
        ctaTitle: "質問がありますか？", ctaSub: "チームが最適なプランを見つけるお手伝いをします。", ctaGithub: "GitHub で探索",
      },
      solutions: {
        badge: "ソリューション", h1: "すべてのチームのための AI Collective", sub: "スタートアッププロトタイピングからエンタープライズ級編成まで — ユースケースに適したマルチエージェントソリューションを展開。",
        useCasesLabel: "ユースケース", useCasesTitle: "チームが AI Collective で構築するもの",
        sizeLabel: "会社規模", sizeTitle: "あなたの規模に最適",
        industriesLabel: "業界", industriesTitle: "高リスク領域向けに構築",
        ctaTitle: "ソリューションを見つける", ctaSub: "チームと話し合い、組織に適したエージェントアーキテクチャを設計しましょう。",
      },
      resources: {
        badge: "リソース", h1: "より速く出荷するために必要なすべて", sub: "ガイド、リファレンスドキュメント、変更履歴、コミュニティリソース — すべて一か所に。",
        card1Label: "ドキュメント", card1Title: "開発者ドキュメント", card1Desc: "完全な API リファレンス、トポロジーガイド、ツール統合レシピ、デプロイプレイブック。", card1Cta: "ドキュメントを開く",
        card2Label: "オープンソース", card2Title: "GitHub リポジトリ", card2Desc: "ソースコードを探索し、コントリビュートし、Issue を作成し、GitHub で開発を追跡。", card2Cta: "GitHub で見る",
        card3Label: "更新", card3Title: "変更履歴", card3Desc: "すべてのリリースを追跡 — 新しいトポロジー、ツールキット追加、パフォーマンス改善、破壊的変更。", card3Cta: "変更履歴を見る",
        articlesLabel: "チームから", articlesTitle: "最新の記事とガイド",
        newsletterTitle: "最新情報を入手", newsletterSub: "製品アップデート、新しいツールキット、エンジニアリングの深堀り — 月1回、スパムなし。", newsletterBtn: "購読", newsletterNote: "いつでも購読解除できます。",
      },
      changelog: {
        badge: "変更履歴", h1: "AI Collective の新機能", sub: "すべてのリリース、改善、修正 — 一か所にドキュメント化。", viewGithub: "GitHub で見る",
      },
      contactSales: {
        badge: "お問い合わせ",
        h1: "営業に連絡",
        sub: "当社の営業チームは、AI Collective APIや大規模で複雑なデプロイメント向けのカスタムサポート用リソースを提供できます。または、今すぐ始めるには、セルフサービスプランをご覧ください。",
        supportCardTitle: "その他のヘルプが必要ですか？",
        supportCardDesc: "ナレッジベースの記事を閲覧し、製品の詳細を確認し、技術的な質問の回答を得ることができます。",
        supportCardCta: "サポートセンターにアクセス",
        formHelpLabel: "どのようなご用件でしょうか？",
        formHelpPlaceholder: "選択してください",
        options: {
          sales: "営業への連絡",
          limits: "レート制限 of 引き上げ",
          baa: "事業提携契約 (BAA)",
          zdr: "データ保持ゼロ (ZDR)",
          support: "製品サポート",
        },
        firstName: "名",
        lastName: "姓",
        email: "仕事用メールアドレス",
        emailHint: "既存のユーザー様は、アカウントのメールアドレスを入力してください。",
        phone: "電話番号",
        companyName: "会社または組織名",
        companyWebsite: "会社または組織のウェブサイト",
        jobTitle: "役職",
        industry: "業界",
        hq: "本社の所在地",
        interest: "主な製品への関心",
        employees: "会社の従業員数は何名ですか？",
        journey: "検討状況について教えてください。",
        message: "お問い合わせの理由について詳しく教えてください...",
        source: "当社についてどこでお知りになりましたか？",
        submitBtn: "送信",
        submitting: "送信中...",
        successTitle: "ありがとうございます！",
        successDesc: "リクエストが送信されました。担当者より折り返しご連絡いたします。",
      },
    },
  },
};
