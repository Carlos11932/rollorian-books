export function PageBackdrop() {
  return (
    <div
      aria-hidden="true"
      className="fixed inset-0 z-0 pointer-events-none overflow-hidden"
    >
      {/* Left accent glow */}
      <div
        className="absolute w-[36rem] h-[36rem] rounded-full opacity-[0.48]"
        style={{
          top: "-8rem",
          left: "-10rem",
          background: "rgba(214, 59, 47, 0.42)",
          filter: "blur(80px)",
        }}
      />
      {/* Right blue glow */}
      <div
        className="absolute w-[36rem] h-[36rem] rounded-full opacity-[0.48]"
        style={{
          top: "6rem",
          right: "-12rem",
          background: "rgba(69, 99, 141, 0.34)",
          filter: "blur(80px)",
        }}
      />
      {/* Subtle grid overlay */}
      <div className="backdrop-grid absolute inset-0" aria-hidden="true" />
    </div>
  );
}
