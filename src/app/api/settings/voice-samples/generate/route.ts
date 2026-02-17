import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getActiveWorkspaceId } from "@/lib/workspace";
import { generateVoiceProfile } from "@/lib/voice-matching";

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const workspaceId = await getActiveWorkspaceId();
  if (!workspaceId) {
    return NextResponse.json(
      { error: "No workspace selected" },
      { status: 400 },
    );
  }

  // Load all voice samples for this user in this workspace
  const samples = await prisma.voiceSample.findMany({
    where: { userId: session.user.id, workspaceId },
    select: { sampleText: true },
    orderBy: { createdAt: "desc" },
  });

  if (samples.length === 0) {
    return NextResponse.json(
      { error: "No writing samples found. Add at least one sample first." },
      { status: 400 },
    );
  }

  try {
    const voiceProfile = await generateVoiceProfile(
      samples.map((s: { sampleText: string }) => s.sampleText),
    );

    // Store the voice profile in workspace settings
    const workspace = await prisma.workspace.findUniqueOrThrow({
      where: { id: workspaceId },
      select: { settings: true },
    });

    const existingSettings =
      (workspace.settings as Record<string, unknown>) ?? {};

    await prisma.workspace.update({
      where: { id: workspaceId },
      data: {
        settings: {
          ...existingSettings,
          voiceProfile,
          voiceProfileGeneratedAt: new Date().toISOString(),
        },
      },
    });

    return NextResponse.json({ voiceProfile });
  } catch (error) {
    console.error("[voice-samples/generate] Failed:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to generate voice profile",
      },
      { status: 500 },
    );
  }
}
