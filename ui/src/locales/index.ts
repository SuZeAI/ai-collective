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
    staff: string;
    skills: string;
    departments: string;
    tasks: string;
    projects: string;
    meetings: string;
    analytics: string;
    playground: string;
    companies: string;
    officeBuilder: string;
    virtualOffice: string;
    recruiting: string;
    documentLibrary: string;
    platform: string;
    settings: string;
    overviewGroup: string;
    companiesGroup: string;
    catalogGroup: string;
    operationsGroup: string;
    orgGroup: string;
    officeGroup: string;
    devGroup: string;
    systemGroup: string;
    integrationsGroup: string;
    adminGroup: string;
    monitoring: string;
    consumption: string;
    manageCompanies: string;
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
      staff: {
        h1: string; p1: string; schemaH2: string;
        rolesH2: string; rolesP: string; callout: string;
        lifecycleH2: string; restH2: string;
      };
      skills: {
        h1: string; p1: string; typesH2: string;
        types: Array<{ desc: string }>; toolsH2: string; schemaH2: string;
      };
      departments: {
        h1: string; p1: string; modesH2: string;
        mesh: { title: string; desc: string };
        sequential: { title: string; desc: string };
        ring: { title: string; desc: string };
        supervisor: { title: string; desc: string };
        tree: { title: string; desc: string };
        custom: { title: string; desc: string };
        schemaH2: string;
      };
      tasks: {
        h1: string; p1: string; lifecycleH2: string; schemaH2: string;
        graphH2: string; graphP: string; graphCallout: string;
      };
      meetings: {
        h1: string; p1: string; formatH2: string;
        filterH2: string; filterP: string;
      };
      "guide-first-staff": {
        h1: string; p1: string;
        step1H2: string; step1P: string;
        step2H2: string;
        step3H2: string; step3P: string;
        step4H2: string; step4P: string;
        step5H2: string; step5P: string; callout: string;
      };
      "guide-build-department": {
        h1: string; p1: string; compositionH2: string;
        departmentRoles: Array<{ role: string; purpose: string }>;
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
      "api-staff": { h1: string; p1: string; endpointsH2: string; createH2: string };
      "api-skills": { h1: string; presetsH2: string };
      "api-departments": { h1: string };
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
      badge: "Multi-Staff AI Platform",
      heroTitle: "Build AI staff departments that work together",
      heroSub: "Orchestrate specialized AI staff — researcher, developer, reviewer — to collaborate and complete complex tasks autonomously.",
      heroBullets: ["40+ built-in staff role templates", "Skill system with 10+ integrations", "Real-time task graph visualization", "Self-hosted & MIT licensed"],
      loginTab: "Sign In",
      registerTab: "Register",
      loginTitle: "Welcome back",
      loginSubtitle: "Sign in to continue to AI Collective",
      registerTitle: "Create an account",
      registerSubtitle: "Start building your AI staff department",
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
      sessionExpiredTitle: "Session expired",
      sessionExpiredDesc: "Please sign in again to continue.",
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
      label: "Navigation", dashboard: "Company Overview", staff: "Staff",
      skills: "Skills & Tools", departments: "Departments", tasks: "Task Board", projects: "Projects",
      meetings: "Meetings", analytics: "Performance & Cost", playground: "Playground", companies: "Manage Companies",
      officeBuilder: "AI Office Designer",
      virtualOffice: "Office Map",
      recruiting: "Recruiting",
      documentLibrary: "Documents",
      platform: "Platform",
      settings: "Settings",
      overviewGroup: "Overview",
      companiesGroup: "Companies",
      catalogGroup: "Catalog",
      operationsGroup: "Operations",
      orgGroup: "Organization",
      officeGroup: "Office",
      devGroup: "System Setup",
      systemGroup: "Tools",
      integrationsGroup: "Integrations",
      adminGroup: "Administration",
      monitoring: "System Monitoring",
      consumption: "Usage & Billing",
      manageCompanies: "Manage Companies",
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
        sub: "Build specialized staff departments — each with their own role, skills, and memory. Submit a task, watch them collaborate, get production-ready results.",
        cta1: "Get Started", cta2: "Read the Docs",
      },
      features: {
        label: "What's included",
        title: "Everything you need to build\nAI-powered workflows",
        items: [
          { title: "Multi-Staff Architecture", desc: "Specialized staff with distinct roles — PM, Researcher, Developer, Reviewer — each with a focused system prompt." },
          { title: "Skill System", desc: "Attach tools and integrations to any staff: web search, Google Sheets, code execution, REST APIs, browser automation." },
          { title: "Department Execution Modes", desc: "Mesh, sequential, ring, supervisor, tree, or fully custom routing — configure the execution mode per department." },
          { title: "Real-time Task Graph", desc: "SVG visualization of staff interactions with pan & zoom. Watch your staff work in real time." },
          { title: "LangGraph Powered", desc: "The orchestration layer is built on LangGraph — battle-tested, composable, and production-ready." },
          { title: "Self-Hosted & MIT", desc: "Full control over your data and infrastructure. No vendor lock-in. Deploy on any cloud or on-premise." },
        ],
      },
      modular: {
        label: "Modular by design",
        title: "Compose staff,\nskills, and departments",
        desc: "Every staff is a configurable unit. Assign any combination of skills — web search, code execution, Google integrations, custom APIs — and compose them into departments with a single config.",
        bullets: ["40+ built-in staff role templates", "10+ integrations out of the box", "Custom JavaScript skill support", "REST API for programmatic control"],
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
        badge: "Meet AI Collective", h1: "Build and run AI-powered companies",
        sub: "AI Collective lets you create and manage AI-powered companies — of any type, from software startups to marketing agencies to research labs — each staffed, organized into departments, and run with full control over topology, tools, and execution environment.",
        productsLabel: "Products", productsTitle: "Two ways to deploy",
        product1Name: "AI Collective", product1Desc: "The full platform — build, configure, and monitor multi-staff departments via dashboard and REST API.", product1Cta: "Open console",
        product2Name: "Staff Mesh", product2Desc: "A standalone mesh orchestrator layer for integrating multi-staff routing into your existing stack.", product2Cta: "Read the docs",
        featuresLabel: "Features", featuresTitle: "Everything you need to orchestrate AI",
        modelsLabel: "Models", modelsTitle: "Fully LLM-agnostic", modelsSub: "Configure, swap, or route model engines at runtime — no code changes required.",
        ctaTitle: "Ready to build?", ctaSub: "Launch your first AI-powered company in minutes.", ctaFree: "Start building free",
      },
      pricing: {
        badge: "Pricing", h1: "Simple, transparent pricing", sub: "Start free with open source. Scale with managed hosting. Grow with enterprise.",
        plan1Name: "Open Source", plan1Price: "Free", plan1Period: "forever", plan1Desc: "Self-host the full AI Collective platform on your own infrastructure.", plan1Cta: "Get started on GitHub",
        plan2Name: "Pro", plan2Price: "$49", plan2Period: "per month", plan2Desc: "Managed hosting, distributed backends, and priority support for growing departments.", plan2Cta: "Start free trial",
        plan3Name: "Enterprise", plan3Price: "Custom", plan3Period: "tailored pricing", plan3Desc: "Dedicated infrastructure, custom integrations, and guaranteed SLAs for large deployments.", plan3Cta: "Contact sales",
        apiLabel: "API Pricing", apiTitle: "Pay-as-you-go model costs", apiSub: "LLM token costs are passed through at provider rates. No markup.",
        ctaTitle: "Have questions?", ctaSub: "Our department is ready to help you find the right plan.", ctaGithub: "Explore on GitHub",
      },
      solutions: {
        badge: "Solutions", h1: "AI Collective for every kind of company", sub: "From startup prototyping to enterprise-grade orchestration — build and run the right kind of AI-powered company for your use case.",
        useCasesLabel: "Use Cases", useCasesTitle: "What companies build with AI Collective",
        sizeLabel: "Company Size", sizeTitle: "Right for your scale",
        industriesLabel: "Industries", industriesTitle: "Built for regulated, high-stakes domains",
        ctaTitle: "Find your solution", ctaSub: "Talk to our team to design the right staff architecture.",
      },
      resources: {
        badge: "Resources", h1: "Everything you need to ship faster", sub: "Guides, reference docs, the changelog, and community resources — all in one place.",
        card1Label: "Documentation", card1Title: "Developer Docs", card1Desc: "Full API reference, topology guides, tool integration recipes, and deployment playbooks.", card1Cta: "Open docs",
        card2Label: "Open Source", card2Title: "GitHub Repository", card2Desc: "Explore the source code, contribute, file issues, and track development on GitHub.", card2Cta: "View on GitHub",
        card3Label: "Updates", card3Title: "Changelog", card3Desc: "Follow every release — new topologies, toolkit additions, performance improvements, and breaking changes.", card3Cta: "See changelog",
        articlesLabel: "From the Department", articlesTitle: "Latest articles & guides",
        newsletterTitle: "Stay up to date", newsletterSub: "Product updates, new toolkits, and engineering deep-dives — monthly, no spam.", newsletterBtn: "Subscribe", newsletterNote: "Unsubscribe at any time.",
      },
      changelog: {
        badge: "Changelog", h1: "What's new in AI Collective", sub: "Every release, every improvement, every fix — documented in one place.", viewGithub: "View on GitHub",
      },
      contactSales: {
        badge: "Contact Sales",
        h1: "Contact sales",
        sub: "Our sales department can provide resources for custom support with the AI Collective API or large, complex deployments. Or to get started now, explore our self-serve plans.",
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
        successDesc: "Your request has been submitted. Our department will review it and contact you shortly.",
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
        items: { "what-is": "What is AI Collective?", architecture: "Architecture", "key-concepts": "Key Concepts", quickstart: "Quick Start", installation: "Installation", configuration: "Configuration", staff: "Staff", skills: "Skills", departments: "Departments", tasks: "Tasks", meetings: "Meetings", "guide-first-staff": "Create Your First Staff", "guide-build-department": "Build a Department", "guide-run-task": "Run a Task", "guide-skills": "Add Skills & APIs", "api-staff": "Staff API", "api-skills": "Skills API", "api-departments": "Departments API", "api-tasks": "Tasks API", "api-chat": "Chat API", "deploy-docker": "Docker", "deploy-env": "Environment Variables", "contributing-guide": "How to Contribute", "contributing-dev": "Development Setup" },
      },
      content: {
        "what-is": {
          h1: "What is AI Collective?",
          p1: "AI Collective is a source-available platform for creating and managing AI-powered companies — build departments of specialized AI staff that collaborate autonomously to complete complex tasks, just like a real company.",
          p2: "Instead of using a single monolithic AI, AI Collective distributes work across purpose-built staff: a Project Manager staff that plans, a Research staff that gathers information, a Developer staff that writes code, and a Reviewer staff that validates every output before delivery.",
          callout: "AI Collective is self-hosted and source-available, free for non-commercial/academic use (see LICENSE). You can run it locally in minutes or deploy it on any cloud provider.",
          keyFeaturesH2: "Key Features",
          features: ["Multi-staff collaboration — staff communicate through an event-driven task queue (in-memory by default, RabbitMQ for distributed setups)", "Customizable roles — 40+ built-in role templates from PM to Doctor to Lawyer, or define your own", "Skill system — attach integrations (Google Sheets, APIs, web browsing) to individual staff", "Department modes — choose between mesh, sequential, ring, supervisor, tree, or a custom flow graph", "Real-time task graph — visualize staff activity with pan & zoom graph view", "LangChain / LangGraph backend — powered by battle-tested AI orchestration primitives", "React + FastAPI stack — modern, maintainable codebase with TypeScript and Python"],
          whoForH2: "Who is it for?",
          audience: [{ title: "Developers", desc: "Build AI-powered workflows without managing complex staff infrastructure." }, { title: "Departments", desc: "Automate research, writing, coding, and review pipelines with AI specialists." }, { title: "Researchers", desc: "Experiment with multi-staff architectures and collaboration strategies." }],
        },
        architecture: {
          h1: "Architecture",
          p1: "AI Collective is split into two layers: a FastAPI backend that runs the AI staff, and a React frontend that provides the visual management interface.",
          lifecycleH2: "Request Lifecycle",
          lifecycleP: "When you submit a task, this is what happens:",
          lifecycle: ["Frontend sends a POST /api/v1/tasks request with the task description and assigned department", "The Task Runner spins up a LangGraph graph with each staff as a node", "Staff receive messages, process them via the LLM provider, and emit SSE events over the run stream", "Dependent staff react to upstream outputs per the department's topology (e.g., PM → Developer)", "Each staff's tool calls (web search, code execution, API calls) are handled by the Skill Executor", "Final output is collected by the department and returned to the frontend via SSE/REST"],
        },
        "key-concepts": {
          h1: "Key Concepts",
          p1: "Before diving in, here are the five primitives that make up every AI Collective deployment:",
          concepts: [{ title: "Staff", desc: "An AI worker with a defined role, personality, and set of skills. Each staff has its own system prompt and tool access." }, { title: "Skill", desc: "A capability you attach to an staff — a web search tool, a Google Sheets integration, a custom JavaScript function, or a REST API call." }, { title: "Department", desc: "A named group of staff that collaborate on tasks. Departments can run in mesh mode (all-to-all) or sequential mode (pipeline)." }, { title: "Task", desc: "A unit of work assigned to a department. Tasks have a lifecycle: pending → in-progress → completed (or paused / stopped)." }, { title: "Meeting", desc: "The full message history of every staff interaction during a task. Browse and replay any staff meeting." }],
        },
        quickstart: {
          h1: "Quick Start", p1: "Get AI Collective running locally in under 5 minutes.",
          callout: "Prerequisites: Python 3.11+, Node.js 18+, uv, and a Google, Anthropic, OpenAI, or OpenRouter API key.",
          cloneH2: "1. Clone the repository", backendH2: "2. Set up the backend",
          envH2: "3. Configure environment", startBackendH2: "4. Start the backend",
          startFrontendH2: "5. Start the frontend",
          tipCallout: "There's no Vite dev proxy — the frontend calls a same-origin /api/v1 by default. For local dev with the backend on a different port, set VITE_API_BASE_URL to point at it.",
        },
        installation: {
          h1: "Installation", requirementsH2: "System Requirements",
          tableHeaders: ["Component", "Minimum", "Recommended"],
          pythonH2: "Python dependencies", pythonP: "The backend is managed with pyproject.toml. Key dependencies:",
          frontendH2: "Frontend dependencies", frontendP: "The frontend uses React 18, Vite, shadcn/ui, and Tailwind CSS.",
          rabbitH2: "Optional: RabbitMQ", rabbitP: "For multi-staff event broadcasting, you can run RabbitMQ locally via Docker:",
        },
        configuration: {
          h1: "Configuration", p1: "All configuration is done through environment variables in a .env file at the project root.",
          apiKeysH2: "API Keys", frontendH2: "Frontend configuration",
          frontendP: "The Vite dev server runs on port 8080 and expects the backend at localhost:8000. To change these:",
        },
        staff: {
          h1: "Staff", p1: "An staff is an AI worker with a defined role, a personality expressed through its system prompt, and a set of skills (tools) it can use to complete work.",
          schemaH2: "Staff schema", rolesH2: "Staff roles", rolesP: "AI Collective ships with 40+ built-in role templates. Here are the most common ones:",
          callout: "You can type any custom role name — the built-in list is just a starting suggestion.",
          lifecycleH2: "Staff status lifecycle", restH2: "Create via REST API",
        },
        skills: {
          h1: "Skills", p1: "A skill is a capability you attach to an staff — it can be a third-party API integration, a browser automation tool, a custom JavaScript function, or any other action the staff can invoke.",
          typesH2: "Skill types",
          types: [{ desc: "Connect to external services: Google Sheets, Slack, Notion, Airtable, REST APIs, and more." }, { desc: "Write custom JavaScript code that runs server-side. Great for data transformation or business logic." }],
          toolsH2: "Available built-in tools", schemaH2: "Skill schema",
        },
        departments: {
          h1: "Departments", p1: "A department is a named group of staff that collaborate on tasks. Departments are the unit of execution — you assign tasks to a department, not to individual staff.",
          modesH2: "Department modes",
          mesh: { title: "Mesh mode", desc: "All staff can communicate with each other. Best for creative or research tasks where staff need to debate and refine ideas together." },
          sequential: { title: "Sequential mode", desc: "Staff run in a defined pipeline order. Best for structured workflows: Research → Write → Review → Publish." },
          ring: { title: "Ring mode", desc: "Staff pass work around in a loop for a fixed number of rounds, each building on the previous one's output. Good for iterative debate or multi-pass drafting." },
          supervisor: { title: "Supervisor mode", desc: "A lead staff member delegates subtasks to the rest of the department and can spawn bounded subagents on demand. Good for open-ended work that needs dynamic task breakdown." },
          tree: { title: "Tree mode", desc: "A manager staff member delegates down hierarchical branches to other staff, who may delegate further. Good for work that naturally splits into nested subtasks." },
          custom: { title: "Custom mode", desc: "You draw the staff-to-staff routing yourself as a flow graph. Use this when none of the built-in modes match your workflow." },
          schemaH2: "Department schema",
        },
        tasks: {
          h1: "Tasks", p1: "A task is a unit of work you submit to a department. It has a title, description, and a lifecycle that progresses from pending to completed.",
          lifecycleH2: "Task lifecycle", schemaH2: "Task schema",
          graphH2: "Task graph visualization", graphP: "The Task Manager page shows a real-time SVG graph of staff interactions. Each node is an staff, and edges show message flow between them. You can pan and zoom to explore large staff networks.",
          graphCallout: "The graph uses a force-directed layout powered by a custom SVG renderer — no third-party graph library required.",
        },
        meetings: {
          h1: "Meetings", p1: "Every message exchanged between staff during a task is recorded as a meeting. The Meetings page lets you browse, filter, and replay all staff communications.",
          formatH2: "Message format", filterH2: "Filtering",
          filterP: "Filter meetings by staff name, role, task, or date range. Messages support full-text search and are rendered with Markdown formatting.",
        },
        "guide-first-staff": {
          h1: "Create Your First Staff", p1: "This guide walks you through creating a Research Staff from scratch using the UI.",
          step1H2: "Step 1: Open Staff Builder", step1P: "Navigate to Staff in the sidebar, then click New Staff in the top right.",
          step2H2: "Step 2: Fill in the details",
          step3H2: "Step 3: Choose an avatar", step3P: "Select icon mode and pick the search icon. Choose a teal background color to match the Research Staff role.",
          step4H2: "Step 4: Assign skills", step4P: "Check Web Search and Web Scrape skills from the skill panel. If you don't have skills yet, go to the Skills page first.",
          step5H2: "Step 5: Save", step5P: "Click Create Staff. Alice will now appear in your staff roster with an idle status.",
          callout: "Test Alice immediately by clicking the Test button on her card and entering a research question.",
        },
        "guide-build-department": {
          h1: "Build a Department", p1: "Departments combine multiple staff into a collaborative unit. Let's build a research & writing department.",
          compositionH2: "Recommended department composition",
          departmentRoles: [{ role: "Project Manager", purpose: "Coordinates task breakdown and delegates to other staff" }, { role: "Research Staff", purpose: "Gathers information from the web and synthesizes findings" }, { role: "Developer Staff", purpose: "Writes code or technical documentation" }, { role: "Reviewer Staff", purpose: "Validates all outputs before delivery" }],
          createH2: "Create the department", createP: "Go to Departments → New Department, add all four staff in order, select mesh mode for collaborative tasks, then save.",
        },
        "guide-run-task": {
          h1: "Run a Task", p1: "With a department built, submit your first task.",
          uiH2: "Via the UI", uiP: "Navigate to Tasks → New Task, fill in a title and description, assign your department, and click Create Task. The task will move to in-progress status and you can watch the staff graph animate in real time.",
          restH2: "Via REST API", monitorH2: "Monitor progress", monitorP: "Poll the task status endpoint, or watch the live graph in the Tasks UI:",
        },
        "guide-skills": {
          h1: "Add Skills & APIs", p1: "Skills extend what staff can do. Here's how to add a web search skill.",
          webSearchH2: "Create a web search skill", webSearchP: "Navigate to Skills → New Skill:",
          sheetsH2: "Create a Google Sheets integration",
          sheetsCallout: "Google OAuth requires setting up a project in Google Cloud Console and downloading credentials.json. See the Google integration guide for details.",
          customH2: "Custom JavaScript skill",
        },
        "api-staff": { h1: "Staff API", p1: "Base URL: http://localhost:8000/api/v1", endpointsH2: "Endpoints", createH2: "Create staff" },
        "api-skills": { h1: "Skills API", presetsH2: "Get tool presets" },
        "api-departments": { h1: "Departments API" },
        "api-tasks": { h1: "Tasks API" },
        "api-chat": { h1: "Chat API", p1: "Test individual staff directly without creating a full task." },
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
      badge: "Nền tảng AI đa nhân sự",
      heroTitle: "Xây dựng phòng ban nhân sự AI cùng nhau làm việc",
      heroSub: "Điều phối các nhân sự AI chuyên biệt — nhà nghiên cứu, nhà phát triển, người kiểm duyệt — để cộng tác và hoàn thành các nhiệm vụ phức tạp tự động.",
      heroBullets: ["Hơn 40 mẫu vai trò nhân sự tích hợp", "Hệ thống kỹ năng với 10+ tích hợp", "Trực quan hóa đồ thị nhiệm vụ thời gian thực", "Tự lưu trữ & giấy phép MIT"],
      loginTab: "Đăng nhập",
      registerTab: "Đăng ký",
      loginTitle: "Chào mừng trở lại",
      loginSubtitle: "Đăng nhập để tiếp tục sử dụng AI Collective",
      registerTitle: "Tạo tài khoản",
      registerSubtitle: "Bắt đầu xây dựng phòng ban nhân sự AI của bạn",
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
      sessionExpiredTitle: "Phiên đăng nhập đã hết hạn",
      sessionExpiredDesc: "Vui lòng đăng nhập lại để tiếp tục.",
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
      label: "Điều hướng", dashboard: "Tổng quan Công ty", staff: "Nhân sự",
      skills: "Nghiệp vụ & Công cụ", departments: "Phòng ban", tasks: "Bảng Công việc", projects: "Dự án",
      meetings: "Cuộc họp", analytics: "Hiệu suất & Chi phí", playground: "Khu thử nghiệm", companies: "Quản lý Công ty",
      officeBuilder: "AI Thiết kế Công ty",
      virtualOffice: "Sơ đồ Văn phòng",
      recruiting: "Tuyển dụng",
      documentLibrary: "Tài liệu",
      platform: "Nền tảng",
      settings: "Cài đặt",
      overviewGroup: "Tổng quan",
      companiesGroup: "Công ty",
      catalogGroup: "Danh mục",
      operationsGroup: "Vận hành",
      orgGroup: "Tổ chức",
      officeGroup: "Văn phòng",
      devGroup: "Thiết lập Hệ thống",
      systemGroup: "Công cụ",
      integrationsGroup: "Kết nối",
      adminGroup: "Quản trị",
      monitoring: "Giám sát hệ thống",
      consumption: "Sử dụng & Chi phí",
      manageCompanies: "Quản lý Công ty",
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
        sub: "Xây dựng các phòng ban nhân sự chuyên biệt — mỗi người có vai trò, kỹ năng và bộ nhớ riêng. Giao nhiệm vụ, theo dõi sự cộng tác, nhận kết quả sẵn sàng triển khai.",
        cta1: "Bắt đầu", cta2: "Đọc tài liệu",
      },
      features: {
        label: "Bao gồm những gì",
        title: "Tất cả những gì bạn cần để xây dựng\nluồng công việc AI",
        items: [
          { title: "Kiến trúc đa nhân sự", desc: "Các nhân sự chuyên biệt với vai trò riêng — PM, Nghiên cứu, Phát triển, Kiểm duyệt — mỗi người có một system prompt tập trung." },
          { title: "Hệ thống kỹ năng", desc: "Gắn công cụ và tích hợp cho bất kỳ nhân sự nào: tìm kiếm web, Google Sheets, thực thi mã, REST API, tự động hóa trình duyệt." },
          { title: "Chế độ thực thi phòng ban", desc: "Mesh, sequential, ring, supervisor, tree hoặc định tuyến tùy chỉnh hoàn toàn — cấu hình chế độ thực thi theo từng phòng ban." },
          { title: "Đồ thị nhiệm vụ thời gian thực", desc: "Trực quan hóa SVG về tương tác nhân sự với pan & zoom. Xem nhân sự làm việc theo thời gian thực." },
          { title: "Được hỗ trợ bởi LangGraph", desc: "Lớp điều phối được xây dựng trên LangGraph — đã được kiểm chứng, có thể kết hợp và sẵn sàng cho sản xuất." },
          { title: "Tự lưu trữ & MIT", desc: "Toàn quyền kiểm soát dữ liệu và hạ tầng của bạn. Không bị ràng buộc nhà cung cấp. Triển khai trên bất kỳ cloud nào hoặc on-premise." },
        ],
      },
      modular: {
        label: "Thiết kế theo mô-đun",
        title: "Kết hợp nhân sự,\nkỹ năng và phòng ban",
        desc: "Mỗi nhân sự là một đơn vị có thể cấu hình. Gán bất kỳ kết hợp kỹ năng nào — tìm kiếm web, thực thi mã, tích hợp Google, API tùy chỉnh — và kết hợp chúng thành các phòng ban với một cấu hình duy nhất.",
        bullets: ["Hơn 40 mẫu vai trò nhân sự tích hợp", "Hơn 10 tích hợp sẵn có", "Hỗ trợ kỹ năng JavaScript tùy chỉnh", "REST API để kiểm soát lập trình"],
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
        badge: "Giới thiệu AI Collective", h1: "Xây dựng và vận hành công ty do AI điều hành",
        sub: "AI Collective cho phép bạn tạo và quản lý các công ty do AI điều hành — thuộc bất kỳ loại hình nào, từ startup công nghệ, agency marketing đến phòng nghiên cứu — mỗi công ty có nhân sự và phòng ban riêng, với toàn quyền kiểm soát topo, công cụ và môi trường thực thi.",
        productsLabel: "Sản phẩm", productsTitle: "Hai cách triển khai",
        product1Name: "AI Collective", product1Desc: "Nền tảng đầy đủ — xây dựng, cấu hình và giám sát các phòng ban đa nhân sự qua dashboard và REST API.", product1Cta: "Mở bảng điều khiển",
        product2Name: "Staff Mesh", product2Desc: "Lớp điều phối mesh độc lập để tích hợp định tuyến đa nhân sự vào stack hiện có của bạn.", product2Cta: "Xem tài liệu",
        featuresLabel: "Tính năng", featuresTitle: "Tất cả những gì bạn cần để điều phối AI",
        modelsLabel: "Mô hình", modelsTitle: "Hoàn toàn linh hoạt về LLM", modelsSub: "Cấu hình, hoán đổi hoặc định tuyến engine mô hình khi chạy — không cần thay đổi code.",
        ctaTitle: "Sẵn sàng xây dựng?", ctaSub: "Khởi tạo công ty AI đầu tiên của bạn chỉ trong vài phút.", ctaFree: "Bắt đầu miễn phí",
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
        badge: "Giải pháp", h1: "AI Collective cho mọi loại hình công ty", sub: "Từ nguyên mẫu startup đến điều phối cấp doanh nghiệp — xây dựng và vận hành đúng loại công ty AI cho trường hợp sử dụng của bạn.",
        useCasesLabel: "Trường hợp sử dụng", useCasesTitle: "Các công ty xây dựng gì với AI Collective",
        sizeLabel: "Quy mô công ty", sizeTitle: "Phù hợp với quy mô của bạn",
        industriesLabel: "Ngành nghề", industriesTitle: "Được xây dựng cho các lĩnh vực có độ rủi ro cao",
        ctaTitle: "Tìm giải pháp của bạn", ctaSub: "Nói chuyện với đội ngũ của chúng tôi để thiết kế kiến trúc nhân sự phù hợp.",
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
        items: { "what-is": "AI Collective là gì?", architecture: "Kiến trúc", "key-concepts": "Khái niệm chính", quickstart: "Khởi động nhanh", installation: "Cài đặt", configuration: "Cấu hình", staff: "Nhân sự", skills: "Kỹ năng", departments: "Phòng ban", tasks: "Nhiệm vụ", meetings: "Cuộc họp", "guide-first-staff": "Tạo nhân sự đầu tiên", "guide-build-department": "Xây dựng phòng ban", "guide-run-task": "Chạy nhiệm vụ", "guide-skills": "Thêm kỹ năng & API", "api-staff": "API Nhân sự", "api-skills": "API Kỹ năng", "api-departments": "API Phòng ban", "api-tasks": "API Nhiệm vụ", "api-chat": "API Trò chuyện", "deploy-docker": "Docker", "deploy-env": "Biến môi trường", "contributing-guide": "Cách đóng góp", "contributing-dev": "Thiết lập môi trường phát triển" },
      },
      content: {
        "what-is": {
          h1: "AI Collective là gì?",
          p1: "AI Collective là nền tảng mã nguồn mở một phần (source-available) để tạo và quản lý các công ty do AI điều hành — xây dựng các phòng ban gồm nhân sự AI chuyên biệt, cộng tác tự động để hoàn thành các nhiệm vụ phức tạp, giống như một công ty thực thụ.",
          p2: "Thay vì dùng một AI đơn lẻ, AI Collective phân phối công việc cho các nhân sự chuyên biệt: nhân sự Quản lý Dự án lên kế hoạch, nhân sự Nghiên cứu thu thập thông tin, nhân sự Phát triển viết mã, và nhân sự Kiểm duyệt xác thực từng kết quả trước khi bàn giao.",
          callout: "AI Collective tự lưu trữ (self-hosted) và mã nguồn mở một phần, miễn phí cho mục đích phi thương mại/học thuật (xem LICENSE). Bạn có thể chạy cục bộ trong vài phút hoặc triển khai trên bất kỳ nhà cung cấp đám mây nào.",
          keyFeaturesH2: "Tính năng chính",
          features: ["Cộng tác đa nhân sự — nhân sự giao tiếp qua hàng đợi tác vụ hướng sự kiện (mặc định in-memory, RabbitMQ cho triển khai phân tán)", "Vai trò tùy chỉnh — hơn 40 mẫu vai trò từ PM đến Bác sĩ đến Luật sư, hoặc tự định nghĩa", "Hệ thống kỹ năng — gắn tích hợp (Google Sheets, API, duyệt web) cho từng nhân sự", "Chế độ phòng ban — chọn mesh, sequential, ring, supervisor, tree, hoặc tự vẽ luồng custom", "Đồ thị nhiệm vụ thời gian thực — trực quan hóa hoạt động nhân sự với pan & zoom", "Backend LangChain / LangGraph — được hỗ trợ bởi các nguyên thủy điều phối AI đã kiểm chứng", "Stack React + FastAPI — mã nguồn hiện đại với TypeScript và Python"],
          whoForH2: "Dành cho ai?",
          audience: [{ title: "Nhà phát triển", desc: "Xây dựng luồng công việc AI mà không cần quản lý hạ tầng nhân sự phức tạp." }, { title: "Phòng ban", desc: "Tự động hóa nghiên cứu, viết lách, lập trình và quy trình kiểm duyệt với các chuyên gia AI." }, { title: "Nhà nghiên cứu", desc: "Thử nghiệm với các kiến trúc đa nhân sự và chiến lược cộng tác." }],
        },
        architecture: {
          h1: "Kiến trúc",
          p1: "AI Collective được chia thành hai lớp: backend FastAPI chạy các nhân sự AI, và frontend React cung cấp giao diện quản lý trực quan.",
          lifecycleH2: "Vòng đời yêu cầu",
          lifecycleP: "Khi bạn gửi một nhiệm vụ, đây là những gì xảy ra:",
          lifecycle: ["Frontend gửi yêu cầu POST /api/v1/tasks với mô tả nhiệm vụ và phòng ban được giao", "Task Runner khởi tạo đồ thị LangGraph với mỗi nhân sự là một nút", "Các nhân sự nhận thông điệp, xử lý qua nhà cung cấp LLM, và phát sự kiện SSE theo luồng chạy", "Các nhân sự phụ thuộc phản ứng theo topology của phòng ban (ví dụ: PM → Developer)", "Lệnh gọi công cụ của nhân sự (tìm kiếm web, thực thi mã, gọi API) được Skill Executor xử lý", "Đầu ra cuối cùng được phòng ban thu thập và trả về frontend qua SSE/REST"],
        },
        "key-concepts": {
          h1: "Khái niệm chính",
          p1: "Trước khi bắt đầu, đây là năm nguyên thủy tạo nên mọi triển khai AI Collective:",
          concepts: [{ title: "Nhân sự", desc: "Một AI worker với vai trò, cá tính và bộ kỹ năng xác định. Mỗi nhân sự có system prompt và quyền truy cập công cụ riêng." }, { title: "Kỹ năng", desc: "Khả năng bạn gắn cho nhân sự — công cụ tìm kiếm web, tích hợp Google Sheets, hàm JavaScript tùy chỉnh, hoặc lệnh gọi REST API." }, { title: "Phòng ban", desc: "Nhóm nhân sự được đặt tên cộng tác trên các nhiệm vụ. Phòng ban có thể chạy ở chế độ mesh (all-to-all) hoặc sequential (pipeline)." }, { title: "Nhiệm vụ", desc: "Đơn vị công việc được giao cho phòng ban. Nhiệm vụ có vòng đời: pending → in-progress → completed (hoặc paused / stopped)." }, { title: "Cuộc họp", desc: "Lịch sử thông điệp đầy đủ của mọi tương tác nhân sự trong nhiệm vụ. Duyệt và phát lại bất kỳ cuộc họp nào." }],
        },
        quickstart: {
          h1: "Khởi động nhanh", p1: "Chạy AI Collective cục bộ trong dưới 5 phút.",
          callout: "Yêu cầu: Python 3.11+, Node.js 18+, uv, và API key của Google, Anthropic, OpenAI, hoặc OpenRouter.",
          cloneH2: "1. Clone repository", backendH2: "2. Thiết lập backend",
          envH2: "3. Cấu hình môi trường", startBackendH2: "4. Khởi động backend",
          startFrontendH2: "5. Khởi động frontend",
          tipCallout: "Không có proxy Vite — frontend gọi /api/v1 cùng gốc (same-origin) theo mặc định. Khi chạy dev cục bộ với backend ở cổng khác, đặt VITE_API_BASE_URL trỏ đến đó.",
        },
        installation: {
          h1: "Cài đặt", requirementsH2: "Yêu cầu hệ thống",
          tableHeaders: ["Thành phần", "Tối thiểu", "Khuyến nghị"],
          pythonH2: "Phụ thuộc Python", pythonP: "Backend được quản lý bằng pyproject.toml. Các phụ thuộc chính:",
          frontendH2: "Phụ thuộc Frontend", frontendP: "Frontend sử dụng React 18, Vite, shadcn/ui và Tailwind CSS.",
          rabbitH2: "Tùy chọn: RabbitMQ", rabbitP: "Để phát sóng sự kiện đa nhân sự, bạn có thể chạy RabbitMQ cục bộ qua Docker:",
        },
        configuration: {
          h1: "Cấu hình", p1: "Tất cả cấu hình được thực hiện qua biến môi trường trong file .env ở thư mục gốc dự án.",
          apiKeysH2: "API Keys", frontendH2: "Cấu hình Frontend",
          frontendP: "Dev server Vite chạy trên cổng 8080 và mong đợi backend tại localhost:8000. Để thay đổi:",
        },
        staff: {
          h1: "Nhân sự", p1: "Nhân sự là AI worker với vai trò xác định, cá tính được thể hiện qua system prompt, và bộ kỹ năng (công cụ) để hoàn thành công việc.",
          schemaH2: "Schema nhân sự", rolesH2: "Vai trò nhân sự", rolesP: "AI Collective đi kèm với hơn 40 mẫu vai trò tích hợp. Đây là các vai trò phổ biến nhất:",
          callout: "Bạn có thể nhập bất kỳ tên vai trò tùy chỉnh nào — danh sách tích hợp chỉ là gợi ý ban đầu.",
          lifecycleH2: "Vòng đời trạng thái nhân sự", restH2: "Tạo qua REST API",
        },
        skills: {
          h1: "Kỹ năng", p1: "Kỹ năng là khả năng bạn gắn cho nhân sự — có thể là tích hợp API bên thứ ba, công cụ tự động hóa trình duyệt, hàm JavaScript tùy chỉnh, hoặc bất kỳ hành động nào nhân sự có thể gọi.",
          typesH2: "Loại kỹ năng",
          types: [{ desc: "Kết nối với các dịch vụ bên ngoài: Google Sheets, Slack, Notion, Airtable, REST API, và nhiều hơn nữa." }, { desc: "Viết mã JavaScript tùy chỉnh chạy phía server. Phù hợp cho chuyển đổi dữ liệu hoặc logic nghiệp vụ." }],
          toolsH2: "Công cụ tích hợp sẵn", schemaH2: "Schema kỹ năng",
        },
        departments: {
          h1: "Phòng ban", p1: "Phòng ban là một tập hợp nhân sự được đặt tên cộng tác trên các nhiệm vụ. Phòng ban là đơn vị thực thi — bạn giao nhiệm vụ cho phòng ban, không phải nhân sự riêng lẻ.",
          modesH2: "Chế độ phòng ban",
          mesh: { title: "Chế độ Mesh", desc: "Tất cả nhân sự có thể giao tiếp với nhau. Tốt nhất cho các nhiệm vụ sáng tạo hoặc nghiên cứu nơi các nhân sự cần tranh luận và tinh chỉnh ý tưởng cùng nhau." },
          sequential: { title: "Chế độ Tuần tự", desc: "Các nhân sự chạy theo thứ tự pipeline xác định. Tốt nhất cho các luồng công việc có cấu trúc: Nghiên cứu → Viết → Kiểm duyệt → Xuất bản." },
          ring: { title: "Chế độ Vòng tròn", desc: "Nhân sự luân phiên xử lý và chuyển tiếp kết quả theo vòng trong một số vòng cố định, mỗi lượt xây dựng trên kết quả trước đó. Phù hợp cho tranh luận nhiều vòng hoặc soạn thảo lặp lại." },
          supervisor: { title: "Chế độ Quản lý", desc: "Một nhân sự trưởng nhóm phân công việc cho các nhân sự còn lại và có thể sinh thêm subagent giới hạn khi cần. Phù hợp cho công việc mở cần chia nhỏ nhiệm vụ linh hoạt." },
          tree: { title: "Chế độ Phân cấp", desc: "Một nhân sự quản lý phân công theo các nhánh phân cấp cho nhân sự khác, có thể tiếp tục phân công sâu hơn. Phù hợp cho công việc tự nhiên chia thành các nhiệm vụ con lồng nhau." },
          custom: { title: "Chế độ Tùy chỉnh", desc: "Bạn tự vẽ luồng định tuyến giữa các nhân sự dưới dạng đồ thị. Dùng khi không chế độ có sẵn nào phù hợp với quy trình của bạn." },
          schemaH2: "Schema phòng ban",
        },
        tasks: {
          h1: "Nhiệm vụ", p1: "Nhiệm vụ là đơn vị công việc bạn gửi cho phòng ban. Nó có tiêu đề, mô tả, và vòng đời tiến từ pending đến completed.",
          lifecycleH2: "Vòng đời nhiệm vụ", schemaH2: "Schema nhiệm vụ",
          graphH2: "Trực quan hóa đồ thị nhiệm vụ", graphP: "Trang Task Manager hiển thị đồ thị SVG thời gian thực về tương tác nhân sự. Mỗi nút là một nhân sự, và các cạnh hiển thị luồng thông điệp giữa chúng. Bạn có thể pan và zoom để khám phá các mạng nhân sự lớn.",
          graphCallout: "Đồ thị sử dụng bố cục lực hướng được hỗ trợ bởi renderer SVG tùy chỉnh — không cần thư viện đồ thị bên thứ ba.",
        },
        meetings: {
          h1: "Cuộc họp", p1: "Mọi thông điệp được trao đổi giữa các nhân sự trong quá trình thực hiện nhiệm vụ đều được ghi lại như một cuộc họp. Trang Cuộc họp cho phép bạn duyệt, lọc và phát lại tất cả giao tiếp của nhân sự.",
          formatH2: "Định dạng thông điệp", filterH2: "Lọc",
          filterP: "Lọc cuộc họp theo tên nhân sự, vai trò, nhiệm vụ hoặc khoảng thời gian. Thông điệp hỗ trợ tìm kiếm toàn văn và được hiển thị với định dạng Markdown.",
        },
        "guide-first-staff": {
          h1: "Tạo nhân sự đầu tiên", p1: "Hướng dẫn này giúp bạn tạo một Research Staff từ đầu bằng giao diện người dùng.",
          step1H2: "Bước 1: Mở Staff Builder", step1P: "Điều hướng đến Nhân sự trong thanh bên, sau đó nhấp Nhân sự mới ở trên cùng bên phải.",
          step2H2: "Bước 2: Điền thông tin chi tiết",
          step3H2: "Bước 3: Chọn avatar", step3P: "Chọn chế độ icon và chọn icon search. Chọn màu nền teal để phù hợp với vai trò Research Staff.",
          step4H2: "Bước 4: Gán kỹ năng", step4P: "Chọn kỹ năng Web Search và Web Scrape từ panel kỹ năng. Nếu chưa có kỹ năng, hãy vào trang Kỹ năng trước.",
          step5H2: "Bước 5: Lưu", step5P: "Nhấp Tạo nhân sự. Alice sẽ xuất hiện trong danh sách nhân sự với trạng thái idle.",
          callout: "Thử ngay Alice bằng cách nhấp nút Thử nghiệm trên thẻ của cô ấy và nhập câu hỏi nghiên cứu.",
        },
        "guide-build-department": {
          h1: "Xây dựng phòng ban", p1: "Phòng ban kết hợp nhiều nhân sự thành một đơn vị cộng tác. Hãy xây dựng phòng ban nghiên cứu & viết lách.",
          compositionH2: "Thành phần phòng ban được khuyến nghị",
          departmentRoles: [{ role: "Project Manager", purpose: "Phối hợp phân công nhiệm vụ và ủy quyền cho các nhân sự khác" }, { role: "Research Staff", purpose: "Thu thập thông tin từ web và tổng hợp kết quả" }, { role: "Developer Staff", purpose: "Viết mã hoặc tài liệu kỹ thuật" }, { role: "Reviewer Staff", purpose: "Xác thực tất cả đầu ra trước khi bàn giao" }],
          createH2: "Tạo phòng ban", createP: "Vào Phòng ban → Phòng ban mới, thêm tất cả bốn nhân sự theo thứ tự, chọn chế độ phù hợp (mesh cho các nhiệm vụ cộng tác mở, hoặc ring/supervisor/tree/sequential/custom tùy quy trình), sau đó lưu.",
        },
        "guide-run-task": {
          h1: "Chạy nhiệm vụ", p1: "Với phòng ban đã được xây dựng, hãy gửi nhiệm vụ đầu tiên của bạn.",
          uiH2: "Qua giao diện người dùng", uiP: "Điều hướng đến Nhiệm vụ → Nhiệm vụ mới, điền tiêu đề và mô tả, gán phòng ban của bạn, và nhấp Tạo nhiệm vụ. Nhiệm vụ sẽ chuyển sang trạng thái in-progress và bạn có thể xem đồ thị nhân sự hoạt động theo thời gian thực.",
          restH2: "Qua REST API", monitorH2: "Theo dõi tiến độ", monitorP: "Poll endpoint trạng thái nhiệm vụ, hoặc xem đồ thị trực tiếp trong giao diện Nhiệm vụ:",
        },
        "guide-skills": {
          h1: "Thêm kỹ năng & API", p1: "Kỹ năng mở rộng những gì nhân sự có thể làm. Đây là cách thêm kỹ năng tìm kiếm web.",
          webSearchH2: "Tạo kỹ năng tìm kiếm web", webSearchP: "Điều hướng đến Kỹ năng → Kỹ năng mới:",
          sheetsH2: "Tạo tích hợp Google Sheets",
          sheetsCallout: "Google OAuth yêu cầu thiết lập dự án trong Google Cloud Console và tải xuống credentials.json. Xem hướng dẫn tích hợp Google để biết chi tiết.",
          customH2: "Kỹ năng JavaScript tùy chỉnh",
        },
        "api-staff": { h1: "API Nhân sự", p1: "URL cơ sở: http://localhost:8000/api/v1", endpointsH2: "Các endpoint", createH2: "Tạo nhân sự" },
        "api-skills": { h1: "API Kỹ năng", presetsH2: "Lấy preset công cụ" },
        "api-departments": { h1: "API Phòng ban" },
        "api-tasks": { h1: "API Nhiệm vụ" },
        "api-chat": { h1: "API Trò chuyện", p1: "Thử nghiệm các nhân sự trực tiếp mà không cần tạo nhiệm vụ đầy đủ." },
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
      badge: "多员工AI平台",
      heroTitle: "构建协同工作的AI员工部门",
      heroSub: "协调专业AI员工——研究员、开发者、审核者——自主协作完成复杂任务。",
      heroBullets: ["40+内置员工角色模板", "10+集成的技能系统", "实时任务图可视化", "自托管 & MIT许可"],
      loginTab: "登录",
      registerTab: "注册",
      loginTitle: "欢迎回来",
      loginSubtitle: "登录以继续使用AI Collective",
      registerTitle: "创建账户",
      registerSubtitle: "开始构建您的AI员工部门",
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
      sessionExpiredTitle: "登录已过期",
      sessionExpiredDesc: "请重新登录以继续。",
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
      label: "导航", dashboard: "公司概览", staff: "员工",
      skills: "业务与工具", departments: "部门", tasks: "任务看板", projects: "项目",
      meetings: "会议", analytics: "绩效与成本", playground: "试验场", companies: "管理公司",
      officeBuilder: "AI 公司设计师",
      virtualOffice: "办公室平面图",
      recruiting: "招聘",
      documentLibrary: "文档",
      platform: "平台",
      settings: "系统设置",
      overviewGroup: "概览",
      companiesGroup: "公司",
      catalogGroup: "目录",
      operationsGroup: "运营",
      orgGroup: "组织",
      officeGroup: "办公室",
      devGroup: "系统设置",
      systemGroup: "工具",
      integrationsGroup: "集成",
      adminGroup: "管理",
      monitoring: "系统监控",
      consumption: "用量与账单",
      manageCompanies: "管理公司",
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
        sub: "构建专业化的员工部门 — 每个成员有各自的角色、技能与记忆。提交任务，观察它们协作，获取可投入生产的成果。",
        cta1: "立即开始", cta2: "阅读文档",
      },
      features: {
        label: "功能一览",
        title: "构建 AI 工作流\n所需的一切",
        items: [
          { title: "多员工架构", desc: "具有不同角色的专业员工 — PM、研究员、开发者、审查员 — 每个都有专注的系统提示词。" },
          { title: "技能系统", desc: "为任意员工附加工具和集成：网络搜索、Google 表格、代码执行、REST API、浏览器自动化。" },
          { title: "部门执行模式", desc: "网状、顺序、环形、主管、树形，或完全自定义的路由方式——按部门配置执行模式。" },
          { title: "实时任务图", desc: "支持平移缩放的员工交互 SVG 可视化。实时观察员工工作。" },
          { title: "LangGraph 驱动", desc: "编排层构建于 LangGraph 之上 — 经过实战检验、可组合、生产就绪。" },
          { title: "自托管 & MIT", desc: "完全掌控您的数据和基础设施。无供应商锁定。部署在任何云端或本地。" },
        ],
      },
      modular: {
        label: "模块化设计",
        title: "组合员工、\n技能与部门",
        desc: "每个员工都是可配置的单元。分配任意技能组合 — 网络搜索、代码执行、Google 集成、自定义 API — 通过单一配置将它们组合成部门。",
        bullets: ["40+ 内置员工角色模板", "10+ 开箱即用的集成", "支持自定义 JavaScript 技能", "可编程控制的 REST API"],
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
        badge: "认识 AI Collective", h1: "创建并运营由 AI 驱动的公司",
        sub: "AI Collective 让您创建并管理由 AI 驱动的公司——涵盖软件初创公司、营销代理、研究实验室等任意类型——每家公司都拥有自己的部门与员工，并可完全控制拓扑、工具和执行环境。",
        productsLabel: "产品", productsTitle: "两种部署方式",
        product1Name: "AI Collective", product1Desc: "完整平台——通过仪表盘和 REST API 构建、配置和监控多员工部门。", product1Cta: "打开控制台",
        product2Name: "Staff Mesh", product2Desc: "独立的 Mesh 编排层，用于将多员工路由集成到现有技术栈中。", product2Cta: "阅读文档",
        featuresLabel: "功能", featuresTitle: "编排 AI 所需的一切",
        modelsLabel: "模型", modelsTitle: "完全 LLM 无关", modelsSub: "在运行时配置、交换或路由模型引擎——无需更改代码。",
        ctaTitle: "准备好构建了吗？", ctaSub: "几分钟内创建您的第一家 AI 公司。", ctaFree: "免费开始构建",
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
        badge: "解决方案", h1: "适合各类公司的 AI Collective", sub: "从初创原型到企业级编排——为您的用例构建并运营合适类型的 AI 公司。",
        useCasesLabel: "使用场景", useCasesTitle: "公司用 AI Collective 构建什么",
        sizeLabel: "公司规模", sizeTitle: "适合您的规模",
        industriesLabel: "行业", industriesTitle: "专为高风险领域打造",
        ctaTitle: "找到您的解决方案", ctaSub: "与我们的团队交流，为您的组织设计合适的员工架构。",
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
        items: { "what-is": "什么是 AI Collective？", architecture: "架构", "key-concepts": "关键概念", quickstart: "快速开始", installation: "安装", configuration: "配置", staff: "员工", skills: "技能", departments: "部门", tasks: "任务", meetings: "会议", "guide-first-staff": "创建第一个员工", "guide-build-department": "构建部门", "guide-run-task": "运行任务", "guide-skills": "添加技能与 API", "api-staff": "员工 API", "api-skills": "技能 API", "api-departments": "部门 API", "api-tasks": "任务 API", "api-chat": "聊天 API", "deploy-docker": "Docker", "deploy-env": "环境变量", "contributing-guide": "如何贡献", "contributing-dev": "开发环境配置" },
      },
      content: {
        "what-is": {
          h1: "什么是 AI Collective？",
          p1: "AI Collective 是一个源码开放（source-available）的平台，用于创建和管理由 AI 驱动的公司——构建由专业化 AI 员工组成的部门，自主协作完成复杂任务，就像一家真实的公司一样。",
          p2: "AI Collective 不使用单一的整体 AI，而是将工作分配给专业构建的员工：负责规划的项目经理员工、负责收集信息的研究员工、负责编写代码的开发员工，以及在交付前验证每个输出的审查员工。",
          callout: "AI Collective 可自托管，源码开放，免费用于非商业/学术用途（详见 LICENSE）。您可以在几分钟内本地运行，或部署到任何云服务商。",
          keyFeaturesH2: "主要功能",
          features: ["多员工协作 — 员工通过事件驱动的任务队列进行通信（默认内存队列，分布式部署可用 RabbitMQ）", "可自定义角色 — 40+ 内置角色模板，从 PM 到医生到律师，或自定义定义", "技能系统 — 为各个员工附加集成（Google 表格、API、网页浏览）", "部门模式 — 在 mesh、sequential、ring、supervisor、tree 或自定义流程图之间选择", "实时任务图 — 用平移缩放图视图可视化员工活动", "LangChain/LangGraph 后端 — 由久经考验的 AI 编排原语驱动", "React + FastAPI 技术栈 — 使用 TypeScript 和 Python 的现代可维护代码库"],
          whoForH2: "适合哪些人？",
          audience: [{ title: "开发者", desc: "构建 AI 驱动的工作流，无需管理复杂的员工基础设施。" }, { title: "部门", desc: "使用 AI 专家自动化研究、写作、编码和审查流水线。" }, { title: "研究人员", desc: "试验多员工架构和协作策略。" }],
        },
        architecture: {
          h1: "架构",
          p1: "AI Collective 分为两层：运行 AI 员工的 FastAPI 后端，以及提供可视化管理界面的 React 前端。",
          lifecycleH2: "请求生命周期",
          lifecycleP: "当您提交任务时，会发生以下情况：",
          lifecycle: ["前端发送带有任务描述和分配部门的 POST /api/v1/tasks 请求", "Task Runner 以每个员工为节点启动 LangGraph 图", "员工接收消息，通过 LLM 提供商处理，并通过运行流发出 SSE 事件", "下游员工根据部门的拓扑结构响应上游输出（例如 PM → Developer）", "员工的工具调用（网络搜索、代码执行、API 调用）由 Skill Executor 处理", "最终输出由部门收集并通过 SSE/REST 返回前端"],
        },
        "key-concepts": {
          h1: "关键概念",
          p1: "在深入了解之前，这里是构成每个 AI Collective 部署的五个基本要素：",
          concepts: [{ title: "员工", desc: "具有定义角色、个性和技能集的 AI 工作者。每个员工有自己的系统提示和工具访问权限。" }, { title: "技能", desc: "您附加到员工的能力 — 网络搜索工具、Google 表格集成、自定义 JavaScript 函数或 REST API 调用。" }, { title: "部门", desc: "协作完成任务的命名员工组。部门可以在网状模式（全对全）或顺序模式（流水线）下运行。" }, { title: "任务", desc: "分配给部门的工作单元。任务有生命周期：待处理 → 进行中 → 已完成（或暂停/停止）。" }, { title: "会议", desc: "任务期间每次员工交互的完整消息历史。浏览和重放任何会议。" }],
        },
        quickstart: {
          h1: "快速开始", p1: "在 5 分钟内本地运行 AI Collective。",
          callout: "前提条件：Python 3.11+、Node.js 18+、uv，以及 Google、Anthropic、OpenAI 或 OpenRouter 的 API 密钥。",
          cloneH2: "1. 克隆仓库", backendH2: "2. 配置后端",
          envH2: "3. 配置环境", startBackendH2: "4. 启动后端",
          startFrontendH2: "5. 启动前端",
          tipCallout: "没有配置 Vite 代理 — 前端默认调用同源的 /api/v1。若本地开发时后端在不同端口，请设置 VITE_API_BASE_URL 指向它。",
        },
        installation: {
          h1: "安装", requirementsH2: "系统要求",
          tableHeaders: ["组件", "最低要求", "推荐"],
          pythonH2: "Python 依赖", pythonP: "后端使用 pyproject.toml 管理。主要依赖：",
          frontendH2: "前端依赖", frontendP: "前端使用 React 18、Vite、shadcn/ui 和 Tailwind CSS。",
          rabbitH2: "可选：RabbitMQ", rabbitP: "对于多员工事件广播，您可以通过 Docker 在本地运行 RabbitMQ：",
        },
        configuration: {
          h1: "配置", p1: "所有配置通过项目根目录中 .env 文件的环境变量完成。",
          apiKeysH2: "API 密钥", frontendH2: "前端配置",
          frontendP: "Vite 开发服务器运行在 8080 端口，期望后端在 localhost:8000。若需更改：",
        },
        staff: {
          h1: "员工", p1: "员工是具有定义角色、通过系统提示表达的个性，以及用于完成工作的技能（工具）集的 AI 工作者。",
          schemaH2: "员工 Schema", rolesH2: "员工角色", rolesP: "AI Collective 内置 40+ 角色模板。以下是最常用的：",
          callout: "您可以输入任何自定义角色名称 — 内置列表只是起始建议。",
          lifecycleH2: "员工状态生命周期", restH2: "通过 REST API 创建",
        },
        skills: {
          h1: "技能", p1: "技能是您附加到员工的能力 — 可以是第三方 API 集成、浏览器自动化工具、自定义 JavaScript 函数，或员工可以调用的任何其他操作。",
          typesH2: "技能类型",
          types: [{ desc: "连接到外部服务：Google 表格、Slack、Notion、Airtable、REST API 等。" }, { desc: "编写在服务器端运行的自定义 JavaScript 代码。非常适合数据转换或业务逻辑。" }],
          toolsH2: "可用内置工具", schemaH2: "技能 Schema",
        },
        departments: {
          h1: "部门", p1: "部门是协作完成任务的命名员工组。部门是执行单元 — 您将任务分配给部门，而不是单个员工。",
          modesH2: "部门模式",
          mesh: { title: "网状模式", desc: "所有员工可以相互通信。最适合需要员工共同讨论和完善想法的创意或研究任务。" },
          sequential: { title: "顺序模式", desc: "员工按照定义的流水线顺序运行。最适合结构化工作流：研究 → 撰写 → 审查 → 发布。" },
          ring: { title: "环形模式", desc: "员工按固定轮数循环处理并传递结果，每一轮都建立在上一轮的输出之上。适合多轮辩论或迭代式草拟。" },
          supervisor: { title: "主管模式", desc: "一名主管员工将子任务分配给其余员工，并可按需动态生成受限的子智能体。适合需要灵活拆解任务的开放式工作。" },
          tree: { title: "树形模式", desc: "一名管理者员工沿层级分支委派给其他员工，其他员工也可继续向下委派。适合天然可拆分为嵌套子任务的工作。" },
          custom: { title: "自定义模式", desc: "您以流程图的形式自行绘制员工之间的路由。当内置模式都不适合您的工作流程时使用。" },
          schemaH2: "部门 Schema",
        },
        tasks: {
          h1: "任务", p1: "任务是您提交给部门的工作单元。它有标题、描述，以及从待处理到完成的生命周期。",
          lifecycleH2: "任务生命周期", schemaH2: "任务 Schema",
          graphH2: "任务图可视化", graphP: "任务管理器页面显示员工交互的实时 SVG 图。每个节点是一个员工，边显示它们之间的消息流。您可以平移和缩放以探索大型员工网络。",
          graphCallout: "该图使用由自定义 SVG 渲染器驱动的力导向布局 — 无需第三方图库。",
        },
        meetings: {
          h1: "会议", p1: "任务期间员工之间交换的每条消息都被记录为一场会议。会议页面让您浏览、过滤和重放所有员工通信。",
          formatH2: "消息格式", filterH2: "过滤",
          filterP: "按员工名称、角色、任务或日期范围过滤会议。消息支持全文搜索并以 Markdown 格式渲染。",
        },
        "guide-first-staff": {
          h1: "创建第一个员工", p1: "本指南带您从头使用 UI 创建一个研究员工。",
          step1H2: "第 1 步：打开员工构建器", step1P: "在侧边栏导航到员工，然后点击右上角的新建员工。",
          step2H2: "第 2 步：填写详细信息",
          step3H2: "第 3 步：选择头像", step3P: "选择图标模式并选择搜索图标。选择青色背景以匹配研究员工角色。",
          step4H2: "第 4 步：分配技能", step4P: "从技能面板勾选网络搜索和网络抓取技能。如果还没有技能，请先前往技能页面。",
          step5H2: "第 5 步：保存", step5P: "点击创建员工。Alice 现在将以 idle 状态出现在您的员工列表中。",
          callout: "通过点击 Alice 卡片上的测试按钮并输入研究问题来立即测试 Alice。",
        },
        "guide-build-department": {
          h1: "构建部门", p1: "部门将多个员工组合成一个协作单元。让我们构建一个研究与写作部门。",
          compositionH2: "推荐的部门构成",
          departmentRoles: [{ role: "项目经理", purpose: "协调任务分解并委派给其他员工" }, { role: "研究员工", purpose: "从网络收集信息并综合研究发现" }, { role: "开发员工", purpose: "编写代码或技术文档" }, { role: "审查员工", purpose: "在交付前验证所有输出" }],
          createH2: "创建部门", createP: "前往部门 → 新建部门，按顺序添加所有四个员工，为协作任务选择合适的模式（网状适合开放协作，或根据流程选择环形/主管/树形/顺序/自定义），然后保存。",
        },
        "guide-run-task": {
          h1: "运行任务", p1: "部门构建完成后，提交您的第一个任务。",
          uiH2: "通过 UI", uiP: "导航到任务 → 新建任务，填写标题和描述，分配您的部门，然后点击创建任务。任务将进入进行中状态，您可以实时观察员工图的动画。",
          restH2: "通过 REST API", monitorH2: "监控进度", monitorP: "轮询任务状态端点，或在任务 UI 中观看实时图：",
        },
        "guide-skills": {
          h1: "添加技能与 API", p1: "技能扩展了员工可以做的事情。以下是如何添加网络搜索技能。",
          webSearchH2: "创建网络搜索技能", webSearchP: "导航到技能 → 新建技能：",
          sheetsH2: "创建 Google 表格集成",
          sheetsCallout: "Google OAuth 需要在 Google Cloud Console 中设置项目并下载 credentials.json。详情请参阅 Google 集成指南。",
          customH2: "自定义 JavaScript 技能",
        },
        "api-staff": { h1: "员工 API", p1: "基础 URL：http://localhost:8000/api/v1", endpointsH2: "端点", createH2: "创建员工" },
        "api-skills": { h1: "技能 API", presetsH2: "获取工具预设" },
        "api-departments": { h1: "部门 API" },
        "api-tasks": { h1: "任务 API" },
        "api-chat": { h1: "聊天 API", p1: "无需创建完整任务即可直接测试单个员工。" },
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
      badge: "マルチスタッフAIプラットフォーム",
      heroTitle: "協調して動くAIスタッフの部門を構築",
      heroSub: "研究者・開発者・レビュアーなど専門AIスタッフを調整し、複雑なタスクを自律的に完成させます。",
      heroBullets: ["40以上のスタッフロールテンプレート", "10以上の統合スキルシステム", "リアルタイムタスクグラフ可視化", "セルフホスト & MITライセンス"],
      loginTab: "ログイン",
      registerTab: "登録",
      loginTitle: "おかえりなさい",
      loginSubtitle: "AI Collectiveにサインインして続ける",
      registerTitle: "アカウント作成",
      registerSubtitle: "AIスタッフ部門の構築を始める",
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
      sessionExpiredTitle: "セッションの有効期限が切れました",
      sessionExpiredDesc: "続けるには再度サインインしてください。",
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
      label: "ナビゲーション", dashboard: "会社概要", staff: "スタッフ",
      skills: "業務とツール", departments: "部門", tasks: "タスクボード", projects: "プロジェクト",
      meetings: "ミーティング", analytics: "実績とコスト", playground: "プレイグラウンド", companies: "会社管理",
      officeBuilder: "AI 会社デザイナー",
      virtualOffice: "オフィス図面",
      recruiting: "採用",
      documentLibrary: "ドキュメント",
      platform: "プラットフォーム",
      settings: "システム設定",
      overviewGroup: "概要",
      companiesGroup: "会社",
      catalogGroup: "カタログ",
      operationsGroup: "オペレーション",
      orgGroup: "組織",
      officeGroup: "オフィス",
      devGroup: "システム設定",
      systemGroup: "ツール",
      integrationsGroup: "連携",
      adminGroup: "管理",
      monitoring: "システム監視",
      consumption: "使用量と請求",
      manageCompanies: "会社管理",
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
        sub: "専門化されたスタッフ部門を構築しましょう — それぞれに役割、スキル、メモリがあります。タスクを送信し、連携を見守り、本番対応の成果を受け取りましょう。",
        cta1: "始める", cta2: "ドキュメントを読む",
      },
      features: {
        label: "含まれる機能",
        title: "AI ワークフロー構築に\n必要なすべて",
        items: [
          { title: "マルチスタッフアーキテクチャ", desc: "異なる役割を持つ専門スタッフ — PM、研究者、開発者、レビュアー — それぞれに専用のシステムプロンプト。" },
          { title: "スキルシステム", desc: "任意のスタッフにツールと統合を付加：ウェブ検索、Google スプレッドシート、コード実行、REST API、ブラウザ自動化。" },
          { title: "部門実行モード", desc: "メッシュ、シーケンシャル、リング、スーパーバイザー、ツリー、または完全カスタムのルーティング — 部門ごとに実行モードを設定。" },
          { title: "リアルタイムタスクグラフ", desc: "パン＆ズーム対応のスタッフ連携 SVG 可視化。スタッフのリアルタイム動作を観察。" },
          { title: "LangGraph 搭載", desc: "オーケストレーション層は LangGraph 上に構築 — 実績があり、組み合わせ可能で、本番対応。" },
          { title: "セルフホスト & MIT", desc: "データとインフラの完全なコントロール。ベンダーロックインなし。任意のクラウドまたはオンプレミスに展開。" },
        ],
      },
      modular: {
        label: "モジュラー設計",
        title: "スタッフ、スキル、\n部門を組み合わせる",
        desc: "すべてのスタッフは設定可能なユニットです。スキルの任意の組み合わせを割り当て — ウェブ検索、コード実行、Google 統合、カスタム API — 単一の設定で部門に組み込みます。",
        bullets: ["40以上の組み込みスタッフ役割テンプレート", "10以上の標準統合", "カスタム JavaScript スキルサポート", "プログラム制御用 REST API"],
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
        items: { "what-is": "AI Collective とは？", architecture: "アーキテクチャ", "key-concepts": "キーコンセプト", quickstart: "クイックスタート", installation: "インストール", configuration: "設定", staff: "スタッフ", skills: "スキル", departments: "部門", tasks: "タスク", meetings: "ミーティング", "guide-first-staff": "最初のスタッフを作成", "guide-build-department": "部門を構築", "guide-run-task": "タスクを実行", "guide-skills": "スキルと API を追加", "api-staff": "スタッフ API", "api-skills": "スキル API", "api-departments": "部門 API", "api-tasks": "タスク API", "api-chat": "チャット API", "deploy-docker": "Docker", "deploy-env": "環境変数", "contributing-guide": "コントリビューション方法", "contributing-dev": "開発環境のセットアップ" },
      },
      content: {
        "what-is": {
          h1: "AI Collective とは？",
          p1: "AI Collective は、AI が運営する会社を作成・管理するためのソースアベイラブル（source-available）プラットフォームです — 専門化された AI スタッフからなる部門を構築し、複雑なタスクを自律的に協力して完了させます。まるで本物の会社のように。",
          p2: "単一の AI を使う代わりに、AI Collective は目的別に構築されたスタッフに作業を分散します：計画を立てるプロジェクトマネージャースタッフ、情報を収集するリサーチスタッフ、コードを書く開発者スタッフ、そして納品前にすべての出力を検証するレビュアースタッフ。",
          callout: "AI Collective はセルフホスト型で、ソースアベイラブルです。非商用・学術目的では無料で利用できます（詳細は LICENSE を参照）。数分でローカルに起動するか、任意のクラウドプロバイダーにデプロイできます。",
          keyFeaturesH2: "主な機能",
          features: ["マルチスタッフ協力 — スタッフはイベント駆動型タスクキューを通じて通信（デフォルトはインメモリ、分散構成では RabbitMQ）", "カスタマイズ可能な役割 — PM から医師、弁護士まで 40 以上の組み込み役割テンプレート、または独自定義", "スキルシステム — 個々のスタッフに統合（Google スプレッドシート、API、ウェブブラウジング）を付加", "部門モード — mesh、sequential、ring、supervisor、tree、またはカスタムフローグラフから選択", "リアルタイムタスクグラフ — パン＆ズームグラフビューでスタッフの活動を可視化", "LangChain/LangGraph バックエンド — 実績ある AI オーケストレーションプリミティブで動作", "React + FastAPI スタック — TypeScript と Python による現代的で保守性の高いコードベース"],
          whoForH2: "誰のために？",
          audience: [{ title: "開発者", desc: "複雑なスタッフインフラを管理せずに AI 駆動のワークフローを構築。" }, { title: "部門", desc: "AI スペシャリストで研究、執筆、コーディング、レビューパイプラインを自動化。" }, { title: "研究者", desc: "マルチスタッフアーキテクチャと協力戦略を実験。" }],
        },
        architecture: {
          h1: "アーキテクチャ",
          p1: "AI Collective は 2 つのレイヤーに分かれています：AI スタッフを実行する FastAPI バックエンドと、視覚的な管理インターフェースを提供する React フロントエンド。",
          lifecycleH2: "リクエストライフサイクル",
          lifecycleP: "タスクを送信すると、以下のことが起こります：",
          lifecycle: ["フロントエンドがタスクの説明と割り当てられた部門と共に POST /api/v1/tasks リクエストを送信", "Task Runner が各スタッフをノードとした LangGraph グラフを起動", "スタッフはメッセージを受信し、LLM プロバイダー経由で処理し、実行ストリームで SSE イベントを発行", "依存するスタッフが部門のトポロジーに従って上流の出力に反応（例：PM → Developer）", "スタッフのツール呼び出し（ウェブ検索、コード実行、API 呼び出し）は Skill Executor が処理", "最終出力は部門が収集し、SSE/REST 経由でフロントエンドに返送"],
        },
        "key-concepts": {
          h1: "キーコンセプト",
          p1: "始める前に、すべての AI Collective デプロイを構成する 5 つの基本要素を紹介します：",
          concepts: [{ title: "スタッフ", desc: "定義された役割、個性、スキルセットを持つ AI ワーカー。各スタッフには独自のシステムプロンプトとツールアクセスがあります。" }, { title: "スキル", desc: "スタッフに付加する能力 — ウェブ検索ツール、Google スプレッドシート統合、カスタム JavaScript 関数、または REST API 呼び出し。" }, { title: "部門", desc: "タスクで協力する名前付きスタッフのグループ。部門はメッシュモード（全対全）またはシーケンシャルモード（パイプライン）で実行できます。" }, { title: "タスク", desc: "部門に割り当てられた作業単位。タスクにはライフサイクルがあります：保留中 → 進行中 → 完了（または一時停止/停止）。" }, { title: "ミーティング", desc: "タスク中のすべてのスタッフ交流の完全なメッセージ履歴。任意のミーティングを閲覧・再生できます。" }],
        },
        quickstart: {
          h1: "クイックスタート", p1: "5 分以内に AI Collective をローカルで起動します。",
          callout: "前提条件：Python 3.11+、Node.js 18+、uv、そして Google、Anthropic、OpenAI、または OpenRouter の API キー。",
          cloneH2: "1. リポジトリをクローン", backendH2: "2. バックエンドをセットアップ",
          envH2: "3. 環境を設定", startBackendH2: "4. バックエンドを起動",
          startFrontendH2: "5. フロントエンドを起動",
          tipCallout: "Vite のプロキシは設定されていません — フロントエンドはデフォルトで同一オリジンの /api/v1 を呼び出します。バックエンドが別ポートのローカル開発では、VITE_API_BASE_URL でそこを指すよう設定してください。",
        },
        installation: {
          h1: "インストール", requirementsH2: "システム要件",
          tableHeaders: ["コンポーネント", "最低要件", "推奨"],
          pythonH2: "Python 依存関係", pythonP: "バックエンドは pyproject.toml で管理されています。主な依存関係：",
          frontendH2: "フロントエンド依存関係", frontendP: "フロントエンドは React 18、Vite、shadcn/ui、Tailwind CSS を使用。",
          rabbitH2: "オプション：RabbitMQ", rabbitP: "マルチスタッフイベントブロードキャストのために、Docker でローカルに RabbitMQ を実行できます：",
        },
        configuration: {
          h1: "設定", p1: "すべての設定はプロジェクトルートの .env ファイルの環境変数で行います。",
          apiKeysH2: "API キー", frontendH2: "フロントエンド設定",
          frontendP: "Vite 開発サーバーはポート 8080 で動作し、バックエンドが localhost:8000 にあることを期待します。変更するには：",
        },
        staff: {
          h1: "スタッフ", p1: "スタッフは定義された役割、システムプロンプトで表現された個性、そして作業を完了するためのスキル（ツール）セットを持つ AI ワーカーです。",
          schemaH2: "スタッフスキーマ", rolesH2: "スタッフの役割", rolesP: "AI Collective には 40 以上の組み込み役割テンプレートが付属しています。最も一般的なものを紹介します：",
          callout: "任意のカスタム役割名を入力できます — 組み込みリストは出発点の提案にすぎません。",
          lifecycleH2: "スタッフステータスのライフサイクル", restH2: "REST API で作成",
        },
        skills: {
          h1: "スキル", p1: "スキルはスタッフに付加する能力です — サードパーティ API 統合、ブラウザ自動化ツール、カスタム JavaScript 関数、またはスタッフが呼び出せる任意のアクション。",
          typesH2: "スキルの種類",
          types: [{ desc: "外部サービスに接続：Google スプレッドシート、Slack、Notion、Airtable、REST API など。" }, { desc: "サーバーサイドで実行されるカスタム JavaScript コードを記述。データ変換やビジネスロジックに最適。" }],
          toolsH2: "利用可能な組み込みツール", schemaH2: "スキルスキーマ",
        },
        departments: {
          h1: "部門", p1: "部門はタスクで協力する名前付きスタッフのグループです。部門は実行単位 — 個々のスタッフではなく、部門にタスクを割り当てます。",
          modesH2: "部門モード",
          mesh: { title: "メッシュモード", desc: "すべてのスタッフが相互に通信できます。スタッフがアイデアを議論・洗練する必要があるクリエイティブまたはリサーチタスクに最適。" },
          sequential: { title: "シーケンシャルモード", desc: "スタッフは定義されたパイプライン順に実行されます。構造化されたワークフローに最適：リサーチ → 執筆 → レビュー → 公開。" },
          ring: { title: "リングモード", desc: "スタッフは決められた回数だけ順に結果を受け渡し、それぞれが前の出力の上に積み上げます。複数ラウンドの議論や反復的な下書きに最適。" },
          supervisor: { title: "スーパーバイザーモード", desc: "リーダースタッフが残りのスタッフにサブタスクを委任し、必要に応じて制限付きのサブエージェントを動的に生成できます。柔軟なタスク分解が必要なオープンエンドな作業に最適。" },
          tree: { title: "ツリーモード", desc: "マネージャースタッフが階層的な枝に沿って他のスタッフに委任し、さらに委任を続けることもできます。入れ子構造のサブタスクに自然に分かれる作業に最適。" },
          custom: { title: "カスタムモード", desc: "スタッフ間のルーティングをフローグラフとして自分で描きます。組み込みモードが自分のワークフローに合わない場合に使用します。" },
          schemaH2: "部門スキーマ",
        },
        tasks: {
          h1: "タスク", p1: "タスクは部門に送信する作業単位です。タイトル、説明、および保留中から完了まで進むライフサイクルがあります。",
          lifecycleH2: "タスクライフサイクル", schemaH2: "タスクスキーマ",
          graphH2: "タスクグラフの可視化", graphP: "タスクマネージャーページにはスタッフ連携のリアルタイム SVG グラフが表示されます。各ノードはスタッフで、エッジはそれらの間のメッセージフローを示します。パン＆ズームで大規模なスタッフネットワークを探索できます。",
          graphCallout: "グラフはカスタム SVG レンダラーによるフォースダイレクトレイアウトを使用 — サードパーティグラフライブラリ不要。",
        },
        meetings: {
          h1: "ミーティング", p1: "タスク中にスタッフ間で交わされたすべてのメッセージはミーティングとして記録されます。ミーティングページで、すべてのスタッフ通信を閲覧、フィルタリング、再生できます。",
          formatH2: "メッセージフォーマット", filterH2: "フィルタリング",
          filterP: "スタッフ名、役割、タスク、または日付範囲でミーティングをフィルタリング。メッセージは全文検索をサポートし、Markdown 形式でレンダリングされます。",
        },
        "guide-first-staff": {
          h1: "最初のスタッフを作成", p1: "このガイドでは、UI を使用してゼロからリサーチスタッフを作成する方法を説明します。",
          step1H2: "ステップ 1：スタッフビルダーを開く", step1P: "サイドバーのスタッフに移動し、右上の新規スタッフをクリックします。",
          step2H2: "ステップ 2：詳細を入力",
          step3H2: "ステップ 3：アバターを選択", step3P: "アイコンモードを選択し、検索アイコンを選びます。リサーチスタッフの役割に合うティール色の背景を選択します。",
          step4H2: "ステップ 4：スキルを割り当て", step4P: "スキルパネルからウェブ検索とウェブスクレイプスキルにチェックを入れます。スキルがない場合は、まずスキルページに移動してください。",
          step5H2: "ステップ 5：保存", step5P: "スタッフを作成をクリックします。Alice が idle ステータスでスタッフリストに表示されます。",
          callout: "Alice のカードのテストボタンをクリックしてリサーチの質問を入力することで、すぐに Alice をテストできます。",
        },
        "guide-build-department": {
          h1: "部門を構築", p1: "部門は複数のスタッフを協力単位に組み合わせます。リサーチ＆ライティング部門を構築しましょう。",
          compositionH2: "推奨部門構成",
          departmentRoles: [{ role: "プロジェクトマネージャー", purpose: "タスクの分解を調整し、他のスタッフに委任" }, { role: "リサーチスタッフ", purpose: "ウェブから情報を収集し、発見を統合" }, { role: "開発者スタッフ", purpose: "コードまたは技術ドキュメントを作成" }, { role: "レビュアースタッフ", purpose: "納品前にすべての出力を検証" }],
          createH2: "部門を作成", createP: "部門 → 新規部門に移動し、4 人のスタッフを順番に追加し、協力タスクに合ったモードを選択（オープンな協力にはメッシュ、それ以外はリング／スーパーバイザー／ツリー／シーケンシャル／カスタムから業務に合わせて選択）して保存します。",
        },
        "guide-run-task": {
          h1: "タスクを実行", p1: "部門が構築できたら、最初のタスクを送信しましょう。",
          uiH2: "UI 経由", uiP: "タスク → 新規タスクに移動し、タイトルと説明を入力し、部門を割り当て、タスクを作成をクリックします。タスクは進行中ステータスに移行し、スタッフグラフのリアルタイムアニメーションを観察できます。",
          restH2: "REST API 経由", monitorH2: "進捗を監視", monitorP: "タスクステータスエンドポイントをポーリングするか、タスク UI のライブグラフを観察：",
        },
        "guide-skills": {
          h1: "スキルと API を追加", p1: "スキルはスタッフができることを拡張します。ウェブ検索スキルの追加方法を紹介します。",
          webSearchH2: "ウェブ検索スキルを作成", webSearchP: "スキル → 新規スキルに移動：",
          sheetsH2: "Google スプレッドシート統合を作成",
          sheetsCallout: "Google OAuth は Google Cloud Console でプロジェクトを設定し credentials.json をダウンロードする必要があります。詳細は Google 統合ガイドを参照してください。",
          customH2: "カスタム JavaScript スキル",
        },
        "api-staff": { h1: "スタッフ API", p1: "ベース URL：http://localhost:8000/api/v1", endpointsH2: "エンドポイント", createH2: "スタッフを作成" },
        "api-skills": { h1: "スキル API", presetsH2: "ツールプリセットを取得" },
        "api-departments": { h1: "部門 API" },
        "api-tasks": { h1: "タスク API" },
        "api-chat": { h1: "チャット API", p1: "完全なタスクを作成せずに個々のスタッフを直接テストします。" },
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
        badge: "AI Collective を紹介", h1: "AI が運営する会社を構築・運用",
        sub: "AI Collective は、ソフトウェアスタートアップからマーケティングエージェンシー、研究ラボまで、あらゆる種類の AI 運営会社を作成・管理できるプラットフォームです — 各社に部門とスタッフを配置し、トポロジー、ツール、実行環境を完全にコントロールできます。",
        productsLabel: "製品", productsTitle: "2 つの展開方法",
        product1Name: "AI Collective", product1Desc: "完全なプラットフォーム — ダッシュボードと REST API でマルチスタッフ部門を構築・設定・監視。", product1Cta: "コンソールを開く",
        product2Name: "Staff Mesh", product2Desc: "既存のスタックにマルチスタッフルーティングを統合するためのスタンドアロン Mesh 編成レイヤー。", product2Cta: "ドキュメントを読む",
        featuresLabel: "機能", featuresTitle: "AI を編成するために必要なすべて",
        modelsLabel: "モデル", modelsTitle: "完全 LLM 非依存", modelsSub: "実行時にモデルエンジンを設定・交換・ルーティング — コード変更不要。",
        ctaTitle: "構築する準備はできましたか？", ctaSub: "数分で最初の AI 会社を立ち上げましょう。", ctaFree: "無料で構築を始める",
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
        badge: "ソリューション", h1: "あらゆる種類の会社のための AI Collective", sub: "スタートアッププロトタイピングからエンタープライズ級編成まで — ユースケースに適した AI 運営会社を構築・運用。",
        useCasesLabel: "ユースケース", useCasesTitle: "AI Collective で会社が構築するもの",
        sizeLabel: "会社規模", sizeTitle: "あなたの規模に最適",
        industriesLabel: "業界", industriesTitle: "高リスク領域向けに構築",
        ctaTitle: "ソリューションを見つける", ctaSub: "チームと話し合い、組織に適したスタッフアーキテクチャを設計しましょう。",
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
