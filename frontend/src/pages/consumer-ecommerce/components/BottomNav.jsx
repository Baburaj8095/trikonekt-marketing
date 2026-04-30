import { NavLink } from 'react-router-dom';
import { FaHouse, FaGlobe, FaQrcode, FaGift, FaEllipsis } from 'react-icons/fa6';

const tabs = [
  { label: 'Home', icon: FaHouse, to: '/consumer-ecommerce' },
  { label: 'Online', icon: FaGlobe, to: '/consumer-ecommerce/delivery' },
  { label: 'Scanner', icon: FaQrcode, to: '/consumer-ecommerce/scanner' },
  { label: 'Tri Zone', icon: FaGift, to: '/consumer-ecommerce/tri-zone' },
  { label: 'More', icon: FaEllipsis, to: '/consumer-ecommerce/more' },
];

export default function BottomNav() {
  return (
    <nav className="ce-bottom-nav">
      <div className="ce-bottom-inner">
        {tabs.map(({ label, icon: Icon, to }) => (
          <NavLink
            key={label}
            to={to}
            end={to === '/consumer-ecommerce'}
            className={({ isActive }) =>
              `ce-bottom-tab ${isActive ? 'ce-bottom-tab-active' : ''}`
            }
          >
            <Icon className="ce-bottom-icon" />
            {label}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
