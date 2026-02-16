// Ecosystem Snapshot - Mock data matching canonical contracts
// Wire to ecosystem/control-plane APIs later

import type {
  StaffMember,
  SkillpackRef,
  ToolDef,
  ProviderDef,
  ToolCatalogEntry,
  StaffRuntimeConfig,
} from '@/contracts/ecosystem';

import staffData from './staff.json';
import skillpacksData from './skillpacks.json';
import toolsData from './tools.json';
import providersData from './providers.json';
import toolCatalogsData from './tool-catalogs.json';
import staffConfigsData from './staff-configs.json';

export const staff: StaffMember[] = staffData as StaffMember[];
export const skillpacks: SkillpackRef[] = skillpacksData as SkillpackRef[];
export const tools: ToolDef[] = toolsData as ToolDef[];
export const providers: ProviderDef[] = providersData as ProviderDef[];
export const toolCatalogs: Record<string, ToolCatalogEntry[]> = toolCatalogsData as Record<string, ToolCatalogEntry[]>;
export const staffConfigs: StaffRuntimeConfig[] = staffConfigsData as StaffRuntimeConfig[];

// Helper functions
export function getStaffById(staffId: string): StaffMember | undefined {
  return staff.find(s => s.staff_id === staffId);
}

export function getSkillpackById(skillpackId: string): SkillpackRef | undefined {
  return skillpacks.find(sp => sp.skillpack_id === skillpackId);
}

export function getToolById(toolId: string): ToolDef | undefined {
  return tools.find(t => t.tool_id === toolId);
}

export function getProviderById(providerId: string): ProviderDef | undefined {
  return providers.find(p => p.provider_id === providerId);
}

export function getStaffConfig(staffId: string): StaffRuntimeConfig | undefined {
  return staffConfigs.find(c => c.staff_id === staffId);
}

export function getToolCatalog(skillpackId: string): ToolCatalogEntry[] {
  return toolCatalogs[skillpackId] || [];
}

// Computed effective config
export function computeEffectiveTools(staffId: string): {
  tool: ToolCatalogEntry;
  source: 'base' | 'provider_overlay' | 'override';
}[] {
  const member = getStaffById(staffId);
  if (!member?.default_skillpack_id) return [];
  
  const catalog = getToolCatalog(member.default_skillpack_id);
  return catalog.map(tool => ({
    tool,
    source: 'base' as const,
  }));
}

export function computeRiskSummary(staffId: string): {
  low: number;
  medium: number;
  high: number;
  critical: number;
} {
  const member = getStaffById(staffId);
  if (!member?.default_skillpack_id) {
    return { low: 0, medium: 0, high: 0, critical: 0 };
  }
  
  const catalog = getToolCatalog(member.default_skillpack_id);
  return catalog.reduce(
    (acc, tool) => {
      acc[tool.risk] = (acc[tool.risk] || 0) + 1;
      return acc;
    },
    { low: 0, medium: 0, high: 0, critical: 0 }
  );
}

export function getExpectedReceipts(staffId: string): string[] {
  const member = getStaffById(staffId);
  if (!member?.default_skillpack_id) return [];
  
  const catalog = getToolCatalog(member.default_skillpack_id);
  return catalog
    .filter(tool => tool.receipted)
    .map(tool => `${member.default_skillpack_id}.${tool.name}`);
}
