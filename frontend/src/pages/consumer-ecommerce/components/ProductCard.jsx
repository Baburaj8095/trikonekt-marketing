export default function ProductCard({ product }) {
  const discountText = product.discount.toLowerCase();
  const percentage = discountText.split(' ')[0] || '50%';

  return (
    <article 
      className="ce-product-card" 
      style={{ 
        flex: '0 0 150px', 
        borderRadius: '20px',
        overflow: 'hidden',
        position: 'relative',
        boxShadow: '0 8px 20px rgba(15, 23, 42, 0.06)',
        border: '1px solid rgba(15, 23, 42, 0.05)',
        background: '#fff',
        textDecoration: 'none',
        display: 'flex',
        flexDirection: 'column'
      }}
    >
      <div style={{ position: 'relative', width: '100%', height: '140px' }}>
        <img 
          src={product.image} 
          alt={product.name} 
          style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
        />
        {/* Premium Corner Discount Badge */}
        <div 
          style={{ 
            position: 'absolute', 
            top: 0, 
            left: 0, 
            width: '64px', 
            height: '64px', 
            background: 'linear-gradient(135deg, #f43f5e, #e11d48)',
            borderBottomRightRadius: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-start',
            justifyContent: 'flex-start',
            padding: '10px 0 0 10px',
            boxShadow: '2px 2px 10px rgba(225, 29, 72, 0.3)'
          }}
        >
          <span style={{ fontSize: '15px', fontWeight: '900', color: '#fff', lineHeight: '1' }}>
            {percentage}
          </span>
          <span style={{ fontSize: '10px', fontWeight: '800', color: 'rgba(255,255,255,0.9)', marginTop: '2px', letterSpacing: '0.05em' }}>
            OFF
          </span>
        </div>
      </div>
      
      <div style={{ padding: '12px 12px 14px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
        <h3 style={{ fontSize: '13px', fontWeight: '800', color: 'var(--ce-text)', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {product.name}
        </h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '15px', fontWeight: '900', color: '#071327', letterSpacing: '-0.02em' }}>{product.newPrice}</span>
          <span style={{ fontSize: '11px', color: 'var(--ce-muted)', textDecoration: 'line-through', fontWeight: '600' }}>{product.oldPrice}</span>
        </div>
      </div>
    </article>
  );
}
