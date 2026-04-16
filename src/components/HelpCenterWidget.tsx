import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bot, Send, X, BookOpen, Wrench } from 'lucide-react';

type HelpArticle = {
  id: string;
  title: string;
  summary: string;
  answer: string;
  keywords: string[];
  route?: string;
};

type HelpMessage = {
  id: string;
  role: 'assistant' | 'user';
  text: string;
  articleIds?: string[];
};

const ARTICLES: HelpArticle[] = [
  {
    id: 'dashboard',
    title: 'Dashboard and connectivity',
    summary: 'Explains live status, cloud fallback, and what the top warning means.',
    answer: 'The dashboard prefers the onboard mini PC for live data. If the agent cannot be reached, NauticShield falls back to the cloud snapshot and shows a warning so you know the view is not fully live.',
    keywords: ['dashboard', 'agent', 'offline', 'cloud', 'mini pc', 'warning', 'status'],
    route: '/',
  },
  {
    id: 'devices',
    title: 'Devices and alerts',
    summary: 'How to read device inventory and alert severity.',
    answer: 'Devices shows the current network inventory. Alerts highlights unresolved issues first, with critical findings intended for immediate review and remediation.',
    keywords: ['device', 'devices', 'alert', 'alerts', 'inventory', 'critical'],
    route: '/devices',
  },
  {
    id: 'voyage',
    title: 'Voyage log ranges',
    summary: 'Use a from and to date to pull voyage performance across the selected window.',
    answer: 'Add Voyage now works from a start date and end date. NauticShield uses that date range to pull performance data in one pass, which is more useful for a completed voyage than logging each movement state manually.',
    keywords: ['voyage', 'log', 'from date', 'to date', 'range', 'entry', 'performance'],
    route: '/voyage',
  },
  {
    id: 'cyber',
    title: 'Cyber scans and pen tests',
    summary: 'Security scans, pen-test cadence, and report tracking.',
    answer: 'The Cyber page separates instant Security Scans from professional pen-test records. The countdown uses the next due date, and the history is intended to focus on the most recent three years plus any upcoming engagement.',
    keywords: ['cyber', 'scan', 'pen test', 'security scan', 'countdown', 'report'],
    route: '/cyber',
  },
  {
    id: 'settings',
    title: 'Settings and MFA',
    summary: 'Account security, notifications, and subscription controls.',
    answer: 'Settings covers MFA, passkeys, notifications, and subscription management. Authenticator app setup can now be completed directly in the app rather than relying only on the Clerk profile page.',
    keywords: ['settings', 'mfa', 'passkey', 'subscription', 'notifications', 'security'],
    route: '/settings',
  },
  {
    id: 'support',
    title: 'Troubleshooting',
    summary: 'What to check when data looks stale or actions do not complete.',
    answer: 'If data looks stale, first check the connection banner. Cloud mode means the onboard mini PC is unreachable but cloud data is still available. Offline means neither the agent nor the cloud fallback is responding.',
    keywords: ['support', 'help', 'stale', 'troubleshoot', 'offline', 'cloud mode'],
  },
];

const STARTER_PROMPTS = [
  'Why is the agent showing offline?',
  'How do I add a voyage range?',
  'How does MFA setup work?',
  'Where do pen-test results go?',
];

function pickArticles(input: string) {
  const q = input.toLowerCase();
  const ranked = ARTICLES
    .map(article => ({
      article,
      score: article.keywords.reduce((sum, keyword) => sum + (q.includes(keyword) ? 1 : 0), 0),
    }))
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score);

  if (ranked.length > 0) {
    return ranked.slice(0, 2).map(item => item.article);
  }

  return [ARTICLES.find(article => article.id === 'support') ?? ARTICLES[0]];
}

function buildAnswer(input: string) {
  const matches = pickArticles(input);
  const lead = matches[0];
  const related = matches.slice(1);
  const text = [
    lead.answer,
    related.length > 0 ? `Related: ${related.map(article => article.title).join(' and ')}.` : '',
  ].filter(Boolean).join(' ');

  return { text, articleIds: matches.map(article => article.id) };
}

export default function HelpCenterWidget({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const navigate = useNavigate();
  const [draft, setDraft] = useState('');
  const [messages, setMessages] = useState<HelpMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      text: 'Ask about dashboard status, voyage ranges, MFA, cyber scans, or pen-test history. I will point you to the right part of the app and explain what it does.',
      articleIds: ['dashboard', 'voyage', 'settings', 'cyber'],
    },
  ]);

  const articleMap = useMemo(() => new Map(ARTICLES.map(article => [article.id, article])), []);

  function openArticle(route?: string) {
    if (!route) return;
    navigate(route);
    onOpenChange(false);
  }

  function sendQuestion(question: string) {
    const trimmed = question.trim();
    if (!trimmed) return;

    const answer = buildAnswer(trimmed);
    setMessages(prev => [
      ...prev,
      { id: `user-${Date.now()}`, role: 'user', text: trimmed },
      { id: `assistant-${Date.now() + 1}`, role: 'assistant', text: answer.text, articleIds: answer.articleIds },
    ]);
    setDraft('');
    onOpenChange(true);
  }

  return (
    <>
      <button
        onClick={() => onOpenChange(!open)}
        style={{
          position: 'fixed', left: 22, bottom: 22, zIndex: 120,
          display: 'flex', alignItems: 'center', gap: 10,
          background: 'linear-gradient(135deg, rgba(14,165,233,0.92), rgba(56,189,248,0.78))',
          color: '#08111c', border: '1px solid rgba(125,211,252,0.45)', borderRadius: 999,
          padding: '12px 16px', fontSize: 13, fontWeight: 800, cursor: 'pointer',
          boxShadow: '0 12px 30px rgba(2,132,199,0.28)',
        }}
      >
        <Bot size={16} /> Help Bot
      </button>

      {open && (
        <div style={{
          position: 'fixed', left: 22, bottom: 78, zIndex: 121,
          width: 360, maxWidth: 'calc(100vw - 32px)', maxHeight: 'min(72vh, 680px)',
          background: '#0d1421', border: '1px solid #1a2535', borderRadius: 18,
          boxShadow: '0 24px 60px rgba(0,0,0,0.45)', overflow: 'hidden',
          display: 'flex', flexDirection: 'column',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 18px', borderBottom: '1px solid #1a2535', background: 'linear-gradient(180deg, rgba(14,165,233,0.08), rgba(13,20,33,1))' }}>
            <div>
              <div style={{ color: '#f0f4f8', fontSize: 15, fontWeight: 800 }}>Help Center</div>
              <div style={{ color: '#6b7f92', fontSize: 12, marginTop: 3 }}>Knowledge base and guided answers</div>
            </div>
            <button onClick={() => onOpenChange(false)} style={{ background: 'transparent', border: 'none', color: '#6b7f92', cursor: 'pointer', padding: 4 }}>
              <X size={16} />
            </button>
          </div>

          <div style={{ padding: '14px 16px', borderBottom: '1px solid #1a2535', display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {STARTER_PROMPTS.map(prompt => (
              <button
                key={prompt}
                onClick={() => sendQuestion(prompt)}
                style={{ background: 'rgba(14,165,233,0.08)', color: '#7dd3fc', border: '1px solid rgba(14,165,233,0.2)', borderRadius: 999, padding: '7px 10px', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}
              >
                {prompt}
              </button>
            ))}
          </div>

          <div style={{ padding: 16, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 12, flex: 1 }}>
            {messages.map(message => (
              <div key={message.id} style={{ alignSelf: message.role === 'user' ? 'flex-end' : 'stretch', maxWidth: message.role === 'user' ? '85%' : '100%' }}>
                <div style={{
                  background: message.role === 'user' ? 'rgba(14,165,233,0.14)' : '#080b10',
                  color: message.role === 'user' ? '#d9f3ff' : '#d6dee7',
                  border: `1px solid ${message.role === 'user' ? 'rgba(14,165,233,0.22)' : '#1a2535'}`,
                  borderRadius: 14,
                  padding: '11px 12px',
                  fontSize: 12,
                  lineHeight: 1.6,
                }}>
                  {message.text}
                </div>
                {message.role === 'assistant' && message.articleIds?.length ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
                    {message.articleIds.map(articleId => {
                      const article = articleMap.get(articleId);
                      if (!article) return null;
                      return (
                        <button
                          key={article.id}
                          onClick={() => openArticle(article.route)}
                          style={{
                            background: '#0a0f18', color: '#f0f4f8', border: '1px solid #1a2535', borderRadius: 12,
                            padding: '10px 12px', textAlign: 'left', cursor: article.route ? 'pointer' : 'default',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                            {article.route ? <BookOpen size={13} color="#7dd3fc" /> : <Wrench size={13} color="#d4a847" />}
                            <span style={{ fontSize: 12, fontWeight: 700 }}>{article.title}</span>
                          </div>
                          <div style={{ color: '#6b7f92', fontSize: 11, lineHeight: 1.5 }}>{article.summary}</div>
                        </button>
                      );
                    })}
                  </div>
                ) : null}
              </div>
            ))}
          </div>

          <div style={{ padding: 16, borderTop: '1px solid #1a2535', display: 'flex', gap: 10 }}>
            <input
              value={draft}
              onChange={event => setDraft(event.target.value)}
              onKeyDown={event => event.key === 'Enter' && sendQuestion(draft)}
              placeholder="Ask about any page or workflow"
              style={{ flex: 1, background: '#080b10', color: '#f0f4f8', border: '1px solid #1a2535', borderRadius: 10, padding: '10px 12px', fontSize: 12, outline: 'none' }}
            />
            <button
              onClick={() => sendQuestion(draft)}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'rgba(14,165,233,0.12)', color: '#7dd3fc', border: '1px solid rgba(14,165,233,0.24)', borderRadius: 10, padding: '0 14px', cursor: 'pointer', fontSize: 12, fontWeight: 700 }}
            >
              <Send size={13} /> Send
            </button>
          </div>
        </div>
      )}
    </>
  );
}