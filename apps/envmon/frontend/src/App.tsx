import { EMProvider } from '~/context/EMContext';
import AppShell from '~/components/layout/AppShell';
import { ErrorBoundary } from '@connectio/shared-ui';
import { I18nProvider } from '@connectio/shared-frontend-i18n';
import { PlantProvider } from '@connectio/shared-app-context';
import enResources from './i18n/locales/en.json';

const loadResource = async (lang: string) => {
  return (await import(`./i18n/locales/${lang}.json`)).default;
};

export default function App() {
  return (
    <ErrorBoundary>
      <I18nProvider 
        appName="envmon" 
        resources={{ en: enResources }}
        loadResource={loadResource}
      >
        <PlantProvider appName="envmon" apiEndpoint="/api/em/plants?days=30" requireSelection={false}>
          <EMProvider>
            <AppShell />
          </EMProvider>
        </PlantProvider>
      </I18nProvider>
    </ErrorBoundary>
  );
}
