/**
 * CampusBid constants — categories, conditions, and sample data
 */

export const CATEGORIES = [
  { id: 'textbooks', label: 'Textbooks', icon: 'BookOpen' },
  { id: 'electronics', label: 'Electronics', icon: 'Laptop' },
  { id: 'furniture', label: 'Furniture', icon: 'Armchair' },
  { id: 'clothing', label: 'Clothing', icon: 'Shirt' },
  { id: 'sports', label: 'Sports', icon: 'Dumbbell' },
  { id: 'instruments', label: 'Instruments', icon: 'Guitar' },
  { id: 'stationery', label: 'Stationery', icon: 'Pen' },
  { id: 'other', label: 'Other', icon: 'Package' },
];

export const CONDITIONS = [
  { id: 'like_new', label: 'Like New', color: 'text-emerald-600 bg-emerald-50' },
  { id: 'good', label: 'Good', color: 'text-blue-600 bg-blue-50' },
  { id: 'fair', label: 'Fair', color: 'text-amber-600 bg-amber-50' },
  { id: 'worn', label: 'Worn', color: 'text-orange-600 bg-orange-50' },
];

export const AUCTION_STATUS = {
  ACTIVE: 'active',
  ENDED: 'ended',
  SOLD: 'sold',
  UNSOLD: 'unsold',
  CANCELLED: 'cancelled',
  PENDING_APPROVAL: 'pending_approval',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  COMPLETED: 'completed',
};

/**
 * Sample auctions for the demo UI.
 * These will be replaced by real Supabase data later.
 */
export const SAMPLE_AUCTIONS = [
  {
    id: '1',
    title: 'Engineering Mathematics by B.S. Grewal',
    category: 'textbooks',
    condition: 'good',
    description: '44th edition. Some highlighting in Chapters 1–8, otherwise clean. Perfect for first-year engineering students.',
    images: ['https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=600&h=400&fit=crop'],
    starting_price: 250,
    current_bid: 420,
    bid_count: 7,
    min_increment: 20,
    seller: { name: 'Arjun S.', avatar: null, college: 'IIT Madras' },
    closing_at: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(), // 2 hours
    status: 'active',
  },
  {
    id: '2',
    title: 'Sony WH-1000XM4 Headphones',
    category: 'electronics',
    condition: 'like_new',
    description: 'Barely used, purchased 3 months ago. Comes with original box, carry case, and all cables. ANC works perfectly.',
    images: ['https://images.unsplash.com/photo-1618366712010-f4ae9c647dcb?w=600&h=400&fit=crop'],
    starting_price: 12000,
    current_bid: 15500,
    bid_count: 12,
    min_increment: 500,
    seller: { name: 'Priya M.', avatar: null, college: 'BITS Pilani' },
    closing_at: new Date(Date.now() + 45 * 60 * 1000).toISOString(), // 45 min
    status: 'active',
  },
  {
    id: '3',
    title: 'IKEA KALLAX Shelf Unit',
    category: 'furniture',
    condition: 'good',
    description: '4x2 cube shelf, white. Minor scuff on one corner. Disassembled, ready for pickup from hostel.',
    images: ['https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=600&h=400&fit=crop'],
    starting_price: 1500,
    current_bid: 2100,
    bid_count: 4,
    min_increment: 100,
    seller: { name: 'Rahul K.', avatar: null, college: 'VIT Vellore' },
    closing_at: new Date(Date.now() + 5 * 60 * 60 * 1000).toISOString(), // 5 hours
    status: 'active',
  },
  {
    id: '4',
    title: 'Casio FX-991EX Scientific Calculator',
    category: 'electronics',
    condition: 'like_new',
    description: 'Used for one semester only. All buttons work perfectly. Comes with the slide-on case.',
    images: ['https://images.unsplash.com/photo-1611532736597-de2d4265fba3?w=600&h=400&fit=crop'],
    starting_price: 800,
    current_bid: 800,
    bid_count: 1,
    min_increment: 50,
    seller: { name: 'Kavya R.', avatar: null, college: 'NIT Trichy' },
    closing_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 1 day
    status: 'active',
  },
  {
    id: '5',
    title: 'Kookaburra Cricket Bat — English Willow',
    category: 'sports',
    condition: 'fair',
    description: 'Grade 2 English willow. Used for two inter-college tournaments. Grip needs replacement. Good knock-in.',
    images: ['https://images.unsplash.com/photo-1531415074968-036ba1b575da?w=600&h=400&fit=crop'],
    starting_price: 2000,
    current_bid: 3200,
    bid_count: 9,
    min_increment: 200,
    seller: { name: 'Vikram T.', avatar: null, college: 'SRM Chennai' },
    closing_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(), // 15 min
    status: 'active',
  },
  {
    id: '6',
    title: 'Yamaha F310 Acoustic Guitar',
    category: 'instruments',
    condition: 'good',
    description: 'Solid top acoustic guitar. New strings installed. Minor dent on the lower bout, does not affect sound. Includes gig bag.',
    images: ['https://images.unsplash.com/photo-1510915361894-db8b60106cb1?w=600&h=400&fit=crop'],
    starting_price: 4000,
    current_bid: 5800,
    bid_count: 6,
    min_increment: 200,
    seller: { name: 'Deepa N.', avatar: null, college: 'Anna University' },
    closing_at: new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString(), // 3 hours
    status: 'active',
  },
  {
    id: '7',
    title: 'HP Pavilion Laptop — i5, 8GB, 512GB SSD',
    category: 'electronics',
    condition: 'good',
    description: '2023 model. 15.6" FHD display, 11th Gen i5, 8GB RAM, 512GB SSD. Battery holds 5+ hours. Charger included.',
    images: ['https://images.unsplash.com/photo-1496181133206-80ce9b88a853?w=600&h=400&fit=crop'],
    starting_price: 25000,
    current_bid: 31000,
    bid_count: 15,
    min_increment: 1000,
    seller: { name: 'Sneha P.', avatar: null, college: 'IIIT Hyderabad' },
    closing_at: new Date(Date.now() + 8 * 60 * 1000).toISOString(), // 8 min
    status: 'active',
  },
  {
    id: '8',
    title: "Levi's Denim Jacket — Size M",
    category: 'clothing',
    condition: 'like_new',
    description: 'Classic trucker jacket. Worn twice, too small for me. No stains or damage. Original tags still attached.',
    images: ['https://images.unsplash.com/photo-1551028719-00167b16eac5?w=600&h=400&fit=crop'],
    starting_price: 1500,
    current_bid: 1500,
    bid_count: 0,
    min_increment: 100,
    seller: { name: 'Aditya G.', avatar: null, college: 'DTU Delhi' },
    closing_at: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(), // 2 days
    status: 'active',
  },
];

/**
 * Get items closing within the given number of minutes
 */
export function getClosingSoon(auctions, withinMinutes = 60) {
  const cutoff = Date.now() + withinMinutes * 60 * 1000;
  return auctions
    .filter((a) => a.status === 'active' && new Date(a.closing_at).getTime() <= cutoff)
    .sort((a, b) => new Date(a.closing_at) - new Date(b.closing_at));
}

/**
 * Get featured / hot auctions (most bids)
 */
export function getFeatured(auctions, limit = 4) {
  return [...auctions]
    .filter((a) => a.status === 'active')
    .sort((a, b) => b.bid_count - a.bid_count)
    .slice(0, limit);
}
