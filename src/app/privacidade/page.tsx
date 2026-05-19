import type { Metadata } from 'next';
import { getRequestLocale } from '@/i18n/server';

const CONTATO_EMAIL = 'vasconcelospaulorp@gmail.com';
const ATUALIZADO_EM = { pt: '18 de maio de 2026', es: '18 de mayo de 2026', en: 'May 18, 2026' };

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getRequestLocale();
  const t = (pt: string, es: string, en: string) =>
    locale === 'es' ? es : locale === 'en' ? en : pt;
  return {
    title: t(
      'Política de Privacidade | OIKOS Hub',
      'Política de Privacidad | OIKOS Hub',
      'Privacy Policy | OIKOS Hub'
    ),
    description: t(
      'Como o OIKOS Hub coleta, usa, armazena e protege os dados das igrejas e seus membros.',
      'Cómo OIKOS Hub recopila, usa, almacena y protege los datos de las iglesias y sus miembros.',
      'How OIKOS Hub collects, uses, stores and protects the data of churches and their members.'
    ),
  };
}

export default async function PoliticaPrivacidadePage() {
  const locale = await getRequestLocale();
  const t = (pt: string, es: string, en: string) =>
    locale === 'es' ? es : locale === 'en' ? en : pt;
  const atualizado =
    locale === 'es' ? ATUALIZADO_EM.es : locale === 'en' ? ATUALIZADO_EM.en : ATUALIZADO_EM.pt;

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-3xl px-6 py-16">
        <header className="mb-10">
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-emerald-700">
            OIKOS Hub
          </p>
          <h1 className="mt-3 text-4xl font-black tracking-tight text-slate-900">
            {t('Política de Privacidade', 'Política de Privacidad', 'Privacy Policy')}
          </h1>
          <p className="mt-3 text-sm text-slate-500">
            {t('Última atualização:', 'Última actualización:', 'Last updated:')} {atualizado}
          </p>
        </header>

        <article className="space-y-8 text-slate-700 leading-relaxed">
          <section>
            <p>
              {t(
                'O OIKOS Hub é uma plataforma de gestão para igrejas locais que organiza boletins, cultos, escalas, repertório musical, cadastro de membros e cuidado pastoral. Esta política descreve como coletamos, usamos, armazenamos e protegemos as informações dos usuários e das igrejas que utilizam o serviço.',
                'OIKOS Hub es una plataforma de gestión para iglesias locales que organiza boletines, cultos, equipos de servicio, repertorio musical, registro de miembros y cuidado pastoral. Esta política describe cómo recopilamos, usamos, almacenamos y protegemos la información de los usuarios y de las iglesias que utilizan el servicio.',
                'OIKOS Hub is a management platform for local churches that organizes bulletins, services, schedules, musical repertoire, member records and pastoral care. This policy describes how we collect, use, store and protect the information of users and churches that use the service.'
              )}
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-bold text-slate-900">
              {t('1. Dados que coletamos', '1. Datos que recopilamos', '1. Data we collect')}
            </h2>
            <ul className="list-disc space-y-2 pl-5">
              <li>
                <strong>{t('Dados de cadastro:', 'Datos de registro:', 'Account data:')}</strong>{' '}
                {t(
                  'nome, e-mail, telefone, cargo ou função na igreja e igreja à qual o usuário está vinculado.',
                  'nombre, correo electrónico, teléfono, cargo o función en la iglesia e iglesia a la que el usuario está vinculado.',
                  'name, email, phone, role or function in the church and the church the user belongs to.'
                )}
              </li>
              <li>
                <strong>
                  {t('Dados de autenticação:', 'Datos de autenticación:', 'Authentication data:')}
                </strong>{' '}
                {t(
                  'credenciais de acesso (e-mail e senha) ou identificadores de login social via Google ou Microsoft.',
                  'credenciales de acceso (correo y contraseña) o identificadores de inicio de sesión social vía Google o Microsoft.',
                  'access credentials (email and password) or social login identifiers via Google or Microsoft.'
                )}
              </li>
              <li>
                <strong>
                  {t('Dados ministeriais:', 'Datos ministeriales:', 'Ministry data:')}
                </strong>{' '}
                {t(
                  'escalas, repertório, programação de cultos, boletins e pedidos de oração ou cuidado pastoral registrados pelo usuário.',
                  'equipos de servicio, repertorio, programación de cultos, boletines y peticiones de oración o cuidado pastoral registrados por el usuario.',
                  'schedules, repertoire, service planning, bulletins and prayer or pastoral care requests recorded by the user.'
                )}
              </li>
              <li>
                <strong>{t('Dados técnicos:', 'Datos técnicos:', 'Technical data:')}</strong>{' '}
                {t(
                  'informações de uso necessárias para o funcionamento e a segurança do serviço, como registros de acesso e idioma preferido.',
                  'información de uso necesaria para el funcionamiento y la seguridad del servicio, como registros de acceso e idioma preferido.',
                  'usage information needed for the operation and security of the service, such as access logs and preferred language.'
                )}
              </li>
            </ul>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-bold text-slate-900">
              {t('2. Como usamos os dados', '2. Cómo usamos los datos', '2. How we use the data')}
            </h2>
            <ul className="list-disc space-y-2 pl-5">
              <li>
                {t(
                  'Fornecer e operar as funcionalidades da plataforma.',
                  'Proporcionar y operar las funcionalidades de la plataforma.',
                  'Provide and operate the platform features.'
                )}
              </li>
              <li>
                {t(
                  'Autenticar usuários e controlar permissões de acesso por igreja e por cargo.',
                  'Autenticar usuarios y controlar permisos de acceso por iglesia y por cargo.',
                  'Authenticate users and control access permissions per church and role.'
                )}
              </li>
              <li>
                {t(
                  'Organizar a vida ministerial da igreja (escalas, cultos, boletins e cuidado pastoral).',
                  'Organizar la vida ministerial de la iglesia (equipos de servicio, cultos, boletines y cuidado pastoral).',
                  'Organize the ministry life of the church (schedules, services, bulletins and pastoral care).'
                )}
              </li>
              <li>
                {t(
                  'Garantir a segurança, prevenir abusos e manter a integridade do serviço.',
                  'Garantizar la seguridad, prevenir abusos y mantener la integridad del servicio.',
                  'Ensure security, prevent abuse and maintain the integrity of the service.'
                )}
              </li>
            </ul>
            <p className="mt-3">
              {t(
                'Não vendemos dados pessoais e não os utilizamos para publicidade de terceiros.',
                'No vendemos datos personales ni los utilizamos para publicidad de terceros.',
                'We do not sell personal data and we do not use it for third-party advertising.'
              )}
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-bold text-slate-900">
              {t(
                '3. Compartilhamento de dados',
                '3. Compartición de datos',
                '3. Data sharing'
              )}
            </h2>
            <p>
              {t(
                'Os dados são acessíveis apenas pelos administradores e líderes da própria igreja do usuário, conforme as permissões definidas. Utilizamos provedores de infraestrutura para operar o serviço:',
                'Los datos solo son accesibles para los administradores y líderes de la propia iglesia del usuario, según los permisos definidos. Utilizamos proveedores de infraestructura para operar el servicio:',
                'Data is accessible only to the administrators and leaders of the user’s own church, according to the defined permissions. We use infrastructure providers to operate the service:'
              )}
            </p>
            <ul className="mt-3 list-disc space-y-2 pl-5">
              <li>
                <strong>Supabase</strong> —{' '}
                {t(
                  'banco de dados, autenticação e armazenamento.',
                  'base de datos, autenticación y almacenamiento.',
                  'database, authentication and storage.'
                )}
              </li>
              <li>
                <strong>{t('Google e Microsoft', 'Google y Microsoft', 'Google and Microsoft')}</strong>{' '}
                —{' '}
                {t(
                  'apenas quando o usuário opta por login social.',
                  'solo cuando el usuario opta por el inicio de sesión social.',
                  'only when the user chooses social login.'
                )}
              </li>
            </ul>
            <p className="mt-3">
              {t(
                'Esses provedores tratam os dados exclusivamente para viabilizar o funcionamento da plataforma. Também podemos divulgar informações quando exigido por lei.',
                'Estos proveedores tratan los datos exclusivamente para viabilizar el funcionamiento de la plataforma. También podemos divulgar información cuando lo exija la ley.',
                'These providers process data solely to enable the operation of the platform. We may also disclose information when required by law.'
              )}
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-bold text-slate-900">
              {t(
                '4. Armazenamento e segurança',
                '4. Almacenamiento y seguridad',
                '4. Storage and security'
              )}
            </h2>
            <p>
              {t(
                'Os dados são armazenados de forma segura em infraestrutura gerenciada, com criptografia de senhas e controle de acesso por igreja e cargo. Adotamos medidas técnicas e organizacionais razoáveis para proteger as informações contra acesso não autorizado, perda ou alteração indevida.',
                'Los datos se almacenan de forma segura en infraestructura gestionada, con cifrado de contraseñas y control de acceso por iglesia y cargo. Adoptamos medidas técnicas y organizativas razonables para proteger la información contra el acceso no autorizado, la pérdida o la alteración indebida.',
                'Data is stored securely in managed infrastructure, with password encryption and access control per church and role. We adopt reasonable technical and organizational measures to protect information against unauthorized access, loss or improper alteration.'
              )}
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-bold text-slate-900">
              {t(
                '5. Retenção e exclusão',
                '5. Retención y eliminación',
                '5. Retention and deletion'
              )}
            </h2>
            <p>
              {t(
                'Mantemos os dados enquanto a conta estiver ativa ou enquanto forem necessários para a operação da igreja. O usuário pode solicitar a exclusão da sua conta e dos seus dados pessoais a qualquer momento entrando em contato pelo e-mail abaixo. Após a solicitação, os dados são removidos, ressalvadas as obrigações legais de retenção.',
                'Conservamos los datos mientras la cuenta esté activa o mientras sean necesarios para la operación de la iglesia. El usuario puede solicitar la eliminación de su cuenta y de sus datos personales en cualquier momento contactando al correo indicado abajo. Tras la solicitud, los datos se eliminan, salvo las obligaciones legales de conservación.',
                'We keep data while the account is active or while it is needed for the church’s operation. The user may request deletion of their account and personal data at any time by contacting the email below. After the request, data is removed, subject to legal retention obligations.'
              )}
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-bold text-slate-900">
              {t(
                '6. Direitos do usuário',
                '6. Derechos del usuario',
                '6. User rights'
              )}
            </h2>
            <p>
              {t(
                'O usuário pode solicitar acesso, correção, portabilidade ou exclusão dos seus dados pessoais, bem como revogar consentimentos. As solicitações podem ser feitas pelo e-mail de contato.',
                'El usuario puede solicitar acceso, corrección, portabilidad o eliminación de sus datos personales, así como revocar consentimientos. Las solicitudes pueden hacerse por el correo de contacto.',
                'The user may request access, correction, portability or deletion of their personal data, as well as revoke consents. Requests can be made through the contact email.'
              )}
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-bold text-slate-900">
              {t(
                '7. Dados de menores',
                '7. Datos de menores',
                '7. Children’s data'
              )}
            </h2>
            <p>
              {t(
                'O OIKOS Hub é destinado à gestão administrativa e ministerial de igrejas, operado por líderes e responsáveis. Não coletamos intencionalmente dados de crianças sem o envolvimento dos responsáveis pela igreja.',
                'OIKOS Hub está destinado a la gestión administrativa y ministerial de iglesias, operado por líderes y responsables. No recopilamos intencionalmente datos de niños sin la participación de los responsables de la iglesia.',
                'OIKOS Hub is intended for the administrative and ministry management of churches, operated by leaders and those responsible. We do not intentionally collect children’s data without the involvement of those responsible for the church.'
              )}
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-bold text-slate-900">
              {t(
                '8. Alterações nesta política',
                '8. Cambios en esta política',
                '8. Changes to this policy'
              )}
            </h2>
            <p>
              {t(
                'Podemos atualizar esta política periodicamente. Alterações relevantes serão refletidas na data de “última atualização” no topo desta página.',
                'Podemos actualizar esta política periódicamente. Los cambios relevantes se reflejarán en la fecha de “última actualización” en la parte superior de esta página.',
                'We may update this policy periodically. Relevant changes will be reflected in the “last updated” date at the top of this page.'
              )}
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-bold text-slate-900">
              {t('9. Contato', '9. Contacto', '9. Contact')}
            </h2>
            <p>
              {t(
                'Dúvidas, solicitações ou pedidos relacionados a privacidade podem ser enviados para',
                'Dudas, solicitudes o pedidos relacionados con la privacidad pueden enviarse a',
                'Questions, requests or inquiries related to privacy can be sent to'
              )}{' '}
              <a
                href={`mailto:${CONTATO_EMAIL}`}
                className="font-semibold text-emerald-700 underline"
              >
                {CONTATO_EMAIL}
              </a>
              .
            </p>
          </section>
        </article>

        <footer className="mt-16 border-t border-slate-200 pt-6 text-sm text-slate-500">
          {t(
            'OIKOS Hub — Gestão Integral Multi-igreja',
            'OIKOS Hub — Gestión Integral Multi-iglesia',
            'OIKOS Hub — Integrated Multi-church Management'
          )}
        </footer>
      </div>
    </div>
  );
}
