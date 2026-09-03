export async function onRequestPost(context) {
  try {
    const { request, env } = context;
    const body = await request.json();
    const { task = 'Summary', images = [] } = body || {};

    if (!env.OPENAI_API_KEY) {
      return json({ error: 'AI is not connected yet. Add OPENAI_API_KEY in Cloudflare Pages → Settings → Environment variables.' }, 500);
    }
    if (!Array.isArray(images) || images.length === 0) {
      return json({ error: 'Please upload at least one note image.' }, 400);
    }
    if (images.length > 8) {
      return json({ error: 'Please upload up to 8 images at a time.' }, 400);
    }

    const content = [
      {
        type: 'input_text',
        text: `You are StudexAI, a helpful school study assistant. Read the uploaded handwritten/printed study notes carefully. The student selected: ${task}. Create accurate, clear, age-appropriate study material based ONLY on what is visible in the notes. Do not invent facts. If something is unreadable, say so briefly. Use headings and bullets where useful. For a quiz or revision questions, include answers after the questions. For flashcards, format each as Q: and A:. Keep the result useful for exam revision.`
      },
      ...images.map((image) => ({
        type: 'input_image',
        image_url: image
      }))
    ];

    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-5.6-luna',
        input: [{ role: 'user', content }],
        max_output_tokens: 3000
      })
    });

    const data = await response.json();
    if (!response.ok) {
      return json({ error: data?.error?.message || 'The AI service returned an error.' }, response.status);
    }

    const answer = data.output_text || data.output?.flatMap(item => item.content || []).map(part => part.text || '').join('') || '';
    if (!answer) return json({ error: 'The AI returned no text. Please try again.' }, 502);

    return json({ answer });
  } catch (error) {
    return json({ error: error?.message || 'Server error.' }, 500);
  }
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}
