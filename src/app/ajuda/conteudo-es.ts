import type { Pergunta, Secao } from './conteudo-pt';

// Centro de ayuda en español. Mismos ids de sección que conteudo-pt.ts. La
// sección de Tesorería queda fuera: sigue las normas de la IPB (Brasil).
export const SECOES_ES: Secao[] = [
  {
    id: 'comecar',
    titulo: 'Crear la iglesia en OIKOS Hub',
    resumo: 'Quien crea la iglesia queda como responsable y entra directo al panel.',
    onde: { rotulo: 'Crear mi iglesia', href: '/comecar' },
    blocos: [
      {
        tipo: 'passos',
        itens: [
          'En la página de inicio, haz clic en “Crear mi iglesia”.',
          'Indica el nombre de la iglesia, la sigla (opcional), la ciudad y el horario del culto principal.',
          'Elige la dirección pública. El sistema sugiere una a partir de las iniciales («Iglesia Presbiteriana de la Gracia» pasa a «ipg») y muestra al instante si está libre.',
          'Indica si eres pastor(a) o parte del liderazgo/secretaría, y escribe tu nombre, correo y una contraseña.',
          'Listo: entras al panel con la guía de primeros pasos abierta.',
        ],
      },
      {
        tipo: 'dica',
        texto:
          'Una dirección corta es mejor: es lo que la iglesia va a escribir y compartir. Si las iniciales ya están en uso, agrega la ciudad (ej.: ipg-lima).',
      },
      {
        tipo: 'p',
        texto:
          '¿Ya tienes cuenta en OIKOS Hub (por ejemplo, como miembro de otra iglesia)? Inicia sesión primero y luego abre “Crear mi iglesia”: la nueva iglesia se agrega a tu cuenta y cambias entre ellas con el selector en la parte superior del panel.',
      },
    ],
  },
  {
    id: 'dados-da-igreja',
    titulo: 'Datos de la iglesia: logo, dirección, cultos y liturgia',
    resumo: 'Todo lo que aparece en la página pública y el modelo que se usa para armar cada boletín.',
    onde: { rotulo: 'Panel → Datos de la iglesia', href: '/admin/igrejas' },
    blocos: [
      {
        tipo: 'lista',
        itens: [
          'Nombres: el nombre visible aparece en todo el sistema; el nombre corto en los menús y en el ícono de la app; el nombre legal solo si existe un nombre oficial más largo.',
          'Dirección del enlace (slug): se puede cambiar, pero quien guardó el enlace anterior lo perderá. Evita cambiarla después de compartirla.',
          'Logo: haz clic en “Subir imagen” y elige un archivo de la computadora o una foto del celular. Si la imagen no es cuadrada, usamos el centro. Se convierte en el ícono cuando alguien instala el boletín en el celular.',
          'Dirección, teléfono, WhatsApp y redes sociales: aparecen para los visitantes en la página pública.',
          'Cultos: registra cada culto y reunión con día y horario.',
          'Presentación pública: título y texto de “Sobre la iglesia”. Si el texto queda vacío, el enlace no aparece.',
        ],
      },
      {
        tipo: 'p',
        texto:
          'La liturgia se configura en dos pasos: (1) en “Tipos disponibles”, agrega las partes que usa la iglesia (Preludio, Confesión, Predicación…); (2) en “Orden predeterminado del culto”, organiza la secuencia y el texto predeterminado de cada parte. Toda iglesia nueva empieza con un modelo reformado simple, que puedes ajustar como quieras.',
      },
      {
        tipo: 'dica',
        texto: 'Configura la liturgia antes del primer boletín: cada boletín nuevo ya nace con ese orden completado.',
      },
    ],
  },
  {
    id: 'boletins',
    titulo: 'Boletines y liturgia del culto',
    resumo: 'El corazón del sistema: el orden del culto, los cánticos y los avisos que la iglesia ve en el celular.',
    onde: { rotulo: 'Panel → Boletines', href: '/cultos' },
    blocos: [
      {
        tipo: 'passos',
        itens: [
          'Abre “Boletines” y crea uno nuevo. El sistema sugiere el próximo domingo y avisa si la fecha es inusual.',
          'La liturgia ya viene completada con el modelo de la iglesia. Ajusta lo que necesites; los títulos de los elementos se pueden escribir libremente.',
          'En los elementos con música, elige los cánticos y el tono. Junto a cada cántico aparece hace cuánto no se canta (reciente, moderado, hace tiempo), para variar el repertorio.',
          'Completa el texto público de lo que la iglesia debe leer (lecturas, confesión, credo).',
          'Agrega las secciones del boletín: Avisos, Pedidos de oración, Agenda, Informativo u Otros.',
          'Guarda. El boletín aparece en la dirección pública de la iglesia.',
        ],
      },
      {
        tipo: 'dica',
        texto:
          'Hay dos capas de texto: la “pública”, que ve la iglesia, y la nota interna, que solo ve el liderazgo (ej.: “pedir a un hermano que ore”).',
      },
      {
        tipo: 'p',
        texto: 'Los boletines de semanas anteriores siguen disponibles en la página pública, en “Boletines anteriores”.',
      },
    ],
  },
  {
    id: 'canticos',
    titulo: 'Cánticos y repertorio',
    resumo: 'El acervo musical de la iglesia: letra, acordes y tono de cada cántico.',
    onde: { rotulo: 'Panel → Música', href: '/canticos' },
    blocos: [
      {
        tipo: 'lista',
        itens: [
          'Registra los cánticos que canta la iglesia, con letra y acordes. Aparecerán al elegir la música del boletín.',
          'El equipo de alabanza abre la letra y los acordes desde el celular, a partir del boletín.',
          'Mostrar letras de canciones suele requerir una licencia (como CCLI). Verifica que la iglesia la tenga para lo que publica.',
        ],
      },
    ],
  },
  {
    id: 'escalas',
    titulo: 'Turnos de alabanza y servicio',
    resumo: 'Quién toca, canta y sirve en cada culto, y la confirmación de cada uno.',
    onde: { rotulo: 'Panel → Turnos', href: '/admin/escalas' },
    blocos: [
      {
        tipo: 'passos',
        itens: [
          'Abre “Turnos” y crea un turno para la fecha del culto.',
          'Vincúlalo a un boletín existente o deja que el sistema cree uno nuevo con la liturgia predeterminada.',
          'Agrega a las personas y la función de cada una (voz, guitarra, sonido, proyección…). Las funciones vienen de las habilidades registradas en Personas.',
          'Cambia el estado a “Publicado” cuando esté listo; antes de eso solo lo ve el liderazgo.',
          'Usa “Compartir por WhatsApp”: el turno sale con formato, listo para pegar en el grupo.',
        ],
      },
      {
        tipo: 'dica',
        texto: 'Cada persona del turno que tiene acceso al sistema lo ve en su propio panel y puede confirmar su asistencia.',
      },
    ],
  },
  {
    id: 'pessoas-e-acessos',
    titulo: 'Personas, equipo y accesos',
    resumo: 'Registra a la iglesia y decide quién entra al panel y con qué cargo.',
    onde: { rotulo: 'Panel → Usuarios', href: '/admin/usuarios' },
    blocos: [
      {
        tipo: 'p',
        texto:
          'Hay dos tipos de registro. Las “Personas” son registros de la base de la iglesia, sin inicio de sesión. Los “Usuarios” son personas con acceso al panel. Todo usuario es una persona; no toda persona es usuario.',
      },
      {
        tipo: 'passos',
        itens: [
          'Registra a la persona con nombre, teléfono y correo.',
          'Para darle acceso, usa “Habilitar acceso”. La persona necesita tener un correo registrado.',
          'Elige el cargo (mira la lista abajo) y, si es del equipo de alabanza o técnico, marca sus habilidades.',
          'Envíale el enlace /<dirección-de-la-iglesia>/entrar (ej.: /ipg/entrar). Abre el inicio de sesión con la iglesia ya elegida; entra con el mismo correo, con contraseña (en “Primer acceso”), Google o Microsoft.',
        ],
      },
      {
        tipo: 'dica',
        texto: 'Para bloquear a alguien al instante, desactiva su acceso. El registro de la persona se conserva.',
      },
    ],
  },
  {
    id: 'cargos',
    titulo: 'Qué puede hacer cada cargo',
    resumo: 'Permisos definidos por el cargo de la persona en esta iglesia.',
    blocos: [
      {
        tipo: 'lista',
        itens: [
          'Miembro: registro en la base, sin acceso al panel.',
          'Músico y diácono: boletines y cánticos.',
          'Staff: boletines, cánticos y turnos.',
          'Presbítero: todo lo anterior, más miembros, liturgia completa, recursos y habilitación de accesos.',
          'Seminarista: boletines, cánticos, miembros, liturgia completa, recursos y pedidos pastorales.',
          'Pastor: acceso completo a la iglesia, incluidos pedidos pastorales y datos de la iglesia.',
          'Administrador: acceso completo a la gestión de la iglesia (datos, personas, turnos, boletines); los pedidos pastorales quedan con el pastor.',
        ],
      },
      {
        tipo: 'p',
        texto:
          'Las habilidades (etiquetas) amplían el acceso sin cambiar el cargo: quien es de alabanza gestiona cánticos y turnos; quien es del equipo técnico se encarga de los boletines; quien es de secretaría ayuda con el registro de personas.',
      },
    ],
  },
  {
    id: 'membros',
    titulo: 'Miembros y cuidado pastoral',
    resumo: 'Lista de miembros, familias, cumpleaños y ficha de membresía.',
    onde: { rotulo: 'Panel → Miembros', href: '/admin/membros' },
    blocos: [
      {
        tipo: 'lista',
        itens: [
          'Registro completo de cada miembro: datos personales, familia, situación eclesiástica e historial.',
          'Pedir datos por WhatsApp: envía al miembro un enlace para que revise y complete sus propios datos (y los de sus hijos).',
          'Lista de cumpleaños e informes en PDF, también por familia.',
          'Ficha de candidato a la membresía con firma digital.',
        ],
      },
      {
        tipo: 'dica',
        texto: 'La forma más rápida de armar la lista es pedir que cada familia complete su propio registro por el enlace; tú solo revisas.',
      },
    ],
  },
  {
    id: 'cadastro-publico',
    titulo: 'Registro público de visitantes y miembros',
    resumo: 'Un enlace para que cualquier persona se registre en la iglesia por sí misma.',
    blocos: [
      {
        tipo: 'p',
        texto:
          'Toda iglesia tiene un formulario público en /cadastro/<dirección-de-la-iglesia>. Compártelo en el culto, con un código QR o en Instagram. Quien se registra entra a la base como persona de la iglesia, y el liderazgo decide después si le da acceso al panel.',
      },
    ],
  },
  {
    id: 'pedidos-pastorais',
    titulo: 'Pedidos pastorales y de oración',
    resumo: 'Un canal reservado para que la iglesia hable con el pastor.',
    onde: { rotulo: 'Panel → Pedidos pastorales', href: '/admin/pedidos-pastorais' },
    blocos: [
      {
        tipo: 'p',
        texto:
          'Los miembros envían pedidos por la página pública /pedidos/<dirección-de-la-iglesia>. Solo los pastores y seminaristas los ven, y pueden copiarlos o reenviarlos por WhatsApp.',
      },
    ],
  },
  {
    id: 'recursos',
    titulo: 'Recursos en video',
    resumo: 'Cultos, escuela dominical y estudios grabados, organizados para la iglesia.',
    onde: { rotulo: 'Panel → Recursos', href: '/recursos' },
    blocos: [
      {
        tipo: 'p',
        texto:
          'Registra los videos (YouTube) por categoría (culto, escuela dominical, estudio) con fecha y responsable. Pueden publicar pastores, presbíteros, seminaristas y líderes de ministerio.',
      },
    ],
  },
  {
    id: 'estatisticas',
    titulo: 'Estadísticas del repertorio',
    resumo: 'Qué música canta más la iglesia, por mes y por posición en el culto.',
    onde: { rotulo: 'Panel → Estadísticas', href: '/dashboard' },
    blocos: [
      {
        tipo: 'p',
        texto:
          'Los números salen de los boletines: cuantos más boletines registra la iglesia, más útil es la visión del repertorio, y más fácil evitar repeticiones u olvidar buenos cánticos.',
      },
    ],
  },
  {
    id: 'app-no-celular',
    titulo: 'El boletín como app en el celular',
    resumo: 'La dirección pública de la iglesia se puede instalar como aplicación, sin tienda.',
    blocos: [
      {
        tipo: 'lista',
        itens: [
          'iPhone (Safari): abre la dirección de la iglesia, toca Compartir y luego “Agregar a pantalla de inicio”.',
          'Android (Chrome): abre la dirección de la iglesia, toca el menú ⋮ y luego “Instalar app” o “Agregar a la pantalla principal”.',
          'El ícono usa el logo y el nombre corto de la iglesia. Por eso conviene registrar ambos en Datos de la iglesia.',
        ],
      },
    ],
  },
];

export const PERGUNTAS_ES: Pergunta[] = [
  {
    pergunta: 'Olvidé mi contraseña. ¿Y ahora?',
    resposta:
      'En la pantalla de inicio de sesión, escribe tu correo y haz clic en “Olvidé mi contraseña”. Te llega un enlace por correo para crear una nueva. También puedes entrar con Google o Microsoft usando el mismo correo.',
  },
  {
    pergunta: 'Una persona dice que no puede entrar.',
    resposta:
      'Revisa en Usuarios que su correo sea correcto y que el acceso esté habilitado y activo. Debe entrar exactamente con el mismo correo registrado.',
  },
  {
    pergunta: 'Participo en dos iglesias. ¿Necesito dos cuentas?',
    resposta: 'No. Una cuenta sirve para varias iglesias; cambia de iglesia con el selector en la parte superior del panel.',
  },
  {
    pergunta: '¿Puedo cambiar la dirección (slug) de la iglesia?',
    resposta:
      'Sí, en Datos de la iglesia. Pero la dirección anterior deja de funcionar, incluso en las apps ya instaladas. Cámbiala solo si es realmente necesario.',
  },
  {
    pergunta: 'El boletín no aparece en la página pública.',
    resposta:
      'Revisa que el boletín se haya guardado con la fecha correcta y que la iglesia esté marcada como visible al público en Datos de la iglesia.',
  },
  {
    pergunta: 'Quiero pasar la responsabilidad de la iglesia a otra persona.',
    resposta:
      'Registra a la persona, habilítale el acceso con el cargo de pastor o administrador y, si quieres, baja o desactiva tu propio acceso.',
  },
];
