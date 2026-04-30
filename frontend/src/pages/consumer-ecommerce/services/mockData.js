import {
  FaAdversal,
  FaCouch,
  FaMapMarkerAlt,
  FaTshirt,
} from 'react-icons/fa';

export const citySuggestions = [
  'Bengaluru',
  'Mysuru',
  'Mumbai',
  'Pune',
  'Chennai',
  'Coimbatore',
  'Hyderabad',
  'Mangaluru',
];

export const locations = [
  { label: 'Nearby', icon: FaMapMarkerAlt },
  { label: 'Karnataka', icon: FaMapMarkerAlt },
  { label: 'Maharashtra', icon: FaMapMarkerAlt },
  { label: 'Tamil Nadu', icon: FaMapMarkerAlt },
];

export const categories = [
  { label: 'Watch & Earn Ads', icon: FaAdversal },
  { label: 'Fashion', icon: FaTshirt },
  { label: 'Furniture', icon: FaCouch },
];

export const consumerProfile = {
  name: 'Raghavendra Shenoy',
  idNumber: 'TRK-2026-1048',
  pinCode: '560038',
  phone: '+91 98765 43210',
  city: 'Indiranagar, Bengaluru',
  membership: 'Prime Consumer Member',
  walletBalance: 'Rs. 2,450',
};

export const offerBanners = [
  {
    id: 1,
    title: 'Tripay',
    subtitle: 'Pay bills, scan QR codes, recharge, and manage quick wallet payments in one place.',
    badge: 'Payments',
    color: '#eef2ff',
    image: 'https://images.unsplash.com/photo-1563013544-824ae1b704d3?auto=format&fit=crop&w=900&q=80',
  },
  {
    id: 2,
    title: 'Trizone',
    subtitle: 'Explore local business zones, community offers, services, and nearby activities.',
    badge: 'Local Zone',
    color: '#fdf4ff',
    image: 'https://images.unsplash.com/photo-1518005020951-eccb494ad742?auto=format&fit=crop&w=900&q=80',
  },
  {
    id: 3,
    title: 'Tri Eat',
    subtitle: 'Order meals, snacks, and daily food favorites from restaurants around your area.',
    badge: 'Food',
    color: '#fff7ed',
    image: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=900&q=80',
  },
  {
    id: 4,
    title: 'Tri Pick and Drop',
    subtitle: 'Book pickup and drop service for parcels, essentials, documents, and quick local tasks.',
    badge: 'Delivery',
    color: '#f0fdf4',
    image: 'https://images.unsplash.com/photo-1616401784845-180882ba9ba8?auto=format&fit=crop&w=900&q=80',
  },
  {
    id: 5,
    title: 'Tri Trip',
    subtitle: 'Plan city rides, short trips, bookings, and travel support from trusted local partners.',
    badge: 'Travel',
    color: '#f0f9ff',
    image: 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=900&q=80',
  },
];

export const products = [
  {
    id: 1,
    name: 'Urban Smart Watch',
    oldPrice: 'Rs. 4,999',
    newPrice: 'Rs. 2,499',
    discount: '50% OFF',
    image: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=600&q=80',
  },
  {
    id: 2,
    name: 'Cotton Streetwear Jacket',
    oldPrice: 'Rs. 3,299',
    newPrice: 'Rs. 1,849',
    discount: '44% OFF',
    image: 'https://images.unsplash.com/photo-1551028719-00167b16eac5?auto=format&fit=crop&w=600&q=80',
  },
  {
    id: 3,
    name: 'Compact Lounge Chair',
    oldPrice: 'Rs. 8,999',
    newPrice: 'Rs. 5,399',
    discount: '40% OFF',
    image: 'https://images.unsplash.com/photo-1501045661006-fcebe0257c3f?auto=format&fit=crop&w=600&q=80',
  },
  {
    id: 4,
    name: 'Everyday Sneaker Pair',
    oldPrice: 'Rs. 2,799',
    newPrice: 'Rs. 1,599',
    discount: '43% OFF',
    image: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=600&q=80',
  },
];

export const stores = [
  {
    id: 1,
    name: 'Spice Garden Kitchen',
    rating: '4.6',
    deliveryTime: '24 mins',
    distance: '1.8 km',
    image: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=700&q=80',
  },
  {
    id: 2,
    name: 'Fresh Basket Mart',
    rating: '4.4',
    deliveryTime: '18 mins',
    distance: '1.2 km',
    image: 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=700&q=80',
  },
  {
    id: 3,
    name: 'Cafe Blue Lane',
    rating: '4.7',
    deliveryTime: '31 mins',
    distance: '2.6 km',
    image: 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=700&q=80',
  },
];

export const nearbyStores = [
  {
    id: 1,
    name: 'Trikonekt Prime Store',
    category: 'Fashion and electronics',
    location: 'Indiranagar, Bengaluru',
    distance: '650 m',
    status: 'Open now',
    rating: '4.8',
    image: 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&w=700&q=80',
  },
  {
    id: 2,
    name: 'Fresh Basket Mart',
    category: 'Grocery and essentials',
    location: '12th Main Road',
    distance: '1.2 km',
    status: 'Open now',
    rating: '4.4',
    image: 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=700&q=80',
  },
  {
    id: 3,
    name: 'Urban Comfort Furniture',
    category: 'Furniture and decor',
    location: 'Domlur, Bengaluru',
    distance: '2.1 km',
    status: 'Closes 9 PM',
    rating: '4.6',
    image: 'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?auto=format&fit=crop&w=700&q=80',
  },
  {
    id: 4,
    name: 'Blue Lane Cafe',
    category: 'Cafe and snacks',
    location: 'HAL 2nd Stage',
    distance: '2.4 km',
    status: 'Open now',
    rating: '4.7',
    image: 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=700&q=80',
  },
];

export const adBanners = [
  {
    id: 1,
    image: 'https://images.unsplash.com/photo-1542744173-8e7e53415bb0?auto=format&fit=crop&w=800&q=80',
    title: 'Earn 50 Tri Coins',
    brand: 'Local Cafe'
  },
  {
    id: 2,
    image: 'https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?auto=format&fit=crop&w=800&q=80',
    title: 'Watch & Get 20% Off',
    brand: 'Fashion Store'
  },
  {
    id: 3,
    image: 'https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?auto=format&fit=crop&w=800&q=80',
    title: 'Win Movie Tickets',
    brand: 'Cinema'
  }
];

export const cashbackAds = [
  {
    id: 1,
    image: 'https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?auto=format&fit=crop&w=800&q=80',
    title: 'Get 20% Cashback',
    brand: 'Tri Pay Merchants',
    discount: '20% CB'
  },
  {
    id: 2,
    image: 'https://images.unsplash.com/photo-1593672715438-d88a70629abe?auto=format&fit=crop&w=800&q=80',
    title: 'Flat ₹50 Cashback',
    brand: 'Local Grocer',
    discount: '₹50 CB'
  },
  {
    id: 3,
    image: 'https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?auto=format&fit=crop&w=800&q=80',
    title: '10% Cashback on Movies',
    brand: 'Cinema',
    discount: '10% CB'
  }
];
