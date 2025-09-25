import { Route, createRoutesFromElements } from 'react-router-dom'
import App from './components/App.tsx'
import Home from './components/Home.tsx'
import NotFound from './components/NotFound.tsx'

// import ProtectedRoute from './components/ProtectedRoute.tsx'

export default createRoutesFromElements(
  <>
    <Route path="/" element={<App />}>
      <Route index element={<Home />} />
      <Route path="*" element={<NotFound />} />
    </Route>
  </>,
)
