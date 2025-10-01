// app/api/connection-details/route.ts
import { NextResponse } from 'next/server';
import { AccessToken, type AccessTokenOptions, type VideoGrant } from 'livekit-server-sdk';
import { RoomConfiguration } from '@livekit/protocol';

export const runtime = 'nodejs';
export const revalidate = 0;

export type ConnectionDetails = {
  serverUrl: string;
  roomName: string;
  participantName: string;
  participantToken: string;
};

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`${name} is not defined`);
  return v;
}

type BodyShape = {
  room_config?: { agents?: { agent_name?: string }[] };
};

function parseBodyMaybe(json: unknown): BodyShape {
  if (
    json &&
    typeof json === 'object' &&
    'room_config' in json &&
    json.room_config &&
    typeof (json as any).room_config === 'object'
  ) {
    return json as BodyShape;
  }
  return {};
}

async function handle(req: Request) {
  try {
    const LIVEKIT_URL = requireEnv('LIVEKIT_URL');
    const API_KEY = requireEnv('LIVEKIT_API_KEY');
    const API_SECRET = requireEnv('LIVEKIT_API_SECRET');

    let agentName: string | undefined;

    if (req.method === 'POST') {
      let bodyUnknown: unknown = {};
      try {
        bodyUnknown = await req.json();
      } catch {
        // ignore bad/empty JSON
      }
      const body = parseBodyMaybe(bodyUnknown);
      agentName = body.room_config?.agents?.[0]?.agent_name;
    } else {
      const url = new URL(req.url);
      agentName = url.searchParams.get('agentName') ?? undefined;
    }

    const participantName = 'user';
    const participantIdentity = `voice_assistant_user_${Math.floor(Math.random() * 10_000)}`;
    const roomName = `voice_assistant_room_${Math.floor(Math.random() * 10_000)}`;

    const participantToken = await createParticipantToken(
      { identity: participantIdentity, name: participantName },
      roomName,
      agentName,
      API_KEY,
      API_SECRET
    );

    const data: ConnectionDetails = {
      serverUrl: LIVEKIT_URL,
      roomName,
      participantName,
      participantToken,
    };

    return NextResponse.json(data, { headers: { 'Cache-Control': 'no-store' } });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: 'connection-details-failed', message },
      { status: 500 }
    );
  }
}

export async function GET(req: Request) {
  return handle(req);
}

export async function POST(req: Request) {
  return handle(req);
}

function createParticipantToken(
  userInfo: AccessTokenOptions,
  roomName: string,
  agentName: string | undefined,
  apiKey: string,
  apiSecret: string
): Promise<string> {
  const at = new AccessToken(apiKey, apiSecret, { ...userInfo, ttl: '15m' });

  const grant: VideoGrant = {
    room: roomName,
    roomJoin: true,
    canPublish: true,
    canPublishData: true,
    canSubscribe: true,
  };
  at.addGrant(grant);

  if (agentName) {
    at.roomConfig = new RoomConfiguration({ agents: [{ agentName }] });
  }

  return at.toJwt();
}
