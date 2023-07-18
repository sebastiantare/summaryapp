import os
import openai

openai.api_key = os.getenv("OPENAI_API_KEY")

def summarize(article_body):
    response = openai.ChatCompletion.create(
    model="gpt-3.5-turbo",
    messages=[
        {
        "role": "system",
        "content": "Resumen esta noticia en español, en 3 puntos clave o bullet-points, de no más de 30 palabras cada uno."
        },
        {
        "role": "user",
        "content": f"{article_body}"
        }
    ],
    temperature=0,
    max_tokens=64,
    top_p=1.0,
    frequency_penalty=0.0,
    presence_penalty=0.0
    )

    return response