import {
	Building2,
	ChevronRight,
	CircleHelp,
	GraduationCap,
	ShieldCheck,
} from 'lucide-react'
import { BrandMark } from './AppShell.jsx'
import { displayName, roleName } from './userPresentation.js'

export function LoginScreen({ users, busy, error, onSignIn }) {
	const superAdmin = users.find((user) => user.application_role === 'SUPER_ADMIN')
	const branchAdmin = users.find((user) => user.application_role === 'BRANCH_ADMIN' && user.is_active)
	const instructor = users.find((user) => user.application_role === 'INSTRUCTOR' && user.is_active)
	const student = users.find((user) => user.application_role === 'STUDENT' && user.is_active)
	return (
		<main className="grid min-h-screen bg-white lg:grid-cols-[minmax(0,1fr)_430px]">
			<section className="relative flex min-h-[42vh] flex-col justify-between overflow-hidden bg-hub-ink px-6 py-7 text-white sm:px-10 lg:min-h-screen lg:px-16 lg:py-12">
				<div className="flex items-center gap-3"><BrandMark /><span className="font-bold">MembershipHub</span></div>
				<div className="relative z-10 max-w-xl py-10 lg:py-0">
					<p className="text-xs font-bold uppercase text-hub-yellow">Branch administration</p>
					<h1 className="mt-4 max-w-lg text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">Every cohort, in the right place.</h1>
					<p className="mt-4 max-w-md text-sm leading-6 text-white/75">Manage people, branches, and class rosters from one clear workspace.</p>
				</div>
				<div className="flex items-center gap-2 text-xs text-white/60"><ShieldCheck size={15} aria-hidden="true" />Role-scoped demo workspace</div>
			</section>
			<section className="flex items-center justify-center px-5 py-10 sm:px-8 lg:px-10">
				<div className="w-full max-w-sm">
					<span className="inline-flex min-h-7 items-center border border-[#e5d7e3] bg-[#fbf6fa] px-2 text-[10px] font-bold uppercase text-hub-purple">Local mock mode</span>
					<h2 className="mt-5 text-2xl font-semibold tracking-tight">Choose a demo account</h2>
					<p className="mt-2 text-sm leading-6 text-hub-muted">Sign in locally to explore the role-specific workspace. No backend connection is made.</p>
					{error && <p role="alert" className="mt-5 border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-900">{error}</p>}
					<div className="mt-7 divide-y divide-hub-line border-y border-hub-line">
						{[superAdmin, branchAdmin, instructor, student].filter(Boolean).map((user) => {
							const isSuperAdmin = user.application_role === 'SUPER_ADMIN'
							return (
								<button type="button" key={user.id} disabled={busy} onClick={() => onSignIn(user.id)} className="group flex min-h-[76px] w-full items-center gap-3 text-left hover:bg-[#fbf8fc] disabled:opacity-50">
									<span className={`grid size-10 shrink-0 place-items-center ${isSuperAdmin ? 'bg-hub-ink text-white' : 'bg-[#f0e9f0] text-hub-purple'}`}>{isSuperAdmin ? <ShieldCheck size={18} aria-hidden="true" /> : user.application_role === 'INSTRUCTOR' ? <GraduationCap size={18} aria-hidden="true" /> : <Building2 size={18} aria-hidden="true" />}</span>
									<span className="min-w-0 flex-1"><span className="block text-sm font-semibold">{roleName(user.application_role)}</span><span className="mt-1 block truncate text-xs text-hub-muted">{displayName(user)} · {isSuperAdmin ? 'Organization-wide' : 'Central Fellowship'}</span></span>
									<ChevronRight className="text-hub-muted transition-transform group-hover:translate-x-1 group-hover:text-hub-purple" size={18} aria-hidden="true" />
								</button>
							)
						})}
					</div>
					<p className="mt-5 text-xs leading-5 text-hub-muted">This preview uses synthetic demo records and browser storage. Nothing is written to the Django API.</p>
					<div className="mt-10 flex items-center gap-2 text-xs text-hub-muted"><CircleHelp size={15} aria-hidden="true" />Demo data can be reset from the workspace header.</div>
				</div>
			</section>
		</main>
	)
}

export function LoadingScreen({ error }) {
	return (
		<main className="min-h-screen bg-[#f5f3f6] p-5 sm:p-8">
			<div className="mx-auto max-w-4xl border-y border-hub-line bg-white p-5 sm:p-8">
				<div className="flex items-center gap-3"><BrandMark /><div className="h-4 w-44 animate-pulse bg-[#e8e4e9]" /></div>
				{error ? <p role="alert" className="mt-6 text-sm text-red-800">{error}</p> : <div className="mt-8 space-y-3" aria-label="Loading demo"><div className="h-8 w-1/3 animate-pulse bg-[#e8e4e9]" /><div className="h-14 animate-pulse bg-[#f2eff3]" /><div className="h-14 animate-pulse bg-[#f2eff3]" /></div>}
			</div>
		</main>
	)
}

export function MissingCohort({ onBack }) {
	return <div className="border-y border-hub-line bg-white p-6"><h1 className="text-xl font-semibold">Cohort not found</h1><p className="mt-2 text-sm text-hub-muted">It may have been reset or removed from the local demo.</p><button type="button" onClick={onBack} className="mt-4 text-sm font-semibold text-hub-purple underline underline-offset-4">Back to cohorts</button></div>
}