import { categories } from '../services/mockData.js';

export default function CategoryCarousel() {
  return (
    <section>
      <h2 className="ce-section-title">Categories</h2>
      <div className="ce-horizontal-scroll">
        {categories.map(({ label, icon: Icon }) => (
          <button key={label} className="ce-category-card">
            <span className="ce-category-icon">
              <Icon />
            </span>
            <span className="ce-category-label">{label}</span>
          </button>
        ))}
      </div>
    </section>
  );
}
