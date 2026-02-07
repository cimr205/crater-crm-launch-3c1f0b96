import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { api } from '@/lib/api';

type ChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
};

const quickActions = [
  { label: 'Create workflow', prompt: 'Create a workflow that sends new leads to webhook.' },
  { label: 'Analyze leads', prompt: 'Analyze my latest leads and summarize the top opportunities.' },
  { label: 'Show suggestions', prompt: 'Suggest workflow improvements based on my data.' },
];

export default function AiAgentWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [thinking, setThinking] = useState(false);
  const [streaming, setStreaming] = useState('');

  const lastMessages = useMemo(() => messages.slice(-20), [messages]);

  const sendMessage = async (prompt: string) => {
    if (!prompt.trim()) return;
    const userMessage: ChatMessage = { id: `${Date.now()}-u`, role: 'user', content: prompt };
    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setThinking(true);
    setStreaming('');
    try {
      const response = await api.aiChat(prompt);
      const reply = response.message || 'Done.';
      let idx = 0;
      const interval = setInterval(() => {
        idx += 1;
        setStreaming(reply.slice(0, idx));
        if (idx >= reply.length) {
          clearInterval(interval);
          const assistantMessage: ChatMessage = {
            id: `${Date.now()}-a`,
            role: 'assistant',
            content: reply,
          };
          setMessages((prev) => [...prev, assistantMessage]);
          setStreaming('');
          setThinking(false);
        }
      }, 12);
    } catch (error) {
      setThinking(false);
      setStreaming('');
      const assistantMessage: ChatMessage = {
        id: `${Date.now()}-a`,
        role: 'assistant',
        content: (error as Error).message || 'AI failed.',
      };
      setMessages((prev) => [...prev, assistantMessage]);
    }
  };

  useEffect(() => {
    if (!open) return;
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open]);

  return (
    <div className="fixed bottom-6 right-6 z-50">
      {open && (
        <Card className="w-[360px] max-h-[70vh] flex flex-col shadow-lg border-border bg-card">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <div className="text-sm font-semibold">AI Agent</div>
            <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>
              Close
            </Button>
          </div>
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
            {lastMessages.map((message) => (
              <div
                key={message.id}
                className={`rounded-lg px-3 py-2 text-sm ${
                  message.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground'
                }`}
              >
                {message.content}
              </div>
            ))}
            {thinking && (
              <div className="text-xs text-muted-foreground">AI is thinking...</div>
            )}
            {streaming && (
              <div className="rounded-lg px-3 py-2 text-sm bg-muted text-foreground">{streaming}</div>
            )}
          </div>
          <div className="px-4 py-3 border-t border-border space-y-2">
            <div className="flex flex-wrap gap-2">
              {quickActions.map((action) => (
                <Button
                  key={action.label}
                  size="sm"
                  variant="outline"
                  onClick={() => sendMessage(action.prompt)}
                  disabled={thinking}
                >
                  {action.label}
                </Button>
              ))}
            </div>
            <div className="flex gap-2">
              <Input
                placeholder="Ask the AI..."
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    sendMessage(input);
                  }
                }}
              />
              <Button onClick={() => sendMessage(input)} disabled={thinking}>
                Send
              </Button>
            </div>
          </div>
        </Card>
      )}
      {!open && (
        <Button onClick={() => setOpen(true)} className="rounded-full shadow-lg">
          AI
        </Button>
      )}
    </div>
  );
}

