/** Premium ID formatters — human-readable, sortable, memorable */

export function formatIncidentId(id: string | null | undefined): string {
  if (!id) return 'INC-????';
  return `INC-${id.substring(0, 8).toUpperCase()}`;
}

export function formatReceiptId(id: string | null | undefined): string {
  if (!id) return 'RCP-????';
  return `RCP-${id.substring(0, 8).toUpperCase()}`;
}

export function formatProviderCallId(id: string | null | undefined): string {
  if (!id) return 'PCL-????';
  return `PCL-${id.substring(0, 8).toUpperCase()}`;
}

export function formatCorrelationId(id: string | null | undefined): string {
  if (!id) return 'TRC-????';
  return `TRC-${id.substring(0, 8).toUpperCase()}`;
}

export function formatWorkflowId(id: string | null | undefined): string {
  if (!id) return 'WFL-????';
  return `WFL-${id.substring(0, 8).toUpperCase()}`;
}
