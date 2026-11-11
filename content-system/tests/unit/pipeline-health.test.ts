import { describe, expect, it } from "vitest";
import { pipelineHealth } from "@/lib/pipeline-health";

describe("pipelineHealth", () => {
  const now = new Date("2027-03-10T12:00:00Z");
  const row = (client_id: string, stage: string, extra: Partial<{ footage_requested_at: string; due: string }> = {}) => ({
    client_id,
    stage: stage as never,
    footage_requested_at: extra.footage_requested_at ?? null,
    brief: extra.due ? { due_date: extra.due } : null,
  });

  it("counts what is waiting on the client, overdue, and in the edit queue", () => {
    const health = pipelineHealth(
      [
        row("a", "sent_to_client"),
        row("a", "sent_to_client"),
        row("a", "awaiting_footage", { due: "2027-03-09" }), // past the brief date
        row("a", "awaiting_footage", { due: "2027-03-10" }), // due today: not overdue yet
        row("a", "awaiting_footage", { footage_requested_at: "2027-03-01T00:00:00Z" }), // no date, 9 days
        row("a", "awaiting_footage", { footage_requested_at: "2027-03-08T00:00:00Z" }), // no date, 2 days
        row("a", "in_edit"),
        row("a", "review"),
        row("a", "footage_received"),
        row("b", "in_edit"),
      ],
      now,
    );
    expect(health.get("a")).toEqual({ waiting: 2, overdue: 2, editing: 3 });
    expect(health.get("b")).toEqual({ waiting: 0, overdue: 0, editing: 1 });
    expect(health.get("c")).toBeUndefined();
  });

  it("accepts the brief as a one-item list", () => {
    const health = pipelineHealth(
      [{ client_id: "a", stage: "awaiting_footage", footage_requested_at: null, brief: [{ due_date: "2027-01-01" }] }],
      now,
    );
    expect(health.get("a")?.overdue).toBe(1);
  });
});
