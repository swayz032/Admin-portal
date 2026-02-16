// Types
export interface Approval {
  id: string;
  type: string;
  risk: 'High' | 'Medium' | 'Low' | 'None';
  customer: string;
  summary: string;
  requestedBy: string;
  requestedAt: string;
  status: 'Pending' | 'Approved' | 'Denied';
  decisionReason?: string;
  evidenceReceiptIds: string[];
  linkedIncidentId?: string;
}

export interface Incident {
  id: string;
  severity: 'P0' | 'P1' | 'P2' | 'P3';
  status: 'Open' | 'Resolved';
  summary: string;
  customer: string;
  provider: string;
  createdAt: string;
  updatedAt: string;
  subscribed: boolean;
  timelineReceiptIds: string[];
  notes: IncidentNote[];
  // Trust Spine fields
  detectionSource: 'robot_test' | 'provider' | 'rule' | 'user_report';
  customerNotified: 'yes' | 'no' | 'queued';
  proofStatus: 'ok' | 'missing' | 'pending';
  recommendedAction?: string;
  correlationId?: string;
}

export interface IncidentNote {
  author: string;
  body: string;
  timestamp: string;
  isLLMAnalysis?: boolean;
}

export interface Receipt {
  id: string;
  timestamp: string;
  runId: string;
  correlationId: string;
  actor: string;
  actionType: string;
  outcome: 'Success' | 'Failed' | 'Blocked';
  provider: string;
  providerCallId: string;
  redactedRequest: string;
  redactedResponse: string;
  linkedIncidentId?: string | null;
  linkedApprovalId?: string | null;
  linkedCustomerId?: string | null;
}

export interface Customer {
  id: string;
  name: string;
  status: 'Active' | 'Trial' | 'Paused' | 'At Risk';
  plan: string;
  mrr: number;
  riskFlag: 'High' | 'Medium' | 'Low' | 'None';
  openIncidents: number;
  openApprovals: number;
  lastActivity: string;
  integrations: string[];
}

export interface Subscription {
  id: string;
  customerId: string;
  customerName: string;
  plan: string;
  status: 'Active' | 'Trial' | 'Past Due' | 'Cancelled';
  mrr: number;
  startedAt: string;
}

export interface Provider {
  id: string;
  name: string;
  type: string;
  status: 'Healthy' | 'At Risk' | 'Writes Paused' | 'Read-only Allowed';
  lastChecked: string;
  latency: number;
  p95Latency: number;
  errorRate: number;
  scopes: string[];
  lastSyncTime?: string;
  recentReceiptsCount?: number;
  permissionsSummary?: string;
}

// Seed Data
export const approvals: Approval[] = [
  {
    id: 'APR-001',
    type: 'Invoice Send',
    risk: 'High',
    customer: 'Pinnacle Property Group',
    summary: 'Approve invoice #INV-2891 for $6,200 — exceeds $5,000 voice confirmation threshold',
    requestedBy: 'Quinn (Invoicing)',
    requestedAt: '2026-02-12T08:30:00Z',
    status: 'Pending',
    evidenceReceiptIds: ['RCP-103'],
  },
  {
    id: 'APR-002',
    type: 'Email Send',
    risk: 'Medium',
    customer: 'Bright Path Consulting',
    summary: 'Approve outbound email reply drafted by Eli to external contact',
    requestedBy: 'Eli (Inbox Manager)',
    requestedAt: '2026-02-11T16:45:00Z',
    status: 'Pending',
    evidenceReceiptIds: ['RCP-104'],
  },
  {
    id: 'APR-003',
    type: 'Contract Signature Send',
    risk: 'Medium',
    customer: 'Coastal Legal Partners',
    summary: 'Send service agreement for eSign via PandaDoc — 2 signers',
    requestedBy: 'Nora (Conference Ops)',
    requestedAt: '2026-02-10T09:30:00Z',
    status: 'Approved',
    decisionReason: 'Standard agreement template, approved during Video with Ava session',
    evidenceReceiptIds: ['RCP-106'],
  },
  {
    id: 'APR-004',
    type: 'Payment Retry',
    risk: 'Medium',
    customer: 'Harbor View Dental',
    summary: 'Retry failed subscription payment of $350',
    requestedBy: 'Billing System',
    requestedAt: '2026-02-11T10:00:00Z',
    status: 'Pending',
    evidenceReceiptIds: [],
    linkedIncidentId: 'INC-001',
  },
];

export const incidents: Incident[] = [
  {
    id: 'INC-001',
    severity: 'P1',
    status: 'Open',
    summary: 'Twilio SIP origination latency spike affecting inbound AI calls',
    customer: 'Harbor View Dental',
    provider: 'Twilio',
    createdAt: '2026-02-12T07:00:00Z',
    updatedAt: '2026-02-12T08:45:00Z',
    subscribed: true,
    timelineReceiptIds: ['RCP-101', 'RCP-102'],
    detectionSource: 'robot_test',
    customerNotified: 'queued',
    proofStatus: 'ok',
    recommendedAction: 'Monitor Twilio status page — SIP origination degraded in US-East',
    correlationId: 'corr-twilio-001',
    notes: [
      {
        author: 'System',
        body: 'SIP origination latency exceeded 3s threshold on inbound calls',
        timestamp: '2026-02-12T07:00:00Z',
      },
      {
        author: 'Ava (LLM)',
        body: 'Analysis: Twilio US-East SIP infrastructure experiencing intermittent delays. Recommend failover to US-West if latency persists >15 min.',
        timestamp: '2026-02-12T07:30:00Z',
        isLLMAnalysis: true,
      },
    ],
  },
  {
    id: 'INC-002',
    severity: 'P2',
    status: 'Open',
    summary: 'ElevenLabs TTS occasional timeout during peak hours',
    customer: 'Martinez Landscaping',
    provider: 'ElevenLabs',
    createdAt: '2026-02-11T14:30:00Z',
    updatedAt: '2026-02-11T15:15:00Z',
    subscribed: false,
    timelineReceiptIds: ['RCP-105'],
    detectionSource: 'rule',
    customerNotified: 'no',
    proofStatus: 'pending',
    recommendedAction: 'Implement TTS fallback to shorter responses during peak',
    correlationId: 'corr-tts-001',
    notes: [
      {
        author: 'System',
        body: 'TTS response time exceeded 2s threshold 3 times during 2-4 PM window',
        timestamp: '2026-02-11T14:30:00Z',
      },
    ],
  },
  {
    id: 'INC-003',
    severity: 'P2',
    status: 'Resolved',
    summary: 'PandaDoc webhook delivery delay — signature confirmations delayed',
    customer: 'Coastal Legal Partners',
    provider: 'PandaDoc',
    createdAt: '2026-02-10T10:00:00Z',
    updatedAt: '2026-02-10T11:30:00Z',
    subscribed: false,
    timelineReceiptIds: ['RCP-106', 'RCP-107'],
    detectionSource: 'provider',
    customerNotified: 'yes',
    proofStatus: 'ok',
    recommendedAction: 'No action needed — resolved',
    correlationId: 'corr-pandadoc-001',
    notes: [
      {
        author: 'System',
        body: 'PandaDoc webhook delivery recovered after provider maintenance window',
        timestamp: '2026-02-10T11:30:00Z',
      },
    ],
  },
];

export const receipts: Receipt[] = [
  {
    id: 'RCP-101',
    timestamp: '2026-02-12T07:00:00Z',
    runId: 'run-abc123',
    correlationId: 'corr-twilio-001',
    actor: 'Sarah (Front Desk)',
    actionType: 'answer_call',
    outcome: 'Failed',
    provider: 'Twilio',
    providerCallId: 'tw_call_001',
    redactedRequest: '{"action": "answer_inbound", "number": "[REDACTED]"}',
    redactedResponse: '{"error": {"code": "sip_timeout", "message": "[REDACTED]"}}',
    linkedIncidentId: 'INC-001',
    linkedCustomerId: 'CUST-006',
  },
  {
    id: 'RCP-102',
    timestamp: '2026-02-12T07:15:00Z',
    runId: 'run-abc123',
    correlationId: 'corr-twilio-001',
    actor: 'System',
    actionType: 'circuit_breaker_check',
    outcome: 'Success',
    provider: 'Twilio',
    providerCallId: '',
    redactedRequest: '{"action": "health_check", "endpoint": "sip_origination"}',
    redactedResponse: '{"status": "degraded", "latency_ms": 3200}',
    linkedIncidentId: 'INC-001',
  },
  {
    id: 'RCP-103',
    timestamp: '2026-02-12T08:00:00Z',
    runId: 'run-def456',
    correlationId: 'corr-invoice-001',
    actor: 'Quinn (Invoicing)',
    actionType: 'send_invoice',
    outcome: 'Success',
    provider: 'Stripe',
    providerCallId: 'inv_stripe_001',
    redactedRequest: '{"amount": "[REDACTED]", "customer": "[REDACTED]", "terms": "Net 30"}',
    redactedResponse: '{"invoice_id": "inv_[REDACTED]", "status": "sent"}',
    linkedCustomerId: 'CUST-002',
  },
  {
    id: 'RCP-104',
    timestamp: '2026-02-11T16:30:00Z',
    runId: 'run-ghi789',
    correlationId: 'corr-email-001',
    actor: 'Eli (Inbox Manager)',
    actionType: 'draft_reply',
    outcome: 'Success',
    provider: 'Zoho Mail',
    providerCallId: 'zoho_draft_001',
    redactedRequest: '{"thread_id": "[REDACTED]", "action": "draft_reply"}',
    redactedResponse: '{"draft_id": "[REDACTED]", "status": "pending_approval"}',
    linkedCustomerId: 'CUST-003',
  },
  {
    id: 'RCP-105',
    timestamp: '2026-02-11T14:35:00Z',
    runId: 'run-jkl012',
    correlationId: 'corr-tts-001',
    actor: 'Sarah (Front Desk)',
    actionType: 'tts_synthesis',
    outcome: 'Failed',
    provider: 'ElevenLabs',
    providerCallId: 'el_tts_001',
    redactedRequest: '{"text": "[REDACTED]", "voice": "sarah_v2"}',
    redactedResponse: '{"error": "timeout", "latency_ms": 4200}',
    linkedIncidentId: 'INC-002',
    linkedCustomerId: 'CUST-001',
  },
  {
    id: 'RCP-106',
    timestamp: '2026-02-10T10:00:00Z',
    runId: 'run-mno345',
    correlationId: 'corr-pandadoc-001',
    actor: 'Nora (Conference Ops)',
    actionType: 'signature_send',
    outcome: 'Success',
    provider: 'PandaDoc',
    providerCallId: 'pd_sig_001',
    redactedRequest: '{"template": "[REDACTED]", "signers": 2}',
    redactedResponse: '{"document_id": "[REDACTED]", "status": "sent_for_signature"}',
    linkedIncidentId: 'INC-003',
    linkedCustomerId: 'CUST-005',
  },
  {
    id: 'RCP-107',
    timestamp: '2026-02-10T11:30:00Z',
    runId: 'run-mno345',
    correlationId: 'corr-pandadoc-001',
    actor: 'System',
    actionType: 'webhook_received',
    outcome: 'Success',
    provider: 'PandaDoc',
    providerCallId: 'pd_wh_001',
    redactedRequest: '{"event": "document.completed"}',
    redactedResponse: '{"status": "signed", "signers_complete": 2}',
    linkedIncidentId: 'INC-003',
    linkedCustomerId: 'CUST-005',
  },
  {
    id: 'RCP-108',
    timestamp: '2026-02-12T06:00:00Z',
    runId: 'run-pqr678',
    correlationId: 'corr-call-002',
    actor: 'Sarah (Front Desk)',
    actionType: 'answer_call',
    outcome: 'Success',
    provider: 'Twilio',
    providerCallId: 'tw_call_002',
    redactedRequest: '{"action": "answer_inbound", "number": "[REDACTED]"}',
    redactedResponse: '{"status": "connected", "duration_sec": 45, "intent": "scheduling"}',
    linkedCustomerId: 'CUST-009',
  },
  {
    id: 'RCP-109',
    timestamp: '2026-02-12T08:30:00Z',
    runId: 'run-stu901',
    correlationId: 'corr-video-001',
    actor: 'Ava (Chief of Staff)',
    actionType: 'video_authority_session',
    outcome: 'Success',
    provider: 'LiveKit',
    providerCallId: 'lk_session_001',
    redactedRequest: '{"mode": "video_with_ava", "duration_min": 12}',
    redactedResponse: '{"receipts_generated": 3, "approvals": 1, "artifacts": ["invoice_pack.pdf"]}',
    linkedCustomerId: 'CUST-007',
  },
];

export const customers: Customer[] = [
  {
    id: 'CUST-001',
    name: 'Martinez Landscaping',
    status: 'Active',
    plan: 'Aspire $350',
    mrr: 350,
    riskFlag: 'None',
    openIncidents: 0,
    openApprovals: 0,
    lastActivity: '2026-02-12T08:45:00Z',
    integrations: ['Stripe', 'Twilio', 'Zoho Mail', 'LiveKit'],
  },
  {
    id: 'CUST-002',
    name: 'Pinnacle Property Group',
    status: 'Active',
    plan: 'Aspire $350 + Team Seats',
    mrr: 395,
    riskFlag: 'None',
    openIncidents: 0,
    openApprovals: 1,
    lastActivity: '2026-02-12T09:15:00Z',
    integrations: ['Stripe', 'Twilio', 'Zoho Mail', 'LiveKit', 'PandaDoc'],
  },
  {
    id: 'CUST-003',
    name: 'Bright Path Consulting',
    status: 'Active',
    plan: 'Aspire $350 + Video with Ava',
    mrr: 350,
    riskFlag: 'Low',
    openIncidents: 0,
    openApprovals: 0,
    lastActivity: '2026-02-11T16:00:00Z',
    integrations: ['Stripe', 'Twilio', 'Zoho Mail', 'LiveKit', 'Anam'],
  },
  {
    id: 'CUST-004',
    name: 'Summit Auto Repair',
    status: 'Trial',
    plan: 'Aspire Trial',
    mrr: 0,
    riskFlag: 'None',
    openIncidents: 0,
    openApprovals: 0,
    lastActivity: '2026-02-10T14:00:00Z',
    integrations: ['Stripe', 'Twilio'],
  },
  {
    id: 'CUST-005',
    name: 'Coastal Legal Partners',
    status: 'Active',
    plan: 'Aspire $350 + Team Seats',
    mrr: 410,
    riskFlag: 'None',
    openIncidents: 0,
    openApprovals: 0,
    lastActivity: '2026-02-12T07:30:00Z',
    integrations: ['Stripe', 'Twilio', 'Zoho Mail', 'LiveKit', 'PandaDoc', 'Google'],
  },
  {
    id: 'CUST-006',
    name: 'Harbor View Dental',
    status: 'At Risk',
    plan: 'Aspire $350',
    mrr: 350,
    riskFlag: 'Medium',
    openIncidents: 1,
    openApprovals: 0,
    lastActivity: '2026-02-05T12:00:00Z',
    integrations: ['Stripe', 'Twilio', 'Zoho Mail'],
  },
  {
    id: 'CUST-007',
    name: 'Evergreen Financial Advisors',
    status: 'Active',
    plan: 'Aspire $350 + Video with Ava',
    mrr: 365,
    riskFlag: 'None',
    openIncidents: 0,
    openApprovals: 0,
    lastActivity: '2026-02-12T09:00:00Z',
    integrations: ['Stripe', 'Twilio', 'Zoho Mail', 'LiveKit', 'Anam', 'PandaDoc'],
  },
  {
    id: 'CUST-008',
    name: 'Atlas Moving Co',
    status: 'Active',
    plan: 'Aspire $350',
    mrr: 350,
    riskFlag: 'None',
    openIncidents: 0,
    openApprovals: 0,
    lastActivity: '2026-02-11T18:00:00Z',
    integrations: ['Stripe', 'Twilio', 'Zoho Mail', 'LiveKit'],
  },
  {
    id: 'CUST-009',
    name: 'Blue Ridge Plumbing',
    status: 'Active',
    plan: 'Aspire $350',
    mrr: 350,
    riskFlag: 'None',
    openIncidents: 0,
    openApprovals: 0,
    lastActivity: '2026-02-12T06:00:00Z',
    integrations: ['Stripe', 'Twilio', 'Zoho Mail'],
  },
  {
    id: 'CUST-010',
    name: 'Redwood Therapy Group',
    status: 'Paused',
    plan: 'Aspire $350',
    mrr: 0,
    riskFlag: 'High',
    openIncidents: 0,
    openApprovals: 0,
    lastActivity: '2026-01-28T10:00:00Z',
    integrations: ['Stripe', 'Twilio'],
  },
];

export const subscriptions: Subscription[] = [
  { id: 'SUB-001', customerId: 'CUST-001', customerName: 'Martinez Landscaping', plan: 'Aspire $350', status: 'Active', mrr: 350, startedAt: '2025-11-01T00:00:00Z' },
  { id: 'SUB-002', customerId: 'CUST-002', customerName: 'Pinnacle Property Group', plan: 'Aspire $350 + Team Seats', status: 'Active', mrr: 395, startedAt: '2025-10-15T00:00:00Z' },
  { id: 'SUB-003', customerId: 'CUST-003', customerName: 'Bright Path Consulting', plan: 'Aspire $350 + Video with Ava', status: 'Active', mrr: 350, startedAt: '2025-12-01T00:00:00Z' },
  { id: 'SUB-004', customerId: 'CUST-004', customerName: 'Summit Auto Repair', plan: 'Aspire Trial', status: 'Trial', mrr: 0, startedAt: '2026-02-01T00:00:00Z' },
  { id: 'SUB-005', customerId: 'CUST-005', customerName: 'Coastal Legal Partners', plan: 'Aspire $350 + Team Seats', status: 'Active', mrr: 410, startedAt: '2025-09-20T00:00:00Z' },
  { id: 'SUB-006', customerId: 'CUST-006', customerName: 'Harbor View Dental', plan: 'Aspire $350', status: 'Past Due', mrr: 350, startedAt: '2025-08-01T00:00:00Z' },
  { id: 'SUB-007', customerId: 'CUST-007', customerName: 'Evergreen Financial Advisors', plan: 'Aspire $350 + Video with Ava', status: 'Active', mrr: 365, startedAt: '2025-10-01T00:00:00Z' },
  { id: 'SUB-008', customerId: 'CUST-008', customerName: 'Atlas Moving Co', plan: 'Aspire $350', status: 'Active', mrr: 350, startedAt: '2025-11-15T00:00:00Z' },
  { id: 'SUB-009', customerId: 'CUST-009', customerName: 'Blue Ridge Plumbing', plan: 'Aspire $350', status: 'Active', mrr: 350, startedAt: '2025-12-10T00:00:00Z' },
  { id: 'SUB-010', customerId: 'CUST-010', customerName: 'Redwood Therapy Group', plan: 'Aspire $350', status: 'Past Due', mrr: 0, startedAt: '2025-07-01T00:00:00Z' },
];

export const providers: Provider[] = [
  {
    id: 'PROV-001',
    name: 'Stripe',
    type: 'Payment',
    status: 'Healthy',
    lastChecked: '2026-02-12T08:50:00Z',
    latency: 145,
    p95Latency: 210,
    errorRate: 0.1,
    scopes: ['payments.read', 'payments.write', 'invoicing', 'subscriptions', 'refunds'],
    lastSyncTime: '2026-02-12T08:48:00Z',
    recentReceiptsCount: 18,
    permissionsSummary: 'Full payment + invoicing access',
  },
  {
    id: 'PROV-002',
    name: 'Twilio',
    type: 'Telephony',
    status: 'Healthy',
    lastChecked: '2026-02-12T08:50:00Z',
    latency: 120,
    p95Latency: 160,
    errorRate: 0.2,
    scopes: ['voice', 'sms', 'whatsapp', 'sip_trunking', 'verify'],
    lastSyncTime: '2026-02-12T08:47:00Z',
    recentReceiptsCount: 42,
    permissionsSummary: 'Voice + SMS + WhatsApp access',
  },
  {
    id: 'PROV-003',
    name: 'OpenAI',
    type: 'AI/LLM',
    status: 'Healthy',
    lastChecked: '2026-02-12T08:50:00Z',
    latency: 280,
    p95Latency: 520,
    errorRate: 0.3,
    scopes: ['chat', 'embeddings', 'vision', 'audio', 'agents_sdk'],
    lastSyncTime: '2026-02-12T08:49:00Z',
    recentReceiptsCount: 156,
    permissionsSummary: 'GPT-5 mini + GPT-5.2 + Agents SDK',
  },
  {
    id: 'PROV-004',
    name: 'LiveKit',
    type: 'Realtime',
    status: 'Healthy',
    lastChecked: '2026-02-12T08:50:00Z',
    latency: 45,
    p95Latency: 85,
    errorRate: 0.05,
    scopes: ['webrtc', 'sip_bridge', 'agent_sessions', 'video', 'audio'],
    lastSyncTime: '2026-02-12T08:49:00Z',
    recentReceiptsCount: 34,
    permissionsSummary: 'Scale plan — WebRTC + SIP bridge',
  },
  {
    id: 'PROV-005',
    name: 'PandaDoc',
    type: 'Contracts',
    status: 'Healthy',
    lastChecked: '2026-02-12T08:50:00Z',
    latency: 320,
    p95Latency: 480,
    errorRate: 0.1,
    scopes: ['document_generation', 'esign', 'templates', 'signature_sends'],
    lastSyncTime: '2026-02-12T08:45:00Z',
    recentReceiptsCount: 8,
    permissionsSummary: 'API Developer Plan — 40 docs/mo',
  },
  {
    id: 'PROV-006',
    name: 'Zoho Mail',
    type: 'Email',
    status: 'Healthy',
    lastChecked: '2026-02-12T08:50:00Z',
    latency: 180,
    p95Latency: 250,
    errorRate: 0.0,
    scopes: ['mailbox', 'white_label_email', 'imap', 'smtp'],
    lastSyncTime: '2026-02-12T08:48:00Z',
    recentReceiptsCount: 67,
    permissionsSummary: 'White-label mailbox — $4/seat/mo',
  },
  {
    id: 'PROV-007',
    name: 'Anam',
    type: 'Avatar',
    status: 'Healthy',
    lastChecked: '2026-02-12T08:50:00Z',
    latency: 95,
    p95Latency: 140,
    errorRate: 0.1,
    scopes: ['avatar_rendering', 'voice_synthesis', 'realtime_presence'],
    lastSyncTime: '2026-02-12T08:49:00Z',
    recentReceiptsCount: 12,
    permissionsSummary: 'Enterprise — $0.04/min + voice included',
  },
  {
    id: 'PROV-008',
    name: 'ElevenLabs',
    type: 'TTS',
    status: 'Healthy',
    lastChecked: '2026-02-12T08:50:00Z',
    latency: 110,
    p95Latency: 180,
    errorRate: 0.0,
    scopes: ['voice_cloning', 'multilingual', 'low_latency_tts'],
    lastSyncTime: '2026-02-12T08:49:00Z',
    recentReceiptsCount: 89,
    permissionsSummary: 'Flash v2.5 — $0.09/min',
  },
  {
    id: 'PROV-009',
    name: 'Deepgram',
    type: 'STT',
    status: 'Healthy',
    lastChecked: '2026-02-12T08:50:00Z',
    latency: 65,
    p95Latency: 110,
    errorRate: 0.0,
    scopes: ['real_time_transcription', 'speaker_diarization', 'nova_3'],
    lastSyncTime: '2026-02-12T08:49:00Z',
    recentReceiptsCount: 89,
    permissionsSummary: 'Nova-3 monolingual — $0.0092/min',
  },
  {
    id: 'PROV-010',
    name: 'Supabase',
    type: 'Database',
    status: 'Healthy',
    lastChecked: '2026-02-12T08:50:00Z',
    latency: 12,
    p95Latency: 35,
    errorRate: 0.0,
    scopes: ['postgres', 'auth', 'storage', 'edge_functions', 'realtime'],
    lastSyncTime: '2026-02-12T08:50:00Z',
    recentReceiptsCount: 245,
    permissionsSummary: 'Pro plan — primary DB/Auth/Storage',
  },
  {
    id: 'PROV-011',
    name: 'n8n',
    type: 'Automation',
    status: 'Healthy',
    lastChecked: '2026-02-12T08:50:00Z',
    latency: 200,
    p95Latency: 350,
    errorRate: 0.5,
    scopes: ['webhooks', 'retries', 'timers', 'batch_jobs'],
    lastSyncTime: '2026-02-12T08:48:00Z',
    recentReceiptsCount: 23,
    permissionsSummary: 'Request-only automation — no autonomous execution',
  },
  {
    id: 'PROV-012',
    name: 'Google (Gmail + Calendar)',
    type: 'Productivity',
    status: 'Healthy',
    lastChecked: '2026-02-12T08:50:00Z',
    latency: 155,
    p95Latency: 230,
    errorRate: 0.1,
    scopes: ['gmail_oauth_send', 'calendar', 'business_search'],
    lastSyncTime: '2026-02-12T08:47:00Z',
    recentReceiptsCount: 31,
    permissionsSummary: 'Gmail OAuth + Calendar + Business Search',
  },
];

// Business Metrics — aligned with $350+ Aspire base plan
export const businessMetrics = {
  totalMRR: 2870,
  mrrGrowth: 12.5,
  activeCustomers: 8,
  newSubscriptions7d: 1,
  churnRate: 0,
  churn30d: 0,
  failedPayments: {
    count: 1,
    amount: 350,
  },
  trialConversion: 50,
  refundsDisputes: {
    refunds: 0,
    disputes: 0,
    amount: 0,
  },
  expansionMRR: 60,
  contractionMRR: 0,
  mrrTrend: [
    { date: '2025-09-01', mrr: 700 },
    { date: '2025-10-01', mrr: 1105 },
    { date: '2025-11-01', mrr: 1455 },
    { date: '2025-12-01', mrr: 2105 },
    { date: '2026-01-01', mrr: 2520 },
    { date: '2026-02-01', mrr: 2870 },
  ],
};

// Ops Metrics
export const opsMetrics = {
  openApprovals: 3,
  activeIncidents: {
    p0: 0,
    p1: 1,
    p2: 1,
    p3: 0,
  },
  successfulActionsToday: 847,
  providerHealth: {
    status: 'Degraded',
    p95Latency: 320,
  },
  queueHealth: {
    depth: 8,
    lag: 1.8,
    retries: 2,
  },
  llmAnalyst: {
    status: 'Online',
    lastAnalysis: '2026-02-12T08:30:00Z',
  },
  errorBudget: {
    remaining: 85,
    burnRate: 0.8,
  },
};
