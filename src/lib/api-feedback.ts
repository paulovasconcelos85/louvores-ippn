import type { Locale } from '@/i18n/config';

type TranslationEntry = Record<Locale, string>;
type ApiPayloadLike = {
  code?: string;
  error?: string;
  message?: string;
  messageCode?: string;
  params?: Record<string, string | number | boolean | null | undefined>;
  messageParams?: Record<string, string | number | boolean | null | undefined>;
};

const ERROR_MESSAGES: Record<string, TranslationEntry> = {
  UNAUTHENTICATED: {
    pt: 'Usuário não autenticado.',
    es: 'Usuario no autenticado.',
    en: 'User not authenticated.',
  },
  FORBIDDEN: {
    pt: 'Você não tem permissão para executar esta ação.',
    es: 'No tienes permiso para realizar esta acción.',
    en: 'You do not have permission to perform this action.',
  },
  CHURCH_REQUIRED: {
    pt: 'Nenhuma igreja selecionada.',
    es: 'No se seleccionó ninguna iglesia.',
    en: 'No church selected.',
  },
  PERSON_NOT_FOUND: {
    pt: 'Pessoa não encontrada.',
    es: 'Persona no encontrada.',
    en: 'Person not found.',
  },
  PERSON_NAME_AND_ROLE_REQUIRED: {
    pt: 'Nome e cargo são obrigatórios.',
    es: 'El nombre y el cargo son obligatorios.',
    en: 'Name and role are required.',
  },
  PERSON_DUPLICATE_EMAIL: {
    pt: 'Já existe uma pessoa com este e-mail.',
    es: 'Ya existe una persona con este correo.',
    en: 'A person with this email already exists.',
  },
  PERSON_DUPLICATE_EMAIL_IN_CHURCH: {
    pt: 'Já existe uma pessoa com este e-mail nesta igreja.',
    es: 'Ya existe una persona con este correo en esta iglesia.',
    en: 'A person with this email already exists in this church.',
  },
  PERSON_ACCESS_EMAIL_CHANGE_FORBIDDEN: {
    pt: 'Não é possível alterar o e-mail de uma pessoa com acesso ao sistema.',
    es: 'No es posible cambiar el correo de una persona con acceso al sistema.',
    en: 'You cannot change the email of a person with system access.',
  },
  PERSON_DELETE_ACCESS_FORBIDDEN: {
    pt: 'Não é possível remover uma pessoa com acesso ao sistema. Desative-a primeiro.',
    es: 'No es posible eliminar a una persona con acceso al sistema. Desactívala primero.',
    en: 'You cannot remove a person with system access. Disable them first.',
  },
  PERSON_IN_ESCALAS: {
    pt: 'Esta pessoa está vinculada a escalas e precisa ser removida delas primeiro.',
    es: 'Esta persona está vinculada a escalas y debe ser retirada primero.',
    en: 'This person is linked to schedules and must be removed from them first.',
  },
  PERSON_SENSITIVE_FIELDS_FORBIDDEN: {
    pt: 'Sem permissão para alterar cargo, e-mail ou acesso ao sistema.',
    es: 'Sin permiso para cambiar cargo, correo o acceso al sistema.',
    en: 'You do not have permission to change role, email, or system access.',
  },
  ACCESS_EMAIL_REQUIRED: {
    pt: 'Adicione um e-mail antes de liberar o acesso.',
    es: 'Agrega un correo antes de habilitar el acceso.',
    en: 'Add an email before granting access.',
  },
  ACCESS_EMAIL_CONFLICT: {
    pt: 'Este e-mail já está vinculado a outra pessoa com acesso.',
    es: 'Este correo ya está vinculado a otra persona con acceso.',
    en: 'This email is already linked to another person with access.',
  },
  HUB_EMAIL_REQUIRED: {
    pt: 'Preencha o e-mail do usuário.',
    es: 'Completa el correo del usuario.',
    en: 'Fill in the user email.',
  },
  HUB_CHURCH_REQUIRED: {
    pt: 'Selecione pelo menos uma igreja para conceder acesso.',
    es: 'Selecciona al menos una iglesia para conceder acceso.',
    en: 'Select at least one church to grant access.',
  },
  HUB_SCOPE_FORBIDDEN: {
    pt: 'Você tentou gerenciar uma igreja fora do seu escopo atual.',
    es: 'Intentaste administrar una iglesia fuera de tu alcance actual.',
    en: 'You tried to manage a church outside your current scope.',
  },
  HUB_ACCESS_EMAIL_CONFLICT: {
    pt: 'Este e-mail já pertence a outro usuário de acesso.',
    es: 'Este correo ya pertenece a otro usuario de acceso.',
    en: 'This email already belongs to another access user.',
  },
  HUB_ACCESS_PERSON_CONFLICT: {
    pt: 'O usuário de acesso já está vinculado a outra pessoa.',
    es: 'El usuario de acceso ya está vinculado a otra persona.',
    en: 'The access user is already linked to another person.',
  },
  HUB_PERSON_AUTH_CONFLICT: {
    pt: 'Há conflito entre o usuário autenticado e a pessoa vinculada.',
    es: 'Hay un conflicto entre el usuario autenticado y la persona vinculada.',
    en: 'There is a conflict between the authenticated user and the linked person.',
  },
  HUB_INVALID_CHURCH_SELECTION: {
    pt: 'Selecione pelo menos uma igreja válida.',
    es: 'Selecciona al menos una iglesia válida.',
    en: 'Select at least one valid church.',
  },
  HUB_DUPLICATE_ACCESS_EMAIL: {
    pt: 'Há mais de um usuário de acesso com este e-mail. Resolva a duplicidade antes de continuar.',
    es: 'Hay más de un usuario de acceso con este correo. Resuelve la duplicidad antes de continuar.',
    en: 'There is more than one access user with this email. Resolve the duplicate before continuing.',
  },
  HUB_DUPLICATE_PERSON_EMAIL: {
    pt: 'Há mais de uma pessoa com este e-mail. Resolva a duplicidade antes de continuar.',
    es: 'Hay más de una persona con este correo. Resuelve la duplicidad antes de continuar.',
    en: 'There is more than one person with this email. Resolve the duplicate before continuing.',
  },
  PASTORAL_STATUS_INVALID: {
    pt: 'Status inválido.',
    es: 'Estado inválido.',
    en: 'Invalid status.',
  },
  PASTORAL_REQUEST_AND_STATUS_REQUIRED: {
    pt: 'Pedido e status válidos são obrigatórios.',
    es: 'El pedido y un estado válido son obligatorios.',
    en: 'A valid request and status are required.',
  },
  PASTORAL_REQUEST_NOT_FOUND: {
    pt: 'Pedido não encontrado.',
    es: 'Pedido no encontrado.',
    en: 'Request not found.',
  },
  PASTORAL_REQUEST_WRONG_CHURCH: {
    pt: 'Este pedido não pertence à igreja ativa.',
    es: 'Este pedido no pertenece a la iglesia activa.',
    en: 'This request does not belong to the active church.',
  },
  PASTORAL_ACCESS_REQUIRED: {
    pt: 'Sem permissão para acessar os pedidos pastorais.',
    es: 'Sin permiso para acceder a los pedidos pastorales.',
    en: 'You do not have permission to access pastoral requests.',
  },
  ACTIVE_CHURCH_REQUIRED: {
    pt: 'Nenhuma igreja ativa foi identificada para este usuário.',
    es: 'No se identificó ninguna iglesia activa para este usuario.',
    en: 'No active church was identified for this user.',
  },
  NOTIFICATION_ACCESS_REQUIRED: {
    pt: 'Usuário sem acesso vinculado para consultar notificações.',
    es: 'Usuario sin acceso vinculado para consultar notificaciones.',
    en: 'User has no linked access to view notifications.',
  },
  CHURCH_NAME_AND_SLUG_REQUIRED: {
    pt: 'Nome e slug são obrigatórios.',
    es: 'El nombre y el slug son obligatorios.',
    en: 'Name and slug are required.',
  },
  CHURCH_NOT_FOUND: {
    pt: 'Igreja não encontrada.',
    es: 'Iglesia no encontrada.',
    en: 'Church not found.',
  },
  LOAD_PEOPLE_FAILED: {
    pt: 'Erro ao carregar pessoas.',
    es: 'Error al cargar personas.',
    en: 'Error loading people.',
  },
  SAVE_PERSON_FAILED: {
    pt: 'Erro ao salvar pessoa.',
    es: 'Error al guardar la persona.',
    en: 'Error saving person.',
  },
  LOAD_HUB_USERS_FAILED: {
    pt: 'Erro ao carregar hub de usuários.',
    es: 'Error al cargar el hub de usuarios.',
    en: 'Error loading the users hub.',
  },
  SAVE_HUB_USER_FAILED: {
    pt: 'Erro ao salvar usuário no hub.',
    es: 'Error al guardar el usuario en el hub.',
    en: 'Error saving user in the hub.',
  },
  LOAD_PASTORAL_REQUESTS_FAILED: {
    pt: 'Erro ao carregar pedidos pastorais.',
    es: 'Error al cargar pedidos pastorales.',
    en: 'Error loading pastoral requests.',
  },
  UPDATE_PASTORAL_REQUEST_FAILED: {
    pt: 'Erro ao atualizar pedido pastoral.',
    es: 'Error al actualizar el pedido pastoral.',
    en: 'Error updating pastoral request.',
  },
  LOAD_NOTIFICATIONS_FAILED: {
    pt: 'Erro ao carregar notificações.',
    es: 'Error al cargar notificaciones.',
    en: 'Error loading notifications.',
  },
  UPDATE_NOTIFICATIONS_FAILED: {
    pt: 'Erro ao atualizar notificações.',
    es: 'Error al actualizar notificaciones.',
    en: 'Error updating notifications.',
  },
  LOAD_CHURCHES_FAILED: {
    pt: 'Erro ao carregar igrejas.',
    es: 'Error al cargar iglesias.',
    en: 'Error loading churches.',
  },
  LOAD_CHURCH_DETAILS_FAILED: {
    pt: 'Erro ao carregar detalhes da igreja.',
    es: 'Error al cargar los detalles de la iglesia.',
    en: 'Error loading church details.',
  },
  SAVE_CHURCH_FAILED: {
    pt: 'Erro ao salvar igreja.',
    es: 'Error al guardar la iglesia.',
    en: 'Error saving church.',
  },
};

const SUCCESS_MESSAGES: Record<string, TranslationEntry> = {
  PERSON_CREATED: {
    pt: 'Pessoa cadastrada com sucesso.',
    es: 'Persona registrada con éxito.',
    en: 'Person created successfully.',
  },
  PERSON_LINKED_TO_CHURCH: {
    pt: 'Pessoa vinculada à igreja com sucesso.',
    es: 'Persona vinculada a la iglesia con éxito.',
    en: 'Person linked to the church successfully.',
  },
  PERSON_UPDATED: {
    pt: 'Pessoa atualizada com sucesso.',
    es: 'Persona actualizada con éxito.',
    en: 'Person updated successfully.',
  },
  PERSON_REMOVED_FROM_CHURCH: {
    pt: 'Pessoa removida da igreja atual, mantendo os demais vínculos.',
    es: 'Persona eliminada de la iglesia actual, manteniendo los demás vínculos.',
    en: 'Person removed from the current church while keeping other links.',
  },
  PERSON_DELETED: {
    pt: 'Pessoa removida com sucesso.',
    es: 'Persona eliminada con éxito.',
    en: 'Person removed successfully.',
  },
  ACCESS_GRANTED: {
    pt: 'Acesso liberado com sucesso.',
    es: 'Acceso habilitado con éxito.',
    en: 'Access granted successfully.',
  },
  ACCESS_GRANTED_SYNCED: {
    pt: 'Acesso liberado e sincronizado com sucesso.',
    es: 'Acceso habilitado y sincronizado con éxito.',
    en: 'Access granted and synced successfully.',
  },
  HUB_USER_CREATED: {
    pt: 'Usuário cadastrado no hub com sucesso.',
    es: 'Usuario registrado en el hub con éxito.',
    en: 'User created in the hub successfully.',
  },
  HUB_USER_UPDATED: {
    pt: 'Usuário atualizado no hub com sucesso.',
    es: 'Usuario actualizado en el hub con éxito.',
    en: 'User updated in the hub successfully.',
  },
  PASTORAL_REQUEST_UPDATED: {
    pt: 'Status do pedido atualizado.',
    es: 'Estado del pedido actualizado.',
    en: 'Request status updated.',
  },
  CHURCH_CREATED: {
    pt: 'Igreja criada com sucesso.',
    es: 'Iglesia creada con éxito.',
    en: 'Church created successfully.',
  },
  CHURCH_UPDATED: {
    pt: 'Igreja atualizada com sucesso.',
    es: 'Iglesia actualizada con éxito.',
    en: 'Church updated successfully.',
  },
};

function format(template: string, values?: Record<string, string | number | boolean | null | undefined>) {
  if (!values) return template;
  return template.replace(/\{(\w+)\}/g, (_, token: string) => {
    const value = values[token];
    return value === null || value === undefined ? '' : String(value);
  });
}

export function resolveApiErrorMessage(
  locale: Locale,
  payload?: ApiPayloadLike | null,
  fallback?: string
) {
  const entry = payload?.code ? ERROR_MESSAGES[payload.code] : undefined;
  if (entry) return format(entry[locale], payload?.params);
  return payload?.error || fallback || ERROR_MESSAGES.LOAD_PEOPLE_FAILED[locale];
}

export function resolveApiSuccessMessage(
  locale: Locale,
  payload?: ApiPayloadLike | null,
  fallback?: string
) {
  const entry = payload?.messageCode ? SUCCESS_MESSAGES[payload.messageCode] : undefined;
  if (entry) return format(entry[locale], payload?.messageParams);
  return payload?.message || fallback || '';
}
