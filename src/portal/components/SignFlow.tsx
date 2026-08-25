import SignEnvelope from '../../portal/components/SignEnvelope';

interface Props {
  mode: 'client' | 'admin';
}

export default function SignFlow({ mode }: Props) {
  return <SignEnvelope mode={mode} />;
}
