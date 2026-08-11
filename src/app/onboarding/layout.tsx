import { Wordmark } from "@/components/Wordmark";

/**
 * A linear flow, one viewport tall.
 *
 * The shell is a fixed-height column — header, question, action — so no step
 * ever scrolls. Global navigation is suppressed deliberately: there is
 * nowhere else to go from here, and offering exits is how a five-screen flow
 * loses people at screen two.
 */
export default function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-dvh flex-col overflow-hidden">
      <header className="flex w-full shrink-0 justify-center py-4">
        <Wordmark />
      </header>
      {children}
    </div>
  );
}
