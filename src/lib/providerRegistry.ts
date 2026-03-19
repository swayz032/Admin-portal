/**
 * Aspire provider registry — maps receipt_type prefixes to real provider integrations.
 * Source of truth for which providers exist in the Aspire ecosystem.
 */

export interface ProviderInfo {
  id: string;
  name: string;
  category: 'payments' | 'banking' | 'ai' | 'communication' | 'documents' | 'infrastructure' | 'search';
  icon?: string;
}

export const PROVIDER_REGISTRY: ProviderInfo[] = [
  { id: 'stripe', name: 'Stripe', category: 'payments' },
  { id: 'plaid', name: 'Plaid', category: 'banking' },
  { id: 'quickbooks', name: 'QuickBooks', category: 'payments' },
  { id: 'openai', name: 'OpenAI', category: 'ai' },
  { id: 'supabase', name: 'Supabase', category: 'infrastructure' },
  { id: 'aws', name: 'AWS', category: 'infrastructure' },
  { id: 'elevenlabs', name: 'ElevenLabs', category: 'ai' },
  { id: 'deepgram', name: 'Deepgram', category: 'ai' },
  { id: 'livekit', name: 'LiveKit', category: 'communication' },
  { id: 'pandadoc', name: 'PandaDoc', category: 'documents' },
  { id: 'polaris', name: 'PolarisM', category: 'communication' },
  { id: 'twilio', name: 'Twilio', category: 'communication' },
  { id: 'gusto', name: 'Gusto', category: 'payments' },
  { id: 'brave', name: 'Brave Search', category: 'search' },
  { id: 'tavily', name: 'Tavily', category: 'search' },
  { id: 'domain', name: 'Domain Rail', category: 'infrastructure' },
];

const PREFIX_MAP: Record<string, string> = {
  'stripe': 'stripe',
  'plaid': 'plaid',
  'qbo': 'quickbooks',
  'quickbooks': 'quickbooks',
  'openai': 'openai',
  'gpt': 'openai',
  'supabase': 'supabase',
  'aws': 'aws',
  's3': 'aws',
  'elevenlabs': 'elevenlabs',
  'deepgram': 'deepgram',
  'livekit': 'livekit',
  'pandadoc': 'pandadoc',
  'polaris': 'polaris',
  'twilio': 'twilio',
  'gusto': 'gusto',
  'brave': 'brave',
  'tavily': 'tavily',
  'domain': 'domain',
  'puppeteer': 'aws', // PDF gen uses S3 storage
  'calendar': 'supabase', // calendar is Supabase PostgREST
  'internal.office': 'polaris',
  'google': 'brave', // google_places searches go through Brave/search
  'tomtom': 'brave',
  'here': 'brave',
  'foursquare': 'brave',
  'search': 'brave', // meta-executor search.* receipts
  'n8n': 'supabase', // n8n workflow receipts are internal infra
  'anam': 'elevenlabs', // Anam avatar uses ElevenLabs pipeline
  'moov': 'plaid', // Moov money movement grouped with banking
};

/**
 * Map a receipt_type string to a provider ID.
 * E.g., "stripe.invoice.create" -> "stripe", "qbo.read_company" -> "quickbooks"
 */
export function mapReceiptTypeToProvider(receiptType: string): string | null {
  if (!receiptType) return null;
  const lower = receiptType.toLowerCase();

  // Try exact prefix match (longest first)
  const sorted = Object.keys(PREFIX_MAP).sort((a, b) => b.length - a.length);
  for (const prefix of sorted) {
    if (lower.startsWith(prefix)) {
      return PREFIX_MAP[prefix];
    }
  }

  // Check if the first segment matches a known provider
  const firstSegment = lower.split('.')[0].split('_')[0];
  if (PREFIX_MAP[firstSegment]) return PREFIX_MAP[firstSegment];

  return null;
}

/**
 * Get provider display info by ID.
 */
export function getProviderInfo(providerId: string): ProviderInfo | undefined {
  return PROVIDER_REGISTRY.find(p => p.id === providerId);
}
