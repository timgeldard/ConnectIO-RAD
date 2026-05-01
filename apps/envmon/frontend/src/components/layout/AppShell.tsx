import React, { useCallback, useMemo } from 'react';
import { LanguageSelector, useI18n } from '@connectio/shared-frontend-i18n';
import {
  AppShell as SharedAppShell,
  Sidebar,
  TopBar,
  Icon,
  type NavGroup,
  type Breadcrumb
} from '@connectio/shared-ui';
import { useEM } from '~/context/EMContext';
import { usePlants } from '~/api/client';
import PersonaSwitcher, { PERSONAS } from '~/components/ui/PersonaSwitcher';
import GlobalView from '~/views/GlobalView';
import SiteView from '~/views/SiteView';
import FloorView from '~/views/FloorView';
import CoordinateMapper from '~/components/admin/CoordinateMapper';
import type { ViewState } from '~/types';

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
  const breadcrumbs: Breadcrumb[] = useMemo(() => {
    const crumbs: Breadcrumb[] = [];
    if (view.level === 'global') {
      crumbs.push({ label: t('envmon.nav.portfolio'), icon: 'home' });
    } else {
      crumbs.push({ label: t('envmon.nav.allPlants'), icon: 'home', onClick: navToGlobal });
    }

    if ((view.level === 'floor' || view.level === 'site') && currentPlant) {
      crumbs.push({
        label: `${currentPlant.plant_code} ${currentPlant.plant_name}`,
        onClick: () => navToSite(currentPlant.plant_id)
      });
    }

    if (view.level === 'floor' && view.floorId) {
      crumbs.push({ label: view.floorId });
    }

    if (view.level === 'admin') {
      crumbs.push({ label: t('envmon.nav.adminMapper'), icon: 'settings' });
    }

    return crumbs;
  }, [view, currentPlant, t, navToGlobal, navToSite]);

  const navGroups: NavGroup[] = useMemo(() => [
    {
      label: t('envmon.nav.portfolio'),
      items: [
        { id: 'global', label: t('envmon.nav.allPlants'), icon: 'grid' }
      ]
    },
    {
      label: currentPlant ? `${currentPlant.plant_code} Sites` : 'Sites',
      items: plants.slice(0, 8).map(p => ({
        id: `site-${p.plant_id}`,
        label: p.plant_name,
        icon: 'factory' as const
      }))
    }
  ], [t, currentPlant, plants]);

  return (
    <SharedAppShell
      sidebar={
        <Sidebar
          appTag="Quality"
          brandName="Kerry"
          groups={navGroups}
          activeId={view.level === 'global' ? 'global' : `site-${view.plantId}`}
          onNavigate={(id) => {
            if (id === 'global') navToGlobal();
            else if (id.startsWith('site-')) navToSite(id.replace('site-', ''));
          }}
          footer={
            <div className="app-sidebar-footer">
              <div className="asf-avatar">EM</div>
              <div className="asf-text">
                <div className="asf-name">
                  EnvMon {personaId}
                </div>
              </div>
            </div>
          }
        />
      }
      topbar={
        <TopBar
          breadcrumbs={breadcrumbs}
          actions={
            <>
              <LanguageSelector compact />
              {isReadOnly && (
                <span className="readonly-banner" style={{ fontSize: 11, padding: '3px 10px', borderRadius: 4, background: 'var(--surface-sunken)', color: 'var(--text-3)' }}>
                  {t('envmon.readonly')}
                </span>
              )}
              {isAdmin && (
                <button
                  className={`btn btn-sm${adminMode ? ' btn-primary' : ' btn-ghost'}`}
                  style={{ display: 'flex', alignItems: 'center', gap: 6 }}
                  onClick={() => {
                    const next = !adminMode;
                    setAdminMode(next);
                    setView({ level: next ? 'admin' : 'global', plantId: view.plantId, floorId: view.floorId });
                  }}
                >
                  <Icon name="settings" size={13} />
                  {adminMode ? t('envmon.action.exitAdmin') : t('envmon.action.admin')}
                </button>
              )}
              <PersonaSwitcher personaId={personaId} onChange={handlePersonaChange} />
            </>
          }
        />
      }
    >
      <div style={{ height: '100%' }}>
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
            onOpenPlant={navToSite}
          />
        )}
      </div>
    </SharedAppShell>
  );
}

export default function AppShell() {
  return (
    <I18nProvider appName="envmon" resources={resources}>
      <AppShellContent />
    </I18nProvider>
  );
}
