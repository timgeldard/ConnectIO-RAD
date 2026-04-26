import { useCallback, useMemo, useState } from 'react';
import { useI18n } from '@connectio/shared-frontend-i18n';
import EnvMonGlobalMap from '~/map/EnvMonGlobalMap';
import { usePlantMapData } from '~/map/usePlantMapData';
import KPI from '~/components/ui/KPI';
import type { PlantInfo } from '~/types';

interface Props {
  plants: PlantInfo[];
  onOpenPlant: (plantId: string) => void;
}

const REGIONS = ['ALL', 'EMEA', 'AMER', 'APMEA'];

/** Portfolio-level view showing risk map, KPI strip, and plant ranking list. */
export default function GlobalView({ plants, onOpenPlant }: Props) {
  const { t } = useI18n();
  const [region, setRegion] = useState('ALL');
  const [sortBy, setSortBy] = useState<'risk' | 'fails' | 'rate' | 'name'>('risk');

  const { featureCollection, sortedPlants, scopedPlants } = usePlantMapData(
    plants,
    region,
    sortBy,
  );

  const handleOpenPlant = useCallback(
    (plantId: string) => onOpenPlant(plantId),
    [onOpenPlant],
  );

  const totals = useMemo(() => {
    const totalLocs = scopedPlants.reduce((a, p) => a + p.kpis.total_locs, 0) || 1;
    return {
      plants: scopedPlants.length,
      active_fails: scopedPlants.reduce((a, p) => a + p.kpis.active_fails, 0),
      warnings: scopedPlants.reduce((a, p) => a + p.kpis.warnings, 0),
      pass_rate:
        scopedPlants.reduce((a, p) => a + p.kpis.pass_rate * p.kpis.total_locs, 0) / totalLocs,
      lots_tested: scopedPlants.reduce((a, p) => a + p.kpis.lots_tested, 0),
      lots_planned: scopedPlants.reduce(
        (a, p) => a + (p.kpis.lots_planned || p.kpis.lots_tested),
        0,
      ),
      pathogen_hits: scopedPlants.reduce((a, p) => a + p.kpis.pathogen_hits, 0),
    };
  }, [scopedPlants]);

  return (
    <div className="scroll-y" style={{ height: '100%', padding: '20px 28px 40px' }}>
      {/* Header */}
      <div
        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 20 }}
      >
        <div>
          <div className="eyebrow">{t('envmon.global.eyebrow')}</div>
          <h1 className="h-display" style={{ margin: '6px 0 0', fontSize: 32 }}>
            {t(totals.plants === 1 ? 'envmon.global.title.one' : 'envmon.global.title.other', { n: totals.plants })}
          </h1>
          <div style={{ fontSize: 13, color: 'var(--fg-muted)', marginTop: 6 }}>
            {t('envmon.global.subtitle')}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {REGIONS.map((r) => (
            <button
              key={r}
              className={`chip${region === r ? ' active' : ''}`}
              onClick={() => setRegion(r)}
            >
              {r === 'ALL' ? t('envmon.global.allRegions') : r}
            </button>
          ))}
        </div>
      </div>

      {/* KPI strip */}
      <div
        style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, marginBottom: 20 }}
      >
        <KPI label={t('envmon.global.kpi.activeFails')} value={totals.active_fails} accent="fail" />
        <KPI label={t('envmon.global.kpi.trendingWarn')} value={totals.warnings} accent="warn" />
        <KPI label={t('envmon.global.kpi.passRate')} value={totals.pass_rate.toFixed(1)} unit="%" accent="ok" />
        <KPI
          label={t('envmon.global.kpi.lotsTested')}
          value={totals.lots_tested}
          unit={`/ ${totals.lots_planned}`}
          accent="info"
        />
        <KPI label={t('envmon.global.kpi.pathogenHits')} value={totals.pathogen_hits} accent="fail" />
      </div>

      <div
        style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 16, marginBottom: 20 }}
      >
        {/* Map card */}
        <div className="card" style={{ padding: 0, position: 'relative' }}>
          <div className="card-hd">
            <div>
              <h3>{t('envmon.global.map.title')}</h3>
              <div style={{ fontSize: 11.5, color: 'var(--fg-muted)', marginTop: 2 }}>
                {t('envmon.global.map.subtitle')}
              </div>
            </div>
            <div className="legend">
              <span className="item">
                <span className="sw" style={{ background: 'var(--sunset)' }} />{t('envmon.global.legend.high')}
              </span>
              <span className="item">
                <span className="sw" style={{ background: 'var(--sunrise)' }} />{t('envmon.global.legend.medium')}
              </span>
              <span className="item">
                <span className="sw" style={{ background: 'var(--jade)' }} />{t('envmon.global.legend.low')}
              </span>
            </div>
          </div>
          <div style={{ height: 320, borderRadius: '0 0 8px 8px', overflow: 'hidden' }}>
            <EnvMonGlobalMap
              featureCollection={featureCollection}
              plants={scopedPlants}
              selectedPlantId={null}
              onOpenPlant={handleOpenPlant}
            />
          </div>
        </div>

        {/* Plant ranking list */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div className="eyebrow">{t('envmon.global.ranking')}</div>
            <div style={{ display: 'flex', gap: 4 }}>
              {(['risk', 'fails', 'rate', 'name'] as const).map((s) => (
                <button
                  key={s}
                  className={`chip${sortBy === s ? ' active' : ''}`}
                  style={{ fontSize: 11, padding: '2px 8px' }}
                  onClick={() => setSortBy(s)}
                >
                  {s === 'risk'
                    ? t('envmon.global.sort.risk')
                    : s === 'fails'
                    ? t('envmon.global.sort.fails')
                    : s === 'rate'
                    ? t('envmon.global.sort.rate')
                    : t('envmon.global.sort.name')}
                </button>
              ))}
            </div>
          </div>
          <div className="scroll-y" style={{ flex: 1 }}>
            {sortedPlants.map((p) => (
              <PlantCard key={p.plant_id} plant={p} onClick={() => onOpenPlant(p.plant_id)} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/** Individual plant card in the ranking list — shows risk indicator and KPI summary row. */
function PlantCard({ plant, onClick }: { plant: PlantInfo; onClick: () => void }) {
  const { kpis } = plant;
  const riskCol =
    kpis.active_fails > 0
      ? 'var(--sunset)'
      : kpis.warnings > 0
      ? 'var(--sunrise)'
      : 'var(--jade)';
  return (
    <button
      className="card"
      onClick={onClick}
      style={{
        width: '100%',
        textAlign: 'left',
        cursor: 'pointer',
        padding: '12px 16px',
        marginBottom: 8,
        display: 'flex',
        alignItems: 'center',
        gap: 12,
      }}
    >
      <div
        style={{ width: 4, alignSelf: 'stretch', borderRadius: 2, background: riskCol, flexShrink: 0 }}
      />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <div style={{ fontWeight: 600, fontSize: 14 }}>
            {plant.plant_code} · {plant.plant_name}
          </div>
          <div className="mono" style={{ fontSize: 11.5, color: 'var(--fg-muted)' }}>
            {plant.country}
          </div>
        </div>
        <div style={{ fontSize: 12, color: 'var(--fg-muted)', marginTop: 2 }}>
          {plant.city ?? plant.product}
        </div>
        <div
          style={{ display: 'flex', gap: 12, marginTop: 8, fontFamily: 'var(--font-mono)', fontSize: 11 }}
        >
          <span
            style={{
              color: kpis.active_fails > 0 ? 'var(--sunset)' : 'var(--fg-muted)',
              fontWeight: 600,
            }}
          >
            {kpis.active_fails} FAIL
          </span>
          <span style={{ color: kpis.warnings > 0 ? 'var(--sunrise)' : 'var(--fg-muted)' }}>
            {kpis.warnings} WARN
          </span>
          <span>{kpis.pass_rate.toFixed(1)}% pass</span>
          <span style={{ color: 'var(--fg-muted)' }}>{kpis.total_locs} pts</span>
        </div>
      </div>
    </button>
  );
}
