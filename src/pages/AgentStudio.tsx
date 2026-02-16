import { useState } from 'react';
import { useSystem } from '@/contexts/SystemContext';
import { 
  staff, 
  staffConfigs, 
  providers, 
  getSkillpackById, 
  getToolCatalog 
} from '@/ecosystem/snapshot';
import type { StaffRuntimeConfig } from '@/contracts/ecosystem';
import { AgentListView } from '@/components/agent-studio/AgentListView';
import { AgentBuildView } from '@/components/agent-studio/AgentBuildView';

export default function AgentStudio() {
  const { viewMode } = useSystem();
  const isOperator = viewMode === 'operator';
  
  const [selectedStaffId, setSelectedStaffId] = useState<string | null>(null);
  const [configs, setConfigs] = useState<StaffRuntimeConfig[]>(staffConfigs);

  const selectedMember = staff.find(s => s.staff_id === selectedStaffId);
  const selectedConfig = configs.find(c => c.staff_id === selectedStaffId);
  const skillpack = selectedMember?.default_skillpack_id 
    ? getSkillpackById(selectedMember.default_skillpack_id) 
    : null;
  const toolCatalog = selectedMember?.default_skillpack_id
    ? getToolCatalog(selectedMember.default_skillpack_id)
    : [];

  const handleConfigChange = (newConfig: StaffRuntimeConfig) => {
    setConfigs(prev => 
      prev.map(c => c.staff_id === newConfig.staff_id ? newConfig : c)
    );
  };

  // Build view — when an agent is selected
  if (selectedMember && selectedConfig) {
    return (
      <AgentBuildView
        member={selectedMember}
        config={selectedConfig}
        toolCatalog={toolCatalog}
        providers={providers}
        skillpack={skillpack || null}
        onConfigChange={handleConfigChange}
        onBack={() => setSelectedStaffId(null)}
      />
    );
  }

  // List view — staff grid (like Anam Personas)
  return (
    <AgentListView
      staff={staff}
      configs={configs}
      onSelect={setSelectedStaffId}
    />
  );
}
