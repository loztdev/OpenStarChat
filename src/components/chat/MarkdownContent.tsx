import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkBreaks from 'remark-breaks'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism'

interface MarkdownContentProps {
  text: string
  /** Assistant bubbles use full code blocks; composer overlay uses lightweight code styling */
  variant?: 'assistant' | 'user' | 'composer'
  isStreaming?: boolean
}

export function MarkdownContent({
  text,
  variant = 'assistant',
  isStreaming,
}: MarkdownContentProps) {
  const lite = variant === 'composer'
  const proseClass =
    variant === 'assistant'
      ? 'prose prose-sm max-w-none'
      : 'prose prose-sm max-w-none [&_p]:my-0.5 [&_p:first-child]:mt-0 [&_p:last-child]:mb-0'

  return (
    <div className={proseClass} style={{ color: 'var(--text-primary)' }}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkBreaks]}
        disallowedElements={['script']}
        components={{
          code({ className, children, ...props }) {
            const match = /language-(\w+)/.exec(className || '')
            const isBlock = match !== null
            if (lite || !isBlock) {
              return (
                <code
                  className={className}
                  style={{
                    background: 'var(--bg-tertiary)',
                    padding: '0.15em 0.35em',
                    borderRadius: '0.25rem',
                    fontSize: '0.85em',
                  }}
                  {...props}
                >
                  {children}
                </code>
              )
            }
            return (
              <SyntaxHighlighter
                style={oneDark as never}
                language={match[1]}
                PreTag="div"
                customStyle={{ borderRadius: '0.5rem', fontSize: '0.8rem' }}
              >
                {String(children).replace(/\n$/, '')}
              </SyntaxHighlighter>
            )
          },
          p({ children }) {
            return <p style={{ margin: '0.4em 0' }}>{children}</p>
          },
          a({ href, children }) {
            return (
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: 'var(--accent)' }}
              >
                {children}
              </a>
            )
          },
          table({ children }) {
            return (
              <div style={{ overflowX: 'auto' }}>
                <table
                  style={{ borderCollapse: 'collapse', width: '100%', fontSize: '0.85rem' }}
                >
                  {children}
                </table>
              </div>
            )
          },
          th({ children }) {
            return (
              <th
                style={{
                  borderBottom: '1px solid var(--border)',
                  padding: '0.4rem 0.75rem',
                  textAlign: 'left',
                  color: 'var(--text-secondary)',
                  fontWeight: 600,
                }}
              >
                {children}
              </th>
            )
          },
          td({ children }) {
            return (
              <td style={{ borderBottom: '1px solid var(--border)', padding: '0.4rem 0.75rem' }}>
                {children}
              </td>
            )
          },
        }}
      >
        {text}
      </ReactMarkdown>
      {isStreaming && text ? <span className="streaming-cursor" /> : null}
    </div>
  )
}
