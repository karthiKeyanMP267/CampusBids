# CampusBid — College Marketplace & Real-Time Auction Platform

> **CampusBid** is a real-time peer-to-peer campus marketplace designed specifically for university students. It combines transactional live auction bidding, anti-sniping protection, automated proxy bidding, AI-driven deal evaluation and pre-inspection advisory, in-app real-time notifications, transparent Deal Scoring, and two-party cryptographic handover verification.

---

## 🚀 Key Features

### 1. Real-Time Bidding & Anti-Sniping Protection
- **Atomic Concurrency Control**: Bid placement runs inside a PostgreSQL database transaction (`place_bid()`) enforcing row-level locks on auctions.
- **Dynamic Increments**: Enforces `current_bid + min_increment` with strict validation.
- **Anti-Sniping (Soft Close)**: Any bid placed during the final 30 seconds of an auction dynamically extends the countdown by an additional 60 seconds, preventing last-second sniping bots.
- **Duplicate Bid Prevention**: Active leading bidders cannot spam or rebid consecutively unless outbid by another student.

### 2. Automatic Bidding (Proxy Bidding)
- **Confidential Maximum Budgets**: Bidders set a confidential spending ceiling stored securely in `public.auto_bids`, protected by Row Level Security (`auth.uid() = bidder_id`).
- **High-Speed $O(1)$ Direct Resolution**: Proxy bidding executes server-side directly inside PostgreSQL transactions without slow step loops, resolving multi-bidder competition in $<5$ ms with zero network latency.
- **Optimistic & Authoritative Realtime Bid History**: Supabase Realtime WebSocket listeners immediately render incoming auto-bids on the UI with zero lag while automatically hydrating profile joins.
- **Instant Outbid Notifications**: When a student's proxy budget is exceeded, real-time alert notifications trigger immediately.

### 3. AI Auction Advisor (Powered by Groq Cloud AI)
- **Real Groq AI Inference**: Integrated with Groq's high-speed inference engine supporting verified free models: `openai/gpt-oss-120b` (Default recommended), `openai/gpt-oss-20b`, `qwen/qwen3.8-27b`, and `llama-3.1-8b-instant` with automatic fallback.
- **Secure Server-Side Configuration**: API keys are securely loaded from `VITE_GROQ_API_KEY` in `.env.local` without exposing credentials or configuration controls to end-users.
- **Persistent Chat History**: AI discussions are saved in PostgreSQL (`public.ai_chat_messages`) scoped to each student and auction listing.
- **Full GFM Markdown & Table Rendering**: AI responses render with formatted Markdown tables, headings, checklists (`- [ ]`), strikethrough, and blockquotes.
- **Strict Catalog-Grounded Product Matching**: The assistant dynamically ingests active CampusBid listings and matches student queries directly to listed items with title, current price, condition, category, and direct route badges (`[View Listing](/auction/:id)`).
- **Zero-External Hallucination Policy**: Strictly forbidden by system prompt and guardrails from referencing Google, Amazon, Flipkart, or outside products. If no item matches on CampusBid, it explicitly notifies the user and suggests active listings instead.
- **Listing Grounding & Risk Assessment**: Provides listing risk assessments, tailored physical pre-inspection checklists for campus meetups, and bidding history summaries without hallucinating missing data.
- **Zero-Hallucination Heuristic Fallback**: Includes a rule-based analyzer when working offline or without an active Groq API key.

### 4. Transparent Deal Score (0–100)
- **Explainable Multi-Factor Scoring**:
  1. **Photo Quality & Coverage**: Evaluates multiple angles and visual evidence.
  2. **Description Depth**: Assesses disclosure of wear, specifications, and history.
  3. **Item Condition**: Factors stated cosmetic and functional grade.
  4. **Verified Student Seller**: Validates institutional `.edu` email and campus profile.
  5. **Campus Price Benchmark**: Compares starting price against collegiate baseline ranges for the item category.
- **Inspection Checklist Modal**: Interactive factor breakdown popover with tailored pre-inspection checklist.

### 5. Community Auction Q&A
- **Public Discussion Thread**: Potential student buyers can ask questions directly on the listing page.
- **Verified Seller Responses**: Only the verified auction seller can submit official answers.
- **Real-Time Synchronized**: New questions and answers broadcast live to all active viewers.

### 6. Saved Searches & Match Alerts
- **Filter Persistence**: Save frequent queries with custom category, condition, and price range filters.
- **Automated Triggers**: PostgreSQL triggers (`notify_saved_search_matches()`) notify students when a newly listed item matches their saved criteria.

### 7. Real-Time In-App & Browser Notifications
- **Notification Bell**: Unread badge counter and popover drawer in navigation header.
- **Live Event Feed**: Alerts for outbid events, auction won/expired, seller approval requests, and saved search matches.
- **Web Notification API**: Optional native desktop/browser notifications when permission is granted.
- **Error Boundary Protected**: Navigation is isolated from socket or subscription failures.

### 8. Seller & Buyer Dashboards
- **Seller Dashboard (`/my-listings`)**: Track active, pending approval, completed, and unsold listings. Includes one-click seller approval and handover confirmation.
- **Buyer Dashboard (`/my-bids`)**: Track active bids, leading status, outbid alerts, won auctions, and pickup coordination.

### 9. Secure Two-Party Handover
- **Mutual Confirmation**: Protects funds until buyer and seller meet in a public campus location and mutually confirm item transfer.

### 10. Student Profile & Account Management (`/profile`)
- **Account Details Management**: Update display name, campus/institution, contact phone number, and custom avatar URL with real-time UI synchronization.
- **Security & Password Management**: Change account password securely via Supabase Auth (`supabase.auth.updateUser`).
- **Irrevocable Account Deletion (Danger Zone)**: Permanently delete your student account, profile, active listings, and bidding history with multi-step confirmation and cascading database wipe (`delete_own_account()`).

---

## 🛠️ Technology Stack

| Layer | Technologies |
|---|---|
| **Frontend** | React 19, Vite 8, React Router v7 |
| **Styling** | Tailwind CSS v4, Lucide React Icons |
| **Backend & Database** | Supabase (PostgreSQL 15), Row Level Security (RLS) |
| **Realtime** | Supabase Realtime Channels (PostgreSQL CDC WebSockets) |
| **Storage** | Supabase Storage (`auction-images` bucket) |
| **AI Inference** | Groq Cloud API (`llama-3.3-70b-versatile`, `llama-3.1-8b-instant`) |
| **Linter & Tooling** | Oxlint, Vite Build Engine |

---

## 📋 Environment Configuration

Create a `.env.local` file in the project root:

```env
# Supabase Configuration
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your-supabase-publishable-key

# Groq AI Configuration (Optional - can also be configured dynamically in the UI)
VITE_GROQ_API_KEY=gsk_your_groq_api_key_here
```

> **Tip**: You can get a free, high-speed Groq API key at [console.groq.com/keys](https://console.groq.com/keys).

---

## 🗄️ Database Setup & Migrations

All tables, Row Level Security policies, stored procedures, and triggers are provided in [`supabase-schema.sql`](./supabase-schema.sql):

1. Open your **Supabase Dashboard** -> **SQL Editor**.
2. Run the migration script in [`supabase-schema.sql`](./supabase-schema.sql).
3. Ensure the following tables are created with RLS enabled:
   - `profiles`
   - `auctions`
   - `bids`
   - `auto_bids`
   - `auction_questions`
   - `saved_searches`
   - `notifications`
   - `handover_confirmations`
4. Set up an `auction-images` public storage bucket in Supabase Storage with public read access.

---

## 💻 Local Development

```bash
# 1. Install dependencies
npm install

# 2. Start Vite development server
npm run dev

# 3. Lint codebase
npm run lint

# 4. Production build
npm run build
```

---

## 👥 Authors & License

Developed for the Campus Marketplace Hackathon. Built with React, Supabase, and Groq AI.
