import { FaClock, FaLocationDot, FaStar, FaChevronRight } from 'react-icons/fa6';

export default function DeliveryCard({ store }) {
  return (
    <article className="ce-premium-delivery-card">
      <div className="ce-card-image-wrapper">
        <img className="ce-card-image" src={store.image} alt={store.name} />
        <div className="ce-card-image-gradient"></div>
        <div className="ce-card-time-badge">
          <FaClock style={{ marginRight: '4px' }} />
          {store.distance === '1.2 km' ? '15-20 min' : '30-40 min'}
        </div>
      </div>
      <div className="ce-card-content">
        <div className="ce-card-header-row">
          <h3 className="ce-card-title">{store.name}</h3>
          <span className="ce-card-rating">
            <span className="ce-rating-star"><FaStar /></span>
            {store.rating}
          </span>
        </div>
        <div className="ce-card-meta-row">
          <span className="ce-card-category">{store.category || 'Food & Dining'}</span>
          <span className="ce-dot" />
          <span className="ce-card-distance">
            <FaLocationDot style={{ marginRight: '4px' }} />
            {store.distance}
          </span>
        </div>
        <div className="ce-card-footer">
          <span className="ce-card-status">{store.status || 'Open now'}</span>
          <FaChevronRight className="ce-card-arrow" />
        </div>
      </div>
    </article>
  );
}
