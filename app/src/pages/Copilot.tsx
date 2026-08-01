import { Chat } from '@/components/Chat';
import { useFpipAuth } from '@/auth/useFpipAuth';
import { useRole } from '@/context/RoleContext';

/** Single FPIP Assistant — specialists run underneath via intent routing. */
export function Copilot() {
  const { account } = useFpipAuth();
  const { role } = useRole();

  const userContext = {
    username: account?.username ?? account?.name ?? 'fpip-user',
    role: role.id === 'supplier' ? ('supplier' as const) : ('internal' as const),
  };

  return (
    <Chat
      userContext={userContext}
      placeholder="Ask FPIP Assistant about spend, contracts, tenders, risk, compliance…"
    />
  );
}
