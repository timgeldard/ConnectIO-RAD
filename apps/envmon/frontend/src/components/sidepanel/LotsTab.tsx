import { useState } from 'react';
import { useI18n } from '@connectio/shared-frontend-i18n';
import { useLots, useLotDetail } from '~/api/client';
import { useEM } from '~/context/EMContext';
import StatusPill from '~/components/ui/StatusPill';
import type { InspectionLot } from '~/types';

interface Props { plantId: string | null; funcLocId: string; }

/** Expandable row for a single inspection lot — expands to show MIC sub-results. */
function LotRow({ plantId, lot }: { plantId: string | null; lot: InspectionLot }) {
  const { t } = useI18n();
  const [expanded, setExpanded] = useState(false);
  const { data: detail, isLoading } = useLotDetail(plantId, expanded ? lot.lot_id : null);

  const valColor = lot.status === 'FAIL' ? '#F24A00' : lot.status === 'WARNING' ? '#F9C20A' : lot.status === 'PASS' ? '#44CF93' : 'var(--stone-300, #C2C2B2)';
  const valText  = lot.valuation ?? lot.status.slice(0, 1);

  return (
    <>
      <tr onClick={() => setExpanded((v) => !v)} style={{ cursor: 'pointer' }}>
        <td className="num" style={{ fontSize: 11.5 }}>{lot.lot_id}</td>
        <td className="num" style={{ fontSize: 11.5, color: 'var(--fg-muted)' }}>
          {lot.inspection_start_date ?? '—'}
        </td>
        <td><StatusPill status={lot.status} /></td>
        <td>
          <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 20, height: 20, borderRadius: '50%', background: valColor, color: lot.status === 'FAIL' || lot.status === 'PASS' ? 'white' : 'var(--forest)', fontSize: 10, fontWeight: 700 }}>
            {valText}
          </span>
        </td>
      </tr>
      {expanded && (
        <tr>
          <td colSpan={4} style={{ padding: 0, background: 'var(--stone)' }}>
            <div style={{ padding: '12px 14px', fontSize: 12 }}>
              {isLoading && <div style={{ color: 'var(--fg-muted)' }}>{t('envmon.lots.mic.loading')}</div>}
              {detail && detail.mic_results.length === 0 && <div style={{ color: 'var(--fg-muted)' }}>{t('envmon.lots.mic.empty')}</div>}
              {detail && detail.mic_results.length > 0 && (
                <>
                  <div className="eyebrow" style={{ marginBottom: 6 }}>{t('envmon.lots.mic.title')}</div>
                  <table className="tbl" style={{ background: 'white', borderRadius: 4 }}>
                    <thead>
                      <tr>
                        <th>{t('envmon.lots.mic.col.mic')}</th>
                        <th>{t('envmon.lots.mic.col.result')}</th>
                        <th>{t('envmon.lots.mic.col.limit')}</th>
                        <th>{t('envmon.lots.mic.col.val')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detail.mic_results.map((mic) => {
                        const mColor = mic.valuation === 'R' ? '#F24A00' : mic.valuation === 'A' ? '#44CF93' : mic.valuation === 'W' ? '#F9C20A' : 'var(--fg-muted)';
                        return (
                          <tr key={mic.mic_id}>
                            <td style={{ fontSize: 11.5 }}>{mic.mic_name}</td>
                            <td className="num" style={{ fontSize: 11.5 }}>{mic.result_value ?? '—'}</td>
                            <td className="num" style={{ fontSize: 11.5, color: 'var(--fg-muted)' }}>{mic.upper_limit ?? '—'}</td>
                            <td>
                              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700, color: mColor }}>
                                {mic.valuation ?? '?'}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

/** List of inspection lots for the selected functional location within the active time window. */
export default function LotsTab({ plantId, funcLocId }: Props) {
  const { t } = useI18n();
  const { timeWindow } = useEM();
  const { data: lots = [], isLoading } = useLots(plantId, funcLocId, timeWindow);

  if (isLoading) {
    return <div style={{ color: 'var(--fg-muted)', fontSize: 12, padding: '8px 0' }}>{t('envmon.lots.loading')}</div>;
  }

  if (lots.length === 0) {
    return <div style={{ color: 'var(--fg-muted)', fontSize: 12, padding: '8px 0' }}>{t('envmon.lots.empty')}</div>;
  }

  return (
    <div>
      <div className="eyebrow" style={{ marginBottom: 8 }}>{t('envmon.lots.title')}</div>
      <table className="tbl" style={{ background: 'white', borderRadius: 4 }}>
        <thead>
          <tr>
            <th>{t('envmon.lots.col.lot')}</th>
            <th>{t('envmon.lots.col.date')}</th>
            <th>{t('envmon.lots.col.status')}</th>
            <th>{t('envmon.lots.col.val')}</th>
          </tr>
        </thead>
        <tbody>
          {lots.map((lot) => <LotRow key={lot.lot_id} plantId={plantId} lot={lot} />)}
        </tbody>
      </table>
    </div>
  );
}
