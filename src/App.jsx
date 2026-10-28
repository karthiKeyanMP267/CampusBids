import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import Navbar from './components/layout/Navbar';
import Footer from './components/layout/Footer';
import HomePage from './pages/HomePage';
import BrowsePage from './pages/BrowsePage';
import AuctionDetailPage from './pages/AuctionDetailPage';
import CreateListingPage from './pages/CreateListingPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import MyListingsPage from './pages/MyListingsPage';
import MyBidsPage from './pages/MyBidsPage';

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <div className="flex min-h-screen flex-col bg-surface-50 text-surface-900 antialiased selection:bg-brand-500 selection:text-white">
          <Navbar />
          <main className="flex-1">
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/browse" element={<BrowsePage />} />
              <Route path="/auction/:id" element={<AuctionDetailPage />} />
              <Route path="/create" element={<CreateListingPage />} />
              <Route path="/my-listings" element={<MyListingsPage />} />
              <Route path="/my-bids" element={<MyBidsPage />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />
              <Route path="*" element={<NotFoundPage />} />
            </Routes>
          </main>
          <Footer />
        </div>
      </AuthProvider>
    </BrowserRouter>
  );
}

function NotFoundPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-24 text-center animate-fade-in">
      <h1 className="text-6xl font-extrabold text-surface-200">404</h1>
      <h2 className="mt-4 text-xl font-bold text-surface-900">Page not found</h2>
      <p className="mt-2 text-surface-500">The page you're looking for doesn't exist.</p>
    </div>
  );
}
