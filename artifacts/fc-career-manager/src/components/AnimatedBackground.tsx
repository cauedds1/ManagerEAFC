export function AnimatedBackground() {
  return (
    <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none" style={{ background: "var(--app-bg, #0B0714)" }}>
      <div className="absolute inset-0 transition-all duration-[1200ms] ease-in-out">
        <div
          className="absolute rounded-full blur-[120px] animate-blob-1 transition-[background] duration-[1200ms]"
          style={{
            width: "50vw",
            height: "50vw",
            top: "-15%",
            left: "-10%",
            background: "var(--blob-1, rgba(139,92,246,0.08))",
          }}
        />
        <div
          className="absolute rounded-full blur-[100px] animate-blob-2 transition-[background] duration-[1200ms]"
          style={{
            width: "45vw",
            height: "45vw",
            bottom: "-20%",
            right: "-10%",
            background: "var(--blob-2, rgba(99,102,241,0.06))",
          }}
        />
        <div
          className="absolute rounded-full blur-[80px] animate-blob-3 transition-[background] duration-[1200ms]"
          style={{
            width: "35vw",
            height: "35vw",
            top: "40%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            background: "var(--blob-3, rgba(139,92,246,0.04))",
          }}
        />
      </div>
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage:
            "radial-gradient(rgba(255,255,255,0.03) 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }}
      />
    </div>
  );
}
