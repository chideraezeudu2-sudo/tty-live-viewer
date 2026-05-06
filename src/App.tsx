import { useState, useEffect, useRef, useCallback } from 'react';
import { Eye, Highlighter, RotateCcw, Copy, Maximize2, X, Play } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL || 'https://ghpmcjozeubrmiuzyfey.supabase.co',
  import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdocG1jam96ZXVicm1pdXp5ZmV5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc5MjYzMjYsImV4cCI6MjA5MzUwMjMyNn0.3UHkakDeyj6bDdDo5DcoiLWLMxCmdPc1KaZ7sZNSV6w'
);
const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'https://tty-live-worker.workers.dev';

interface BufferLine { time: string; data: string; }

export default function App() {
  const [isLive, setIsLive] = useState(true);
  const [isRewindOpen, setIsRewindOpen] = useState(false);
  const [isHighlightMode, setIsHighlightMode] = useState(false);
  const [viewerCount, setViewerCount] = useState(0);
  const [sessionName, setSessionName] = useState('Loading...');
  const [sessionEnded, setSessionEnded] = useState<{ duration: number; peakViewers: number } | null>(null);
  const [terminalLines, setTerminalLines] = useState<string[]>([]);
  const [rewindLines, setRewindLines] = useState<BufferLine[]>([]);
  const [lastCommand, setLastCommand] = useState('');
  const [copied, setCopied] = useState(false);
  const [highlightedLine, setHighlightedLine] = useState<number | null>(null);
  const terminalRef = useRef<HTMLDivElement>(null);
  const socketRef = useRef<Socket | null>(null);

  // Get session ID from URL path e.g. /view/abc123
  const sessionId = window.location.pathname.split('/').pop() || '';

  useEffect(() => {
    if (!sessionId) return;

    // Subscribe to Supabase Realtime for live terminal data
    const channel = supabase.channel(`session:${sessionId}`, { config: { broadcast: { self: false } } })
      .on('broadcast', { event: 'terminal_data' }, ({ payload }) => {
      setTerminalLines(prev => {
        const lines = [...prev, ...data.split('\n').filter(Boolean)];
        // Keep last 2000 lines for performance
        return lines.slice(-2000);
      });
      // Track last command (lines starting with $ or #)
      const cmds = data.split('\n').filter(l => l.trim().startsWith('$') || l.trim().startsWith('#'));
      if (cmds.length) setLastCommand(cmds[cmds.length - 1]);
      // Auto-scroll
      setTimeout(() => {
        if (terminalRef.current) terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
      }, 50);
    });

    channel
      .on('broadcast', { event: 'viewer_count' }, ({ payload }) => setViewerCount(payload.count))
      .on('broadcast', { event: 'session_stopped' }, ({ payload }) => {
        setIsLive(false);
        setSessionEnded(payload);
      })
      .subscribe();

    // Check if session already ended
    fetch(`${SERVER_URL}/api/sessions/${sessionId}/status`)
      .then(r => r.json())
      .then(d => { if (d.status === 'completed') { setIsLive(false); setSessionEnded({ duration: 0, peakViewers: d.peak_viewers }); } })
      .catch(() => {});

    return () => {
      channel.unsubscribe();
    };
  }, [sessionId]);

  const handleRewindOpen = () => {
    setIsRewindOpen(true);
    fetch(`${SERVER_URL}/api/stream/rewind?session_id=${sessionId}`)
      .then(r => r.json())
      .then(rows => setRewindLines(rows.map((r: any) => ({ time: r.created_at, data: r.chunk }))))
      .catch(console.error);
  };

  const handleHighlightLine = useCallback((lineIndex: number) => {
    if (!isHighlightMode) return;
    setHighlightedLine(lineIndex);
    fetch(`${SERVER_URL}/api/stream/highlight`, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ session_id: sessionId, line_index: lineIndex }) }).catch(()=>{});
    setTimeout(() => setHighlightedLine(null), 2000);
  }, [isHighlightMode, sessionId]);

  const copyLastCommand = () => {
    if (!lastCommand) return;
    navigator.clipboard.writeText(lastCommand);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) document.documentElement.requestFullscreen();
    else document.exitFullscreen?.();
  };

  const formatDuration = (seconds: number) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  return (
    <div className="flex flex-col h-screen w-screen bg-void-black text-canvas-white font-suisse-intl selection:bg-canvas-white selection:text-void-black">
      {/* Top Bar */}
      <header className="h-12 px-6 flex items-center justify-between border-b border-iron bg-void-black z-50 shrink-0">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 bg-canvas-white flex items-center justify-center rounded-sm">
              <span className="text-void-black font-bold text-[10px]">tty</span>
            </div>
            <span className="font-bold text-[14px] tracking-tight">tty.live</span>
          </div>
          <div className="w-px h-4 bg-iron" />
          <span className="text-[13px] font-medium uppercase tracking-widest text-ash-gray">
            {sessionName}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {isLive ? (
            <div className="flex items-center gap-2">
              <div className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-500 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
              </div>
              <span className="text-[12px] font-bold tracking-[0.1em] text-green-500 uppercase">LIVE</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 opacity-50">
              <div className="w-2 h-2 bg-ash-gray rounded-full" />
              <span className="text-[12px] font-bold tracking-[0.1em] text-ash-gray uppercase">SESSION ENDED</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-3">
          <Eye size={14} className="text-ash-gray" />
          <span className="text-[13px] font-mono tabular-nums text-canvas-white">{viewerCount}</span>
        </div>
      </header>

      {/* Main Terminal Area */}
      <main className="relative flex-1 bg-void-black overflow-hidden flex flex-col">
        <div
          ref={terminalRef}
          className={`flex-1 p-6 font-mono text-[14px] overflow-y-auto ${isHighlightMode ? 'cursor-crosshair' : ''}`}
        >
          {terminalLines.length === 0 ? (
            <div className="text-ash-gray opacity-50 text-sm">Waiting for terminal output...</div>
          ) : (
            terminalLines.map((line, i) => (
              <div
                key={i}
                onClick={() => handleHighlightLine(i)}
                className={`terminal-line mb-0.5 flex gap-4 transition-all ${
                  highlightedLine === i
                    ? 'bg-yellow-500/20 text-yellow-300'
                    : 'opacity-70 hover:opacity-100'
                } ${isHighlightMode ? 'hover:bg-white/5 rounded' : ''}`}
              >
                <span className="break-all whitespace-pre-wrap">{line}</span>
              </div>
            ))
          )}
          {isLive && (
            <div className="flex gap-4 mt-1">
              <span className="w-2.5 h-5 bg-canvas-white block animate-pulse" />
            </div>
          )}
        </div>

        {/* Session Ended Overlay */}
        {!isLive && sessionEnded && (
          <div className="absolute inset-0 z-40 bg-void-black/80 backdrop-blur-sm flex items-center justify-center text-center">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="p-8 bg-coal rounded-xl border border-iron shadow-2xl"
            >
              <div className="text-ash-gray text-[12px] uppercase tracking-widest mb-2">The host has stopped the stream</div>
              <h2 className="text-[36px] font-bold mb-4">This session has ended</h2>
              <div className="text-ash-gray flex items-center justify-center gap-6">
                <div className="flex flex-col items-start">
                  <span className="text-[10px] uppercase font-semibold text-ash-gray opacity-50">Duration</span>
                  <span className="text-canvas-white font-mono text-lg">{formatDuration(sessionEnded.duration)}</span>
                </div>
                <div className="w-[1px] h-8 bg-iron"></div>
                <div className="flex flex-col items-start">
                  <span className="text-[10px] uppercase font-semibold text-ash-gray opacity-50">Peak Viewers</span>
                  <span className="text-canvas-white font-mono text-lg">{sessionEnded.peakViewers}</span>
                </div>
              </div>
              <button
                onClick={handleRewindOpen}
                className="mt-6 flex items-center gap-2 px-4 py-2 bg-iron rounded-lg text-sm font-medium hover:bg-white/10 transition-colors mx-auto"
              >
                <RotateCcw size={14} /> View Session History
              </button>
            </motion.div>
          </div>
        )}

        {/* Floating Pill */}
        <div className="absolute bottom-8 right-8 z-50">
          <div className="flex items-center bg-coal border border-iron rounded-full p-1.5 shadow-[rgba(0,0,0,0.4)_0px_20px_40px_-10px]">
            <button
              onClick={() => setIsHighlightMode(!isHighlightMode)}
              className={`p-2.5 rounded-full transition-colors group relative ${isHighlightMode ? 'bg-yellow-500/20' : 'hover:bg-iron'}`}
            >
              <Highlighter size={20} className={isHighlightMode ? 'text-yellow-400' : 'text-ash-gray group-hover:text-canvas-white'} />
              <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-canvas-white text-void-black text-[10px] font-bold px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap">
                {isHighlightMode ? 'EXIT HIGHLIGHT' : 'HIGHLIGHT'}
              </div>
            </button>
            <button
              onClick={handleRewindOpen}
              className="p-2.5 rounded-full hover:bg-iron transition-colors group relative"
            >
              <RotateCcw size={20} className="text-ash-gray group-hover:text-canvas-white" />
              <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-canvas-white text-void-black text-[10px] font-bold px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap">
                REWIND
              </div>
            </button>
            <button
              onClick={copyLastCommand}
              className="p-2.5 rounded-full hover:bg-iron transition-colors group relative"
            >
              <Copy size={20} className={copied ? 'text-green-400' : 'text-ash-gray group-hover:text-canvas-white'} />
              <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-canvas-white text-void-black text-[10px] font-bold px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap">
                {copied ? 'COPIED!' : 'COPY LAST CMD'}
              </div>
            </button>
            <button
              onClick={toggleFullscreen}
              className="p-2.5 rounded-full hover:bg-iron transition-colors group relative"
            >
              <Maximize2 size={20} className="text-ash-gray group-hover:text-canvas-white" />
              <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-canvas-white text-void-black text-[10px] font-bold px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap">
                FULLSCREEN
              </div>
            </button>
          </div>
        </div>

        {/* Rewind Panel */}
        <AnimatePresence>
          {isRewindOpen && (
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="absolute inset-x-0 bottom-0 top-1/4 z-50 bg-[#061c37] border-t border-iron flex flex-col shadow-2xl"
            >
              <div className="h-14 px-6 flex items-center justify-between border-b border-coal shrink-0">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-iron rounded-md">
                    <RotateCcw size={16} />
                  </div>
                  <h3 className="font-bold text-sm">Session History</h3>
                  <span className="text-xs text-ash-gray">Last 5 minutes</span>
                </div>
                <div className="flex items-center gap-4">
                  {isLive && (
                    <button
                      onClick={() => setIsRewindOpen(false)}
                      className="flex items-center gap-2 px-4 py-2 bg-canvas-white text-void-black text-xs font-bold rounded-lg hover:bg-frost transition-colors"
                    >
                      <Play size={14} fill="currentColor" /> BACK TO LIVE
                    </button>
                  )}
                  <button onClick={() => setIsRewindOpen(false)} className="p-2 hover:bg-iron rounded-full transition-colors">
                    <X size={20} className="text-ash-gray" />
                  </button>
                </div>
              </div>
              <div className="flex-1 p-6 overflow-y-auto font-mono text-sm leading-relaxed">
                {rewindLines.length === 0 ? (
                  <div className="text-ash-gray opacity-50">No history available yet.</div>
                ) : (
                  <div className="max-w-4xl mx-auto space-y-2">
                    {rewindLines.map((line, i) => (
                      <div key={i} className="group flex gap-6 hover:bg-coal/30 p-2 -mx-2 rounded-lg transition-colors">
                        <span className="text-[10px] text-ash-gray font-sans shrink-0 w-20">
                          {new Date(line.time).toLocaleTimeString()}
                        </span>
                        <span className="text-ash-gray/80 whitespace-pre-wrap break-all">{line.data}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
