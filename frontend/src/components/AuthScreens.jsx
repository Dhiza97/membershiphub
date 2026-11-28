import { ShieldCheck } from 'lucide-react'
import { BrandMark } from './AppShell.jsx'

export function LoginScreen({ busy, error, onSignIn }) {
	function submit(event) {
		event.preventDefault()
		const form = new FormData(event.currentTarget)
		onSignIn({ username: form.get('username'), password: form.get('password') })
	}
	return (
		<main className="grid min-h-screen bg-white lg:grid-cols-[minmax(0,1fr)_430px]">
			<section className="relative flex min-h-[42vh] flex-col justify-between overflow-hidden bg-hub-ink px-6 py-7 text-white sm:px-10 lg:min-h-screen lg:px-16 lg:py-12">
				<div className="flex items-center gap-3"><BrandMark /><span className="font-bold">MembershipHub</span></div>
				<div className="relative z-10 max-w-xl py-10 lg:py-0">
					<p className="text-xs font-bold uppercase text-hub-yellow">Branch administration</p>
					<h1 className="mt-4 max-w-lg text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">Every cohort, in the right place.</h1>
					<p className="mt-4 max-w-md text-sm leading-6 text-white/75">Manage people, branches, and class rosters from one clear workspace.</p>
				</div>
				<div className="flex items-center gap-2 text-xs text-white/60"><ShieldCheck size={15} aria-hidden="true" />Your membership workspace</div>
			</section>
			<section className="flex items-center justify-center px-5 py-10 sm:px-8 lg:px-10">
				<form className="w-full max-w-sm space-y-5" onSubmit={submit}>
					<div><h2 className="text-2xl font-semibold">Sign in</h2><p className="mt-2 text-sm text-hub-muted">Use your MembershipHub account.</p></div>
					{error && <p role="alert" className="mt-5 border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-900">{error}</p>}
					<label className="block text-sm font-medium">Email or username<input name="username" autoComplete="username" required className="mt-1.5 min-h-11 w-full border border-hub-line px-3" /></label>
					<label className="block text-sm font-medium">Password<input name="password" type="password" autoComplete="current-password" required className="mt-1.5 min-h-11 w-full border border-hub-line px-3" /></label>
					<button disabled={busy} className="min-h-11 w-full bg-hub-purple px-4 text-sm font-semibold text-white hover:bg-hub-purple-dark disabled:opacity-50">{busy ? 'Signing in...' : 'Sign in'}</button>
				</form>
			</section>
		</main>
	)
}

export function LoadingScreen({ error }) {
	return (
		<main className="min-h-screen bg-[#f5f3f6] p-5 sm:p-8">
			<div className="mx-auto max-w-4xl border-y border-hub-line bg-white p-5 sm:p-8">
				<div className="flex items-center gap-3"><BrandMark /><div className="h-4 w-44 animate-pulse bg-[#e8e4e9]" /></div>
				{error ? <p role="alert" className="mt-6 text-sm text-red-800">{error}</p> : <div className="mt-8 space-y-3" aria-label="Loading"><div className="h-8 w-1/3 animate-pulse bg-[#e8e4e9]" /><div className="h-14 animate-pulse bg-[#f2eff3]" /><div className="h-14 animate-pulse bg-[#f2eff3]" /></div>}
			</div>
		</main>
	)
}

export function MissingCohort({ onBack }) {
	return <div className="border-y border-hub-line bg-white p-6"><h1 className="text-xl font-semibold">Cohort not found</h1><p className="mt-2 text-sm text-hub-muted">It may have been removed or is no longer accessible.</p><button type="button" onClick={onBack} className="mt-4 text-sm font-semibold text-hub-purple underline underline-offset-4">Back to cohorts</button></div>
}