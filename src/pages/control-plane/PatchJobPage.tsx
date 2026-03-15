/**
 * Route page for /control-plane/patches/:id
 * Extracts patchJobId from URL params and renders PatchDiffViewer.
 */

import { useParams, useNavigate } from 'react-router-dom';
import { PageHero } from '@/components/shared/PageHero';
import { PatchDiffViewer } from '@/components/control-plane/PatchDiffViewer';
import { Button } from '@/components/ui/button';
import { ArrowLeft, FileCode2 } from 'lucide-react';

export default function PatchJobPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  return (
    <div className="space-y-6">
      <PageHero
        title="Patch Diff Viewer"
        subtitle={id ? `Job ${id}` : 'Patch job details'}
        icon={<FileCode2 className="h-6 w-6" />}
        action={
          <Button variant="outline" onClick={() => navigate(-1)} className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
        }
      />
      <PatchDiffViewer patchJobId={id ?? ''} />
    </div>
  );
}
