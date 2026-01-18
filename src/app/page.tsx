"use client"

import { useEffect, useState } from "react"
import { supabase } from "../lib/supabase"
import { Music, Calendar, Sparkles, ChevronRight } from "lucide-react"

interface Culto {
  "Culto nr.": number
  "Dia": string
  "Prelúdio"?: string
  "Cântico 2"?: string
  "Cântico 3"?: string
  "Cântico 4"?: string
  "Cântico 5"?: string
  "Cântico 6"?: string
  "Cântico 7"?: string
  "Cântico 8"?: string
  "Cântico 9"?: string
  "Cântico 10"?: string
}

export default function Home() {
  const [cultos, setCultos] = useState<Culto[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    carregarCultos()
  }, [])

  async function carregarCultos() {
    setLoading(true)
    const { data, error } = await supabase.from("Louvores IPPN").select("*")

    if (error) {
      console.error(error)
      setLoading(false)
      return
    }

    const ordenados = (data || []).sort((a, b) => b["Culto nr."] - a["Culto nr."])
    setCultos(ordenados)
    setLoading(false)
  }

  function getCanticos(culto: Culto) {
    const lista = [
      { label: "Prelúdio", value: culto["Prelúdio"] },
      { label: "Cântico 2", value: culto["Cântico 2"] },
      { label: "Cântico 3", value: culto["Cântico 3"] },
      { label: "Cântico 4", value: culto["Cântico 4"] },
      { label: "Cântico 5", value: culto["Cântico 5"] },
      { label: "Cântico 6", value: culto["Cântico 6"] },
      { label: "Cântico 7", value: culto["Cântico 7"] },
      { label: "Cântico 8", value: culto["Cântico 8"] },
      { label: "Cântico 9", value: culto["Cântico 9"] },
      { label: "Cântico 10", value: culto["Cântico 10"] },
    ]
    return lista.filter(i => i.value && i.value.trim() !== "")
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-emerald-50/30 to-amber-50/30 flex items-center justify-center p-4">
        <div className="text-center">
          <div className="relative w-20 h-20 mx-auto mb-6">
            <div className="absolute inset-0 border-4 border-emerald-200 rounded-full animate-ping opacity-20"></div>
            <div className="absolute inset-0 border-4 border-t-emerald-700 border-r-transparent border-b-transparent border-l-transparent rounded-full animate-spin"></div>
            <Music className="absolute inset-0 m-auto w-8 h-8 text-emerald-700" />
          </div>
          <p className="text-lg font-medium text-slate-700">Carregando...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-emerald-50/30 to-amber-50/30">
      {/* HEADER FIXO E MINIMALISTA */}
      <header className="sticky top-0 z-50 bg-white/90 backdrop-blur-xl border-b border-slate-200/50 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="absolute inset-0 bg-emerald-700 rounded-xl blur-lg opacity-30"></div>
                <div className="relative bg-gradient-to-br from-emerald-700 to-emerald-900 p-2.5 rounded-xl">
                  <Music className="w-5 h-5 text-white" />
                </div>
              </div>
              <div>
                <h1 className="text-xl font-bold text-slate-900">Louvores IPPN</h1>
                <p className="text-xs text-slate-500 font-medium">Igreja Presbiteriana</p>
              </div>
            </div>
            <div className="hidden sm:flex items-center gap-2 px-4 py-2 bg-slate-100 rounded-full">
              <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
              <span className="text-xs font-medium text-slate-600">{cultos.length} cultos</span>
            </div>
          </div>
        </div>
      </header>

      {/* CONTEÚDO PRINCIPAL */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        <div className="grid gap-6 sm:gap-8">
          {cultos.map((culto, index) => {
            const canticos = getCanticos(culto)

            return (
              <article
                key={culto["Culto nr."]}
                className="group relative bg-white rounded-2xl shadow-sm hover:shadow-xl transition-all duration-500 overflow-hidden border border-slate-200/50"
                style={{
                  animation: `slideIn 0.5s ease-out ${index * 0.08}s both`
                }}
              >
                {/* HEADER DO CARD - MAIS COMPACTO */}
                <div className="relative bg-gradient-to-r from-emerald-700 via-emerald-600 to-amber-600 px-6 py-5 sm:px-8 sm:py-6">
                  {/* Decoração sutil */}
                  <div className="absolute top-0 right-0 w-48 h-48 bg-white/5 rounded-full -mr-24 -mt-24"></div>
                  
                  <div className="relative flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    {/* Número do Culto */}
                    <div className="flex items-center gap-4">
                      <div className="bg-white/20 backdrop-blur-sm px-3 py-1.5 rounded-lg">
                        <span className="text-xs font-bold text-white/90 uppercase tracking-wider">Culto</span>
                      </div>
                      <h2 className="text-4xl sm:text-5xl font-black text-white tracking-tight">
                        #{culto["Culto nr."]}
                      </h2>
                    </div>

                    {/* Data */}
                    <div className="flex items-center gap-2.5 bg-white/95 px-4 py-2.5 rounded-xl shadow-lg">
                      <Calendar className="w-4 h-4 text-emerald-700" />
                      <span className="text-sm font-bold text-slate-900">{culto["Dia"]}</span>
                    </div>
                  </div>
                </div>

                {/* CORPO DO CARD - LAYOUT MAIS LIMPO */}
                <div className="p-6 sm:p-8">
                  {/* Título da seção */}
                  <div className="flex items-center gap-2.5 mb-5">
                    <Sparkles className="w-4 h-4 text-emerald-700" />
                    <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide">
                      Programação Musical
                    </h3>
                    <div className="flex-1 h-px bg-gradient-to-r from-slate-200 to-transparent"></div>
                    <span className="text-xs font-semibold text-slate-400">{canticos.length} músicas</span>
                  </div>

                  {/* Lista de Cânticos - Grid Responsivo */}
                  <div className="grid gap-3">
                    {canticos.map((c, i) => (
                      <div
                        key={i}
                        className="group/item relative flex items-center gap-3 p-4 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200/50 hover:border-emerald-200 transition-all duration-300"
                      >
                        {/* Número circular */}
                        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-emerald-700 to-emerald-900 flex items-center justify-center shadow-sm">
                          <span className="text-xs font-bold text-white">{i + 1}</span>
                        </div>

                        {/* Conteúdo */}
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-emerald-700 uppercase tracking-wide mb-0.5">
                            {c.label}
                          </p>
                          <p className="text-sm font-bold text-slate-900 truncate">
                            {c.value}
                          </p>
                        </div>

                        {/* Ícone de ação */}
                        <ChevronRight className="w-4 h-4 text-slate-400 group-hover/item:text-emerald-700 group-hover/item:translate-x-1 transition-all flex-shrink-0" />
                      </div>
                    ))}
                  </div>
                </div>
              </article>
            )
          })}
        </div>
      </main>

      {/* FOOTER MINIMALISTA */}
      <footer className="mt-16 py-8 border-t border-slate-200/50 bg-white/50 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Music className="w-4 h-4 text-emerald-700" />
            <span className="font-bold text-slate-900">Igreja Presbiteriana Ponta Negra</span>
          </div>
          <p className="text-sm text-slate-500">Manaus • Amazonas • Brasil</p>
        </div>
      </footer>

      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
        
        * {
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
        }

        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translateY(20px) scale(0.98);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        /* Scrollbar customizada */
        ::-webkit-scrollbar {
          width: 8px;
        }
        
        ::-webkit-scrollbar-track {
          background: #f1f5f9;
        }
        
        ::-webkit-scrollbar-thumb {
          background: #047857;
          border-radius: 4px;
        }
        
        ::-webkit-scrollbar-thumb:hover {
          background: #065f46;
        }
      `}</style>
    </div>
  )
}