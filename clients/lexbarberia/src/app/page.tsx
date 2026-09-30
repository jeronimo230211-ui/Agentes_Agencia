import Image from "next/image"

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
      <Image src="/logo.png" alt="Lex Barbería" width={480} height={252} priority className="w-full max-w-md h-auto" />
      <p className="text-sm text-muted-foreground">Agenda por WhatsApp con IA — en construcción.</p>
    </main>
  )
}
