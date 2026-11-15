import { redirect } from "next/navigation";

/** The old "Delivered" page is now step 3. Emails already sent still link here. */
export default function DeliveredRedirect(): never {
  redirect("/portal/finish");
}
