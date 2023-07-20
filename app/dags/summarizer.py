import os
import openai
from ..constants.constants import OPENAI_API_KEY

openai.api_key = OPENAI_API_KEY

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

summarize("""Tras las declaraciones que emitió el director de Conadi en conversación con Radio Bío Bío en Temuco, donde aseguró que detrás de la denuncia realizada por el diputado Andrés Jouannet para que se investiguen los contratos con una empresa mapuche había racismo, el parlamentario respondió y afirmó que es "inaceptable" que se le diera ese calificativo por "ejercer su labor parlamentaria". Región de La Araucanía El diputado de Amarillos Por Chile, Andrés Jouannet, calificó de “inaceptable” que el director nacional de la Corporación Nacional de Desarrollo Indígena, Luis Penchuleo, acusara racismo detrás de la denuncia que realizó el parlamentario para que se investiguen eventuales irregularidades en los contratos con la consultora mapuche Chikawal en La Araucanía. Fue en conversación con Radio Bío Bío en Temuco que Penchuleo descartó irregularidades y defendió la trayectoria de los profesionales que conforman la empresa Chikawal, entre ellos Julio Marileo, que -según indicó- suma más de 10 años siendo proveedor de la Conadi. Esto en respuesta a los cuestionamientos por la nula experiencia que tiene la empresa y por recibir en sólo cinco meses más 400 millones de pesos. “¿Hay algo de racismo acá, que se cuestiona porque son mapuche?, se preguntó el director de la Conadi, asegurando que hay otras empresas que se han adjudicado recursos públicos y no están cuestionadas. Al ser consultado si cree que hay racismo detrás de la denuncia, fue categórico: “Yo creo que sí”. Diputado asegura tener “38% de sangre indígena” Ante esa declaración, el diputado opositor tildó de “inaceptable que un miembro del Ejecutivo sindique a un parlamentario, miembro de otro poder del Estado, como racista por ejercer su labor parlamentaria”. “Esto es muy grave porque el racismo es una ideología que defiende la superioridad de un grupo étnico frente a las demás y justifica la explotación económica, la segregación social, la destrucción física. El racismo conlleva a discriminar a personas y te lo dice alguien que tiene 38% de sangre indígena”, añadió. El diputado afirmó que oficiará al Gobierno a través de la Cámara de Diputadas y Diputados en protesta por los dichos de la autoridad de Gobierno.""")