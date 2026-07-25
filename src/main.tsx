import React, { lazy, Suspense } from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import './trade-town.css';
import './trade-town-responsive.css';
import 'uplot/dist/uPlot.min.css';
import 'react-toastify/dist/ReactToastify.css';
import ConvexClientProvider from './components/ConvexClientProvider.tsx';
import { hasConvexDeployment } from './components/ConvexClientProvider.tsx';
import DemoApp from './DemoApp.tsx';
import { I18nProvider } from './i18n';

const Home = lazy(() => import('./App.tsx'));

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <I18nProvider>
      {hasConvexDeployment ? (
        <ConvexClientProvider>
          <Suspense fallback={null}>
            <Home />
          </Suspense>
        </ConvexClientProvider>
      ) : (
        <DemoApp />
      )}
    </I18nProvider>
  </React.StrictMode>,
);
