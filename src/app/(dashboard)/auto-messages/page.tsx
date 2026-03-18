'use client';

import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { toast } from 'sonner';

// ─── Events & Variables (from old system index.html:3521-3545) ───────────────

const MSG_EVENTS = [
  { key: 'new_sell', label: 'Nueva Orden de Venta', desc: 'Se envía cuando alguien crea una orden en tu anuncio SELL', color: '#0ea5e9' },
  { key: 'new_buy', label: 'Nueva Orden de Compra', desc: 'Se envía cuando creas una orden en un anuncio BUY', color: '#0ea5e9' },
  { key: 'sell_paid', label: 'Venta Marcada como Pagada', desc: 'El comprador marcó tu orden de venta como pagada', color: '#f0b90b' },
  { key: 'buy_paid', label: 'Compra Marcada como Pagada', desc: 'Marcaste como pagada tu orden de compra', color: '#f0b90b' },
  { key: 'completed', label: 'Orden Completada', desc: 'La orden se completó exitosamente', color: '#10b981' },
  { key: 'buy_cancelled', label: 'Compra Cancelada', desc: 'Tu orden de compra fue cancelada', color: '#ef4444' },
  { key: 'kyc_sell', label: 'KYC Venta Verificado', desc: 'Aprobaste la verificación adicional en venta', color: '#0ea5e9' },
  { key: 'kyc_buy', label: 'KYC Compra Verificado', desc: 'Aprobaste la verificación adicional en compra', color: '#f0b90b' },
];

const MSG_VARS = ['{nombre}', '{cantidad}', '{asset}', '{precio}', '{total}', '{fiat}', '{metodo}', '{orden}', '{tipo}'];

const MSG_DEFAULTS: Record<string, string> = {
  new_buy: 'Hola {nombre}, recibí tu orden #{orden} por {cantidad} {asset}.\nEn breve te realizo el pago de {total} {fiat} por {metodo}.\n\n⚠️ Los pagos se procesan por orden de llegada. 🙏',
  sell_paid: 'Gracias {nombre} por realizar el pago de {total} {fiat}.\nNo olvides enviar el comprobante.\nConfirmo en el banco y libero tus {cantidad} {asset}. ✅',
  buy_paid: 'Hola {nombre}, ya realicé el pago de {total} {fiat} por {metodo}.\nPor favor verifica y libera los {cantidad} {asset}. ✅',
  completed: '¡Operación completada! 🎉 Gracias {nombre}.\nOrden #{orden} por {cantidad} {asset} procesada.\n\nAgréganos como favorito ⭐ ¡Hasta pronto! 🙏',
};

const FIAT_TABS = ['VES', 'CLP', 'COP', 'USD'];

// ─── Main ────────────────────────────────────────────────────────────────────

interface Account { id: string; label: string; }

export default function AutoMessagesPage() {
  const qc = useQueryClient();
  const [accountId, setAccountId] = useState('');
  const [tab, setTab] = useState('global');
  const [messages, setMessages] = useState<Record<string, string>>({});
  const [enabled, setEnabled] = useState(true);
  const [delay, setDelay] = useState(3);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  const { data: accounts = [] } = useQuery<Account[]>({
    queryKey: ['accounts'], queryFn: () => api.get('/accounts').then(r => r.data),
  });

  useEffect(() => { if (!accountId && accounts.length) setAccountId(accounts[0].id); }, [accounts, accountId]);

  // Load messages
  useEffect(() => {
    if (!accountId) return;
    setDirty(false);
    api.get('/auto-messages', { params: { accountId } }).then(r => {
      const msgs: Record<string, string> = {};
      const data = Array.isArray(r.data) ? r.data : [];
      const tabFilter = tab === 'global' ? data.filter((m: any) => !m.advNo) : data.filter((m: any) => m.advNo === tab);
      tabFilter.forEach((m: any) => { if (m.trigger) msgs[m.trigger.toLowerCase()] = m.content || ''; });
      // Fill defaults for missing events on global tab
      if (tab === 'global') MSG_EVENTS.forEach(ev => { if (!msgs[ev.key] && MSG_DEFAULTS[ev.key]) msgs[ev.key] = MSG_DEFAULTS[ev.key]; });
      setMessages(msgs);
      if (data.length > 0) { setEnabled(data[0].isActive ?? true); setDelay(Math.round((data[0].delayMs ?? 3000) / 1000)); }
    }).catch(() => setMessages({}));
  }, [accountId, tab]);

  function updateMsg(key: string, value: string) { setMessages(prev => ({ ...prev, [key]: value })); setDirty(true); }

  function insertVar(textareaId: string, varName: string) {
    const el = document.getElementById(textareaId) as HTMLTextAreaElement;
    if (!el) return;
    const s = el.selectionStart, e = el.selectionEnd;
    const newVal = el.value.substring(0, s) + varName + el.value.substring(e);
    updateMsg(textareaId.replace('msg-', ''), newVal);
    setTimeout(() => { el.focus(); el.selectionStart = el.selectionEnd = s + varName.length; }, 50);
  }

  async function saveMessages() {
    if (!accountId) return;
    setSaving(true);
    try {
      // Delete existing for this account+tab
      const existing = await api.get('/auto-messages', { params: { accountId } }).then(r => r.data);
      const toDelete = Array.isArray(existing) ? existing.filter((m: any) => tab === 'global' ? !m.advNo : m.advNo === tab) : [];
      await Promise.all(toDelete.map((m: any) => api.delete(`/auto-messages/${m.id}`).catch(() => {})));
      // Create new
      for (const ev of MSG_EVENTS) {
        const content = (messages[ev.key] || '').trim();
        if (!content) continue;
        await api.post('/auto-messages', { accountId, advNo: tab === 'global' ? undefined : tab, trigger: ev.key.toUpperCase(), content, delayMs: delay * 1000, isActive: enabled });
      }
      toast.success('Mensajes guardados');
      setDirty(false);
    } catch (e: any) { toast.error(e.response?.data?.message || 'Error'); }
    finally { setSaving(false); }
  }

  const configured = MSG_EVENTS.filter(ev => (messages[ev.key] || '').trim()).length;

  return (
    <div className="p-6 space-y-5">
      <div>
        <h1 className="text-xl font-bold">Mensajes Automáticos</h1>
        <p className="text-sm text-muted-foreground mt-1">Configura mensajes predefinidos que se envían automáticamente al chat de cada orden según el evento.</p>
      </div>

      <p className="text-sm text-muted-foreground">
        <span className="text-green-400 font-bold">{configured}</span> de {MSG_EVENTS.length} eventos configurados
        {enabled ? <span className="text-green-400"> · ✓ Activo</span> : ' · Inactivo'}
      </p>

      {/* Account + toggle + delay */}
      <div className="bg-card border border-border rounded-xl p-4 flex items-end gap-4 flex-wrap">
        <div className="flex-1 min-w-[180px]">
          <label className="text-xs text-muted-foreground block mb-1">Cuenta Binance</label>
          <select value={accountId} onChange={e => setAccountId(e.target.value)} className="w-full bg-secondary border border-border rounded px-3 py-2 text-sm text-foreground">
            {accounts.map(a => <option key={a.id} value={a.id}>{a.label}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs text-muted-foreground block mb-1">Delay (segundos)</label>
          <input type="number" value={delay} onChange={e => { setDelay(Number(e.target.value)); setDirty(true); }} min={0} max={60}
            className="w-[100px] bg-secondary border border-border rounded px-3 py-2 text-sm text-foreground" />
        </div>
        <div className="flex items-center gap-2.5 pb-1">
          <label className="relative inline-flex items-center cursor-pointer">
            <input type="checkbox" checked={enabled} onChange={e => { setEnabled(e.target.checked); setDirty(true); }} className="sr-only peer" />
            <div className="w-9 h-5 bg-white/10 rounded-full peer-checked:bg-green-500/60 after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-full" />
          </label>
          <span className="text-sm text-muted-foreground">Activar envío automático</span>
        </div>
      </div>

      {/* Fiat tabs */}
      <div className="flex gap-1.5 flex-wrap">
        <button onClick={() => setTab('global')} className={`px-3 py-1.5 text-xs rounded border font-medium ${tab === 'global' ? 'bg-primary text-primary-foreground border-primary' : 'border-border text-muted-foreground'}`}>🌐 Global</button>
        {FIAT_TABS.map(f => (
          <button key={f} onClick={() => setTab(f)} className={`px-3 py-1.5 text-xs rounded border font-medium ${tab === f ? 'bg-primary text-primary-foreground border-primary' : 'border-border text-muted-foreground'}`}>{f}</button>
        ))}
      </div>

      {tab !== 'global' && (
        <div className="text-xs p-3 rounded-lg" style={{ background: 'rgba(14,165,233,0.07)', border: '1px solid rgba(14,165,233,0.2)', color: '#0ea5e9' }}>
          Los campos vacíos usarán automáticamente el mensaje <strong>Global</strong>.
        </div>
      )}

      {/* Event cards */}
      <div className="space-y-3">
        {MSG_EVENTS.map(ev => {
          const val = messages[ev.key] || '';
          const hasMsg = !!val.trim();
          return (
            <div key={ev.key} className="bg-card border border-border rounded-xl p-4" style={{ borderLeftWidth: '3px', borderLeftColor: ev.color }}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-semibold text-foreground">{ev.label}</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full font-bold"
                  style={{ background: hasMsg ? 'rgba(16,185,129,0.15)' : 'rgba(255,255,255,0.05)', color: hasMsg ? '#10b981' : undefined, border: hasMsg ? '1px solid rgba(16,185,129,0.3)' : '1px solid rgba(255,255,255,0.1)' }}>
                  {hasMsg ? '✓ Configurado' : 'Sin mensaje'}
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground mb-2">{ev.desc}</p>
              <textarea id={`msg-${ev.key}`} value={val} onChange={e => updateMsg(ev.key, e.target.value)} rows={3} maxLength={500}
                placeholder={MSG_DEFAULTS[ev.key] ? 'Ej: ' + MSG_DEFAULTS[ev.key].substring(0, 60) + '...' : 'Deja vacío para no enviar mensaje...'}
                className="w-full bg-secondary border border-border rounded px-3 py-2 text-sm text-foreground resize-none focus:outline-none focus:border-primary" />
              <div className="flex justify-between items-center mt-1 mb-2">
                <span className={`text-[10px] ${val.length > 480 ? 'text-red-400' : val.length > 400 ? 'text-amber-400' : 'text-muted-foreground'}`}>{val.length} / 500</span>
              </div>
              <div className="flex flex-wrap gap-1">
                {MSG_VARS.map(v => (
                  <button key={v} onClick={() => insertVar(`msg-${ev.key}`, v)}
                    className="text-[10px] px-2 py-0.5 rounded bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 cursor-pointer">{v}</button>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Save */}
      <div className="border-t border-border pt-4">
        <button onClick={saveMessages} disabled={saving} className="px-6 py-2 rounded-lg bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/90 disabled:opacity-50">
          {saving ? 'Guardando...' : '💾 Guardar mensajes'}
        </button>
        {dirty && <span className="ml-3 text-xs text-amber-400">· Cambios sin guardar</span>}
      </div>
    </div>
  );
}
