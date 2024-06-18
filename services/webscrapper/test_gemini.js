import { GoogleGenerativeAI } from "@google/generative-ai";
import { config } from 'dotenv';

// Load .env
config();

// Access your API key as an environment variable (see "Set up your API key" above)
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

async function run() {
  // The Gemini 1.5 models are versatile and work with both text-only and multimodal prompts
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

  const prompt = `
    Vas a realizar el trabajo de resumir artículos noticieros siguiendo el siguiente formato:

    Título
    Bulletpoint 1
    Bulletpoint 2
    ...

    Realiza el resumen utilizando la menor cantidad de bulletpoints posibles (max 5). El resumen total no debe superar las 100 palabras total. El resumen debe dar una idea general de qué es lo más importante en la noticia. Reduce la complejidad del artículo utilizando palabras más simples.

    Articulo: Caso Ojeda: Tarek Saab dice que sospechosos no están en Venezuela y critica duramente a Chile. El fiscal general de Venezuela, Tarek William Saab, fustigó duramente a las autoridades de nuestro país por el crimen de Ronald Ojeda, acusando al Ministerio Público de hacer una investigación de “pobreza extrema”, enfatizando en que los sospechosos no estarían en el país caribeño. Recordemos que la autoridad venezolana ha sido blanco de las críticas por sus cuestionamientos al Ministerio Público, e incluso sus últimos dichos generaron una nota de protesta del Gobierno del presidente Gabriel Boric. Al respecto, en entrevista con Mega, Tarek William Saab, acusó que “lo que estoy viendo yo de las autoridades chilenas, desde el Presidente hasta el parlamentario de menor rango, ofensa y ataque, pero sin argumento. Simplemente, es buscar ofender”. En ese sentido, lamentó “una sucesiva cadena de improperios de ofensas que lanza desde el propio jefe de Estado, presidente Boric, Presidente de Chile, a quien yo ni siquiera mencioné en mi rueda de prensa. El canciller de Chile sucesivamente lanzó tres declaraciones, cada una más ofensiva que las otras, llenas de un odio personal en contra mía”. Por otro lado, Tarek William Saab confirmó el envío de una carta al fiscal nacional, Ángel Valencia, antes de la fallida visita de los dos directores a Chile, quienes no fueron recibidos por el jefe del Ministerio Público. “No fueron recibidos, un acto de descortesía e inamistad totalmente inexplicable y sin precedente, por lo menos en la historia del Ministerio Público bajo mi gestión”, fustigó. “Si vienen dos directores de la Fiscalía Nacional chilena a Venezuela a investigar el lamentable asesinato de un refugiado chileno que vive en Venezuela, un poco comparándolo con lo que ocurrió con Ronald Ojeda en Chile, yo soy el primero que recibiría a esa delegación”, sostuvo. “Lo que han dicho las autoridades chilenas no tienen fundamento ni sustento, Por eso no quisieron que los directores nuestros vieran el expediente, se entrevistasen con el fiscal nacional de Chile, con el fiscal federal, ni se entrevistaran con los familiares de Ronald Ojeda, porque iban a reconfirmar esto, que ya igual hemos recontraconfirmado que es una muy, pero muy débil investigación la que se ha hecho, sin fundamento”, fustigó. En esa línea, tachó la indagatoria de “una pobreza extrema, en la experticia de investigación, en recabar los elementos de convicción para lanzar teorías. Yo quiero preguntar ahora cuáles son las diligencias, los medios de prueba que tiene la Fiscalía Nacional chilena, eso es lo que queríamos nosotros recabar, para decir que fue desde territorio venezolano, con autoridades venezolanas apoyando al Tren de Aragua para que ejecutara esta acción”. En relación con el propio Ronald Ojeda, el fiscal venezolano cuestionó las salidas de Chile del fallecido exmilitar, supuestamente para conspirar en contra del régimen de Nicolás Maduro. “Por qué si Ronald Ojeda tenía el estatus de refugiado, si reconoce que entraba y salía de Chile hacia Venezuela para conspirar, hay un audio donde efectivamente Ronald Ojeda lo confirma antes de que lo mataran ¿Por qué Ojeda en Chile andaba armado, por qué un refugiado tiene que andar armado, por qué tenía uniforme e insignias policiales chilenas?, tenemos esa información”, afirmó. Respecto a los dos sospechosos del crimen, Tarek William Saab aseveró que no se encuentran en Venezuela, pero sin entregar mayores detalles. “Esos dos presuntos indiciados, miembros del tren de Aragua, que señala la justicia chilena, no viven en Venezuela y no están en Venezuela. Pero mi pregunta de esta, ¿por qué si uno de ellos tiene antecedentes por participar en tres secuestros en Chile, por qué la justicia chilena no lo detuvo? ¿Quién es culpable aquí en la impunidad y del crimen?”, acusó. “No están en Venezuela, señores. Hemos hecho todo el esfuerzo a través de los órganos y la red de justicia, tanto policiales o militares, para ubicarlos y no se encuentran. Ahora bien de encontrarse y ser detenidos, nosotros los sancionaríamos con la máxima pena. De comprobarse efectivamente su participación en este hecho abominable, como fue el asesinato de Ronald Ojeda, obviamente, en territorio venezolano. Porque nuestra Constitución establece claramente que está prohibida la extradición”, acotó. Sobre el Tren de Aragua, el fiscal venezolano recordó la liberación de los miembros del peligroso grupo criminal en Los Vilos, deslizando incluso un supuesto pago de “favores”. “Por qué la semana pasada sueltan a tres miembros del Tren de Aragua y los liberan, qué están pagando allí, qué favores está pagando, pregunto yo ahora. Eso lleva a la sospecha, abramos un debate de verdad”, sentenció. “El Tren de Aragua es una banda desarticulada, diezmada, que ha tenido una bendición en Chile, ¿Cuál ha sido esa bendición? Que tres miembros, luego de ser presos en Chile, lo soltaron los tribunales, ¿por qué los soltaron? ¿No es que en la banda más peligrosa del mundo mundial del planeta Tierra?”, cuestionó. “La teoría que yo lanzo, la vuelvo a ratificar. Para mí fue una acción de falsa bandera, una acción ejecutada desde Chile con participación, obviamente, si fue una gran estructura la que ejecuta el secuestro y el asesinato con algún componente de cuerpo policiales chilenos y cuerpos extranjeros”, concluyó.
  `;

  // Articulo: "Chile Vamos pide a Contraloría fiscalizar al INDH tras querella por tráfico de influencias. Diputados de Chile Vamos presentaron un requerimiento a la Contraloría para solicitar una exhaustiva fiscalización de las acciones judiciales emprendidas por el Instituto Nacional de Derechos Humanos (INDH). Los parlamentarios acusan a la institución de actuar fuera del marco de sus competencias legales y de utilizar indebidamente recursos fiscales. La acción fue presentada por las bancadas de diputados de Chile Vamos, encabezadas por Hugo Rey (RN, subjefe), Andrés Longton (RN), Juan Antonio Coloma (UDI) y Jorge Guzmán (Evópoli). El requerimiento se basa en la reciente decisión del INDH de presentar una querella penal por tráfico de influencias en el proceso de designación de María Teresa Letelier como ministra de la Corte Suprema. Según los diputados, esta acción judicial excede las atribuciones del INDH y constituye una “ilegalidad manifiesta”, implicando un uso indebido de recursos fiscales. A juicio de los parlamentarios, el INDH ha excedido sus competencias, ya que, conforme al numeral 5 del artículo 3 de la Ley N°20.405, se establece un doble mecanismo para conferir autoridad judicial al Instituto. Por un lado, se le permite ejercer acciones judiciales “en el ámbito de su competencia” y, por otro, se le otorga la legitimidad para presentar querellas en relación con un conjunto específico de seis delitos. “Luego los delitos de corrupción o contra la Función Pública como el tráfico de influencias no está en el mencionado conjunto”, señalan. En el documento de 11 páginas, los diputados detallan las facultades del INDH y explican cómo ha excedido sus competencias legales. Señalan que la capacidad del INDH para presentar acciones judiciales está limitada a ciertos delitos específicos, como genocidio, lesa humanidad, guerra, tortura, desaparición forzada, tráfico ilícito de migrantes y trata de personas. Los delitos de corrupción o contra la Función Pública, como el tráfico de influencias, no están incluidos en las competencias del INDH según la Ley N°20.405, reiteraron. Frente a esto, la diputada Flor Weisse (UDI) señaló que su partido está “respaldando y solicitando esta presentación a Contraloría porque aquí estamos complementando lo que ya pedimos, que es la destitución de los consejeros del Instituto de Derechos Humanos, porque están excediéndose en sus atribuciones. Aquí se ha vulnerado el principio de legalidad y creemos que de forma arbitraria y además con fines electorales, se está presentando la querella que no es lo que les corresponde”. Los legisladores de Chile Vamos argumentan que la acción del INDH implica un uso indebido de los recursos fiscales destinados a la institución, ya que estos recursos deben ser empleados para cumplir con su mandato de protección y promoción de los derechos humanos. En tal sentido, destacan las declaraciones de la consejera del INDH, Beatriz Corbo, quien señaló la falta de prolijidad en la toma de decisiones del Consejo y mencionó presiones a los consejeros. Finalmente, los parlamentarios solicitaron que la Contraloría instruya las medidas administrativas y disciplinarias necesarias para restablecer la legalidad y asegurar la responsabilidad de los funcionarios involucrados, para de esta manera garantizar la transparencia en las actuaciones del INDH."
  // Articulo: "Caso Ojeda: Tarek Saab dice que sospechosos no están en Venezuela y critica duramente a Chile. El fiscal general de Venezuela, Tarek William Saab, fustigó duramente a las autoridades de nuestro país por el crimen de Ronald Ojeda, acusando al Ministerio Público de hacer una investigación de “pobreza extrema”, enfatizando en que los sospechosos no estarían en el país caribeño. Recordemos que la autoridad venezolana ha sido blanco de las críticas por sus cuestionamientos al Ministerio Público, e incluso sus últimos dichos generaron una nota de protesta del Gobierno del presidente Gabriel Boric. Al respecto, en entrevista con Mega, Tarek William Saab, acusó que “lo que estoy viendo yo de las autoridades chilenas, desde el Presidente hasta el parlamentario de menor rango, ofensa y ataque, pero sin argumento. Simplemente, es buscar ofender”. En ese sentido, lamentó “una sucesiva cadena de improperios de ofensas que lanza desde el propio jefe de Estado, presidente Boric, Presidente de Chile, a quien yo ni siquiera mencioné en mi rueda de prensa. El canciller de Chile sucesivamente lanzó tres declaraciones, cada una más ofensiva que las otras, llenas de un odio personal en contra mía”. Por otro lado, Tarek William Saab confirmó el envío de una carta al fiscal nacional, Ángel Valencia, antes de la fallida visita de los dos directores a Chile, quienes no fueron recibidos por el jefe del Ministerio Público. “No fueron recibidos, un acto de descortesía e inamistad totalmente inexplicable y sin precedente, por lo menos en la historia del Ministerio Público bajo mi gestión”, fustigó. “Si vienen dos directores de la Fiscalía Nacional chilena a Venezuela a investigar el lamentable asesinato de un refugiado chileno que vive en Venezuela, un poco comparándolo con lo que ocurrió con Ronald Ojeda en Chile, yo soy el primero que recibiría a esa delegación”, sostuvo. “Lo que han dicho las autoridades chilenas no tienen fundamento ni sustento, Por eso no quisieron que los directores nuestros vieran el expediente, se entrevistasen con el fiscal nacional de Chile, con el fiscal federal, ni se entrevistaran con los familiares de Ronald Ojeda, porque iban a reconfirmar esto, que ya igual hemos recontraconfirmado que es una muy, pero muy débil investigación la que se ha hecho, sin fundamento”, fustigó. En esa línea, tachó la indagatoria de “una pobreza extrema, en la experticia de investigación, en recabar los elementos de convicción para lanzar teorías. Yo quiero preguntar ahora cuáles son las diligencias, los medios de prueba que tiene la Fiscalía Nacional chilena, eso es lo que queríamos nosotros recabar, para decir que fue desde territorio venezolano, con autoridades venezolanas apoyando al Tren de Aragua para que ejecutara esta acción”. En relación con el propio Ronald Ojeda, el fiscal venezolano cuestionó las salidas de Chile del fallecido exmilitar, supuestamente para conspirar en contra del régimen de Nicolás Maduro. “Por qué si Ronald Ojeda tenía el estatus de refugiado, si reconoce que entraba y salía de Chile hacia Venezuela para conspirar, hay un audio donde efectivamente Ronald Ojeda lo confirma antes de que lo mataran ¿Por qué Ojeda en Chile andaba armado, por qué un refugiado tiene que andar armado, por qué tenía uniforme e insignias policiales chilenas?, tenemos esa información”, afirmó. Respecto a los dos sospechosos del crimen, Tarek William Saab aseveró que no se encuentran en Venezuela, pero sin entregar mayores detalles. “Esos dos presuntos indiciados, miembros del tren de Aragua, que señala la justicia chilena, no viven en Venezuela y no están en Venezuela. Pero mi pregunta de esta, ¿por qué si uno de ellos tiene antecedentes por participar en tres secuestros en Chile, por qué la justicia chilena no lo detuvo? ¿Quién es culpable aquí en la impunidad y del crimen?”, acusó. “No están en Venezuela, señores. Hemos hecho todo el esfuerzo a través de los órganos y la red de justicia, tanto policiales o militares, para ubicarlos y no se encuentran. Ahora bien de encontrarse y ser detenidos, nosotros los sancionaríamos con la máxima pena. De comprobarse efectivamente su participación en este hecho abominable, como fue el asesinato de Ronald Ojeda, obviamente, en territorio venezolano. Porque nuestra Constitución establece claramente que está prohibida la extradición”, acotó. Sobre el Tren de Aragua, el fiscal venezolano recordó la liberación de los miembros del peligroso grupo criminal en Los Vilos, deslizando incluso un supuesto pago de “favores”. “Por qué la semana pasada sueltan a tres miembros del Tren de Aragua y los liberan, qué están pagando allí, qué favores está pagando, pregunto yo ahora. Eso lleva a la sospecha, abramos un debate de verdad”, sentenció. “El Tren de Aragua es una banda desarticulada, diezmada, que ha tenido una bendición en Chile, ¿Cuál ha sido esa bendición? Que tres miembros, luego de ser presos en Chile, lo soltaron los tribunales, ¿por qué los soltaron? ¿No es que en la banda más peligrosa del mundo mundial del planeta Tierra?”, cuestionó. “La teoría que yo lanzo, la vuelvo a ratificar. Para mí fue una acción de falsa bandera, una acción ejecutada desde Chile con participación, obviamente, si fue una gran estructura la que ejecuta el secuestro y el asesinato con algún componente de cuerpo policiales chilenos y cuerpos extranjeros”, concluyó."

  const result = await model.generateContent(prompt);
  const response = await result.response;
  const text = response.text();
  console.log(text);
}

run();
