import Header from '@/components/Header'
import Footer from '@/components/Footer';
import HelpPage from '@/pages/HelpPage';
import { HashRouter, Routes, Route } from 'react-router-dom';

import './App.css'
import HomePage from './pages/HomePage';
import NotFoundPage from './pages/NotFoundPage';

function App() {
  return (
    <HashRouter>
      <div className="w-full">
        <div className="flex flex-col min-h-screen w-full">
          <Header />
          <main className="flex-1 bg-neutral-700">
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/about" element={<div>Hello, about</div>} />
              <Route path="/help" element={<HelpPage />} />
              <Route path="*" element={<NotFoundPage />} />
            </Routes>
          </main>
          <Footer />
        </div>
      </div>
    </HashRouter>
  )
}

export default App
