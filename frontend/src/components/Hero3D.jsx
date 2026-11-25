import { Suspense, lazy } from 'react';

// three.js is large, so it is fetched only when a screen with the 3D scene is opened.
const Scene3D = lazy(() => import('./Scene3D'));

export function Hero3D(props) {
  return (
    <Suspense fallback={null}>
      <Scene3D {...props} />
    </Suspense>
  );
}
