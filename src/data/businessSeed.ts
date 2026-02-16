// Business Control & Skill Packs Seed Data

// ============================================
// RUNWAY & BURN DATA
// ============================================
export interface CostCategory {
  id: string;
  category: string;
  thisMonth: number;
  lastMonth: number;
  meaning: string;
  nextStep: string;
  vendors: CostVendor[];
  updatedAt: string;
}

export interface CostVendor {
  name: string;
  amount: number;
  type: string;
}

export const runwayBurnData = {
  monthlyBurn: 8250,
  runway: 81.8,
  cashOnHand: 675000,
  biggestCostDriver: 'Infrastructure',
  burnChangePercent: 4.2,
  
  costCategories: [
    {
      id: 'CAT-001',
      category: 'Infrastructure (Platform Fixed)',
      thisMonth: 585.50,
      lastMonth: 585.50,
      meaning: 'Fixed platform subscriptions independent of owner count',
      nextStep: 'Monitor plan tiers',
      updatedAt: '2026-02-01T10:00:00Z',
      vendors: [
        { name: 'LiveKit Cloud (Scale plan)', amount: 500, type: 'realtime' },
        { name: 'PandaDoc (API Developer Plan)', amount: 40, type: 'contracts' },
        { name: 'Supabase (Pro plan base)', amount: 25, type: 'database' },
        { name: 'Render Professional (optional)', amount: 19, type: 'hosting' },
        { name: 'Domains & DNS (avg)', amount: 1.50, type: 'dns' },
      ],
    },
    {
      id: 'CAT-002',
      category: 'Per-Owner Costs (9 owners)',
      thisMonth: 412.20,
      lastMonth: 366.40,
      meaning: 'Scales with customer count — mailboxes + phone numbers',
      nextStep: 'Track owner growth',
      updatedAt: '2026-02-01T10:00:00Z',
      vendors: [
        { name: 'Zoho Mail seats (9 × $4/mo)', amount: 36, type: 'email' },
        { name: 'Twilio phone numbers (9 × $0.58/mo)', amount: 5.20, type: 'telephony' },
        { name: 'Inbound AI minutes (est. 250 × 9 × $0.12)', amount: 270, type: 'ai_voice' },
        { name: 'OpenAI tokens (GPT-5 mini routing + drafting)', amount: 65, type: 'ai' },
        { name: 'SMS segments (est.)', amount: 22, type: 'messaging' },
        { name: 'WhatsApp Cloud API', amount: 14, type: 'messaging' },
      ],
    },
    {
      id: 'CAT-003',
      category: 'Video with Ava COGS (3 active)',
      thisMonth: 185.19,
      lastMonth: 123.46,
      meaning: 'Per-owner COGS for Video with Ava authority desk sessions',
      nextStep: 'Monitor minutes usage',
      updatedAt: '2026-02-02T08:30:00Z',
      vendors: [
        { name: 'Anam Enterprise (3 × $26/mo avg)', amount: 78, type: 'avatar' },
        { name: 'LiveKit transport (video sessions)', amount: 9, type: 'realtime' },
        { name: 'OpenAI (GPT-5 mini + GPT-5.2)', amount: 30, type: 'ai' },
        { name: 'PandaDoc signature sends', amount: 15, type: 'contracts' },
        { name: 'Web research API (Business Google)', amount: 6, type: 'search' },
        { name: 'Storage + artifacts', amount: 6, type: 'storage' },
        { name: 'ElevenLabs TTS', amount: 24.19, type: 'tts' },
        { name: 'Deepgram STT', amount: 17, type: 'stt' },
      ],
    },
    {
      id: 'CAT-004',
      category: 'Legal & CPA',
      thisMonth: 3800,
      lastMonth: 3800,
      meaning: 'Legal and accounting fees',
      nextStep: 'Renew retainer',
      updatedAt: '2026-01-15T14:00:00Z',
      vendors: [
        { name: 'Law Firm Retainer', amount: 2500, type: 'legal' },
        { name: 'Accounting Firm', amount: 1300, type: 'accounting' },
      ],
    },
    {
      id: 'CAT-005',
      category: 'Brand & IP',
      thisMonth: 2000,
      lastMonth: 1500,
      meaning: 'Trademarks and brand assets',
      nextStep: 'File renewal',
      updatedAt: '2026-01-28T16:00:00Z',
      vendors: [
        { name: 'Trademark Filing', amount: 1200, type: 'legal' },
        { name: 'Brand Guidelines', amount: 800, type: 'design' },
      ],
    },
  ] as CostCategory[],

  attentionItems: [
    { id: 'ATT-001', label: 'Video with Ava COGS up 50% — 3rd owner activated', meaning: 'More owners using authority desk', nextStep: 'Monitor margin per owner' },
    { id: 'ATT-002', label: 'Anam Enterprise custom quote still TBD', meaning: 'Fixed cost not finalized', nextStep: 'Confirm Anam monthly base' },
    { id: 'ATT-003', label: 'LiveKit Scale plan covers current volume', meaning: 'No plan change needed yet', nextStep: 'Review at 50 owners' },
  ],
};

// ============================================
// COSTS & USAGE DATA
// ============================================
export interface VendorUsage {
  id: string;
  vendor: string;
  category: string;
  costThisMonth: number;
  costLastMonth: number;
  meaning: string;
  nextStep: string;
  updatedAt: string;
  usage: UsageMeter[];
  overageRules?: string;
}

export interface UsageMeter {
  metric: string;
  current: number;
  limit: number | null;
  unit: string;
}

export const costsUsageData = {
  toolsVendorsTotal: 1182.89,
  aiApiTotal: 395,
  biggestSpike: 'Anam avatar minutes (+50%)',
  overageExposure: 120,
  alertsTriggered: 1,

  vendors: [
    {
      id: 'VND-001',
      vendor: 'LiveKit',
      category: 'Realtime Transport',
      costThisMonth: 500,
      costLastMonth: 500,
      meaning: 'Fixed Scale plan for voice/video',
      nextStep: 'No action — fixed plan',
      updatedAt: '2026-02-02T06:00:00Z',
      usage: [
        { metric: 'Agent Session Minutes', current: 2400, limit: null, unit: 'minutes' },
        { metric: 'SIP Bridge Minutes', current: 1800, limit: null, unit: 'minutes' },
        { metric: 'Video Sessions', current: 45, limit: null, unit: 'sessions' },
      ],
    },
    {
      id: 'VND-002',
      vendor: 'OpenAI',
      category: 'AI/LLM',
      costThisMonth: 95,
      costLastMonth: 72,
      meaning: 'GPT-5 mini (routing/drafting) + GPT-5.2 (task completion)',
      nextStep: 'Optimize prompts',
      updatedAt: '2026-02-02T08:00:00Z',
      usage: [
        { metric: 'GPT-5 mini tokens', current: 18500000, limit: null, unit: 'tokens' },
        { metric: 'GPT-5.2 tokens', current: 2200000, limit: null, unit: 'tokens' },
        { metric: 'Embeddings', current: 450000, limit: null, unit: 'tokens' },
      ],
      overageRules: 'Pay-as-you-go — $0.25/1M input (mini), $1.25/1M input (GPT-5)',
    },
    {
      id: 'VND-003',
      vendor: 'ElevenLabs',
      category: 'TTS',
      costThisMonth: 162,
      costLastMonth: 145,
      meaning: 'Flash v2.5 TTS for Sarah (front desk) + Ava (video)',
      nextStep: 'Monitor per-owner usage',
      updatedAt: '2026-02-02T08:00:00Z',
      usage: [
        { metric: 'TTS Minutes', current: 1800, limit: null, unit: 'minutes' },
      ],
      overageRules: '$0.09/min',
    },
    {
      id: 'VND-004',
      vendor: 'Deepgram',
      category: 'STT',
      costThisMonth: 82.80,
      costLastMonth: 78,
      meaning: 'Nova-3 real-time transcription for calls + conferences',
      nextStep: 'Stable — no action',
      updatedAt: '2026-02-02T08:00:00Z',
      usage: [
        { metric: 'STT Minutes', current: 9000, limit: null, unit: 'minutes' },
      ],
      overageRules: '$0.0092/min',
    },
    {
      id: 'VND-005',
      vendor: 'Anam',
      category: 'Avatar',
      costThisMonth: 78,
      costLastMonth: 52,
      meaning: 'Enterprise avatar for Video with Ava (3 active owners)',
      nextStep: 'Confirm enterprise base quote',
      updatedAt: '2026-02-02T06:00:00Z',
      usage: [
        { metric: 'Avatar Minutes', current: 1950, limit: null, unit: 'minutes' },
      ],
      overageRules: '$0.04/min + enterprise base TBD',
    },
    {
      id: 'VND-006',
      vendor: 'PandaDoc',
      category: 'Contracts',
      costThisMonth: 40,
      costLastMonth: 40,
      meaning: 'API Developer Plan — 40 docs/mo included',
      nextStep: 'Track signature sends vs quota',
      updatedAt: '2026-02-01T00:00:00Z',
      usage: [
        { metric: 'Documents Generated', current: 18, limit: 40, unit: 'docs' },
        { metric: 'Signature Sends', current: 24, limit: 36, unit: 'sends' },
      ],
      overageRules: '$10/additional signature send',
    },
    {
      id: 'VND-007',
      vendor: 'Supabase',
      category: 'Database',
      costThisMonth: 25,
      costLastMonth: 25,
      meaning: 'Pro plan base — primary DB/Auth/Storage',
      nextStep: 'Monitor compute/storage overages',
      updatedAt: '2026-02-02T02:00:00Z',
      usage: [
        { metric: 'Database Size', current: 1.2, limit: 8, unit: 'GB' },
        { metric: 'Edge Functions', current: 8500, limit: 50000, unit: 'invocations' },
      ],
    },
    {
      id: 'VND-008',
      vendor: 'Zoho Mail',
      category: 'Email',
      costThisMonth: 36,
      costLastMonth: 32,
      meaning: 'White-label mailbox seats (9 owners × $4)',
      nextStep: 'Scales with owner count',
      updatedAt: '2026-02-01T12:00:00Z',
      usage: [
        { metric: 'Active Mailboxes', current: 9, limit: null, unit: 'seats' },
      ],
    },
    {
      id: 'VND-009',
      vendor: 'Twilio',
      category: 'Communication',
      costThisMonth: 164.09,
      costLastMonth: 142,
      meaning: 'Phone numbers + SIP + SMS segments',
      nextStep: 'Register 10DLC for SMS',
      updatedAt: '2026-02-01T12:00:00Z',
      usage: [
        { metric: 'Phone Numbers', current: 9, limit: null, unit: 'numbers' },
        { metric: 'Inbound AI Minutes', current: 2250, limit: null, unit: 'minutes' },
        { metric: 'Outbound Callback Minutes', current: 420, limit: null, unit: 'minutes' },
        { metric: 'SMS Segments', current: 1850, limit: null, unit: 'segments' },
      ],
      overageRules: '$0.35/min inbound AI overage, $0.05/min outbound, $0.03/segment SMS',
    },
  ] as VendorUsage[],

  attentionItems: [
    { id: 'ATT-001', label: 'Anam avatar costs up 50%', meaning: '3rd Video with Ava owner activated', nextStep: 'Monitor margin' },
    { id: 'ATT-002', label: 'PandaDoc signature sends at 67% of quota', meaning: 'May need overage pricing soon', nextStep: 'Track per-owner sends' },
  ],
};

// ============================================
// REVENUE & ADD-ONS DATA
// ============================================
export interface RevenueSKU {
  id: string;
  sku: string;
  type: 'base' | 'office_addon' | 'suite_addon' | 'skill_pack' | 'overage';
  mrr: number;
  customerCount: number;
  meaning: string;
  nextStep: string;
  updatedAt: string;
}

export const revenueAddonsData = {
  totalMRR: 3470,
  baseMRR: 2870,
  addonMRR: 150,
  skillPackMRR: 300,
  overageProjected: 150,
  churnPercent: 0,

  breakdown: {
    base: 2870,
    officeAddons: 60,
    suiteAddons: 90,
    skillPacks: 300,
    overages: 150,
  },

  skus: [
    { id: 'SKU-001', sku: 'Aspire $350 Base Plan', type: 'base', mrr: 2870, customerCount: 8, meaning: 'Core Aspire subscriptions (includes 1 mailbox + voice + Eli + Sarah)', nextStep: 'Drive trials to paid', updatedAt: '2026-02-01T00:00:00Z' },
    { id: 'SKU-002', sku: 'Team Mailbox Seats ($15/seat)', type: 'office_addon', mrr: 60, customerCount: 2, meaning: 'Additional Zoho mailboxes for team members', nextStep: 'Upsell to solo owners', updatedAt: '2026-02-01T00:00:00Z' },
    { id: 'SKU-003', sku: 'Video with Ava Minutes Overage', type: 'overage', mrr: 90, customerCount: 1, meaning: 'Owner exceeded 150 min/week video allowance', nextStep: 'Offer higher tier', updatedAt: '2026-02-01T00:00:00Z' },
    { id: 'SKU-004', sku: 'Extra Signature Sends ($10/send)', type: 'overage', mrr: 60, customerCount: 1, meaning: 'Exceeded 12 PandaDoc signature sends/mo', nextStep: 'Track usage patterns', updatedAt: '2026-02-01T00:00:00Z' },
    { id: 'SKU-005', sku: 'Quinn Invoicing Pack', type: 'skill_pack', mrr: 150, customerCount: 2, meaning: 'Automated invoicing via Stripe — $299/mo but prorated for launch', nextStep: 'Expand adoption', updatedAt: '2026-02-01T00:00:00Z' },
    { id: 'SKU-006', sku: 'Nora Conference Pack', type: 'skill_pack', mrr: 150, customerCount: 2, meaning: 'Conference operations — $199/mo prorated', nextStep: 'Monitor transcript usage', updatedAt: '2026-02-01T00:00:00Z' },
    { id: 'SKU-007', sku: 'Premium Writing Mode (future)', type: 'suite_addon', mrr: 0, customerCount: 0, meaning: 'GPT-5 for cold outreach + sensitive emails — $19/mo', nextStep: 'Launch when demand validated', updatedAt: '2026-02-01T00:00:00Z' },
  ] as RevenueSKU[],

  attentionItems: [
    { id: 'ATT-001', label: 'Team Seat add-on converting at 25%', meaning: '2 of 8 owners added seats', nextStep: 'Promote during onboarding' },
    { id: 'ATT-002', label: 'Video overage signals demand', meaning: '1 owner using >150 min/week', nextStep: 'Consider higher-minute tier' },
    { id: 'ATT-003', label: 'Quinn invoicing: $142k collected this month', meaning: 'High value outcomes', nextStep: 'Feature success story' },
  ],
};

// ============================================
// SKILL PACK REGISTRY DATA
// ============================================
export interface SkillPack {
  id: string;
  packId: string;
  displayName: string;
  category: 'operations' | 'sales' | 'support' | 'finance' | 'legal';
  status: 'enabled' | 'disabled' | 'pending_approval' | 'deprecated';
  operatorStatus: 'Done' | 'Needs approval' | 'Blocked' | 'Failed' | 'Needs attention';
  meaning: string;
  nextStep: string;
  updatedAt: string;
  constraints: string[];
  requiresApprovalFor: string[];
  autonomyCap: 'low' | 'medium' | 'high';
  receiptsExpected: string[];
  pricing: {
    model: 'included' | 'paid' | 'usage';
    price?: number;
    quota?: number;
    overageRate?: number;
  };
  enabled: boolean;
  monetized: boolean;
  hasOverages: boolean;
}

export const skillPackRegistryData = {
  totalPacks: 10,
  enabledPacks: 7,
  packsRequiringApprovals: 3,
  monetizedPacks: 5,
  packsWithOverages: 2,

  packs: [
    {
      id: 'PACK-001',
      packId: 'sarah_front_desk',
      displayName: 'Sarah — Front Desk',
      category: 'support',
      status: 'enabled',
      operatorStatus: 'Done',
      meaning: 'Handles inbound voice calls, greets callers, and routes to appropriate staff',
      nextStep: 'Monitor call volume',
      updatedAt: '2026-02-01T10:00:00Z',
      constraints: ['Never provide legal, medical, or financial advice', 'Escalate after 3 unanswered questions', 'Transfer to human after 2 minutes of confusion'],
      requiresApprovalFor: [],
      autonomyCap: 'medium',
      receiptsExpected: ['answer_call', 'transfer_call', 'take_message', 'schedule_callback', 'escalate_to_human'],
      pricing: { model: 'included' },
      enabled: true,
      monetized: false,
      hasOverages: false,
    },
    {
      id: 'PACK-002',
      packId: 'eli_inbox',
      displayName: 'Eli — Inbox Manager',
      category: 'operations',
      status: 'enabled',
      operatorStatus: 'Done',
      meaning: 'Manages email inbox, categorizes messages, drafts responses, and escalates urgent items',
      nextStep: 'Review draft queue',
      updatedAt: '2026-02-02T08:00:00Z',
      constraints: ['Never auto-reply to external senders without approval', 'Flag suspicious emails for human review', 'Archive but never delete without explicit approval'],
      requiresApprovalFor: ['Sending replies to external contacts'],
      autonomyCap: 'medium',
      receiptsExpected: ['categorize_email', 'draft_reply', 'send_reply', 'archive_email', 'flag_urgent'],
      pricing: { model: 'included' },
      enabled: true,
      monetized: false,
      hasOverages: false,
    },
    {
      id: 'PACK-003',
      packId: 'quinn_invoices',
      displayName: 'Quinn — Invoicing',
      category: 'finance',
      status: 'enabled',
      operatorStatus: 'Done',
      meaning: 'Creates, sends, and tracks invoices. Handles payment follow-ups and reconciliation',
      nextStep: 'Monitor outcomes',
      updatedAt: '2026-02-01T14:00:00Z',
      constraints: ['Require voice confirmation for invoices over threshold', 'Never modify payment terms without approval', 'All invoice actions must be receipted'],
      requiresApprovalFor: ['Invoices over $5,000', 'Voiding invoices', 'Applying discounts over $500'],
      autonomyCap: 'high',
      receiptsExpected: ['create_invoice', 'send_invoice', 'void_invoice', 'apply_discount', 'mark_paid'],
      pricing: { model: 'paid', price: 299, quota: 100, overageRate: 2.5 },
      enabled: true,
      monetized: true,
      hasOverages: true,
    },
    {
      id: 'PACK-004',
      packId: 'nora-conference',
      displayName: 'Nora — Conference Ops',
      category: 'operations',
      status: 'enabled',
      operatorStatus: 'Done',
      meaning: 'Manages conference calls, handles participant routing, and maintains meeting transcripts',
      nextStep: 'Review transcript settings',
      updatedAt: '2026-02-02T06:00:00Z',
      constraints: ['Always start recording with consent announcement', 'Respect retention policy for transcripts', 'Route overflow to callback queue'],
      requiresApprovalFor: ['Starting conference recording'],
      autonomyCap: 'high',
      receiptsExpected: ['start_conference', 'add_participant', 'start_recording', 'generate_transcript', 'end_conference'],
      pricing: { model: 'paid', price: 199, quota: 50, overageRate: 1.5 },
      enabled: true,
      monetized: true,
      hasOverages: false,
    },
    {
      id: 'PACK-005',
      packId: 'adam-research',
      displayName: 'Adam — Research',
      category: 'operations',
      status: 'enabled',
      operatorStatus: 'Done',
      meaning: 'Conducts research, gathers information, and synthesizes findings into actionable reports',
      nextStep: 'Add integrations',
      updatedAt: '2026-02-01T12:00:00Z',
      constraints: ['Cite all sources in research outputs', 'Flag uncertainty when confidence is low', 'Never present speculation as fact'],
      requiresApprovalFor: [],
      autonomyCap: 'high',
      receiptsExpected: ['brave_search', 'tavily_search', 'pdf_preflight'],
      pricing: { model: 'included' },
      enabled: true,
      monetized: false,
      hasOverages: false,
    },
    {
      id: 'PACK-006',
      packId: 'tec-docs',
      displayName: 'Tec — Documentation',
      category: 'operations',
      status: 'enabled',
      operatorStatus: 'Done',
      meaning: 'Creates and maintains documentation, SOPs, and knowledge base articles',
      nextStep: 'Review flagged content',
      updatedAt: '2026-02-01T14:00:00Z',
      constraints: ['Maintain version history for all documents', 'Apply consistent formatting standards', 'Flag outdated content for review'],
      requiresApprovalFor: [],
      autonomyCap: 'high',
      receiptsExpected: ['pdf_preflight', 'playwright_pdf_renderer'],
      pricing: { model: 'included' },
      enabled: true,
      monetized: false,
      hasOverages: false,
    },
    {
      id: 'PACK-007',
      packId: 'finn_finance',
      displayName: 'Finn — Finance Analyst',
      category: 'finance',
      status: 'disabled',
      operatorStatus: 'Needs approval',
      meaning: 'Analyzes financial data, tracks metrics, and generates reports for business insights',
      nextStep: 'Connect Plaid',
      updatedAt: '2026-01-28T16:00:00Z',
      constraints: ['All financial data must be sourced from connected providers', 'Flag anomalies exceeding 10% variance', 'Never project without stating assumptions'],
      requiresApprovalFor: ['All financial reports', 'Variance alerts'],
      autonomyCap: 'low',
      receiptsExpected: [],
      pricing: { model: 'paid', price: 249, quota: 200, overageRate: 1.0 },
      enabled: false,
      monetized: true,
      hasOverages: false,
    },
    {
      id: 'PACK-008',
      packId: 'milo_ops',
      displayName: 'Milo — Operations Analyst',
      category: 'operations',
      status: 'disabled',
      operatorStatus: 'Needs approval',
      meaning: 'Monitors operations, identifies bottlenecks, and optimizes workflows for efficiency',
      nextStep: 'Define SLOs',
      updatedAt: '2026-01-25T10:00:00Z',
      constraints: ['Monitor SLOs and alert on breaches', 'Automate repetitive tasks when safe', 'Document all workflow changes'],
      requiresApprovalFor: ['Workflow automations', 'SLO modifications'],
      autonomyCap: 'medium',
      receiptsExpected: [],
      pricing: { model: 'usage', quota: 100, overageRate: 0.50 },
      enabled: false,
      monetized: true,
      hasOverages: false,
    },
    {
      id: 'PACK-009',
      packId: 'teressa_legal',
      displayName: 'Teressa — Legal Analyst',
      category: 'legal',
      status: 'disabled',
      operatorStatus: 'Needs attention',
      meaning: 'Reviews contracts, flags compliance issues, and assists with legal document organization',
      nextStep: 'Approve activation',
      updatedAt: '2026-01-20T11:00:00Z',
      constraints: ['Never provide legal advice - only summarize and flag', 'Escalate contract reviews to human counsel', 'Maintain strict confidentiality on all legal documents'],
      requiresApprovalFor: ['All actions (async_approval required)'],
      autonomyCap: 'low',
      receiptsExpected: ['pdf_preflight'],
      pricing: { model: 'paid', price: 349, quota: 30, overageRate: 5.0 },
      enabled: false,
      monetized: true,
      hasOverages: false,
    },
    {
      id: 'PACK-010',
      packId: 'ava_orchestrator',
      displayName: 'Ava — Chief of Staff',
      category: 'operations',
      status: 'enabled',
      operatorStatus: 'Done',
      meaning: 'Central orchestrator that coordinates all other staff members and manages workflow delegation',
      nextStep: 'Monitor delegation',
      updatedAt: '2026-02-03T10:00:00Z',
      constraints: ['Never execute without explicit approval for high-risk actions', 'Always maintain audit trail via receipts', 'Escalate ambiguous requests to human operator'],
      requiresApprovalFor: [],
      autonomyCap: 'high',
      receiptsExpected: ['delegate_task', 'escalate_incident'],
      pricing: { model: 'included' },
      enabled: true,
      monetized: false,
      hasOverages: false,
    },
  ] as SkillPack[],
};

// ============================================
// SKILL PACK ANALYTICS DATA
// ============================================
export interface SkillPackUsage {
  packId: string;
  displayName: string;
  actionsThisWeek: number;
  actionsLast30Days: number;
  successRate: number;
  avgCostPerAction: number;
}

export interface SkillPackOutcome {
  id: string;
  type: 'invoice_paid' | 'contract_signed' | 'meeting_booked' | 'ticket_resolved' | 'followup_converted';
  label: string;
  count: number;
  value: number;
}

export const skillPackAnalyticsData = {
  mostUsedThisWeek: 'Sarah — Front Desk',
  highestValueOutcomes: 'Quinn — Invoicing',
  approvalFrictionRate: 12.5,
  failureRate: 2.1,
  avgCostPerAction: 0.42,

  usage: [
    { packId: 'sarah_front_desk', displayName: 'Sarah — Front Desk', actionsThisWeek: 847, actionsLast30Days: 3420, successRate: 98.2, avgCostPerAction: 0.05 },
    { packId: 'eli_inbox', displayName: 'Eli — Inbox Manager', actionsThisWeek: 512, actionsLast30Days: 2048, successRate: 96.4, avgCostPerAction: 0.18 },
    { packId: 'quinn_invoices', displayName: 'Quinn — Invoicing', actionsThisWeek: 156, actionsLast30Days: 624, successRate: 99.1, avgCostPerAction: 0.85 },
    { packId: 'nora-conference', displayName: 'Nora — Conference Ops', actionsThisWeek: 189, actionsLast30Days: 756, successRate: 97.1, avgCostPerAction: 0.32 },
    { packId: 'adam-research', displayName: 'Adam — Research', actionsThisWeek: 94, actionsLast30Days: 376, successRate: 93.8, avgCostPerAction: 1.20 },
    { packId: 'tec-docs', displayName: 'Tec — Documentation', actionsThisWeek: 67, actionsLast30Days: 268, successRate: 97.5, avgCostPerAction: 0.45 },
    { packId: 'ava_orchestrator', displayName: 'Ava — Chief of Staff', actionsThisWeek: 312, actionsLast30Days: 1245, successRate: 99.7, avgCostPerAction: 0.08 },
  ] as SkillPackUsage[],

  outcomes: [
    { id: 'OUT-001', type: 'invoice_paid', label: 'Invoices Paid (Quinn)', count: 89, value: 142500 },
    { id: 'OUT-002', type: 'contract_signed', label: 'Contracts Reviewed (Teressa)', count: 12, value: 48000 },
    { id: 'OUT-003', type: 'meeting_booked', label: 'Conferences Managed (Nora)', count: 156, value: 0 },
    { id: 'OUT-004', type: 'ticket_resolved', label: 'Calls Handled (Sarah)', count: 412, value: 0 },
    { id: 'OUT-005', type: 'followup_converted', label: 'Emails Processed (Eli)', count: 234, value: 28500 },
  ] as SkillPackOutcome[],

  friction: {
    pendingApprovals: 7,
    avgApprovalTime: 4.2,
    translatedFailures: [
      { reason: 'Rate limit exceeded', count: 12, meaning: 'Too many requests too fast' },
      { reason: 'Validation failed', count: 8, meaning: 'Data format issues' },
      { reason: 'External API error', count: 5, meaning: 'Third-party service issues' },
    ],
  },

  attentionItems: [
    { id: 'ATT-001', label: 'Quinn invoicing: $142k collected this month', meaning: 'High value outcomes', nextStep: 'Feature success' },
    { id: 'ATT-002', label: '7 approvals pending >4 hours', meaning: 'Approval bottleneck', nextStep: 'Review queue' },
    { id: 'ATT-003', label: 'Eli inbox: 96.4% success rate', meaning: 'Strong email handling', nextStep: 'Expand auto-reply scope' },
  ],
};

// ============================================
// ACQUISITION ANALYTICS DATA
// ============================================
export interface ChannelPerformance {
  id: string;
  source: string;
  medium: string;
  campaign: string | null;
  visits: number;
  signups: number;
  activated: number;
  paid: number;
  conversionRate: number;
}

export interface AgeRangeData {
  range: '18-24' | '25-34' | '35-44' | '45-54' | '55-64' | '65+' | 'unknown' | 'prefer_not_to_say';
  signups: number;
  conversions: number;
  conversionRate: number;
}

export interface GenderData {
  gender: 'female' | 'male' | 'non_binary' | 'unknown' | 'prefer_not_to_say';
  signups: number;
  conversions: number;
  conversionRate: number;
}

export const acquisitionAnalyticsData = {
  signups7d: 127,
  signups30d: 498,
  conversionRate: 3.8,
  topChannel: 'Google Ads',
  bestConvertingAgeRange: '25-34',
  bestConvertingGender: 'female',

  channels: [
    { id: 'CH-001', source: 'google', medium: 'cpc', campaign: 'brand_2026_q1', visits: 2450, signups: 89, activated: 42, paid: 18, conversionRate: 3.6 },
    { id: 'CH-002', source: 'meta', medium: 'paid', campaign: 'retargeting_jan', visits: 1820, signups: 54, activated: 28, paid: 12, conversionRate: 3.0 },
    { id: 'CH-003', source: 'linkedin', medium: 'cpc', campaign: 'b2b_enterprise', visits: 890, signups: 38, activated: 22, paid: 9, conversionRate: 4.3 },
    { id: 'CH-004', source: 'organic', medium: 'search', campaign: null, visits: 3200, signups: 156, activated: 68, paid: 24, conversionRate: 4.9 },
    { id: 'CH-005', source: 'referral', medium: 'partner', campaign: null, visits: 540, signups: 45, activated: 28, paid: 14, conversionRate: 8.3 },
    { id: 'CH-006', source: 'direct', medium: 'none', campaign: null, visits: 1100, signups: 78, activated: 35, paid: 11, conversionRate: 7.1 },
    { id: 'CH-007', source: 'twitter', medium: 'organic', campaign: null, visits: 320, signups: 18, activated: 8, paid: 2, conversionRate: 5.6 },
    { id: 'CH-008', source: 'newsletter', medium: 'email', campaign: 'jan_digest', visits: 680, signups: 20, activated: 12, paid: 5, conversionRate: 2.9 },
  ] as ChannelPerformance[],

  funnel: {
    visits: 11000,
    signups: 498,
    activated: 243,
    paid: 95,
  },

  demographics: {
    ageRanges: [
      { range: '18-24', signups: 42, conversions: 8, conversionRate: 19.0 },
      { range: '25-34', signups: 178, conversions: 48, conversionRate: 27.0 },
      { range: '35-44', signups: 142, conversions: 35, conversionRate: 24.6 },
      { range: '45-54', signups: 68, conversions: 12, conversionRate: 17.6 },
      { range: '55-64', signups: 28, conversions: 4, conversionRate: 14.3 },
      { range: '65+', signups: 8, conversions: 1, conversionRate: 12.5 },
      { range: 'unknown', signups: 24, conversions: 5, conversionRate: 20.8 },
      { range: 'prefer_not_to_say', signups: 8, conversions: 2, conversionRate: 25.0 },
    ] as AgeRangeData[],
    genders: [
      { gender: 'female', signups: 198, conversions: 52, conversionRate: 26.3 },
      { gender: 'male', signups: 224, conversions: 48, conversionRate: 21.4 },
      { gender: 'non_binary', signups: 18, conversions: 4, conversionRate: 22.2 },
      { gender: 'unknown', signups: 42, conversions: 8, conversionRate: 19.0 },
      { gender: 'prefer_not_to_say', signups: 16, conversions: 3, conversionRate: 18.8 },
    ] as GenderData[],
    dataSource: 'ga4' as 'ga4' | 'meta' | 'self_reported',
    note: 'GA4 demographics include age/gender from consenting users only. Thresholds may apply.',
    unknownAgePercent: 6.4,
    unknownGenderPercent: 11.6,
  },

  attentionItems: [
    { id: 'ATT-001', label: 'Referral channel: 8.3% conversion', meaning: 'Best performing source', nextStep: 'Expand program' },
    { id: 'ATT-002', label: '25-34 age range: 27% conversion', meaning: 'Core demographic', nextStep: 'Double down on targeting' },
    { id: 'ATT-003', label: 'Twitter: low volume, decent rate', meaning: 'Potential growth channel', nextStep: 'Test paid promotion' },
  ],
};
