export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      audit_log: {
        Row: {
          action: string | null
          created_at: string | null
          id: string
          new_data: Json | null
          old_data: Json | null
          record_id: string | null
          table_name: string | null
          user_email: string | null
        }
        Insert: {
          action?: string | null
          created_at?: string | null
          id?: string
          new_data?: Json | null
          old_data?: Json | null
          record_id?: string | null
          table_name?: string | null
          user_email?: string | null
        }
        Update: {
          action?: string | null
          created_at?: string | null
          id?: string
          new_data?: Json | null
          old_data?: Json | null
          record_id?: string | null
          table_name?: string | null
          user_email?: string | null
        }
        Relationships: []
      }
      boletim_itens: {
        Row: {
          conteudo: string
          conteudo_i18n: Json | null
          criado_em: string | null
          destaque: boolean | null
          id: string
          imagem_url: string | null
          ordem: number | null
          secao_id: string | null
        }
        Insert: {
          conteudo: string
          conteudo_i18n?: Json | null
          criado_em?: string | null
          destaque?: boolean | null
          id?: string
          imagem_url?: string | null
          ordem?: number | null
          secao_id?: string | null
        }
        Update: {
          conteudo?: string
          conteudo_i18n?: Json | null
          criado_em?: string | null
          destaque?: boolean | null
          id?: string
          imagem_url?: string | null
          ordem?: number | null
          secao_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "boletim_itens_secao_id_fkey"
            columns: ["secao_id"]
            isOneToOne: false
            referencedRelation: "boletim_secoes"
            referencedColumns: ["id"]
          },
        ]
      }
      boletim_secoes: {
        Row: {
          criado_em: string | null
          culto_id: number | null
          icone: string | null
          id: string
          igreja_id: string | null
          ordem: number | null
          tipo: string
          titulo: string
          titulo_i18n: Json | null
          visivel: boolean | null
        }
        Insert: {
          criado_em?: string | null
          culto_id?: number | null
          icone?: string | null
          id?: string
          igreja_id?: string | null
          ordem?: number | null
          tipo: string
          titulo: string
          titulo_i18n?: Json | null
          visivel?: boolean | null
        }
        Update: {
          criado_em?: string | null
          culto_id?: number | null
          icone?: string | null
          id?: string
          igreja_id?: string | null
          ordem?: number | null
          tipo?: string
          titulo?: string
          titulo_i18n?: Json | null
          visivel?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "boletim_secoes_culto_id_fkey"
            columns: ["culto_id"]
            isOneToOne: false
            referencedRelation: "Louvores IPPN"
            referencedColumns: ["Culto nr."]
          },
          {
            foreignKeyName: "boletim_secoes_culto_id_fkey"
            columns: ["culto_id"]
            isOneToOne: false
            referencedRelation: "vw_cultos_com_escalas"
            referencedColumns: ["Culto nr."]
          },
          {
            foreignKeyName: "boletim_secoes_culto_id_fkey"
            columns: ["culto_id"]
            isOneToOne: false
            referencedRelation: "vw_cultos_incompletos"
            referencedColumns: ["Culto nr."]
          },
          {
            foreignKeyName: "boletim_secoes_culto_id_fkey"
            columns: ["culto_id"]
            isOneToOne: false
            referencedRelation: "vw_execucoes_louvores"
            referencedColumns: ["culto_nr"]
          },
          {
            foreignKeyName: "boletim_secoes_igreja_id_fkey"
            columns: ["igreja_id"]
            isOneToOne: false
            referencedRelation: "igrejas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "boletim_secoes_igreja_id_fkey"
            columns: ["igreja_id"]
            isOneToOne: false
            referencedRelation: "igrejas_endereco_view"
            referencedColumns: ["id"]
          },
        ]
      }
      canticos: {
        Row: {
          created_at: string | null
          created_by: string | null
          holyrics_artist: string | null
          holyrics_bpm: number | null
          holyrics_key: string | null
          holyrics_paragraphs: Json | null
          id: string
          igreja_id: string | null
          letra: string | null
          nome: string
          referencia: string | null
          spotify_url: string | null
          tags: string[] | null
          youtube_url: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          holyrics_artist?: string | null
          holyrics_bpm?: number | null
          holyrics_key?: string | null
          holyrics_paragraphs?: Json | null
          id?: string
          igreja_id?: string | null
          letra?: string | null
          nome: string
          referencia?: string | null
          spotify_url?: string | null
          tags?: string[] | null
          youtube_url?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          holyrics_artist?: string | null
          holyrics_bpm?: number | null
          holyrics_key?: string | null
          holyrics_paragraphs?: Json | null
          id?: string
          igreja_id?: string | null
          letra?: string | null
          nome?: string
          referencia?: string | null
          spotify_url?: string | null
          tags?: string[] | null
          youtube_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "canticos_igreja_id_fkey"
            columns: ["igreja_id"]
            isOneToOne: false
            referencedRelation: "igrejas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "canticos_igreja_id_fkey"
            columns: ["igreja_id"]
            isOneToOne: false
            referencedRelation: "igrejas_endereco_view"
            referencedColumns: ["id"]
          },
        ]
      }
      confissoes_documentos: {
        Row: {
          ano: string | null
          descricao: string | null
          fonte_url: string
          id: string
          ordem_ciclo: number
          sigla: string
          titulo: string
        }
        Insert: {
          ano?: string | null
          descricao?: string | null
          fonte_url: string
          id: string
          ordem_ciclo: number
          sigla: string
          titulo: string
        }
        Update: {
          ano?: string | null
          descricao?: string | null
          fonte_url?: string
          id?: string
          ordem_ciclo?: number
          sigla?: string
          titulo?: string
        }
        Relationships: []
      }
      confissoes_itens: {
        Row: {
          documento_id: string
          id: string
          ordem: number
          pergunta: string | null
          referencias: string | null
          rotulo: string
          secao: string | null
          texto: string
        }
        Insert: {
          documento_id: string
          id: string
          ordem: number
          pergunta?: string | null
          referencias?: string | null
          rotulo: string
          secao?: string | null
          texto: string
        }
        Update: {
          documento_id?: string
          id?: string
          ordem?: number
          pergunta?: string | null
          referencias?: string | null
          rotulo?: string
          secao?: string | null
          texto?: string
        }
        Relationships: [
          {
            foreignKeyName: "confissoes_itens_documento_id_fkey"
            columns: ["documento_id"]
            isOneToOne: false
            referencedRelation: "confissoes_documentos"
            referencedColumns: ["id"]
          },
        ]
      }
      convites: {
        Row: {
          aceito_em: string | null
          convidado_por: string | null
          criado_em: string | null
          email: string
          expira_em: string | null
          id: string
          igreja_id: string | null
          nome: string
          pessoa_id: string | null
          status: Database["public"]["Enums"]["status_convite"]
          telefone: string | null
          tentativas_envio: number | null
          token: string
          ultimo_envio: string | null
        }
        Insert: {
          aceito_em?: string | null
          convidado_por?: string | null
          criado_em?: string | null
          email: string
          expira_em?: string | null
          id?: string
          igreja_id?: string | null
          nome: string
          pessoa_id?: string | null
          status?: Database["public"]["Enums"]["status_convite"]
          telefone?: string | null
          tentativas_envio?: number | null
          token?: string
          ultimo_envio?: string | null
        }
        Update: {
          aceito_em?: string | null
          convidado_por?: string | null
          criado_em?: string | null
          email?: string
          expira_em?: string | null
          id?: string
          igreja_id?: string | null
          nome?: string
          pessoa_id?: string | null
          status?: Database["public"]["Enums"]["status_convite"]
          telefone?: string | null
          tentativas_envio?: number | null
          token?: string
          ultimo_envio?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "convites_igreja_id_fkey"
            columns: ["igreja_id"]
            isOneToOne: false
            referencedRelation: "igrejas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "convites_igreja_id_fkey"
            columns: ["igreja_id"]
            isOneToOne: false
            referencedRelation: "igrejas_endereco_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "convites_pessoa_id_fkey"
            columns: ["pessoa_id"]
            isOneToOne: false
            referencedRelation: "pessoas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "convites_pessoa_id_fkey"
            columns: ["pessoa_id"]
            isOneToOne: false
            referencedRelation: "view_familias"
            referencedColumns: ["pessoa_id"]
          },
        ]
      }
      convites_acesso: {
        Row: {
          criado_em: string
          email: string
          id: string
          nome: string | null
          pessoa_id: string | null
          status: string
          usuario_acesso_legado_id: string | null
        }
        Insert: {
          criado_em?: string
          email: string
          id?: string
          nome?: string | null
          pessoa_id?: string | null
          status?: string
          usuario_acesso_legado_id?: string | null
        }
        Update: {
          criado_em?: string
          email?: string
          id?: string
          nome?: string | null
          pessoa_id?: string | null
          status?: string
          usuario_acesso_legado_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "convites_acesso_pessoa_id_fkey"
            columns: ["pessoa_id"]
            isOneToOne: false
            referencedRelation: "pessoas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "convites_acesso_pessoa_id_fkey"
            columns: ["pessoa_id"]
            isOneToOne: false
            referencedRelation: "view_familias"
            referencedColumns: ["pessoa_id"]
          },
          {
            foreignKeyName: "convites_acesso_usuario_acesso_legado_id_fkey"
            columns: ["usuario_acesso_legado_id"]
            isOneToOne: true
            referencedRelation: "usuarios_acesso"
            referencedColumns: ["id"]
          },
        ]
      }
      escalas: {
        Row: {
          atualizado_em: string | null
          criado_em: string | null
          criado_por: string | null
          culto_id: number | null
          data: string
          hora_fim: string | null
          hora_inicio: string
          id: string
          igreja_id: string | null
          observacoes: string | null
          status: string | null
          tipo_culto: string | null
          titulo: string
        }
        Insert: {
          atualizado_em?: string | null
          criado_em?: string | null
          criado_por?: string | null
          culto_id?: number | null
          data: string
          hora_fim?: string | null
          hora_inicio: string
          id?: string
          igreja_id?: string | null
          observacoes?: string | null
          status?: string | null
          tipo_culto?: string | null
          titulo: string
        }
        Update: {
          atualizado_em?: string | null
          criado_em?: string | null
          criado_por?: string | null
          culto_id?: number | null
          data?: string
          hora_fim?: string | null
          hora_inicio?: string
          id?: string
          igreja_id?: string | null
          observacoes?: string | null
          status?: string | null
          tipo_culto?: string | null
          titulo?: string
        }
        Relationships: [
          {
            foreignKeyName: "escalas_culto_id_fkey"
            columns: ["culto_id"]
            isOneToOne: false
            referencedRelation: "Louvores IPPN"
            referencedColumns: ["Culto nr."]
          },
          {
            foreignKeyName: "escalas_culto_id_fkey"
            columns: ["culto_id"]
            isOneToOne: false
            referencedRelation: "vw_cultos_com_escalas"
            referencedColumns: ["Culto nr."]
          },
          {
            foreignKeyName: "escalas_culto_id_fkey"
            columns: ["culto_id"]
            isOneToOne: false
            referencedRelation: "vw_cultos_incompletos"
            referencedColumns: ["Culto nr."]
          },
          {
            foreignKeyName: "escalas_culto_id_fkey"
            columns: ["culto_id"]
            isOneToOne: false
            referencedRelation: "vw_execucoes_louvores"
            referencedColumns: ["culto_nr"]
          },
          {
            foreignKeyName: "escalas_igreja_id_fkey"
            columns: ["igreja_id"]
            isOneToOne: false
            referencedRelation: "igrejas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "escalas_igreja_id_fkey"
            columns: ["igreja_id"]
            isOneToOne: false
            referencedRelation: "igrejas_endereco_view"
            referencedColumns: ["id"]
          },
        ]
      }
      escalas_funcoes: {
        Row: {
          confirmado: boolean | null
          criado_em: string | null
          escala_id: string
          id: string
          igreja_id: string | null
          observacoes: string | null
          ordem: number | null
          pessoa_id: string | null
          status: string | null
          tag_id: string
        }
        Insert: {
          confirmado?: boolean | null
          criado_em?: string | null
          escala_id: string
          id?: string
          igreja_id?: string | null
          observacoes?: string | null
          ordem?: number | null
          pessoa_id?: string | null
          status?: string | null
          tag_id: string
        }
        Update: {
          confirmado?: boolean | null
          criado_em?: string | null
          escala_id?: string
          id?: string
          igreja_id?: string | null
          observacoes?: string | null
          ordem?: number | null
          pessoa_id?: string | null
          status?: string | null
          tag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "escalas_funcoes_escala_id_fkey"
            columns: ["escala_id"]
            isOneToOne: false
            referencedRelation: "escalas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "escalas_funcoes_igreja_id_fkey"
            columns: ["igreja_id"]
            isOneToOne: false
            referencedRelation: "igrejas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "escalas_funcoes_igreja_id_fkey"
            columns: ["igreja_id"]
            isOneToOne: false
            referencedRelation: "igrejas_endereco_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "escalas_funcoes_pessoa_id_fkey"
            columns: ["pessoa_id"]
            isOneToOne: false
            referencedRelation: "pessoas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "escalas_funcoes_pessoa_id_fkey"
            columns: ["pessoa_id"]
            isOneToOne: false
            referencedRelation: "view_familias"
            referencedColumns: ["pessoa_id"]
          },
          {
            foreignKeyName: "escalas_funcoes_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "tags_funcoes"
            referencedColumns: ["id"]
          },
        ]
      }
      fin_categorias: {
        Row: {
          ativo: boolean
          criado_em: string
          grupo: string
          id: string
          igreja_id: string
          nome: string
          nominal: boolean
          ordem: number
          tipo: string
        }
        Insert: {
          ativo?: boolean
          criado_em?: string
          grupo: string
          id?: string
          igreja_id: string
          nome: string
          nominal?: boolean
          ordem?: number
          tipo: string
        }
        Update: {
          ativo?: boolean
          criado_em?: string
          grupo?: string
          id?: string
          igreja_id?: string
          nome?: string
          nominal?: boolean
          ordem?: number
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "fin_categorias_igreja_id_fkey"
            columns: ["igreja_id"]
            isOneToOne: false
            referencedRelation: "igrejas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fin_categorias_igreja_id_fkey"
            columns: ["igreja_id"]
            isOneToOne: false
            referencedRelation: "igrejas_endereco_view"
            referencedColumns: ["id"]
          },
        ]
      }
      fin_contas: {
        Row: {
          agencia: string | null
          ativo: boolean
          atualizado_em: string
          banco: string | null
          criado_em: string
          data_saldo_inicial: string
          id: string
          igreja_id: string
          nome: string
          numero: string | null
          ordem: number
          saldo_inicial: number
          tipo: string
        }
        Insert: {
          agencia?: string | null
          ativo?: boolean
          atualizado_em?: string
          banco?: string | null
          criado_em?: string
          data_saldo_inicial?: string
          id?: string
          igreja_id: string
          nome: string
          numero?: string | null
          ordem?: number
          saldo_inicial?: number
          tipo?: string
        }
        Update: {
          agencia?: string | null
          ativo?: boolean
          atualizado_em?: string
          banco?: string | null
          criado_em?: string
          data_saldo_inicial?: string
          id?: string
          igreja_id?: string
          nome?: string
          numero?: string | null
          ordem?: number
          saldo_inicial?: number
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "fin_contas_igreja_id_fkey"
            columns: ["igreja_id"]
            isOneToOne: false
            referencedRelation: "igrejas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fin_contas_igreja_id_fkey"
            columns: ["igreja_id"]
            isOneToOne: false
            referencedRelation: "igrejas_endereco_view"
            referencedColumns: ["id"]
          },
        ]
      }
      fin_equipe: {
        Row: {
          ano: number
          criado_em: string
          id: string
          igreja_id: string
          papel: string
          pessoa_id: string
        }
        Insert: {
          ano: number
          criado_em?: string
          id?: string
          igreja_id: string
          papel: string
          pessoa_id: string
        }
        Update: {
          ano?: number
          criado_em?: string
          id?: string
          igreja_id?: string
          papel?: string
          pessoa_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fin_equipe_igreja_id_fkey"
            columns: ["igreja_id"]
            isOneToOne: false
            referencedRelation: "igrejas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fin_equipe_igreja_id_fkey"
            columns: ["igreja_id"]
            isOneToOne: false
            referencedRelation: "igrejas_endereco_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fin_equipe_pessoa_id_fkey"
            columns: ["pessoa_id"]
            isOneToOne: false
            referencedRelation: "pessoas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fin_equipe_pessoa_id_fkey"
            columns: ["pessoa_id"]
            isOneToOne: false
            referencedRelation: "view_familias"
            referencedColumns: ["pessoa_id"]
          },
        ]
      }
      fin_exames: {
        Row: {
          ano: number
          aprovado_em: string | null
          aprovado_por: string | null
          ata_conselho: string | null
          atualizado_em: string
          enviado_em: string | null
          enviado_por: string | null
          examinado_em: string | null
          examinado_por: string | null
          id: string
          igreja_id: string
          observacoes: string | null
          parecer: string | null
          periodo: number
          status: string
        }
        Insert: {
          ano: number
          aprovado_em?: string | null
          aprovado_por?: string | null
          ata_conselho?: string | null
          atualizado_em?: string
          enviado_em?: string | null
          enviado_por?: string | null
          examinado_em?: string | null
          examinado_por?: string | null
          id?: string
          igreja_id: string
          observacoes?: string | null
          parecer?: string | null
          periodo: number
          status?: string
        }
        Update: {
          ano?: number
          aprovado_em?: string | null
          aprovado_por?: string | null
          ata_conselho?: string | null
          atualizado_em?: string
          enviado_em?: string | null
          enviado_por?: string | null
          examinado_em?: string | null
          examinado_por?: string | null
          id?: string
          igreja_id?: string
          observacoes?: string | null
          parecer?: string | null
          periodo?: number
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "fin_exames_igreja_id_fkey"
            columns: ["igreja_id"]
            isOneToOne: false
            referencedRelation: "igrejas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fin_exames_igreja_id_fkey"
            columns: ["igreja_id"]
            isOneToOne: false
            referencedRelation: "igrejas_endereco_view"
            referencedColumns: ["id"]
          },
        ]
      }
      fin_lancamentos: {
        Row: {
          atualizado_em: string
          categoria_id: string | null
          comprovante_path: string | null
          conta_destino_id: string | null
          conta_id: string
          criado_em: string
          criado_por: string | null
          data: string
          descricao: string | null
          documento_numero: string | null
          documento_tipo: string | null
          forma_pagamento: string | null
          id: string
          igreja_id: string
          pessoa_id: string | null
          tipo: string
          valor: number
        }
        Insert: {
          atualizado_em?: string
          categoria_id?: string | null
          comprovante_path?: string | null
          conta_destino_id?: string | null
          conta_id: string
          criado_em?: string
          criado_por?: string | null
          data: string
          descricao?: string | null
          documento_numero?: string | null
          documento_tipo?: string | null
          forma_pagamento?: string | null
          id?: string
          igreja_id: string
          pessoa_id?: string | null
          tipo: string
          valor: number
        }
        Update: {
          atualizado_em?: string
          categoria_id?: string | null
          comprovante_path?: string | null
          conta_destino_id?: string | null
          conta_id?: string
          criado_em?: string
          criado_por?: string | null
          data?: string
          descricao?: string | null
          documento_numero?: string | null
          documento_tipo?: string | null
          forma_pagamento?: string | null
          id?: string
          igreja_id?: string
          pessoa_id?: string | null
          tipo?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "fin_lancamentos_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "fin_categorias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fin_lancamentos_conta_destino_id_fkey"
            columns: ["conta_destino_id"]
            isOneToOne: false
            referencedRelation: "fin_contas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fin_lancamentos_conta_id_fkey"
            columns: ["conta_id"]
            isOneToOne: false
            referencedRelation: "fin_contas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fin_lancamentos_igreja_id_fkey"
            columns: ["igreja_id"]
            isOneToOne: false
            referencedRelation: "igrejas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fin_lancamentos_igreja_id_fkey"
            columns: ["igreja_id"]
            isOneToOne: false
            referencedRelation: "igrejas_endereco_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fin_lancamentos_pessoa_id_fkey"
            columns: ["pessoa_id"]
            isOneToOne: false
            referencedRelation: "pessoas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fin_lancamentos_pessoa_id_fkey"
            columns: ["pessoa_id"]
            isOneToOne: false
            referencedRelation: "view_familias"
            referencedColumns: ["pessoa_id"]
          },
        ]
      }
      fin_orcamentos: {
        Row: {
          ano: number
          atualizado_em: string
          categoria_id: string
          igreja_id: string
          valor_previsto: number
        }
        Insert: {
          ano: number
          atualizado_em?: string
          categoria_id: string
          igreja_id: string
          valor_previsto?: number
        }
        Update: {
          ano?: number
          atualizado_em?: string
          categoria_id?: string
          igreja_id?: string
          valor_previsto?: number
        }
        Relationships: [
          {
            foreignKeyName: "fin_orcamentos_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "fin_categorias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fin_orcamentos_igreja_id_fkey"
            columns: ["igreja_id"]
            isOneToOne: false
            referencedRelation: "igrejas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fin_orcamentos_igreja_id_fkey"
            columns: ["igreja_id"]
            isOneToOne: false
            referencedRelation: "igrejas_endereco_view"
            referencedColumns: ["id"]
          },
        ]
      }
      hinario_novo_cantico: {
        Row: {
          assunto: string | null
          autor_letra: string | null
          compositor: string | null
          created_at: string | null
          holyrics_artist: string | null
          holyrics_bpm: number | null
          holyrics_key: string | null
          holyrics_paragraphs: Json | null
          id: number
          letra: string | null
          link_audio: string | null
          link_pagina: string | null
          numero: string
          origem_letra: string | null
          origem_musica: string | null
          referencia_biblica: string | null
          titulo: string
        }
        Insert: {
          assunto?: string | null
          autor_letra?: string | null
          compositor?: string | null
          created_at?: string | null
          holyrics_artist?: string | null
          holyrics_bpm?: number | null
          holyrics_key?: string | null
          holyrics_paragraphs?: Json | null
          id?: number
          letra?: string | null
          link_audio?: string | null
          link_pagina?: string | null
          numero: string
          origem_letra?: string | null
          origem_musica?: string | null
          referencia_biblica?: string | null
          titulo: string
        }
        Update: {
          assunto?: string | null
          autor_letra?: string | null
          compositor?: string | null
          created_at?: string | null
          holyrics_artist?: string | null
          holyrics_bpm?: number | null
          holyrics_key?: string | null
          holyrics_paragraphs?: Json | null
          id?: number
          letra?: string | null
          link_audio?: string | null
          link_pagina?: string | null
          numero?: string
          origem_letra?: string | null
          origem_musica?: string | null
          referencia_biblica?: string | null
          titulo?: string
        }
        Relationships: []
      }
      igreja_cultos: {
        Row: {
          ativo: boolean | null
          criado_em: string | null
          descricao: string | null
          dia_semana: string
          horario: string
          id: string
          igreja_id: string
          nome: string
          ordem: number | null
        }
        Insert: {
          ativo?: boolean | null
          criado_em?: string | null
          descricao?: string | null
          dia_semana: string
          horario: string
          id?: string
          igreja_id: string
          nome: string
          ordem?: number | null
        }
        Update: {
          ativo?: boolean | null
          criado_em?: string | null
          descricao?: string | null
          dia_semana?: string
          horario?: string
          id?: string
          igreja_id?: string
          nome?: string
          ordem?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "igreja_cultos_igreja_id_fkey"
            columns: ["igreja_id"]
            isOneToOne: false
            referencedRelation: "igrejas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "igreja_cultos_igreja_id_fkey"
            columns: ["igreja_id"]
            isOneToOne: false
            referencedRelation: "igrejas_endereco_view"
            referencedColumns: ["id"]
          },
        ]
      }
      igreja_redes_sociais: {
        Row: {
          ativo: boolean | null
          criado_em: string | null
          id: string
          igreja_id: string
          ordem: number | null
          tipo: string
          url: string
        }
        Insert: {
          ativo?: boolean | null
          criado_em?: string | null
          id?: string
          igreja_id: string
          ordem?: number | null
          tipo: string
          url: string
        }
        Update: {
          ativo?: boolean | null
          criado_em?: string | null
          id?: string
          igreja_id?: string
          ordem?: number | null
          tipo?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "igreja_redes_sociais_igreja_id_fkey"
            columns: ["igreja_id"]
            isOneToOne: false
            referencedRelation: "igrejas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "igreja_redes_sociais_igreja_id_fkey"
            columns: ["igreja_id"]
            isOneToOne: false
            referencedRelation: "igrejas_endereco_view"
            referencedColumns: ["id"]
          },
        ]
      }
      igrejas: {
        Row: {
          apresentacao_galeria: Json | null
          apresentacao_imagem_url: string | null
          apresentacao_texto: string | null
          apresentacao_texto_i18n: Json | null
          apresentacao_titulo: string | null
          apresentacao_titulo_i18n: Json | null
          apresentacao_youtube_url: string | null
          ativo: boolean | null
          bairro: string | null
          cep: string | null
          cidade: string | null
          complemento: string | null
          criado_em: string | null
          dia_publicacao_boletim: number | null
          email: string | null
          endereco_completo: string | null
          horario_publicacao_boletim: string | null
          id: string
          instagram: string | null
          logo_url: string | null
          logradouro: string | null
          modelo_liturgico_padrao: Json | null
          modo_repertorio: string | null
          nome: string
          nome_abreviado: string | null
          nome_completo: string | null
          pais: string
          permite_cadastro_canticos: boolean | null
          regiao: string | null
          site: string | null
          slug: string
          telefone: string | null
          timezone_boletim: string | null
          tipos_liturgicos: Json | null
          uf: string | null
          visivel_publico: boolean | null
          whatsapp: string | null
          youtube: string | null
        }
        Insert: {
          apresentacao_galeria?: Json | null
          apresentacao_imagem_url?: string | null
          apresentacao_texto?: string | null
          apresentacao_texto_i18n?: Json | null
          apresentacao_titulo?: string | null
          apresentacao_titulo_i18n?: Json | null
          apresentacao_youtube_url?: string | null
          ativo?: boolean | null
          bairro?: string | null
          cep?: string | null
          cidade?: string | null
          complemento?: string | null
          criado_em?: string | null
          dia_publicacao_boletim?: number | null
          email?: string | null
          endereco_completo?: string | null
          horario_publicacao_boletim?: string | null
          id?: string
          instagram?: string | null
          logo_url?: string | null
          logradouro?: string | null
          modelo_liturgico_padrao?: Json | null
          modo_repertorio?: string | null
          nome: string
          nome_abreviado?: string | null
          nome_completo?: string | null
          pais?: string
          permite_cadastro_canticos?: boolean | null
          regiao?: string | null
          site?: string | null
          slug: string
          telefone?: string | null
          timezone_boletim?: string | null
          tipos_liturgicos?: Json | null
          uf?: string | null
          visivel_publico?: boolean | null
          whatsapp?: string | null
          youtube?: string | null
        }
        Update: {
          apresentacao_galeria?: Json | null
          apresentacao_imagem_url?: string | null
          apresentacao_texto?: string | null
          apresentacao_texto_i18n?: Json | null
          apresentacao_titulo?: string | null
          apresentacao_titulo_i18n?: Json | null
          apresentacao_youtube_url?: string | null
          ativo?: boolean | null
          bairro?: string | null
          cep?: string | null
          cidade?: string | null
          complemento?: string | null
          criado_em?: string | null
          dia_publicacao_boletim?: number | null
          email?: string | null
          endereco_completo?: string | null
          horario_publicacao_boletim?: string | null
          id?: string
          instagram?: string | null
          logo_url?: string | null
          logradouro?: string | null
          modelo_liturgico_padrao?: Json | null
          modo_repertorio?: string | null
          nome?: string
          nome_abreviado?: string | null
          nome_completo?: string | null
          pais?: string
          permite_cadastro_canticos?: boolean | null
          regiao?: string | null
          site?: string | null
          slug?: string
          telefone?: string | null
          timezone_boletim?: string | null
          tipos_liturgicos?: Json | null
          uf?: string | null
          visivel_publico?: boolean | null
          whatsapp?: string | null
          youtube?: string | null
        }
        Relationships: []
      }
      louvor_itens: {
        Row: {
          cantico_id: string | null
          conteudo_publico: string | null
          conteudo_publico_i18n: Json | null
          culto_id: number
          descricao: string | null
          horario: string | null
          id: string
          igreja_id: string | null
          ordem: number
          parent_id: string | null
          tipo: string
          tom: Database["public"]["Enums"]["tom_musical"] | null
          visibilidade: string
        }
        Insert: {
          cantico_id?: string | null
          conteudo_publico?: string | null
          conteudo_publico_i18n?: Json | null
          culto_id: number
          descricao?: string | null
          horario?: string | null
          id?: string
          igreja_id?: string | null
          ordem: number
          parent_id?: string | null
          tipo: string
          tom?: Database["public"]["Enums"]["tom_musical"] | null
          visibilidade?: string
        }
        Update: {
          cantico_id?: string | null
          conteudo_publico?: string | null
          conteudo_publico_i18n?: Json | null
          culto_id?: number
          descricao?: string | null
          horario?: string | null
          id?: string
          igreja_id?: string | null
          ordem?: number
          parent_id?: string | null
          tipo?: string
          tom?: Database["public"]["Enums"]["tom_musical"] | null
          visibilidade?: string
        }
        Relationships: [
          {
            foreignKeyName: "louvor_itens_culto_id_fkey"
            columns: ["culto_id"]
            isOneToOne: false
            referencedRelation: "Louvores IPPN"
            referencedColumns: ["Culto nr."]
          },
          {
            foreignKeyName: "louvor_itens_culto_id_fkey"
            columns: ["culto_id"]
            isOneToOne: false
            referencedRelation: "vw_cultos_com_escalas"
            referencedColumns: ["Culto nr."]
          },
          {
            foreignKeyName: "louvor_itens_culto_id_fkey"
            columns: ["culto_id"]
            isOneToOne: false
            referencedRelation: "vw_cultos_incompletos"
            referencedColumns: ["Culto nr."]
          },
          {
            foreignKeyName: "louvor_itens_culto_id_fkey"
            columns: ["culto_id"]
            isOneToOne: false
            referencedRelation: "vw_execucoes_louvores"
            referencedColumns: ["culto_nr"]
          },
          {
            foreignKeyName: "louvor_itens_igreja_id_fkey"
            columns: ["igreja_id"]
            isOneToOne: false
            referencedRelation: "igrejas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "louvor_itens_igreja_id_fkey"
            columns: ["igreja_id"]
            isOneToOne: false
            referencedRelation: "igrejas_endereco_view"
            referencedColumns: ["id"]
          },
        ]
      }
      "Louvores IPPN": {
        Row: {
          "Culto nr.": number
          Dia: string | null
          igreja_id: string | null
          imagem_url: string | null
          palavra_pastoral: string | null
          palavra_pastoral_autor: string | null
          palavra_pastoral_i18n: Json | null
        }
        Insert: {
          "Culto nr."?: number
          Dia?: string | null
          igreja_id?: string | null
          imagem_url?: string | null
          palavra_pastoral?: string | null
          palavra_pastoral_autor?: string | null
          palavra_pastoral_i18n?: Json | null
        }
        Update: {
          "Culto nr."?: number
          Dia?: string | null
          igreja_id?: string | null
          imagem_url?: string | null
          palavra_pastoral?: string | null
          palavra_pastoral_autor?: string | null
          palavra_pastoral_i18n?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "Louvores IPPN_igreja_id_fkey"
            columns: ["igreja_id"]
            isOneToOne: false
            referencedRelation: "igrejas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "Louvores IPPN_igreja_id_fkey"
            columns: ["igreja_id"]
            isOneToOne: false
            referencedRelation: "igrejas_endereco_view"
            referencedColumns: ["id"]
          },
        ]
      }
      modelo_culto_padrao: {
        Row: {
          bloco: string
          descricao_padrao: string
          id: string
          igreja_id: string | null
          ordem: number
          tem_cantico: boolean | null
          tipo: string
        }
        Insert: {
          bloco: string
          descricao_padrao: string
          id?: string
          igreja_id?: string | null
          ordem: number
          tem_cantico?: boolean | null
          tipo: string
        }
        Update: {
          bloco?: string
          descricao_padrao?: string
          id?: string
          igreja_id?: string | null
          ordem?: number
          tem_cantico?: boolean | null
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "modelo_culto_padrao_igreja_id_fkey"
            columns: ["igreja_id"]
            isOneToOne: false
            referencedRelation: "igrejas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "modelo_culto_padrao_igreja_id_fkey"
            columns: ["igreja_id"]
            isOneToOne: false
            referencedRelation: "igrejas_endereco_view"
            referencedColumns: ["id"]
          },
        ]
      }
      modelos_liturgia: {
        Row: {
          bloco: string
          conteudo_publico_padrao_i18n: Json | null
          descricao_interna_padrao_i18n: Json | null
          descricao_padrao: string
          id: string
          igreja_id: string | null
          ordem: number
          tem_cantico: boolean | null
          tipo: string
        }
        Insert: {
          bloco: string
          conteudo_publico_padrao_i18n?: Json | null
          descricao_interna_padrao_i18n?: Json | null
          descricao_padrao: string
          id?: string
          igreja_id?: string | null
          ordem: number
          tem_cantico?: boolean | null
          tipo: string
        }
        Update: {
          bloco?: string
          conteudo_publico_padrao_i18n?: Json | null
          descricao_interna_padrao_i18n?: Json | null
          descricao_padrao?: string
          id?: string
          igreja_id?: string | null
          ordem?: number
          tem_cantico?: boolean | null
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "modelos_liturgia_igreja_id_fkey"
            columns: ["igreja_id"]
            isOneToOne: false
            referencedRelation: "igrejas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "modelos_liturgia_igreja_id_fkey"
            columns: ["igreja_id"]
            isOneToOne: false
            referencedRelation: "igrejas_endereco_view"
            referencedColumns: ["id"]
          },
        ]
      }
      notas_pastorais: {
        Row: {
          atualizado_em: string | null
          autor_id: string
          conteudo: string
          criado_em: string | null
          id: string
          igreja_id: string | null
          membro_id: string
          privado: boolean | null
          tipo: string | null
          titulo: string | null
        }
        Insert: {
          atualizado_em?: string | null
          autor_id: string
          conteudo: string
          criado_em?: string | null
          id?: string
          igreja_id?: string | null
          membro_id: string
          privado?: boolean | null
          tipo?: string | null
          titulo?: string | null
        }
        Update: {
          atualizado_em?: string | null
          autor_id?: string
          conteudo?: string
          criado_em?: string | null
          id?: string
          igreja_id?: string | null
          membro_id?: string
          privado?: boolean | null
          tipo?: string | null
          titulo?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notas_pastorais_autor_fkey"
            columns: ["autor_id"]
            isOneToOne: false
            referencedRelation: "pessoas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notas_pastorais_autor_fkey"
            columns: ["autor_id"]
            isOneToOne: false
            referencedRelation: "view_familias"
            referencedColumns: ["pessoa_id"]
          },
          {
            foreignKeyName: "notas_pastorais_igreja_id_fkey"
            columns: ["igreja_id"]
            isOneToOne: false
            referencedRelation: "igrejas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notas_pastorais_igreja_id_fkey"
            columns: ["igreja_id"]
            isOneToOne: false
            referencedRelation: "igrejas_endereco_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notas_pastorais_membro_fkey"
            columns: ["membro_id"]
            isOneToOne: false
            referencedRelation: "pessoas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notas_pastorais_membro_fkey"
            columns: ["membro_id"]
            isOneToOne: false
            referencedRelation: "view_familias"
            referencedColumns: ["pessoa_id"]
          },
        ]
      }
      noticias_mensais: {
        Row: {
          ano_referencia: number
          ativo: boolean
          atualizado_em: string
          corpo: string
          criado_em: string
          id: string
          igreja_id: string
          imagem_url: string | null
          mes_referencia: number
          ordem: number
          titulo: string
        }
        Insert: {
          ano_referencia: number
          ativo?: boolean
          atualizado_em?: string
          corpo?: string
          criado_em?: string
          id?: string
          igreja_id: string
          imagem_url?: string | null
          mes_referencia: number
          ordem?: number
          titulo: string
        }
        Update: {
          ano_referencia?: number
          ativo?: boolean
          atualizado_em?: string
          corpo?: string
          criado_em?: string
          id?: string
          igreja_id?: string
          imagem_url?: string | null
          mes_referencia?: number
          ordem?: number
          titulo?: string
        }
        Relationships: [
          {
            foreignKeyName: "noticias_mensais_igreja_id_fkey"
            columns: ["igreja_id"]
            isOneToOne: false
            referencedRelation: "igrejas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "noticias_mensais_igreja_id_fkey"
            columns: ["igreja_id"]
            isOneToOne: false
            referencedRelation: "igrejas_endereco_view"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_deliveries: {
        Row: {
          canal: Database["public"]["Enums"]["notification_channel"]
          created_at: string
          destino: string | null
          id: string
          last_error: string | null
          notification_id: string
          payload: Json
          provider: string | null
          provider_message_id: string | null
          scheduled_at: string
          sent_at: string | null
          status: Database["public"]["Enums"]["notification_status"]
          tentativas: number
        }
        Insert: {
          canal: Database["public"]["Enums"]["notification_channel"]
          created_at?: string
          destino?: string | null
          id?: string
          last_error?: string | null
          notification_id: string
          payload?: Json
          provider?: string | null
          provider_message_id?: string | null
          scheduled_at?: string
          sent_at?: string | null
          status?: Database["public"]["Enums"]["notification_status"]
          tentativas?: number
        }
        Update: {
          canal?: Database["public"]["Enums"]["notification_channel"]
          created_at?: string
          destino?: string | null
          id?: string
          last_error?: string | null
          notification_id?: string
          payload?: Json
          provider?: string | null
          provider_message_id?: string | null
          scheduled_at?: string
          sent_at?: string | null
          status?: Database["public"]["Enums"]["notification_status"]
          tentativas?: number
        }
        Relationships: [
          {
            foreignKeyName: "notification_deliveries_notification_id_fkey"
            columns: ["notification_id"]
            isOneToOne: false
            referencedRelation: "notifications"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_events: {
        Row: {
          chave_deduplicacao: string | null
          criado_em: string
          entidade_id: string | null
          entidade_tipo: string | null
          id: string
          igreja_id: string
          payload: Json
          tipo: string
        }
        Insert: {
          chave_deduplicacao?: string | null
          criado_em?: string
          entidade_id?: string | null
          entidade_tipo?: string | null
          id?: string
          igreja_id: string
          payload?: Json
          tipo: string
        }
        Update: {
          chave_deduplicacao?: string | null
          criado_em?: string
          entidade_id?: string | null
          entidade_tipo?: string | null
          id?: string
          igreja_id?: string
          payload?: Json
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_events_igreja_id_fkey"
            columns: ["igreja_id"]
            isOneToOne: false
            referencedRelation: "igrejas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_events_igreja_id_fkey"
            columns: ["igreja_id"]
            isOneToOne: false
            referencedRelation: "igrejas_endereco_view"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_preferences: {
        Row: {
          canal: Database["public"]["Enums"]["notification_channel"]
          created_at: string
          enabled: boolean
          id: string
          igreja_id: string
          tipo: string
          updated_at: string
          usuario_acesso_id: string
        }
        Insert: {
          canal: Database["public"]["Enums"]["notification_channel"]
          created_at?: string
          enabled?: boolean
          id?: string
          igreja_id: string
          tipo: string
          updated_at?: string
          usuario_acesso_id: string
        }
        Update: {
          canal?: Database["public"]["Enums"]["notification_channel"]
          created_at?: string
          enabled?: boolean
          id?: string
          igreja_id?: string
          tipo?: string
          updated_at?: string
          usuario_acesso_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_preferences_igreja_id_fkey"
            columns: ["igreja_id"]
            isOneToOne: false
            referencedRelation: "igrejas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_preferences_igreja_id_fkey"
            columns: ["igreja_id"]
            isOneToOne: false
            referencedRelation: "igrejas_endereco_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_preferences_usuario_acesso_id_fkey"
            columns: ["usuario_acesso_id"]
            isOneToOne: false
            referencedRelation: "usuarios_acesso"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          corpo: string
          created_at: string
          deep_link: string | null
          event_id: string
          id: string
          igreja_id: string | null
          pastoral_bucket: string | null
          payload: Json
          pessoa_id: string | null
          prioridade: number
          read_at: string | null
          tipo: string
          titulo: string
          usuario_acesso_id: string | null
        }
        Insert: {
          corpo: string
          created_at?: string
          deep_link?: string | null
          event_id?: string
          id?: string
          igreja_id?: string | null
          pastoral_bucket?: string | null
          payload?: Json
          pessoa_id?: string | null
          prioridade?: number
          read_at?: string | null
          tipo: string
          titulo: string
          usuario_acesso_id?: string | null
        }
        Update: {
          corpo?: string
          created_at?: string
          deep_link?: string | null
          event_id?: string
          id?: string
          igreja_id?: string | null
          pastoral_bucket?: string | null
          payload?: Json
          pessoa_id?: string | null
          prioridade?: number
          read_at?: string | null
          tipo?: string
          titulo?: string
          usuario_acesso_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notifications_igreja_id_fkey"
            columns: ["igreja_id"]
            isOneToOne: false
            referencedRelation: "igrejas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_igreja_id_fkey"
            columns: ["igreja_id"]
            isOneToOne: false
            referencedRelation: "igrejas_endereco_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_pessoa_id_fkey"
            columns: ["pessoa_id"]
            isOneToOne: false
            referencedRelation: "pessoas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_pessoa_id_fkey"
            columns: ["pessoa_id"]
            isOneToOne: false
            referencedRelation: "view_familias"
            referencedColumns: ["pessoa_id"]
          },
          {
            foreignKeyName: "notifications_usuario_acesso_id_fkey"
            columns: ["usuario_acesso_id"]
            isOneToOne: false
            referencedRelation: "usuarios_acesso"
            referencedColumns: ["id"]
          },
        ]
      }
      oikos_leads: {
        Row: {
          atualizado_em: string
          contato: string
          criado_em: string
          funcao: string | null
          id: string
          igreja: string | null
          locale: string | null
          mensagem: string | null
          nome: string
          origem: string
          status: string
          user_agent: string | null
        }
        Insert: {
          atualizado_em?: string
          contato: string
          criado_em?: string
          funcao?: string | null
          id?: string
          igreja?: string | null
          locale?: string | null
          mensagem?: string | null
          nome: string
          origem?: string
          status?: string
          user_agent?: string | null
        }
        Update: {
          atualizado_em?: string
          contato?: string
          criado_em?: string
          funcao?: string | null
          id?: string
          igreja?: string | null
          locale?: string | null
          mensagem?: string | null
          nome?: string
          origem?: string
          status?: string
          user_agent?: string | null
        }
        Relationships: []
      }
      pedidos_pastorais: {
        Row: {
          assunto: string | null
          atualizado_em: string
          categoria: string
          criado_em: string
          deseja_retorno: boolean
          email_solicitante: string | null
          id: string
          igreja_id: string
          mensagem: string
          nome_solicitante: string
          pessoa_id: string | null
          status: string
          telefone_solicitante: string | null
          usuario_acesso_id: string | null
        }
        Insert: {
          assunto?: string | null
          atualizado_em?: string
          categoria?: string
          criado_em?: string
          deseja_retorno?: boolean
          email_solicitante?: string | null
          id?: string
          igreja_id: string
          mensagem: string
          nome_solicitante: string
          pessoa_id?: string | null
          status?: string
          telefone_solicitante?: string | null
          usuario_acesso_id?: string | null
        }
        Update: {
          assunto?: string | null
          atualizado_em?: string
          categoria?: string
          criado_em?: string
          deseja_retorno?: boolean
          email_solicitante?: string | null
          id?: string
          igreja_id?: string
          mensagem?: string
          nome_solicitante?: string
          pessoa_id?: string | null
          status?: string
          telefone_solicitante?: string | null
          usuario_acesso_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pedidos_pastorais_igreja_id_fkey"
            columns: ["igreja_id"]
            isOneToOne: false
            referencedRelation: "igrejas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pedidos_pastorais_igreja_id_fkey"
            columns: ["igreja_id"]
            isOneToOne: false
            referencedRelation: "igrejas_endereco_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pedidos_pastorais_pessoa_id_fkey"
            columns: ["pessoa_id"]
            isOneToOne: false
            referencedRelation: "pessoas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pedidos_pastorais_pessoa_id_fkey"
            columns: ["pessoa_id"]
            isOneToOne: false
            referencedRelation: "view_familias"
            referencedColumns: ["pessoa_id"]
          },
          {
            foreignKeyName: "pedidos_pastorais_usuario_acesso_id_fkey"
            columns: ["usuario_acesso_id"]
            isOneToOne: false
            referencedRelation: "usuarios_acesso"
            referencedColumns: ["id"]
          },
        ]
      }
      pessoas: {
        Row: {
          apelido: string | null
          assinatura_ficha: string | null
          assinatura_ficha_em: string | null
          atividade_atual: string | null
          ativo: boolean | null
          atualizado_em: string | null
          bairro: string | null
          batizado: boolean | null
          cadastro_token: string
          cargo: Database["public"]["Enums"]["cargo_tipo"] | null
          cep: string | null
          cidade: string | null
          classificacao_membro: string | null
          congregacao_nome: string | null
          conjuge_nome: string | null
          conjuge_religiao: string | null
          criado_em: string | null
          criado_por: string | null
          cursos_discipulado: string[] | null
          data_batismo: string | null
          data_casamento: string | null
          data_nascimento: string | null
          data_profissao_fe: string | null
          email: string | null
          endereco_completo: string | null
          escolaridade: string | null
          estado_civil: string | null
          foto_url: string | null
          google_place_id: string | null
          grupo_familiar_lider: string | null
          grupo_familiar_nome: string | null
          id: string
          igreja_sede_congregacao: string | null
          is_teste: boolean
          latitude: number | null
          logradouro: string | null
          longitude: number | null
          migrado_de: string | null
          nacionalidade: string | null
          naturalidade_cidade: string | null
          naturalidade_uf: string | null
          nome: string
          nome_familia_customizado: string | null
          nome_mae: string | null
          nome_pai: string | null
          observacoes: string | null
          pais_origem: string | null
          profissao: string | null
          proposito_entrevista: string | null
          sexo: Database["public"]["Enums"]["sexo_tipo"] | null
          situacao_saude: string | null
          status_membro: string | null
          telefone: string | null
          transferencia_ipb_origem: string | null
          transferencia_jurisdicao_sem_carta: string | null
          transferencia_observacao: string | null
          transferido_ipb: boolean | null
          transferido_ipb_origem: string | null
          transferido_outra_denominacao: string | null
          uf: string | null
          uniao_estavel_tempo: string | null
          usuario_id: string | null
        }
        Insert: {
          apelido?: string | null
          assinatura_ficha?: string | null
          assinatura_ficha_em?: string | null
          atividade_atual?: string | null
          ativo?: boolean | null
          atualizado_em?: string | null
          bairro?: string | null
          batizado?: boolean | null
          cadastro_token?: string
          cargo?: Database["public"]["Enums"]["cargo_tipo"] | null
          cep?: string | null
          cidade?: string | null
          classificacao_membro?: string | null
          congregacao_nome?: string | null
          conjuge_nome?: string | null
          conjuge_religiao?: string | null
          criado_em?: string | null
          criado_por?: string | null
          cursos_discipulado?: string[] | null
          data_batismo?: string | null
          data_casamento?: string | null
          data_nascimento?: string | null
          data_profissao_fe?: string | null
          email?: string | null
          endereco_completo?: string | null
          escolaridade?: string | null
          estado_civil?: string | null
          foto_url?: string | null
          google_place_id?: string | null
          grupo_familiar_lider?: string | null
          grupo_familiar_nome?: string | null
          id?: string
          igreja_sede_congregacao?: string | null
          is_teste?: boolean
          latitude?: number | null
          logradouro?: string | null
          longitude?: number | null
          migrado_de?: string | null
          nacionalidade?: string | null
          naturalidade_cidade?: string | null
          naturalidade_uf?: string | null
          nome: string
          nome_familia_customizado?: string | null
          nome_mae?: string | null
          nome_pai?: string | null
          observacoes?: string | null
          pais_origem?: string | null
          profissao?: string | null
          proposito_entrevista?: string | null
          sexo?: Database["public"]["Enums"]["sexo_tipo"] | null
          situacao_saude?: string | null
          status_membro?: string | null
          telefone?: string | null
          transferencia_ipb_origem?: string | null
          transferencia_jurisdicao_sem_carta?: string | null
          transferencia_observacao?: string | null
          transferido_ipb?: boolean | null
          transferido_ipb_origem?: string | null
          transferido_outra_denominacao?: string | null
          uf?: string | null
          uniao_estavel_tempo?: string | null
          usuario_id?: string | null
        }
        Update: {
          apelido?: string | null
          assinatura_ficha?: string | null
          assinatura_ficha_em?: string | null
          atividade_atual?: string | null
          ativo?: boolean | null
          atualizado_em?: string | null
          bairro?: string | null
          batizado?: boolean | null
          cadastro_token?: string
          cargo?: Database["public"]["Enums"]["cargo_tipo"] | null
          cep?: string | null
          cidade?: string | null
          classificacao_membro?: string | null
          congregacao_nome?: string | null
          conjuge_nome?: string | null
          conjuge_religiao?: string | null
          criado_em?: string | null
          criado_por?: string | null
          cursos_discipulado?: string[] | null
          data_batismo?: string | null
          data_casamento?: string | null
          data_nascimento?: string | null
          data_profissao_fe?: string | null
          email?: string | null
          endereco_completo?: string | null
          escolaridade?: string | null
          estado_civil?: string | null
          foto_url?: string | null
          google_place_id?: string | null
          grupo_familiar_lider?: string | null
          grupo_familiar_nome?: string | null
          id?: string
          igreja_sede_congregacao?: string | null
          is_teste?: boolean
          latitude?: number | null
          logradouro?: string | null
          longitude?: number | null
          migrado_de?: string | null
          nacionalidade?: string | null
          naturalidade_cidade?: string | null
          naturalidade_uf?: string | null
          nome?: string
          nome_familia_customizado?: string | null
          nome_mae?: string | null
          nome_pai?: string | null
          observacoes?: string | null
          pais_origem?: string | null
          profissao?: string | null
          proposito_entrevista?: string | null
          sexo?: Database["public"]["Enums"]["sexo_tipo"] | null
          situacao_saude?: string | null
          status_membro?: string | null
          telefone?: string | null
          transferencia_ipb_origem?: string | null
          transferencia_jurisdicao_sem_carta?: string | null
          transferencia_observacao?: string | null
          transferido_ipb?: boolean | null
          transferido_ipb_origem?: string | null
          transferido_outra_denominacao?: string | null
          uf?: string | null
          uniao_estavel_tempo?: string | null
          usuario_id?: string | null
        }
        Relationships: []
      }
      pessoas_igrejas: {
        Row: {
          ativo: boolean
          atualizado_em: string
          cargo: Database["public"]["Enums"]["cargo_tipo"] | null
          criado_em: string
          id: string
          igreja_id: string
          observacoes: string | null
          pessoa_id: string
          status_membro: string
        }
        Insert: {
          ativo?: boolean
          atualizado_em?: string
          cargo?: Database["public"]["Enums"]["cargo_tipo"] | null
          criado_em?: string
          id?: string
          igreja_id: string
          observacoes?: string | null
          pessoa_id: string
          status_membro?: string
        }
        Update: {
          ativo?: boolean
          atualizado_em?: string
          cargo?: Database["public"]["Enums"]["cargo_tipo"] | null
          criado_em?: string
          id?: string
          igreja_id?: string
          observacoes?: string | null
          pessoa_id?: string
          status_membro?: string
        }
        Relationships: [
          {
            foreignKeyName: "pessoas_igrejas_igreja_id_fkey"
            columns: ["igreja_id"]
            isOneToOne: false
            referencedRelation: "igrejas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pessoas_igrejas_igreja_id_fkey"
            columns: ["igreja_id"]
            isOneToOne: false
            referencedRelation: "igrejas_endereco_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pessoas_igrejas_pessoa_id_fkey"
            columns: ["pessoa_id"]
            isOneToOne: false
            referencedRelation: "pessoas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pessoas_igrejas_pessoa_id_fkey"
            columns: ["pessoa_id"]
            isOneToOne: false
            referencedRelation: "view_familias"
            referencedColumns: ["pessoa_id"]
          },
        ]
      }
      push_dispositivos: {
        Row: {
          ambiente: string
          ativo: boolean
          atualizado_em: string
          authorization_status: string
          criado_em: string
          id: string
          igreja_id: string | null
          installation_id: string
          locale: string | null
          pessoa_id: string | null
          plataforma: string
          push_token: string
          ultimo_registro_em: string
          usuario_acesso_id: string | null
        }
        Insert: {
          ambiente?: string
          ativo?: boolean
          atualizado_em?: string
          authorization_status?: string
          criado_em?: string
          id?: string
          igreja_id?: string | null
          installation_id: string
          locale?: string | null
          pessoa_id?: string | null
          plataforma?: string
          push_token: string
          ultimo_registro_em?: string
          usuario_acesso_id?: string | null
        }
        Update: {
          ambiente?: string
          ativo?: boolean
          atualizado_em?: string
          authorization_status?: string
          criado_em?: string
          id?: string
          igreja_id?: string | null
          installation_id?: string
          locale?: string | null
          pessoa_id?: string | null
          plataforma?: string
          push_token?: string
          ultimo_registro_em?: string
          usuario_acesso_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "push_dispositivos_igreja_id_fkey"
            columns: ["igreja_id"]
            isOneToOne: false
            referencedRelation: "igrejas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "push_dispositivos_igreja_id_fkey"
            columns: ["igreja_id"]
            isOneToOne: false
            referencedRelation: "igrejas_endereco_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "push_dispositivos_pessoa_id_fkey"
            columns: ["pessoa_id"]
            isOneToOne: false
            referencedRelation: "pessoas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "push_dispositivos_pessoa_id_fkey"
            columns: ["pessoa_id"]
            isOneToOne: false
            referencedRelation: "view_familias"
            referencedColumns: ["pessoa_id"]
          },
          {
            foreignKeyName: "push_dispositivos_usuario_acesso_id_fkey"
            columns: ["usuario_acesso_id"]
            isOneToOne: false
            referencedRelation: "usuarios_acesso"
            referencedColumns: ["id"]
          },
        ]
      }
      push_notificacoes_fila: {
        Row: {
          agendada_para: string
          atualizado_em: string
          chave_deduplicacao: string | null
          criado_em: string
          culto_id: number | null
          escala_id: string | null
          id: string
          igreja_id: string
          mensagem: string
          payload: Json
          pessoa_id: string | null
          processada_em: string | null
          status: string
          tentativas: number
          tipo: string
          titulo: string
        }
        Insert: {
          agendada_para?: string
          atualizado_em?: string
          chave_deduplicacao?: string | null
          criado_em?: string
          culto_id?: number | null
          escala_id?: string | null
          id?: string
          igreja_id: string
          mensagem: string
          payload?: Json
          pessoa_id?: string | null
          processada_em?: string | null
          status?: string
          tentativas?: number
          tipo: string
          titulo: string
        }
        Update: {
          agendada_para?: string
          atualizado_em?: string
          chave_deduplicacao?: string | null
          criado_em?: string
          culto_id?: number | null
          escala_id?: string | null
          id?: string
          igreja_id?: string
          mensagem?: string
          payload?: Json
          pessoa_id?: string | null
          processada_em?: string | null
          status?: string
          tentativas?: number
          tipo?: string
          titulo?: string
        }
        Relationships: [
          {
            foreignKeyName: "push_notificacoes_fila_escala_id_fkey"
            columns: ["escala_id"]
            isOneToOne: false
            referencedRelation: "escalas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "push_notificacoes_fila_igreja_id_fkey"
            columns: ["igreja_id"]
            isOneToOne: false
            referencedRelation: "igrejas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "push_notificacoes_fila_igreja_id_fkey"
            columns: ["igreja_id"]
            isOneToOne: false
            referencedRelation: "igrejas_endereco_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "push_notificacoes_fila_pessoa_id_fkey"
            columns: ["pessoa_id"]
            isOneToOne: false
            referencedRelation: "pessoas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "push_notificacoes_fila_pessoa_id_fkey"
            columns: ["pessoa_id"]
            isOneToOne: false
            referencedRelation: "view_familias"
            referencedColumns: ["pessoa_id"]
          },
        ]
      }
      recursos_multimidia: {
        Row: {
          ativo: boolean
          atualizado_em: string
          atualizado_por: string | null
          categoria: string
          criado_em: string
          criado_por: string | null
          data_recurso: string
          descricao: string
          duracao: string | null
          id: string
          igreja_id: string | null
          ordem: number
          plataforma: string
          responsavel: string | null
          thumbnail_url: string | null
          titulo: string
          video_url: string | null
          youtube_url: string | null
        }
        Insert: {
          ativo?: boolean
          atualizado_em?: string
          atualizado_por?: string | null
          categoria?: string
          criado_em?: string
          criado_por?: string | null
          data_recurso: string
          descricao?: string
          duracao?: string | null
          id?: string
          igreja_id?: string | null
          ordem?: number
          plataforma?: string
          responsavel?: string | null
          thumbnail_url?: string | null
          titulo: string
          video_url?: string | null
          youtube_url?: string | null
        }
        Update: {
          ativo?: boolean
          atualizado_em?: string
          atualizado_por?: string | null
          categoria?: string
          criado_em?: string
          criado_por?: string | null
          data_recurso?: string
          descricao?: string
          duracao?: string | null
          id?: string
          igreja_id?: string | null
          ordem?: number
          plataforma?: string
          responsavel?: string | null
          thumbnail_url?: string | null
          titulo?: string
          video_url?: string | null
          youtube_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "recursos_multimidia_igreja_id_fkey"
            columns: ["igreja_id"]
            isOneToOne: false
            referencedRelation: "igrejas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recursos_multimidia_igreja_id_fkey"
            columns: ["igreja_id"]
            isOneToOne: false
            referencedRelation: "igrejas_endereco_view"
            referencedColumns: ["id"]
          },
        ]
      }
      relacionamentos: {
        Row: {
          criado_em: string | null
          criado_por: string | null
          id: string
          igreja_id: string | null
          pessoa_id: string
          pessoa_relacionada_id: string
          tipo: Database["public"]["Enums"]["tipo_relacionamento"]
        }
        Insert: {
          criado_em?: string | null
          criado_por?: string | null
          id?: string
          igreja_id?: string | null
          pessoa_id: string
          pessoa_relacionada_id: string
          tipo: Database["public"]["Enums"]["tipo_relacionamento"]
        }
        Update: {
          criado_em?: string | null
          criado_por?: string | null
          id?: string
          igreja_id?: string | null
          pessoa_id?: string
          pessoa_relacionada_id?: string
          tipo?: Database["public"]["Enums"]["tipo_relacionamento"]
        }
        Relationships: [
          {
            foreignKeyName: "relacionamentos_igreja_id_fkey"
            columns: ["igreja_id"]
            isOneToOne: false
            referencedRelation: "igrejas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "relacionamentos_igreja_id_fkey"
            columns: ["igreja_id"]
            isOneToOne: false
            referencedRelation: "igrejas_endereco_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "relacionamentos_pessoa_id_fkey"
            columns: ["pessoa_id"]
            isOneToOne: false
            referencedRelation: "pessoas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "relacionamentos_pessoa_id_fkey"
            columns: ["pessoa_id"]
            isOneToOne: false
            referencedRelation: "view_familias"
            referencedColumns: ["pessoa_id"]
          },
          {
            foreignKeyName: "relacionamentos_pessoa_relacionada_id_fkey"
            columns: ["pessoa_relacionada_id"]
            isOneToOne: false
            referencedRelation: "pessoas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "relacionamentos_pessoa_relacionada_id_fkey"
            columns: ["pessoa_relacionada_id"]
            isOneToOne: false
            referencedRelation: "view_familias"
            referencedColumns: ["pessoa_id"]
          },
        ]
      }
      tags_funcoes: {
        Row: {
          ativo: boolean | null
          categoria: string
          cor: string | null
          criado_em: string | null
          icone: string | null
          id: string
          igreja_id: string | null
          nome: string
          ordem: number | null
          ordem_categoria: number | null
        }
        Insert: {
          ativo?: boolean | null
          categoria: string
          cor?: string | null
          criado_em?: string | null
          icone?: string | null
          id?: string
          igreja_id?: string | null
          nome: string
          ordem?: number | null
          ordem_categoria?: number | null
        }
        Update: {
          ativo?: boolean | null
          categoria?: string
          cor?: string | null
          criado_em?: string | null
          icone?: string | null
          id?: string
          igreja_id?: string | null
          nome?: string
          ordem?: number | null
          ordem_categoria?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "tags_funcoes_igreja_id_fkey"
            columns: ["igreja_id"]
            isOneToOne: false
            referencedRelation: "igrejas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tags_funcoes_igreja_id_fkey"
            columns: ["igreja_id"]
            isOneToOne: false
            referencedRelation: "igrejas_endereco_view"
            referencedColumns: ["id"]
          },
        ]
      }
      usuarios_acesso: {
        Row: {
          ativo: boolean | null
          atualizado_em: string | null
          auth_user_id: string | null
          cargo: Database["public"]["Enums"]["cargo_tipo"] | null
          criado_em: string | null
          criado_por: string | null
          email: string
          foto_url: string | null
          id: string
          igreja_id: string | null
          migrado: boolean | null
          motivo_inativo: string | null
          nome: string | null
          observacoes: string | null
          pessoa_id: string | null
          telefone: string | null
        }
        Insert: {
          ativo?: boolean | null
          atualizado_em?: string | null
          auth_user_id?: string | null
          cargo?: Database["public"]["Enums"]["cargo_tipo"] | null
          criado_em?: string | null
          criado_por?: string | null
          email: string
          foto_url?: string | null
          id?: string
          igreja_id?: string | null
          migrado?: boolean | null
          motivo_inativo?: string | null
          nome?: string | null
          observacoes?: string | null
          pessoa_id?: string | null
          telefone?: string | null
        }
        Update: {
          ativo?: boolean | null
          atualizado_em?: string | null
          auth_user_id?: string | null
          cargo?: Database["public"]["Enums"]["cargo_tipo"] | null
          criado_em?: string | null
          criado_por?: string | null
          email?: string
          foto_url?: string | null
          id?: string
          igreja_id?: string | null
          migrado?: boolean | null
          motivo_inativo?: string | null
          nome?: string | null
          observacoes?: string | null
          pessoa_id?: string | null
          telefone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "usuarios_acesso_igreja_id_fkey"
            columns: ["igreja_id"]
            isOneToOne: false
            referencedRelation: "igrejas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "usuarios_acesso_igreja_id_fkey"
            columns: ["igreja_id"]
            isOneToOne: false
            referencedRelation: "igrejas_endereco_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "usuarios_acesso_pessoa_id_fkey"
            columns: ["pessoa_id"]
            isOneToOne: false
            referencedRelation: "pessoas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "usuarios_acesso_pessoa_id_fkey"
            columns: ["pessoa_id"]
            isOneToOne: false
            referencedRelation: "view_familias"
            referencedColumns: ["pessoa_id"]
          },
        ]
      }
      usuarios_igrejas: {
        Row: {
          ativo: boolean
          cargo: Database["public"]["Enums"]["cargo_tipo"]
          criado_em: string
          id: string
          igreja_id: string
          usuario_id: string
        }
        Insert: {
          ativo?: boolean
          cargo: Database["public"]["Enums"]["cargo_tipo"]
          criado_em?: string
          id?: string
          igreja_id: string
          usuario_id: string
        }
        Update: {
          ativo?: boolean
          cargo?: Database["public"]["Enums"]["cargo_tipo"]
          criado_em?: string
          id?: string
          igreja_id?: string
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "usuarios_igrejas_igreja_fkey"
            columns: ["igreja_id"]
            isOneToOne: false
            referencedRelation: "igrejas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "usuarios_igrejas_igreja_fkey"
            columns: ["igreja_id"]
            isOneToOne: false
            referencedRelation: "igrejas_endereco_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "usuarios_igrejas_usuario_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "usuarios_acesso"
            referencedColumns: ["id"]
          },
        ]
      }
      usuarios_tags: {
        Row: {
          criado_em: string | null
          id: string
          igreja_id: string | null
          nivel_habilidade: number | null
          pessoa_id: string | null
          tag_id: string
          usuario_id: string | null
        }
        Insert: {
          criado_em?: string | null
          id?: string
          igreja_id?: string | null
          nivel_habilidade?: number | null
          pessoa_id?: string | null
          tag_id: string
          usuario_id?: string | null
        }
        Update: {
          criado_em?: string | null
          id?: string
          igreja_id?: string | null
          nivel_habilidade?: number | null
          pessoa_id?: string | null
          tag_id?: string
          usuario_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "usuarios_tags_igreja_id_fkey"
            columns: ["igreja_id"]
            isOneToOne: false
            referencedRelation: "igrejas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "usuarios_tags_igreja_id_fkey"
            columns: ["igreja_id"]
            isOneToOne: false
            referencedRelation: "igrejas_endereco_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "usuarios_tags_pessoa_id_fkey"
            columns: ["pessoa_id"]
            isOneToOne: false
            referencedRelation: "pessoas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "usuarios_tags_pessoa_id_fkey"
            columns: ["pessoa_id"]
            isOneToOne: false
            referencedRelation: "view_familias"
            referencedColumns: ["pessoa_id"]
          },
          {
            foreignKeyName: "usuarios_tags_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "tags_funcoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "usuarios_tags_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "usuarios_acesso"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      canticos_unificados: {
        Row: {
          audio_url: string | null
          autor_letra: string | null
          compositor: string | null
          created_at: string | null
          holyrics_artist: string | null
          holyrics_bpm: number | null
          holyrics_key: string | null
          holyrics_paragraphs: Json | null
          id: string | null
          igreja_id: string | null
          letra: string | null
          nome: string | null
          numero: string | null
          referencia: string | null
          spotify_url: string | null
          tags: string[] | null
          tipo: string | null
          youtube_url: string | null
        }
        Relationships: []
      }
      igrejas_endereco_view: {
        Row: {
          ativo: boolean | null
          bairro: string | null
          cep: string | null
          cidade: string | null
          complemento: string | null
          id: string | null
          logradouro: string | null
          nome: string | null
          nome_abreviado: string | null
          nome_completo: string | null
          pais: string | null
          regiao: string | null
          site: string | null
          slug: string | null
          telefone: string | null
          uf: string | null
        }
        Insert: {
          ativo?: boolean | null
          bairro?: string | null
          cep?: string | null
          cidade?: string | null
          complemento?: string | null
          id?: string | null
          logradouro?: string | null
          nome?: string | null
          nome_abreviado?: string | null
          nome_completo?: string | null
          pais?: string | null
          regiao?: never
          site?: string | null
          slug?: string | null
          telefone?: string | null
          uf?: string | null
        }
        Update: {
          ativo?: boolean | null
          bairro?: string | null
          cep?: string | null
          cidade?: string | null
          complemento?: string | null
          id?: string | null
          logradouro?: string | null
          nome?: string | null
          nome_abreviado?: string | null
          nome_completo?: string | null
          pais?: string | null
          regiao?: never
          site?: string | null
          slug?: string | null
          telefone?: string | null
          uf?: string | null
        }
        Relationships: []
      }
      view_familias: {
        Row: {
          nome_familia: string | null
          nucleo_id: string | null
          pessoa_id: string | null
        }
        Relationships: []
      }
      vw_cultos_com_escalas: {
        Row: {
          "Culto nr.": number | null
          Dia: string | null
          status_escala: string | null
          tipos_culto: string[] | null
          total_escalas: number | null
          total_louvores: number | null
        }
        Relationships: []
      }
      vw_cultos_incompletos: {
        Row: {
          "Culto nr.": number | null
          Dia: string | null
          num_escalas: number | null
          num_louvores: number | null
          status: string | null
        }
        Relationships: []
      }
      vw_estatisticas_canticos: {
        Row: {
          cantico: string | null
          cantico_id: string | null
          media_por_mes: number | null
          primeira_execucao: string | null
          total_cultos: number | null
          total_execucoes: number | null
          ultima_execucao: string | null
        }
        Relationships: []
      }
      vw_evolucao_mensal: {
        Row: {
          ano: number | null
          canticos_unicos: number | null
          mes: number | null
          mes_label: string | null
          total_cultos: number | null
          total_execucoes: number | null
        }
        Relationships: []
      }
      vw_execucoes_louvores: {
        Row: {
          ano: number | null
          cantico: string | null
          culto_nr: number | null
          data: string | null
          execucao_id: string | null
          mes: number | null
          ordem: number | null
          tom: Database["public"]["Enums"]["tom_musical"] | null
        }
        Relationships: []
      }
      vw_ranking_tons: {
        Row: {
          canticos_diferentes: number | null
          percentual: number | null
          tom: Database["public"]["Enums"]["tom_musical"] | null
          total_cultos: number | null
          total_execucoes: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      active_access_count_for_church: {
        Args: { p_igreja_id: string }
        Returns: number
      }
      admin_create_access_user: {
        Args: {
          p_cargo?: Database["public"]["Enums"]["cargo_tipo"]
          p_email: string
          p_igreja_id: string
          p_nome?: string
          p_pessoa_id?: string
          p_telefone?: string
        }
        Returns: string
      }
      admin_set_user_church_access: {
        Args: {
          p_ativo?: boolean
          p_cargo: Database["public"]["Enums"]["cargo_tipo"]
          p_igreja_id: string
          p_usuario_id: string
        }
        Returns: undefined
      }
      admin_set_user_tag_for_church: {
        Args: {
          p_habilitado: boolean
          p_igreja_id: string
          p_tag_id: string
          p_usuario_id: string
        }
        Returns: undefined
      }
      admin_upsert_access_user: {
        Args: {
          p_email?: string
          p_nome?: string
          p_pessoa_id?: string
          p_telefone?: string
          p_user_id?: string
        }
        Returns: string
      }
      can_add_active_access_for_church: {
        Args: { p_igreja_id: string }
        Returns: boolean
      }
      can_manage_any_church: { Args: never; Returns: boolean }
      can_manage_church: { Args: { p_igreja_id: string }; Returns: boolean }
      claim_access_user_by_email: { Args: never; Returns: undefined }
      create_notification_event: {
        Args: {
          p_chave_deduplicacao: string
          p_entidade_id: string
          p_entidade_tipo: string
          p_igreja_id: string
          p_payload?: Json
          p_tipo: string
        }
        Returns: string
      }
      current_access_user_id: { Args: never; Returns: string }
      current_global_role: {
        Args: never
        Returns: Database["public"]["Enums"]["cargo_tipo"]
      }
      current_person_id: { Args: never; Returns: string }
      email_permitido: { Args: { email_check: string }; Returns: boolean }
      enqueue_notification_delivery: {
        Args: {
          p_canal: Database["public"]["Enums"]["notification_channel"]
          p_destino?: string
          p_force?: boolean
          p_igreja_id: string
          p_notification_id: string
          p_payload?: Json
          p_tipo: string
          p_usuario_acesso_id: string
        }
        Returns: undefined
      }
      enqueue_notifications_for_scale_assignments: {
        Args: { p_escala_id: string }
        Returns: undefined
      }
      enqueue_push_notification:
        | {
            Args: {
              p_chave_deduplicacao?: string
              p_culto_id?: number
              p_escala_id?: string
              p_igreja_id: string
              p_mensagem: string
              p_payload?: Json
              p_pessoa_id?: string
              p_tipo: string
              p_titulo: string
            }
            Returns: undefined
          }
        | {
            Args: {
              p_canal?: string
              p_corpo?: string
              p_deep_link?: string
              p_delay_seconds?: number
              p_igreja_id: string
              p_payload?: Json
              p_tipo: string
              p_titulo: string
              p_usuario_acesso_id: string
            }
            Returns: string
          }
        | {
            Args: {
              p_canal?: string
              p_corpo: string
              p_deep_link?: string
              p_delay_seconds?: number
              p_igreja_id?: string
              p_payload?: Json
              p_tipo: string
              p_titulo: string
              p_usuario_acesso_id: string
            }
            Returns: string
          }
        | {
            Args: {
              p_canal: string
              p_corpo: string
              p_deep_link: string
              p_delay_seconds: number
              p_payload: Json
              p_tipo: string
              p_titulo: string
              p_usuario_acesso_id: string
            }
            Returns: string
          }
        | {
            Args: {
              p_canal: string
              p_corpo: string
              p_deep_link: string
              p_delay_seconds: number
              p_locale: string
              p_payload: Json
              p_tipo: string
              p_titulo: string
              p_usuario_acesso_id: string
            }
            Returns: string
          }
      get_tipo_inverso: {
        Args: { tipo: Database["public"]["Enums"]["tipo_relacionamento"] }
        Returns: Database["public"]["Enums"]["tipo_relacionamento"]
      }
      is_admin: { Args: never; Returns: boolean }
      is_global_admin: { Args: never; Returns: boolean }
      is_musico: { Args: never; Returns: boolean }
      marcar_convites_expirados: { Args: never; Returns: undefined }
      notification_channel_enabled: {
        Args: {
          p_canal: Database["public"]["Enums"]["notification_channel"]
          p_igreja_id: string
          p_tipo: string
          p_usuario_acesso_id: string
        }
        Returns: boolean
      }
      pode_gerenciar_escalas: {
        Args: { p_igreja_id: string }
        Returns: boolean
      }
      ranking_canticos: {
        Args: { p_ano: number; p_mes?: number }
        Returns: {
          cantico: string
          total: number
        }[]
      }
      resolve_notification_igreja_id: {
        Args: {
          p_igreja_id?: string
          p_payload?: Json
          p_usuario_acesso_id: string
        }
        Returns: string
      }
      self_service_upsert_access_user: { Args: never; Returns: string }
      sincronizar_acesso_pessoa_por_email: {
        Args: { p_pessoa_id: string }
        Returns: undefined
      }
      tem_acesso_louvor: { Args: never; Returns: boolean }
      usuario_tem_acesso_igreja: {
        Args: { p_igreja_id: string }
        Returns: boolean
      }
      usuario_tem_acesso_pessoa: {
        Args: { p_pessoa_id: string }
        Returns: boolean
      }
    }
    Enums: {
      cargo_tipo:
        | "superadmin"
        | "pastor"
        | "seminarista"
        | "presbitero"
        | "diacono"
        | "secretario"
        | "tesoureiro"
        | "membro"
        | "congregado"
        | "visitante"
        | "admin"
        | "staff"
        | "musico"
      notification_channel:
        | "in_app"
        | "push"
        | "email"
        | "whatsapp"
        | "web_push"
      notification_status:
        | "pending"
        | "processing"
        | "sent"
        | "failed"
        | "cancelled"
      sexo_tipo: "M" | "F"
      status_convite: "pendente" | "aceito" | "expirado" | "cancelado"
      tipo_liturgia:
        | "Prelúdio"
        | "Cântico"
        | "Oferta"
        | "Ceia"
        | "Salmo"
        | "Pregação"
        | "Pósludio"
        | "Saudação e Acolhida"
        | "Cânticos Congregacionais"
        | "Confissão de Pecados"
        | "Dízimos e Ofertas"
        | "Cântico para as Ofertas"
        | "Oração pelas Crianças"
        | "Pregação da Palavra"
        | "Cântico Final"
        | "Lembretes"
        | "Oração"
      tipo_relacionamento:
        | "conjuge"
        | "pai"
        | "mae"
        | "filho"
        | "filha"
        | "irmao"
        | "irma"
        | "avo_paterno"
        | "avo_paterna"
        | "avo_materno"
        | "avo_materna"
        | "neto"
        | "neta"
        | "cunhado"
        | "cunhada"
        | "sogro"
        | "sogra"
        | "genro"
        | "nora"
        | "tio"
        | "tia"
        | "sobrinho"
        | "sobrinha"
        | "primo"
        | "prima"
      tom_musical:
        | "C"
        | "C#"
        | "Db"
        | "D"
        | "D#"
        | "Eb"
        | "E"
        | "F"
        | "F#"
        | "Gb"
        | "G"
        | "G#"
        | "Ab"
        | "A"
        | "A#"
        | "Bb"
        | "B"
        | "Cm"
        | "C#m"
        | "Dm"
        | "D#m"
        | "Em"
        | "Fm"
        | "F#m"
        | "Gm"
        | "G#m"
        | "Am"
        | "A#m"
        | "Bm"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      cargo_tipo: [
        "superadmin",
        "pastor",
        "seminarista",
        "presbitero",
        "diacono",
        "secretario",
        "tesoureiro",
        "membro",
        "congregado",
        "visitante",
        "admin",
        "staff",
        "musico",
      ],
      notification_channel: ["in_app", "push", "email", "whatsapp", "web_push"],
      notification_status: [
        "pending",
        "processing",
        "sent",
        "failed",
        "cancelled",
      ],
      sexo_tipo: ["M", "F"],
      status_convite: ["pendente", "aceito", "expirado", "cancelado"],
      tipo_liturgia: [
        "Prelúdio",
        "Cântico",
        "Oferta",
        "Ceia",
        "Salmo",
        "Pregação",
        "Pósludio",
        "Saudação e Acolhida",
        "Cânticos Congregacionais",
        "Confissão de Pecados",
        "Dízimos e Ofertas",
        "Cântico para as Ofertas",
        "Oração pelas Crianças",
        "Pregação da Palavra",
        "Cântico Final",
        "Lembretes",
        "Oração",
      ],
      tipo_relacionamento: [
        "conjuge",
        "pai",
        "mae",
        "filho",
        "filha",
        "irmao",
        "irma",
        "avo_paterno",
        "avo_paterna",
        "avo_materno",
        "avo_materna",
        "neto",
        "neta",
        "cunhado",
        "cunhada",
        "sogro",
        "sogra",
        "genro",
        "nora",
        "tio",
        "tia",
        "sobrinho",
        "sobrinha",
        "primo",
        "prima",
      ],
      tom_musical: [
        "C",
        "C#",
        "Db",
        "D",
        "D#",
        "Eb",
        "E",
        "F",
        "F#",
        "Gb",
        "G",
        "G#",
        "Ab",
        "A",
        "A#",
        "Bb",
        "B",
        "Cm",
        "C#m",
        "Dm",
        "D#m",
        "Em",
        "Fm",
        "F#m",
        "Gm",
        "G#m",
        "Am",
        "A#m",
        "Bm",
      ],
    },
  },
} as const
