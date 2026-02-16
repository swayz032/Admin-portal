import { useEffect, useState, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { OpsDeskProvider, useOpsDesk } from '@/contexts/OpsDeskContext';
import { useSystem } from '@/contexts/SystemContext';
import { AvaHero } from '@/components/opsdesk/AvaHero';
import { StickyJumpBar } from '@/components/opsdesk/StickyJumpBar';
import { PipelineSteps } from '@/components/opsdesk/PipelineSteps';
import { ProofOfSuccess } from '@/components/opsdesk/ProofOfSuccess';
import { ReleaseControl } from '@/components/opsdesk/ReleaseControl';
import { OpsDeskReceipts } from '@/components/opsdesk/OpsDeskReceipts';
import { TranscriptPanel } from '@/components/opsdesk/TranscriptPanel';
import { ContextAttachments } from '@/components/opsdesk/ContextAttachments';
import { OpsDeskNotes } from '@/components/opsdesk/OpsDeskNotes';
import { OperatorEngineerToggle } from '@/components/opsdesk/OperatorEngineerToggle';
import { ModeText } from '@/components/shared/ModeText';
import { useIncidents, useApprovals, useCustomers, useProviders } from '@/hooks/useAdminData';
import { SectionLoadingState } from '@/components/shared/PageLoadingState';

function LLMOpsDeskContent() {
  const [searchParams] = useSearchParams();
  const { addAttachment, attachments, seedDemoData, receipts } = useOpsDesk();
  const { viewMode } = useSystem();
  const { data: incidents } = useIncidents();
  const { data: approvals } = useApprovals();
  const { data: customers } = useCustomers();
  const { data: providers } = useProviders();
  const [showJumpBar, setShowJumpBar] = useState(false);
  const heroRef = useRef<HTMLDivElement>(null);
  
  // Seed demo data on mount if empty
  useEffect(() => {
    if (receipts.length === 0) {
      seedDemoData();
    }
  }, [receipts.length, seedDemoData]);
  
  // Handle scroll for sticky jump bar
  useEffect(() => {
    const handleScroll = () => {
      if (heroRef.current) {
        const heroBottom = heroRef.current.getBoundingClientRect().bottom;
        setShowJumpBar(heroBottom < 0);
      }
    };
    
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);
  
  // Handle deep-linking via query params
  useEffect(() => {
    const incidentId = searchParams.get('incidentId');
    const customerId = searchParams.get('customerId');
    const approvalId = searchParams.get('approvalId');
    // Support both providerId (preferred) and legacy provider param
    const providerId = searchParams.get('providerId') ?? searchParams.get('provider');
    
    if (incidentId && !attachments.some(a => a.entityId === incidentId)) {
      const incident = incidents.find(i => i.id === incidentId);
      if (incident) {
        addAttachment({ type: 'incident', label: `Incident ${incident.id}`, entityId: incident.id });
      }
    }
    if (customerId && !attachments.some(a => a.entityId === customerId)) {
      const customer = customers.find(c => c.id === customerId);
      if (customer) {
        addAttachment({ type: 'customer', label: customer.name, entityId: customer.id });
      }
    }
    if (approvalId && !attachments.some(a => a.entityId === approvalId)) {
      const approval = approvals.find(a => a.id === approvalId);
      if (approval) {
        addAttachment({ type: 'approval', label: `Approval ${approval.id}`, entityId: approval.id });
      }
    }
    if (providerId && !attachments.some(a => a.entityId === providerId)) {
      const provider = providers.find(p => p.name.toLowerCase() === providerId.toLowerCase());
      if (provider) {
        addAttachment({ type: 'provider', label: provider.name, entityId: provider.id });
      }
    }
  }, [searchParams, addAttachment, attachments]);
  
  return (
    <div className="min-h-screen bg-background">
      {/* Sticky Jump Bar */}
      <StickyJumpBar visible={showJumpBar} />
      
      {/* Section A: Ava Hero (full viewport) */}
      <div ref={heroRef}>
        <AvaHero />
      </div>
      
      {/* Section B: Workspace Grid */}
      <div className="max-w-6xl mx-auto px-6 py-8 space-y-6">
        {/* Header with title and toggle */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-text-primary">
              <ModeText operator="Workflow" engineer="Workspace" />
            </h2>
            <p className="text-sm text-text-secondary">
              <ModeText 
                operator="Follow the steps below to resolve issues" 
                engineer="Pipeline steps, proof of success, and release controls" 
              />
            </p>
          </div>
          {/* Mobile-only toggle - Header has desktop version */}
          <div className="md:hidden">
            <OperatorEngineerToggle />
          </div>
        </div>
        
        {/* Row 1: Pipeline + Proof */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div id="section-pipeline" className="lg:col-span-8">
            <PipelineSteps />
          </div>
          <div id="section-proof" className="lg:col-span-4">
            <ProofOfSuccess />
          </div>
        </div>
        
        {/* Row 2: Notes + Transcript */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div id="section-notes">
            <OpsDeskNotes />
          </div>
          <div id="section-transcript">
            <TranscriptPanel />
          </div>
        </div>
        
        {/* Row 3: Context + Release */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div id="section-context">
            <ContextAttachments />
          </div>
          <div id="section-release">
            <ReleaseControl />
          </div>
        </div>
        
        {/* Row 4: Receipts (full width) */}
        <div id="section-receipts">
          <OpsDeskReceipts />
        </div>
      </div>
    </div>
  );
}

export default function LLMOpsDesk() {
  return (
    <OpsDeskProvider>
      <LLMOpsDeskContent />
    </OpsDeskProvider>
  );
}
