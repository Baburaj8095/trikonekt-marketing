import { Link } from 'react-router-dom';

export default function GridProductCard({ product }) {
  return (
    <Link 
      to={`/consumer-ecommerce/product/${product.id}`}
      style={{ 
        display: 'flex',
        flexDirection: 'column',
        borderRadius: '16px',
        overflow: 'hidden',
        background: '#fff',
        boxShadow: '0 4px 12px rgba(15, 23, 42, 0.04)',
        border: '1px solid rgba(15, 23, 42, 0.06)',
        textDecoration: 'none',
        transition: 'transform 0.2s ease, box-shadow 0.2s ease',
      }}
      className="ce-grid-product-card"
    >
      <div style={{ width: '100%', aspectRatio: '1 / 1.1', position: 'relative' }}>
        <img 
          src={product.image} 
          alt={product.name} 
          style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
        />
      </div>
      <div style={{ padding: '12px 10px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
        <h3 style={{ fontSize: '12px', fontWeight: '600', color: 'var(--ce-text)', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {product.name}
        </h3>
        
        <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '6px' }}>
          <span style={{ fontSize: '15px', fontWeight: '900', color: '#0f172a' }}>{product.newPrice}</span>
          <span style={{ fontSize: '11px', color: '#94a3b8', textDecoration: 'line-through' }}>{product.oldPrice}</span>
        </div>
        <span style={{ display: 'inline-flex', fontSize: '10px', fontWeight: '900', color: '#059669', background: '#ecfdf5', padding: '4px 6px', borderRadius: '4px', alignSelf: 'flex-start', marginTop: '2px' }}>
          {product.discount}
        </span>
      </div>
    </Link>
  );
}
