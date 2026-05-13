import { queryCatalog } from './queryCatalog';

/**
 * Platform-wide query registry for dashboard data binding.
 *
 * The platform app owns manufacturing-specific query definitions and composes
 * them from business-domain modules so the catalog can scale without pushing
 * SAP-specific knowledge into shared-reporting.
 */
export const dashboardQueryRegistry = queryCatalog;
