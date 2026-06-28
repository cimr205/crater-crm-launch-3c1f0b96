import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { useI18n } from '@/lib/i18n';
import { api, type WhatsappConversation, type WhatsappMessage } from '@/lib/api';
import { useToast } from '@/components/ui/use-toast';
import { MessageCircle, Plus, Send, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function WhatsAppPage() {
  const { t } = useI18n();
  const { toast } = useToast();

  const [conversations, setConversations] = useState<WhatsappConversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<WhatsappMessage[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [newPhone, setNewPhone] = useState('');
  const [newName, setNewName] = useState('');
  const [starting, setStarting] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);

  const loadConversations = () => {
    setLoading(true);
    api
      .listWhatsappConversations()
      .then((convs) => {
        setConversations(convs);
        if (!activeId && convs.length > 0) setActiveId(convs[0].id);
      })
      .catch((err) => toast({ title: err.message, variant: 'destructive' }))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadConversations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!activeId) { setMessages([]); return; }
    setMessagesLoading(true);
    api
      .getWhatsappMessages(activeId)
      .then(setMessages)
      .catch((err) => toast({ title: err.message, variant: 'destructive' }))
      .finally(() => setMessagesLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages]);

  const handleStart = () => {
    if (!newPhone.trim()) return;
    setStarting(true);
    api
      .startWhatsappConversation({ phone: newPhone.trim(), name: newName.trim() || undefined })
      .then((conv) => {
        setConversations((prev) => [conv, ...prev.filter((c) => c.id !== conv.id)]);
        setActiveId(conv.id);
        setDialogOpen(false);
        setNewPhone('');
        setNewName('');
      })
      .catch((err) => toast({ title: err.message, variant: 'destructive' }))
      .finally(() => setStarting(false));
  };

  const handleSend = () => {
    if (!activeId || !draft.trim()) return;
    setSending(true);
    api
      .sendWhatsappMessage(activeId, draft.trim())
      .then((msg) => {
        setMessages((prev) => [...prev, msg]);
        setDraft('');
        loadConversations();
      })
      .catch((err) => toast({ title: err.message, variant: 'destructive' }))
      .finally(() => setSending(false));
  };

  const activeConversation = conversations.find((c) => c.id === activeId) ?? null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{t('whatsapp.title')}</h1>
          <p className="text-muted-foreground">{t('whatsapp.subtitle')}</p>
        </div>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          {t('whatsapp.newConversation')}
        </Button>
      </div>

      <Card className="grid grid-cols-1 md:grid-cols-[280px_1fr] h-[calc(100vh-260px)] min-h-[420px] overflow-hidden">
        <div className="border-b md:border-b-0 md:border-r overflow-y-auto">
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : conversations.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">
              <MessageCircle className="h-6 w-6 mx-auto mb-2" />
              {t('whatsapp.emptyHint')}
            </div>
          ) : (
            conversations.map((conv) => (
              <button
                key={conv.id}
                onClick={() => setActiveId(conv.id)}
                className={cn(
                  'w-full text-left px-4 py-3 border-b hover:bg-muted/50 transition-colors',
                  activeId === conv.id && 'bg-muted'
                )}
              >
                <p className="font-medium truncate">{conv.contact_name || conv.contact_phone}</p>
                <p className="text-xs text-muted-foreground truncate">{conv.contact_phone}</p>
              </button>
            ))
          )}
        </div>

        <div className="flex flex-col">
          {!activeConversation ? (
            <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
              {t('whatsapp.selectConversation')}
            </div>
          ) : (
            <>
              <div className="px-4 py-3 border-b">
                <p className="font-medium">{activeConversation.contact_name || activeConversation.contact_phone}</p>
                <p className="text-xs text-muted-foreground">{activeConversation.contact_phone}</p>
              </div>

              <div ref={scrollRef} className="flex-1 overflow-y-auto px-4">
                <div className="py-4 space-y-2">
                  {messagesLoading ? (
                    <div className="flex justify-center py-8">
                      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                    </div>
                  ) : messages.length === 0 ? (
                    <p className="text-center text-sm text-muted-foreground py-8">{t('whatsapp.noMessages')}</p>
                  ) : (
                    messages.map((msg) => (
                      <div
                        key={msg.id}
                        className={cn('flex', msg.direction === 'outbound' ? 'justify-end' : 'justify-start')}
                      >
                        <div
                          className={cn(
                            'max-w-[75%] rounded-lg px-3 py-2 text-sm',
                            msg.direction === 'outbound'
                              ? 'bg-primary text-primary-foreground'
                              : 'bg-muted'
                          )}
                        >
                          <p className="whitespace-pre-wrap break-words">{msg.body}</p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="p-3 border-t flex items-end gap-2">
                <Textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder={t('whatsapp.messagePlaceholder')}
                  className="min-h-[44px] max-h-32 resize-none"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSend();
                    }
                  }}
                />
                <Button size="icon" onClick={handleSend} disabled={sending || !draft.trim()}>
                  {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </Button>
              </div>
            </>
          )}
        </div>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('whatsapp.newConversation')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">{t('whatsapp.phoneLabel')}</label>
              <Input placeholder="+45 12 34 56 78" value={newPhone} onChange={(e) => setNewPhone(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">{t('whatsapp.nameLabel')}</label>
              <Input value={newName} onChange={(e) => setNewName(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>{t('common.cancel')}</Button>
            <Button onClick={handleStart} disabled={starting || !newPhone.trim()}>
              {starting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {t('whatsapp.start')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
