import NotifBell from './NotifBell'

export default function Topbar() {
  return (
    <header className="h-14 flex-shrink-0 flex items-center justify-end px-6 border-b border-gray-100 bg-white">
      <NotifBell />
    </header>
  )
}
