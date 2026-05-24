// app/(public)/privacy-policy/page.tsx
export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-3xl p-4 sm:p-8 space-y-6 text-sm text-zinc-600 leading-relaxed animate-fadeIn">
      <div className="border-b border-zinc-200 pb-4">
        <p className="text-xs uppercase tracking-[0.3em] text-zinc-400">Data Governance</p>
        <h1 className="text-3xl font-black text-zinc-900 tracking-tight mt-1">Data Privacy Information</h1>
      </div>

      <section className="bg-white p-6 rounded-3xl border border-zinc-100 space-y-4 shadow-sm text-zinc-700">
        <p>In accordance with data security standards, we outline how your registration details are handled across our portal network ecosystem.</p>

        <h2 className="font-bold text-zinc-900 text-base pt-2">Information We Collect</h2>
        <ul className="list-disc pl-5 space-y-1 text-zinc-600">
          <li>Full name and dynamic contact numbers.</li>
          <li>Government issued identification card snapshots for security check verification.</li>
          <li>Transaction reference codes and matching transaction receipt images.</li>
        </ul>

        <h2 className="font-bold text-zinc-900 text-base pt-2">How Data is Guarded</h2>
        <p>Your uploaded identity files are funneled into a completely separate storage repository isolated from public view. This information is exclusively accessible by our internal administration staff to verify transaction records and prevent fraud.</p>
      </section>
    </main>
  );
}