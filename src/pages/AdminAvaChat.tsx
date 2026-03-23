/**
 * Admin Ava Chat — full-page AI chat interface.
 *
 * Chat-only layout (no sidebar). Voice modal opens as popup.
 * Council, robots, patches render inline in chat messages.
 *
 * Deep-links: ?incidentId=X, ?customerId=X, ?approvalId=X, ?providerId=X
 * Auto-attaches context and prefills Ava prompt on mount.
 */

import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { OpsDeskProvider, useOpsDesk } from '@/contexts/OpsDeskContext';
import { AdminAvaChatProvider, useAdminAvaChat } from '@/contexts/AdminAvaChatContext';
import { ChatThread } from '@/components/admin-ava/ChatThread';
import { VoiceModal } from '@/components/admin-ava/VoiceModal';

function ChatWithDeepLinks() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { addAttachment } = useOpsDesk();
  const { sendMessage } = useAdminAvaChat();
  const [voiceAutoOpen, setVoiceAutoOpen] = useState(false);

  useEffect(() => {
    const incidentId = searchParams.get('incidentId');
    const customerId = searchParams.get('customerId');
    const approvalId = searchParams.get('approvalId');
    const providerId = searchParams.get('providerId') ?? searchParams.get('provider');

    let prefill = '';

    if (incidentId) {
      addAttachment({ type: 'incident', label: `Incident ${incidentId}`, entityId: incidentId });
      prefill = `Analyze incident ${incidentId}`;
    }
    if (customerId) {
      addAttachment({ type: 'customer', label: `Customer ${customerId}`, entityId: customerId });
      if (!prefill) prefill = `Show details for customer ${customerId}`;
    }
    if (approvalId) {
      addAttachment({ type: 'approval', label: `Approval ${approvalId}`, entityId: approvalId });
      if (!prefill) prefill = `Review approval ${approvalId}`;
    }
    if (providerId) {
      addAttachment({ type: 'provider', label: `Provider ${providerId}`, entityId: providerId });
      if (!prefill) prefill = `Check provider ${providerId} health`;
    }

    // Auto-send prefill if deep-link was present, then clear params
    if (prefill) {
      sendMessage(prefill);
      setSearchParams({}, { replace: true });
    }
    // Run once on mount only
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="h-[calc(100vh-64px)] bg-background">
      <ChatThread />
      <VoiceModal open={voiceAutoOpen} onClose={() => setVoiceAutoOpen(false)} />
    </div>
  );
}

export default function AdminAvaChat() {
  return (
    <OpsDeskProvider>
      <AdminAvaChatProvider>
        <ChatWithDeepLinks />
      </AdminAvaChatProvider>
    </OpsDeskProvider>
  );
}
