// app/api/connection-details/route.ts
import { NextResponse } from 'next/server';
import { AccessToken, type AccessTokenOptions, type VideoGrant } from 'livekit-server-sdk';
import { RoomConfiguration } from '@livekit/protocol';

export const runtime = 'nodejs';     // ensure Node on Netlify
export const revalidate = 0;         // no caching

type ConnectionDetails = {
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

async function handle(req: Request) {
  try {
    // envs (fail fast with clear message)
    const LIVEKIT_URL = requireEnv('LIVEKIT_URL');
    const API_KEY = requireEnv('LIVEKIT_API_KEY');
    const API_SECRET = requireEnv('LIVEKIT_API_SECRET');

    let agentName: string | undefined;

    if (req.method === 'POST') {
      // tolerate empty/invalid JSON without nuking the route
      let body: any = {};
      try {
        body = await req.json();
      } catch {
        body = {};
      }
      agentName = body?.room_config?.agents?.[0]?.agent_name;
    } else {
      // GET: allow query ?agentName=foo
      const url = new URL(req.url);
      agentName = url.searchParams.get('agentName') ?? undefined;
    }

    // Generate participant token
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
  } catch (err: any) {
    // ALWAYS return JSON so client .json() never dies
    return NextResponse.json(
      { error: 'connection-details-failed', message: String(err?.message || err) },
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
  const at = new AccessToken(apiKey, apiSecret, {
    ...userInfo,
    ttl: '15m',
  });

  const grant: VideoGrant = {
    room: roomName,
    roomJoin: true,
    canPublish: true,
    canPublishData: true,
    canSubscribe: true,
  };
  at.addGrant(grant);

  if (agentName) {
    at.roomConfig = new RoomConfiguration({
      agents: [{ agentName }],
    });
  }

  return at.toJwt();
}
