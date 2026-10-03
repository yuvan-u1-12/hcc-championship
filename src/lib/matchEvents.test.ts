import { describe, it, expect } from "vitest";
import { createInitialState, startInnings, setOpeners, setBowler, lockInput, resolveBall } from "./gameEngine";
import { extractBallEvents, matchIdFor } from "./matchEvents";
import { TEAMS } from "./teams";

function setup() {
  let s = createInitialState("ABCDE");
  s = { ...s, hostTeamId: TEAMS[0].id, awayTeamId: TEAMS[1].id, matchStartedAt: 1700000000000 };
  s = startInnings(s, 1, "host");
  const bat = TEAMS[0].players, bowl = TEAMS[1].players;
  s = setOpeners(s, bat[0].name, bat[1].name);
  s = setBowler(s, bowl[7].name);
  return s;
}
function play(s: any, b: number, w: number) {
  s = lockInput(s, "host", b);
  s = lockInput(s, "away", w);
  return resolveBall(s);
}

describe("ball events", () => {
  it("one event per completed ball with stable ordered ids", () => {
    let s = setup();
    s = play(s, 3, 5);
    s = play(s, 4, 2);
    const ev = extractBallEvents(s);
    expect(ev).toHaveLength(2);
    expect(ev.map((e) => e.id)).toEqual(["ABCDE-1700000000000:1:1:1", "ABCDE-1700000000000:1:1:2"]);
    expect(ev[0].non_striker).not.toBeNull();
    expect(new Set(extractBallEvents(s).map((e) => e.id)).size).toBe(2);
  });
  it("records engine runs unchanged", () => {
    let s = setup();
    s = play(s, 3, 5);
    const inn = s.innings[1]!;
    expect(extractBallEvents(s)[0].runs).toBe(inn.balls[0].runs);
    expect(extractBallEvents(s)[0].bat_number).toBe(3);
    expect(extractBallEvents(s)[0].bowl_number).toBe(5);
  });
  it("no match id before the match starts", () => {
    expect(matchIdFor({ roomCode: "X", matchStartedAt: null })).toBeNull();
  });
});
