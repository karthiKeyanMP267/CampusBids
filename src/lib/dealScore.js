/**
 * CampusBid — Transparent Deal Score Calculator
 * 
 * Provides an explainable, deterministic deal rating based purely on verified listing signals,
 * completeness, seller verification, and category baselines.
 * 
 * NO fabricated market values or opaque external black boxes.
 */

export function calculateDealScore(auction, categoryComparableAuctions = []) {
  if (!auction) {
    return {
      score: 50,
      tier: 'Standard',
      color: 'text-surface-700 bg-surface-100 border-surface-200',
      factors: [],
      missingChecks: ['Listing details unavailable'],
      hasMarketBenchmark: false,
    };
  }

  let totalScore = 0;
  const factors = [];
  const missingChecks = [];

  // ── 1. Photo Documentation (Max 25 pts) ─────────────────────────
  const photoCount = Array.isArray(auction.images) ? auction.images.length : (auction.images ? 1 : 0);
  if (photoCount >= 3) {
    totalScore += 25;
    factors.push({
      label: 'Comprehensive Photos',
      score: '+25 pts',
      description: `Includes ${photoCount} clear photos showing multiple angles.`,
      positive: true,
    });
  } else if (photoCount >= 1) {
    totalScore += 15;
    factors.push({
      label: 'Single Photo Provided',
      score: '+15 pts',
      description: 'Contains a primary photo; additional angles recommended.',
      positive: true,
    });
    missingChecks.push('Ask seller for photos of corners, screen, or wear points.');
  } else {
    totalScore += 5;
    factors.push({
      label: 'No Product Photos',
      score: '+5 pts',
      description: 'Using generic placeholder photo.',
      positive: false,
    });
    missingChecks.push('Request verified photos of the actual item before placing bids.');
  }

  // ── 2. Description Quality & Depth (Max 25 pts) ─────────────────
  const desc = (auction.description || '').trim();
  const descLength = desc.length;
  if (descLength > 150) {
    totalScore += 25;
    factors.push({
      label: 'Detailed Description',
      score: '+25 pts',
      description: 'Thorough description detailing item history, usage, and specs.',
      positive: true,
    });
  } else if (descLength > 50) {
    totalScore += 16;
    factors.push({
      label: 'Moderate Description',
      score: '+16 pts',
      description: 'Basic product info provided; specifics could be expanded.',
      positive: true,
    });
    missingChecks.push('Clarify original purchase date and reason for selling.');
  } else {
    totalScore += 8;
    factors.push({
      label: 'Brief Description',
      score: '+8 pts',
      description: 'Very short description provided by seller.',
      positive: false,
    });
    missingChecks.push('Ask seller about accessories, bill/box, and functional flaws.');
  }

  // ── 3. Condition Transparency (Max 20 pts) ──────────────────────
  const condition = auction.condition || 'good';
  if (condition === 'brand_new') {
    totalScore += 20;
    factors.push({
      label: 'Brand New Condition',
      score: '+20 pts',
      description: 'Unused in original packaging.',
      positive: true,
    });
    missingChecks.push('Verify original warranty or invoice validity if available.');
  } else if (condition === 'like_new') {
    totalScore += 18;
    factors.push({
      label: 'Like New Condition',
      score: '+18 pts',
      description: 'Minimal use with zero visible blemishes.',
      positive: true,
    });
    missingChecks.push('Check for micro-scratches during physical campus inspection.');
  } else if (condition === 'good') {
    totalScore += 15;
    factors.push({
      label: 'Good Condition',
      score: '+15 pts',
      description: 'Normally used with light cosmetic wear; fully functional.',
      positive: true,
    });
    missingChecks.push('Test all buttons, ports, and power charging before confirming handover.');
  } else if (condition === 'fair') {
    totalScore += 10;
    factors.push({
      label: 'Fair Condition',
      score: '+10 pts',
      description: 'Visible wear or older model; functional.',
      positive: false,
    });
    missingChecks.push('Thoroughly test battery life and hardware stability in person.');
  } else {
    totalScore += 5;
    factors.push({
      label: 'Heavily Used / Worn',
      score: '+5 pts',
      description: 'Substantial cosmetic wear noted.',
      positive: false,
    });
    missingChecks.push('Confirm repairability and exact flaws prior to bidding.');
  }

  // ── 4. Seller Verification & Identity (Max 15 pts) ──────────────
  const seller = auction.seller || {};
  if (seller.college || seller.display_name) {
    totalScore += 15;
    factors.push({
      label: 'Verified Campus Member',
      score: '+15 pts',
      description: `Listed by verified student from ${seller.college || 'campus'}.`,
      positive: true,
    });
  } else {
    totalScore += 8;
    factors.push({
      label: 'Campus Seller Profile',
      score: '+8 pts',
      description: 'Basic student profile.',
      positive: true,
    });
  }

  // ── 5. Campus Price Benchmark (Max 15 pts) ──────────────────────
  let hasMarketBenchmark = false;
  const currentPrice = Number(auction.current_bid || auction.starting_price || 0);

  // Filter comparable auctions in same category (excluding current auction)
  const validComparables = categoryComparableAuctions.filter(
    (c) => c.id !== auction.id && c.category === auction.category && (c.current_bid || c.starting_price)
  );

  if (validComparables.length >= 3) {
    hasMarketBenchmark = true;
    const prices = validComparables.map((c) => Number(c.current_bid || c.starting_price)).sort((a, b) => a - b);
    const medianPrice = prices[Math.floor(prices.length / 2)];

    if (currentPrice < medianPrice * 0.85) {
      totalScore += 15;
      factors.push({
        label: 'Below Category Median',
        score: '+15 pts',
        description: `Current price (₹${currentPrice}) is well below the campus median (₹${medianPrice}) for ${auction.category}.`,
        positive: true,
      });
    } else if (currentPrice <= medianPrice * 1.15) {
      totalScore += 12;
      factors.push({
        label: 'Fair Market Range',
        score: '+12 pts',
        description: `Current price (₹${currentPrice}) aligns closely with campus benchmark (₹${medianPrice}).`,
        positive: true,
      });
    } else {
      totalScore += 5;
      factors.push({
        label: 'Premium Pricing',
        score: '+5 pts',
        description: `Current price is above campus median (₹${medianPrice}). Ensure premium condition justifies cost.`,
        positive: false,
      });
    }
  } else {
    // Insufficient historical records
    totalScore += 10;
    factors.push({
      label: 'Insufficient Campus Comparables',
      score: '+10 pts',
      description: `Fewer than 3 comparable items in ${auction.category} on campus. Baseline neutral score applied.`,
      positive: true,
    });
    missingChecks.push('Compare with external student marketplace listings for similar specs.');
  }

  // Clamp score between 0 and 100
  const finalScore = Math.min(100, Math.max(10, Math.round(totalScore)));

  let tier = 'Fair Value';
  let color = 'text-amber-700 bg-amber-50 border-amber-200';
  let badgeColor = 'bg-amber-100 text-amber-800';

  if (finalScore >= 85) {
    tier = 'Exceptional Deal';
    color = 'text-emerald-700 bg-emerald-50 border-emerald-200';
    badgeColor = 'bg-emerald-100 text-emerald-800';
  } else if (finalScore >= 70) {
    tier = 'Good Deal';
    color = 'text-brand-700 bg-brand-50 border-brand-200';
    badgeColor = 'bg-brand-100 text-brand-800';
  } else if (finalScore >= 50) {
    tier = 'Standard Listing';
    color = 'text-surface-700 bg-surface-50 border-surface-200';
    badgeColor = 'bg-surface-200 text-surface-800';
  } else {
    tier = 'Verify Carefully';
    color = 'text-rose-700 bg-rose-50 border-rose-200';
    badgeColor = 'bg-rose-100 text-rose-800';
  }

  return {
    score: finalScore,
    tier,
    color,
    badgeColor,
    factors,
    missingChecks,
    hasMarketBenchmark,
  };
}
