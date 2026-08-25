import { useMemo } from 'react';
import PortalChrome from './PortalChrome';
import SubmissionForm from './SubmissionForm';

function getId() {
  return new URLSearchParams(window.location.search).get('id') || '';
}

export default function ClientSubmissionPage() {
  const id = useMemo(() => (typeof window !== 'undefined' ? getId() : ''), []);
  return (
    <PortalChrome requireRole="client" active="client">
      {id ? <SubmissionForm mode="edit" submissionId={id} /> : <div className="portal-alert portal-alert-error">Missing submission id.</div>}
    </PortalChrome>
  );
}
