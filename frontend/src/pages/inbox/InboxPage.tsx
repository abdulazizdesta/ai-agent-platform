import { useState, useEffect, useCallback, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../services/api';

interface ConversationData {
  id: number; contact_phone: string; contact_name: string | null;
  status: string; handler: string; unread_count: number;
  last_message_at: string | null;
  channel: { id: number; phone_number: string; display_name: string; provider: string } | null;
  agent: { id: number; name: string } | null;
  assigned_user: { id: number; name: string } | null;
  messages_count: number;
  last_message: { content: string; direction: string; sender_type: string; created_at: string } | null;
}

interface MessageData {
  id: number; direction: string; sender_type: string; content: string | null;
  message_type: string; media_url: string | null; status: string;
  model_used: string | null; created_at: string;
}

interface InboxStats { total_active: number; total_waiting: number; total_unread: number; ai_handled: number; human_handled: number; }
interface ToastData { id: number; type: 'success' | 'error' | 'warning'; message: string; }
let toastId = 0;

function ToastContainer({ toasts, onRemove }: { toasts: ToastData[]; onRemove: (id: number) => void }) {
  return (<div className="cm-toast-container">{toasts.map((t) => (
    <div key={t.id} onClick={() => onRemove(t.id)} className={`cm-toast cm-toast-${t.type}`}>
      <span className="material-symbols-rounded" style={{ fontSize: 20 }}>{t.type === 'success' ? 'check_circle' : t.type === 'error' ? 'error' : 'warning'}</span>{t.message}
    </div>))}</div>);
}

// ═══════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════
export default function InboxPage() {
  const queryClient = useQueryClient();
  const [toasts, setToasts] = useState<ToastData[]>([]);
  const addToast = useCallback((type: 'success' | 'error' | 'warning', msg: string) => { const id = ++toastId; setToasts((p) => [...p, { id, type, message: msg }]); setTimeout(() => setToasts((p) => p.filter((t) => t.id !== id)), 4000); }, []);
  const removeToast = useCallback((id: number) => setToasts((p) => p.filter((t) => t.id !== id)), []);

  const [selectedConvId, setSelectedConvId] = useState<number | null>(null);
  const [filterStatus, setFilterStatus] = useState('');
  const [filterHandler, setFilterHandler] = useState('');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  useEffect(() => { const t = setTimeout(() => setDebouncedSearch(search), 400); return () => clearTimeout(t); }, [search]);

  // Polling: refetch conversations every 5 seconds
  const conversationsQuery = useQuery<{ data: ConversationData[] }>({
    queryKey: ['inbox-conversations', filterStatus, filterHandler, debouncedSearch],
    queryFn: async () => {
      const params: Record<string, string> = { per_page: '50' };
      if (filterStatus) params.status = filterStatus;
      if (filterHandler) params.handler = filterHandler;
      if (debouncedSearch) params.search = debouncedSearch;
      return (await api.get('/inbox/conversations', { params })).data;
    },
    refetchInterval: 8000,
  });

  const statsQuery = useQuery<InboxStats>({
    queryKey: ['inbox-stats'],
    queryFn: async () => (await api.get('/inbox/stats')).data,
    refetchInterval: 10000,
  });

  const conversations = conversationsQuery.data?.data || [];
  const stats = statsQuery.data;
  const selectedConv = conversations.find((c) => c.id === selectedConvId) || null;

  const formatTime = (d: string | null) => {
    if (!d) return '';
    const date = new Date(d);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    if (diff < 60000) return 'now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m`;
    if (diff < 86400000) return date.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
    return date.toLocaleDateString('id-ID', { day: '2-digit', month: 'short' });
  };

  const handlerIcon = (h: string) => h === 'ai' ? 'smart_toy' : h === 'human' ? 'person' : 'hourglass_empty';
  const statusColor = (s: string) => s === 'active' ? 'cm-badge-approved' : s === 'waiting' ? 'cm-badge-pending' : 'cm-badge-suspended';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 80px)' }}>
      <ToastContainer toasts={toasts} onRemove={removeToast} />

      {/* Stats Bar */}
      {stats && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10, marginBottom: 12 }}>
            {[
            { label: 'Active', value: stats.total_active, icon: 'chat_bubble', color: 'var(--accent)', bg: 'rgba(0,184,217,0.08)' },
            { label: 'Waiting', value: stats.total_waiting, icon: 'hourglass_top', color: 'var(--warning)', bg: 'rgba(217,119,6,0.08)' },
            { label: 'Unread', value: stats.total_unread, icon: 'mark_email_unread', color: 'var(--danger)', bg: 'rgba(239,68,68,0.08)' },
            { label: 'AI Handling', value: stats.ai_handled, icon: 'smart_toy', color: 'rgb(139,92,246)', bg: 'rgba(139,92,246,0.08)' },
            { label: 'Human', value: stats.human_handled, icon: 'support_agent', color: 'rgb(16,185,129)', bg: 'rgba(16,185,129,0.08)' },
            ].map((s) => (
            <div key={s.label} style={{
                padding: '10px', borderRadius: 12, border: '1px solid var(--border)',
                backgroundColor: 'var(--bg-card)', display: 'flex', alignItems: 'center', gap: 12,
            }}>
                <div style={{
                width: 10, height: 10, borderRadius: 5, backgroundColor: s.bg,
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}>
                <span className="material-symbols-rounded" style={{ fontSize: 20, color: s.color }}>{s.icon}</span>
                </div>
                <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1 }}>{s.value}</div>
                <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 2 }}>{s.label}</div>
                </div>
            </div>
            ))}
        </div>
        )}

      {/* Main Layout */}
      <div style={{ flex: 1, display: 'flex', gap: 0, borderRadius: 12, border: '1px solid var(--border)', overflow: 'hidden', minHeight: 0 }}>

        {/* Left Panel — Conversation List */}
        <div style={{ width: 360, borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column', backgroundColor: 'var(--bg-card)' }}>
          {/* Search + Filters */}
          <div style={{ padding: 12, borderBottom: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ position: 'relative' }}>
              <span className="material-symbols-rounded" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 16, color: 'var(--text-tertiary)' }}>search</span>
              <input value={search} onChange={(e) => setSearch(e.target.value)} className="cm-filter-input" style={{ paddingLeft: 34, fontSize: 13 }} placeholder="Cari kontak..." />
            </div>
            <div style={{ display: 'flex', gap: 4 }}>
              {['', 'active', 'waiting', 'closed'].map((s) => (
                <button key={s} onClick={() => setFilterStatus(s)}
                  className={`cm-btn ${filterStatus === s ? 'cm-btn-primary' : 'cm-btn-ghost'}`}
                  style={{ flex: 1, padding: '4px 8px', fontSize: 11, justifyContent: 'center' }}>
                  {s || 'All'}
                </button>
              ))}
            </div>
          </div>

          {/* Conversation List */}
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {conversations.length === 0 ? (
              <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-tertiary)' }}>
                <span className="material-symbols-rounded" style={{ fontSize: 36, opacity: 0.3, display: 'block', marginBottom: 8 }}>inbox</span>
                Belum ada percakapan
              </div>
            ) : conversations.map((conv) => (
              <div key={conv.id} onClick={() => setSelectedConvId(conv.id)}
                style={{
                  padding: '12px 14px', cursor: 'pointer', display: 'flex', gap: 10, alignItems: 'flex-start',
                  borderBottom: '1px solid var(--border)',
                  backgroundColor: selectedConvId === conv.id ? 'var(--accent-light)' : conv.unread_count > 0 ? 'rgba(var(--accent-rgb, 0,0,0), 0.02)' : 'transparent',
                }}>
                {/* Avatar */}
                <div style={{ width: 40, height: 40, borderRadius: '50%', backgroundColor: 'var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <span className="material-symbols-rounded" style={{ fontSize: 20, color: 'var(--text-tertiary)' }}>person</span>
                </div>
                {/* Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
                    <span style={{ fontSize: 14, fontWeight: conv.unread_count > 0 ? 700 : 500, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {conv.contact_name || conv.contact_phone}
                    </span>
                    <span style={{ fontSize: 11, color: conv.unread_count > 0 ? 'var(--accent)' : 'var(--text-tertiary)', flexShrink: 0 }}>
                      {formatTime(conv.last_message_at)}
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, marginRight: 8 }}>
                      {conv.last_message ? (
                        <>
                          {conv.last_message.direction === 'outbound' && <span style={{ color: 'var(--text-tertiary)' }}>You: </span>}
                          {conv.last_message.content}
                        </>
                      ) : 'No messages'}
                    </div>
                    <div style={{ display: 'flex', gap: 4, alignItems: 'center', flexShrink: 0 }}>
                      <span className="material-symbols-rounded" style={{ fontSize: 14, color: 'var(--text-tertiary)' }}>{handlerIcon(conv.handler)}</span>
                      {conv.unread_count > 0 && (
                        <span style={{ minWidth: 18, height: 18, borderRadius: 9, backgroundColor: 'var(--accent)', color: '#fff', fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 5px' }}>
                          {conv.unread_count}
                        </span>
                      )}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
                    <span className={`cm-badge ${statusColor(conv.status)}`} style={{ fontSize: 9, padding: '0 5px' }}>{conv.status}</span>
                    {conv.channel && <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>{conv.channel.display_name}</span>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right Panel — Chat Detail */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', backgroundColor: 'var(--bg-primary)' }}>
          {selectedConv ? (
            <ChatDetail
              conversation={selectedConv}
              addToast={addToast}
              onRefresh={() => queryClient.invalidateQueries({ queryKey: ['inbox-conversations'] })}
              onDeleted={() => { setSelectedConvId(null); queryClient.invalidateQueries({ queryKey: ['inbox-conversations'] }); }}
            />
          ) : (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', color: 'var(--text-tertiary)' }}>
              <span className="material-symbols-rounded" style={{ fontSize: 56, opacity: 0.2, marginBottom: 12 }}>forum</span>
              <p style={{ fontSize: 16 }}>Pilih percakapan untuk melihat detail</p>
              <p style={{ fontSize: 13, opacity: 0.7 }}>Pesan masuk otomatis muncul di sini</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// CHAT DETAIL — Right Panel
// ═══════════════════════════════════════════════════════════
function ChatDetail({ conversation, addToast, onRefresh, onDeleted }: {
  conversation: ConversationData;
  addToast: (t: 'success' | 'error' | 'warning', m: string) => void;
  onRefresh: () => void;
  onDeleted: () => void;
}) {
  const queryClient = useQueryClient();
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Fetch messages (polling every 3 seconds)
  const messagesQuery = useQuery<{ data: MessageData[] }>({
    queryKey: ['inbox-messages', conversation.id],
    queryFn: async () => (await api.get(`/inbox/conversations/${conversation.id}/messages`, { params: { per_page: 100 } })).data,
    refetchInterval: 5000,
  });

  const messages = [...(messagesQuery.data?.data || [])].reverse();

        // Auto-scroll ke bawah
        const prevCountRef = useRef(0);
        useEffect(() => {
        if (messages.length !== prevCountRef.current) {
            chatEndRef.current?.scrollIntoView({ behavior: messages.length - prevCountRef.current > 5 ? 'auto' : 'smooth' });
            prevCountRef.current = messages.length;
        }
    }, [messages.length]);

  const sendReply = async () => {
    if (!input.trim() || isSending) return;
    setIsSending(true);
    try {
      await api.post(`/inbox/conversations/${conversation.id}/reply`, { message: input.trim() });
      setInput('');
      queryClient.invalidateQueries({ queryKey: ['inbox-messages', conversation.id] });
      onRefresh();
    } catch (e: any) {
      addToast('error', e.response?.data?.message || 'Gagal mengirim.');
    } finally {
      setIsSending(false);
    }
  };

  const takeover = useMutation({
    mutationFn: () => api.post(`/inbox/conversations/${conversation.id}/takeover`),
    onSuccess: (r) => { addToast('success', r.data.message); onRefresh(); },
    onError: (e: any) => addToast('error', e.response?.data?.message || 'Gagal takeover.'),
  });

  const returnToAi = useMutation({
    mutationFn: () => api.post(`/inbox/conversations/${conversation.id}/return-to-ai`),
    onSuccess: (r) => { addToast('success', r.data.message); onRefresh(); },
    onError: (e: any) => addToast('error', e.response?.data?.message || 'Gagal.'),
  });

  const closeConv = useMutation({
    mutationFn: () => api.post(`/inbox/conversations/${conversation.id}/close`),
    onSuccess: (r) => { addToast('success', r.data.message); onRefresh(); },
    onError: (e: any) => addToast('error', e.response?.data?.message || 'Gagal.'),
  });

  const deleteConv = useMutation({
    mutationFn: () => api.delete(`/inbox/conversations/${conversation.id}`),
    onSuccess: (r) => { addToast('success', r.data.message); onRefresh(); onDeleted(); },
    onError: (e: any) => addToast('error', e.response?.data?.message || 'Gagal menghapus.'),
  });

  const formatTime = (d: string) => new Date(d).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });

  return (
    <>
      {/* Header */}
      <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', backgroundColor: 'var(--bg-card)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 36, height: 36, borderRadius: '50%', backgroundColor: 'var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span className="material-symbols-rounded" style={{ fontSize: 18, color: 'var(--text-tertiary)' }}>person</span>
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>
              {conversation.contact_name || conversation.contact_phone}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)', display: 'flex', gap: 6, alignItems: 'center' }}>
              {conversation.contact_phone}
              <span>•</span>
              <span className="material-symbols-rounded" style={{ fontSize: 12 }}>{conversation.handler === 'ai' ? 'smart_toy' : conversation.handler === 'human' ? 'person' : 'hourglass_empty'}</span>
              {conversation.handler === 'ai' ? 'AI handling' : conversation.handler === 'human' ? 'Human handling' : 'Unassigned'}
              {conversation.agent && <span>• {conversation.agent.name}</span>}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          {conversation.handler === 'ai' && (
            <button onClick={() => takeover.mutate()} className="cm-btn cm-btn-warning" style={{ padding: '5px 10px', fontSize: 12 }}>
              <span className="material-symbols-rounded" style={{ fontSize: 14 }}>front_hand</span> Takeover
            </button>
          )}
          {conversation.handler === 'human' && (
            <button onClick={() => returnToAi.mutate()} className="cm-btn cm-btn-ghost" style={{ padding: '5px 10px', fontSize: 12 }}>
              <span className="material-symbols-rounded" style={{ fontSize: 14 }}>smart_toy</span> Return to AI
            </button>
          )}
          {conversation.status !== 'closed' && (
            <button onClick={() => closeConv.mutate()} className="cm-btn cm-btn-ghost" style={{ padding: '5px 10px', fontSize: 12 }}>
              <span className="material-symbols-rounded" style={{ fontSize: 14 }}>check_circle</span> Close
            </button>
          )}
          <button onClick={() => setConfirmDeleteOpen(true)}
            className="cm-btn cm-btn-danger" style={{ padding: '5px 10px', fontSize: 12 }}>
            <span className="material-symbols-rounded" style={{ fontSize: 14 }}>delete</span> Delete
          </button>
        </div>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 6 }}>
        {messagesQuery.isLoading && (
          <div style={{ textAlign: 'center', padding: 32, color: 'var(--text-tertiary)' }}>Loading messages...</div>
        )}
        {messages.map((msg) => (
          <div key={msg.id} style={{ display: 'flex', justifyContent: msg.direction === 'inbound' ? 'flex-start' : 'flex-end', gap: 6, alignItems: 'flex-end' }}>
            {msg.direction === 'inbound' && (
              <div style={{ width: 24, height: 24, borderRadius: '50%', backgroundColor: 'var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <span className="material-symbols-rounded" style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>person</span>
              </div>
            )}
            <div style={{
              maxWidth: '70%', padding: '8px 12px', borderRadius: 10, fontSize: 14, lineHeight: 1.5,
              backgroundColor: msg.direction === 'inbound' ? 'var(--bg-card)' : msg.sender_type === 'ai' ? 'rgba(139,92,246,0.1)' : 'var(--accent)',
              color: msg.direction === 'outbound' && msg.sender_type === 'human' ? '#fff' : 'var(--text-primary)',
              border: msg.direction === 'inbound' ? '1px solid var(--border)' : 'none',
              whiteSpace: 'pre-wrap', wordBreak: 'break-word',
            }}>
              {msg.content || `[${msg.message_type}]`}
              <div style={{ fontSize: 10, marginTop: 4, opacity: 0.6, textAlign: 'right', display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 4 }}>
                {msg.sender_type === 'ai' && <span className="material-symbols-rounded" style={{ fontSize: 10 }}>smart_toy</span>}
                {msg.sender_type === 'human' && msg.direction === 'outbound' && <span className="material-symbols-rounded" style={{ fontSize: 10 }}>person</span>}
                {formatTime(msg.created_at)}
                {msg.direction === 'outbound' && (
                  <span className="material-symbols-rounded" style={{ fontSize: 10 }}>
                    {msg.status === 'read' ? 'done_all' : msg.status === 'delivered' ? 'done_all' : msg.status === 'sent' ? 'done' : msg.status === 'failed' ? 'error' : 'schedule'}
                  </span>
                )}
              </div>
            </div>
            {msg.direction === 'outbound' && msg.sender_type === 'ai' && (
              <div style={{ width: 24, height: 24, borderRadius: '50%', backgroundColor: 'rgba(139,92,246,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <span className="material-symbols-rounded" style={{ fontSize: 12, color: 'rgb(139,92,246)' }}>smart_toy</span>
              </div>
            )}
          </div>
        ))}
        <div ref={chatEndRef} />
      </div>

      {/* Reply Input */}
      <div style={{ padding: 12, borderTop: '1px solid var(--border)', display: 'flex', gap: 8, backgroundColor: 'var(--bg-card)' }}>
        <input value={input} onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendReply(); } }}
          className="cm-modal-input" style={{ flex: 1 }}
          placeholder={conversation.status === 'closed' ? 'Conversation ditutup' : 'Ketik pesan...'}
          disabled={isSending || conversation.status === 'closed'} />
        <button onClick={sendReply} disabled={!input.trim() || isSending || conversation.status === 'closed'} className="cm-btn cm-btn-primary" style={{ padding: '8px 16px' }}>
          <span className="material-symbols-rounded" style={{ fontSize: 18 }}>send</span>
        </button>
      </div>

      {/* Delete Confirm Modal */}
      {confirmDeleteOpen && (
        <div onClick={(e) => { if (e.target === e.currentTarget) setConfirmDeleteOpen(false); }} className="cm-modal-overlay">
          <div style={{ animation: 'cm-slide-up 0.3s ease' }}>
            <div className="cm-modal-content sm">
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                <div className="cm-confirm-icon danger">
                  <span className="material-symbols-rounded" style={{ fontSize: 22 }}>delete_forever</span>
                </div>
                <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>Hapus Conversation</h3>
              </div>
              <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 20, lineHeight: 1.5 }}>
                Hapus semua chat dengan <strong>{conversation.contact_name || conversation.contact_phone}</strong>? Semua pesan akan terhapus permanen.
              </p>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                <button onClick={() => setConfirmDeleteOpen(false)} className="cm-btn cm-btn-ghost">Batal</button>
                <button onClick={() => { deleteConv.mutate(); setConfirmDeleteOpen(false); }} className="cm-btn cm-btn-danger">Hapus</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}