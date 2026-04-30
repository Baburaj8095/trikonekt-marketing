import { FaLocationDot } from 'react-icons/fa6';

export default function ShopCard() {
  return (
    <section className="ce-card">
      <img
        className="ce-shop-image"
        src="https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&w=900&q=80"
        alt="Modern retail shop interior"
      />
      <div className="ce-card-body">
        <h2 className="ce-card-title">Trikonekt Prime Store</h2>
        <p className="ce-muted-line">
          <FaLocationDot className="ce-primary-text" />
          Indiranagar, Bengaluru
        </p>
        <div className="ce-two-actions">
          <button className="ce-primary-btn">Follow</button>
          <button className="ce-secondary-btn">Report</button>
        </div>
      </div>
    </section>
  );
}
