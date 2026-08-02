import { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, Loader2, X } from 'lucide-react';
import { aiApi, menuApi } from '../../lib/api';
import { useI18n } from '../../contexts/I18nContext';
import { WaveAvatar } from './WaveAvatar';
import type { MenuItem } from '../../lib/api/types';

type VoiceState = 'idle' | 'connecting' | 'live' | 'error';

/**
 * Voice ordering — connects the guest's mic to OpenAI's Realtime API over
 * WebRTC using a short-lived token minted by our backend (the API key never
 * reaches the browser). The model has the menu as spoken context. The live UI
 * mirrors Escoutly's immersive voice panel, re-themed to Qlisted's browns.
 */
type CartLine = { id: string; name: string; quantity: number };

export function VoiceOrderWidget({ slug, onAddItem, onRemoveItem, getCart }: {
  slug: string;
  onAddItem?: (item: MenuItem, quantity: number) => void;
  onRemoveItem?: (itemId: string) => void;
  getCart?: () => { items: CartLine[]; total: number };
}) {
  const { t } = useI18n();
  const [enabled, setEnabled] = useState(false);
  const [state, setState] = useState<VoiceState>('idle');
  const [speaking, setSpeaking] = useState(false);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const dcRef = useRef<RTCDataChannel | null>(null);
  const micRef = useRef<MediaStream | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const acRef = useRef<AudioContext | null>(null);
  const rafRef = useRef<number>(0);
  const itemsRef = useRef<MenuItem[]>([]);
  const callNamesRef = useRef<Record<string, string>>({}); // call_id -> tool name
  const onAddRef = useRef(onAddItem); onAddRef.current = onAddItem;
  const onRemoveRef = useRef(onRemoveItem); onRemoveRef.current = onRemoveItem;
  const getCartRef = useRef(getCart); getCartRef.current = getCart;

  useEffect(() => {
    if (!slug) return;
    aiApi.status(slug).then((r) => setEnabled(r.enabled)).catch(() => setEnabled(false));
    // Cache the menu so the cart tools can resolve spoken names.
    menuApi.getFullMenu(slug).then((m) => { itemsRef.current = (m.items || []).filter((i) => i.available); }).catch(() => {});
  }, [slug]);

  function executeAddToCart(name: string, quantity: number) {
    const q = (name || '').toLowerCase().trim();
    if (!q) return { ok: false, error: 'No item name given' };
    const items = itemsRef.current;
    const item =
      items.find((i) => i.name.toLowerCase() === q) ||
      items.find((i) => i.name.toLowerCase().includes(q) || q.includes(i.name.toLowerCase()));
    if (!item) return { ok: false, error: `No menu item matches "${name}"` };
    const qty = Math.max(1, Math.floor(quantity) || 1);
    onAddRef.current?.(item, qty);
    return { ok: true, added: item.name, quantity: qty, price: item.price };
  }

  function executeRemoveFromCart(name: string) {
    const q = (name || '').toLowerCase().trim();
    const cart = getCartRef.current?.();
    if (!cart || cart.items.length === 0) return { ok: false, error: 'Cart is empty' };
    const line =
      cart.items.find((c) => c.name.toLowerCase() === q) ||
      cart.items.find((c) => c.name.toLowerCase().includes(q) || q.includes(c.name.toLowerCase()));
    if (!line) return { ok: false, error: `"${name}" is not in the cart` };
    onRemoveRef.current?.(line.id);
    return { ok: true, removed: line.name };
  }

  function executeReadCart() {
    const cart = getCartRef.current?.() ?? { items: [], total: 0 };
    return {
      ok: true,
      items: cart.items.map((c) => ({ name: c.name, quantity: c.quantity })),
      total: Number(cart.total.toFixed(2)),
      empty: cart.items.length === 0,
    };
  }

  function runTool(name: string, args: { item_name?: string; quantity?: number }) {
    if (name === 'remove_from_cart') return executeRemoveFromCart(args.item_name || '');
    if (name === 'read_cart') return executeReadCart();
    return executeAddToCart(args.item_name || '', args.quantity || 1); // default add_to_cart
  }

  // Handle OpenAI Realtime data-channel events — run tool calls the agent makes.
  function handleRealtimeEvent(evt: { type?: string; name?: string; call_id?: string; arguments?: string; item?: { type?: string; name?: string; call_id?: string } }) {
    // The function name arrives on the item; cache it by call_id for the args.done event.
    if (evt.type === 'response.output_item.added' && evt.item?.type === 'function_call' && evt.item.call_id && evt.item.name) {
      callNamesRef.current[evt.item.call_id] = evt.item.name;
      return;
    }
    if (evt.type === 'response.function_call_arguments.done' && evt.call_id) {
      const name = evt.name || callNamesRef.current[evt.call_id] || 'add_to_cart';
      let args: { item_name?: string; quantity?: number } = {};
      try { args = JSON.parse(evt.arguments || '{}'); } catch { /* ignore */ }
      const result = runTool(name, args);
      delete callNamesRef.current[evt.call_id];
      const dc = dcRef.current;
      if (dc && dc.readyState === 'open') {
        dc.send(JSON.stringify({ type: 'conversation.item.create', item: { type: 'function_call_output', call_id: evt.call_id, output: JSON.stringify(result) } }));
        dc.send(JSON.stringify({ type: 'response.create' }));
      }
    }
  }

  function cleanup() {
    cancelAnimationFrame(rafRef.current);
    acRef.current?.close().catch(() => {});
    acRef.current = null;
    dcRef.current = null;
    pcRef.current?.close();
    pcRef.current = null;
    micRef.current?.getTracks().forEach((tr) => tr.stop());
    micRef.current = null;
    setSpeaking(false);
  }
  useEffect(() => cleanup, []);

  // Drive the avatar from the AI's audio output level (reactive, like Escoutly).
  function attachAnalyser(stream: MediaStream) {
    try {
      const ac = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      acRef.current = ac;
      const src = ac.createMediaStreamSource(stream);
      const analyser = ac.createAnalyser();
      analyser.fftSize = 256;
      src.connect(analyser);
      const data = new Uint8Array(analyser.frequencyBinCount);
      const tick = () => {
        analyser.getByteFrequencyData(data);
        const avg = data.reduce((a, b) => a + b, 0) / data.length;
        setSpeaking(avg > 12);
        rafRef.current = requestAnimationFrame(tick);
      };
      tick();
    } catch { /* analyser optional */ }
  }

  async function start() {
    setState('connecting');
    try {
      const mic = await navigator.mediaDevices.getUserMedia({ audio: true });
      micRef.current = mic;
      const { clientSecret } = await aiApi.voiceSession(slug);

      const pc = new RTCPeerConnection();
      pcRef.current = pc;
      pc.ontrack = (e) => {
        if (audioRef.current) audioRef.current.srcObject = e.streams[0];
        attachAnalyser(e.streams[0]);
      };
      const track = mic.getAudioTracks()[0];
      if (track) pc.addTransceiver(track, { direction: 'sendrecv' });
      const dc = pc.createDataChannel('oai-events');
      dcRef.current = dc;
      dc.onmessage = (e) => { try { handleRealtimeEvent(JSON.parse(e.data)); } catch { /* ignore non-JSON */ } };
      pc.onconnectionstatechange = () => {
        const s = pc.connectionState;
        if (s === 'failed' || s === 'disconnected' || s === 'closed') { cleanup(); setState('idle'); }
      };

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      const resp = await fetch('https://api.openai.com/v1/realtime/calls', {
        method: 'POST',
        body: offer.sdp,
        headers: { Authorization: `Bearer ${clientSecret}`, 'Content-Type': 'application/sdp' },
      });
      if (!resp.ok) throw new Error('connect failed');
      await pc.setRemoteDescription({ type: 'answer', sdp: await resp.text() });
      setState('live');
    } catch {
      cleanup();
      setState('error');
    }
  }

  function stop() { cleanup(); setState('idle'); }

  if (!enabled) return null;

  const live = state === 'live';
  const active = state === 'live' || state === 'connecting';
  const pillLabel = state === 'connecting' ? t('voice.connecting')
    : state === 'error' ? t('voice.retry')
    : t('voice.cta');

  return (
    <>
      <audio ref={audioRef} autoPlay hidden />

      {/* Idle / error → floating pill */}
      {!active && (
        <button
          onClick={start}
          aria-label={t('voice.cta')}
          className="fixed bottom-6 left-5 z-40 flex items-center gap-2 rounded-full bg-brand-500 px-4 py-3 text-white shadow-card hover:bg-brand-600"
        >
          {state === 'error' ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
          <span className="text-sm font-medium">{pillLabel}</span>
        </button>
      )}

      {/* Connecting / live → immersive voice panel (Escoutly-style, brand theme) */}
      {active && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="relative flex w-[min(92vw,26rem)] flex-col items-center gap-6 rounded-card bg-gradient-to-b from-brand-900 to-brand-950 p-8 text-center shadow-float ring-1 ring-white/10">
            <button onClick={stop} aria-label={t('voice.stop')} className="absolute right-4 top-4 rounded-full p-1.5 text-white/70 hover:bg-white/10 hover:text-white">
              <X className="h-5 w-5" />
            </button>
            <WaveAvatar speaking={live && speaking} />
            <div>
              <p className="text-lg font-semibold text-white">
                {state === 'connecting' ? t('voice.connecting') : speaking ? t('voice.speaking') : t('voice.listening')}
              </p>
              <p className="mt-1 text-sm text-accent-light/70">{t('voice.hint')}</p>
            </div>
            <button
              onClick={stop}
              disabled={state === 'connecting'}
              className="flex items-center gap-2 rounded-full bg-white/10 px-6 py-3 text-sm font-medium text-white hover:bg-white/20 disabled:opacity-60"
            >
              {state === 'connecting' ? <Loader2 className="h-5 w-5 animate-spin" /> : <MicOff className="h-5 w-5" />}
              {state === 'connecting' ? t('voice.connecting') : t('voice.stop')}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
