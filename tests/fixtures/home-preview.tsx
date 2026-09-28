// Synthetic browser-test content only. The Phase 9D runner creates and removes
// its temporary local route; this fixture is never imported by a product route.
import { HomeView } from "@/components/home/home-view";
import { exampleProfile } from "@/lib/example-profile";

/** Signed-in homepage composition; owner data is mocked in the browser. */
export function HomePreview() {
  return <HomeView viewer={{ signedIn: true, username: "phase9d" }} example={{ profile: exampleProfile, live: false }} />;
}
