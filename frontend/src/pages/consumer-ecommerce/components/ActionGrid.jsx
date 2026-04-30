import React from 'react';
import { Link } from 'react-router-dom';
import { FaBagShopping, FaTruckFast, FaCartShopping, FaMotorcycle } from 'react-icons/fa6';

const actions = [
  {
    id: 1,
    title: 'Free Zone Shopping',
    icon: FaBagShopping,
    color: '#8b5cf6', // Violet
    bg: '#f5f3ff',
    link: '/consumer-ecommerce'
  },
  {
    id: 2,
    title: 'Free Delivery Track',
    icon: FaTruckFast,
    color: '#0ea5e9', // Sky Blue
    bg: '#f0f9ff',
    link: '/consumer-ecommerce/delivery'
  },
  {
    id: 3,
    title: 'Online Shopping',
    icon: FaCartShopping,
    color: '#f59e0b', // Amber
    bg: '#fffbeb',
    link: '/consumer-ecommerce/delivery'
  },
  {
    id: 4,
    title: 'Private Delivery Track',
    icon: FaMotorcycle,
    color: '#10b981', // Emerald
    bg: '#ecfdf5',
    link: '/consumer-ecommerce/delivery'
  }
];

export default function ActionGrid() {
  return (
    <section className="ce-content-section" style={{ padding: '12px 14px' }}>
      <div 
        style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(2, 1fr)', 
          gap: '10px' 
        }}
      >
        {actions.map((action) => {
          const Icon = action.icon;
          return (
            <Link 
              key={action.id}
              to={action.link}
              className="ce-action-grid-btn"
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                textAlign: 'center',
                background: '#fff',
                borderRadius: '20px',
                padding: '16px 10px',
                textDecoration: 'none',
                boxShadow: '0 4px 16px rgba(15, 23, 42, 0.05)',
                border: '1px solid rgba(15, 23, 42, 0.03)',
                transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                gap: '10px'
              }}
            >
              <div 
                style={{ 
                  width: '52px', 
                  height: '52px', 
                  borderRadius: '16px', 
                  background: action.bg, 
                  color: action.color,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '24px'
                }}
              >
                <Icon />
              </div>
              <span style={{ fontSize: '13px', fontWeight: '800', color: 'var(--ce-text)', lineHeight: '1.2' }}>
                {action.title}
              </span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
