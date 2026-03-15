/**
 * Route page for /control-plane/robots/:id
 * Extracts runId from URL params and renders RobotRunViewer.
 */

import { useParams, useNavigate } from 'react-router-dom';
import { PageHero } from '@/components/shared/PageHero';
import { RobotRunViewer } from '@/components/control-plane/RobotRunViewer';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Bot } from 'lucide-react';

export default function RobotRunPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  return (
    <div className="space-y-6">
      <PageHero
        title="Robot Verification"
        subtitle={id ? `Run ${id}` : 'Robot run details'}
        icon={<Bot className="h-6 w-6" />}
        action={
          <Button variant="outline" onClick={() => navigate(-1)} className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
        }
      />
      <RobotRunViewer robotRunId={id ?? ''} />
    </div>
  );
}
