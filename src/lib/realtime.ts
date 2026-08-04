import { supabase } from "@/integrations/supabase/client";
import type { RealtimeChannel } from "@supabase/supabase-js";

type RoomEventBase =
  | { type: "hello"; side: "host" | "away"; clientId: string; teamId?: string | null }
  | { type: "state"; state: any }
  | { type: "input"; side: "host" | "away"; value: number; elapsedMs?: number }
  | { type: "select"; kind: "openers" | "bowler" | "batter"; payload: any; from: "host" | "away" }
  | { type: "toss_call"; call: "heads" | "tails" }
  | { type: "toss_choice"; choice: "bat" | "bowl" }
  | { type: "follow_on"; enforce: boolean }
  | { type: "next_innings_choice"; battingSide: "host" | "away" }
  | { type: "declare" }
  | { type: "chat"; side: "host" | "away"; text: string }
  | { type: "leave"; side: "host" | "away" }
  | { type: "pause" }
  | { type: "resume" }
  | { type: "ping" };

export type RoomEvent = RoomEventBase & { _from?: string };

export interface PresenceHandlers {
  onJoin?: (info: { side: "host" | "away"; clientId: string }) => void;
  onLeave?: (info: { side: "host" | "away"; clientId: string }) => void;
}

export function joinRoom(
  roomCode: string,
  onEvent: (e: RoomEvent) => void,
  identity: { side: "host" | "away"; clientId: string },
  presence?: PresenceHandlers,
): { channel: RealtimeChannel; send: (e: RoomEvent) => void } {
  const channel = supabase.channel(`hcc:${roomCode}`, {
    config: {
      broadcast: { self: false, ack: false },
      presence: { key: identity.clientId },
    },
  });
  channel
    .on("broadcast", { event: "msg" }, (payload) => {
      onEvent(payload.payload as RoomEvent);
    })
    .on("presence", { event: "join" }, ({ newPresences }) => {
      for (const p of newPresences as any[]) {
        if (p.clientId && p.clientId !== identity.clientId) {
          presence?.onJoin?.({ side: p.side, clientId: p.clientId });
        }
      }
    })
    .on("presence", { event: "leave" }, ({ leftPresences }) => {
      for (const p of leftPresences as any[]) {
        if (p.clientId && p.clientId !== identity.clientId) {
          presence?.onLeave?.({ side: p.side, clientId: p.clientId });
        }
      }
    })
    .subscribe(async (status) => {
      if (status === "SUBSCRIBED") {
        try {
          await channel.track({ side: identity.side, clientId: identity.clientId });
        } catch {}
      }
    });
  const send = (e: RoomEvent) => {
    channel.send({ type: "broadcast", event: "msg", payload: e });
  };
  return { channel, send };
}

export function leaveRoom(channel: RealtimeChannel) {
  try {
    channel.untrack();
  } catch {}
  supabase.removeChannel(channel);
}
