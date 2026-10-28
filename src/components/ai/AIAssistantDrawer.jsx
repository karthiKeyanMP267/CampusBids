import { useState, useRef, useEffect } from 'react';
import {
  Bot,
  X,
  Send,
  Loader2,
  ShieldCheck,
  Cpu,
  AlertCircle,
} from 'lucide-react';
import { formatINR, cn } from '../../lib/utils';
import { calculateDealScore } from '../../lib/dealScore';
import MarkdownRenderer from '../common/MarkdownRenderer';
import {
  askGroqAssistant,
  hasGroqApiKey,
} from '../../lib/groqClient';

export default function AIAssistantDrawer({ isOpen, onClose, auction, bids = [] }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const messagesEndRef = useRef(null);

  const dealAnalysis = calculateDealScore(auction);
  const isGroqActive = hasGroqApiKey();

  // Initialize with helpful welcome message when opened
  useEffect(() => {
    if (isOpen && messages.length === 0 && auction) {
      setMessages([
        {
          id: 'welcome',
          sender: 'assistant',
          text: `Hello! I'm your **CampusBid AI Assistant**. I can inspect "${auction.title}", uncover item risks, summarize the bidding dynamics, or generate a customized pre-inspection checklist for campus handover.`,
          isFallback: !isGroqActive,
          suggestions: [
            'What should I inspect before buying this item?',
            'What risks should I consider before bidding?',
            'Summarize this auction\'s bidding history',
            'Is the current price reasonable based on condition?',
          ],
        },
      ]);
    }
  }, [isOpen, auction, isGroqActive]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  // Deterministic local analyzer (used as immediate fallback if AI service is offline)
  function analyzeAuctionLocally(query) {
    const q = query.toLowerCase();

    // 1. Pre-inspection checklist query
    if (q.includes('check') || q.includes('inspect') || q.includes('buying')) {
      const checks = [
        'Physical Condition: Verify cosmetic state matches photos (look for hidden dents, screen scratches, or cable fraying).',
        'Functional Test: Power on the device in person at the campus meeting spot; verify all ports, buttons, and speakers work.',
        'Battery Health: If applicable (laptop, phone), check battery cycle count and capacity settings.',
        'Proof of Ownership: Ask seller for the original invoice or student purchase verification if applicable.',
        'Handover Safety: Always meet in a public, well-lit campus area (e.g. library lobby or student cafeteria).',
      ];
      return {
        text: `### Pre-Inspection Checklist for ${auction.title}\n` +
          `*Category: ${auction.category} • Stated Condition: ${auction.condition?.replace('_', ' ')}*\n\n` +
          checks.map((c) => `- [ ] **${c.split(':')[0]}**: ${c.split(':')[1]}`).join('\n') +
          `\n\n> **Safety Reminder:** Both parties must confirm handover at the pickup spot before the auction closes!`,
        isFallback: true,
      };
    }

    // 2. Risk analysis query
    if (q.includes('risk') || q.includes('danger') || q.includes('scam') || q.includes('safe')) {
      const risks = [];
      if (!auction.images || auction.images.length <= 1) {
        risks.push('Low Photo Count: Only 1 photo provided. Request more angles via Q&A before making a final commitment.');
      }
      if ((auction.description || '').length < 60) {
        risks.push('Brief Description: Minimal information provided by the seller about wear or service history.');
      }
      if (auction.condition === 'fair' || auction.condition === 'worn') {
        risks.push(`Item Condition (${auction.condition}): Expect noticeable cosmetic wear and potential reduced battery life.`);
      }
      if (risks.length === 0) {
        risks.push('Standard Campus Auction: Listing has thorough photos, detailed description, and verified student seller identity.');
      }

      return {
        text: `### Risk Assessment for ${auction.title}\n\n` +
          risks.map((r) => `⚠️ **${r.split(':')[0]}**: ${r.split(':')[1]}`).join('\n\n') +
          `\n\n🛡️ **Buyer Protection**: You only confirm handover after physically inspecting the item in person. Mutual confirmation protects your payment.`,
        isFallback: true,
      };
    }

    // 3. Bid history & dynamics summary
    if (q.includes('bid') || q.includes('history') || q.includes('summar') || q.includes('lead')) {
      const bidCount = bids.length;
      const currentHighest = bids[0]?.amount || auction.current_bid || auction.starting_price;
      const starting = auction.starting_price;
      const growth = currentHighest - starting;

      if (bidCount === 0) {
        return {
          text: `### Bidding Dynamics for ${auction.title}\n\n` +
            `• **Current Status**: No bids placed yet.\n` +
            `• **Starting Price**: ${formatINR(starting)}\n` +
            `• **Opportunity**: If you place a bid now, you can secure it at the opening price of **${formatINR(starting)}** unless competing students outbid you before closing!`,
          isFallback: true,
        };
      }

      const uniqueBidders = new Set(bids.map((b) => b.bidder_id)).size;
      return {
        text: `### Bidding Dynamics for ${auction.title}\n\n` +
          `• **Total Bids Placed**: ${bidCount}\n` +
          `• **Competing Students**: ${uniqueBidders}\n` +
          `• **Starting Price**: ${formatINR(starting)}\n` +
          `• **Current Highest Bid**: ${formatINR(currentHighest)} (+${formatINR(growth)} from start)\n` +
          `• **Minimum Next Bid**: ${formatINR(currentHighest + (auction.min_increment || 10))}\n\n` +
          `> **Anti-Sniping Active:** Any bid placed in the final 30 seconds automatically extends the auction timer by 60 seconds.`,
        isFallback: true,
      };
    }

    // 4. Price & Deal evaluation
    if (q.includes('price') || q.includes('worth') || q.includes('deal') || q.includes('value')) {
      return {
        text: `### Deal Score Evaluation for ${auction.title}\n\n` +
          `• **Overall Deal Score**: **${dealAnalysis.score} / 100** (${dealAnalysis.tier})\n` +
          `• **Starting Price**: ${formatINR(auction.starting_price)}\n` +
          `• **Current Price**: ${formatINR(auction.current_bid || auction.starting_price)}\n\n` +
          `**Key Factor Breakdown:**\n` +
          dealAnalysis.factors.map((f) => `- **${f.label}**: ${f.description}`).join('\n') +
          `\n\n*Note: Deal Score is deterministic algorithmic guidance based on listing completeness and campus price benchmarks.*`,
        isFallback: true,
      };
    }

    // General answer
    return {
      text: `### Listing Summary for ${auction.title}\n\n` +
        `• **Category**: ${auction.category}\n` +
        `• **Condition**: ${auction.condition?.replace('_', ' ')}\n` +
        `• **Current Price**: ${formatINR(auction.current_bid || auction.starting_price)}\n` +
        `• **Seller**: ${auction.seller?.display_name || 'Campus Member'} (${auction.seller?.college || 'Campus'})\n\n` +
        `Ask me anything specific like: *"What should I check before buying?"* or *"Summarize bidding history"*!`,
      isFallback: true,
    };
  }

  async function handleSend(queryText) {
    const text = (queryText || input).trim();
    if (!text || loading) return;

    const userMessage = { id: `u-${Date.now()}`, sender: 'user', text };
    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setLoading(true);
    setErrorMsg('');

    try {
      if (isGroqActive) {
        // Direct call to Groq AI inference
        const groqResponse = await askGroqAssistant({
          query: text,
          conversationHistory: messages,
          auction,
          bids,
          dealScore: dealAnalysis,
        });

        setMessages((prev) => [
          ...prev,
          {
            id: `a-${Date.now()}`,
            sender: 'assistant',
            text: groqResponse.text,
            isRealAI: true,
          },
        ]);
      } else {
        // Heuristic fallback if AI service key is absent
        await new Promise((res) => setTimeout(res, 300));
        const response = analyzeAuctionLocally(text);

        setMessages((prev) => [
          ...prev,
          {
            id: `a-${Date.now()}`,
            sender: 'assistant',
            text: response.text,
            isFallback: true,
          },
        ]);
      }
    } catch (err) {
      console.error('AI Assistant Error:', err);
      // Fallback gracefully to local analysis so user never sees a broken screen
      const fallback = analyzeAuctionLocally(text);
      setMessages((prev) => [
        ...prev,
        {
          id: `a-${Date.now()}`,
          sender: 'assistant',
          text: fallback.text,
          isFallback: true,
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-2xs animate-fade-in">
      <div className="relative flex h-full w-full max-w-md flex-col bg-white shadow-2xl border-l border-surface-200">
        {/* Clean Header */}
        <div className="flex items-center justify-between border-b border-surface-150 p-4 bg-surface-50">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-purple-600 text-white shadow-xs">
              <Bot className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h3 className="text-sm font-bold text-surface-900">CampusBid AI Advisor</h3>
                {isGroqActive && (
                  <span className="flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-[10px] font-semibold px-2 py-0.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    Live AI
                  </span>
                )}
              </div>
              <p className="text-[11px] text-surface-500 truncate max-w-[240px]">
                {auction?.title}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-surface-400 hover:bg-surface-100 hover:text-surface-700 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Guardrail & Grounding Banner */}
        <div className="bg-purple-50/50 px-4 py-2 border-b border-purple-100 flex items-center gap-2 text-[11px] text-purple-900">
          <ShieldCheck className="h-3.5 w-3.5 text-purple-600 shrink-0" />
          <span>Grounded in listing facts, condition factors, and student safety rules.</span>
        </div>

        {/* Chat message history with Markdown rendering */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((m) => (
            <div
              key={m.id}
              className={cn(
                'flex flex-col',
                m.sender === 'user' ? 'items-end' : 'items-start'
              )}
            >
              <div
                className={cn(
                  'rounded-2xl p-3.5 text-xs max-w-[90%] leading-relaxed',
                  m.sender === 'user'
                    ? 'bg-purple-600 text-white rounded-br-xs shadow-xs'
                    : 'bg-surface-50 border border-surface-200 text-surface-800 rounded-bl-xs shadow-2xs'
                )}
              >
                {m.sender === 'user' ? (
                  <div className="whitespace-pre-line">{m.text}</div>
                ) : (
                  <MarkdownRenderer content={m.text} />
                )}

                {/* Footnote */}
                {m.sender === 'assistant' && (
                  <div className="mt-2.5 flex items-center justify-between pt-1.5 border-t border-surface-200/60 text-[10px] text-surface-400">
                    <span className="flex items-center gap-1">
                      <Cpu className="h-3 w-3 text-purple-500" />
                      CampusBid AI
                    </span>
                    {m.isRealAI && (
                      <span className="text-[9px] text-emerald-600 font-semibold bg-emerald-50 px-1.5 py-0.2 rounded">
                        Live AI
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Suggestions chips */}
              {m.suggestions && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {m.suggestions.map((s, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleSend(s)}
                      className="rounded-xl border border-surface-200 bg-white px-3 py-1.5 text-[11px] font-medium text-surface-700 hover:bg-surface-50 hover:border-purple-300 transition-all shadow-2xs text-left"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}

          {loading && (
            <div className="flex items-center gap-2 text-xs text-surface-500 py-2 bg-surface-50 rounded-xl px-3 border border-surface-150 w-fit">
              <Loader2 className="h-4 w-4 animate-spin text-purple-600" />
              <span>Analyzing listing signals…</span>
            </div>
          )}

          {errorMsg && (
            <div className="flex items-start gap-2 rounded-xl bg-rose-50 border border-rose-200 p-2.5 text-[11px] text-rose-800">
              <AlertCircle className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input Bar */}
        <div className="border-t border-surface-150 p-3 bg-white">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            className="flex items-center gap-2"
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about inspection checks, risks, or price..."
              className="flex-1 rounded-xl border border-surface-200 bg-surface-50 py-2.5 px-3.5 text-xs outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-100 text-surface-900"
            />
            <button
              type="submit"
              disabled={!input.trim() || loading}
              className="rounded-xl bg-purple-600 p-2.5 text-white hover:bg-purple-700 disabled:opacity-50 transition-colors shadow-xs shrink-0"
            >
              <Send className="h-4 w-4" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
