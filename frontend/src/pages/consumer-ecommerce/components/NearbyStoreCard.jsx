import { FaLocationDot, FaStar } from 'react-icons/fa6';

export default function NearbyStoreCard({ store }) {
  return (
    <article className="ce-nearby-store-card">
      <img className="ce-nearby-store-image" src={store.image} alt={store.name} />
      <div className="ce-nearby-store-body">
        <div className="ce-nearby-store-head">
          <div className="ce-nearby-store-copy">
            <h3 className="ce-nearby-store-title">{store.name}</h3>
            <p className="ce-nearby-store-category">{store.category}</p>
          </div>
          <span className="ce-nearby-rating">
            <FaStar />
            {store.rating}
          </span>
        </div>
        <p className="ce-nearby-store-location">
          <FaLocationDot className="ce-primary-text" />
          {store.location}
        </p>
        <div className="ce-nearby-store-meta">
          <span>{store.distance}</span>
          <span>{store.status}</span>
        </div>
      </div>
    </article>
  );
}
