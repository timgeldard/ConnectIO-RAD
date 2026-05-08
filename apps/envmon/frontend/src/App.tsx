import { EMProvider } from '~/context/EMContext';
import AppShell from '~/components/layout/AppShell';
import ErrorBoundary from '~/components/common/ErrorBoundary';
import { I18nProvider } from '@connectio/shared-frontend-i18n';
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
        <EMProvider>
          <AppShell />
        </EMProvider>
      </I18nProvider>
    </ErrorBoundary>
  );
}
