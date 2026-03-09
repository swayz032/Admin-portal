/**
 * MarkdownRenderer — rich markdown with syntax-highlighted code blocks.
 * Used for Ava's responses in the admin chat.
 */

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { cn } from '@/lib/utils';
import { Copy, Check } from 'lucide-react';
import { useState, useCallback } from 'react';

interface MarkdownRendererProps {
  content: string;
  className?: string;
  /** Whether content is still streaming (shows cursor) */
  isStreaming?: boolean;
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [text]);

  return (
    <button
      onClick={handleCopy}
      className="absolute top-2 right-2 p-1.5 rounded-md bg-surface-3/80 hover:bg-surface-3 text-text-tertiary hover:text-text-secondary transition-colors"
      aria-label="Copy code"
    >
      {copied ? <Check className="w-3.5 h-3.5 text-success" /> : <Copy className="w-3.5 h-3.5" />}
    </button>
  );
}

export function MarkdownRenderer({ content, className, isStreaming }: MarkdownRendererProps) {
  return (
    <div className={cn('markdown-body', className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => (
            <h1 className="text-lg font-semibold text-foreground mt-4 mb-2 first:mt-0">{children}</h1>
          ),
          h2: ({ children }) => (
            <h2 className="text-base font-semibold text-foreground mt-3 mb-1.5 first:mt-0">{children}</h2>
          ),
          h3: ({ children }) => (
            <h3 className="text-sm font-semibold text-foreground mt-2 mb-1 first:mt-0">{children}</h3>
          ),
          p: ({ children }) => (
            <p className="text-sm leading-relaxed text-foreground/90 mb-2 last:mb-0">{children}</p>
          ),
          ul: ({ children }) => (
            <ul className="text-sm space-y-1 mb-2 ml-4 list-disc text-foreground/90">{children}</ul>
          ),
          ol: ({ children }) => (
            <ol className="text-sm space-y-1 mb-2 ml-4 list-decimal text-foreground/90">{children}</ol>
          ),
          li: ({ children }) => (
            <li className="leading-relaxed">{children}</li>
          ),
          strong: ({ children }) => (
            <strong className="font-semibold text-foreground">{children}</strong>
          ),
          em: ({ children }) => (
            <em className="text-foreground/80">{children}</em>
          ),
          a: ({ href, children }) => (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:text-primary/80 underline underline-offset-2"
            >
              {children}
            </a>
          ),
          blockquote: ({ children }) => (
            <blockquote className="border-l-2 border-primary/30 pl-3 py-0.5 text-text-secondary italic my-2">
              {children}
            </blockquote>
          ),
          table: ({ children }) => (
            <div className="overflow-x-auto my-2 rounded-lg border border-border/50">
              <table className="data-table text-xs">{children}</table>
            </div>
          ),
          code: ({ className: codeClassName, children, ...props }) => {
            const match = /language-(\w+)/.exec(codeClassName || '');
            const codeString = String(children).replace(/\n$/, '');

            if (match) {
              return (
                <div className="relative my-2 rounded-lg overflow-hidden border border-border/30">
                  <div className="flex items-center justify-between px-3 py-1.5 bg-surface-3/50 border-b border-border/20">
                    <span className="text-[10px] font-mono text-text-tertiary uppercase tracking-wider">{match[1]}</span>
                  </div>
                  <CopyButton text={codeString} />
                  <SyntaxHighlighter
                    style={oneDark}
                    language={match[1]}
                    PreTag="div"
                    customStyle={{
                      margin: 0,
                      padding: '12px 16px',
                      background: 'hsl(240 10% 6%)',
                      fontSize: '12px',
                      lineHeight: '1.6',
                    }}
                  >
                    {codeString}
                  </SyntaxHighlighter>
                </div>
              );
            }

            return (
              <code className="px-1.5 py-0.5 rounded-md bg-surface-3 text-primary/90 text-xs font-mono" {...props}>
                {children}
              </code>
            );
          },
          hr: () => <hr className="border-border/30 my-3" />,
        }}
      >
        {content}
      </ReactMarkdown>
      {isStreaming && (
        <span className="inline-block w-2 h-4 ml-0.5 bg-primary/70 animate-pulse rounded-sm" />
      )}
    </div>
  );
}
