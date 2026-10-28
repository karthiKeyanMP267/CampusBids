/**
 * Groq AI Client Integration for CampusBid
 * Connects directly to Groq's high-speed inference engine using verified free models.
 */

const GROQ_STORAGE_KEY = 'campusbids_groq_api_key';
const GROQ_MODEL_KEY = 'campusbids_groq_model';

// Verified free models available on Groq Free Tier
export const GROQ_MODELS = [
  { id: 'openai/gpt-oss-120b', name: 'GPT-OSS 120B', badge: 'Recommended • 120B Free' },
  { id: 'openai/gpt-oss-20b', name: 'GPT-OSS 20B', badge: 'Ultra-Fast • 20B Free' },
  { id: 'qwen/qwen3.8-27b', name: 'Qwen 3.8 27B', badge: '27B Free Tier' },
  { id: 'llama-3.1-8b-instant', name: 'Llama 3.1 8B', badge: 'Free Tier' },
];

export const DEFAULT_FREE_MODEL = 'openai/gpt-oss-120b';

export function getStoredGroqApiKey() {
  if (typeof window === 'undefined') return '';
  return (
    import.meta.env.VITE_GROQ_API_KEY ||
    localStorage.getItem(GROQ_STORAGE_KEY) ||
    ''
  );
}

export function setStoredGroqApiKey(key) {
  if (typeof window === 'undefined') return;
  if (!key) {
    localStorage.removeItem(GROQ_STORAGE_KEY);
  } else {
    localStorage.setItem(GROQ_STORAGE_KEY, key.trim());
  }
}

export function getSelectedGroqModel() {
  if (typeof window === 'undefined') return DEFAULT_FREE_MODEL;
  const stored = localStorage.getItem(GROQ_MODEL_KEY);
  // Migrate away from deprecated/inaccessible models
  if (!stored || stored.includes('llama-3.3') || stored.includes('versatile')) {
    localStorage.setItem(GROQ_MODEL_KEY, DEFAULT_FREE_MODEL);
    return DEFAULT_FREE_MODEL;
  }
  return stored;
}

export function setSelectedGroqModel(modelId) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(GROQ_MODEL_KEY, modelId);
}

export function hasGroqApiKey() {
  return Boolean(getStoredGroqApiKey());
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
  apiKey = null,
  model = null,
}) {
  const key = apiKey || getStoredGroqApiKey();
  if (!key) {
    throw new Error('Groq API Key is missing. Please provide a key in settings or set VITE_GROQ_API_KEY.');
  }

  let selectedModel = model || getSelectedGroqModel();
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

  let response = await executeRequest(selectedModel);

  // If selected model is not accessible on user's free tier, auto-fallback to DEFAULT_FREE_MODEL
  if (!response.ok && response.status === 404 && selectedModel !== DEFAULT_FREE_MODEL) {
    console.warn(`Model ${selectedModel} not accessible. Auto-falling back to ${DEFAULT_FREE_MODEL}`);
    selectedModel = DEFAULT_FREE_MODEL;
    setSelectedGroqModel(DEFAULT_FREE_MODEL);
    response = await executeRequest(DEFAULT_FREE_MODEL);
  }

  // If still fails, try secondary free model
  if (!response.ok && response.status === 404 && selectedModel !== 'openai/gpt-oss-20b') {
    selectedModel = 'openai/gpt-oss-20b';
    setSelectedGroqModel('openai/gpt-oss-20b');
    response = await executeRequest('openai/gpt-oss-20b');
  }

  if (!response.ok) {
    let errorDetail = 'Failed to connect to Groq AI';
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
    throw new Error('Received an empty response from Groq AI.');
  }

  return {
    text: reply,
    model: selectedModel,
    isRealAI: true,
  };
}
