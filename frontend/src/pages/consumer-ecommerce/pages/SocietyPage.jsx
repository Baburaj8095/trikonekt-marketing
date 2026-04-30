import React from 'react';
import { Link } from 'react-router-dom';
import { FaArrowLeft } from 'react-icons/fa6';
import '../consumerEcommerce.css';

const initiatives = [
  {
    id: 1,
    title: 'Clean City Drive',
    description: 'Join our weekly volunteer group to keep our neighborhoods clean and green.',
    image: 'https://images.unsplash.com/photo-1532996122724-e3c354a0b15b?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80',
    color: '#059669',
    date: 'Every Sunday'
  },
  {
    id: 2,
    title: 'Local Artisan Support',
    description: 'Empowering local craftsmen by providing a platform to sell their handmade goods directly.',
    image: 'https://images.unsplash.com/photo-1544928147-79a2dbc1f389?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80',
    color: '#0284c7',
    date: 'Ongoing'
  },
  {
    id: 3,
    title: 'Tree Plantation Initiative',
    description: 'Help us reach our goal of planting 10,000 trees this year. Every hand makes a difference.',
    image: 'https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80',
    color: '#16a34a',
    date: 'Starts Next Month'
  }
];

export default function SocietyPage() {
  return (
    <div className="ce-app" style={{ background: '#f8fafc' }}>
      <header className="ce-header">
        <div className="ce-header-inner">
          <Link to="/consumer-ecommerce" className="ce-icon-btn" aria-label="Back to dashboard">
            <FaArrowLeft />
          </Link>
          <div className="ce-header-title-container">
            <h1 className="ce-header-title">For Better Society</h1>
            <span className="ce-header-subtitle">Make an impact today</span>
          </div>
          <div style={{ width: '42px' }}></div>
        </div>
      </header>

      <main className="ce-container" style={{ paddingTop: '80px' }}>
        <div className="ce-society-header-banner">
          <h2>Together We Can Build a Better World</h2>
          <p>Explore initiatives happening around you and join hands to create a positive social impact.</p>
        </div>

        <div className="ce-impact-list">
          {initiatives.map(initiative => (
            <article key={initiative.id} className="ce-impact-card">
              <div className="ce-impact-img-container">
                <img src={initiative.image} alt={initiative.title} className="ce-impact-img" />
                <span className="ce-impact-badge" style={{ background: initiative.color }}>
                  {initiative.date}
                </span>
              </div>
              <div className="ce-impact-body">
                <h3 className="ce-impact-title">{initiative.title}</h3>
                <p className="ce-impact-desc">{initiative.description}</p>
                <button className="ce-impact-btn" style={{ background: `${initiative.color}15`, color: initiative.color }}>
                  Join Initiative
                </button>
              </div>
            </article>
          ))}
        </div>
      </main>
    </div>
  );
}
