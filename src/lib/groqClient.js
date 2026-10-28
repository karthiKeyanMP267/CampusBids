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
 * Builds the comprehensive grounding prompt strictly anchored to listed marketplace items
 */
function buildSystemPrompt(auction, bids = [], dealScore = null, listedProducts = []) {
  const currentPrice = bids[0]?.amount || auction?.current_bid || auction?.starting_price || 0;
  const recentBidsSummary = (bids || []).slice(0, 5).map(
    (b, i) => `#${i + 1}: ₹${b.amount} by ${b.bidder?.display_name || 'Student'} at ${new Date(b.created_at).toLocaleTimeString()}`
  ).join('\n') || 'No bids placed yet.';

  const dealScoreText = dealScore
    ? `Deal Score: ${dealScore.score}/100 (${dealScore.tier}). Factors: ${dealScore.factors.map((f) => `${f.label}: ${f.description}`).join('; ')}`
    : 'Not calculated.';

  // Build the catalog of all active products listed on the bidding platform
  const catalogList = (listedProducts || []).filter((p) => p && p.title).map((p, idx) => {
    const price = p.current_bid || p.starting_price || 0;
    const cond = (p.condition || 'good').replace('_', ' ');
    const desc = p.description ? p.description.slice(0, 160) : 'No description provided';
    return `${idx + 1}. **${p.title}** (Link: /auction/${p.id})
   - Category: ${p.category} | Condition: ${cond}
   - Price: ₹${price} (Starts at ₹${p.starting_price})
   - Status: ${p.status || 'active'}
   - Description: ${desc}`;
  }).join('\n\n');

  return `You are the official CampusBid AI Marketplace Assistant, an intelligent student advisor dedicated to the college bidding marketplace.

CURRENT AUCTION LISTING (User is currently viewing this item):
- Title: "${auction?.title || 'Unknown'}"
- Category: ${auction?.category || 'General'}
- Condition: ${(auction?.condition || '').replace('_', ' ')}
- Starting Price: ₹${auction?.starting_price || 0}
- Current Bid: ₹${currentPrice}
- Min Increment: ₹${auction?.min_increment || 10}
- Closing Time: ${auction?.closing_at ? new Date(auction.closing_at).toLocaleString() : 'N/A'}
- Status: ${auction?.status}
- Anti-sniping: Active (bids in final 30 seconds extend closing by 60s)
- Seller: ${auction?.seller?.display_name || 'Student Seller'} (College: ${auction?.seller?.college || 'Campus'})
- Photos count: ${auction?.images?.length || 0}
- Item Description: "${auction?.description || 'No description provided.'}"
- Recent Bids:
${recentBidsSummary}
- Deal Analysis:
${dealScoreText}

ALL ACTIVE PRODUCTS CURRENTLY LISTED ON THE CAMPUSBID PLATFORM:
${catalogList || 'No other listings currently active.'}

CRITICAL RULES & STRICT CONSTRAINTS:
1. STRICT PRODUCT GROUNDING (CAMPUSBID CATALOG ONLY):
   - You MUST ONLY show, recommend, or refer to products that are listed in the CAMPUSBID ACTIVE PRODUCTS above or the current auction listing.
   - NEVER show, invent, or suggest products from Google, Amazon, Flipkart, or your own pre-trained external knowledge.
   - Do NOT give generic or random product details from outside this marketplace.

2. MATCHING PRODUCT REQUESTS:
   - When the user asks for recommendations, specific items, or categories (e.g. "show me laptops", "do you have any calculators or textbooks?", "find cheap electronics", "what else can I bid on?"):
     a) Search the ACTIVE PRODUCTS LIST above for matches.
     b) For EVERY matching product, present it cleanly in the chat with:
        • **[Product Title](/auction/{id})**
        • **Price**: ₹{current_bid or starting_price}
        • **Condition**: {condition} | **Category**: {category}
        • **Why it matches**: A brief, helpful reason based on the seller's description.
        • Direct link: [View & Bid on this Item](/auction/{id})
     c) If the user asks for alternatives to the currently viewed item, compare it only against other matching items in the catalog above.

3. WHEN NO PRODUCT MATCHES:
   - If the user asks for a product that is NOT in the CampusBid list above (e.g., they ask for "gaming console" and none is listed):
     - Clearly and politely say: "There are currently no products matching '{request}' listed for bidding on CampusBid."
     - NEVER recommend buying it from external websites.
     - Mention 2-3 products from the active catalog above that ARE currently available, or suggest checking back soon.

4. SAFETY & PLATFORM WORKFLOWS:
   - When asked about inspection, explain what to check in person for this item before confirming handover.
   - Explain that payments and transfers require mutual 2-party campus confirmation.
   - FORMAT ALL RESPONSES WITH CRISP GFM MARKDOWN: Use bolding, bullet points, and markdown links [Title](/auction/{id}) so the user can easily tap and open the products.`;
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
  listedProducts = [],
}) {
  const key = getGroqApiKey();
  if (!key) {
    throw new Error('AI inference service is currently unconfigured.');
  }

  const systemPrompt = buildSystemPrompt(auction, bids, dealScore, listedProducts);

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
