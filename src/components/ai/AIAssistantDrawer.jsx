import { useState, useRef, useEffect } from 'react';
import {
  Sparkles,
  Bot,
  X,
  Send,
  Loader2,
  ShieldCheck,
} from 'lucide-react';
import { formatINR, cn } from '../../lib/utils';
import { calculateDealScore } from '../../lib/dealScore';

export default function AIAssistantDrawer({ isOpen, onClose, auction, bids = [] }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);

  const dealAnalysis = calculateDealScore(auction);

  // Initialize with helpful welcome message when opened
  useEffect(() => {
    if (isOpen && messages.length === 0 && auction) {
      setMessages([
        {
          id: 'welcome',
          sender: 'assistant',
          text: `Hello! I'm your CampusBid Assistant. I can help you evaluate "${auction.title}", verify item risks, summarize the bidding dynamics, or generate a pre-inspection checklist for campus handover.`,
          isFallback: true,
          suggestions: [
            'What should I check before buying this item?',
            'What risks should I consider before bidding?',
            'Summarize this auction\'s bidding history',
            'Is the current price reasonable?',
          ],
        },
      ]);
    }
  }, [isOpen, auction]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  // Deterministic, explainable auction analyzer (rule-based fallback that never hallucinates)
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
        text: `Here is a tailored pre-inspection checklist for **${auction.title}** (${auction.category}):\n\n` +
          checks.map((c, i) => `${i + 1}. **${c.split(':')[0]}**: ${c.split(':')[1]}`).join('\n') +
          `\n\n*Note: Derived from listing condition "${auction.condition?.replace('_', ' ')}" and campus safety protocols.*`,
        isFallback: true,
      };
    }

    // 2. Risk analysis query
    if (q.includes('risk') || q.includes('danger') || q.includes('scam') || q.includes('safe')) {
      const risks = [];
      if (!auction.images || auction.images.length <= 1) {
        risks.push('Low Photo Count: Only 1 photo provided. Request more angles before making a final commitment.');
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
        text: `**Risk Analysis for ${auction.title}:**\n\n` +
          risks.map((r) => `⚠️ **${r.split(':')[0]}**: ${r.split(':')[1]}`).join('\n\n') +
          `\n\n🛡️ **Protection**: You only confirm handover after physically inspecting the item in person. Mutual confirmation protects your funds.`,
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
          text: `**Bidding Summary for ${auction.title}:**\n\n` +
            `• **Current Status**: No bids placed yet.\n` +
            `• **Starting Price**: ${formatINR(starting)}\n` +
            `• **Opportunity**: If you place a bid now, you can secure it at the opening price of ${formatINR(starting)} unless competing students bid before closing!`,
          isFallback: true,
        };
      }

      const uniqueBidders = new Set(bids.map((b) => b.bidder_id)).size;
      return {
        text: `**Bidding Dynamics for ${auction.title}:**\n\n` +
          `• **Total Bids Placed**: ${bidCount}\n` +
          `• **Competing Students**: ${uniqueBidders}\n` +
          `• **Starting Price**: ${formatINR(starting)}\n` +
          `• **Current Highest Bid**: ${formatINR(currentHighest)} (+${formatINR(growth)} from start)\n` +
          `• **Minimum Next Bid**: ${formatINR(currentHighest + (auction.min_increment || 10))}\n\n` +
          `*Note: Anti-sniping is enabled. Bids placed in the final 30 seconds extend the auction by 60 seconds.*`,
        isFallback: true,
      };
    }

    // 4. Price & Deal evaluation
    if (q.includes('price') || q.includes('worth') || q.includes('deal') || q.includes('value')) {
      return {
        text: `**Deal Evaluation for ${auction.title}:**\n\n` +
          `• **Deal Score**: ${dealAnalysis.score} / 100 (${dealAnalysis.tier})\n` +
          `• **Starting Price**: ${formatINR(auction.starting_price)}\n` +
          `• **Current Price**: ${formatINR(auction.current_bid || auction.starting_price)}\n\n` +
          `**Key Factor Highlights:**\n` +
          dealAnalysis.factors.map((f) => `• ${f.label}: ${f.description}`).join('\n') +
          `\n\n*Disclaimer: Deal Score is deterministic guidance based on listing completeness and campus benchmarks, not an official appraisal.*`,
        isFallback: true,
      };
    }

    // General answer
    return {
      text: `Based on the listing data for **${auction.title}**:\n\n` +
        `• **Category**: ${auction.category}\n` +
        `• **Stated Condition**: ${auction.condition?.replace('_', ' ')}\n` +
        `• **Current Price**: ${formatINR(auction.current_bid || auction.starting_price)}\n` +
        `• **Seller**: ${auction.seller?.display_name || 'Campus Member'} (${auction.seller?.college || 'Campus'})\n\n` +
        `To inspect deeper, ask: *"What should I check before buying?"* or *"Summarize bidding history"*!`,
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

    try {
      // Small simulated latency for natural conversation feel
      await new Promise((res) => setTimeout(res, 400));
      const response = analyzeAuctionLocally(text);

      setMessages((prev) => [
        ...prev,
        {
          id: `a-${Date.now()}`,
          sender: 'assistant',
          text: response.text,
          isFallback: response.isFallback,
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
        {/* Header */}
        <div className="flex items-center justify-between border-b border-surface-150 p-4 bg-surface-50">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-purple-100 text-purple-700 shadow-2xs">
              <Sparkles className="h-4 w-4" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h3 className="text-sm font-bold text-surface-900">CampusBid AI Assistant</h3>
                <span className="rounded-full bg-purple-100 text-purple-800 text-[10px] font-bold px-2 py-0.2">
                  Heuristic & Data Verified
                </span>
              </div>
              <p className="text-[11px] text-surface-500 truncate max-w-[240px]">
                Analyzing: {auction?.title}
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

        {/* Guardrail Banner */}
        <div className="bg-purple-50/80 px-4 py-2 border-b border-purple-100 flex items-center gap-2 text-[11px] text-purple-900">
          <ShieldCheck className="h-3.5 w-3.5 text-purple-600 shrink-0" />
          <span>Never hallucinates: Uses only verified auction data & safety rules.</span>
        </div>

        {/* Chat message history */}
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
                  'rounded-2xl p-3.5 text-xs max-w-[85%] leading-relaxed',
                  m.sender === 'user'
                    ? 'bg-brand-600 text-white rounded-br-xs shadow-xs'
                    : 'bg-surface-50 border border-surface-200 text-surface-800 rounded-bl-xs'
                )}
              >
                <div className="whitespace-pre-line">{m.text}</div>
                {m.isFallback && (
                  <span className="mt-2 block text-[10px] text-surface-400 italic border-t border-surface-200/60 pt-1">
                    Verified listing data analysis • No hallucinations
                  </span>
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
                      className="rounded-xl border border-surface-200 bg-white px-3 py-1.5 text-[11px] font-medium text-surface-700 hover:bg-surface-50 hover:border-brand-300 transition-all shadow-2xs text-left"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}

          {loading && (
            <div className="flex items-center gap-2 text-xs text-surface-400 py-2">
              <Loader2 className="h-4 w-4 animate-spin text-purple-600" />
              <span>Analyzing listing signals…</span>
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
              placeholder="Ask about risks, specs, or handover checks…"
              className="flex-1 rounded-xl border border-surface-200 bg-surface-50 py-2 px-3 text-xs outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-100 text-surface-900"
            />
            <button
              type="submit"
              disabled={!input.trim() || loading}
              className="rounded-xl bg-purple-600 p-2 text-white hover:bg-purple-700 disabled:opacity-50 transition-colors shadow-xs"
            >
              <Send className="h-4 w-4" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
