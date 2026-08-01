// Streaming client for the FPIP LangGraph agent service (Phase 2).
// Parses Server-Sent Events from POST /agents/{agent_id}/invoke.
// Falls back to local replies only when the live agent is unreachable.

import { streamDemoAssistant } from '@/api/demoAssistant';

const BASE_URL = import.meta.env.VITE_AGENT_SERVICE_URL || 'http://localhost:8000';

export interface UserContext {
  username?: string;
  role?: 'internal' | 'supplier' | 'auditor' | string;
  supplier_id?: string;
  [key: string]: unknown;
}

export interface InvokeOptions {
  agentId: string;
  message: string;
  threadId?: string;
  userContext?: UserContext;
  onToken: (token: string) => void;
  onError: (message: string) => void;
  onDone: (threadId: string) => void;
}

function isOpenAiConfigError(message: string): boolean {
  return /Missing credentials|AZURE_OPENAI|example\.openai\.azure\.com|placeholder settings|azure_ad_token/i.test(
    message,
  );
}

async function runDemoFallback(
  message: string,
  threadId: string | undefined,
  onToken: (token: string) => void,
  onDone: (threadId: string) => void,
  onError: (message: string) => void,
): Promise<void> {
  try {
    const demoThread = await streamDemoAssistant(message, onToken);
    onDone(threadId || demoThread);
  } catch (err: unknown) {
    onError(err instanceof Error ? err.message : 'Demo assistant failed');
  }
}

export async function invokeAgentStream({
  agentId,
  message,
  threadId,
  userContext,
  onToken,
  onError,
  onDone,
}: InvokeOptions): Promise<void> {
  // Always try the live agent first (demo/no-auth mode still uses Azure OpenAI).
  // Fall back to local replies only if the service is unreachable or misconfigured.

  let response: Response;
  try {
    response = await fetch(`${BASE_URL}/agents/${encodeURIComponent(agentId)}/invoke`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'text/event-stream',
      },
      body: JSON.stringify({
        message,
        thread_id: threadId,
        user_context: userContext ?? {},
      }),
    });
  } catch (err: unknown) {
    await runDemoFallback(message, threadId, onToken, onDone, onError);
    return;
  }

  if (!response.ok) {
    const text = await response.text().catch(() => 'Agent service error');
    if (isOpenAiConfigError(text)) {
      await runDemoFallback(message, threadId, onToken, onDone, onError);
      return;
    }
    onError(`Agent service error ${response.status}: ${text}`);
    return;
  }

  if (!response.body) {
    onError('Agent service returned an empty response body.');
    return;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let buffer = '';
  let currentThreadId = threadId ?? '';
  let receivedToken = false;

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const payload = line.slice(6).trim();
        if (!payload) continue;

        let event: unknown;
        try {
          event = JSON.parse(payload);
        } catch {
          onToken(payload);
          receivedToken = true;
          continue;
        }

        if (!event || typeof event !== 'object') continue;
        const e = event as { type?: string; content?: string; thread_id?: string; message?: string };

        if (e.thread_id) {
          currentThreadId = e.thread_id;
        }

        if (e.type === 'token' && e.content) {
          receivedToken = true;
          onToken(e.content);
        } else if (e.type === 'done') {
          onDone(currentThreadId);
          return;
        } else if (e.type === 'error') {
          const errMsg = e.message ?? 'Unknown agent error';
          if (!receivedToken && isOpenAiConfigError(errMsg)) {
            await runDemoFallback(message, threadId || currentThreadId, onToken, onDone, onError);
            return;
          }
          onError(errMsg);
          return;
        }
      }
    }

    onDone(currentThreadId);
  } catch (err: unknown) {
    if (!receivedToken) {
      await runDemoFallback(message, threadId, onToken, onDone, onError);
      return;
    }
    onError(err instanceof Error ? err.message : 'Streaming failed');
  } finally {
    reader.releaseLock();
  }
}
