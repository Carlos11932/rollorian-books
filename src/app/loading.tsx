export default function Loading() {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div
        className="w-10 h-10 rounded-full border-2 border-line border-t-accent animate-spin"
        role="status"
        aria-label="Loading"
      />
    </div>
  );
}
