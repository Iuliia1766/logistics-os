'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Icon } from './Icons';
import { sendMessage } from '@/app/actions/account';
import type { Message, UserRole } from '@/lib/types';

const QUICK: Record<UserRole, string[]> = {
  driver: [
    'I’m running about 30 minutes behind.',
    'What are the detention terms here?',
    'Can you push the broker on the rate?',
    'Pickup number please.',
  ],
  shipper: [
    'What’s the ETA on my shipment?',
    'Can we re-shop this lane?',
    'Please send the POD when it delivers.',
    'Add a liftgate requirement.',
  ],
};

export function MessageThread({
  initial, role, userId,
}: { initial: Message[]; role: UserRole; userId: string }) {
  const router = useRouter();
  const [messages, setMessages] = useState(initial);
  const [draft, setDraft] = useState('');
  const [pending, startTransition] = useTransition();
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => setMessages(initial), [initial]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' });
  }, [messages]);

  // Dispatch replies land without a refresh.
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel('my-thread')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `owner_id=eq.${userId}` },
        (payload) => {
          const row = payload.new as Message;
          setMessages((prev) => (prev.some((m) => m.id === row.id) ? prev : [...prev, row]));
        },
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [userId]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const body = draft.trim();
    if (!body || pending) return;
    setDraft('');
    startTransition(async () => {
      const res = await sendMessage(body);
      if (!res.ok) setDraft(body);
      router.refresh();
    });
  }

  return (
    <>
      <div className="page-head">
        <h1 className="h1">Messages</h1>
        <p className="sub">A direct line to dispatch. They see the same load record you do.</p>
      </div>

      <div className="msg-wrap">
        <div className="msg-head">
          <div className="avatar">DP</div>
          <div>
            <div className="t">Dispatch</div>
            <div className="d"><span className="dot-on" /> Online · typically replies in a minute</div>
          </div>
        </div>

        <div className="thread">
          {messages.map((m) => (
            <div key={m.id} className={'bub-wrap' + (m.from_dispatch ? '' : ' me')}>
              <div className={'bub ' + (m.from_dispatch ? 'bub-them' : 'bub-me')}>
                {m.body}
                <div className="bub-t">
                  {new Date(m.created_at).toLocaleTimeString('en-US', {
                    hour: 'numeric', minute: '2-digit',
                  })}
                </div>
              </div>
            </div>
          ))}
          {pending && (
            <div className="typing"><i /><i /><i /></div>
          )}
          <div ref={endRef} />
        </div>

        <div className="quick">
          {QUICK[role].map((q) => (
            <button key={q} type="button" onClick={() => setDraft(q)}>{q}</button>
          ))}
        </div>

        <form className="composer" onSubmit={submit}>
          <input
            className="input" value={draft} placeholder="Message dispatch…" autoComplete="off"
            onChange={(e) => setDraft(e.target.value)}
          />
          <button className="btn btn-primary" style={{ width: 'auto' }} type="submit" disabled={pending}>
            <Icon name="send" size={15} /> Send
          </button>
        </form>
      </div>
    </>
  );
}
