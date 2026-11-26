import {
	ChevronRight,
	Layers3,
	LogOut,
	RotateCcw,
} from 'lucide-react'
import { displayName, roleName } from './userPresentation.js'

export function BrandMark() {
	return <span className="grid size-8 shrink-0 place-items-center bg-hub-purple text-white"><Layers3 size={18} strokeWidth={2.2} aria-hidden="true" /></span>
}

function Avatar({ user, small = false }) {
	const initials = `${user.first_name?.[0] ?? ''}${user.last_name?.[0] ?? ''}` || user.username.slice(0, 2)
	return <span className={`grid shrink-0 place-items-center bg-hub-ink font-bold text-white ${small ? 'size-7 text-[10px]' : 'size-9 text-xs'}`}>{initials}</span>
}

function NavButton({ item, active, onClick, compact = false }) {
	const Icon = item.icon
	return (
		<button type="button" onClick={onClick} aria-current={active ? 'page' : undefined} className={`flex min-h-10 shrink-0 items-center gap-3 px-3 text-left text-sm font-medium transition-colors ${compact ? 'min-h-9 px-3 text-xs' : 'w-full'} ${active ? 'bg-hub-purple text-white' : 'text-hub-muted hover:bg-[#f5f3f6] hover:text-hub-ink'}`}>
			<Icon size={17} aria-hidden="true" />{item.label}
		</button>
	)
}

export function AppShell({
	children,
	navItems,
	view,
	currentUser,
	currentBranch,
	isSuperAdmin,
	pageTitle,
	busy,
	notice,
	onNavigate,
	onSignOut,
	onResetDemo,
}) {
	const workspace = isSuperAdmin ? 'Organization' : currentBranch?.name ?? 'Branch unassigned'
	const isActive = (item) => view === item.id || (view.startsWith('cohort-') && item.id === 'cohorts')

	return (
		<div className="min-h-screen bg-[#f5f3f6] text-hub-ink">
			<div className="lg:grid lg:min-h-screen lg:grid-cols-[236px_minmax(0,1fr)]">
				<aside className="hidden border-r border-[#ded9e0] bg-white lg:flex lg:flex-col">
					<div className="flex h-[76px] items-center gap-3 border-b border-hub-line px-5">
						<BrandMark />
						<span className="text-[15px] font-bold tracking-tight">MembershipHub</span>
					</div>
					<div className="px-4 pt-5">
						<span className="block px-2 text-[10px] font-bold uppercase text-hub-muted">Workspace</span>
						<span className="mt-1 block truncate px-2 text-sm font-semibold">{workspace}</span>
					</div>
					<nav aria-label="Main navigation" className="mt-6 space-y-1 px-3">
						{navItems.map((item) => <NavButton key={item.id} item={item} active={isActive(item)} onClick={() => onNavigate(item.id)} />)}
					</nav>
					<div className="mt-auto border-t border-hub-line p-4">
						<div className="flex items-center gap-3">
							<Avatar user={currentUser} />
							<div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{displayName(currentUser)}</p><p className="truncate text-xs text-hub-muted">{roleName(currentUser.application_role)}</p></div>
						</div>
						<button type="button" onClick={onSignOut} className="mt-4 flex min-h-9 w-full items-center gap-2 px-2 text-xs font-semibold text-hub-muted hover:bg-[#f5f3f6] hover:text-hub-ink"><LogOut size={15} aria-hidden="true" />Sign out of demo</button>
					</div>
				</aside>

				<div className="min-w-0">
					<header className="sticky top-0 z-20 border-b border-hub-line bg-white">
						<div className="flex min-h-[68px] items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
							<div className="flex min-w-0 items-center gap-2 lg:hidden"><BrandMark /><span className="truncate text-xs font-bold">MembershipHub</span></div>
							<div className="hidden min-w-0 items-center gap-2 text-xs text-hub-muted lg:flex"><span>{workspace}</span><ChevronRight size={14} aria-hidden="true" /><span className="font-semibold text-hub-ink">{pageTitle}</span></div>
							<div className="ml-auto flex items-center gap-2 sm:gap-4">
								<span className="inline-flex min-h-7 items-center gap-2 border border-[#e5d7e3] bg-[#fbf6fa] px-2 text-[10px] font-bold uppercase text-hub-purple"><span className="size-1.5 rounded-full bg-hub-purple" />Demo</span>
								<button type="button" onClick={onResetDemo} disabled={busy} title="Reset local demo data" aria-label="Reset local demo data" className="grid size-9 place-items-center text-hub-muted hover:bg-[#f5f3f6] hover:text-hub-ink disabled:opacity-50"><RotateCcw size={16} aria-hidden="true" /></button>
								<button type="button" onClick={onSignOut} className="flex min-h-9 items-center gap-2 border-l border-hub-line pl-3 text-xs font-semibold text-hub-muted hover:text-hub-ink lg:hidden"><Avatar user={currentUser} small /><span className="sr-only">Sign out</span></button>
							</div>
						</div>
						<nav aria-label="Mobile navigation" className="flex gap-1 overflow-x-auto border-t border-hub-line px-3 py-1.5 lg:hidden">
							{navItems.map((item) => <NavButton key={item.id} item={item} active={isActive(item)} onClick={() => onNavigate(item.id)} compact />)}
						</nav>
					</header>

					<main className="mx-auto min-h-[calc(100vh-118px)] w-full max-w-[1500px] px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
						{children}
					</main>
					<footer className="border-t border-hub-line bg-white px-4 py-3 text-center text-[11px] text-hub-muted sm:px-6 lg:px-8">
						Local demo data is stored in this browser only. Changes are not sent to Django.
					</footer>
				</div>
			</div>
			{notice && <div role="status" aria-live="polite" className="fixed bottom-4 right-4 z-50 max-w-[calc(100vw-2rem)] border border-hub-ink bg-hub-ink px-4 py-3 text-sm font-medium text-white shadow-lg">{notice}</div>}
		</div>
	)
}