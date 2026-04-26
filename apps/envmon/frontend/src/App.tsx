import { EMProvider } from '~/context/EMContext';
import AppShell from '~/components/layout/AppShell';
import ErrorBoundary from '~/components/common/ErrorBoundary';
import { I18nProvider } from '@connectio/shared-frontend-i18n';
import resources from './i18n/resources.json';

export default function App() {
  return (
    <ErrorBoundary>
      <I18nProvider appName="envmon" resources={resources}>
        <EMProvider>
          <AppShell />
        </EMProvider>
      </I18nProvider>
    </ErrorBoundary>
  );
}
