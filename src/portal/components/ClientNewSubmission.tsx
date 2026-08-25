import PortalChrome from './PortalChrome';
import SubmissionForm from './SubmissionForm';

export default function ClientNewSubmission() {
  return (
    <PortalChrome requireRole="client" active="new">
      <SubmissionForm mode="create" />
    </PortalChrome>
  );
}
