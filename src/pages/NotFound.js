import { Link } from "react-router-dom";

export default function NotFound() {
  return (
    <div className="grid min-h-screen place-items-center bg-ink-50 px-4">
      <div className="text-center">
        <p className="text-6xl font-extrabold text-brand-600">404</p>
        <h1 className="mt-3 text-2xl font-bold text-ink-900">Page not found</h1>
        <p className="mt-2 text-sm text-ink-500">The page you are looking for doesn't exist in MedSure.</p>
        <div className="mt-6 flex justify-center gap-3">
          <Link to="/" className="btn-outline">Go home</Link>
          <Link to="/login" className="btn-primary">Login</Link>
        </div>
      </div>
    </div>
  );
}
