"use client"

import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { HorariosTab } from "@/components/dashboard/horarios-tab"
import { AvisosTab } from "@/components/dashboard/avisos-tab"
import { NegocioTab } from "@/components/dashboard/negocio-tab"

export default function AjustesPage() {
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">Ajustes</h1>
        <p className="text-sm text-muted-foreground">Horarios, avisos y datos generales de Lex Barbería.</p>
      </div>

      <Tabs defaultValue="horarios">
        <TabsList className="w-full">
          <TabsTrigger value="horarios" className="flex-1">Horarios</TabsTrigger>
          <TabsTrigger value="avisos" className="flex-1">Avisos</TabsTrigger>
          <TabsTrigger value="negocio" className="flex-1">Negocio</TabsTrigger>
        </TabsList>
        <TabsContent value="horarios" className="pt-4">
          <HorariosTab />
        </TabsContent>
        <TabsContent value="avisos" className="pt-4">
          <AvisosTab />
        </TabsContent>
        <TabsContent value="negocio" className="pt-4">
          <NegocioTab />
        </TabsContent>
      </Tabs>
    </div>
  )
}
