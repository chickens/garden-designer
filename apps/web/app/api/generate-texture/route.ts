import { NextResponse } from "next/server"
import OpenAI from "openai"

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

export async function POST(request: Request) {
  const { plantName, botanicalName, notes } = await request.json()

  if (!plantName || typeof plantName !== "string") {
    return NextResponse.json({ error: "plantName required" }, { status: 400 })
  }

  if (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY === "your-key-here") {
    return NextResponse.json(
      { error: "OPENAI_API_KEY not configured" },
      { status: 500 }
    )
  }

  const parts = [plantName]
  if (botanicalName) parts.push(`(${botanicalName})`)
  if (notes) parts.push(`- ${notes}`)
  const nameForPrompt = parts.join(" ")

  const response = await openai.images.generate({
    model: "gpt-image-1",
    prompt: `A single ${nameForPrompt} plant, front-facing view, full plant from base to top, on a completely transparent background. Botanical illustration style, suitable for use as a sprite in a 3D garden scene. No ground, no shadow, no background elements, no pot. The plant should look natural and realistic.`,
    n: 1,
    size: "1024x1024",
    background: "transparent",
    output_format: "png",
  })

  const b64 = response.data?.[0]?.b64_json
  if (!b64) {
    return NextResponse.json(
      { error: "No image returned" },
      { status: 500 }
    )
  }

  return NextResponse.json({ image: b64 })
}
