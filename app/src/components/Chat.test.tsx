// Behavioral tests for the unified FPIP Assistant chat surface (Command
// Center inline chat + full Copilot page both render this component).
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { InvokeOptions } from '@/api/agentService';

const invokeAgentStream = vi.fn<(options: InvokeOptions) => Promise<void>>();
vi.mock('@/api/agentService', () => ({
  invokeAgentStream: (options: InvokeOptions) => invokeAgentStream(options),
}));

import { Chat } from './Chat';

describe('Chat', () => {
  beforeEach(() => {
    invokeAgentStream.mockReset();
  });

  it('shows the welcome state with suggestion chips before any message is sent', () => {
    render(<Chat userContext={{ role: 'internal' }} />);
    expect(screen.getByText('FPIP Assistant')).toBeInTheDocument();
    expect(screen.getByText('Summarize pending approvals')).toBeInTheDocument();
  });

  it('routes the question to the right specialist and streams the reply into view', async () => {
    invokeAgentStream.mockImplementation(async ({ onToken, onDone }) => {
      onToken('Three invoices ');
      onToken('are on hold.');
      onDone('thread-123');
    });

    const user = userEvent.setup();
    render(<Chat userContext={{ role: 'internal' }} />);

    await user.type(screen.getByPlaceholderText(/ask about/i), 'Show invoice exceptions');
    await user.click(screen.getByRole('button', { name: /send/i }));

    expect(screen.getByText('Show invoice exceptions')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText('Three invoices are on hold.')).toBeInTheDocument());

    // "invoice" routes to the finance specialist under the unified assistant.
    expect(invokeAgentStream).toHaveBeenCalledWith(
      expect.objectContaining({ agentId: 'finance', message: 'Show invoice exceptions' }),
    );
    expect(screen.getByText('Grounded via finance tools')).toBeInTheDocument();
  });

  it('clears the composer immediately and disables sending while a reply is in flight', async () => {
    let releaseReply: (() => void) | undefined;
    invokeAgentStream.mockImplementation(
      ({ onDone }) =>
        new Promise<void>((resolve) => {
          releaseReply = () => {
            onDone('thread-1');
            resolve();
          };
        }),
    );

    const user = userEvent.setup();
    render(<Chat userContext={{ role: 'internal' }} />);
    const textarea = screen.getByPlaceholderText(/ask about/i);

    await user.type(textarea, 'Any contracts expiring soon?');
    await user.click(screen.getByRole('button', { name: /send/i }));

    expect(textarea).toHaveValue('');
    expect(textarea).toBeDisabled();
    expect(screen.getByRole('button', { name: /send/i })).toBeDisabled();

    releaseReply?.();
    await waitFor(() => expect(textarea).not.toBeDisabled());
  });

  it('does not send an empty or whitespace-only message', async () => {
    const user = userEvent.setup();
    render(<Chat userContext={{ role: 'internal' }} />);

    await user.type(screen.getByPlaceholderText(/ask about/i), '   ');
    await user.click(screen.getByRole('button', { name: /send/i }));

    expect(invokeAgentStream).not.toHaveBeenCalled();
  });

  it('surfaces a streaming error to the user instead of failing silently', async () => {
    invokeAgentStream.mockImplementation(async ({ onError }) => {
      onError('Agent request failed');
    });

    const user = userEvent.setup();
    render(<Chat userContext={{ role: 'internal' }} />);
    await user.type(screen.getByPlaceholderText(/ask about/i), 'Show spend by category');
    await user.click(screen.getByRole('button', { name: /send/i }));

    await waitFor(() => expect(screen.getByText('Agent request failed')).toBeInTheDocument());
  });
});
