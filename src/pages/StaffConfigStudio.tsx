import { useState, useEffect } from 'react';
import { useSystem } from '@/contexts/SystemContext';
import { 
  staff, 
  staffConfigs, 
  providers, 
  getSkillpackById, 
  getToolCatalog 
} from '@/ecosystem/snapshot';
import type { StaffMember, StaffRuntimeConfig } from '@/contracts/ecosystem';
import { StaffList } from '@/components/staff-studio/StaffList';
import { ConfigEditor } from '@/components/staff-studio/ConfigEditor';
import { RuntimePreview } from '@/components/staff-studio/RuntimePreview';
import { PurposeStrip } from '@/components/shared/PurposeStrip';
import { OperatorEngineerToggle } from '@/components/shared/OperatorEngineerToggle';

export default function StaffConfigStudio() {
  const { viewMode } = useSystem();
  const isOperator = viewMode === 'operator';
  
  const [selectedStaffId, setSelectedStaffId] = useState<string | null>(
    staff.length > 0 ? staff[0].staff_id : null
  );
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

  return (
    <div className="h-[calc(100vh-3.5rem)] flex flex-col">
      {/* Header */}
      <div className="p-6 border-b border-border bg-background">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">
              {isOperator ? 'Staff Config Studio' : 'Staff Runtime Configuration'}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {isOperator 
                ? 'Configure how your AI team members work'
                : 'Manage staff_runtime_config objects'
              }
            </p>
          </div>
          <OperatorEngineerToggle />
        </div>
        <PurposeStrip 
          operatorPurpose="Choose a team member, adjust their settings, and see how they'll work."
          engineerPurpose="Select staff_id → edit runtime_config → preview effective_config computation."
        />
      </div>

      {/* Three-Panel Layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: Staff List */}
        <div className="w-72 flex-shrink-0">
          <StaffList
            staff={staff}
            configs={configs}
            selectedId={selectedStaffId}
            onSelect={setSelectedStaffId}
          />
        </div>

        {/* Center: Config Editor */}
        <div className="flex-1 min-w-0 bg-background">
          {selectedMember && selectedConfig ? (
            <ConfigEditor
              member={selectedMember}
              config={selectedConfig}
              toolCatalog={toolCatalog}
              providers={providers}
              skillpack={skillpack || null}
              onConfigChange={handleConfigChange}
            />
          ) : (
            <div className="h-full flex items-center justify-center">
              <div className="text-center">
                <p className="text-muted-foreground">
                  {isOperator ? 'Select a team member to configure' : 'Select staff_id to edit'}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Right: Runtime Preview */}
        <div className="w-80 flex-shrink-0">
          {selectedMember && selectedConfig ? (
            <RuntimePreview
              member={selectedMember}
              config={selectedConfig}
              toolCatalog={toolCatalog}
              skillpack={skillpack || null}
            />
          ) : (
            <div className="h-full bg-surface-1 border-l border-border flex items-center justify-center">
              <p className="text-xs text-muted-foreground">
                {isOperator ? 'Preview will appear here' : 'effective_config preview'}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
