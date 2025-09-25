import { Link, Outlet, useLocation, useOutlet } from 'react-router-dom'
import { createContext, Dispatch, SetStateAction, useEffect, useState } from 'react'
import '../styles/app.scss'
import CacheBuster from 'react-cache-buster'
import { version } from '../../package.json'


export default function App() {
  const location = useLocation().key;
  const [isPageLoaded, setIsPageLoaded] = useState(false);
  const [showLoading, setShowLoading] = useState(false);
  const hasLoaded = isPageLoaded;

  useEffect(() => {
    return () => {
      setIsPageLoaded(false);
    };
  }, [location]);

  const loading = (hasLoaded: boolean) => (
    <div id="loading" className={hasLoaded ? 'loaded' : 'loading'}>
      <div className="lds-ripple">
        <div></div>
        <div></div>
      </div>
      <span className="scanline"></span>
    </div>
  );

  return (
    <CacheBuster
      currentVersion={version}
      isEnabled={process.env.NODE_ENV === 'production'}
      reloadOnDowngrade={true}
      isVerboseMode={true}
      loadingComponent={loading(hasLoaded)}
    >
      {showLoading && loading(hasLoaded)}
      <LoadingContext.Provider value={{ isPageLoaded, setIsPageLoaded }}>
        <div className="app-shell">
          <Outlet />
        </div>
      </LoadingContext.Provider>
    </CacheBuster>
  );
}

export const LoadingContext = createContext({} as { isPageLoaded: boolean, setIsPageLoaded: Dispatch<SetStateAction<boolean>> })