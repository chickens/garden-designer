import { NextResponse } from "next/server"
import OpenAI from "openai"

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

export async function POST(request: Request) {
  const { commonName } = await request.json()

  if (!commonName || typeof commonName !== "string") {
    return NextResponse.json({ error: "commonName required" }, { status: 400 })
  }

  if (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY === "your-key-here") {
    return NextResponse.json(
      { error: "OPENAI_API_KEY not configured" },
      { status: 500 }
    )
  }

  const completion = await openai.chat.completions.create({
    model: "gpt-5.4-mini",
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: `You are a horticultural expert. Given a plant common name, return accurate plant data as JSON with these exact fields:
{
  "commonName": "string - the common name (corrected if misspelled)",
  "botanicalName": "string - full Latin botanical name",
  "category": "one of: shrub, perennial, annual, tree, climber, grass, bulb, fern, herb, vegetable",
  "heightMin": "number - minimum mature height in cm",
  "heightMax": "number - maximum mature height in cm",
  "spreadMin": "number - minimum mature spread in cm",
  "spreadMax": "number - maximum mature spread in cm",
  "sun": "one of: full, partial, shade",
  "water": "one of: low, medium, high",
  "soil": ["array of applicable: clay, sand, loam, chalk"],
  "season": ["array of seasons with interest: spring, summer, autumn, winter"],
  "evergreen": "boolean",
  "color": "string - hex color representing the primary flower or foliage color (e.g. #7B68AE for lavender)",
  "notes": "string - one sentence description of the plant"
}
Return ONLY valid JSON. Use realistic horticultural data.`,
      },
      {
        role: "user",
        content: commonName,
      },
    ],
  })

  const content = completion.choices[0]?.message?.content
  if (!content) {
    return NextResponse.json(
      { error: "No response from AI" },
      { status: 500 }
    )
  }

  const data = JSON.parse(content)
  return NextResponse.json(data)
}
