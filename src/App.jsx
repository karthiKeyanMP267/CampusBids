import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Navbar from './components/layout/Navbar';
import Footer from './components/layout/Footer';
import HomePage from './pages/HomePage';

export default function App() {
  return (
    <BrowserRouter>
      <div className="flex min-h-screen flex-col">
        <Navbar />
        <main className="flex-1">
          <Routes>
            <Route path="/" element={<HomePage />} />
            {/* Placeholder routes — pages will be built in subsequent stages */}
            <Route path="/browse" element={<HomePage />} />
            <Route path="/auction/:id" element={<PlaceholderPage title="Auction Detail" />} />
            <Route path="/create" element={<PlaceholderPage title="Create Listing" />} />
            <Route path="/login" element={<PlaceholderPage title="Sign In" />} />
            <Route path="/register" element={<PlaceholderPage title="Register" />} />
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </main>
        <Footer />
      </div>
    </BrowserRouter>
  );
}

function PlaceholderPage({ title }) {
  return (
    <div className="mx-auto max-w-7xl px-4 py-24 text-center animate-fade-in">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-50 text-brand-600 mb-6">
        <span className="text-2xl font-bold">🚧</span>
      </div>
      <h1 className="text-2xl font-bold text-surface-900">{title}</h1>
      <p className="mt-2 text-surface-500">This page is coming in the next stage.</p>
    </div>
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
