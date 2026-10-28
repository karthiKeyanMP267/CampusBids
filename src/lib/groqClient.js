/**
 * Groq AI Client Integration for CampusBid
 * Executes high-speed inference using environment-configured Groq API credentials.
 */

const DEFAULT_MODEL = 'openai/gpt-oss-120b';
const FALLBACK_MODEL = 'openai/gpt-oss-20b';

export function getGroqApiKey() {
  return (
    import.meta.env.VITE_GROQ_API_KEY ||
    import.meta.env.GROQ_API_KEY ||
    ''
  ).trim();
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
   - When the user asks for recommendations, specific items, or categories (e.g. "show me laptops", "hp lap for low price", "similar product listed cheaper than this", "find electronics", "what else can I bid on?"):
     a) Search the ACTIVE PRODUCTS LIST above for matches.
     b) Understand abbreviations and campus shorthand:
        - "lap" or "laptop" or "notebook" -> Laptops (e.g. HP Pavilion Plus)
        - "hp lap" -> HP Laptops listed in the catalog
        - "phone" / "mobile" -> Smartphones
        - "cycle" / "bike" -> Bicycles
        - "bat" -> Cricket bats / sports gear
     c) If the user asks for "similar product", "alternative", "cheaper than this", "lower price than this":
        - Compare against the CURRENT AUCTION LISTING (Category: ${auction?.category || 'General'}, Current Price: ₹${currentPrice}).
        - Filter items in the catalog in the same category or matching type where Price < ₹${currentPrice}.
        - Rank cheaper matching items first and display them clearly.
     d) For EVERY matching product, present it cleanly in the chat with:
        • **[Product Title](/auction/{id})**
        • **Price**: ₹{current_bid or starting_price}
        • **Condition**: {condition} | **Category**: {category}
        • **Why it matches**: A brief, helpful reason based on the seller's description and how its price compares.
        • Direct link: [View & Bid on this Item](/auction/{id})

3. WHEN NO PRODUCT MATCHES:
   - If the user asks for a product that is NOT in the CampusBid list above (e.g., they ask for an item type with zero listings):
     - Clearly and politely say: "There are currently no products matching '{request}' listed for bidding on CampusBid."
     - NEVER recommend buying it from external websites.
     - Mention 2-3 products from the active catalog above that ARE currently available, or suggest checking back soon.

4. SAFETY & PLATFORM WORKFLOWS:
   - When asked about inspection, explain what to check in person for this item before confirming handover.
   - Explain that payments and transfers require mutual 2-party campus confirmation.
   - FORMAT ALL RESPONSES WITH CRISP GFM MARKDOWN: Use bolding, bullet points, and markdown links [Title](/auction/{id}) so the user can easily tap and open the products.`;
}

/**
 * Executes chat completion request to Groq API with automatic fallback across multiple models
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

  const candidateModels = [
    'openai/gpt-oss-120b',
    'qwen/qwen3.8-27b',
    'openai/gpt-oss-20b',
  ];

  let lastError = null;

  for (const modelToUse of candidateModels) {
    try {
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${key}`,
        },
        body: JSON.stringify({
          model: modelToUse,
          messages: formattedMessages,
          temperature: 0.4,
          max_tokens: 1024,
          top_p: 1,
        }),
      });

      if (!response.ok) {
        let errMessage = `${response.status} ${response.statusText}`;
        try {
          const errBody = await response.json();
          errMessage = errBody?.error?.message || errMessage;
        } catch {
          // ignore json parse error
        }
        lastError = new Error(errMessage);
        continue;
      }

      const data = await response.json();
      const reply = data.choices?.[0]?.message?.content;
      if (reply) {
        return {
          text: reply,
          isRealAI: true,
          model: modelToUse,
        };
      }
    } catch (err) {
      lastError = err;
    }
  }

  throw lastError || new Error('Failed to obtain a response from AI Assistant.');
}

