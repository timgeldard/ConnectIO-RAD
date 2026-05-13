import type { QueryRegistry } from '@connectio/shared-reporting';
import { inventoryQueries } from './inventoryQueries';
import { pohQueries } from './pohQueries';
import { procurementQueries } from './procurementQueries';
import { qualityQueries } from './qualityQueries';
import { salesQueries } from './salesQueries';
import { spcQueries } from './spcQueries';
import { traceQueries } from './traceQueries';
import { wmQueries } from './wmQueries';

/**
 * Platform-owned manufacturing query catalog grouped by business domain.
 *
 * Query keys must be unique across all domain registries. Because the catalog
 * is composed via object spread, later entries would silently overwrite earlier
 * ones if a duplicate key slipped in.
 */
export const queryCatalog: QueryRegistry = {
  ...pohQueries,
  ...qualityQueries,
  ...spcQueries,
  ...traceQueries,
  ...wmQueries,
  ...inventoryQueries,
  ...procurementQueries,
  ...salesQueries,
};

export { inventoryQueries } from './inventoryQueries';
export { pohQueries } from './pohQueries';
export { procurementQueries } from './procurementQueries';
export { qualityQueries } from './qualityQueries';
export { salesQueries } from './salesQueries';
export { spcQueries } from './spcQueries';
export { traceQueries } from './traceQueries';
export { wmQueries } from './wmQueries';
