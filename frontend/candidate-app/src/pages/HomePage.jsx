import PageShell from "../components/PageShell";

export default function HomePage() {
  return (
    <PageShell>
      <section className="mx-auto max-w-2xl py-14 text-center sm:py-24">
        <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-calm-100 text-2xl text-calm-700">
          ✓
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
          AI Interview Coach
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-base leading-7 text-slate-600 sm:text-lg">
          Candidates can review and begin an interview using the unique link sent
          by their recruiter.
        </p>
        <div className="mt-8 rounded-xl border border-slate-200 bg-white px-6 py-5 text-sm leading-6 text-slate-600 shadow-panel">
          Please open the interview link from your invitation email. If you have
          not received one, contact your recruiter for assistance.
        </div>
      </section>
    </PageShell>
  );
}
