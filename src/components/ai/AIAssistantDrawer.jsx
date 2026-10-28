import { useState, useRef, useEffect } from 'react';
import {
  Bot,
  X,
  Send,
  Loader2,
  ShieldCheck,
  Cpu,
  AlertCircle,
  RotateCcw,
} from 'lucide-react';
import { formatINR, cn } from '../../lib/utils';
import { calculateDealScore } from '../../lib/dealScore';
import MarkdownRenderer from '../common/MarkdownRenderer';
import { askGroqAssistant, hasGroqApiKey } from '../../lib/groqClient';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabaseClient';
import { SAMPLE_AUCTIONS } from '../../lib/constants';

export default function AIAssistantDrawer({ isOpen, onClose, auction, bids = [] }) {
  const { user } = useAuth();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [activeListings, setActiveListings] = useState([]);
  const messagesEndRef = useRef(null);

  const dealAnalysis = calculateDealScore(auction);
  const isGroqActive = hasGroqApiKey();

  // Load all active marketplace products for grounded AI catalog matching
  useEffect(() => {
    let isMounted = true;

    async function loadMarketplaceListings() {
      if (supabase) {
        try {
          const { data, error } = await supabase
            .from('auctions')
            .select('id, title, category, condition, starting_price, current_bid, min_increment, status, description, closing_at, images')
            .eq('status', 'active')
            .order('created_at', { ascending: false })
            .limit(30);

          if (!error && data && data.length > 0 && isMounted) {
            setActiveListings(data);
            return;
          }
        } catch (err) {
          console.warn('Could not fetch active listings for AI context:', err);
        }
      }
      if (isMounted) {
        setActiveListings(SAMPLE_AUCTIONS);
      }
    }

    loadMarketplaceListings();

    return () => {
      isMounted = false;
    };
  }, []);

  // Load chat history from Supabase database (not localStorage)
  useEffect(() => {
    let isMounted = true;

    async function loadChatHistory() {
      if (!isOpen || !auction?.id) return;

      if (user && supabase) {
        try {
          const { data, error } = await supabase
            .from('ai_chat_messages')
            .select('*')
            .eq('auction_id', auction.id)
            .eq('user_id', user.id)
            .order('created_at', { ascending: true });

          if (!error && data && data.length > 0 && isMounted) {
            setMessages(
              data.map((m) => ({
                id: m.id,
                sender: m.sender,
                text: m.text,
                isFallback: m.is_fallback,
                isRealAI: !m.is_fallback,
              }))
            );
            return;
          }
        } catch {
          // Table not yet migrated; fall back to welcome state
        }
      }

      if (isMounted) {
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
    }

    loadChatHistory();

    return () => {
      isMounted = false;
    };
  }, [isOpen, auction?.id, user?.id, isGroqActive]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  // Clear chat history from database and reset conversation
  async function handleClearChat() {
    if (user && supabase && auction?.id) {
      try {
        await supabase
          .from('ai_chat_messages')
          .delete()
          .eq('auction_id', auction.id)
          .eq('user_id', user.id);
      } catch {
        // Non-blocking
      }
    }

    setMessages([
      {
        id: `welcome-${Date.now()}`,
        sender: 'assistant',
        text: `Chat history cleared. How else can I help you evaluate "${auction.title}"?`,
        isFallback: !isGroqActive,
        suggestions: [
          'What should I inspect before buying this item?',
          'What risks should I consider before bidding?',
          'Summarize this auction\'s bidding history',
        ],
      },
    ]);
  }

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

    // 5. Product search & recommendations query (strictly grounded to listed marketplace items)
    const productKeywords = [
      'product', 'item', 'laptop', 'lap', 'phone', 'book', 'textbook', 'cycle', 'bicycle',
      'electronics', 'furniture', 'recommend', 'show me', 'what else', 'other',
      'find', 'search', 'listed', 'auction', 'buy', 'looking for', 'cheap', 'cheaper', 'budget',
      'similar', 'alternative', 'lower price', 'low price', 'less than', 'hp', 'dell', 'mac', 'bat',
    ];
    const isSearchingProducts = productKeywords.some((kw) => q.includes(kw));

    if (isSearchingProducts) {
      const currentPrice = auction?.current_bid || auction?.starting_price || 0;

      // Expand common campus slang, abbreviations, and shorthand
      let normalizedQuery = q
        .replace(/\blap\b/g, 'laptop')
        .replace(/\bpc\b/g, 'laptop computer')
        .replace(/\bmac\b/g, 'macbook apple')
        .replace(/\bphone\b/g, 'smartphone mobile')
        .replace(/\bmob\b/g, 'mobile')
        .replace(/\bcycle\b/g, 'bicycle')
        .replace(/\bbat\b/g, 'cricket bat');

      const isAskingSimilar = /(similar|alternative|like this|other|compare|instead)/i.test(q);
      const isAskingCheaper = /(cheap|cheaper|lower|less|budget|affordable|low price|lowest)/i.test(q);
      const isComparative = isAskingSimilar || /(than this|compared to this|this item|instead)/i.test(q);

      // Start with all other active listings in the marketplace
      let candidatePool = activeListings.filter((item) => item && item.id !== auction?.id);

      // Extract meaningful search tokens
      const searchTerms = normalizedQuery
        .replace(/[?.,!]/g, '')
        .split(/\s+/)
        .filter(
          (w) =>
            w.length > 1 &&
            ![
              'what', 'have', 'show', 'tell', 'about', 'this', 'that', 'with', 'from',
              'some', 'else', 'other', 'items', 'products', 'product', 'for', 'the',
              'than', 'me', 'can', 'you', 'give', 'get', 'any', 'listed', 'there',
            ].includes(w)
        );

      let matchedItems = [];

      // If user asks for something "similar" or "cheaper than this"
      if (isComparative) {
        const currentCategory = (auction?.category || '').toLowerCase();
        const currentTitleTokens = (auction?.title || '')
          .toLowerCase()
          .replace(/[^\w\s]/g, '')
          .split(/\s+/)
          .filter((w) => w.length > 2 && !['with', 'and', 'for', 'the', 'inch', 'plus'].includes(w));

        matchedItems = candidatePool.filter((item) => {
          const itemCat = (item.category || '').toLowerCase();
          const itemTitle = (item.title || '').toLowerCase();
          const isSameCategory = itemCat === currentCategory;
          const matchesTitleToken = currentTitleTokens.some((t) => itemTitle.includes(t));
          return isSameCategory || matchesTitleToken;
        });

        // If specific keyword filters were also specified (e.g. "hp", "mouse", "bat")
        const specificTerms = searchTerms.filter(
          (t) => !['similar', 'cheap', 'cheaper', 'lower', 'price', 'low', 'budget'].includes(t)
        );
        if (specificTerms.length > 0) {
          const refined = matchedItems.filter((item) => {
            const fullText = [(item.title || ''), (item.category || ''), (item.description || '')].join(' ').toLowerCase();
            return specificTerms.some((st) => fullText.includes(st));
          });
          if (refined.length > 0) {
            matchedItems = refined;
          }
        }
      }

      // If not comparative or no comparative items matched, perform full keyword search
      if (matchedItems.length === 0 && searchTerms.length > 0) {
        const cleanTerms = searchTerms.filter(
          (t) => !['cheap', 'cheaper', 'price', 'low', 'budget', 'lowest'].includes(t)
        );
        const termsToSearch = cleanTerms.length > 0 ? cleanTerms : searchTerms;

        matchedItems = candidatePool.filter((item) => {
          const fullText = [
            item.title || '',
            item.category || '',
            item.description || '',
          ].join(' ').toLowerCase();
          return termsToSearch.some((term) => fullText.includes(term));
        });
      }

      // If cheaper was explicitly requested, filter and rank by lowest price
      if (isAskingCheaper) {
        const cheaperItems = matchedItems.filter(
          (item) => (item.current_bid || item.starting_price || 0) < currentPrice
        );
        if (cheaperItems.length > 0) {
          matchedItems = cheaperItems;
        }
        matchedItems.sort(
          (a, b) =>
            (a.current_bid || a.starting_price || 0) - (b.current_bid || b.starting_price || 0)
        );
      }

      if (matchedItems.length > 0) {
        return {
          text:
            `### Matching Products on CampusBid\n\n` +
            `Here are active products listed for bidding on CampusBid that match your request:\n\n` +
            matchedItems
              .slice(0, 4)
              .map((p) => {
                const price = p.current_bid || p.starting_price;
                const cond = (p.condition || 'good').replace('_', ' ');
                const isCheaper = price < currentPrice;
                const priceDiff = currentPrice - price;
                const matchReason = isCheaper
                  ? `Cheaper alternative (${formatINR(priceDiff)} less than currently viewed item)`
                  : `Active ${p.category} listing in ${cond} condition`;

                return (
                  `• **[${p.title}](/auction/${p.id})**\n` +
                  `  - **Current Price**: ${formatINR(price)} (Starts at ${formatINR(p.starting_price)})\n` +
                  `  - **Category**: ${p.category} • **Condition**: ${cond}\n` +
                  `  - **Why it matches**: ${matchReason}\n` +
                  `  - [View Auction Listing](/auction/${p.id})\n`
                );
              })
              .join('\n') +
            `\n> **Note:** Only showing products currently listed on CampusBid. No external or random items are shown.`,
          isFallback: true,
        };
      }

      // No match found -> strictly inform user and show what IS available
      const otherAvailable = candidatePool
        .slice(0, 3)
        .map(
          (p) =>
            `• **[${p.title}](/auction/${p.id})** — ${formatINR(p.current_bid || p.starting_price)} (${p.category})`
        )
        .join('\n');

      return {
        text:
          `### No Matching Products Found on CampusBid\n\n` +
          `There are currently **no products matching "${query}"** listed on CampusBid.\n\n` +
          `*Note: As a strict rule, I do not pull products from Google or external stores — only verified campus listings.*\n\n` +
          (otherAvailable
            ? `**Other Active Products Currently Listed for Bidding:**\n${otherAvailable}\n\n`
            : '') +
          `You can save a search on the **[Browse Page](/browse)** to receive real-time notifications when a matching item is listed!`,
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
        `Ask me anything specific like: *"Show me other electronics on sale"*, *"What should I check before buying?"*, or *"Summarize bidding history"*!`,
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

    // Persist user message to Supabase database (not localStorage)
    if (user && supabase && auction?.id) {
      try {
        await supabase.from('ai_chat_messages').insert({
          user_id: user.id,
          auction_id: auction.id,
          sender: 'user',
          text,
        });
      } catch {
        // Non-blocking database write
      }
    }

    try {
      let responseText = '';
      let isFallback = false;

      if (isGroqActive) {
        // Direct call to Groq AI inference with active listings catalog
        const groqResponse = await askGroqAssistant({
          query: text,
          conversationHistory: messages,
          auction,
          bids,
          dealScore: dealAnalysis,
          listedProducts: activeListings,
        });
        responseText = groqResponse.text;
      } else {
        // Heuristic fallback if AI service key is absent
        await new Promise((res) => setTimeout(res, 300));
        const localResp = analyzeAuctionLocally(text);
        responseText = localResp.text;
        isFallback = true;
      }

      const assistantMsg = {
        id: `a-${Date.now()}`,
        sender: 'assistant',
        text: responseText,
        isRealAI: !isFallback,
        isFallback,
      };
      setMessages((prev) => [...prev, assistantMsg]);

      // Persist assistant response to Supabase database (not localStorage)
      if (user && supabase && auction?.id) {
        try {
          await supabase.from('ai_chat_messages').insert({
            user_id: user.id,
            auction_id: auction.id,
            sender: 'assistant',
            text: responseText,
            is_fallback: isFallback,
          });
        } catch {
          // Non-blocking database write
        }
      }
    } catch (err) {
      console.error('AI Assistant Error:', err);
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
              <p className="text-[11px] text-surface-500 truncate max-w-[220px]">
                {auction?.title}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1">
            {messages.length > 1 && (
              <button
                type="button"
                onClick={handleClearChat}
                title="Clear conversation history"
                className="rounded-lg p-1.5 text-surface-400 hover:bg-surface-100 hover:text-surface-700 transition-colors"
              >
                <RotateCcw className="h-4 w-4" />
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1.5 text-surface-400 hover:bg-surface-100 hover:text-surface-700 transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
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
