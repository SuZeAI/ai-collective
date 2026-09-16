import { useState } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, Check, ExternalLink, HelpCircle, Info, Landmark, Layers, ShieldCheck, Mail, ArrowLeft, Search } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { MarketingNav, FadeIn } from "@/components/marketing/MarketingNav";

// Sample industries for dropdown
const INDUSTRIES = [
  "Software",
  "Software - Healthtech",
  "Software - Fintech",
  "Software - Cybersecurity",
  "Financial Services",
  "Healthcare & Life Sciences",
  "Legal Services",
  "Professional Services",
  "Telecommunications",
  "Manufacturing & Industrial",
  "Retail & Consumer Goods",
  "Government & Public Sector",
  "Nonprofit",
  "Education",
  "Other"
];

// Sample HQ locations
const COUNTRIES = [
  "United States",
  "Vietnam",
  "China",
  "Japan",
  "United Kingdom",
  "Canada",
  "Australia",
  "Singapore",
  "Germany",
  "France",
  "Other"
];

// Sample product interests
const PRODUCTS = [
  "AI Collective Platform",
  "Agent Mesh Router",
  "API Integration",
  "Custom Topologies",
  "Air-gapped / On-Premise",
  "Other"
];

export default function ContactSales() {
  const { t, language } = useLanguage();
  const m = t.marketing;

  // Selected inquiry type: 'sales' | 'limits' | 'baa' | 'zdr' | 'support' | ''
  const [inquiryType, setInquiryType] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  // General sales form fields state
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    companyName: "",
    companyWebsite: "",
    jobTitle: "",
    industry: "",
    hq: "",
    interest: "",
    employees: "",
    journey: "",
    message: "",
    source: "",
  });

  // Rate limits form state
  const [rateLimitData, setRateLimitData] = useState({
    email: "",
    modelEngine: "gemini-2.0-flash",
    requestedLimit: "",
    justification: "",
  });

  // Validate form fields before submitting
  const isFormValid = () => {
    if (inquiryType === "sales" || inquiryType === "baa" || inquiryType === "zdr") {
      return (
        formData.firstName.trim() !== "" &&
        formData.lastName.trim() !== "" &&
        formData.email.trim() !== "" &&
        formData.phone.trim() !== "" &&
        formData.companyName.trim() !== "" &&
        formData.companyWebsite.trim() !== "" &&
        formData.jobTitle.trim() !== "" &&
        formData.industry !== "" &&
        formData.hq !== "" &&
        formData.interest !== "" &&
        formData.journey !== "" &&
        formData.message.trim() !== ""
      );
    } else if (inquiryType === "limits") {
      return (
        rateLimitData.email.trim() !== "" &&
        rateLimitData.requestedLimit.trim() !== "" &&
        rateLimitData.justification.trim() !== ""
      );
    }
    return false;
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleRateLimitChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setRateLimitData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isFormValid()) return;

    setIsSubmitting(true);
    // Simulate API request delay
    setTimeout(() => {
      setIsSubmitting(false);
      setIsSubmitted(true);
    }, 1500);
  };

  return (
    <div className="min-h-screen bg-[#faf9f5] dark:bg-[#141413] text-foreground font-sans transition-colors duration-300">
      <MarketingNav />

      <div className="max-w-5xl mx-auto px-6 pt-16 pb-24">
        {/* Back Link */}
        <div className="mb-8">
          <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors group">
            <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition-transform" />
            Back to home
          </Link>
        </div>

        <div className="grid md:grid-cols-12 gap-12 items-start">
          {/* Left Column: Title & Info Cards */}
          <div className="md:col-span-5 space-y-8">
            <FadeIn>
              <h1 className="text-4xl md:text-5xl font-serif font-medium tracking-tight mb-4">
                {m.contactSales.h1}
              </h1>
              <p className="text-muted-foreground leading-relaxed">
                {m.contactSales.sub}
              </p>
            </FadeIn>

            {/* Side Card: Support */}
            <FadeIn delay={0.1}>
              <div className="bg-card border border-border/60 rounded-xl p-6 space-y-4 shadow-sm hover:shadow-md transition-shadow">
                <HelpCircle className="w-5 h-5 text-accent" />
                <div>
                  <h3 className="font-serif font-medium text-lg mb-1">
                    {m.contactSales.supportCardTitle}
                  </h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {m.contactSales.supportCardDesc}
                  </p>
                </div>
                <Link
                  to="/support"
                  className="inline-flex items-center gap-1 text-sm font-semibold text-accent hover:underline"
                >
                  {m.contactSales.supportCardCta}
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </FadeIn>

            {/* Side Card: Quick links */}
            <FadeIn delay={0.15}>
              <div className="bg-muted/30 border border-border/40 rounded-xl p-6 space-y-3">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Direct Contacts</h4>
                <div className="space-y-2.5 text-sm">
                  <div className="flex items-center gap-2">
                    <Mail className="w-4 h-4 text-muted-foreground" />
                    <span className="text-muted-foreground">General inquiries:</span>
                    <a href="mailto:info@aicollective.com" className="font-medium hover:text-accent underline">info@aicollective.com</a>
                  </div>
                  <div className="flex items-center gap-2">
                    <Landmark className="w-4 h-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Sales team:</span>
                    <a href="mailto:sales@aicollective.com" className="font-medium hover:text-accent underline">sales@aicollective.com</a>
                  </div>
                </div>
              </div>
            </FadeIn>
          </div>

          {/* Right Column: Dynamic Form Card */}
          <div className="md:col-span-7">
            <FadeIn delay={0.05}>
              <div className="bg-card border border-border/80 rounded-2xl p-6 md:p-8 shadow-md">
                <AnimatePresence mode="wait">
                  {!isSubmitted ? (
                    <motion.form
                      key="contact-form"
                      onSubmit={handleSubmit}
                      className="space-y-6"
                      initial={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                    >
                      {/* Condition Selection Dropdown */}
                      <div className="space-y-2">
                        <label htmlFor="inquiryType" className="block text-sm font-semibold text-foreground/90">
                          {m.contactSales.formHelpLabel} <span className="text-accent">*</span>
                        </label>
                        <select
                          id="inquiryType"
                          name="inquiryType"
                          value={inquiryType}
                          onChange={(e) => {
                            setInquiryType(e.target.value);
                            setIsSubmitted(false);
                          }}
                          className="flex h-11 w-full items-center justify-between rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
                        >
                          <option value="" disabled>{m.contactSales.formHelpPlaceholder}</option>
                          <option value="sales">{m.contactSales.options.sales}</option>
                          <option value="limits">{m.contactSales.options.limits}</option>
                          <option value="baa">{m.contactSales.options.baa}</option>
                          <option value="zdr">{m.contactSales.options.zdr}</option>
                          <option value="support">{m.contactSales.options.support}</option>
                        </select>
                      </div>

                      <AnimatePresence mode="wait">
                        {/* CONDITIONAL SUBFORMS */}

                        {/* 1. General Sales / BAA / ZDR Form */}
                        {(inquiryType === "sales" || inquiryType === "baa" || inquiryType === "zdr") && (
                          <motion.div
                            key="sales-form-fields"
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            exit={{ opacity: 0, height: 0 }}
                            transition={{ duration: 0.3 }}
                            className="space-y-6 overflow-hidden"
                          >
                            <hr className="border-border/60" />

                            {/* Informational banners for BAA / ZDR */}
                            {inquiryType === "baa" && (
                              <div className="flex gap-2.5 p-3.5 rounded-lg border border-accent/20 bg-accent/5 text-xs leading-relaxed text-accent">
                                <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5" />
                                <div>
                                  <span className="font-semibold">Business Associate Agreement (BAA):</span> We support HIPAA compliance with signed BAAs for enterprise deployments. Please share your architecture requirements below.
                                </div>
                              </div>
                            )}
                            {inquiryType === "zdr" && (
                              <div className="flex gap-2.5 p-3.5 rounded-lg border border-teal-500/20 bg-teal-500/5 text-xs leading-relaxed text-teal-600 dark:text-teal-400">
                                <Layers className="w-4 h-4 shrink-0 mt-0.5" />
                                <div>
                                  <span className="font-semibold">Zero Data Retention (ZDR):</span> For regulated industries, we provide zero-retention logging options on dedicated enterprise clusters. Let us know your compliance standards.
                                </div>
                              </div>
                            )}

                            {/* Name fields */}
                            <div className="grid grid-cols-2 gap-4">
                              <div className="space-y-2">
                                <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                  {m.contactSales.firstName} <span className="text-accent">*</span>
                                </label>
                                <Input
                                  type="text"
                                  name="firstName"
                                  value={formData.firstName}
                                  onChange={handleInputChange}
                                  required
                                  className="h-10"
                                />
                              </div>
                              <div className="space-y-2">
                                <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                  {m.contactSales.lastName} <span className="text-accent">*</span>
                                </label>
                                <Input
                                  type="text"
                                  name="lastName"
                                  value={formData.lastName}
                                  onChange={handleInputChange}
                                  required
                                  className="h-10"
                                />
                              </div>
                            </div>

                            {/* Email & Phone */}
                            <div className="space-y-2">
                              <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                {m.contactSales.email} <span className="text-accent">*</span>
                              </label>
                              <Input
                                type="email"
                                name="email"
                                value={formData.email}
                                onChange={handleInputChange}
                                required
                                className="h-10"
                              />
                              <p className="text-[11px] text-muted-foreground">
                                {m.contactSales.emailHint}
                              </p>
                            </div>

                            <div className="space-y-2">
                              <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                {m.contactSales.phone} <span className="text-accent">*</span>
                              </label>
                              <Input
                                type="tel"
                                name="phone"
                                value={formData.phone}
                                onChange={handleInputChange}
                                required
                                className="h-10"
                              />
                            </div>

                            {/* Company Name & Website */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                              <div className="space-y-2">
                                <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                  {m.contactSales.companyName} <span className="text-accent">*</span>
                                </label>
                                <Input
                                  type="text"
                                  name="companyName"
                                  value={formData.companyName}
                                  onChange={handleInputChange}
                                  required
                                  className="h-10"
                                />
                              </div>
                              <div className="space-y-2">
                                <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                  {m.contactSales.companyWebsite} <span className="text-accent">*</span>
                                </label>
                                <Input
                                  type="text"
                                  name="companyWebsite"
                                  value={formData.companyWebsite}
                                  onChange={handleInputChange}
                                  required
                                  placeholder="example.com"
                                  className="h-10"
                                />
                              </div>
                            </div>

                            {/* Job Title & Industry */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                              <div className="space-y-2">
                                <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                  {m.contactSales.jobTitle} <span className="text-accent">*</span>
                                </label>
                                <Input
                                  type="text"
                                  name="jobTitle"
                                  value={formData.jobTitle}
                                  onChange={handleInputChange}
                                  required
                                  className="h-10"
                                />
                              </div>
                              <div className="space-y-2">
                                <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                  {m.contactSales.industry} <span className="text-accent">*</span>
                                </label>
                                <select
                                  name="industry"
                                  value={formData.industry}
                                  onChange={handleInputChange}
                                  required
                                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent cursor-pointer"
                                >
                                  <option value="" disabled>{m.contactSales.formHelpPlaceholder}</option>
                                  {INDUSTRIES.map((ind) => (
                                    <option key={ind} value={ind}>{ind}</option>
                                  ))}
                                </select>
                              </div>
                            </div>

                            {/* HQ Location & Employee Count */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                              <div className="space-y-2">
                                <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                  {m.contactSales.hq} <span className="text-accent">*</span>
                                </label>
                                <select
                                  name="hq"
                                  value={formData.hq}
                                  onChange={handleInputChange}
                                  required
                                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent cursor-pointer"
                                >
                                  <option value="" disabled>{m.contactSales.formHelpPlaceholder}</option>
                                  {COUNTRIES.map((country) => (
                                    <option key={country} value={country}>{country}</option>
                                  ))}
                                </select>
                              </div>
                              <div className="space-y-2">
                                <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                  {m.contactSales.employees}
                                </label>
                                <select
                                  name="employees"
                                  value={formData.employees}
                                  onChange={handleInputChange}
                                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent cursor-pointer"
                                >
                                  <option value="">{m.contactSales.formHelpPlaceholder}</option>
                                  <option value="1-50">1 - 50</option>
                                  <option value="51-200">51 - 200</option>
                                  <option value="201-500">201 - 500</option>
                                  <option value="501-2500">501 - 2,500</option>
                                  <option value="2501+">2,501+</option>
                                </select>
                              </div>
                            </div>

                            {/* Product Interest & Evaluation Journey */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                              <div className="space-y-2">
                                <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                  {m.contactSales.interest} <span className="text-accent">*</span>
                                </label>
                                <select
                                  name="interest"
                                  value={formData.interest}
                                  onChange={handleInputChange}
                                  required
                                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent cursor-pointer"
                                >
                                  <option value="" disabled>{m.contactSales.formHelpPlaceholder}</option>
                                  {PRODUCTS.map((prod) => (
                                    <option key={prod} value={prod}>{prod}</option>
                                  ))}
                                </select>
                              </div>
                              <div className="space-y-2">
                                <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                  {m.contactSales.journey} <span className="text-accent">*</span>
                                </label>
                                <select
                                  name="journey"
                                  value={formData.journey}
                                  onChange={handleInputChange}
                                  required
                                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent cursor-pointer"
                                >
                                  <option value="" disabled>{m.contactSales.formHelpPlaceholder}</option>
                                  <option value="curious">Just curious for now</option>
                                  <option value="exploring">Actively exploring solutions for deployment</option>
                                  <option value="ready">Know what I want, need sales setup</option>
                                </select>
                              </div>
                            </div>

                            {/* Message / Details */}
                            <div className="space-y-2">
                              <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                {m.contactSales.message} <span className="text-accent">*</span>
                              </label>
                              <Textarea
                                name="message"
                                value={formData.message}
                                onChange={handleInputChange}
                                required
                                rows={4}
                                className="min-h-[100px]"
                              />
                            </div>

                            {/* Referral source */}
                            <div className="space-y-2">
                              <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                {m.contactSales.source}
                              </label>
                              <select
                                name="source"
                                value={formData.source}
                                onChange={handleInputChange}
                                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent cursor-pointer"
                              >
                                <option value="">{m.contactSales.formHelpPlaceholder}</option>
                                <option value="friend">Friend or family</option>
                                <option value="search">Google or search engine</option>
                                <option value="social">Social media</option>
                                <option value="news">News or article</option>
                                <option value="event">Event or conference</option>
                                <option value="other">Other</option>
                              </select>
                            </div>
                          </motion.div>
                        )}

                        {/* 2. Rate Limits Subform */}
                        {inquiryType === "limits" && (
                          <motion.div
                            key="limits-form-fields"
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            exit={{ opacity: 0, height: 0 }}
                            transition={{ duration: 0.3 }}
                            className="space-y-6 overflow-hidden"
                          >
                            <hr className="border-border/60" />

                            <div className="flex gap-2.5 p-3.5 rounded-lg border border-amber-500/20 bg-amber-500/5 text-xs leading-relaxed text-amber-700 dark:text-amber-400">
                              <Info className="w-4 h-4 shrink-0 mt-0.5" />
                              <div>
                                <span className="font-semibold">Tip:</span> Rate limits are enforced on a per-company basis. You can also request limits directly inside the <Link to="/login" className="underline font-semibold">Console Settings</Link> page after logging in.
                              </div>
                            </div>

                            <div className="space-y-2">
                              <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                {m.contactSales.email} <span className="text-accent">*</span>
                              </label>
                              <Input
                                type="email"
                                name="email"
                                value={rateLimitData.email}
                                onChange={handleRateLimitChange}
                                required
                                placeholder="name@company.com"
                                className="h-10"
                              />
                            </div>

                            <div className="space-y-2">
                              <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                Model Engine <span className="text-accent">*</span>
                              </label>
                              <select
                                name="modelEngine"
                                value={rateLimitData.modelEngine}
                                onChange={handleRateLimitChange}
                                required
                                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent cursor-pointer"
                              >
                                <option value="gemini-2.0-flash">Google Gemini 2.0 Flash</option>
                                <option value="claude-3-5-sonnet">Anthropic Claude 3.5 Sonnet</option>
                                <option value="gpt-4o">OpenAI GPT-4o</option>
                                <option value="qwen">Qwen 3.5 (Self-Hosted)</option>
                              </select>
                            </div>

                            <div className="space-y-2">
                              <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                Requested limit increase (e.g. 50 RPM / 200,000 TPM) <span className="text-accent">*</span>
                              </label>
                              <Input
                                type="text"
                                name="requestedLimit"
                                value={rateLimitData.requestedLimit}
                                onChange={handleRateLimitChange}
                                required
                                placeholder="50 requests per minute, 100,000 tokens per minute"
                                className="h-10"
                              />
                            </div>

                            <div className="space-y-2">
                              <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                Business justification and details <span className="text-accent">*</span>
                              </label>
                              <Textarea
                                name="justification"
                                value={rateLimitData.justification}
                                onChange={handleRateLimitChange}
                                required
                                placeholder="Please describe your product integration and estimated call volume..."
                                rows={4}
                              />
                            </div>
                          </motion.div>
                        )}

                        {/* 3. Product Support Subform */}
                        {inquiryType === "support" && (
                          <motion.div
                            key="support-fields"
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            exit={{ opacity: 0, height: 0 }}
                            transition={{ duration: 0.3 }}
                            className="space-y-6 overflow-hidden"
                          >
                            <hr className="border-border/60" />

                            <div className="p-6 border border-border bg-muted/20 rounded-xl space-y-4">
                              <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center">
                                <HelpCircle className="w-5 h-5 text-accent" />
                              </div>
                              <div>
                                <h3 className="font-serif font-semibold text-lg mb-1">
                                  {language === "vi" ? "Tìm câu trả lời tại Trung tâm Hỗ trợ" : "Find Answers in the Support Center"}
                                </h3>
                                <p className="text-sm text-muted-foreground leading-relaxed">
                                  {language === "vi"
                                    ? "Đội ngũ kinh doanh của chúng tôi không thể xử lý các vấn đề kỹ thuật, báo cáo lỗi hoặc yêu cầu thanh toán. Vui lòng truy cập Trung tâm Hỗ trợ của chúng tôi để tra cứu nhanh chóng:"
                                    : "Our sales team is unable to assist with technical issues, bug reports, or billing. Please visit our unified Support Center to find quick self-serve answers:"}
                                </p>
                              </div>

                              <div className="pt-2">
                                <Link
                                  to="/support"
                                  className="flex items-center justify-between p-4 rounded-xl border border-accent/20 bg-accent/5 hover:border-accent/40 hover:bg-accent/10 transition-all text-sm font-semibold group"
                                >
                                  <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-lg bg-accent/15 flex items-center justify-center text-accent">
                                      <Search className="w-4 h-4" />
                                    </div>
                                    <div className="text-left">
                                      <div className="text-sm font-semibold">
                                        {language === "vi" ? "Truy cập trung tâm hỗ trợ" : "Visit support center"}
                                      </div>
                                      <div className="text-[11px] text-muted-foreground font-normal">
                                        {language === "vi" ? "Tìm kiếm bài viết, tài nguyên và hướng dẫn" : "Search articles, resources, and guides"}
                                      </div>
                                    </div>
                                  </div>
                                  <ArrowRight className="w-4 h-4 text-accent group-hover:translate-x-0.5 transition-transform" />
                                </Link>
                              </div>

                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                                <a
                                  href="https://github.com/SuZeAI/ai-collective/issues"
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex items-center justify-between p-3.5 rounded-lg border border-border hover:border-foreground/20 hover:bg-card transition-colors text-sm font-semibold"
                                >
                                  <span>Open GitHub Issue</span>
                                  <ExternalLink className="w-3.5 h-3.5" />
                                </a>
                                <Link
                                  to="/docs"
                                  className="flex items-center justify-between p-3.5 rounded-lg border border-border hover:border-foreground/20 hover:bg-card transition-colors text-sm font-semibold"
                                >
                                  <span>Developer Docs</span>
                                  <ArrowRight className="w-3.5 h-3.5" />
                                </Link>
                              </div>
                              <div className="text-xs text-muted-foreground text-center pt-2">
                                Or email our support team directly at <a href="mailto:support@aicollective.com" className="underline hover:text-foreground font-semibold">support@aicollective.com</a>
                              </div>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>

                      {/* Submit Button */}
                      {inquiryType !== "" && inquiryType !== "support" && (
                        <div className="pt-2">
                          <button
                            type="submit"
                            disabled={isSubmitting || !isFormValid()}
                            className="w-full inline-flex h-11 items-center justify-center rounded-lg bg-foreground text-background font-semibold hover:opacity-95 transition-opacity disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            {isSubmitting ? m.contactSales.submitting : m.contactSales.submitBtn}
                          </button>
                        </div>
                      )}
                    </motion.form>
                  ) : (
                    /* Success Screen */
                    <motion.div
                      key="success-screen"
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ duration: 0.4 }}
                      className="py-12 px-4 text-center space-y-6"
                    >
                      <div className="w-16 h-16 bg-green-500/10 border border-green-500/30 text-green-500 rounded-full flex items-center justify-center mx-auto shadow-sm">
                        <Check className="w-8 h-8" />
                      </div>
                      <div className="space-y-2">
                        <h2 className="text-3xl font-serif font-medium">{m.contactSales.successTitle}</h2>
                        <p className="text-muted-foreground leading-relaxed max-w-md mx-auto">
                          {m.contactSales.successDesc}
                        </p>
                      </div>
                      <div className="pt-4">
                        <button
                          type="button"
                          onClick={() => {
                            setIsSubmitted(false);
                            setFormData({
                              firstName: "",
                              lastName: "",
                              email: "",
                              phone: "",
                              companyName: "",
                              companyWebsite: "",
                              jobTitle: "",
                              industry: "",
                              hq: "",
                              interest: "",
                              employees: "",
                              journey: "",
                              message: "",
                              source: "",
                            });
                            setRateLimitData({
                              email: "",
                              modelEngine: "gemini-2.0-flash",
                              requestedLimit: "",
                              justification: "",
                            });
                            setInquiryType("");
                          }}
                          className="inline-flex h-10 px-6 items-center justify-center rounded-lg border border-border hover:bg-muted/40 transition-colors text-sm font-semibold"
                        >
                          Submit another request
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </FadeIn>
          </div>
        </div>
      </div>
    </div>
  );
}
