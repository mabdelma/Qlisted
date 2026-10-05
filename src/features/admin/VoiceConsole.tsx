import { useState, useRef, useEffect, useCallback } from 'react';
import { Mic, MicOff, Loader2, AudioLines } from 'lucide-react';
import { aiApi } from '../../lib/api';
import { useI18n } from '../../contexts/I18nContext';

type State = 'idle' | 'connecting' | 'live' | 'error';
interface Turn { role: 'you' | 'copilot'; text: string }

/**
 * Spoken conversation with the copilot, for the admin portal.
 *
 * Same architecture as the guest voice widget and as Escoutly's agent: the
 * server mints a short-lived client secret (POST /r/:slug/ai/voice-session) and
 * the browser holds a WebRTC call directly with OpenAI Realtime. The long-lived
 * OPENAI_API_KEY never reaches the client — that is the whole point of the
 * ephemeral secret, and why this cannot be done with a plain fetch from here.
 *
 * Distinct from VoiceOrderWidget, which is wired to a guest's cart (add item,
 * remove item, read cart). This one carries no tools: it is a conversation
 * about the business, and the transcript is the product.
 */
export function VoiceConsole({ slug }: { slug: string }) {
  const { t } = useI18n();
  const [state, setState] = useState<State>('idle');
  const [turns, setTurns] = useState<Turn[]>([]);
  const [partial, setPartial] = useState('');

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const micRef = useRef<MediaStream | null>(null);
  const dcRef = useRef<RTCDataChannel | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const cleanup = useCallback(() => {
    dcRef.current?.close();
    pcRef.current?.close();
    micRef.current?.getTracks().forEach((tr) => tr.stop());
    dcRef.current = null;
    pcRef.current = null;
    micRef.current = null;
    setPartial('');
  }, []);

  // A live WebRTC call and an open mic must not outlive the page.
  useEffect(() => cleanup, [cleanup]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [turns, partial]);

  function onEvent(evt: { type?: string; delta?: string; transcript?: string }) {
    // Model audio transcript streams as deltas, then a `.done` with the full
    // text. Render the deltas so the reply appears as it is spoken, then
    // replace with the final transcript rather than appending both.
    if (evt.type === 'response.audio_transcript.delta' && evt.delta) {
      setPartial((p) => p + evt.delta);
      return;
    }
    if (evt.type === 'response.audio_transcript.done') {
      const text = (evt.transcript || '').trim();
      setPartial('');
      if (text) setTurns((prev) => [...prev, { role: 'copilot', text }]);
      return;
    }
    // What the admin said, once the server has transcribed it.
    if (evt.type === 'conversation.item.input_audio_transcription.completed') {
      const text = (evt.transcript || '').trim();
      if (text) setTurns((prev) => [...prev, { role: 'you', text }]);
    }
  }

  async function start() {
    setState('connecting');
    try {
      const mic = await navigator.mediaDevices.getUserMedia({ audio: true });
      micRef.current = mic;
      const { clientSecret } = await aiApi.voiceSession(slug);

      const pc = new RTCPeerConnection();
      pcRef.current = pc;
      pc.ontrack = (e) => { if (audioRef.current) audioRef.current.srcObject = e.streams[0]; };
      const track = mic.getAudioTracks()[0];
      if (track) pc.addTransceiver(track, { direction: 'sendrecv' });

      const dc = pc.createDataChannel('oai-events');
      dcRef.current = dc;
      dc.onmessage = (e) => { try { onEvent(JSON.parse(e.data)); } catch { /* ignore non-JSON */ } };
      dc.onopen = () => {
        // Ask for input transcription explicitly — without it the admin's own
        // words never come back and the transcript shows only one side.
        dc.send(JSON.stringify({
          type: 'session.update',
          session: { input_audio_transcription: { model: 'whisper-1' } },
        }));
      };

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

  const live = state === 'live';

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <audio ref={audioRef} autoPlay hidden />

      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className={`flex h-9 w-9 items-center justify-center rounded-lg ${live ? 'bg-brand-500 text-white' : 'bg-gray-100 text-gray-500'}`}>
            <AudioLines className="h-4 w-4" />
          </span>
          <div>
            <p className="text-sm font-semibold text-gray-900">{t('assistant.voiceTitle')}</p>
            <p className="text-xs text-gray-500">
              {live ? t('assistant.voiceLive') : state === 'error' ? t('assistant.voiceError') : t('assistant.voiceHint')}
            </p>
          </div>
        </div>

        <button
          onClick={live || state === 'connecting' ? stop : start}
          disabled={state === 'connecting'}
          className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
            live ? 'bg-red-600 text-white hover:bg-red-700' : 'bg-brand-500 text-white hover:bg-brand-600 disabled:opacity-60'
          }`}
        >
          {state === 'connecting' ? <Loader2 className="h-4 w-4 animate-spin" />
            : live ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
          {state === 'connecting' ? t('assistant.voiceConnecting')
            : live ? t('assistant.voiceStop')
              : state === 'error' ? t('common.retry') : t('assistant.voiceStart')}
        </button>
      </div>

      {(turns.length > 0 || partial) && (
        <div ref={scrollRef} className="mt-4 max-h-64 space-y-2 overflow-y-auto border-t border-gray-100 pt-3">
          {turns.map((turn, i) => (
            <div key={i} className={turn.role === 'you' ? 'text-end' : ''}>
              <span
                className={`inline-block max-w-[85%] rounded-2xl px-3 py-2 text-sm ${
                  turn.role === 'you'
                    ? 'rounded-br-sm bg-brand-500 text-white'
                    : 'rounded-bl-sm bg-gray-100 text-gray-800'
                }`}
              >
                {turn.text}
              </span>
            </div>
          ))}
          {partial && (
            <div>
              <span className="inline-block max-w-[85%] rounded-2xl rounded-bl-sm bg-gray-100 px-3 py-2 text-sm text-gray-500">
                {partial}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
