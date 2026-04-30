import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FaArrowLeft, FaLocationDot } from 'react-icons/fa6';
import '../consumerEcommerce.css';

const initialCartItems = [
  { id: 1, name: 'Chicken Biryani', restaurant: 'Meghana Foods', price: 320, quantity: 1, image: 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=800&q=80' },
  { id: 2, name: 'Paneer Butter Masala', restaurant: 'Meghana Foods', price: 280, quantity: 2, image: 'https://images.unsplash.com/photo-1631452180519-c014fe946bc0?w=800&q=80' },
];

export default function CartPage() {
  const navigate = useNavigate();
  const [items, setItems] = useState(initialCartItems);

  const updateQuantity = (id, delta) => {
    setItems(items.map(item => {
      if (item.id === id) {
        const newQuantity = Math.max(0, item.quantity + delta);
        return { ...item, quantity: newQuantity };
      }
      return item;
    }).filter(item => item.quantity > 0));
  };

  const itemTotal = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const deliveryFee = itemTotal > 0 ? 45 : 0;
  const taxes = itemTotal * 0.05;
  const grandTotal = itemTotal + deliveryFee + taxes;

  if (items.length === 0) {
    return (
      <div className="ce-app">
        <header className="ce-header ce-delivery-header">
          <div className="ce-header-inner ce-delivery-header-inner" style={{ gridTemplateColumns: '42px 1fr 42px' }}>
            <button onClick={() => navigate(-1)} className="ce-icon-btn ce-delivery-back-btn">
              <FaArrowLeft />
            </button>
            <div className="ce-delivery-header-title-wrap">
              <h1 className="ce-delivery-title">Your Cart</h1>
            </div>
            <div></div>
          </div>
        </header>
        <main className="ce-container" style={{ paddingTop: '100px', textAlign: 'center' }}>
          <h2 style={{ color: 'var(--ce-text)', fontWeight: 800 }}>Cart is empty</h2>
          <p style={{ color: 'var(--ce-muted)', fontSize: '14px', marginTop: '8px' }}>Looks like you haven't added anything yet.</p>
          <Link to="/consumer-ecommerce/delivery" className="ce-submit-btn" style={{ display: 'inline-block', marginTop: '24px', width: 'auto', padding: '12px 24px', textDecoration: 'none' }}>
            Browse Restaurants
          </Link>
        </main>
      </div>
    );
  }

  return (
    <div className="ce-app">
      <header className="ce-header ce-delivery-header">
        <div className="ce-header-inner ce-delivery-header-inner" style={{ gridTemplateColumns: '42px 1fr 42px' }}>
          <button onClick={() => navigate(-1)} className="ce-icon-btn ce-delivery-back-btn">
            <FaArrowLeft />
          </button>
          <div className="ce-delivery-header-title-wrap">
            <h1 className="ce-delivery-title">Your Cart</h1>
            <p className="ce-delivery-location" style={{ justifyContent: 'center' }}>
              <FaLocationDot style={{ color: '#f59e0b' }} /> Deliver to Home
            </p>
          </div>
          <div></div>
        </div>
      </header>

      <main className="ce-container" style={{ paddingTop: '80px', paddingBottom: '120px' }}>
        <section className="ce-cart-items-section">
          <div className="ce-cart-restaurant-banner">
            <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 800, color: 'var(--ce-text)' }}>{items[0].restaurant}</h3>
          </div>
          
          <div className="ce-cart-items-list">
            {items.map(item => (
              <div key={item.id} className="ce-cart-item">
                <img src={item.image} alt={item.name} className="ce-cart-item-image" />
                <div className="ce-cart-item-details">
                  <h4 className="ce-cart-item-title">{item.name}</h4>
                  <span className="ce-cart-item-price">₹{item.price}</span>
                </div>
                <div className="ce-cart-qty-controls">
                  <button onClick={() => updateQuantity(item.id, -1)} className="ce-qty-btn">-</button>
                  <span className="ce-qty-val">{item.quantity}</span>
                  <button onClick={() => updateQuantity(item.id, 1)} className="ce-qty-btn">+</button>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="ce-cart-bill-section">
          <h3 className="ce-bill-title">Bill Details</h3>
          <div className="ce-bill-row">
            <span>Item Total</span>
            <span>₹{itemTotal.toFixed(2)}</span>
          </div>
          <div className="ce-bill-row">
            <span>Delivery Fee</span>
            <span>₹{deliveryFee.toFixed(2)}</span>
          </div>
          <div className="ce-bill-row">
            <span>Taxes & Charges</span>
            <span>₹{taxes.toFixed(2)}</span>
          </div>
          <div className="ce-bill-row ce-bill-total">
            <span>To Pay</span>
            <span>₹{grandTotal.toFixed(2)}</span>
          </div>
        </section>
      </main>

      <div className="ce-cart-bottom-bar">
        <div className="ce-cart-bottom-amount">
          <span className="ce-cart-grand-total">₹{grandTotal.toFixed(2)}</span>
          <span className="ce-cart-view-details">VIEW DETAILED BILL</span>
        </div>
        <button className="ce-cart-checkout-btn">
          Proceed to Pay
        </button>
      </div>
    </div>
  );
}
