interface LoadingScreenProps {
  heading?: string;
  subtitle?: string;
}

export function LoadingScreen({
  heading = "Connecting to family",
  subtitle = "Checking for new texts from Lola...",
}: LoadingScreenProps) {
  return (
    <main className="peeking-screen" role="status" aria-live="polite">
      <div className="peeking-center">
        <div>
          <div className="ring-spinner" aria-hidden="true" />
          <h1 className="peeking-heading">{heading}</h1>
          <p className="peeking-sub">{subtitle}</p>
        </div>
        <div className="peeking-stage">
          <img
            className="peeking-img"
            src="/assets/lola-peeking.jpg"
            alt="Cute Lola mascot peeking up cheerfully"
          />
        </div>
      </div>
    </main>
  );
}
