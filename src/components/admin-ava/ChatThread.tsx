/**
 * ChatThread — AI Elements quality chat interface.
 *
 * Centered content, auto-scroll, suggestion chips,
 * rich prompt input with mic + send. No sidebar.
 */

import { useRef, useEffect, useState, useCallback, type KeyboardEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Send, Loader2, RotateCcw, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAdminAvaChat } from '@/contexts/AdminAvaChatContext';
import { ChatMessage } from './ChatMessage';
import { SuggestionChips } from './SuggestionChips';
import { MicButton } from './MicButton';

export function ChatThread() {
  const { messages, sendMessage, isStreaming, streamStatus, clearMessages } = useAdminAvaChat();
  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Auto-resize textarea
  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    const el = e.target;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, []);

  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text || isStreaming) return;
    setInput('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
    await sendMessage(text);
    textareaRef.current?.focus();
  }, [input, isStreaming, sendMessage]);

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSuggestion = (text: string) => {
    setInput(text);
    textareaRef.current?.focus();
  };

  const showWelcome = messages.length <= 1 && !isStreaming;

  return (
    <div className="flex flex-col h-full">
      {/* Scrollable message area */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto scrollbar-thin">
        <div className="max-w-3xl mx-auto px-4">
          {/* Welcome state */}
          {showWelcome && (
            <div className="flex flex-col items-center justify-center pt-24 pb-8 animate-slide-up">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/10 flex items-center justify-center mb-6">
                <Sparkles className="w-6 h-6 text-primary" />
              </div>
              <h1 className="text-xl font-semibold text-foreground mb-2">Admin Ava</h1>
              <p className="text-sm text-text-secondary text-center max-w-md leading-relaxed">
                Your AI operations assistant. Ask about incidents, run councils,
                dispatch Codex patches, or analyze system health.
              </p>
            </div>
          )}

          {/* Messages */}
          <div className="py-4 space-y-6">
            {messages.map((msg) => (
              <ChatMessage key={msg.id} message={msg} />
            ))}
          </div>

          {/* Scroll anchor */}
          <div ref={bottomRef} />
        </div>
      </div>

      {/* Suggestion chips (only show in welcome state) */}
      {showWelcome && (
        <div className="max-w-3xl mx-auto w-full px-4">
          <SuggestionChips onSelect={handleSuggestion} />
        </div>
      )}

      {/* Input area — fixed bottom */}
      <div className="border-t border-border/50 bg-background/80 backdrop-blur-sm">
        <div className="max-w-3xl mx-auto px-4 py-3">
          <div className="relative flex items-end gap-2 rounded-2xl border border-border/60 bg-surface-1 px-3 py-2 focus-within:border-primary/40 focus-within:ring-1 focus-within:ring-primary/20 transition-all">
            {/* Textarea */}
            <textarea
              ref={textareaRef}
              value={input}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder="What would you like to know?"
              className={cn(
                'flex-1 bg-transparent text-sm text-foreground placeholder:text-text-tertiary',
                'resize-none outline-none min-h-[24px] max-h-[160px] py-1',
                'leading-relaxed',
              )}
              disabled={isStreaming}
              rows={1}
            />

            {/* Toolbar */}
            <div className="flex items-center gap-1 flex-shrink-0 pb-0.5">
              <MicButton />

              {isStreaming ? (
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8 rounded-xl"
                  disabled
                >
                  <Loader2 className="w-4 h-4 animate-spin text-primary" />
                </Button>
              ) : (
                <Button
                  size="icon"
                  onClick={handleSend}
                  disabled={!input.trim()}
                  className={cn(
                    'h-8 w-8 rounded-xl transition-all',
                    input.trim()
                      ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                      : 'bg-surface-2 text-text-tertiary',
                  )}
                >
                  <Send className="w-4 h-4" />
                </Button>
              )}
            </div>
          </div>

          {/* Status bar */}
          <div className="flex items-center justify-between mt-1.5 px-1">
            <div className="flex items-center gap-2">
              {streamStatus === 'streaming' && (
                <span className="text-[10px] text-primary flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                  Streaming
                </span>
              )}
              {streamStatus === 'connecting' && (
                <span className="text-[10px] text-text-tertiary flex items-center gap-1">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  Connecting
                </span>
              )}
              {streamStatus === 'error' && (
                <span className="text-[10px] text-destructive flex items-center gap-1">
                  Reconnecting...
                </span>
              )}
            </div>

            {messages.length > 1 && (
              <button
                onClick={clearMessages}
                className="text-[10px] text-text-tertiary hover:text-text-secondary flex items-center gap-1 transition-colors"
              >
                <RotateCcw className="w-3 h-3" />
                Clear
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
