import { useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { FaArrowRight } from 'react-icons/fa6';
import { offerBanners } from '../services/mockData.js';

export default function OfferCarousel() {
  const trackRef = useRef(null);

  const moveCarousel = () => {
    const track = trackRef.current;
    if (!track) return;

    const firstCard = track.querySelector('.ce-offer-card');
    const cardWidth = firstCard ? firstCard.getBoundingClientRect().width : 320;
    const gap = 16;
    const maxScrollLeft = track.scrollWidth - track.clientWidth;
    const nextLeft = track.scrollLeft + cardWidth + gap;

    track.scrollTo({
      left: nextLeft >= maxScrollLeft - 4 ? 0 : nextLeft,
      behavior: 'smooth',
    });
  };

  useEffect(() => {
    // Auto scroll every 3 seconds
    const interval = setInterval(moveCarousel, 5000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;

    const cards = track.querySelectorAll('.ce-offer-card');
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && entry.intersectionRatio >= 0.5) {
            const color = entry.target.dataset.color;
            if (color) {
              const appEl = document.querySelector('.ce-app');
              if (appEl) {
                appEl.style.setProperty('--ce-bg', color);
              }
            }
          }
        });
      },
      {
        root: track,
        threshold: 0.5,
      }
    );

    cards.forEach((card) => observer.observe(card));

    return () => {
      cards.forEach((card) => observer.unobserve(card));
      observer.disconnect();
    };
  }, []);

  const getServiceRoute = (title) => {
    switch(title) {
      case 'Tripay': return '/consumer-ecommerce/tripay';
      case 'Tri Eat': return '/consumer-ecommerce/trieat';
      case 'Tri Pick and Drop': return '/consumer-ecommerce/tripickdrop';
      case 'Tri Trip': return '/consumer-ecommerce/tritrip';
      default: return '/consumer-ecommerce';
    }
  };

  const filteredOffers = offerBanners.filter(offer => 
    ['Tripay', 'Tri Eat', 'Tri Pick and Drop', 'Tri Trip'].includes(offer.title)
  );

  return (
    <section className="ce-offer-carousel" aria-label="Tri Services">
      <div className="ce-offer-container">
        <div className="ce-offer-track" ref={trackRef}>
          {filteredOffers.map((offer) => (
            <Link
              key={offer.id}
              to={getServiceRoute(offer.title)}
              className="ce-offer-card"
              data-color={offer.color}
              style={{ backgroundImage: `url(${offer.image})` }}
            >
              <div className="ce-offer-overlay">
                <span className="ce-offer-badge">{offer.badge}</span>
                <h2 className="ce-offer-title">{offer.title}</h2>
                <p className="ce-offer-subtitle">{offer.subtitle}</p>
              </div>
            </Link>
          ))}
          {/* Spacer to ensure the last card can be scrolled to with proper padding */}
          <div className="ce-offer-track-spacer" />
        </div>
      </div>
    </section>
  );
}
