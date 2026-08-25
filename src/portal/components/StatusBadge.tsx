import { STATUS_LABEL, type SubmissionStatus } from '../lib/types';

export default function StatusBadge({ status }: { status: SubmissionStatus }) {
  return <span className={`badge badge-${status}`}>{STATUS_LABEL[status]}</span>;
}
