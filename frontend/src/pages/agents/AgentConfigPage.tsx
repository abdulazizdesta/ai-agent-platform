import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../services/api';

// ─── Types ───────────────────────────────────────────────
interface AgentData {
  id: number; name: string; type: string; description: string | null;
  personality: string | null; model_provider: string; model_name: string;
  temperature: number; max_tokens: number; capabilities: Record<string, boolean>;
  instructions: string | null; status: string;
  organization: { id: number; name: string } | null;
  wa_channel: { id: number; phone_number: string; display_name: string } | null;
  faqs: FaqData[]; documents: DocData[];
}
interface FaqData { id: number; question: string; answer: string; sort_order: number; is_active: boolean; }
interface DocData { id: number; filename: string; file_size: number; chunk_count: number; status: string; error_message: string | null; created_at: string; }
interface KnowledgeStats { documents_count: number; documents_ready: number; documents_pending: number; total_chunks: number; faqs_count: number; has_instructions: boolean; }
interface WaChannelLookup { id: number; phone_number: string; display_name: string; }
interface ToastData { id: number; type: 'success' | 'error' | 'warning'; message: string; }
let toastId = 0;

const PROVIDERS = [
  { value: 'anthropic', label: 'Anthropic (Claude)' },
  { value: 'gemini', label: 'Google (Gemini)' },
];
 
const MODELS_BY_PROVIDER: Record<string, { value: string; label: string; free: boolean }[]> = {
  anthropic: [
    { value: 'claude-sonnet-4-20250514', label: 'Claude Sonnet 4', free: false },
    { value: 'claude-haiku-4-5-20251001', label: 'Claude Haiku 4.5', free: false },
  ],
  gemini: [
    { value: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash', free: true },
    { value: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro', free: false },
  ],
};

function ToastContainer({ toasts, onRemove }: { toasts: ToastData[]; onRemove: (id: number) => void }) {
  return (<div className="cm-toast-container">{toasts.map((t) => (
    <div key={t.id} onClick={() => onRemove(t.id)} className={`cm-toast cm-toast-${t.type}`}>
      <span className="material-symbols-rounded" style={{ fontSize: 20 }}>{t.type === 'success' ? 'check_circle' : t.type === 'error' ? 'error' : 'warning'}</span>{t.message}
    </div>))}</div>);
}

// ═══════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════
export default function AgentConfigPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [toasts, setToasts] = useState<ToastData[]>([]);
  const addToast = useCallback((type: 'success' | 'error' | 'warning', msg: string) => { const tid = ++toastId; setToasts((p) => [...p, { id: tid, type, message: msg }]); setTimeout(() => setToasts((p) => p.filter((t) => t.id !== tid)), 4000); }, []);
  const removeToast = useCallback((tid: number) => setToasts((p) => p.filter((t) => t.id !== tid)), []);

  const [activeTab, setActiveTab] = useState<'config' | 'knowledge' | 'chat'>('config');

  // ─── Fetch Agent ─────────────────────────────────────
  const agentQuery = useQuery<{ agent: AgentData; knowledge_stats: KnowledgeStats }>({
    queryKey: ['agent', id],
    queryFn: async () => (await api.get(`/agents/${id}`)).data,
    enabled: !!id,
  });

  const waChannelsQuery = useQuery<WaChannelLookup[]>({
    queryKey: ['wa-channels-lookup'],
    queryFn: async () => {
      const res = await api.get('/wa-channels', { params: { per_page: 100 } });
      return res.data.data?.map((c: any) => ({ id: c.id, phone_number: c.phone_number, display_name: c.display_name })) || [];
    },
  });

  const agent = agentQuery.data?.agent;
  const stats = agentQuery.data?.knowledge_stats;

  if (agentQuery.isLoading) {
    return <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-secondary)' }}>Loading agent...</div>;
  }

  if (!agent) {
    return <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-secondary)' }}>Agent tidak ditemukan.</div>;
  }

  return (
    <div>
      <ToastContainer toasts={toasts} onRemove={removeToast} />

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={() => navigate('/agents')} className="cm-icon-btn">
            <span className="material-symbols-rounded" style={{ fontSize: 20 }}>arrow_back</span>
          </button>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>{agent.name}</h1>
            <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
              <span className={`cm-badge ${agent.status === 'active' ? 'cm-badge-approved' : agent.status === 'draft' ? 'cm-badge-pending' : 'cm-badge-suspended'}`}>{agent.status}</span>
              <span className="cm-badge cm-badge-agent">{agent.type.replace('_', ' ')}</span>
              <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{agent.model_name}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 24, borderBottom: '1px solid var(--border)', paddingBottom: 0 }}>
        {[
          { key: 'config', label: 'Configuration', icon: 'tune' },
          { key: 'knowledge', label: 'Knowledge Base', icon: 'school' },
          { key: 'chat', label: 'Chat Preview', icon: 'chat' },
        ].map((tab) => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key as any)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '10px 16px',
              border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: activeTab === tab.key ? 600 : 400,
              color: activeTab === tab.key ? 'var(--accent)' : 'var(--text-secondary)',
              borderBottom: activeTab === tab.key ? '2px solid var(--accent)' : '2px solid transparent',
              backgroundColor: 'transparent', marginBottom: -1,
            }}>
            <span className="material-symbols-rounded" style={{ fontSize: 18 }}>{tab.icon}</span>
            {tab.label}
            {tab.key === 'knowledge' && stats && (
              <span style={{ fontSize: 11, backgroundColor: 'var(--accent-light)', color: 'var(--accent)', padding: '1px 6px', borderRadius: 10, fontWeight: 600 }}>
                {stats.documents_ready + stats.faqs_count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'config' && <ConfigTab agent={agent} waChannels={waChannelsQuery.data || []} addToast={addToast} />}
      {activeTab === 'knowledge' && <KnowledgeTab agent={agent} stats={stats!} addToast={addToast} />}
      {activeTab === 'chat' && <ChatTab agent={agent} addToast={addToast} />}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// CONFIG TAB
// ═══════════════════════════════════════════════════════════
function ConfigTab({ agent, waChannels, addToast }: { agent: AgentData; waChannels: WaChannelLookup[]; addToast: (t: 'success' | 'error', m: string) => void }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    model_provider: agent.model_provider || 'gemini',
    name: agent.name, type: agent.type, description: agent.description || '',
    personality: agent.personality || '', instructions: agent.instructions || '',
    model_name: agent.model_name, temperature: agent.temperature, max_tokens: agent.max_tokens,
    wa_channel_id: agent.wa_channel?.id?.toString() || '',
    capabilities: agent.capabilities || { chat: true, auto_reply: false },
    status: agent.status,
  });
 
  const updateAgent = useMutation({
    mutationFn: (p: Record<string, unknown>) => api.put(`/agents/${agent.id}`, p),
    onSuccess: (r) => { queryClient.invalidateQueries({ queryKey: ['agent', String(agent.id)] }); addToast('success', r.data.message); },
    onError: (e: any) => addToast('error', e.response?.data?.message || 'Gagal menyimpan.'),
  });
 
  const handleSave = () => {
    updateAgent.mutate({
      ...form,
      description: form.description || null,
      personality: form.personality || null,
      instructions: form.instructions || null,
      wa_channel_id: form.wa_channel_id ? Number(form.wa_channel_id) : null,
    });
  };
 
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
      {/* Left Column */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        {/* Basic Info */}
        <Section title="Basic Info" icon="info">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <FormField label="Nama Agent *" span={2}>
              <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} className="cm-modal-input" />
            </FormField>
            <FormField label="Type">
              <select value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))} className="cm-modal-input">
                <option value="cs_specialist">CS Specialist</option>
                <option value="auditor">Auditor</option>
                <option value="custom">Custom</option>
              </select>
            </FormField>
            <FormField label="Status">
              <select value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))} className="cm-modal-input">
                <option value="draft">Draft</option>
                <option value="active">Active</option>
                <option value="disabled">Disabled</option>
              </select>
            </FormField>
            <FormField label="WA Channel" span={2}>
              <select value={form.wa_channel_id} onChange={(e) => setForm((f) => ({ ...f, wa_channel_id: e.target.value }))} className="cm-modal-input">
                <option value="">Tidak ada (assign nanti)</option>
                {waChannels.map((c) => <option key={c.id} value={c.id}>{c.display_name} ({c.phone_number})</option>)}
              </select>
            </FormField>
            <FormField label="Deskripsi" span={2}>
              <textarea value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} className="cm-modal-input" rows={2} style={{ resize: 'vertical' }} />
            </FormField>
          </div>
        </Section>
 
        {/* Capabilities */}
        <Section title="Capabilities" icon="toggle_on">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[
              { key: 'chat', label: 'Chat', desc: 'Respond to text messages via WhatsApp' },
              { key: 'auto_reply', label: 'Auto-reply', desc: 'Automatically respond without human intervention' },
            ].map((cap) => (
              <label key={cap.key} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', cursor: 'pointer' }}>
                <input type="checkbox" checked={!!form.capabilities[cap.key]}
                  onChange={(e) => setForm((f) => ({ ...f, capabilities: { ...f.capabilities, [cap.key]: e.target.checked } }))}
                  style={{ accentColor: 'var(--accent)', width: 18, height: 18 }} />
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{cap.label}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{cap.desc}</div>
                </div>
              </label>
            ))}
          </div>
        </Section>
      </div>
 
      {/* Right Column */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        {/* Model Config — WITH PROVIDER SELECTOR */}
        <Section title="Model AI" icon="psychology">
          {/* Provider Toggle */}
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 6, display: 'block' }}>Provider</label>
            <div style={{ display: 'flex', gap: 6 }}>
              {PROVIDERS.map((p) => (
                <button key={p.value}
                  onClick={() => {
                    const firstModel = MODELS_BY_PROVIDER[p.value]?.[0]?.value || '';
                    setForm((f) => ({ ...f, model_provider: p.value, model_name: firstModel }));
                  }}
                  className={`cm-btn ${form.model_provider === p.value ? 'cm-btn-primary' : 'cm-btn-ghost'}`}
                  style={{ flex: 1, justifyContent: 'center', fontSize: 13, gap: 8 }}>

                  {/* Provider Logo */}
                  {p.value === 'anthropic' ? (
                    <img src="https://cdn.brandfetch.io/anthropic.com/w/28/h/28" width={16} height={16} alt="" style={{ borderRadius: 3 }} />
                  ) : (
                    <img src="https://www.gstatic.com/lamda/images/gemini_sparkle_v002_d4735304ff6292a690345.svg" width={16} height={16} alt="" />
                  )}
                  {p.label}
                </button>
              ))}
            </div>
          </div>
 
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <FormField label="Model" span={2}>
              <select value={form.model_name}
                onChange={(e) => setForm((f) => ({ ...f, model_name: e.target.value }))}
                className="cm-modal-input">
                {(MODELS_BY_PROVIDER[form.model_provider] || []).map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}{m.free ? ' (FREE)' : ''}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField label={`Temperature: ${form.temperature}`}>
              <input type="range" min="0" max="1" step="0.1" value={form.temperature}
                onChange={(e) => setForm((f) => ({ ...f, temperature: parseFloat(e.target.value) }))}
                style={{ width: '100%', accentColor: 'var(--accent)' }} />
            </FormField>
            <FormField label="Max Tokens">
              <input type="number" value={form.max_tokens} min={100} max={4096}
                onChange={(e) => setForm((f) => ({ ...f, max_tokens: parseInt(e.target.value) || 1024 }))} className="cm-modal-input" />
            </FormField>
          </div>
 
          {/* Free tier hint */}
          {form.model_provider === 'gemini' && (
            <div style={{ marginTop: 8, padding: '8px 12px', borderRadius: 8, backgroundColor: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)', fontSize: 12, color: 'var(--text-secondary)' }}>
              <span style={{ fontWeight: 600, color: 'rgb(16,185,129)' }}>💡 Free Tier:</span> Gemini 2.5 Flash gratis tanpa kartu kredit. Dapetin API key di{' '}
              <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)', textDecoration: 'underline' }}>aistudio.google.com/apikey</a>
            </div>
          )}
          {form.model_provider === 'anthropic' && (
            <div style={{ marginTop: 8, padding: '8px 12px', borderRadius: 8, backgroundColor: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.2)', fontSize: 12, color: 'var(--text-secondary)' }}>
              <span style={{ fontWeight: 600, color: 'rgb(139,92,246)' }}>🔑 Paid:</span> Anthropic butuh credit ($5 min). Dapetin API key di{' '}
              <a href="https://console.anthropic.com/" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)', textDecoration: 'underline' }}>console.anthropic.com</a>
            </div>
          )}
        </Section>
 
        {/* Personality */}
        <Section title="Personality" icon="emoji_emotions">
          <textarea value={form.personality} onChange={(e) => setForm((f) => ({ ...f, personality: e.target.value }))} className="cm-modal-input" rows={4} style={{ resize: 'vertical' }}
            placeholder="Professional tapi tetap friendly, berbahasa Indonesia, selalu sapa customer dengan nama..." />
        </Section>
 
        {/* Instructions */}
        <Section title="Instructions & Rules" icon="rule">
          <textarea value={form.instructions} onChange={(e) => setForm((f) => ({ ...f, instructions: e.target.value }))} className="cm-modal-input" rows={4} style={{ resize: 'vertical' }}
            placeholder="Jangan pernah kasih diskon tanpa approval manager. Fokus utama: customer service..." />
        </Section>
      </div>
 
      {/* Save Button — full width */}
      <div style={{ gridColumn: 'span 2', display: 'flex', justifyContent: 'flex-end', paddingTop: 12, borderTop: '1px solid var(--border)' }}>
        <button onClick={handleSave} disabled={updateAgent.isPending} className="cm-btn cm-btn-primary" style={{ padding: '10px 32px' }}>
          <span className="material-symbols-rounded" style={{ fontSize: 18 }}>save</span>
          {updateAgent.isPending ? 'Menyimpan...' : 'Save Configuration'}
        </button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// KNOWLEDGE TAB
// ═══════════════════════════════════════════════════════════
function KnowledgeTab({ agent, stats, addToast }: { agent: AgentData; stats: KnowledgeStats; addToast: (t: 'success' | 'error' | 'warning', m: string) => void }) {
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);

  // FAQ state
  const [faqForm, setFaqForm] = useState({ question: '', answer: '' });
  const [editingFaq, setEditingFaq] = useState<FaqData | null>(null);

  const uploadDoc = useMutation({
    mutationFn: (file: File) => {
      const fd = new FormData();
      fd.append('file', file);
      return api.post(`/agents/${agent.id}/documents`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
    },
    onSuccess: (r) => { queryClient.invalidateQueries({ queryKey: ['agent', String(agent.id)] }); addToast(r.data.document?.status === 'completed' ? 'success' : 'warning', r.data.message); },
    onError: (e: any) => addToast('error', e.response?.data?.message || 'Gagal upload dokumen.'),
  });

  const deleteDoc = useMutation({
    mutationFn: (docId: number) => api.delete(`/agents/${agent.id}/documents/${docId}`),
    onSuccess: (r) => { queryClient.invalidateQueries({ queryKey: ['agent', String(agent.id)] }); addToast('success', r.data.message); },
    onError: (e: any) => addToast('error', e.response?.data?.message || 'Gagal menghapus.'),
  });

  const addFaq = useMutation({
    mutationFn: (p: Record<string, unknown>) => api.post(`/agents/${agent.id}/faqs`, p),
    onSuccess: (r) => { queryClient.invalidateQueries({ queryKey: ['agent', String(agent.id)] }); setFaqForm({ question: '', answer: '' }); addToast('success', r.data.message); },
    onError: (e: any) => addToast('error', e.response?.data?.message || 'Gagal menambah FAQ.'),
  });

  const updateFaq = useMutation({
    mutationFn: ({ id, ...p }: Record<string, unknown>) => api.put(`/agents/${agent.id}/faqs/${id}`, p),
    onSuccess: (r) => { queryClient.invalidateQueries({ queryKey: ['agent', String(agent.id)] }); setEditingFaq(null); addToast('success', r.data.message); },
    onError: (e: any) => addToast('error', e.response?.data?.message || 'Gagal update FAQ.'),
  });

  const deleteFaq = useMutation({
    mutationFn: (faqId: number) => api.delete(`/agents/${agent.id}/faqs/${faqId}`),
    onSuccess: (r) => { queryClient.invalidateQueries({ queryKey: ['agent', String(agent.id)] }); addToast('success', r.data.message); },
    onError: (e: any) => addToast('error', e.response?.data?.message || 'Gagal menghapus FAQ.'),
  });

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
      {/* Documents */}
      <div>
        <Section title="Documents" icon="description" action={
          <button onClick={() => fileRef.current?.click()} className="cm-btn cm-btn-primary" style={{ padding: '6px 12px', fontSize: 13 }} disabled={uploadDoc.isPending}>
            <span className="material-symbols-rounded" style={{ fontSize: 16 }}>{uploadDoc.isPending ? 'hourglass_empty' : 'upload_file'}</span>
            {uploadDoc.isPending ? 'Uploading...' : 'Upload'}
          </button>
        }>
          <input ref={fileRef} type="file" accept=".pdf,.txt,.md,.csv,.docx" style={{ display: 'none' }}
            onChange={(e) => { if (e.target.files?.[0]) uploadDoc.mutate(e.target.files[0]); e.target.value = ''; }} />

          <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 12 }}>
            {stats.documents_ready} dokumen siap • {stats.total_chunks} chunks • Supported: PDF, TXT, MD, CSV, DOCX (max 10MB)
          </div>

          {(agent.documents || []).length === 0 ? (
            <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-tertiary)', border: '1px dashed var(--border)', borderRadius: 8 }}>
              <span className="material-symbols-rounded" style={{ fontSize: 36, opacity: 0.3, display: 'block', marginBottom: 4 }}>folder_open</span>
              Belum ada dokumen. Upload SOP, IK, atau prosedur.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {agent.documents.map((doc) => (
                <div key={doc.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
                    <span className="material-symbols-rounded" style={{ fontSize: 18, color: 'var(--accent)' }}>description</span>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{doc.filename}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
                        {doc.chunk_count} chunks • <span className={`cm-badge ${doc.status === 'completed' ? 'cm-badge-approved' : doc.status === 'failed' ? 'cm-badge-suspended' : 'cm-badge-pending'}`} style={{ fontSize: 10, padding: '0 6px' }}>{doc.status}</span>
                      </div>
                    </div>
                  </div>
                  <button onClick={() => deleteDoc.mutate(doc.id)} className="cm-icon-btn danger" style={{ flexShrink: 0 }}>
                    <span className="material-symbols-rounded" style={{ fontSize: 16 }}>close</span>
                  </button>
                </div>
              ))}
            </div>
          )}
        </Section>
      </div>

      {/* FAQs */}
      <div>
        <Section title="FAQ" icon="quiz">
          {/* Add FAQ Form */}
          <div style={{ padding: 12, borderRadius: 8, border: '1px solid var(--border)', marginBottom: 12 }}>
            <input value={faqForm.question} onChange={(e) => setFaqForm((f) => ({ ...f, question: e.target.value }))}
              className="cm-modal-input" placeholder="Pertanyaan..." style={{ marginBottom: 8 }} />
            <textarea value={faqForm.answer} onChange={(e) => setFaqForm((f) => ({ ...f, answer: e.target.value }))}
              className="cm-modal-input" placeholder="Jawaban..." rows={2} style={{ resize: 'vertical', marginBottom: 8 }} />
            <button onClick={() => addFaq.mutate(faqForm)} disabled={!faqForm.question || !faqForm.answer || addFaq.isPending}
              className="cm-btn cm-btn-primary" style={{ padding: '6px 12px', fontSize: 13 }}>
              <span className="material-symbols-rounded" style={{ fontSize: 16 }}>add</span> Tambah FAQ
            </button>
          </div>

          {/* FAQ List */}
          {(agent.faqs || []).length === 0 ? (
            <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-tertiary)', border: '1px dashed var(--border)', borderRadius: 8 }}>
              Belum ada FAQ. Tambahkan Q&A yang sering ditanyakan.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {agent.faqs.map((faq) => (
                <div key={faq.id} style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border)' }}>
                  {editingFaq?.id === faq.id ? (
                    <div>
                      <input value={editingFaq.question} onChange={(e) => setEditingFaq({ ...editingFaq, question: e.target.value })} className="cm-modal-input" style={{ marginBottom: 6 }} />
                      <textarea value={editingFaq.answer} onChange={(e) => setEditingFaq({ ...editingFaq, answer: e.target.value })} className="cm-modal-input" rows={2} style={{ resize: 'vertical', marginBottom: 6 }} />
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button onClick={() => updateFaq.mutate({ id: faq.id, question: editingFaq.question, answer: editingFaq.answer })} className="cm-btn cm-btn-primary" style={{ padding: '4px 10px', fontSize: 12 }}>Simpan</button>
                        <button onClick={() => setEditingFaq(null)} className="cm-btn cm-btn-ghost" style={{ padding: '4px 10px', fontSize: 12 }}>Batal</button>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>Q: {faq.question}</div>
                      <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 6 }}>A: {faq.answer}</div>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button onClick={() => setEditingFaq(faq)} className="cm-icon-btn" style={{ width: 24, height: 24 }}><span className="material-symbols-rounded" style={{ fontSize: 14 }}>edit</span></button>
                        <button onClick={() => deleteFaq.mutate(faq.id)} className="cm-icon-btn danger" style={{ width: 24, height: 24 }}><span className="material-symbols-rounded" style={{ fontSize: 14 }}>close</span></button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </Section>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// CHAT TAB (Sandbox Preview)
// ═══════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════
// CHAT TAB — FULL REPLACE
// Replace the entire ChatTab function in AgentConfigPage.tsx
// ═══════════════════════════════════════════════════════════

function ChatTab({ agent, addToast }: { agent: AgentData; addToast: (t: 'success' | 'error' | 'warning', m: string) => void }) {
  const [messages, setMessages] = useState<{ role: string; content: string; tokens?: number }[]>([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const [conversationId, setConversationId] = useState<number | null>(null);
  const [sources, setSources] = useState<{ type: string; count: number }[]>([]);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  // Load last conversation on mount
  useEffect(() => {
    setIsLoadingHistory(true);
    api.get(`/agents/${agent.id}/conversations`)
      .then((res) => {
        const convs = res.data.conversations || [];
        if (convs.length > 0) {
          const lastConv = convs[0];
          setConversationId(lastConv.id);
          return api.get(`/agents/${agent.id}/conversations/${lastConv.id}/messages`);
        }
        return null;
      })
      .then((res) => {
        if (res?.data?.messages) {
          setMessages(res.data.messages
            .filter((m: any) => m.role !== 'system')
            .map((m: any) => ({
              role: m.role,
              content: m.content,
              tokens: (m.input_tokens || 0) + (m.output_tokens || 0),
            }))
          );
        }
      })
      .catch(() => {})
      .finally(() => setIsLoadingHistory(false));
  }, [agent.id]);

  const clearChat = () => {
    if (conversationId) {
      api.delete(`/agents/${agent.id}/conversations/${conversationId}`).catch(() => {});
    }
    setMessages([]);
    setConversationId(null);
    setSources([]);
  };

  const sendMessage = async () => {
    if (!input.trim() || isTyping) return;

    const userMsg = input.trim();
    setInput('');
    setMessages((prev) => [...prev, { role: 'user', content: userMsg }]);
    setIsTyping(true);
    setSources([]);

    try {
      const payload: Record<string, unknown> = { message: userMsg };
      if (conversationId) payload.conversation_id = conversationId;

      const res = await api.post(`/agents/${agent.id}/chat`, payload);

      setConversationId(res.data.conversation_id);
      setSources(res.data.sources || []);

      setMessages((prev) => [...prev, {
        role: 'assistant',
        content: res.data.reply,
        tokens: (res.data.input_tokens || 0) + (res.data.output_tokens || 0),
      }]);
    } catch (err: any) {
      const errorMsg = err.response?.data?.message || 'Gagal mengirim pesan. Cek API key dan konfigurasi agent.';
      setMessages((prev) => [...prev, { role: 'assistant', content: `⚠️ ${errorMsg}` }]);
    } finally {
      setIsTyping(false);
    }
  };

  const totalTokens = messages.reduce((sum, m) => sum + (m.tokens || 0), 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 280px)', borderRadius: 12, border: '1px solid var(--border)', overflow: 'hidden' }}>
      {/* Chat Header */}
      <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 10, backgroundColor: 'var(--bg-input)' }}>
        <div style={{ width: 32, height: 32, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--accent-light)' }}>
          <span className="material-symbols-rounded" style={{ fontSize: 16, color: 'var(--accent)' }}>smart_toy</span>
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{agent.name}</div>
          <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
            Sandbox Mode — {agent.model_name}
            {totalTokens > 0 && <span> • {totalTokens.toLocaleString()} tokens used</span>}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          {sources.length > 0 && (
            <div style={{ display: 'flex', gap: 4 }}>
              {sources.map((s, i) => (
                <span key={i} className="cm-badge cm-badge-agent" style={{ fontSize: 10, padding: '0 6px' }}>
                  {s.type === 'faq' ? `${s.count} FAQ` : `${s.count} docs`}
                </span>
              ))}
            </div>
          )}
          {messages.length > 0 && !isLoadingHistory && (
            <button onClick={clearChat} className="cm-btn cm-btn-ghost" style={{ padding: '4px 10px', fontSize: 12 }}>
              <span className="material-symbols-rounded" style={{ fontSize: 14 }}>refresh</span> New Chat
            </button>
          )}
        </div>
      </div>

      {/* Messages Area */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 12, backgroundColor: 'var(--bg-primary)' }}>

        {/* Loading History Animation */}
        {isLoadingHistory && (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16 }}>
            {/* Animated chat skeleton */}
            <div style={{ width: '100%', maxWidth: 400, display: 'flex', flexDirection: 'column', gap: 10 }}>
              {/* Skeleton bubble left */}
              <div style={{ display: 'flex', justifyContent: 'flex-start', gap: 8 }}>
                <div style={{ width: 28, height: 28, borderRadius: 6, backgroundColor: 'var(--border)', animation: 'cm-skeleton-pulse 1.5s ease-in-out infinite' }} />
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <div style={{ width: 180, height: 14, borderRadius: 7, backgroundColor: 'var(--border)', animation: 'cm-skeleton-pulse 1.5s ease-in-out infinite', animationDelay: '0.1s' }} />
                  <div style={{ width: 120, height: 14, borderRadius: 7, backgroundColor: 'var(--border)', animation: 'cm-skeleton-pulse 1.5s ease-in-out infinite', animationDelay: '0.2s' }} />
                </div>
              </div>
              {/* Skeleton bubble right */}
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-end' }}>
                  <div style={{ width: 140, height: 14, borderRadius: 7, backgroundColor: 'var(--accent)', opacity: 0.15, animation: 'cm-skeleton-pulse 1.5s ease-in-out infinite', animationDelay: '0.3s' }} />
                </div>
              </div>
              {/* Skeleton bubble left longer */}
              <div style={{ display: 'flex', justifyContent: 'flex-start', gap: 8 }}>
                <div style={{ width: 28, height: 28, borderRadius: 6, backgroundColor: 'var(--border)', animation: 'cm-skeleton-pulse 1.5s ease-in-out infinite', animationDelay: '0.4s' }} />
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <div style={{ width: 220, height: 14, borderRadius: 7, backgroundColor: 'var(--border)', animation: 'cm-skeleton-pulse 1.5s ease-in-out infinite', animationDelay: '0.5s' }} />
                  <div style={{ width: 160, height: 14, borderRadius: 7, backgroundColor: 'var(--border)', animation: 'cm-skeleton-pulse 1.5s ease-in-out infinite', animationDelay: '0.6s' }} />
                  <div style={{ width: 100, height: 14, borderRadius: 7, backgroundColor: 'var(--border)', animation: 'cm-skeleton-pulse 1.5s ease-in-out infinite', animationDelay: '0.7s' }} />
                </div>
              </div>
            </div>
            <p style={{ fontSize: 13, color: 'var(--text-tertiary)', animation: 'cm-skeleton-pulse 1.5s ease-in-out infinite' }}>Memuat riwayat chat...</p>
          </div>
        )}

        {/* Empty State */}
        {!isLoadingHistory && messages.length === 0 && (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', color: 'var(--text-tertiary)' }}>
            <span className="material-symbols-rounded" style={{ fontSize: 48, opacity: 0.3, marginBottom: 8 }}>forum</span>
            <p style={{ fontSize: 14, marginBottom: 4 }}>Mulai chat untuk test agent ini</p>
            <p style={{ fontSize: 12, opacity: 0.7 }}>Pesan tidak dikirim ke WA — hanya simulasi</p>
          </div>
        )}

        {/* Messages */}
        {!isLoadingHistory && messages.map((msg, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start', gap: 8, alignItems: 'flex-end' }}>
            {msg.role === 'assistant' && (
              <div style={{ width: 28, height: 28, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--accent-light)', flexShrink: 0 }}>
                <span className="material-symbols-rounded" style={{ fontSize: 14, color: 'var(--accent)' }}>smart_toy</span>
              </div>
            )}
            <div style={{
              maxWidth: '75%', padding: '10px 14px', borderRadius: 12, fontSize: 14, lineHeight: 1.6,
              backgroundColor: msg.role === 'user' ? 'var(--accent)' : 'var(--bg-card)',
              color: msg.role === 'user' ? '#fff' : 'var(--text-primary)',
              border: msg.role === 'assistant' ? '1px solid var(--border)' : 'none',
              whiteSpace: 'pre-wrap', wordBreak: 'break-word',
            }}>
              {msg.content}
            </div>
          </div>
        ))}

        {/* Typing indicator */}
        {isTyping && (
          <div style={{ display: 'flex', justifyContent: 'flex-start', gap: 8, alignItems: 'flex-end' }}>
            <div style={{ width: 28, height: 28, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--accent-light)', flexShrink: 0 }}>
              <span className="material-symbols-rounded" style={{ fontSize: 14, color: 'var(--accent)' }}>smart_toy</span>
            </div>
            <div style={{ padding: '10px 14px', borderRadius: 12, backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', gap: 4 }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: 'var(--text-tertiary)', animation: 'cm-bounce 1.4s ease-in-out infinite', animationDelay: '0s' }} />
                <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: 'var(--text-tertiary)', animation: 'cm-bounce 1.4s ease-in-out infinite', animationDelay: '0.2s' }} />
                <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: 'var(--text-tertiary)', animation: 'cm-bounce 1.4s ease-in-out infinite', animationDelay: '0.4s' }} />
              </div>
            </div>
          </div>
        )}
        <div ref={chatEndRef} />
      </div>

      {/* Input */}
      <div style={{ padding: 12, borderTop: '1px solid var(--border)', display: 'flex', gap: 8, backgroundColor: 'var(--bg-card)' }}>
        <input value={input} onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
          className="cm-modal-input" style={{ flex: 1 }}
          placeholder="Ketik pesan untuk test agent..."
          disabled={isTyping || isLoadingHistory} />
        <button onClick={sendMessage} disabled={!input.trim() || isTyping || isLoadingHistory} className="cm-btn cm-btn-primary" style={{ padding: '8px 16px' }}>
          <span className="material-symbols-rounded" style={{ fontSize: 18 }}>send</span>
        </button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// SHARED
// ═══════════════════════════════════════════════════════════
function Section({ title, icon, children, action }: { title: string; icon: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div style={{ padding: 16, borderRadius: 12, border: '1px solid var(--border)', backgroundColor: 'var(--bg-card)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className="material-symbols-rounded" style={{ fontSize: 20, color: 'var(--accent)' }}>{icon}</span>
          <h3 style={{ fontSize: 15, fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>{title}</h3>
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}

function FormField({ label, children, span }: { label: string; children: React.ReactNode; span?: number }) {
  return (
    <div style={{ marginBottom: 4, gridColumn: span ? `span ${span}` : undefined }}>
      <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 4, display: 'block' }}>{label}</label>
      {children}
    </div>
  );
}