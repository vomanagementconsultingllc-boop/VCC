import { Field, Input, Select } from "@/components/ui";
import { CLIENT_STATUS, PLATFORMS } from "@/lib/labels";
import type { Database } from "@/lib/database.types";

type Client = Database["public"]["Tables"]["clients"]["Row"];
const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/** Fields shared by "new client" and "edit client". Logistics only. */
export function ClientFields({
  client,
  staff,
}: {
  client?: Client;
  staff: Array<{ id: string; full_name: string; email: string }>;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field label="Contact name">
        <Input name="name" required defaultValue={client?.name} placeholder="Dr. Allison Reed" />
      </Field>
      <Field label="Business">
        <Input name="business" defaultValue={client?.business} placeholder="Reed Family Dental" />
      </Field>
      <Field label="Niche tags" hint="Comma separated. Research is pulled per niche and shared across clients in it.">
        <Input name="niche_tags" defaultValue={client?.niche_tags.join(", ")} placeholder="dentist, cosmetic dentistry" />
      </Field>
      <Field label="Login contact" hint="Who on their side signs in and gets the emails.">
        <Input name="login_contact" defaultValue={client?.login_contact} placeholder="allison@reeddental.com" />
      </Field>
      <fieldset>
        <legend className="mb-1 text-sm font-semibold text-ink">Platforms</legend>
        <div className="flex flex-wrap gap-x-4 gap-y-2">
          {PLATFORMS.map((p) => (
            <label key={p} className="flex items-center gap-2 text-sm capitalize">
              <input type="checkbox" name="platforms" value={p} defaultChecked={client?.platforms.includes(p)} />
              {p}
            </label>
          ))}
        </div>
      </fieldset>
      <fieldset>
        <legend className="mb-1 text-sm font-semibold text-ink">Posting days</legend>
        <div className="flex flex-wrap gap-x-4 gap-y-2">
          {DAYS.map((d) => (
            <label key={d} className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="posting_days" value={d} defaultChecked={client?.posting_days.includes(d)} />
              {d}
            </label>
          ))}
        </div>
      </fieldset>
      <Field label="Posting cadence">
        <Input name="posting_cadence" defaultValue={client?.posting_cadence} placeholder="3 posts per week" />
      </Field>
      <Field label="Status">
        <Select name="status" defaultValue={client?.status ?? "onboarding"}>
          {Object.entries(CLIENT_STATUS).map(([value, { label }]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Assigned team member">
        <Select name="assigned_team_member" defaultValue={client?.assigned_team_member ?? ""}>
          <option value="">Unassigned</option>
          {staff.map((s) => (
            <option key={s.id} value={s.id}>
              {s.full_name || s.email}
            </option>
          ))}
        </Select>
      </Field>
    </div>
  );
}
