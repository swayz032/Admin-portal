// Automation / Job Queue Seed Data

export interface AutomationJob {
  id: string;
  jobType: string;
  jobDescription: string; // Operator-friendly
  tenantId: string;
  suiteId: string;
  suiteName: string;
  officeId: string;
  officeName: string;
  status: 'queued' | 'running' | 'completed' | 'failed' | 'blocked' | 'retrying';
  attempts: number;
  maxAttempts: number;
  nextRunAt: string;
  createdAt: string;
  lastAttemptAt?: string;
  waitingReason?: string; // Why it's waiting (operator-friendly)
  idempotencyKey: string;
  policyDecisionRef?: string;
  receiptRef?: string;
  correlationId: string;
  proofStatus: 'ok' | 'missing' | 'pending';
  traceId: string;
}

export interface Automation {
  id: string;
  name: string;
  description: string;
  category: string;
  status: 'active' | 'paused' | 'disabled';
  triggeredBy: 'schedule' | 'event' | 'manual';
  lastRun?: string;
  nextRun?: string;
  runsTotal: number;
  successRate: number;
  officeId?: string;
  officeName?: string;
}

export interface Schedule {
  id: string;
  automationId: string;
  automationName: string;
  cronExpression: string;
  cronReadable: string;
  timezone: string;
  status: 'active' | 'paused';
  lastRun?: string;
  nextRun: string;
  officeId?: string;
  officeName?: string;
}

export interface AutomationFailure {
  id: string;
  jobId: string;
  automationName: string;
  failedAt: string;
  errorCode: string;
  errorMessage: string;
  errorMessageOperator: string; // Friendly message
  attempts: number;
  canRetry: boolean;
  officeId?: string;
  officeName?: string;
  suiteName?: string;
  correlationId: string;
}

export interface TraceEvent {
  id: string;
  traceId: string;
  timestamp: string;
  type: 'start' | 'step' | 'approval' | 'external_call' | 'policy' | 'receipt' | 'error' | 'end';
  title: string;
  details?: string;
  status: 'success' | 'failed' | 'pending' | 'blocked';
  actor?: string;
  provider?: string;
}

// Seed Data

export const automationJobs: AutomationJob[] = [
  {
    id: 'JOB-001',
    jobType: 'invoice.send',
    jobDescription: 'Send invoice reminder to Acme Corp',
    tenantId: 'TENANT-001',
    suiteId: 'SUITE-001',
    suiteName: 'Suite 120',
    officeId: 'OFF-001',
    officeName: 'Office 14',
    status: 'queued',
    attempts: 0,
    maxAttempts: 3,
    nextRunAt: '2026-01-08T11:00:00Z',
    createdAt: '2026-01-08T10:00:00Z',
    waitingReason: 'Scheduled to run in 10 minutes',
    idempotencyKey: 'inv-remind-acme-20260108',
    correlationId: 'corr-inv-001',
    proofStatus: 'pending',
    traceId: 'TRACE-001',
  },
  {
    id: 'JOB-002',
    jobType: 'crm.sync',
    jobDescription: 'Sync contacts from HubSpot',
    tenantId: 'TENANT-001',
    suiteId: 'SUITE-001',
    suiteName: 'Suite 120',
    officeId: 'OFF-002',
    officeName: 'Office 22',
    status: 'running',
    attempts: 1,
    maxAttempts: 3,
    nextRunAt: '2026-01-08T10:55:00Z',
    createdAt: '2026-01-08T10:50:00Z',
    lastAttemptAt: '2026-01-08T10:55:00Z',
    idempotencyKey: 'crm-sync-hubspot-20260108-001',
    correlationId: 'corr-sync-002',
    proofStatus: 'pending',
    traceId: 'TRACE-002',
  },
  {
    id: 'JOB-003',
    jobType: 'payment.retry',
    jobDescription: 'Retry failed payment for TechStart Inc',
    tenantId: 'TENANT-001',
    suiteId: 'SUITE-002',
    suiteName: 'Suite 240',
    officeId: 'OFF-003',
    officeName: 'Office 8',
    status: 'blocked',
    attempts: 2,
    maxAttempts: 3,
    nextRunAt: '2026-01-08T12:00:00Z',
    createdAt: '2026-01-08T09:00:00Z',
    lastAttemptAt: '2026-01-08T10:30:00Z',
    waitingReason: 'Blocked by safety policy - requires approval',
    idempotencyKey: 'pay-retry-techstart-20260108',
    policyDecisionRef: 'POL-001',
    correlationId: 'corr-pay-003',
    proofStatus: 'missing',
    traceId: 'TRACE-003',
  },
  {
    id: 'JOB-004',
    jobType: 'report.generate',
    jobDescription: 'Generate monthly revenue report',
    tenantId: 'TENANT-001',
    suiteId: 'SUITE-001',
    suiteName: 'Suite 120',
    officeId: 'OFF-001',
    officeName: 'Office 14',
    status: 'completed',
    attempts: 1,
    maxAttempts: 3,
    nextRunAt: '2026-02-01T00:00:00Z',
    createdAt: '2026-01-01T00:00:00Z',
    lastAttemptAt: '2026-01-01T00:05:00Z',
    idempotencyKey: 'report-rev-202601',
    receiptRef: 'RCP-108',
    correlationId: 'corr-report-004',
    proofStatus: 'ok',
    traceId: 'TRACE-004',
  },
  {
    id: 'JOB-005',
    jobType: 'notification.send',
    jobDescription: 'Send contract renewal reminder',
    tenantId: 'TENANT-001',
    suiteId: 'SUITE-001',
    suiteName: 'Suite 120',
    officeId: 'OFF-004',
    officeName: 'Office 31',
    status: 'retrying',
    attempts: 2,
    maxAttempts: 3,
    nextRunAt: '2026-01-08T11:30:00Z',
    createdAt: '2026-01-08T10:00:00Z',
    lastAttemptAt: '2026-01-08T10:45:00Z',
    waitingReason: 'Email provider temporarily unavailable',
    idempotencyKey: 'notif-renewal-gl-20260108',
    correlationId: 'corr-notif-005',
    proofStatus: 'pending',
    traceId: 'TRACE-005',
  },
  {
    id: 'JOB-006',
    jobType: 'data.cleanup',
    jobDescription: 'Archive old audit logs',
    tenantId: 'TENANT-001',
    suiteId: 'SUITE-002',
    suiteName: 'Suite 240',
    officeId: 'OFF-005',
    officeName: 'Office 12',
    status: 'failed',
    attempts: 3,
    maxAttempts: 3,
    nextRunAt: '2026-01-09T02:00:00Z',
    createdAt: '2026-01-08T02:00:00Z',
    lastAttemptAt: '2026-01-08T02:15:00Z',
    waitingReason: 'Max retries exceeded',
    idempotencyKey: 'cleanup-audit-20260108',
    correlationId: 'corr-cleanup-006',
    proofStatus: 'missing',
    traceId: 'TRACE-006',
  },
];

export const automations: Automation[] = [
  {
    id: 'AUTO-001',
    name: 'Invoice Reminder',
    description: 'Send reminder emails for overdue invoices',
    category: 'Billing',
    status: 'active',
    triggeredBy: 'schedule',
    lastRun: '2026-01-08T09:00:00Z',
    nextRun: '2026-01-08T11:00:00Z',
    runsTotal: 342,
    successRate: 98.5,
  },
  {
    id: 'AUTO-002',
    name: 'CRM Contact Sync',
    description: 'Synchronize contacts between platforms',
    category: 'Integration',
    status: 'active',
    triggeredBy: 'event',
    lastRun: '2026-01-08T10:55:00Z',
    runsTotal: 1250,
    successRate: 99.2,
  },
  {
    id: 'AUTO-003',
    name: 'Payment Recovery',
    description: 'Retry failed payments with backoff',
    category: 'Billing',
    status: 'active',
    triggeredBy: 'event',
    lastRun: '2026-01-08T10:30:00Z',
    runsTotal: 89,
    successRate: 72.4,
  },
  {
    id: 'AUTO-004',
    name: 'Monthly Reporting',
    description: 'Generate and distribute monthly reports',
    category: 'Reporting',
    status: 'active',
    triggeredBy: 'schedule',
    lastRun: '2026-01-01T00:05:00Z',
    nextRun: '2026-02-01T00:00:00Z',
    runsTotal: 24,
    successRate: 100,
  },
  {
    id: 'AUTO-005',
    name: 'Contract Renewal Alerts',
    description: 'Notify teams about upcoming renewals',
    category: 'Customer Success',
    status: 'active',
    triggeredBy: 'schedule',
    lastRun: '2026-01-08T10:45:00Z',
    nextRun: '2026-01-08T11:30:00Z',
    runsTotal: 156,
    successRate: 94.8,
  },
  {
    id: 'AUTO-006',
    name: 'Audit Log Archival',
    description: 'Archive and compress old audit logs',
    category: 'Maintenance',
    status: 'paused',
    triggeredBy: 'schedule',
    lastRun: '2026-01-08T02:15:00Z',
    nextRun: '2026-01-09T02:00:00Z',
    runsTotal: 45,
    successRate: 88.9,
  },
];

export const schedules: Schedule[] = [
  {
    id: 'SCHED-001',
    automationId: 'AUTO-001',
    automationName: 'Invoice Reminder',
    cronExpression: '0 9,11,15 * * *',
    cronReadable: 'Every day at 9 AM, 11 AM, and 3 PM',
    timezone: 'America/New_York',
    status: 'active',
    lastRun: '2026-01-08T09:00:00Z',
    nextRun: '2026-01-08T11:00:00Z',
  },
  {
    id: 'SCHED-002',
    automationId: 'AUTO-004',
    automationName: 'Monthly Reporting',
    cronExpression: '0 0 1 * *',
    cronReadable: 'First day of every month at midnight',
    timezone: 'UTC',
    status: 'active',
    lastRun: '2026-01-01T00:00:00Z',
    nextRun: '2026-02-01T00:00:00Z',
  },
  {
    id: 'SCHED-003',
    automationId: 'AUTO-005',
    automationName: 'Contract Renewal Alerts',
    cronExpression: '30 * * * *',
    cronReadable: 'Every hour at 30 minutes past',
    timezone: 'America/New_York',
    status: 'active',
    lastRun: '2026-01-08T10:30:00Z',
    nextRun: '2026-01-08T11:30:00Z',
  },
  {
    id: 'SCHED-004',
    automationId: 'AUTO-006',
    automationName: 'Audit Log Archival',
    cronExpression: '0 2 * * *',
    cronReadable: 'Every day at 2 AM',
    timezone: 'UTC',
    status: 'paused',
    lastRun: '2026-01-08T02:00:00Z',
    nextRun: '2026-01-09T02:00:00Z',
  },
];

export const automationFailures: AutomationFailure[] = [
  {
    id: 'FAIL-001',
    jobId: 'JOB-006',
    automationName: 'Audit Log Archival',
    failedAt: '2026-01-08T02:15:00Z',
    errorCode: 'STORAGE_QUOTA_EXCEEDED',
    errorMessage: 'Storage quota exceeded for archive bucket',
    errorMessageOperator: 'Not enough storage space for archives',
    attempts: 3,
    canRetry: false,
    officeName: 'Office 12',
    suiteName: 'Suite 240',
    correlationId: 'corr-cleanup-006',
  },
  {
    id: 'FAIL-002',
    jobId: 'JOB-003',
    automationName: 'Payment Recovery',
    failedAt: '2026-01-08T10:30:00Z',
    errorCode: 'POLICY_BLOCK',
    errorMessage: 'Payment exceeds auto-retry threshold ($500)',
    errorMessageOperator: 'Payment amount requires manual approval',
    attempts: 2,
    canRetry: true,
    officeName: 'Office 8',
    suiteName: 'Suite 240',
    correlationId: 'corr-pay-003',
  },
  {
    id: 'FAIL-003',
    jobId: 'JOB-005',
    automationName: 'Contract Renewal Alerts',
    failedAt: '2026-01-08T10:45:00Z',
    errorCode: 'PROVIDER_UNAVAILABLE',
    errorMessage: 'SendGrid API returned 503',
    errorMessageOperator: 'Email service is temporarily down',
    attempts: 2,
    canRetry: true,
    officeName: 'Office 31',
    suiteName: 'Suite 120',
    correlationId: 'corr-notif-005',
  },
];

export const traceEvents: TraceEvent[] = [
  // Trace for JOB-003 (blocked payment)
  {
    id: 'EVT-001',
    traceId: 'TRACE-003',
    timestamp: '2026-01-08T09:00:00Z',
    type: 'start',
    title: 'Payment retry initiated',
    details: 'Job started for payment retry on TechStart Inc account',
    status: 'success',
    actor: 'Scheduler',
  },
  {
    id: 'EVT-002',
    traceId: 'TRACE-003',
    timestamp: '2026-01-08T09:01:00Z',
    type: 'step',
    title: 'Fetching payment details',
    details: 'Retrieved failed payment record from database',
    status: 'success',
    actor: 'Payment Processor',
  },
  {
    id: 'EVT-003',
    traceId: 'TRACE-003',
    timestamp: '2026-01-08T09:02:00Z',
    type: 'policy',
    title: 'Policy check: Payment threshold',
    details: 'Payment amount $1,250 exceeds auto-retry limit of $500',
    status: 'blocked',
    actor: 'Policy Engine',
  },
  {
    id: 'EVT-004',
    traceId: 'TRACE-003',
    timestamp: '2026-01-08T09:02:30Z',
    type: 'approval',
    title: 'Approval request created',
    details: 'APR-005: Approve payment retry for $1,250',
    status: 'pending',
    actor: 'System',
  },
  // Trace for JOB-001 (queued invoice)
  {
    id: 'EVT-005',
    traceId: 'TRACE-001',
    timestamp: '2026-01-08T10:00:00Z',
    type: 'start',
    title: 'Invoice reminder scheduled',
    details: 'Job queued for Acme Corp invoice reminder',
    status: 'success',
    actor: 'Scheduler',
  },
];

// Trust Spine metrics for Dashboard
export const trustSpineMetrics = {
  receiptCoverage: {
    '24h': 94.2,
    '7d': 96.8,
  },
  missingReceipts: {
    count: 7,
    severity: 'medium' as const,
  },
  approvalsPending: {
    count: 3,
    oldestAge: '2h 15m',
  },
  policyBlocks: {
    '24h': 12,
  },
  providerErrors: {
    '24h': 5,
    p95Latency: 380,
  },
  outboxHealth: {
    depth: 12,
    lag: '2.3s',
  },
};

// Automation metrics
export const automationMetrics = {
  queueDepth: 12,
  oldestJobAge: '45m',
  completedToday: 847,
  retriesToday: 23,
  failedToday: 3,
  policyBlocks: 12,
};
