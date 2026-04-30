import { Link } from 'react-router-dom';
import { FaLocationDot, FaChevronDown } from 'react-icons/fa6';
import { consumerProfile } from '../services/mockData.js';

export default function SearchBar({ onSearch }) {
  // Use pincode from mock profile or fallback to 560091
  const pincode = consumerProfile?.pinCode || '560091';

  return (
    <div className="ce-search-button" style={{ background: '#eef6ff', border: 'none', boxShadow: 'none' }}>
      <button type="button" onClick={onSearch} className="ce-search-main" style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#1f2937' }}>
        <FaLocationDot style={{ fontSize: '18px', color: '#4b5563' }} />
        <span className="ce-search-placeholder" style={{ fontWeight: '600', fontSize: '15px' }}>Deliver to {pincode}</span>
        <FaChevronDown style={{ fontSize: '12px', color: '#6b7280', marginTop: '2px' }} />
      </button>
      <Link to="/consumer-ecommerce/join-prime" className="ce-prime-pill">
        Join Prime
      </Link>
    </div>
  );
}
