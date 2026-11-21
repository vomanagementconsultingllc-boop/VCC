import { describe, expect, it } from "vitest";
import { teamTodo, type TodoScript } from "@/lib/team-todo";

describe("teamTodo", () => {
  const now = new Date("2027-03-10T12:00:00Z");
  const script = (id: string, stage: string, extra: Partial<TodoScript> = {}): TodoScript => ({
    id,
    title: `Video ${id}`,
    stage: stage as never,
    footage_requested_at: null,
    brief: null,
    client: { name: "Allison", business: "Bright Dental" },
    ...extra,
  });

  it("lists only what is waiting on the team, most urgent group first", () => {
    const groups = teamTodo(
      [
        script("plan", "research"),
        script("written", "scripted"),
        script("reading", "sent_to_client"), // waiting on the client
        script("filming", "awaiting_footage", { brief: { due_date: "2027-03-20" } }), // on time
        script("late", "awaiting_footage", { brief: { due_date: "2027-03-01" } }),
        script("in", "footage_received"),
        script("editing", "in_edit"), // waiting on the editor
        script("back", "review"),
        script("handed", "delivered"), // waiting on the client
        script("done", "posted"),
      ],
      [{ id: "job-1", script_id: "back" }],
      now,
    );
    expect(groups.map((g) => [g.kind, g.items.map((i) => i.id)])).toEqual([
      ["watch", ["back"]],
      ["assign", ["in"]],
      ["send", ["written"]],
      ["write", ["plan"]],
      ["late", ["late"]],
    ]);
  });

  it("links each item to the page where it gets done", () => {
    const groups = teamTodo(
      [script("back", "review"), script("orphan", "review"), script("in", "footage_received"), script("plan", "research")],
      [{ id: "job-1", script_id: "back" }],
      now,
    );
    const href = (id: string) => groups.flatMap((g) => g.items).find((i) => i.id === id)?.href;
    expect(href("back")).toBe("/team/jobs/job-1");
    expect(href("orphan")).toBe("/team/scripts/orphan"); // no job found: fall back to the video
    expect(href("in")).toBe("/team/jobs");
    expect(href("plan")).toBe("/team/scripts/plan");
  });

  it("is empty when nothing needs the team", () => {
    expect(teamTodo([script("a", "sent_to_client"), script("b", "in_edit")], [], now)).toEqual([]);
  });

  it("names the client by business, then by name", () => {
    const [group] = teamTodo([script("a", "research", { client: [{ name: "Sam", business: "" }] })], [], now);
    expect(group.items[0].client).toBe("Sam");
  });
});
