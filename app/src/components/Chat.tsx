import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { Icon } from './Icons';
import { invokeAgentStream, type UserContext } from '@/api/agentService';
import { classNames } from '@/lib/format';
import { routeAssistantIntent } from '@/lib/rbac';

interface ChatMessage {
  role: 'user' | 'agent';
  content: string;
  /** Specialist tool used under the unified assistant (hidden from picker UI) */
  routedTo?: string;
}

interface ChatProps {
  userContext: UserContext;
  placeholder?: string;
}

const CAPABILITIES = [
  { label: 'Spend & budgets', icon: 'spend' as const },
  { label: 'Tenders & bids', icon: 'cart' as const },
  { label: 'Contracts', icon: 'contract' as const },
  { label: 'Compliance', icon: 'compliance' as const },
  { label: 'Risk', icon: 'risk' as const },
  { label: 'Supplier docs', icon: 'building' as const },
];

export function Chat({
  userContext,
  placeholder = 'Ask about spend, contracts, tenders, risk, compliance…',
}: ChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [threadId, setThreadId] = useState<string | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [activeRoute, setActiveRoute] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  async function sendMessage(text: string) {
    if (!text.trim() || loading) return;
    const message = text.trim();
    const agentId = routeAssistantIntent(message);
    setInput('');
    setError(null);
    setActiveRoute(agentId);
    setMessages((prev) => [...prev, { role: 'user', content: message }]);
    setLoading(true);
    setMessages((prev) => [...prev, { role: 'agent', content: '', routedTo: agentId }]);

    await invokeAgentStream({
      agentId,
      message,
      threadId,
      userContext,
      onToken: (token) => {
        setMessages((prev) => {
          const next = [...prev];
          const last = next[next.length - 1];
          if (last && last.role === 'agent') last.content += token;
          return next;
        });
      },
      onError: (errMsg) => {
        setError(errMsg);
        setLoading(false);
      },
      onDone: (newThreadId) => {
        setThreadId(newThreadId);
        setLoading(false);
      },
    });
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    void sendMessage(input);
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void sendMessage(input);
    }
  }

  const suggestions = [
    'Summarize pending approvals',
    'Any contracts expiring soon?',
    'Show spend by category this quarter',
    'Flag compliance gaps on open tenders',
  ];

  return (
    <div className="copilot-shell unified">
      <div className="thread-col">
        <div className="thread">
          <div className="thread-inner">
            {messages.length === 0 ? (
              <div className="empty-thread">
                <div className="assistant-mark">
                  <Icon name="robot" size={28} />
                </div>
                <h3>FPIP Assistant</h3>
                <p>
                  One assistant for the whole platform. It routes your question to the right
                  finance, procurement, compliance, or risk tools — and never approves, pays, or
                  awards on your behalf.
                </p>
                <div className="capability-row">
                  {CAPABILITIES.map((c) => (
                    <span key={c.label} className="capability-chip">
                      <Icon name={c.icon} size={14} />
                      {c.label}
                    </span>
                  ))}
                </div>
                <div className="suggest-row" style={{ justifyContent: 'center' }}>
                  {suggestions.map((s) => (
                    <button key={s} type="button" className="suggest-chip" onClick={() => void sendMessage(s)}>
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              messages.map((m, i) => (
                <div key={i} className={classNames('msg', m.role === 'user' ? 'user' : 'agent')}>
                  {m.role === 'agent' && (
                    <div className="msg-avatar">
                      <Icon name="robot" size={18} />
                    </div>
                  )}
                  <div>
                    <div className="msg-bubble">{m.content || (loading && i === messages.length - 1 ? '\u00A0' : '')}</div>
                    {m.role === 'agent' && m.routedTo && m.content ? (
                      <div className="msg-meta">Grounded via {m.routedTo} tools</div>
                    ) : null}
                  </div>
                </div>
              ))
            )}

            {loading && (
              <div className="msg agent">
                <div className="msg-avatar">
                  <Icon name="robot" size={18} />
                </div>
                <div className="msg-bubble">
                  <div className="typing">
                    <span />
                    <span />
                    <span />
                  </div>
                </div>
              </div>
            )}
            {error && (
              <div style={{ color: 'var(--danger)', fontSize: 12.5, marginTop: 8, textAlign: 'center' }}>
                {error}
              </div>
            )}
            <div ref={endRef} />
          </div>
        </div>

        <form onSubmit={handleSubmit} className="composer-wrap">
          {activeRoute && messages.length > 0 ? (
            <div className="route-hint">Routing to {activeRoute} expertise</div>
          ) : null}
          <div className="composer">
            <textarea
              rows={1}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              disabled={loading}
            />
            <button type="submit" className="send-btn" disabled={loading || !input.trim()} aria-label="Send">
              <Icon name="send" size={16} />
            </button>
          </div>
          <div className="composer-footnote">
            <span className="human-lock">Read-only assistant</span> — cannot approve, pay, award, or change records.
          </div>
        </form>
      </div>
    </div>
  );
}
