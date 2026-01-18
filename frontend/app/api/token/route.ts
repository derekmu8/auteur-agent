import { NextResponse } from "next/server";
import { AccessToken } from "livekit-server-sdk";

export async function GET() {
  const apiKey = process.env.LIVEKIT_API_KEY;
  const apiSecret = process.env.LIVEKIT_API_SECRET;

  if (!apiKey || !apiSecret) {
    return NextResponse.json(
      { error: "LiveKit credentials not configured" },
      { status: 500 }
    );
  }

  // Generate a unique room and identity
  const roomName = `auteur-${Date.now()}`;
  const participantIdentity = `user-${Math.random().toString(36).substring(2, 8)}`;

  const token = new AccessToken(apiKey, apiSecret, {
    identity: participantIdentity,
    ttl: "1h",
  });

  token.addGrant({
    room: roomName,
    roomJoin: true,
    canPublish: true,
    canSubscribe: true,
    canPublishData: true,
  });

  return NextResponse.json({
    token: await token.toJwt(),
    room: roomName,
    identity: participantIdentity,
  });
}
