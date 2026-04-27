import React from 'react';
import { I18nProvider, LanguageSelector, useI18n } from '@connectio/shared-frontend-i18n';
import { Icon } from './Primitives.jsx';
import { usePlantSelection } from '../context/PlantContext.jsx';
import resources from '../i18n/resources.json';

/* Sidebar + Top bar */
const NAV = [
  { id: 'today', labelKey: 'warehouse.nav.today', icon: 'dashboard', sectionKey: 'warehouse.section.today' },
  { id: 'staging', labelKey: 'warehouse.nav.staging', icon: 'factory', sectionKey: 'warehouse.section.operations', badge: '8', badgeTone: 'is-red' },
  { id: 'inbound', labelKey: 'warehouse.nav.inbound', icon: 'truckIn', sectionKey: 'warehouse.section.operations', badge: '3', badgeTone: 'is-amber' },
  { id: 'outbound', labelKey: 'warehouse.nav.outbound', icon: 'truckOut', sectionKey: 'warehouse.section.operations', badge: '5', badgeTone: 'is-red' },
  { id: 'inventory', labelKey: 'warehouse.nav.inventory', icon: 'boxes', sectionKey: 'warehouse.section.operations' },
  { id: 'dispensary', labelKey: 'warehouse.nav.dispensary', icon: 'scale', sectionKey: 'warehouse.section.operations' },
  { id: 'exceptions', labelKey: 'warehouse.nav.exceptions', icon: 'alert', sectionKey: 'warehouse.section.risk', badge: '44', badgeTone: 'is-slate' },
  { id: 'performance', labelKey: 'warehouse.nav.performance', icon: 'chart', sectionKey: 'warehouse.section.analytics' },
  { id: 'docs', labelKey: 'warehouse.nav.docs', icon: 'flag', sectionKey: 'warehouse.section.docs' },
];

const SidebarContent = ({ current, onNav, shift }) => {
  const { t } = useI18n();
  const { selectedPlant } = usePlantSelection();
  let lastSection = null;
  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <img src="assets/kerry-logo-white.png" alt="Kerry"/>
        <div className="sidebar-brand-label nav-label">{t('warehouse.brand')}</div>
      </div>
      <div className="sidebar-site">
        <div>
          <div className="sidebar-site-name nav-label">{selectedPlant.plant_name || t('warehouse.site.name')}</div>
          <div className="sidebar-site-meta nav-label">{selectedPlant.plant_id} · WH NS01 · {shift.id}</div>
        </div>
      </div>
      <nav className="sidebar-nav">
        {NAV.map((n) => {
          const showSection = n.sectionKey !== lastSection;
          lastSection = n.sectionKey;
          return (
            <React.Fragment key={n.id}>
              {showSection && <div className="nav-section-label nav-label">{t(n.sectionKey)}</div>}
              <button className={`nav-item ${current === n.id ? 'is-active' : ''}`} onClick={() => onNav(n.id)} title={t(n.labelKey)}>
                <Icon name={n.icon} size={18}/>
                <span className="nav-label">{t(n.labelKey)}</span>
                {n.badge && <span className={`nav-item-badge ${n.badgeTone || ''}`}>{n.badge}</span>}
              </button>
            </React.Fragment>
          );
        })}
      </nav>
      <div className="sidebar-footer">
        <div className="avatar">NM</div>
        <div className="nav-label" style={{ lineHeight: 1.2 }}>
          <div className="sidebar-user-name">{t('warehouse.user.name')}</div>
          <div className="sidebar-user-role">{t('warehouse.user.role')}</div>
        </div>
      </div>
    </aside>
  );
};

const TopBarContent = ({ title, subtitle, onSearch, onMobileNav }) => {
  const { t } = useI18n();
  const { plants, selectedPlantId, setSelectedPlantId, loading } = usePlantSelection();
  return (
    <header className="topbar">
      <button className="icon-btn" onClick={onMobileNav} style={{ display: 'none' }} id="mobile-menu-btn">
        <Icon name="menu" size={20}/>
      </button>
      <div>
        <div className="topbar-title">{title}</div>
        {subtitle && <div className="topbar-sub">{subtitle}</div>}
      </div>
      <div className="topbar-spacer"/>
      <label className="plant-select" title={t('warehouse.plant.selector')}>
        <Icon name="factory" size={15}/>
        <select
          aria-label={t('warehouse.plant.selector')}
          value={selectedPlantId}
          disabled={loading || plants.length < 2}
          onChange={(event) => setSelectedPlantId(event.target.value)}
        >
          {plants.map((plant) => (
            <option key={plant.plant_id} value={plant.plant_id}>
              {plant.plant_name && plant.plant_name !== plant.plant_id
                ? `${plant.plant_name} · ${plant.plant_id}`
                : plant.plant_id}
            </option>
          ))}
        </select>
      </label>
      <LanguageSelector compact />
      <div className="topbar-search">
        <Icon name="search" size={15}/>
        <input placeholder={t('warehouse.search.placeholder')} onChange={(e) => onSearch?.(e.target.value)}/>
        <span className="kbd">⌘K</span>
      </div>
      <button className="icon-btn" title={t('warehouse.action.refresh')}>
        <Icon name="refresh" size={18}/>
      </button>
      <button className="icon-btn" title={t('warehouse.action.notifications')}>
        <Icon name="bell" size={18}/>
        <span className="icon-btn-dot"/>
      </button>
      <button className="icon-btn" title={t('warehouse.action.settings')}>
        <Icon name="settings" size={18}/>
      </button>
    </header>
  );
};

const MobileNavContent = ({ current, onNav }) => {
  const { t } = useI18n();
  const [moreOpen, setMoreOpen] = React.useState(false);
  const primary = ['today', 'staging', 'outbound', 'exceptions'];
  const primaryItems = NAV.filter((n) => primary.includes(n.id));
  const secondaryItems = NAV.filter((n) => !primary.includes(n.id));
  const activeInSecondary = secondaryItems.some((n) => n.id === current);
  return (
    <>
      <nav className="mobile-nav">
        {primaryItems.map((n) => (
          <button key={n.id} className={`mobile-nav-item ${current === n.id ? 'is-active' : ''}`}
            onClick={() => { setMoreOpen(false); onNav(n.id); }}>
            <Icon name={n.icon} size={18}/>
            <span>{t(n.labelKey).split(' ')[0]}</span>
            {n.badge && <span className={`mobile-nav-badge ${n.badgeTone || ''}`}>{n.badge}</span>}
          </button>
        ))}
        <button className={`mobile-nav-item ${activeInSecondary ? 'is-active' : ''}`}
          onClick={() => setMoreOpen((v) => !v)}>
          <Icon name="menu" size={18}/>
          <span>{t('warehouse.nav.more')}</span>
        </button>
      </nav>
      {moreOpen && (
        <>
          <div className="mobile-more-backdrop" onClick={() => setMoreOpen(false)}/>
          <div className="mobile-more-sheet">
            <div className="mobile-more-title">{t('warehouse.nav.navigate')}</div>
            {secondaryItems.map((n) => (
              <button key={n.id} className={`mobile-more-item ${current === n.id ? 'is-active' : ''}`}
                onClick={() => { setMoreOpen(false); onNav(n.id); }}>
                <Icon name={n.icon} size={16}/>
                <span>{t(n.labelKey)}</span>
                {n.badge && <span className={`nav-item-badge ${n.badgeTone || ''}`} style={{ marginLeft: 'auto' }}>{n.badge}</span>}
              </button>
            ))}
          </div>
        </>
      )}
    </>
  );
};

const withWarehouseI18n = (children) => (
  <I18nProvider appName="warehouse360" resources={resources}>
    {children}
  </I18nProvider>
);

const Sidebar = (props) => withWarehouseI18n(<SidebarContent {...props} />);
const TopBar = (props) => withWarehouseI18n(<TopBarContent {...props} />);
const MobileNav = (props) => withWarehouseI18n(<MobileNavContent {...props} />);


export { Sidebar, TopBar, MobileNav, NAV };
