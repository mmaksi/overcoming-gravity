import { requireUser } from "@/lib/auth";
import { WelcomeCarousel } from "@/components/welcome/welcome-carousel";

/**
 * The welcome tour. The home page redirects here while the profile's
 * `showWelcome` flag is on (new signups, or after re-enabling in Settings);
 * dismissing the carousel clears the flag and returns home.
 */
export default async function WelcomePage() {
  const user = await requireUser();
  return <WelcomeCarousel name={user.name} />;
}
