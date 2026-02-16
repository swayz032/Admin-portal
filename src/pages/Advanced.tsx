import { useState, useEffect } from 'react';
import { Panel } from '@/components/shared/Panel';
import { Button } from '@/components/ui/button';
import { ModeText } from '@/components/shared/ModeText';
import { StatusChip } from '@/components/shared/StatusChip';
import { AlertTriangle, FileSearch, Shield, Key, Download, Lock, RefreshCw, CheckCircle, XCircle, Package } from 'lucide-react';
import { useSystem } from '@/contexts/SystemContext';
import { getEcosystemSyncStatus } from '@/services/apiClient';
import { EcosystemSyncStatus } from '@/contracts';
import { formatTimeAgo } from '@/lib/formatters';

export default function Advanced() {
  const { systemState, viewMode } = useSystem();
  const [syncStatus, setSyncStatus] = useState<EcosystemSyncStatus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSyncStatus();
  }, []);

  const loadSyncStatus = async () => {
    setLoading(true);
    const status = await getEcosystemSyncStatus();
    setSyncStatus(status);
    setLoading(false);
  };

  const tools = [
    {
      id: 'deep-logs',
      title: 'Deep Provider Call Logs',
      description: 'Access detailed, unredacted provider call logs for debugging and forensic analysis.',
      icon: FileSearch,
      restricted: true,
    },
    {
      id: 'integrity',
      title: 'Receipt Integrity Verification',
      description: 'Verify the cryptographic integrity of stored receipts and audit trail entries.',
      icon: Shield,
      restricted: systemState.safetyMode,
    },
    {
      id: 'token-ledger',
      title: 'Token and Permission Ledger',
      description: 'View all active tokens, API keys, and permission grants across connected providers.',
      icon: Key,
      restricted: true,
    },
    {
      id: 'export',
      title: 'Data Export Tools',
      description: 'Export customer data, receipts, and audit logs in various formats for compliance.',
      icon: Download,
      restricted: false,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="page-header">
        <h1 className="page-title">Advanced</h1>
        <p className="page-subtitle">
          <ModeText 
            operator="Restricted tools for advanced operations" 
            engineer="Advanced debugging and ecosystem sync" 
          />
        </p>
      </div>

      {/* Ecosystem Sync Panel */}
      <Panel title={viewMode === 'operator' ? 'System Sync Status' : 'Ecosystem Sync'}>
        {loading ? (
          <div className="loading-state">Loading sync status...</div>
        ) : syncStatus && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-3 rounded-lg bg-surface-2 border border-border">
                <div className="flex items-center gap-2 mb-1">
                  <Package className="h-4 w-4 text-primary" />
                  <span className="text-xs text-muted-foreground">
                    <ModeText operator="Version" engineer="Pack Version" />
                  </span>
                </div>
                <p className="font-mono text-sm">{syncStatus.pack_version}</p>
              </div>
              
              <div className="p-3 rounded-lg bg-surface-2 border border-border">
                <div className="flex items-center gap-2 mb-1">
                  {syncStatus.contracts_loaded ? (
                    <CheckCircle className="h-4 w-4 text-success" />
                  ) : (
                    <XCircle className="h-4 w-4 text-destructive" />
                  )}
                  <span className="text-xs text-muted-foreground">
                    <ModeText operator="Contracts" engineer="Contracts Loaded" />
                  </span>
                </div>
                <p className="text-sm font-medium">
                  {syncStatus.contracts_loaded ? 'YES' : 'NO'}
                </p>
              </div>
              
              <div className="p-3 rounded-lg bg-surface-2 border border-border">
                <div className="flex items-center gap-2 mb-1">
                  {syncStatus.schema_drift_detected ? (
                    <AlertTriangle className="h-4 w-4 text-warning" />
                  ) : (
                    <CheckCircle className="h-4 w-4 text-success" />
                  )}
                  <span className="text-xs text-muted-foreground">
                    <ModeText operator="Schema Status" engineer="Schema Drift" />
                  </span>
                </div>
                <p className="text-sm font-medium">
                  {syncStatus.schema_drift_detected ? 'Drift Detected' : 'In Sync'}
                </p>
              </div>
              
              <div className="p-3 rounded-lg bg-surface-2 border border-border">
                <div className="flex items-center gap-2 mb-1">
                  <RefreshCw className="h-4 w-4 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">
                    <ModeText operator="Last Check" engineer="Last Sync Check" />
                  </span>
                </div>
                <p className="text-sm">{formatTimeAgo(syncStatus.last_sync_check)}</p>
              </div>
            </div>

            {syncStatus.schema_drift_detected && syncStatus.drift_warnings.length > 0 && (
              <div className="p-4 rounded-lg bg-warning/10 border border-warning/30">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="h-5 w-5 text-warning mt-0.5" />
                  <div>
                    <h3 className="text-sm font-medium text-warning">
                      <ModeText operator="Sync Issues Detected" engineer="Schema Drift Warnings" />
                    </h3>
                    <ul className="mt-2 space-y-1">
                      {syncStatus.drift_warnings.map((warning, i) => (
                        <li key={i} className="text-sm text-muted-foreground">• {warning}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            )}

            <div className="flex justify-end">
              <Button variant="outline" size="sm" onClick={loadSyncStatus}>
                <RefreshCw className="h-4 w-4 mr-2" />
                <ModeText operator="Check Now" engineer="Refresh Sync" />
              </Button>
            </div>
          </div>
        )}
      </Panel>

      {/* Warning Banner */}
      <div className="p-4 rounded-lg bg-warning/10 border border-warning/30">
        <div className="flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-warning mt-0.5" />
          <div>
            <h3 className="text-sm font-medium text-warning">Restricted Area</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Changes made in this section may require additional approvals. Actions are logged and audited. 
              Use caution when accessing sensitive data or modifying system configurations.
            </p>
          </div>
        </div>
      </div>

      {/* Tools Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {tools.map((tool) => (
          <Panel key={tool.id}>
            <div className="flex items-start gap-4">
              <div className={`p-3 rounded-lg ${tool.restricted ? 'bg-warning/10' : 'bg-surface-2'}`}>
                <tool.icon className={`h-6 w-6 ${tool.restricted ? 'text-warning' : 'text-primary'}`} />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="text-base font-medium">{tool.title}</h3>
                  {tool.restricted && (
                    <Lock className="h-4 w-4 text-warning" />
                  )}
                </div>
                <p className="text-sm text-muted-foreground mb-4">{tool.description}</p>
                <Button 
                  variant={tool.restricted ? 'outline' : 'default'}
                  className={tool.restricted ? 'border-warning/30 text-warning hover:bg-warning/10' : ''}
                  disabled={tool.restricted && tool.id !== 'deep-logs'}
                >
                  {tool.restricted ? 'Request Access' : 'Open Tool'}
                </Button>
              </div>
            </div>
          </Panel>
        ))}
      </div>

      {/* Access Control */}
      <Panel title="Access Control">
        <div className="space-y-4">
          <div className="flex items-center justify-between p-3 rounded-lg bg-surface-1 border border-border">
            <div>
              <p className="text-sm font-medium">Current Role</p>
              <p className="text-xs text-muted-foreground">Operations Administrator</p>
            </div>
            <StatusChip status="success" label="Active" />
          </div>
          <div className="flex items-center justify-between p-3 rounded-lg bg-surface-1 border border-border">
            <div>
              <p className="text-sm font-medium">Safety Mode Override</p>
              <p className="text-xs text-muted-foreground">Ability to bypass safety restrictions</p>
            </div>
            <StatusChip status="critical" label="Denied" />
          </div>
          <div className="flex items-center justify-between p-3 rounded-lg bg-surface-1 border border-border">
            <div>
              <p className="text-sm font-medium">Audit Log Access</p>
              <p className="text-xs text-muted-foreground">View and export audit trail</p>
            </div>
            <StatusChip status="success" label="Granted" />
          </div>
        </div>
      </Panel>
    </div>
  );
}
