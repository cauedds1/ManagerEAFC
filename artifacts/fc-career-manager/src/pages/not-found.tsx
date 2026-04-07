export default function NotFound() {
  return (
    <div className="min-h-screen w-full flex items-center justify-center" style={{ background: "var(--app-bg, #0a0a0a)" }}>
      <div className="text-center">
        <h1 className="text-4xl font-black text-white/20 mb-2">404</h1>
        <p className="text-white/40 text-sm">Página não encontrada</p>
      </div>
    </div>
  );
}
