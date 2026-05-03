export default function AuthPage() {
  return (
    <section className="mx-auto max-w-md space-y-6 px-4 sm:px-0">
      <div className="rounded-2xl bg-white p-6 shadow-sm sm:rounded-3xl sm:p-8">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-zinc-500 sm:text-sm">Customer login</p>
          <h2 className="mt-3 text-2xl font-semibold text-zinc-900 sm:mt-4 sm:text-3xl">Sign in to view bookings</h2>
        </div>

        <form className="mt-6 space-y-4 sm:mt-8 sm:space-y-5">
          <label className="block text-sm font-medium text-zinc-700">
            Email
            <input
              type="email"
              placeholder="you@example.com"
              className="mt-2 w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm focus:border-zinc-900 focus:outline-none sm:rounded-3xl sm:px-4 sm:py-3"
            />
          </label>
          <label className="block text-sm font-medium text-zinc-700">
            Password
            <input
              type="password"
              placeholder="Enter your password"
              className="mt-2 w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm focus:border-zinc-900 focus:outline-none sm:rounded-3xl sm:px-4 sm:py-3"
            />
          </label>
          <button
            type="submit"
            className="w-full rounded-2xl bg-zinc-900 px-4 py-3 text-sm font-semibold text-white hover:bg-zinc-700 sm:rounded-full sm:px-5 sm:py-3"
          >
            Continue
          </button>
        </form>
      </div>
    </section>
  );
}
