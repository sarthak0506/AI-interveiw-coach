import { Link } from "react-router-dom";

export default function PageShell({ children }) {
  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-200/80 bg-white">
        <div className="mx-auto flex max-w-4xl items-center px-5 py-4 sm:px-8">
          <Link
            to="/"
            className="rounded-sm text-base font-bold tracking-tight text-slate-900"
          >
            AI Interview Coach
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-4xl px-5 py-10 sm:px-8 sm:py-14">
        {children}
      </main>
      <footer className="mx-auto max-w-4xl px-5 pb-8 text-center text-xs text-slate-400 sm:px-8">
        Your interview information is shared securely through your unique invite link.
      </footer>
    </div>
  );
}
