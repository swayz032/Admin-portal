export type FrontendContractSeverity = 'critical' | 'high' | 'medium';

export interface FrontendContract {
  id: string;
  label: string;
  description: string;
  severity: FrontendContractSeverity;
  routes: string[];
  componentHints: string[];
  expectedEvents: string[];
  failureEvents: string[];
}

export const FRONTEND_CONTRACTS: FrontendContract[] = [
  {
    id: 'auth.login',
    label: 'Auth Login',
    description: 'The sign-in shell must load, accept input, and transition into the app without a blank screen.',
    severity: 'critical',
    routes: ['/login', '/auth'],
    componentHints: ['auth', 'login'],
    expectedEvents: ['page_view', 'button_press'],
    failureEvents: ['page_error'],
  },
  {
    id: 'desktop.home',
    label: 'Desktop Home Shell',
    description: 'The authenticated home shell must render and stay interactive after hydration.',
    severity: 'critical',
    routes: ['/', '/home'],
    componentHints: ['desktophome', 'home'],
    expectedEvents: ['page_view'],
    failureEvents: ['page_error'],
  },
  {
    id: 'ava.voice',
    label: 'Ava Voice Flow',
    description: 'Ava dock, desk, or session entry should connect cleanly without retry storms.',
    severity: 'critical',
    routes: [],
    componentHints: ['ava', 'voice', 'dock'],
    expectedEvents: ['dock_expand', 'agent_connect', 'chat_send'],
    failureEvents: ['agent_connect_retry', 'page_error'],
  },
  {
    id: 'finn.finance',
    label: 'Finn Finance Flow',
    description: 'Finn surfaces and finance routes should render and respond to user actions.',
    severity: 'high',
    routes: ['/finance-hub', '/finance-hub/connections'],
    componentHints: ['finn', 'finance'],
    expectedEvents: ['page_view', 'button_press'],
    failureEvents: ['page_error'],
  },
  {
    id: 'session.voice',
    label: 'Voice Session',
    description: 'Voice session setup must capture wizard choices, mic actions, and session start without disconnect loops.',
    severity: 'critical',
    routes: ['/session/start', '/session/voice'],
    componentHints: ['voice-session', 'voice', 'session'],
    expectedEvents: ['session_mode_select', 'mic_toggle', 'session_start', 'agent_connect'],
    failureEvents: ['agent_connect_retry', 'page_error'],
  },
  {
    id: 'session.conference',
    label: 'Conference Session',
    description: 'Conference lobby/live flows must mount and transition into a connected session cleanly.',
    severity: 'critical',
    routes: ['/session/conference-lobby', '/session/conference-live'],
    componentHints: ['conference', 'livekit', 'session'],
    expectedEvents: ['session_start', 'agent_connect'],
    failureEvents: ['agent_connect_retry', 'page_error'],
  },
  {
    id: 'finance.connections',
    label: 'Provider Connections',
    description: 'Connection and disconnection flows for finance providers must stay responsive.',
    severity: 'high',
    routes: ['/finance-hub/connections'],
    componentHints: ['provider', 'connection', 'finance'],
    expectedEvents: ['provider_connect', 'provider_disconnect', 'provider_add_bank'],
    failureEvents: ['page_error'],
  },
  {
    id: 'canvas.workspace',
    label: 'Canvas Workspace',
    description: 'Canvas interactions must emit runway and fallback telemetry without SLO drift or errors.',
    severity: 'high',
    routes: ['/canvas'],
    componentHints: ['canvas'],
    expectedEvents: ['canvas.stage_open', 'canvas.runway_step', 'canvas.lens_open'],
    failureEvents: ['canvas.error', 'canvas.slo_violation', 'canvas.fallback_trigger'],
  },
];
