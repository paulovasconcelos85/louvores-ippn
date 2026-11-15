import type { Pergunta, Secao } from './conteudo-pt';

// Help center in English. Same section ids as conteudo-pt.ts. The Treasury
// section is left out: it follows Brazilian Presbyterian (IPB) rules.
export const SECOES_EN: Secao[] = [
  {
    id: 'comecar',
    titulo: 'Set up your church on OIKOS Hub',
    resumo: 'Whoever creates the church becomes its owner and goes straight to the dashboard.',
    onde: { rotulo: 'Create my church', href: '/comecar' },
    blocos: [
      {
        tipo: 'passos',
        itens: [
          'On the home page, click “Create my church”.',
          "Enter the church's name, short name (optional), city and main service time.",
          'Choose the public address. We suggest one from the initials (“Grace Presbyterian Church” becomes “gpc”) and show right away whether it is free.',
          'Say whether you are the pastor or part of the leadership/office, then enter your name, email and a password.',
          'Done: you land on the dashboard with the getting-started checklist open.',
        ],
      },
      {
        tipo: 'dica',
        texto:
          'A short address is best: it is what people will type and share. If the initials are taken, add the city (e.g. gpc-toronto).',
      },
      {
        tipo: 'p',
        texto:
          'Already have an OIKOS Hub account (for example, as a member of another church)? Sign in first, then open “Create my church”: the new church is added to your account and you switch between them with the selector at the top of the dashboard.',
      },
    ],
  },
  {
    id: 'dados-da-igreja',
    titulo: 'Church details: logo, address, services and order of service',
    resumo: 'Everything shown on the public page, plus the template used to build each bulletin.',
    onde: { rotulo: 'Dashboard → Church details', href: '/admin/igrejas' },
    blocos: [
      {
        tipo: 'lista',
        itens: [
          'Names: the display name appears everywhere; the short name in menus and on the app icon; the legal name only if there is a longer official one.',
          'Link address (slug): it can be changed, but anyone who saved the old link will lose it. Avoid changing it after you share it.',
          "Logo: click “Upload image” and pick a file from your computer or a photo from your phone. If it isn't square, we use the center. It becomes the icon when someone installs the bulletin on their phone.",
          'Address, phone, WhatsApp and social media: shown to visitors on the public page.',
          'Services: add each service and meeting with its day and time.',
          'Public introduction: title and text for “About the church”. If the text is empty, the link is hidden.',
        ],
      },
      {
        tipo: 'p',
        texto:
          'The order of service has two parts: (1) under “Available types”, add the parts your church uses (Prelude, Confession, Sermon…); (2) under “Default order of service”, arrange the sequence and the default text of each part. Every new church starts with a simple Reformed template that you can change as you like.',
      },
      {
        tipo: 'dica',
        texto: 'Set up the order of service before your first bulletin: every new bulletin starts with it filled in.',
      },
    ],
  },
  {
    id: 'boletins',
    titulo: 'Bulletins and the order of service',
    resumo: 'The heart of the system: the order of service, the songs and the announcements your church sees on their phones.',
    onde: { rotulo: 'Dashboard → Bulletins', href: '/cultos' },
    blocos: [
      {
        tipo: 'passos',
        itens: [
          'Open “Bulletins” and create a new one. We suggest the next Sunday and warn you if the date looks unusual.',
          "The order of service starts from your church's template. Adjust whatever you need; item titles can be typed freely.",
          'For items with music, choose the songs and the key. Next to each song you see how long it has been since it was sung (recent, moderate, a while ago), so you can vary your repertoire.',
          'Fill in the public text for anything the congregation reads together (readings, confession, creed).',
          'Add bulletin sections: Announcements, Prayer requests, Schedule, Newsletter or Other.',
          "Save. The bulletin appears at your church's public address.",
        ],
      },
      {
        tipo: 'dica',
        texto:
          'There are two layers of text: the “public” one the congregation sees, and internal notes only the leadership sees (e.g. “ask someone to pray”).',
      },
      {
        tipo: 'p',
        texto: 'Bulletins from previous weeks are still available on the public page, under “Previous bulletins”.',
      },
    ],
  },
  {
    id: 'canticos',
    titulo: 'Songs and repertoire',
    resumo: "Your church's music library: lyrics, chords and key for each song.",
    onde: { rotulo: 'Dashboard → Songs', href: '/canticos' },
    blocos: [
      {
        tipo: 'lista',
        itens: [
          'Add the songs your church sings, with lyrics and chords. They then show up when choosing music for a bulletin.',
          'The worship team opens lyrics and chords on their phones, straight from the bulletin.',
          'Displaying song lyrics usually requires a license (such as CCLI). Make sure your church has one for the songs you publish.',
        ],
      },
    ],
  },
  {
    id: 'escalas',
    titulo: 'Worship and volunteer schedules',
    resumo: 'Who plays, sings and serves at each service, and whether each person has confirmed.',
    onde: { rotulo: 'Dashboard → Schedules', href: '/admin/escalas' },
    blocos: [
      {
        tipo: 'passos',
        itens: [
          'Open “Schedules” and create a schedule for the service date.',
          'Link it to an existing bulletin, or let the system create a new one with your default order of service.',
          'Add the people and the role of each one (vocals, guitar, sound, slides…). Roles come from the skills set up under People.',
          'Change the status to “Published” when it is ready; until then only the leadership can see it.',
          'Use “Share on WhatsApp”: the schedule comes out formatted, ready to paste into your group chat.',
        ],
      },
      {
        tipo: 'dica',
        texto: 'Everyone on the schedule who has an account sees it on their own dashboard and can confirm attendance.',
      },
    ],
  },
  {
    id: 'pessoas-e-acessos',
    titulo: 'People, team and access',
    resumo: 'Add your church members and decide who can sign in to the dashboard, and with which role.',
    onde: { rotulo: 'Dashboard → Users', href: '/admin/usuarios' },
    blocos: [
      {
        tipo: 'p',
        texto:
          'There are two kinds of records. “People” are entries in your church directory, without a login. “Users” are people with access to the dashboard. Every user is a person; not every person is a user.',
      },
      {
        tipo: 'passos',
        itens: [
          'Add the person with name, phone and email.',
          'To give access, use “Grant access”. The person needs an email on file.',
          'Choose the role (see the list below) and, for worship or tech team members, tick their skills.',
          "Send the person the link /<church-address>/entrar (e.g. /gpc/entrar). It opens the sign-in page with your church already selected; they sign in with the same email, using a password (under “First access”), Google or Microsoft.",
        ],
      },
      {
        tipo: 'dica',
        texto: "To block someone right away, turn off their access. The person's record is kept.",
      },
    ],
  },
  {
    id: 'cargos',
    titulo: 'What each role can do',
    resumo: "Permissions come from the person's role in this church.",
    blocos: [
      {
        tipo: 'lista',
        itens: [
          'Member: listed in the directory, no dashboard access.',
          'Musician and deacon: bulletins and songs.',
          'Staff: bulletins, songs and schedules.',
          'Elder: all of the above, plus members, the full order of service, resources and granting access.',
          'Seminarian: bulletins, songs, members, the full order of service, resources and pastoral requests.',
          'Pastor: full access to the church, including pastoral requests and church details.',
          'Administrator: full access to church management (details, people, schedules, bulletins); pastoral requests stay with the pastor.',
        ],
      },
      {
        tipo: 'p',
        texto:
          'Skills (tags) widen access without changing the role: worship team members manage songs and schedules; tech team members handle bulletins; office volunteers help with the people directory.',
      },
    ],
  },
  {
    id: 'membros',
    titulo: 'Members and pastoral care',
    resumo: 'Membership roll, families, birthdays and membership forms.',
    onde: { rotulo: 'Dashboard → Members', href: '/admin/membros' },
    blocos: [
      {
        tipo: 'lista',
        itens: [
          'A full record for each member: personal details, family, church status and history.',
          'Request details by WhatsApp: sends the member a link to check and complete their own details (and their children’s).',
          'Birthday list and PDF reports, including by family.',
          'Membership application form with digital signature.',
        ],
      },
      {
        tipo: 'dica',
        texto: 'The fastest way to build your roll is to ask each family to complete their own record through the link. You just review it.',
      },
    ],
  },
  {
    id: 'cadastro-publico',
    titulo: 'Public sign-up for visitors and members',
    resumo: 'A link anyone can use to join your church directory on their own.',
    blocos: [
      {
        tipo: 'p',
        texto:
          'Every church has a public form at /cadastro/<church-address>. Share it during the service, with a QR code or on Instagram. People who sign up join the directory, and the leadership decides later whether to give them dashboard access.',
      },
    ],
  },
  {
    id: 'pedidos-pastorais',
    titulo: 'Pastoral and prayer requests',
    resumo: 'A private channel for the congregation to reach the pastor.',
    onde: { rotulo: 'Dashboard → Pastoral requests', href: '/admin/pedidos-pastorais' },
    blocos: [
      {
        tipo: 'p',
        texto:
          'Members send requests through the public page /pedidos/<church-address>. Only pastors and seminarians see them, and they can copy or forward them by WhatsApp.',
      },
    ],
  },
  {
    id: 'recursos',
    titulo: 'Video resources',
    resumo: 'Recorded services, Sunday school and studies, organized for your church.',
    onde: { rotulo: 'Dashboard → Resources', href: '/recursos' },
    blocos: [
      {
        tipo: 'p',
        texto:
          'Add videos (YouTube) by category (service, Sunday school, study) with date and speaker. Pastors, elders, seminarians and ministry leaders can publish.',
      },
    ],
  },
  {
    id: 'estatisticas',
    titulo: 'Repertoire statistics',
    resumo: 'Which songs your church sings most, by month and by place in the service.',
    onde: { rotulo: 'Dashboard → Statistics', href: '/dashboard' },
    blocos: [
      {
        tipo: 'p',
        texto:
          'The numbers come from your bulletins: the more bulletins your church records, the more useful the repertoire view becomes, and the easier it is to avoid repeats or forgotten good songs.',
      },
    ],
  },
  {
    id: 'app-no-celular',
    titulo: 'The bulletin as a phone app',
    resumo: "Your church's public address can be installed as an app, no app store needed.",
    blocos: [
      {
        tipo: 'lista',
        itens: [
          'iPhone (Safari): open your church address, tap Share, then “Add to Home Screen”.',
          'Android (Chrome): open your church address, tap the ⋮ menu, then “Install app” or “Add to Home screen”.',
          "The icon uses your church's logo and short name, so it is worth setting both under Church details.",
        ],
      },
    ],
  },
];

export const PERGUNTAS_EN: Pergunta[] = [
  {
    pergunta: 'I forgot my password. What now?',
    resposta:
      'On the sign-in page, type your email and click “Forgot my password”. You will get an email with a link to create a new one. You can also sign in with Google or Microsoft using the same email.',
  },
  {
    pergunta: 'Someone says they cannot sign in.',
    resposta:
      'Check under Users that their email is correct and that their access is granted and active. They must sign in with exactly the same email.',
  },
  {
    pergunta: 'I belong to two churches. Do I need two accounts?',
    resposta: 'No. One account works for several churches; switch churches with the selector at the top of the dashboard.',
  },
  {
    pergunta: "Can I change the church's address (slug)?",
    resposta:
      'Yes, under Church details. But the old address stops working, including in apps already installed. Only change it if you really need to.',
  },
  {
    pergunta: 'The bulletin does not show on the public page.',
    resposta:
      'Check that the bulletin was saved with the right date and that the church is marked as visible to the public under Church details.',
  },
  {
    pergunta: 'I want to hand the church over to someone else.',
    resposta:
      'Add the person, grant them access as pastor or administrator and, if you like, lower or turn off your own access.',
  },
];
