import { LoginForm } from "./LoginForm";

type SP = Promise<Record<string, string | string[] | undefined>>;

export default async function LoginPage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const next = typeof sp.next === "string" ? sp.next : "/";
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-bg p-4">
      <div className="card flex w-full max-w-sm flex-col gap-6 p-7">
        <div className="flex items-center gap-2.5">
          <span aria-hidden="true" className="grid size-10 place-items-center rounded-xl bg-primary">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round"><circle cx="11" cy="11" r="6" /><path d="M20 20l-4.2-4.2" /></svg>
          </span>
          <div>
            <h1 className="text-xl font-bold">IDScout</h1>
            <p className="text-xs text-muted">ตลาดไอดีเกม</p>
          </div>
        </div>
        <LoginForm next={next} />
      </div>
    </div>
  );
}
