interface BlurredBackgroundProps {
  coverUrl: string | null;
}

export function BlurredBackground({ coverUrl }: BlurredBackgroundProps) {
  if (!coverUrl) return null;

  return (
    <div
      aria-hidden="true"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 0,
        overflow: "hidden",
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={coverUrl}
        alt=""
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          objectFit: "cover",
          transform: "scale(1.2)",
          filter: "blur(80px) brightness(0.25) saturate(1.5)",
        }}
      />
    </div>
  );
}
