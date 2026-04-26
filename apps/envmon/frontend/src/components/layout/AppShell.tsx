import React, { useCallback } from 'react';
import { I18nProvider, LanguageSelector, useI18n } from '@connectio/shared-frontend-i18n';
import { useEM } from '~/context/EMContext';
import { usePlants } from '~/api/client';
import PersonaSwitcher, { PERSONAS } from '~/components/ui/PersonaSwitcher';
import { IconSettings } from '~/components/ui/Icons';
import GlobalView from '~/views/GlobalView';
import SiteView from '~/views/SiteView';
import FloorView from '~/views/FloorView';
import CoordinateMapper from '~/components/admin/CoordinateMapper';
import type { ViewState } from '~/types';
import resources from '../../i18n/resources.json';

function AppShellContent() {
  const { t } = useI18n();
  const { view, setView, personaId, setPersonaId, adminMode, setAdminMode } = useEM();
  const { data: plants = [] } = usePlants();

  const isReadOnly = personaId === 'auditor';
  const isAdmin = personaId === 'admin';

  const currentPlant = plants.find((p) => p.plant_id === view.plantId) ?? plants[0] ?? null;

  const handlePersonaChange = (id: typeof personaId) => {
    setPersonaId(id);
    const p = PERSONAS.find((x) => x.id === id)!;
    if (p.defaultView === 'admin') {
      setAdminMode(true);
      setView({ level: 'admin', plantId: view.plantId, floorId: view.floorId });
    } else {
      setAdminMode(false);
      setView({ level: p.defaultView as ViewState['level'], plantId: view.plantId, floorId: view.floorId });
    }
  };

  const navToGlobal = useCallback(() => setView({ level: 'global', plantId: null, floorId: null }), [setView]);
  const navToSite = useCallback((plantId: string) => setView({ level: 'site', plantId, floorId: null }), [setView]);
  const navToFloor = useCallback((plantId: string, floorId: string) => setView({ level: 'floor', plantId, floorId }), [setView]);

  // Breadcrumbs
  const crumbs: React.ReactNode[] = [];
  if (view.level !== 'global') {
    crumbs.push(
      <button key="all" className="btn btn-ghost btn-sm"
        style={{ color: 'rgba(255,255,255,0.75)', borderColor: 'transparent', padding: '2px 6px' }}
        onClick={navToGlobal}>{t('envmon.nav.allPlants')}</button>,
      <span key="s1" className="sep">/</span>,
    );
  }
  if ((view.level === 'floor' || view.level === 'site') && currentPlant) {
    crumbs.push(
      <button key="site" className="btn btn-ghost btn-sm"
        style={{ color: 'rgba(255,255,255,0.75)', borderColor: 'transparent', padding: '2px 6px' }}
        onClick={() => navToSite(currentPlant.plant_id)}>
        {currentPlant.plant_code} {currentPlant.plant_name}
      </button>,
    );
  }
  if (view.level === 'floor' && view.floorId) {
    crumbs.push(
      <span key="s2" className="sep">/</span>,
      <span key="floor" className="cur">{view.floorId}</span>,
    );
  }
  if (view.level === 'admin') {
    crumbs.push(<span key="admin" className="cur">{t('envmon.nav.adminMapper')}</span>);
  }

  return (
    <div className="app">
      {/* Topbar */}
      <header className="topbar">
        <span className="product">
          EnvMon
          <span className="tag">{t('envmon.product.tag')}</span>
        </span>
        <span className="divider" />
        <nav className="crumbs">
          {crumbs.length > 0 ? crumbs : <span className="cur">{t('envmon.nav.portfolio')}</span>}
        </nav>
        <div className="right">
          <LanguageSelector compact />
          {isReadOnly && (
            <span className="readonly-banner" style={{ fontSize: 11, padding: '3px 10px', borderRadius: 4 }}>
              {t('envmon.readonly')}
            </span>
          )}
          {isAdmin && (
            <button
              className={`btn btn-sm${adminMode ? ' btn-primary' : ' btn-ghost'}`}
              style={{ borderColor: adminMode ? undefined : 'rgba(255,255,255,0.3)', color: adminMode ? undefined : 'white' }}
              onClick={() => {
                const next = !adminMode;
                setAdminMode(next);
                setView({ level: next ? 'admin' : 'global', plantId: view.plantId, floorId: view.floorId });
              }}
            >
              <IconSettings size={13} />
              {adminMode ? t('envmon.action.exitAdmin') : t('envmon.action.admin')}
            </button>
          )}
          <PersonaSwitcher personaId={personaId} onChange={handlePersonaChange} />
        </div>
      </header>

      {/* Main content area */}
      <main className="main">
        {adminMode || view.level === 'admin' ? (
          <CoordinateMapper />
        ) : view.level === 'floor' && view.plantId && view.floorId ? (
          <FloorView
            plantId={view.plantId}
            floorId={view.floorId}
            personaId={personaId}
            onBack={navToGlobal}
            onBackToSite={() => navToSite(view.plantId!)}
            onChangeFloor={(fid) => navToFloor(view.plantId!, fid)}
          />
        ) : view.level === 'site' && currentPlant ? (
          <SiteView
            plant={currentPlant}
            onOpenFloor={(fid) => navToFloor(currentPlant.plant_id, fid)}
            onBack={navToGlobal}
          />
        ) : (
          <GlobalView
            plants={plants}
            onOpenPlant={navToSite}
          />
        )}
      </main>
    </div>
  );
}

export default function AppShell() {
  return (
    <I18nProvider appName="envmon" resources={resources}>
      <AppShellContent />
    </I18nProvider>
  );
}
