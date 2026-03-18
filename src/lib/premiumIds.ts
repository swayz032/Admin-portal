/** Premium ID formatters — human-readable, sortable, memorable */

export function formatIncidentId(id: string): string {
  return `INC-${id.substring(0, 8).toUpperCase()}`;
}

export function formatReceiptId(id: string): string {
  return `RCP-${id.substring(0, 8).toUpperCase()}`;
}

export function formatProviderCallId(id: string): string {
  return `PCL-${id.substring(0, 8).toUpperCase()}`;
}

export function formatCorrelationId(id: string): string {
  return `TRC-${id.substring(0, 8).toUpperCase()}`;
}

export function formatWorkflowId(id: string): string {
  return `WFL-${id.substring(0, 8).toUpperCase()}`;
}
