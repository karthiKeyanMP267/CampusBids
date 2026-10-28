/**
 * Groq AI Client Integration for CampusBid
 * Executes high-speed inference using environment-configured Groq API credentials.
 */

const DEFAULT_MODEL = 'openai/gpt-oss-120b';
const FALLBACK_MODEL = 'openai/gpt-oss-20b';

export function getGroqApiKey() {
  return import.meta.env.VITE_GROQ_API_KEY || '';
}

export function hasGroqApiKey() {
  return Boolean(getGroqApiKey());
}

/**
 * Builds the comprehensive grounding prompt with real listing context
 */
function buildSystemPrompt(auction, bids = [], dealScore = null) {
  const currentPrice = bids[0]?.amount || auction.current_bid || auction.starting_price;
  const recentBidsSummary = bids.slice(0, 5).map(
    (b, i) => `#${i + 1}: ₹${b.amount} by ${b.bidder?.display_name || 'Student'} at ${new Date(b.created_at).toLocaleTimeString()}`
  ).join('\n') || 'No bids placed yet.';

  const dealScoreText = dealScore
    ? `Deal Score: ${dealScore.score}/100 (${dealScore.tier}). Factors: ${dealScore.factors.map((f) => `${f.label}: ${f.description}`).join('; ')}`
    : 'Not calculated.';

  return `You are the CampusBid AI Marketplace Assistant, an intelligent, trusted advisor for college students participating in campus auctions.

AUCTION CONTEXT:
- Title: "${auction.title}"
- Category: ${auction.category}
- Condition: ${auction.condition?.replace('_', ' ')}
- Starting Price: ₹${auction.starting_price}
- Current Bid: ₹${currentPrice}
- Min Increment: ₹${auction.min_increment || 10}
- Closing Time: ${auction.closing_at ? new Date(auction.closing_at).toLocaleString() : 'N/A'}
- Status: ${auction.status}
- Anti-sniping: Active (bids in final 30 seconds extend closing by 60s)
- Seller: ${auction.seller?.display_name || 'Student Seller'} (College: ${auction.seller?.college || 'Campus'})
- Photos count: ${auction.images?.length || 0}
- Item Description: "${auction.description || 'No description provided.'}"
- Recent Bids:
${recentBidsSummary}
- Deal Analysis:
${dealScoreText}

SAFETY & MARKETPLACE RULES:
1. Always encourage safe, in-person campus inspection before confirming the 2-party handover.
2. Provide specific, tailored pre-inspection checklists based on the item category (e.g. laptop ports, battery cycles, bicycle brakes, textbook edition).
3. Evaluate whether the current bid represents good student value.
4. Help explain anti-sniping, automatic proxy bidding, and seller approval workflows.
5. NEVER fabricate or assume item specs not in the description. If an important detail is missing, advise the student to ask via the Auction Q&A thread.
6. FORMAT YOUR RESPONSES WITH RICH MARKDOWN: Use bolding, bullet lists, numbered steps, or markdown checklists (- [ ]) for clarity. Keep responses concise, practical, and student-focused.`;
}

/**
 * Executes chat completion request to Groq API with automatic fallback
 */
export async function askGroqAssistant({
  query,
  conversationHistory = [],
  auction,
  bids = [],
  dealScore = null,
}) {
  const key = getGroqApiKey();
  if (!key) {
    throw new Error('AI inference service is currently unconfigured.');
  }

  const systemPrompt = buildSystemPrompt(auction, bids, dealScore);

  const formattedMessages = [
    { role: 'system', content: systemPrompt },
    ...conversationHistory.slice(-6).map((m) => ({
      role: m.sender === 'user' ? 'user' : 'assistant',
      content: m.text,
    })),
    { role: 'user', content: query },
  ];

  async function executeRequest(modelToUse) {
    return await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: modelToUse,
        messages: formattedMessages,
        temperature: 0.5,
        max_tokens: 1024,
        top_p: 1,
      }),
    });
  }

  let response = await executeRequest(DEFAULT_MODEL);

  // If primary model returns 404, fallback to secondary model
  if (!response.ok && response.status === 404) {
    response = await executeRequest(FALLBACK_MODEL);
  }

  if (!response.ok) {
    let errorDetail = 'Failed to connect to AI Assistant';
    try {
      const errorJson = await response.json();
      errorDetail = errorJson?.error?.message || errorDetail;
    } catch {
      errorDetail = `${response.status} ${response.statusText}`;
    }
    throw new Error(errorDetail);
  }

  const data = await response.json();
  const reply = data.choices?.[0]?.message?.content;
  if (!reply) {
    throw new Error('Received an empty response from AI Assistant.');
  }

  return {
    text: reply,
    isRealAI: true,
  };
}
