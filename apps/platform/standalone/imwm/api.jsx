// api.jsx — Live data fetch layer for the IMWM cockpit.
// Normalises API column names to the mock field names used by all view components
// so the view components require no changes when switching from mock to live data.
//
// All functions return { data: [...], error: string|null }.
// Set window.USE_MOCK_DATA = true to skip fetching and use data.jsx globals.

const _BASE = "/api/wh";

async function _get(path) {
  try {
    const res = await fetch(path);
    if (!res.ok) return { data: null, error: `HTTP ${res.status}` };
    return { data: await res.json(), error: null };
  } catch (e) {
    return { data: null, error: String(e) };
  }
}

// ── Stock rows ──────────────────────────────────────────────────────────────
// Map view output columns → mock field names used by overview/im/recon/wm views

function normaliseStockRow(r) {
  return {
    // identifiers
    id:           r.material_id + '|' + r.plant_id + '|' + r.storage_loc,
    material:     r.material_id,
    desc:         r.material_name,
    mtype:        r.material_type,
    uom:          r.uom,
    // location
    plant:        r.plant_id,
    plantName:    r.plant_name,
    storageLoc:   r.storage_loc,
    storageLocName: r.storage_loc_name,
    // stock types
    unrestricted: r.unrestricted_qty ?? 0,
    qi:           r.qi_qty ?? 0,
    blocked:      r.blocked_qty ?? 0,
    restricted:   r.restricted_qty ?? 0,
    interim:      r.interim_qty ?? 0,
    // totals
    im_total:     r.im_total_qty ?? 0,
    wm_total:     r.wm_total_qty ?? 0,
    delta:        r.delta_qty ?? 0,
    // value and classification
    value_eur:    r.inventory_value_eur ?? 0,
    batches:      r.batch_count ?? 0,
    open_tos:     r.open_tos ?? 0,
    mismatch_kind: r.mismatch_kind,
    mismatch_age_h: 0,  // not tracked in view; retained for component compatibility
    abc:          r.abc_class,
    xyz:          null,
  };
}

async function loadStock(plant) {
  const url = plant ? `${_BASE}/imwm/stock?plant=${encodeURIComponent(plant)}` : `${_BASE}/imwm/stock`;
  const { data, error } = await _get(url);
  if (error) return { data: null, error };
  return { data: (data.stock ?? []).map(normaliseStockRow), error: null };
}

// ── Movements ───────────────────────────────────────────────────────────────
// Map view output → mock MOVEMENTS shape: { time, code, desc, material, plant, qty, uom, user, doc }

function normaliseMovement(r) {
  return {
    time:     (r.posting_date ?? '') + ' ' + (r.posting_time ?? ''),
    code:     r.movement_type,
    desc:     r.material_name,
    material: r.material_id,
    plant:    r.plant_id,
    sloc:     r.storage_loc,
    qty:      r.quantity ?? 0,
    uom:      r.uom,
    user:     r.username,
    doc:      r.document_number,
    batch:    r.batch_id,
  };
}

async function loadMovements(plant) {
  const url = plant ? `${_BASE}/imwm/movements?plant=${encodeURIComponent(plant)}` : `${_BASE}/imwm/movements`;
  const { data, error } = await _get(url);
  if (error) return { data: null, error };
  return { data: (data.movements ?? []).map(normaliseMovement), error: null };
}

// ── Exceptions ──────────────────────────────────────────────────────────────
// Map view output → mock EXCEPTIONS shape:
// { id, type, material, plant, sloc, severity, sla_h, age_h, owner, status, details }

function normaliseException(r, idx) {
  return {
    id:       `EX-${String(idx + 1).padStart(4, '0')}`,
    type:     r.exception_type,
    material: r.material_id ?? '',
    plant:    r.plant_id ?? '',
    sloc:     r.storage_loc ?? '',
    severity: r.severity,
    sla_h:    r.sla_hours ?? 0,
    age_h:    0,  // view outputs detected_date (day precision); hour age not available in v1
    owner:    'Unassigned',
    status:   'open',
    details:  r.detail_text ?? '',
  };
}

async function loadExceptions(plant) {
  const url = plant ? `${_BASE}/imwm/exceptions?plant=${encodeURIComponent(plant)}` : `${_BASE}/imwm/exceptions`;
  const { data, error } = await _get(url);
  if (error) return { data: null, error };
  return { data: (data.exceptions ?? []).map(normaliseException), error: null };
}

// ── Aging buckets ───────────────────────────────────────────────────────────
// Map view output → mock AGING_BUCKETS shape: { label, value (in €M), color }
// Aggregates across all plants returned (when no plant filter is active).

const _BUCKET_COLORS = {
  '0-30d':   'var(--c-success)',
  '31-60d':  'var(--c-success)',
  '61-90d':  'var(--c-info)',
  '91-180d': 'var(--c-warning)',
  '>180d':   'var(--c-danger)',
};

function normaliseAging(rows) {
  // Aggregate total_value_eur across plants per bucket, preserve order
  const bucketMap = new Map();
  for (const r of rows) {
    const key = r.age_bucket;
    if (!bucketMap.has(key)) {
      bucketMap.set(key, { order: r.age_bucket_order, total: 0 });
    }
    bucketMap.get(key).total += r.total_value_eur ?? 0;
  }
  return [...bucketMap.entries()]
    .sort((a, b) => a[1].order - b[1].order)
    .map(([label, { total }]) => ({
      label,
      value: Math.round(total / 1e4) / 100,  // EUR → €M, 2dp
      color: _BUCKET_COLORS[label] ?? 'var(--c-fg-mute)',
    }));
}

async function loadAging(plant) {
  const url = plant ? `${_BASE}/imwm/analytics/aging?plant=${encodeURIComponent(plant)}` : `${_BASE}/imwm/analytics/aging`;
  const { data, error } = await _get(url);
  if (error) return { data: null, error };
  return { data: normaliseAging(data.aging ?? []), error: null };
}

// ── Bins (existing endpoint — no normalisation needed) ──────────────────────
async function loadBins(plant) {
  const url = plant ? `${_BASE}/inventory/bins?plant_id=${encodeURIComponent(plant)}` : `${_BASE}/inventory/bins`;
  return await _get(url);
}

window.IMWMApi = { loadStock, loadMovements, loadExceptions, loadAging, loadBins };
