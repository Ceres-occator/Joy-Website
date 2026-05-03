import Link from "next/link";

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col bg-zinc-50 text-zinc-900">
      <header className="border-b bg-white/90 px-4 py-4 backdrop-blur-md sm:px-6">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <div className="flex-1">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500 sm:text-sm">
              Maro Airbnb
            </p>
            <h1 className="text-xl font-semibold sm:text-2xl">Find your next stay</h1>
          </div>
          <nav className="hidden items-center gap-4 md:flex">
            <Link href="/" className="text-sm text-zinc-600 hover:text-zinc-900">
              Home
            </Link>
            <Link href="/rooms" className="text-sm text-zinc-600 hover:text-zinc-900">
              Rooms
            </Link>
            <Link href="/about" className="text-sm text-zinc-600 hover:text-zinc-900">
              About
            </Link>
            <Link href="/auth/login" className="text-sm text-zinc-600 hover:text-zinc-900">
              Login
            </Link>
          </nav>
          <div className="hidden md:block">
 
          </div>
        </div>
      </header>

      <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">{children}</main>

      <nav className="sticky bottom-0 border-t bg-white px-4 py-3 shadow-inner md:hidden">
        <div className="mx-auto flex max-w-6xl justify-between">
          <Link href="/" className="flex flex-col items-center text-xs font-medium text-zinc-700 hover:text-zinc-900">
            <span className="text-lg">🏠</span>
            Home
          </Link>
          <Link href="/rooms" className="flex flex-col items-center text-xs font-medium text-zinc-700 hover:text-zinc-900">
            <span className="text-lg">🏨</span>
            Rooms
          </Link>
          <Link href="/about" className="flex flex-col items-center text-xs font-medium text-zinc-700 hover:text-zinc-900">
            <span className="text-lg">ℹ️</span>
            About
          </Link>
          <Link href="/auth/login" className="flex flex-col items-center text-xs font-medium text-zinc-700 hover:text-zinc-900">
            <span className="text-lg">👤</span>
            Login
          </Link>
        </div>
      </nav>
    </div>
  );
}
