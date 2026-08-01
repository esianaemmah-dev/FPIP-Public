import { useEffect, useRef, useState, type FormEvent } from 'react';
import { AgentIcon } from './AgentIcon';
import { Icon } from './Icons';
import { getAgent } from '@/agents/agentsConfig';
import { invokeAgentStream, type UserContext } from '@/api/agentService';
import { classNames } from '@/lib/format';

interface DashChatProps {
  agentId: string;
  userContext: UserContext;
  height?: number;
  /** Quick prompts (Precoro-style ask-the-data). */
  suggestions?: string[];
}

export function DashChat({ agentId, userContext, height = 280, suggestions }: DashChatProps) {
  const agent = getAgent(agentId);
  const [messages, setMessages] = useState<{ role: 'user' | 'agent'; content: string }[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [threadId, setThreadId] = useState<string | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  async function sendMessage(text: string) {
    if (!text.trim() || loading) return;
    setInput('');
    setError(null);
    setMessages((prev) => [...prev, { role: 'user', content: text.trim() }]);
    setLoading(true);
    setMessages((prev) => [...prev, { role: 'agent', content: '' }]);

    await invokeAgentStream({
      agentId,
      message: text.trim(),
      threadId: threadId,
      userContext,
      onToken: (token) => {
        setMessages((prev) => {
          const next = [...prev];
          const last = next[next.length - 1];
          if (last && last.role === 'agent') last.content += token;
          return next;
        });
      },
      onError: (message) => {
        setError(message);
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

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void sendMessage(input);
    }
  }

  return (
    <div className="dash-chat" style={{ height }}>
      <div className="thread" style={{ padding: 12 }}>
        {messages.length === 0 && agent && (
          <div className="empty-thread" style={{ marginTop: 20 }}>
            <AgentIcon name={agent.icon} size={44} />
            <h3 style={{ fontSize: 16 }}>{agent.name}</h3>
            <p style={{ fontSize: 12 }}>{agent.scope}</p>
            {suggestions?.length ? (
              <div className="doc-chip-row" style={{ marginTop: 12, justifyContent: 'center' }}>
                {suggestions.map((s) => (
                  <button
                    key={s}
                    type="button"
                    className="doc-chip"
                    style={{ cursor: 'pointer', border: 'none' }}
                    onClick={() => void sendMessage(s)}
                  >
                    {s}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={classNames('dash-msg', m.role === 'user' ? 'user' : 'agent')}>
            <div className="bubble">{m.content}</div>
          </div>
        ))}
        {loading && (
          <div className="dash-msg agent">
            <div className="bubble">
              <div className="dash-typing">
                <span />
                <span />
                <span />
              </div>
            </div>
          </div>
        )}
        {error && (
          <div style={{ color: 'var(--danger)', fontSize: 11.5, marginTop: 6, textAlign: 'center' }}>
            {error}
          </div>
        )}
        <div ref={endRef} />
      </div>

      <form onSubmit={handleSubmit} className="composer-wrap" style={{ padding: '10px 12px 12px' }}>
        <div className="composer" style={{ paddingLeft: 12 }}>
          <textarea
            rows={1}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask the agent…"
            disabled={loading}
            style={{ fontSize: 12.5, padding: '6px 0' }}
          />
          <button type="submit" className="send-btn" style={{ width: 32, height: 32 }} disabled={loading || !input.trim()} aria-label="Send">
            <Icon name="send" size={14} />
          </button>
        </div>
      </form>
    </div>
  );
}
