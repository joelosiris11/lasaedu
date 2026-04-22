#!/usr/bin/env node
/**
 * Seed a complete 3-hour "Python desde Cero" course into Firestore.
 *
 * Creates (idempotently):
 *   - 1 course (course_python_3h)
 *   - 6 modules  (mod_py_01 ... mod_py_06)
 *   - 22 lessons (16 text + 6 quiz lessons)
 *   - 1 open section so students can enroll
 *
 * Required env:
 *   GOOGLE_APPLICATION_CREDENTIALS   path to the Firebase service-account JSON
 *                                    (same one seed-admins.mjs uses)
 *
 * Optional env:
 *   INSTRUCTOR_EMAIL                 existing Firebase Auth user that will be
 *                                    listed as the course instructor.
 *                                    Defaults to a.rosario@t-ecogroup.net.
 *
 * Usage:
 *   GOOGLE_APPLICATION_CREDENTIALS=~/keys/lasaedurd-sa.json \
 *   node scripts/seed-python-course.mjs
 *
 * Re-running the script resets the course content without breaking enrollments.
 */

import admin from 'firebase-admin';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const COURSE_ID = 'course_python_3h';
const SECTION_ID = 'sec_python_3h_01';
const INSTRUCTOR_EMAIL = process.env.INSTRUCTOR_EMAIL || 'a.rosario@t-ecogroup.net';

// ---------------------------------------------------------------------------
// Helpers for packaging lesson content the way LessonBuilder saves it
// ---------------------------------------------------------------------------

function textContent(html) {
  return JSON.stringify({ editorMode: 'wysiwyg', html });
}

function quizContent(questions, passingScore = 70) {
  return JSON.stringify({
    questions,
    settings: {
      shuffleQuestions: false,
      shuffleOptions: false,
      showResults: true,
      showCorrectAnswers: true,
      passingScore,
    },
  });
}

let _qIdCounter = 0;
const qid = () => `q${(++_qIdCounter).toString(36)}${Date.now().toString(36).slice(-3)}`;

const single = (question, options, correctIdx, points = 2, explanation) => ({
  id: qid(),
  type: 'single_choice',
  question,
  points,
  explanation,
  options: options.map((text, i) => ({ id: qid(), text, isCorrect: i === correctIdx })),
});

const multi = (question, options, correctIdxs, points = 3, explanation) => ({
  id: qid(),
  type: 'multiple_choice',
  question,
  points,
  explanation,
  options: options.map((text, i) => ({ id: qid(), text, isCorrect: correctIdxs.includes(i) })),
});

const tf = (question, correct, points = 2, explanation) => ({
  id: qid(),
  type: 'true_false',
  question,
  points,
  correctBool: correct,
  explanation,
});

const open = (question, answers, points = 2, explanation) => ({
  id: qid(),
  type: 'open_answer',
  question,
  points,
  acceptedAnswers: answers,
  explanation,
});

const context = (text) => ({
  id: qid(),
  type: 'context',
  question: text,
  points: 0,
});

// ---------------------------------------------------------------------------
// Course curriculum (3 hours total, ~30 min per module)
// ---------------------------------------------------------------------------

const MODULES = [
  // ======================================================================
  // MÓDULO 1 — Primeros Pasos con Python  (≈30 min)
  // ======================================================================
  {
    id: 'mod_py_01',
    title: 'Módulo 1 · Primeros Pasos con Python',
    description: 'Qué es Python, cómo instalarlo y tus primeras líneas de código.',
    order: 0,
    duration: '30 min',
    objectives: [
      'Entender qué hace a Python especial y dónde se usa',
      'Instalar Python y ejecutar un script desde la terminal',
      'Usar variables y los tipos básicos: int, float, str, bool',
    ],
    lessons: [
      {
        id: 'lsn_py_01_01',
        title: '¿Qué es Python y por qué aprenderlo?',
        description: 'Una introducción honesta al lenguaje y al ecosistema.',
        type: 'texto',
        duration: '8 min',
        order: 0,
        content: textContent(`
<h2>¿Qué es Python?</h2>
<p>Python es un lenguaje de programación <strong>interpretado, de alto nivel y de propósito general</strong>. Fue creado por Guido van Rossum en 1991 con una idea muy clara: el código debe leerse como si fuera inglés. Esa legibilidad es su superpoder — y por eso es el lenguaje que se enseña en la mayoría de universidades y el favorito para ciencia de datos, inteligencia artificial, automatización, scraping y desarrollo backend.</p>

<h3>¿Por qué Python y no otro?</h3>
<ul>
  <li><strong>Sintaxis limpia:</strong> usa indentación en lugar de llaves <code>{ }</code>. Lo que escribes es lo que ejecutas.</li>
  <li><strong>Baterías incluidas:</strong> la biblioteca estándar trae módulos para fechas, archivos, HTTP, regex, tests, hilos y más.</li>
  <li><strong>Ecosistema enorme:</strong> <code>pip</code> te da acceso a más de 500,000 paquetes en PyPI.</li>
  <li><strong>Multipropósito:</strong> el mismo lenguaje sirve para un script de 5 líneas y para un backend que atiende millones de usuarios.</li>
</ul>

<h3>Dónde se usa en el mundo real</h3>
<p>Instagram, Spotify, Netflix, Dropbox, la NASA y prácticamente todo el stack de Machine Learning moderno corren sobre Python. No es un lenguaje de juguete — es una herramienta profesional que también es amable con principiantes.</p>

<pre><code># Esto es Python. Se lee casi como una oración en inglés:
if puntaje >= 70:
    print("Aprobado")
else:
    print("Repite el examen")
</code></pre>

<blockquote>Regla que vamos a seguir durante todo el curso: <em>escribe código corto, claro y que puedas leer en voz alta sin tropezar</em>. Si no puedes explicarlo, probablemente puedas simplificarlo.</blockquote>

<h3>¿Python 2 o Python 3?</h3>
<p>Python 2 está muerto desde 2020. Usamos <strong>Python 3</strong> (al momento de escribir este curso, 3.12 o superior). Si ves un tutorial con <code>print "hola"</code> sin paréntesis — es Python 2, ignóralo.</p>
`),
      },
      {
        id: 'lsn_py_01_02',
        title: 'Instalación y tu primer script',
        description: 'De cero a "Hola, mundo" en tu propia máquina.',
        type: 'texto',
        duration: '10 min',
        order: 1,
        content: textContent(`
<h2>Instalar Python en tu máquina</h2>
<p>Cada sistema operativo tiene su atajo. Lo importante es que al final el comando <code>python3 --version</code> te devuelva algo como <code>Python 3.12.x</code>.</p>

<h3>macOS</h3>
<pre><code># La forma limpia y recomendada es usar Homebrew:
brew install python@3.12

# Verifica:
python3 --version
</code></pre>

<h3>Windows</h3>
<p>Descarga el instalador desde <code>python.org/downloads</code>. <strong>Muy importante:</strong> marca la casilla <em>"Add Python to PATH"</em> antes de darle a Install. Sin eso el comando no funciona en la terminal.</p>

<h3>Linux (Ubuntu/Debian)</h3>
<pre><code>sudo apt update
sudo apt install python3 python3-pip
</code></pre>

<h2>Tu primer programa</h2>
<p>Abre tu editor favorito (VS Code es gratis y excelente) y crea un archivo llamado <code>hola.py</code>:</p>

<pre><code># hola.py
nombre = input("¿Cómo te llamas? ")
print(f"¡Hola, {nombre}! Bienvenido a Python.")
</code></pre>

<p>Ejecútalo desde la terminal, parado en la carpeta del archivo:</p>

<pre><code>python3 hola.py
</code></pre>

<h3>El REPL: tu laboratorio interactivo</h3>
<p>Si solo escribes <code>python3</code> sin argumentos, entras al <strong>REPL</strong> (Read-Eval-Print Loop). Es una consola donde cada línea se ejecuta al instante. Úsala para probar ideas sueltas sin crear un archivo:</p>

<pre><code>$ python3
>>> 2 + 2
4
>>> "hola" * 3
'holaholahola'
>>> exit()
</code></pre>

<blockquote>Tip: durante este curso, cada vez que quieras probar "qué pasa si...", abre el REPL. Aprender Python es 80% experimentar.</blockquote>
`),
      },
      {
        id: 'lsn_py_01_03',
        title: 'Variables y tipos básicos',
        description: 'int, float, str, bool — los cuatro cimientos.',
        type: 'texto',
        duration: '8 min',
        order: 2,
        content: textContent(`
<h2>Variables: etiquetas para tus datos</h2>
<p>Una variable en Python es simplemente un <strong>nombre que apunta a un valor</strong>. No declaras el tipo — Python lo deduce solo. Esto se llama <em>tipado dinámico</em>.</p>

<pre><code>edad = 25           # int
altura = 1.75       # float
nombre = "Ana"      # str (string / texto)
es_estudiante = True # bool (True o False — con mayúscula)
</code></pre>

<h3>Los cuatro tipos básicos</h3>
<ul>
  <li><strong>int</strong> — enteros, positivos o negativos: <code>42</code>, <code>-7</code>, <code>0</code>.</li>
  <li><strong>float</strong> — decimales: <code>3.14</code>, <code>-0.5</code>. Ojo: usa <em>punto</em>, no coma.</li>
  <li><strong>str</strong> — cadenas de texto entre comillas: <code>"hola"</code> o <code>'hola'</code>, da igual.</li>
  <li><strong>bool</strong> — verdadero o falso: <code>True</code> / <code>False</code>. Siempre con mayúscula.</li>
</ul>

<h3>Convenciones de nombres</h3>
<p>Python usa <strong>snake_case</strong>: palabras en minúscula separadas por guión bajo.</p>

<pre><code>nombre_completo = "Ana García"     # ✔ correcto
nombreCompleto = "Ana García"      # ✘ eso es camelCase, no pythónico
precio_total = 99.99               # ✔
</code></pre>

<h3>Inspeccionar y convertir tipos</h3>
<pre><code>edad = 25
print(type(edad))        # &lt;class 'int'&gt;
print(type("hola"))      # &lt;class 'str'&gt;

# Conversión explícita (casting):
edad_str = str(edad)      # "25"
precio = float("19.99")   # 19.99
entero = int(3.9)         # 3   (trunca, no redondea)
</code></pre>

<blockquote><strong>Trampa clásica:</strong> <code>input()</code> siempre devuelve un string. Si lees un número desde teclado tienes que convertirlo: <code>edad = int(input("Tu edad: "))</code>.</blockquote>

<h3>Nombres reservados</h3>
<p>Palabras como <code>if</code>, <code>else</code>, <code>for</code>, <code>def</code>, <code>class</code>, <code>return</code>, <code>True</code>, <code>False</code>, <code>None</code> no pueden usarse como nombres de variables. Python te va a marcar error.</p>
`),
      },
      {
        id: 'lsn_py_01_04',
        title: 'Quiz · Módulo 1',
        description: 'Comprueba que tienes clara la base.',
        type: 'quiz',
        duration: '4 min',
        order: 3,
        content: quizContent([
          context('Quiz rápido sobre instalación, tipos básicos y nombres de variables. Son 5 preguntas — respira y piensa antes de marcar.'),
          single(
            '¿Qué versión de Python se usa hoy en día profesionalmente?',
            ['Python 2.7', 'Python 3', 'Ambas por igual', 'La que venga instalada'],
            1,
            2,
            'Python 2 fue descontinuado en 2020. Todo código nuevo debe usar Python 3.'
          ),
          single(
            '¿Cuál es el tipo de dato de la expresión 3.14?',
            ['int', 'float', 'str', 'bool'],
            1,
            2,
            'Los números con punto decimal son de tipo float.'
          ),
          tf(
            'En Python las variables requieren que declares su tipo antes de usarlas.',
            false,
            2,
            'Python es de tipado dinámico — infiere el tipo automáticamente.'
          ),
          multi(
            '¿Cuáles de los siguientes son nombres de variable válidos y pythónicos? (marca todos los correctos)',
            ['nombre_usuario', 'nombreUsuario', '1_intento', 'precio_total', 'if'],
            [0, 3],
            3,
            'Python usa snake_case. No se pueden empezar nombres con un número ni usar palabras reservadas.'
          ),
          open(
            '¿Qué comando de terminal ejecuta el archivo hola.py? (escribe solo el comando)',
            ['python3 hola.py', 'python hola.py'],
            2,
            'python3 hola.py es la forma más portable.'
          ),
        ]),
      },
    ],
  },

  // ======================================================================
  // MÓDULO 2 — Operadores, Entrada y Formateo  (≈28 min)
  // ======================================================================
  {
    id: 'mod_py_02',
    title: 'Módulo 2 · Operadores, Entrada y Formateo',
    description: 'Haz que tu programa calcule, pregunte y responda con estilo.',
    order: 1,
    duration: '28 min',
    objectives: [
      'Dominar operadores aritméticos, de comparación y lógicos',
      'Leer datos del usuario con input() y convertirlos correctamente',
      'Formatear mensajes profesionales con f-strings',
    ],
    lessons: [
      {
        id: 'lsn_py_02_01',
        title: 'Operadores en Python',
        description: 'Aritmética, comparación y lógica en un solo lugar.',
        type: 'texto',
        duration: '10 min',
        order: 0,
        content: textContent(`
<h2>Operadores aritméticos</h2>
<p>Los que ya conoces de la escuela — pero presta atención al <strong>operador de división entera</strong> y al de <strong>módulo</strong>, que son los que más se usan en problemas reales.</p>

<pre><code>a = 10
b = 3

suma        = a + b   # 13
resta       = a - b   # 7
mult        = a * b   # 30
division    = a / b   # 3.3333...  (siempre devuelve float)
div_entera  = a // b  # 3          (descarta decimales)
modulo      = a % b   # 1          (resto de la división)
potencia    = a ** b  # 1000       (a elevado a b)
</code></pre>

<h3>Módulo: el operador más útil que nadie enseña bien</h3>
<p>El operador <code>%</code> devuelve el <em>resto</em>. Se usa constantemente para responder "¿es par?", "¿es múltiplo de X?", "¿qué día de la semana es?".</p>

<pre><code>numero = 14
if numero % 2 == 0:
    print("es par")
else:
    print("es impar")
</code></pre>

<h2>Operadores de comparación</h2>
<p>Siempre devuelven <code>True</code> o <code>False</code>. Son la base de cualquier condicional.</p>

<pre><code>5 == 5    # True   (igualdad, ¡doble igual!)
5 != 4    # True   (distinto)
5 &gt; 3     # True
5 &lt;= 5    # True
"ana" == "Ana"   # False  (Python distingue mayúsculas)
</code></pre>

<blockquote>Error #1 de principiantes: usar <code>=</code> en vez de <code>==</code>. Un igual <em>asigna</em>, dos iguales <em>comparan</em>.</blockquote>

<h2>Operadores lógicos</h2>
<p>En Python se escriben con palabras, no con símbolos como en otros lenguajes.</p>

<pre><code>edad = 20
tiene_ticket = True

# AND: ambas condiciones deben ser True
if edad &gt;= 18 and tiene_ticket:
    print("Puede entrar")

# OR: al menos una debe ser True
if edad &lt; 5 or edad &gt; 65:
    print("Entrada gratis")

# NOT: invierte el valor
if not tiene_ticket:
    print("Compra uno en la entrada")
</code></pre>

<h3>Atajos útiles</h3>
<pre><code># Operadores combinados (muy pythónicos):
x = 10
x += 5    # x = x + 5  → 15
x -= 3    # x = x - 3  → 12
x *= 2    # x = x * 2  → 24
</code></pre>
`),
      },
      {
        id: 'lsn_py_02_02',
        title: 'Interactuando con el usuario: input() y conversión',
        description: 'Leer teclado y no morir en el intento.',
        type: 'texto',
        duration: '8 min',
        order: 1,
        content: textContent(`
<h2>La función input()</h2>
<p><code>input()</code> detiene el programa, muestra un prompt y espera a que el usuario escriba algo + Enter. Lo que devuelve <strong>siempre es un string</strong>, aunque el usuario teclee un número.</p>

<pre><code>nombre = input("¿Cuál es tu nombre? ")
print("Hola,", nombre)
</code></pre>

<h3>El error más común</h3>
<pre><code>edad = input("Tu edad: ")
if edad &gt;= 18:   # 💥 TypeError: '&gt;=' not supported between str and int
    print("Mayor de edad")
</code></pre>

<p>La solución es convertir explícitamente el string a número:</p>

<pre><code>edad = int(input("Tu edad: "))
if edad &gt;= 18:
    print("Mayor de edad")
</code></pre>

<h3>Patrón profesional: validar antes de convertir</h3>
<p>Si el usuario escribe texto donde esperabas un número, <code>int()</code> explota. En producción se suele validar:</p>

<pre><code>entrada = input("Ingresa tu edad: ")
if entrada.isdigit():
    edad = int(entrada)
    print(f"Ok, tienes {edad} años")
else:
    print("Eso no parece un número entero 🤔")
</code></pre>

<h2>Ejemplo completo: calculadora de IMC</h2>
<pre><code>peso = float(input("Peso en kg: "))
altura = float(input("Altura en metros: "))

imc = peso / (altura ** 2)
print("Tu IMC es:", round(imc, 2))
</code></pre>

<p>Ese programa, en 4 líneas, hace algo real: leer datos, calcular y mostrar un resultado. Eso es Python.</p>
`),
      },
      {
        id: 'lsn_py_02_03',
        title: 'F-strings: formateo moderno',
        description: 'Cómo construir mensajes bonitos sin concatenar con "+".',
        type: 'texto',
        duration: '6 min',
        order: 2,
        content: textContent(`
<h2>F-strings: la forma moderna de formatear texto</h2>
<p>Desde Python 3.6 existe una sintaxis para interpolar variables en strings que es <strong>más rápida, más corta y más legible</strong> que todo lo anterior. Se llaman <em>f-strings</em> (f de "formatted").</p>

<pre><code>nombre = "Ana"
edad = 25

# ❌ Forma antigua (concatenación):
print("Hola, " + nombre + ". Tienes " + str(edad) + " años.")

# ❌ .format():
print("Hola, {}. Tienes {} años.".format(nombre, edad))

# ✅ f-string:
print(f"Hola, {nombre}. Tienes {edad} años.")
</code></pre>

<p>Basta con poner una <code>f</code> antes de las comillas y usar <code>{variable}</code> dentro.</p>

<h3>Pueden contener expresiones</h3>
<pre><code>a = 7
b = 3
print(f"{a} + {b} = {a + b}")              # 7 + 3 = 10
print(f"¿Es {a} mayor que {b}? {a &gt; b}")   # ¿Es 7 mayor que 3? True
</code></pre>

<h3>Formato de números</h3>
<p>Dentro de las llaves puedes especificar cómo se muestra el valor. Esto es oro puro para reportes:</p>

<pre><code>precio = 1234.5678

print(f"{precio:.2f}")      # 1234.57   (dos decimales)
print(f"{precio:,.2f}")     # 1,234.57  (con separador de miles)
print(f"{0.85:.0%}")        # 85%       (porcentaje)
print(f"{42:05d}")          # 00042     (rellena con ceros)
</code></pre>

<h3>Ancho y alineación</h3>
<pre><code>for producto, precio in [("Pan", 50), ("Leche", 75), ("Café", 250)]:
    print(f"{producto:&lt;10} | \${precio:&gt;6}")
# Pan        | $    50
# Leche      | $    75
# Café       | $   250
</code></pre>

<blockquote>Si en una entrevista técnica te piden formatear datos en Python y usas <code>+</code> para concatenar, pierdes puntos. Usa f-strings siempre.</blockquote>
`),
      },
      {
        id: 'lsn_py_02_04',
        title: 'Quiz · Módulo 2',
        description: 'Operadores, input y f-strings.',
        type: 'quiz',
        duration: '4 min',
        order: 3,
        content: quizContent([
          single(
            '¿Qué resultado imprime print(7 // 2)?',
            ['3.5', '3', '4', 'Error'],
            1,
            2,
            '// es división entera: descarta los decimales y devuelve 3.'
          ),
          single(
            '¿Para qué sirve el operador %?',
            ['Calcular porcentajes', 'Elevar a potencia', 'Obtener el resto de una división', 'Dividir con decimales'],
            2,
            2,
            'Es el operador módulo: devuelve el resto de la división entera.'
          ),
          tf(
            'La función input() siempre devuelve un valor de tipo string, aunque el usuario escriba un número.',
            true,
            2,
            'Por eso hay que convertir con int() o float() cuando se necesita un número.'
          ),
          single(
            '¿Cuál es la forma moderna y recomendada de construir este mensaje? "Hola, Ana. Tienes 25 años."',
            [
              '"Hola, " + nombre + ". Tienes " + edad + " años."',
              '"Hola, %s. Tienes %s años." % (nombre, edad)',
              'f"Hola, {nombre}. Tienes {edad} años."',
              '"Hola, {}. Tienes {} años.".join(nombre, edad)',
            ],
            2,
            3,
            'Las f-strings son la forma moderna, legible y rápida desde Python 3.6.'
          ),
          open(
            'En el formato f"{precio:.2f}" con precio=10, ¿qué imprime exactamente? (solo el número)',
            ['10.00'],
            2,
            'El formato .2f fuerza dos decimales.'
          ),
        ]),
      },
    ],
  },

  // ======================================================================
  // MÓDULO 3 — Control de Flujo  (≈32 min)
  // ======================================================================
  {
    id: 'mod_py_03',
    title: 'Módulo 3 · Control de Flujo',
    description: 'Toma decisiones y repite acciones. Aquí tu código empieza a ser interesante.',
    order: 2,
    duration: '32 min',
    objectives: [
      'Escribir condicionales claros con if / elif / else',
      'Iterar con for y range',
      'Dominar while, break y continue sin crear loops infinitos',
    ],
    lessons: [
      {
        id: 'lsn_py_03_01',
        title: 'Condicionales: if / elif / else',
        description: 'Enseña a tu programa a decidir.',
        type: 'texto',
        duration: '10 min',
        order: 0,
        content: textContent(`
<h2>if, elif, else</h2>
<p>En Python, la <strong>indentación define el bloque</strong>. No hay llaves — el sangrado (4 espacios por convención) es lo que agrupa el código.</p>

<pre><code>edad = 20

if edad &lt; 13:
    print("Eres niño")
elif edad &lt; 18:
    print("Eres adolescente")
elif edad &lt; 65:
    print("Eres adulto")
else:
    print("Eres adulto mayor")
</code></pre>

<p>Reglas del juego:</p>
<ul>
  <li>Siempre empieza con <code>if</code>.</li>
  <li><code>elif</code> (else-if) es opcional y puedes tener los que quieras.</li>
  <li><code>else</code> es opcional, y solo se ejecuta si ninguno de los anteriores fue <code>True</code>.</li>
  <li>Solo una rama se ejecuta — la primera que dé <code>True</code>.</li>
</ul>

<h3>Operador ternario</h3>
<p>Para asignaciones cortas basadas en una condición existe una sintaxis de una línea. Muy útil, muy pythónica:</p>

<pre><code>edad = 20
tipo = "adulto" if edad &gt;= 18 else "menor"
print(tipo)   # adulto
</code></pre>

<h3>Verdadero y falso en Python</h3>
<p>No solo <code>True</code> es verdadero. En una condición se consideran <strong>falsos</strong>:</p>
<ul>
  <li><code>False</code> y <code>None</code></li>
  <li>El número <code>0</code> (int o float)</li>
  <li>Cadena vacía <code>""</code></li>
  <li>Listas, tuplas, dicts y sets vacíos: <code>[]</code>, <code>()</code>, <code>{}</code>, <code>set()</code></li>
</ul>
<p>Todo lo demás es verdadero. Esto permite escribir código muy limpio:</p>

<pre><code>nombre = input("Tu nombre: ")

if nombre:   # equivale a: if nombre != ""
    print(f"Hola, {nombre}")
else:
    print("No escribiste nada")
</code></pre>

<h3>Anidamiento vs. claridad</h3>
<p>Puedes meter <code>if</code> dentro de <code>if</code>, pero <em>evítalo cuando puedas</em>. Un <code>if</code> con 4 niveles de anidamiento es un código que nadie quiere leer — incluyéndote a ti mismo en 3 semanas.</p>

<pre><code># 🚫 anidado y frágil
if usuario:
    if usuario.activo:
        if usuario.rol == "admin":
            print("Acceso")

# ✅ plano y obvio
if usuario and usuario.activo and usuario.rol == "admin":
    print("Acceso")
</code></pre>
`),
      },
      {
        id: 'lsn_py_03_02',
        title: 'Bucles for y range()',
        description: 'Repetir es la esencia de programar.',
        type: 'texto',
        duration: '10 min',
        order: 1,
        content: textContent(`
<h2>El bucle for</h2>
<p>El <code>for</code> de Python no cuenta como en otros lenguajes — <strong>itera sobre elementos</strong> de una colección (una lista, un string, un rango, etc.). Mucho más natural.</p>

<pre><code>frutas = ["manzana", "plátano", "cereza"]

for fruta in frutas:
    print(f"Me gusta la {fruta}")
</code></pre>

<h3>range(): generador de números</h3>
<p>Para repetir N veces o iterar por índices, usa <code>range()</code>. Acepta 1, 2 o 3 argumentos:</p>

<pre><code>for i in range(5):           # 0, 1, 2, 3, 4
    print(i)

for i in range(2, 6):        # 2, 3, 4, 5 (llega hasta uno antes del fin)
    print(i)

for i in range(0, 10, 2):    # 0, 2, 4, 6, 8 (paso de 2)
    print(i)

for i in range(10, 0, -1):   # 10, 9, 8 ... 1 (cuenta regresiva)
    print(i)
</code></pre>

<blockquote><strong>Clave:</strong> el número final de <code>range</code> es <em>exclusivo</em>. <code>range(5)</code> produce 0,1,2,3,4 — nunca el 5.</blockquote>

<h3>Iterar un string carácter a carácter</h3>
<pre><code>for letra in "python":
    print(letra.upper())
# P
# Y
# T
# H
# O
# N
</code></pre>

<h3>enumerate: cuando necesitas el índice Y el valor</h3>
<p>Muchos principiantes hacen esto (mal):</p>

<pre><code># 🚫 forma innecesariamente complicada
frutas = ["manzana", "plátano", "cereza"]
for i in range(len(frutas)):
    print(i, frutas[i])
</code></pre>

<p>Lo pythónico es:</p>

<pre><code># ✅ enumerate da (índice, valor) en una tupla
for i, fruta in enumerate(frutas):
    print(f"{i}: {fruta}")
# 0: manzana
# 1: plátano
# 2: cereza
</code></pre>

<h3>zip: iterar dos listas en paralelo</h3>
<pre><code>nombres = ["Ana", "Luis", "Marta"]
notas   = [95, 87, 92]

for nombre, nota in zip(nombres, notas):
    print(f"{nombre} sacó {nota}")
</code></pre>
`),
      },
      {
        id: 'lsn_py_03_03',
        title: 'while, break y continue',
        description: 'Cuando no sabes cuántas veces vas a iterar.',
        type: 'texto',
        duration: '8 min',
        order: 2,
        content: textContent(`
<h2>El bucle while</h2>
<p>Un <code>while</code> repite mientras una condición siga siendo <code>True</code>. Úsalo cuando el número de iteraciones <strong>no se conoce de antemano</strong>.</p>

<pre><code>contador = 0
while contador &lt; 5:
    print(contador)
    contador += 1
</code></pre>

<h3>Menú interactivo con while</h3>
<pre><code>while True:
    opcion = input("¿Qué quieres hacer? (salir / saludar): ")
    if opcion == "salir":
        print("Adiós")
        break
    elif opcion == "saludar":
        print("¡Hola!")
    else:
        print("Opción no válida")
</code></pre>

<h2>break y continue</h2>
<p>Dos palabras clave que controlan el flujo <em>dentro</em> del bucle:</p>

<ul>
  <li><strong>break</strong>: sale completamente del bucle más interno.</li>
  <li><strong>continue</strong>: salta a la siguiente iteración sin ejecutar el resto del bloque.</li>
</ul>

<pre><code># Imprime solo los números pares del 0 al 9, y se detiene al llegar al 8
for n in range(10):
    if n == 8:
        break           # corta el for
    if n % 2 != 0:
        continue        # salta los impares
    print(n)
# 0
# 2
# 4
# 6
</code></pre>

<h3>El peligro: loops infinitos</h3>
<pre><code>contador = 0
while contador &lt; 10:
    print(contador)
    # 🚫 olvidamos incrementar → loop infinito
</code></pre>

<p>Si te pasa esto en una terminal: <kbd>Ctrl + C</kbd> detiene el programa.</p>

<blockquote><strong>Regla de oro:</strong> antes de escribir un <code>while</code>, asegúrate de que exista una forma <em>inevitable</em> de que la condición se vuelva <code>False</code> o de que haya un <code>break</code>.</blockquote>

<h3>¿for o while?</h3>
<ul>
  <li>¿Sabes cuántas veces vas a iterar, o estás recorriendo una colección? → <strong>for</strong></li>
  <li>¿Dependes de una condición externa (input del usuario, red, archivo)? → <strong>while</strong></li>
</ul>
`),
      },
      {
        id: 'lsn_py_03_04',
        title: 'Quiz · Módulo 3',
        description: 'Condicionales y bucles.',
        type: 'quiz',
        duration: '4 min',
        order: 3,
        content: quizContent([
          single(
            '¿Cuántos números imprime range(1, 10)?',
            ['10', '9', '11', '8'],
            1,
            2,
            'range(1, 10) produce 1,2,3,4,5,6,7,8,9 — son 9 números. El límite superior es exclusivo.'
          ),
          multi(
            '¿Cuáles de estos valores se consideran "falsos" en un if? (marca todos)',
            ['0', '""', '"False"', '[]', 'None'],
            [0, 1, 3, 4],
            4,
            'El string "False" como texto es verdadero (no está vacío). 0, "", [], y None son falsy.'
          ),
          single(
            '¿Cuál es la diferencia entre break y continue?',
            [
              'break salta a la siguiente iteración, continue sale del bucle',
              'break sale del bucle, continue salta a la siguiente iteración',
              'Ambos salen del bucle',
              'Ambos saltan a la siguiente iteración',
            ],
            1,
            3,
            'break termina el bucle entero; continue salta al siguiente ciclo sin ejecutar el resto.'
          ),
          tf(
            'En Python la indentación es obligatoria — no hay llaves {} para marcar bloques.',
            true,
            2,
            'Así es. El sangrado (convencionalmente 4 espacios) define el bloque.'
          ),
          open(
            '¿Qué función usas junto con for para obtener a la vez el índice y el valor de una lista?',
            ['enumerate', 'enumerate()'],
            2,
            'enumerate(lista) devuelve pares (índice, valor).'
          ),
        ]),
      },
    ],
  },

  // ======================================================================
  // MÓDULO 4 — Estructuras de Datos  (≈32 min)
  // ======================================================================
  {
    id: 'mod_py_04',
    title: 'Módulo 4 · Estructuras de Datos',
    description: 'Listas, diccionarios, tuplas y sets: cuándo y cómo usar cada uno.',
    order: 3,
    duration: '32 min',
    objectives: [
      'Crear, leer, modificar y recorrer listas',
      'Usar diccionarios para organizar información por claves',
      'Saber cuándo elegir tupla, set o lista según el problema',
    ],
    lessons: [
      {
        id: 'lsn_py_04_01',
        title: 'Listas: la estructura más usada de Python',
        description: 'Ordenadas, mutables, con todos los superpoderes.',
        type: 'texto',
        duration: '10 min',
        order: 0,
        content: textContent(`
<h2>¿Qué es una lista?</h2>
<p>Una lista es una <strong>colección ordenada y mutable</strong> de elementos. Puede guardar cualquier tipo — incluso mezclados.</p>

<pre><code>numeros = [1, 2, 3, 4, 5]
frutas = ["manzana", "plátano", "cereza"]
mixto = [1, "dos", 3.0, True, None]
vacia = []
</code></pre>

<h3>Acceso por índice</h3>
<p>Los índices empiezan en <strong>0</strong>. Los negativos cuentan desde el final.</p>

<pre><code>frutas = ["manzana", "plátano", "cereza", "durazno"]

frutas[0]     # "manzana"    — primer elemento
frutas[2]     # "cereza"
frutas[-1]    # "durazno"    — último
frutas[-2]    # "cereza"     — penúltimo
</code></pre>

<h3>Slicing (rebanadas)</h3>
<p>La sintaxis <code>lista[inicio:fin]</code> extrae un segmento. <strong>fin es exclusivo.</strong></p>

<pre><code>nums = [10, 20, 30, 40, 50, 60]

nums[1:4]     # [20, 30, 40]
nums[:3]      # [10, 20, 30]   — desde el inicio
nums[3:]      # [40, 50, 60]   — hasta el final
nums[::2]     # [10, 30, 50]   — saltando de 2 en 2
nums[::-1]    # [60, 50, 40, 30, 20, 10]  — invertida ✨
</code></pre>

<h3>Métodos esenciales</h3>
<pre><code>frutas = ["manzana", "plátano"]

frutas.append("cereza")          # agrega al final   → ["manzana", "plátano", "cereza"]
frutas.insert(1, "kiwi")         # inserta en pos 1  → ["manzana", "kiwi", "plátano", "cereza"]
frutas.remove("kiwi")            # borra el primero que coincida
fruta_final = frutas.pop()       # saca y devuelve el último
frutas.sort()                    # ordena en su sitio
frutas.reverse()                 # invierte en su sitio
len(frutas)                      # cantidad de elementos
"manzana" in frutas              # True / False
</code></pre>

<h3>Comprensiones de lista</h3>
<p>La forma pythónica de construir listas a partir de otras. Se lee como una expresión matemática:</p>

<pre><code>numeros = [1, 2, 3, 4, 5]

cuadrados   = [n ** 2 for n in numeros]              # [1, 4, 9, 16, 25]
pares       = [n for n in numeros if n % 2 == 0]     # [2, 4]
doblados    = [n * 2 if n &gt; 2 else n for n in numeros]
</code></pre>

<p>Una línea reemplaza 4-5 líneas de <code>for</code> + <code>append</code>. Úsalas — son la marca del programador Python intermedio.</p>
`),
      },
      {
        id: 'lsn_py_04_02',
        title: 'Diccionarios: clave → valor',
        description: 'Como un JSON, pero ejecutable.',
        type: 'texto',
        duration: '10 min',
        order: 1,
        content: textContent(`
<h2>Diccionarios</h2>
<p>Un diccionario (<code>dict</code>) guarda <strong>pares clave:valor</strong>. Es la estructura ideal cuando quieres acceder a un dato por un identificador en vez de por posición.</p>

<pre><code>estudiante = {
    "nombre": "Ana García",
    "edad": 22,
    "carrera": "Data Science",
    "activo": True,
}
</code></pre>

<h3>Leer y modificar</h3>
<pre><code>estudiante["nombre"]              # "Ana García"
estudiante["edad"] = 23            # modifica
estudiante["promedio"] = 9.5       # agrega una clave nueva

# Acceso seguro con .get() — no explota si no existe:
estudiante.get("telefono")            # None
estudiante.get("telefono", "N/A")     # "N/A" (valor por defecto)
</code></pre>

<blockquote><strong>Truco:</strong> <code>dict["clave"]</code> tira <code>KeyError</code> si no existe. <code>dict.get("clave")</code> devuelve <code>None</code>. Usa <code>.get()</code> cuando no estés seguro de que la clave exista.</blockquote>

<h3>Eliminar claves</h3>
<pre><code>del estudiante["activo"]
estudiante.pop("carrera")       # saca y devuelve el valor
</code></pre>

<h3>Recorrer un diccionario</h3>
<pre><code>estudiante = {"nombre": "Ana", "edad": 22, "carrera": "DS"}

for clave in estudiante:
    print(clave, estudiante[clave])

# Más pythónico: .items() devuelve pares (clave, valor)
for clave, valor in estudiante.items():
    print(f"{clave}: {valor}")

# Solo las claves o solo los valores
estudiante.keys()     # dict_keys(['nombre', 'edad', 'carrera'])
estudiante.values()   # dict_values(['Ana', 22, 'DS'])
</code></pre>

<h3>Diccionarios anidados</h3>
<p>Un diccionario puede tener listas u otros diccionarios como valores. Así modelas cosas complejas — es casi idéntico a un JSON.</p>

<pre><code>curso = {
    "titulo": "Python en 3h",
    "instructor": "María García",
    "estudiantes": [
        {"nombre": "Ana", "nota": 9.5},
        {"nombre": "Luis", "nota": 8.7},
    ],
}

# Primer estudiante:
print(curso["estudiantes"][0]["nombre"])   # Ana
</code></pre>

<h3>Comprensión de diccionarios</h3>
<pre><code>palabras = ["hola", "mundo", "python"]

# {palabra: longitud}
longitudes = {p: len(p) for p in palabras}
# {'hola': 4, 'mundo': 5, 'python': 6}
</code></pre>
`),
      },
      {
        id: 'lsn_py_04_03',
        title: 'Tuplas y sets: cuándo usarlos',
        description: 'Dos estructuras que muchos principiantes ignoran — y son oro.',
        type: 'texto',
        duration: '8 min',
        order: 2,
        content: textContent(`
<h2>Tuplas: listas inmutables</h2>
<p>Una tupla es como una lista, pero una vez creada <strong>no se puede modificar</strong>. Se escribe con paréntesis.</p>

<pre><code>coordenada = (10.5, -3.2)
colores_rgb = (255, 128, 0)

coordenada[0]     # 10.5
coordenada[0] = 5 # 💥 TypeError: 'tuple' object does not support item assignment
</code></pre>

<h3>¿Para qué sirven?</h3>
<ul>
  <li>Datos que no deben cambiar: coordenadas, fechas, constantes.</li>
  <li>Retornar varios valores desde una función.</li>
  <li>Claves de diccionario (las listas no pueden serlo, las tuplas sí).</li>
</ul>

<h3>Desempaquetado: el patrón más útil</h3>
<pre><code>persona = ("Ana", 22, "DS")
nombre, edad, carrera = persona

print(nombre)      # Ana
print(edad)        # 22

# Intercambiar variables en una línea:
a = 1
b = 2
a, b = b, a
print(a, b)        # 2 1
</code></pre>

<h2>Sets: colecciones sin duplicados</h2>
<p>Un <code>set</code> guarda elementos <strong>únicos</strong> y <strong>sin orden</strong>. Se escribe con llaves.</p>

<pre><code>tags = {"python", "data", "python", "ml"}
print(tags)   # {'python', 'data', 'ml'}   ← duplicado eliminado
</code></pre>

<h3>Eliminar duplicados de una lista</h3>
<pre><code>emails = ["a@x.com", "b@x.com", "a@x.com", "c@x.com"]
unicos = list(set(emails))
print(unicos)   # ['a@x.com', 'b@x.com', 'c@x.com']  (orden no garantizado)
</code></pre>

<h3>Operaciones de conjunto</h3>
<pre><code>a = {1, 2, 3, 4}
b = {3, 4, 5, 6}

a | b    # unión          → {1, 2, 3, 4, 5, 6}
a &amp; b    # intersección   → {3, 4}
a - b    # diferencia      → {1, 2}
a ^ b    # diferencia sim. → {1, 2, 5, 6}
</code></pre>

<h3>¿Cuándo uso cada uno?</h3>
<table>
  <thead><tr><th>Estructura</th><th>Ordenada</th><th>Mutable</th><th>Duplicados</th><th>Úsala cuando...</th></tr></thead>
  <tbody>
    <tr><td><code>list</code></td><td>✅</td><td>✅</td><td>✅</td><td>orden importa y vas a modificar</td></tr>
    <tr><td><code>tuple</code></td><td>✅</td><td>❌</td><td>✅</td><td>los datos son fijos</td></tr>
    <tr><td><code>set</code></td><td>❌</td><td>✅</td><td>❌</td><td>solo te importan elementos únicos</td></tr>
    <tr><td><code>dict</code></td><td>✅ (inserción)</td><td>✅</td><td>claves únicas</td><td>accedes por clave, no posición</td></tr>
  </tbody>
</table>
`),
      },
      {
        id: 'lsn_py_04_04',
        title: 'Quiz · Módulo 4',
        description: 'Listas, diccionarios, tuplas y sets.',
        type: 'quiz',
        duration: '4 min',
        order: 3,
        content: quizContent([
          single(
            '¿Qué devuelve frutas[-1] si frutas = ["manzana", "plátano", "cereza"]?',
            ['manzana', 'cereza', 'Error', 'None'],
            1,
            2,
            'Los índices negativos cuentan desde el final: -1 es el último elemento.'
          ),
          single(
            '¿Qué método agrega un elemento al final de una lista?',
            ['.push()', '.add()', '.append()', '.insert()'],
            2,
            2,
            'Python usa .append() para listas. .push() es de otros lenguajes.'
          ),
          single(
            'En un diccionario d, ¿cuál opción es más segura si no estás seguro de que "x" exista?',
            ['d["x"]', 'd.get("x")', 'd{"x"}', 'd("x")'],
            1,
            3,
            'd["x"] lanza KeyError si no existe; d.get("x") devuelve None.'
          ),
          tf(
            'Una tupla es inmutable: una vez creada no puedes cambiar sus elementos.',
            true,
            2,
            'Esa es exactamente la diferencia entre tuple y list.'
          ),
          open(
            '¿Qué estructura usarías para guardar emails y eliminar duplicados automáticamente? (una palabra)',
            ['set', 'sets'],
            3,
            'Un set no admite duplicados y elimina los repetidos automáticamente.'
          ),
        ]),
      },
    ],
  },

  // ======================================================================
  // MÓDULO 5 — Funciones  (≈30 min)
  // ======================================================================
  {
    id: 'mod_py_05',
    title: 'Módulo 5 · Funciones',
    description: 'Escribe código reutilizable, testeable y fácil de mantener.',
    order: 4,
    duration: '30 min',
    objectives: [
      'Definir funciones con argumentos y valores de retorno',
      'Usar parámetros por defecto, *args, **kwargs y lambdas',
      'Saber cuándo extraer código a una función',
    ],
    lessons: [
      {
        id: 'lsn_py_05_01',
        title: 'Definir funciones',
        description: 'La unidad de reutilización en Python.',
        type: 'texto',
        duration: '12 min',
        order: 0,
        content: textContent(`
<h2>def: cómo se define una función</h2>
<pre><code>def saludar(nombre):
    return f"Hola, {nombre}"

mensaje = saludar("Ana")
print(mensaje)   # Hola, Ana
</code></pre>

<p>Partes:</p>
<ul>
  <li><code>def</code> — palabra clave que inicia la definición.</li>
  <li><code>saludar</code> — nombre (snake_case).</li>
  <li><code>(nombre)</code> — parámetros.</li>
  <li><code>return</code> — devuelve un valor a quien llamó la función.</li>
</ul>

<h3>Sin return explícito</h3>
<p>Si una función no tiene <code>return</code>, devuelve <code>None</code> automáticamente. Sirve para funciones que tienen un <em>efecto</em> pero no producen un valor.</p>

<pre><code>def imprimir_banner(texto):
    print("=" * 30)
    print(texto)
    print("=" * 30)

imprimir_banner("Bienvenido")
</code></pre>

<h3>Funciones con varios parámetros</h3>
<pre><code>def calcular_imc(peso, altura):
    return peso / (altura ** 2)

print(calcular_imc(70, 1.75))     # positional: peso=70, altura=1.75
print(calcular_imc(altura=1.75, peso=70))   # keyword arguments (cualquier orden)
</code></pre>

<h3>Docstrings: documenta tus funciones</h3>
<p>La línea inmediatamente después del <code>def</code> puede ser un string de documentación. <code>help(funcion)</code> lo muestra.</p>

<pre><code>def calcular_imc(peso, altura):
    """
    Calcula el Índice de Masa Corporal.

    Args:
        peso: peso en kilogramos (float)
        altura: altura en metros (float)

    Returns:
        IMC como float
    """
    return peso / (altura ** 2)

help(calcular_imc)
</code></pre>

<h3>Tip: retorna temprano para evitar anidamiento</h3>
<pre><code># 🚫 anidado
def descuento(precio, es_vip):
    if precio &gt; 0:
        if es_vip:
            return precio * 0.8
        else:
            return precio * 0.95
    else:
        return 0

# ✅ retorno temprano — "guard clauses"
def descuento(precio, es_vip):
    if precio &lt;= 0:
        return 0
    if es_vip:
        return precio * 0.8
    return precio * 0.95
</code></pre>

<h3>Regla práctica: ¿cuándo extraer a función?</h3>
<ul>
  <li>Cuando reutilizas un bloque de código en 2 o más sitios.</li>
  <li>Cuando un bloque es largo y puedes nombrarlo con un verbo claro.</li>
  <li>Cuando quieres testearlo aisladamente.</li>
</ul>
`),
      },
      {
        id: 'lsn_py_05_02',
        title: 'Defaults, *args, **kwargs y lambdas',
        description: 'Flexibilidad total al diseñar tus funciones.',
        type: 'texto',
        duration: '10 min',
        order: 1,
        content: textContent(`
<h2>Valores por defecto</h2>
<p>Puedes dar un valor predeterminado a un parámetro. Si quien llama no lo pasa, se usa el default.</p>

<pre><code>def saludar(nombre, saludo="Hola"):
    return f"{saludo}, {nombre}"

saludar("Ana")                  # "Hola, Ana"
saludar("Ana", "Buenas noches") # "Buenas noches, Ana"
saludar("Ana", saludo="Hey")    # "Hey, Ana"
</code></pre>

<blockquote><strong>Trampa famosa:</strong> nunca uses una lista o un diccionario como valor por defecto — el mismo objeto se comparte entre todas las llamadas. Usa <code>None</code> y crea la lista dentro de la función.</blockquote>

<pre><code># 🚫 bug silencioso
def agregar(item, lista=[]):
    lista.append(item)
    return lista

# ✅ correcto
def agregar(item, lista=None):
    if lista is None:
        lista = []
    lista.append(item)
    return lista
</code></pre>

<h2>*args: número variable de argumentos posicionales</h2>
<pre><code>def sumar(*numeros):
    total = 0
    for n in numeros:
        total += n
    return total

sumar(1, 2, 3)           # 6
sumar(10, 20, 30, 40)    # 100
sumar()                  # 0
</code></pre>

<p><code>*numeros</code> recoge todos los argumentos posicionales extra en una <strong>tupla</strong>. El nombre puede ser cualquiera; la convención es <code>*args</code>.</p>

<h2>**kwargs: número variable de argumentos con nombre</h2>
<pre><code>def crear_usuario(**datos):
    for clave, valor in datos.items():
        print(f"{clave} = {valor}")

crear_usuario(nombre="Ana", edad=22, ciudad="Madrid")
# nombre = Ana
# edad = 22
# ciudad = Madrid
</code></pre>

<p><code>**kwargs</code> recoge los argumentos con nombre en un <strong>diccionario</strong>.</p>

<h3>Todo junto</h3>
<pre><code>def informe(titulo, *secciones, autor="Anónimo", **extras):
    print(f"== {titulo} (por {autor}) ==")
    for s in secciones:
        print("-", s)
    for clave, valor in extras.items():
        print(f"{clave}: {valor}")

informe(
    "Reporte Q1",
    "ventas", "marketing", "operaciones",
    autor="Ana",
    fecha="2025-03-31",
)
</code></pre>

<h2>Funciones lambda: anónimas y cortas</h2>
<p>Cuando necesitas una función diminuta para pasársela a otra función (típicamente <code>sorted</code>, <code>map</code>, <code>filter</code>) no hace falta crear un <code>def</code>.</p>

<pre><code># Función normal:
def al_cuadrado(x):
    return x ** 2

# Equivalente con lambda:
al_cuadrado = lambda x: x ** 2

# Caso real — ordenar por la segunda posición:
productos = [("pan", 50), ("leche", 30), ("huevos", 80)]
productos.sort(key=lambda p: p[1])
print(productos)   # [('leche', 30), ('pan', 50), ('huevos', 80)]
</code></pre>

<p>Regla: si tu lambda necesita más de una expresión, usa <code>def</code>.</p>
`),
      },
      {
        id: 'lsn_py_05_03',
        title: 'Quiz · Módulo 5',
        description: 'Funciones, defaults, args y lambdas.',
        type: 'quiz',
        duration: '8 min',
        order: 2,
        content: quizContent([
          context('Este quiz tiene 6 preguntas. Si tienes dudas, vuelve a las lecciones antes de responder — no hay prisa.'),
          single(
            '¿Qué devuelve una función que no tiene declaración return?',
            ['0', '""', 'None', 'Error'],
            2,
            2,
            'En Python, una función sin return devuelve None implícitamente.'
          ),
          single(
            'En def f(a, b=10), ¿qué pasa si llamas f(5)?',
            ['Error: falta b', 'a vale 5, b vale 10', 'a vale 10, b vale 5', 'a vale 5, b vale None'],
            1,
            2,
            'b tiene valor por defecto 10, así que usa ese si no lo pasas.'
          ),
          single(
            '¿Qué tipo de estructura recibe *args dentro de la función?',
            ['lista', 'tupla', 'diccionario', 'set'],
            1,
            3,
            'args es una tupla con todos los argumentos posicionales extra.'
          ),
          single(
            '¿Qué tipo de estructura recibe **kwargs dentro de la función?',
            ['lista', 'tupla', 'diccionario', 'set'],
            2,
            3,
            'kwargs es un diccionario {nombre: valor} con los argumentos por nombre extra.'
          ),
          tf(
            'Usar una lista mutable como valor por defecto de un parámetro es una buena práctica en Python.',
            false,
            2,
            'Es un bug famoso: la lista se comparte entre llamadas. Usa None y crea la lista dentro.'
          ),
          open(
            'Completa: para ordenar una lista de tuplas por el segundo elemento usamos sorted(lista, key=______ x: x[1]). ¿Qué va en el espacio?',
            ['lambda'],
            3,
            'lambda x: x[1] crea una mini-función que devuelve el segundo elemento.'
          ),
        ]),
      },
    ],
  },

  // ======================================================================
  // MÓDULO 6 — Archivos, Errores y POO  (≈30 min)
  // ======================================================================
  {
    id: 'mod_py_06',
    title: 'Módulo 6 · Archivos, Errores y Objetos',
    description: 'Escribe programas de verdad: leen archivos, sobreviven a errores y modelan el mundo con clases.',
    order: 5,
    duration: '30 min',
    objectives: [
      'Leer y escribir archivos de texto de forma segura',
      'Manejar errores con try / except sin esconderlos',
      'Modelar entidades con clases, atributos y métodos',
    ],
    lessons: [
      {
        id: 'lsn_py_06_01',
        title: 'Leer y escribir archivos',
        description: 'with open(): tu mejor amigo para no olvidar cerrar archivos.',
        type: 'texto',
        duration: '8 min',
        order: 0,
        content: textContent(`
<h2>Abrir archivos: patrón with</h2>
<p>Siempre usa <code>with open(...) as f</code>. Cierra el archivo automáticamente incluso si ocurre un error a mitad de la lectura.</p>

<pre><code># Leer todo el archivo como un string
with open("notas.txt", "r", encoding="utf-8") as f:
    contenido = f.read()

print(contenido)
</code></pre>

<h3>Modos de apertura</h3>
<ul>
  <li><code>"r"</code> — lectura (por defecto). Falla si el archivo no existe.</li>
  <li><code>"w"</code> — escritura. <strong>Borra</strong> el archivo si ya existe.</li>
  <li><code>"a"</code> — append: escribe al final, preservando el contenido.</li>
  <li><code>"x"</code> — crear: falla si el archivo ya existe (útil para no sobrescribir).</li>
</ul>

<h3>Leer línea por línea (mucho más eficiente)</h3>
<pre><code>with open("datos.csv", "r", encoding="utf-8") as f:
    for linea in f:
        print(linea.strip())   # .strip() quita el salto de línea
</code></pre>

<h3>Escribir en un archivo</h3>
<pre><code>lineas = ["Ana,95", "Luis,87", "Marta,92"]

with open("notas.csv", "w", encoding="utf-8") as f:
    for linea in lineas:
        f.write(linea + "\\n")
</code></pre>

<blockquote>Incluye siempre <code>encoding="utf-8"</code>. Sin eso, tus acentos y ñ pueden verse como basura en Windows.</blockquote>

<h3>Archivos JSON</h3>
<p>Para datos estructurados, la biblioteca estándar tiene <code>json</code>:</p>

<pre><code>import json

usuario = {"nombre": "Ana", "edad": 22, "intereses": ["python", "data"]}

# Escribir
with open("usuario.json", "w", encoding="utf-8") as f:
    json.dump(usuario, f, ensure_ascii=False, indent=2)

# Leer
with open("usuario.json", "r", encoding="utf-8") as f:
    data = json.load(f)

print(data["nombre"])   # Ana
</code></pre>
`),
      },
      {
        id: 'lsn_py_06_02',
        title: 'Manejo de errores con try/except',
        description: 'Nunca dejes que tu programa muera sin explicación.',
        type: 'texto',
        duration: '8 min',
        order: 1,
        content: textContent(`
<h2>¿Qué es una excepción?</h2>
<p>Cuando Python no puede ejecutar una operación (dividir por cero, abrir un archivo que no existe, convertir texto a número, etc.), <em>levanta una excepción</em>. Si nadie la captura, el programa termina con un traceback.</p>

<h2>try / except</h2>
<pre><code>try:
    numero = int(input("Escribe un número: "))
    resultado = 100 / numero
    print(f"100 / {numero} = {resultado}")
except ZeroDivisionError:
    print("No puedes dividir entre cero")
except ValueError:
    print("Eso no era un número válido")
</code></pre>

<p>Reglas:</p>
<ul>
  <li>Captura <strong>excepciones específicas</strong>, no <code>except:</code> pelado — eso esconde bugs.</li>
  <li>Pon en <code>try</code> solo las líneas que <em>pueden</em> fallar, no todo el programa.</li>
  <li>El bloque <code>else</code> se ejecuta si <em>no hubo</em> excepción. El bloque <code>finally</code> se ejecuta siempre.</li>
</ul>

<h3>Ejemplo completo</h3>
<pre><code>try:
    with open("datos.txt", "r") as f:
        contenido = f.read()
except FileNotFoundError:
    print("El archivo no existe")
except PermissionError:
    print("No tengo permisos para leer el archivo")
else:
    print("Leí correctamente:", len(contenido), "caracteres")
finally:
    print("Terminé el intento de lectura")
</code></pre>

<h3>Capturar el objeto de la excepción</h3>
<pre><code>try:
    edad = int(input("Edad: "))
except ValueError as e:
    print("Error:", e)     # p.ej. "invalid literal for int() with base 10: 'abc'"
</code></pre>

<h3>Lanzar tus propias excepciones</h3>
<pre><code>def retirar(saldo, monto):
    if monto &lt;= 0:
        raise ValueError("El monto debe ser positivo")
    if monto &gt; saldo:
        raise ValueError("Fondos insuficientes")
    return saldo - monto

retirar(100, -5)    # 💥 ValueError
</code></pre>

<blockquote><strong>Regla profesional:</strong> captura <em>solo</em> las excepciones que sabes cómo manejar. Las demás, déjalas subir — es mejor un error ruidoso que un bug silencioso.</blockquote>
`),
      },
      {
        id: 'lsn_py_06_03',
        title: 'Clases y objetos (POO)',
        description: 'Agrupa datos y comportamiento en una sola unidad.',
        type: 'texto',
        duration: '8 min',
        order: 2,
        content: textContent(`
<h2>¿Qué es una clase?</h2>
<p>Una <strong>clase</strong> es una plantilla para crear <em>objetos</em>. Cada objeto tiene sus propios datos (atributos) y sus propias acciones (métodos).</p>

<pre><code>class Estudiante:
    def __init__(self, nombre, edad):
        self.nombre = nombre
        self.edad = edad
        self.notas = []

    def agregar_nota(self, nota):
        self.notas.append(nota)

    def promedio(self):
        if not self.notas:
            return 0
        return sum(self.notas) / len(self.notas)

    def __str__(self):
        return f"{self.nombre} ({self.edad} años) — promedio: {self.promedio():.2f}"
</code></pre>

<h3>Crear y usar objetos</h3>
<pre><code>ana = Estudiante("Ana", 22)
ana.agregar_nota(9.5)
ana.agregar_nota(8.7)
ana.agregar_nota(9.0)

print(ana.promedio())   # 9.066...
print(ana)              # Ana (22 años) — promedio: 9.07
</code></pre>

<h3>Piezas clave</h3>
<ul>
  <li><code>__init__</code> — el <em>constructor</em>. Se ejecuta al crear un objeto.</li>
  <li><code>self</code> — referencia al objeto actual. Es siempre el primer parámetro de los métodos.</li>
  <li><code>__str__</code> — define cómo se imprime el objeto con <code>print()</code>.</li>
</ul>

<h3>Herencia: reutilizar y extender</h3>
<pre><code>class Persona:
    def __init__(self, nombre, edad):
        self.nombre = nombre
        self.edad = edad

    def saludar(self):
        return f"Hola, soy {self.nombre}"

class Estudiante(Persona):
    def __init__(self, nombre, edad, carrera):
        super().__init__(nombre, edad)      # llama al __init__ de Persona
        self.carrera = carrera

    def saludar(self):
        base = super().saludar()
        return f"{base} y estudio {self.carrera}"

ana = Estudiante("Ana", 22, "Data Science")
print(ana.saludar())
# Hola, soy Ana y estudio Data Science
</code></pre>

<h3>¿Cuándo usar clases y cuándo no?</h3>
<p>No todo necesita una clase. Una regla simple:</p>
<ul>
  <li>Si tu programa tiene <strong>entidades con estado</strong> (un usuario, un pedido, una cuenta), las clases brillan.</li>
  <li>Si solo transformas datos una vez (ETL, scripts), funciones sueltas suelen ser más claras.</li>
</ul>

<blockquote>Felicidades: con lo de este módulo ya puedes escribir programas que leen archivos reales, manejan errores y modelan entidades del mundo. Eso es Python funcional. Sigue el siguiente quiz para cerrar el curso.</blockquote>
`),
      },
      {
        id: 'lsn_py_06_04',
        title: 'Examen Final · Todo el Curso',
        description: 'Demuestra que ya sabes Python.',
        type: 'quiz',
        duration: '6 min',
        order: 3,
        content: quizContent([
          context('Examen final — 8 preguntas cubriendo todo el curso. Necesitas 70% para aprobar. ¡Éxito!'),
          single(
            '¿Cuál de estas líneas abre un archivo para LECTURA de forma segura?',
            [
              'open("a.txt", "w")',
              'with open("a.txt", "r") as f:',
              'File("a.txt").read()',
              'import "a.txt"',
            ],
            1,
            2,
            'with open(..., "r") as f es el patrón seguro: cierra el archivo automáticamente.'
          ),
          single(
            'Si abres un archivo con modo "w" y el archivo ya existe...',
            ['Se añade al final', 'Se borra su contenido', 'Lanza un error', 'No se puede escribir'],
            1,
            2,
            '"w" sobrescribe. Usa "a" si quieres añadir.'
          ),
          single(
            '¿Qué excepción captura try/except cuando un archivo no existe?',
            ['ValueError', 'KeyError', 'FileNotFoundError', 'IndexError'],
            2,
            2,
            'FileNotFoundError es la excepción específica para archivos inexistentes.'
          ),
          tf(
            'except: solo (sin especificar tipo) es una buena práctica porque atrapa cualquier error.',
            false,
            2,
            'Al revés: esconde bugs. Siempre captura excepciones específicas.'
          ),
          single(
            '¿Cuál es el primer parámetro de todos los métodos de instancia en una clase?',
            ['this', 'self', 'cls', 'me'],
            1,
            3,
            'En Python se llama self por convención — y siempre es el primero.'
          ),
          single(
            '¿Qué método especial define cómo se muestra un objeto con print()?',
            ['__init__', '__str__', '__repr__', '__show__'],
            1,
            2,
            '__str__ define la representación legible para humanos.'
          ),
          multi(
            '¿Cuáles son ventajas de extraer código a una función? (marca todas las correctas)',
            [
              'Se puede reutilizar',
              'Se puede testear aisladamente',
              'Hace el código más lento',
              'Le da un nombre descriptivo al bloque',
              'Evita tener que usar Python',
            ],
            [0, 1, 3],
            3,
            'Reutilización, testeabilidad y claridad. No afecta velocidad significativamente.'
          ),
          open(
            '¿Qué palabra clave define una función en Python? (solo la palabra)',
            ['def'],
            2,
            'def es la palabra clave para definir funciones.'
          ),
        ]),
      },
    ],
  },
];

// ---------------------------------------------------------------------------
// Seed routine
// ---------------------------------------------------------------------------

function assertEnv() {
  if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    console.error('Missing required env var: GOOGLE_APPLICATION_CREDENTIALS');
    console.error('Example:');
    console.error('  GOOGLE_APPLICATION_CREDENTIALS=~/keys/lasaedurd-sa.json node scripts/seed-python-course.mjs');
    process.exit(1);
  }
}

async function resolveInstructor(auth) {
  try {
    const u = await auth.getUserByEmail(INSTRUCTOR_EMAIL);
    return {
      id: u.uid,
      name: u.displayName || INSTRUCTOR_EMAIL.split('@')[0],
    };
  } catch (err) {
    console.warn(`⚠ Could not look up instructor ${INSTRUCTOR_EMAIL}: ${err?.message ?? err}`);
    console.warn('  Falling back to placeholder instructor. Update the course in the UI afterwards.');
    return { id: 'instructor_unknown', name: 'Instructor LasaEdu' };
  }
}

async function seedCourse(db, instructor) {
  const now = Date.now();

  const totalLessons = MODULES.reduce((acc, m) => acc + m.lessons.length, 0);
  const totalQuizzes = MODULES.reduce(
    (acc, m) => acc + m.lessons.filter((l) => l.type === 'quiz').length,
    0
  );

  // ---------- Course document ----------
  const courseDoc = {
    id: COURSE_ID,
    title: 'Python desde Cero — 3 horas para empezar a programar',
    description:
      'Curso intensivo para pasar de cero absoluto a escribir tus primeros programas útiles en Python. En 3 horas cubrimos sintaxis, control de flujo, estructuras de datos, funciones, manejo de archivos, errores y una introducción práctica a objetos.',
    instructor: instructor.name,
    instructorId: instructor.id,
    category: 'programacion',
    level: 'principiante',
    duration: '3 horas',
    status: 'publicado',
    image:
      'https://images.unsplash.com/photo-1526379095098-d400fd0bf935?auto=format&fit=crop&w=1200&q=80',
    rating: 0,
    studentsCount: 0,
    sectionsCount: 1,
    tags: ['python', 'programacion', 'principiante', 'fundamentos'],
    requirements: [
      'Computadora con Python 3.10 o superior instalado',
      'Un editor de texto (recomendado: VS Code)',
      'Ganas de practicar — el código aprende haciéndolo, no mirándolo',
    ],
    objectives: [
      'Leer, entender y escribir código Python idiomático',
      'Dominar variables, control de flujo y estructuras de datos',
      'Escribir funciones reutilizables con argumentos avanzados',
      'Leer/escribir archivos y manejar errores de forma segura',
      'Modelar entidades del mundo real con clases y objetos',
    ],
    createdAt: now,
    updatedAt: now,
  };

  await db.collection('courses').doc(COURSE_ID).set(courseDoc, { merge: true });
  console.log(`✓ courses/${COURSE_ID}`);

  // ---------- Modules + lessons ----------
  for (const mod of MODULES) {
    const moduleDoc = {
      id: mod.id,
      courseId: COURSE_ID,
      title: mod.title,
      description: mod.description,
      order: mod.order,
      duration: mod.duration,
      objectives: mod.objectives,
      status: 'publicado',
      createdAt: now,
      updatedAt: now,
    };

    await db.collection('modules').doc(mod.id).set(moduleDoc, { merge: true });
    console.log(`  ✓ modules/${mod.id} — ${mod.title}`);

    for (const lesson of mod.lessons) {
      const lessonDoc = {
        id: lesson.id,
        moduleId: mod.id,
        courseId: COURSE_ID,
        title: lesson.title,
        description: lesson.description,
        type: lesson.type,
        content: lesson.content,
        duration: lesson.duration,
        order: lesson.order,
        settings: {
          isRequired: true,
          allowComments: true,
          showProgress: true,
          ...(lesson.type === 'quiz' ? { passingScore: 70, maxAttempts: 3 } : {}),
        },
        status: 'publicado',
        createdAt: now,
        updatedAt: now,
      };

      await db.collection('lessons').doc(lesson.id).set(lessonDoc, { merge: true });
      console.log(`    · lessons/${lesson.id} [${lesson.type}] — ${lesson.title}`);
    }
  }

  // ---------- One open section so students can enroll ----------
  const startDate = now;
  const endDate = now + 1000 * 60 * 60 * 24 * 90; // +90 days

  const sectionDoc = {
    id: SECTION_ID,
    courseId: COURSE_ID,
    title: 'Python desde Cero · Cohorte abierta',
    description: 'Cohorte de acceso libre para estudiantes nuevos en la plataforma.',
    instructorId: instructor.id,
    instructorName: instructor.name,
    startDate,
    endDate,
    accessType: 'publico',
    enrollmentLimit: null,
    courseTitle: courseDoc.title,
    courseCategory: courseDoc.category,
    courseLevel: courseDoc.level,
    courseImage: courseDoc.image,
    studentsCount: 0,
    status: 'activa',
    createdAt: now,
    updatedAt: now,
  };

  await db.collection('sections').doc(SECTION_ID).set(sectionDoc, { merge: true });
  console.log(`✓ sections/${SECTION_ID}`);

  console.log('');
  console.log(`Resumen: 1 curso · ${MODULES.length} módulos · ${totalLessons} lecciones (${totalQuizzes} quizzes) · 1 sección`);
}

async function main() {
  assertEnv();

  admin.initializeApp({
    credential: admin.credential.applicationDefault(),
  });

  const auth = admin.auth();
  const db = admin.firestore();

  const instructor = await resolveInstructor(auth);
  console.log(`Instructor: ${instructor.name} (${instructor.id})`);
  console.log('Seeding Python course...\n');

  await seedCourse(db, instructor);

  console.log('\nDone. El curso ya está publicado en Firestore.');
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
