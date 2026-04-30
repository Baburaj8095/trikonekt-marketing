import { useRef, useEffect, useState } from 'react';
import { cashbackAds as mockAds } from '../services/mockData.js';
import { Link } from 'react-router-dom';

export default function CashbackAds({ adType = 'cashback' }) {
  const trackRef = useRef(null);
  const [ads, setAds] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // Simulate fetching configured ads from a backend API
  useEffect(() => {
    const fetchAds = async () => {
      try {
        setIsLoading(true);
        // Backend configurable URL example:
        // const response = await fetch(`/api/v1/ads?type=${adType}`);
        // const data = await response.json();
        
        setTimeout(() => {
          setAds(mockAds); // In real scenario, use filtered data
          setIsLoading(false);
        }, 600); // Simulated network delay
      } catch (error) {
        console.error("Failed to fetch ads:", error);
        setIsLoading(false);
      }
    };

    fetchAds();
  }, [adType]);

  // Infinite horizontal scroll logic
  useEffect(() => {
    if (ads.length === 0 || isLoading) return;

    const track = trackRef.current;
    if (!track) return;

    let animationId;
    let scrollPos = 0;

    const scroll = () => {
      // scroll speed
      scrollPos += 0.5;
      if (track) {
        // Since we duplicated the array, we reset halfway to create infinite loop
        if (scrollPos >= track.scrollWidth / 2) {
          scrollPos = 0;
        }
        track.scrollLeft = scrollPos;
      }
      animationId = requestAnimationFrame(scroll);
    };

    animationId = requestAnimationFrame(scroll);

    return () => cancelAnimationFrame(animationId);
  }, [ads, isLoading]);

  if (isLoading) {
    return <div style={{ height: '140px', margin: '16px 0', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--ce-muted)' }}>Loading cashback ads...</div>;
  }

  if (ads.length === 0) {
    return null;
  }

  // Duplicate for seamless infinite scrolling
  const duplicatedAds = [...ads, ...ads, ...ads, ...ads];

  return (
    <section className="ce-content-section" style={{ padding: '12px 14px' }}>
      <div className="ce-section-heading-row" style={{ marginBottom: '8px', paddingLeft: '4px' }}>
        <h2 className="ce-section-title" style={{ fontSize: '15px', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ fontSize: '18px' }}>💰</span> Exclusive Cashback Offers
        </h2>
      </div>
      
      <div 
        ref={trackRef} 
        style={{ 
          display: 'flex', 
          gap: '12px', 
          overflowX: 'hidden', 
          whiteSpace: 'nowrap',
          paddingBottom: '8px'
        }}
      >
        {duplicatedAds.map((ad, index) => (
          <Link 
            key={`${ad.id}-${index}`}
            to="/consumer-ecommerce/ads" 
            style={{ 
              flex: '0 0 240px', 
              height: '120px', 
              borderRadius: '16px', 
              overflow: 'hidden', 
              position: 'relative', 
              display: 'block',
              boxShadow: '0 4px 12px rgba(0,0,0,0.06)'
            }}
          >
            <img src={ad.image} alt={ad.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.8) 0%, rgba(0,0,0,0.2) 50%, transparent 100%)' }}></div>
            <div style={{ position: 'absolute', bottom: '12px', left: '12px', right: '12px', color: '#fff' }}>
              <span style={{ display: 'inline-block', background: '#f59e0b', color: '#fff', fontSize: '10px', fontWeight: '900', padding: '4px 8px', borderRadius: '8px', marginBottom: '4px', whiteSpace: 'normal' }}>
                {ad.discount}
              </span>
              <h3 style={{ fontSize: '14px', fontWeight: '800', margin: 0, whiteSpace: 'normal', lineHeight: '1.2' }}>{ad.title}</h3>
              <p style={{ fontSize: '11px', margin: '2px 0 0', opacity: 0.9, whiteSpace: 'normal' }}>{ad.brand}</p>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
