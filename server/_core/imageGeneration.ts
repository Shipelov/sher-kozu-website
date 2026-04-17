/**
 * Image generation helper using OpenAI DALL-E API directly.
 *
 * Example usage:
 *   const { url: imageUrl } = await generateImage({
 *     prompt: "A serene landscape with mountains"
 *   });
 *
 * For editing:
 *   const { url: imageUrl } = await generateImage({
 *     prompt: "Add a rainbow to this landscape",
 *     originalImages: [{
 *       url: "https://example.com/original.jpg",
 *       mimeType: "image/jpeg"
 *     }]
 *   });
 */
import { storagePut } from "server/storage";
import { ENV } from "./env";

export type GenerateImageOptions = {
  prompt: string;
  originalImages?: Array<{
    url?: string;
    b64Json?: string;
    mimeType?: string;
  }>;
};

export type GenerateImageResponse = {
  url?: string;
};

export async function generateImage(
  options: GenerateImageOptions
): Promise<GenerateImageResponse> {
  const apiKey = ENV.openaiApiKey;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured for image generation");
  }

  const baseUrl = (ENV.openaiApiUrl || "https://api.openai.com").replace(/\/+$/, "");

  // If we have original images, use the edits endpoint
  if (options.originalImages && options.originalImages.length > 0) {
    const original = options.originalImages[0];
    let imageBuffer: Buffer;

    if (original.b64Json) {
      imageBuffer = Buffer.from(original.b64Json, "base64");
    } else if (original.url) {
      const resp = await fetch(original.url);
      if (!resp.ok) throw new Error(`Failed to fetch original image: ${resp.status}`);
      imageBuffer = Buffer.from(await resp.arrayBuffer());
    } else {
      throw new Error("Original image must have either url or b64Json");
    }

    const formData = new FormData();
    const imageBlob = new Blob([new Uint8Array(imageBuffer)], {
      type: original.mimeType || "image/png",
    });
    formData.append("image", imageBlob, "image.png");
    formData.append("prompt", options.prompt);
    formData.append("model", "dall-e-2");
    formData.append("n", "1");
    formData.append("size", "1024x1024");
    formData.append("response_format", "b64_json");

    const response = await fetch(`${baseUrl}/v1/images/edits`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      throw new Error(
        `Image edit request failed (${response.status} ${response.statusText})${detail ? `: ${detail}` : ""}`
      );
    }

    const result = (await response.json()) as {
      data: Array<{ b64_json?: string; url?: string }>;
    };

    const b64 = result.data[0]?.b64_json;
    if (b64) {
      const buffer = Buffer.from(b64, "base64");
      const { url } = await storagePut(
        `generated/${Date.now()}.png`,
        buffer,
        "image/png"
      );
      return { url };
    }

    return { url: result.data[0]?.url };
  }

  // Standard generation with DALL-E 3
  const response = await fetch(`${baseUrl}/v1/images/generations`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "dall-e-3",
      prompt: options.prompt,
      n: 1,
      size: "1024x1024",
      response_format: "b64_json",
    }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(
      `Image generation request failed (${response.status} ${response.statusText})${detail ? `: ${detail}` : ""}`
    );
  }

  const result = (await response.json()) as {
    data: Array<{ b64_json?: string; url?: string }>;
  };

  const b64 = result.data[0]?.b64_json;
  if (b64) {
    const buffer = Buffer.from(b64, "base64");
    const { url } = await storagePut(
      `generated/${Date.now()}.png`,
      buffer,
      "image/png"
    );
    return { url };
  }

  return { url: result.data[0]?.url };
}
