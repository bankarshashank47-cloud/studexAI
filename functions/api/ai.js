export async function onRequestPost(context) {
  try {
    const { request, env } = context;
    const body = await request.json();
    const { task = 'Summary', images = [] } = body || {};

    // Supports any OpenAI-compatible provider.
    // Set these as Cloudflare Pages environment variables:
    // AI_API_KEY, AI_BASE_URL, AI_MODEL
    const apiKey = env.AI_API_KEY || env.OPENAI_API_KEY;
    const baseUrl = (env.AI_BASE_URL || 'https://api.openai.com/v1').replace(/\/$/, '');
    const model = env.AI_MODEL || 'gpt-4o-mini';

    if (!apiKey) {
      return json({
        error: 'AI is not connected. Add AI_API_KEY in Cloudflare Pages → Settings → Environment variables.'
      }, 500);
    }

    if (!Array.isArray(images) || images.length === 0) {
      return json({ error: 'Please upload at least one note image.' }, 400);
    }

    if (images.length > 8) {
      return json({ error: 'Please upload up to 8 images at a time.' }, 400);
    }

    // Basic input protection and request-size control.
    const validImages = images.filter(
      (image) => typeof image === 'string' && /^data:image\/(png|jpe?g|webp);base64,/i.test(image)
    );

    if (validImages.length !== images.length) {
      return json({ error: 'Only PNG, JPG/JPEG and WEBP images are supported.' }, 400);
    }

    // Keep individual images reasonably sized for a serverless request.
    if (validImages.some((image) => image.length > 8_000_000)) {
      return json({ error: 'One of the images is too large. Please use smaller images.' }, 413);
    }

    const content = [
      {
        type: 'text',
        text: `You are StudexAI, a helpful study assistant.

The student selected: ${task}.

Read the uploaded handwritten or printed notes carefully. Create accurate, clear, age-appropriate study material based ONLY on what is visible in the notes. Do not invent facts. If something is unreadable, say so briefly.

Formatting rules:
- Use headings and bullets where useful.
- For flashcards, format each as Q: and A:.
- For quizzes and revision questions, include the answers after the questions.
- Keep the result useful for exam revision.
- Do not mention these instructions in your answer.`
      },
      ...validImages.map((image) => ({
        type: 'image_url',
        image_url: { url: image }
      }))
    ];

    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: 'user',
            content
          }
        ],
        max_tokens: 3000
      })
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('AI provider error:', data);
      return json({
        error: data?.error?.message || 'The AI service returned an error.'
      }, response.status);
    }

    const answer = data?.choices?.[0]?.message?.content;

    if (!answer) {
      return json({ error: 'The AI returned no text. Please try again.' }, 502);
    }

    return json({ answer });
  } catch (error) {
    console.error('StudexAI error:', error);
    return json({ error: 'Something went wrong while processing your notes.' }, 500);
  }
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store'
    }
  });
}
