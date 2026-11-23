import { useEffect, useState } from 'react'
import {
	Building2,
	BookOpen,
	ChevronRight,
	CircleHelp,
	GraduationCap,
	Layers3,
	LogOut,
	RotateCcw,
	ShieldCheck,
	UsersRound,
} from 'lucide-react'
import { BranchInfo, BranchManager, UserManager } from './AdminScreens.jsx'
import { CohortBoard, CohortDetail, CohortWizard } from './CohortScreens.jsx'
import { CurriculumManager } from './CurriculumScreens.jsx'
import { SessionManager } from './SessionScreens.jsx'
import { mockApi } from './api/mockApi.js'

const NAV_ITEMS = {
	SUPER_ADMIN: [
		{ id: 'cohorts', label: 'Cohorts', icon: GraduationCap },
		{ id: 'curricula', label: 'Curricula', icon: BookOpen },
		{ id: 'users', label: 'People', icon: UsersRound },
		{ id: 'branches', label: 'Branches', icon: Building2 },
	],
	BRANCH_ADMIN: [
		{ id: 'cohorts', label: 'Cohorts', icon: GraduationCap },
		{ id: 'curricula', label: 'Curricula', icon: BookOpen },
		{ id: 'users', label: 'People', icon: UsersRound },
		{ id: 'branch-info', label: 'My branch', icon: Building2 },
	],
	INSTRUCTOR: [
		{ id: 'cohorts', label: 'My cohorts', icon: GraduationCap },
	],
}

const PAGE_TITLES = {
	cohorts: 'Cohort management',
	curricula: 'Curriculum management',
	'cohort-detail': 'Cohort detail',
	'cohort-wizard': 'Cohort setup',
	sessions: 'Sessions and attendance',
	users: 'People management',
	branches: 'Branch management',
	'branch-info': 'Branch information',
}

function displayName(user) {
	return [user.first_name, user.last_name].filter(Boolean).join(' ') || user.username
}

function roleName(role) {
	if (role === 'SUPER_ADMIN') return 'Super Admin'
	if (role === 'INSTRUCTOR') return 'Instructor'
	return 'Branch Admin'
}

export default function App() {
	const [snapshot, setSnapshot] = useState(null)
	const [view, setView] = useState('cohorts')
	const [selectedCohortId, setSelectedCohortId] = useState(null)
	const [busy, setBusy] = useState(false)
	const [notice, setNotice] = useState('')
	const [loadError, setLoadError] = useState('')

	useEffect(() => {
		let active = true
		mockApi.snapshot()
			.then((data) => {
				if (active) setSnapshot(data)
			})
			.catch(() => {
				if (active) setLoadError('The local demo could not load. Refresh the page to try again.')
			})
		return () => { active = false }
	}, [])

	useEffect(() => {
		if (!notice) return undefined
		const timeout = window.setTimeout(() => setNotice(''), 3500)
		return () => window.clearTimeout(timeout)
	}, [notice])

	async function mutate(action, successMessage) {
		setBusy(true)
		try {
			const next = await action()
			setSnapshot(next)
			setNotice(successMessage)
			return next
		} finally {
			setBusy(false)
		}
	}

	async function signIn(userId) {
		setBusy(true)
		setLoadError('')
		try {
			setSnapshot(await mockApi.signIn(userId))
			setView('cohorts')
		} catch (error) {
			setLoadError(error.message)
		} finally {
			setBusy(false)
		}
	}

	async function signOut() {
		setSnapshot(await mockApi.signOut())
		setView('cohorts')
		setSelectedCohortId(null)
	}

	async function resetDemo() {
		setBusy(true)
		try {
			setSnapshot(await mockApi.resetDemo())
			setView('cohorts')
			setSelectedCohortId(null)
			setNotice('Demo data reset to its starting state.')
		} finally {
			setBusy(false)
		}
	}

	if (!snapshot) {
		return <LoadingScreen error={loadError} />
	}

	const currentUser = snapshot.currentUser
	if (!currentUser) {
		return <LoginScreen users={snapshot.users} busy={busy} error={loadError} onSignIn={signIn} />
	}

	const isSuperAdmin = currentUser.application_role === 'SUPER_ADMIN'
	const currentBranch = snapshot.branches.find((branch) => branch.id === currentUser.branch)
	const visibleBranches = isSuperAdmin ? snapshot.branches : snapshot.branches.filter((branch) => branch.id === currentUser.branch)
	const visibleCohorts = isSuperAdmin
		? snapshot.cohorts
		: currentUser.application_role === 'INSTRUCTOR'
			? snapshot.cohorts.filter((cohort) => cohort.instructor === currentUser.id)
			: snapshot.cohorts.filter((cohort) => cohort.branch === currentUser.branch)
	const visibleCurricula = isSuperAdmin ? snapshot.curricula : snapshot.curricula.filter((curriculum) => curriculum.branch === currentUser.branch)
	const visibleCurriculumIds = new Set(visibleCurricula.map((curriculum) => curriculum.id))
	const visibleCurriculumVersions = snapshot.curriculumVersions.filter((version) => visibleCurriculumIds.has(version.curriculum))
	const selectedCohort = snapshot.cohorts.find((cohort) => cohort.id === selectedCohortId)

	async function saveCohort(input) {
		const data = await mutate(() => mockApi.saveCohort(input, currentUser), input.status === 'READY' ? 'Cohort marked Ready in this demo.' : 'Draft saved in this demo.')
		const saved = input.id
			? data.cohorts.find((cohort) => cohort.id === input.id)
			: data.cohorts.reduce((latest, cohort) => cohort.id > latest.id ? cohort : latest, data.cohorts[0])
		setSelectedCohortId(saved.id)
		setView('cohort-detail')
	}

	async function updateCohort(input) {
		await mutate(() => mockApi.saveCohort(input, currentUser), 'Cohort updated in this demo.')
	}

	async function saveUser(input) {
		await mutate(() => mockApi.saveUser(input, currentUser), input.id ? 'Account updated in this demo.' : 'Account registered in this demo.')
	}

	async function saveBranch(input) {
		await mutate(() => mockApi.saveBranch(input), input.id ? 'Branch updated in this demo.' : 'Branch created in this demo.')
	}

	async function saveCurriculum(input) {
		const data = await mutate(
			() => mockApi.saveCurriculum(input, currentUser),
			input.id ? 'Curriculum details saved in this demo.' : 'Curriculum and initial draft created in this demo.',
		)
		return data.curricula.find((curriculum) => (
			curriculum.branch === (currentUser.application_role === 'BRANCH_ADMIN' ? currentUser.branch : Number(input.branch))
			&& curriculum.name.toLowerCase() === input.name.trim().toLowerCase()
		))
	}

	async function createCurriculum(input) {
		const data = await mutate(
			() => mockApi.saveCurriculum(input, currentUser),
			'Curriculum and initial draft created in this demo.',
		)
		const branchId = currentUser.application_role === 'BRANCH_ADMIN' ? currentUser.branch : Number(input.branch)
		return data.curricula.find((curriculum) => (
			curriculum.branch === branchId
			&& curriculum.name.toLowerCase() === input.name.trim().toLowerCase()
		))
	}

	async function createCurriculumVersion(curriculumId, changeNote) {
		await mutate(() => mockApi.createCurriculumVersion(curriculumId, changeNote, currentUser), 'New editable version created in this demo.')
	}

	async function saveCurriculumVersion(curriculumId, versionId, input) {
		await mutate(() => mockApi.saveCurriculumVersion(curriculumId, versionId, input, currentUser), 'Curriculum draft saved in this demo.')
	}

	async function publishCurriculumVersion(curriculumId, versionId) {
		await mutate(() => mockApi.publishCurriculumVersion(curriculumId, versionId, currentUser), 'Curriculum version published in this demo.')
	}

	async function saveSession(input) {
		const data = await mutate(
			() => mockApi.saveSession(input, currentUser),
			input.id ? 'Session updated in this demo.' : 'Session scheduled in this demo.',
		)
		return data.sessions.find((session) => session.id === input.id)
			?? data.sessions.reduce((latest, session) => session.id > latest.id ? session : latest, data.sessions[0])
	}

	async function recordAttendance(sessionId, studentId, input) {
		await mutate(
			() => mockApi.setAttendance(sessionId, studentId, input, currentUser),
			'Attendance saved in this demo.',
		)
	}

	function navigate(nextView) {
		setView(nextView)
		setSelectedCohortId(null)
	}

	const visibleNav = NAV_ITEMS[currentUser.application_role] ?? NAV_ITEMS.BRANCH_ADMIN
	const pageTitle = PAGE_TITLES[view] ?? 'MembershipHub'

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
						<span className="mt-1 block truncate px-2 text-sm font-semibold">{isSuperAdmin ? 'Organization' : currentBranch?.name ?? 'Branch unassigned'}</span>
					</div>
					<nav aria-label="Main navigation" className="mt-6 space-y-1 px-3">
						{visibleNav.map((item) => <NavButton key={item.id} item={item} active={view === item.id || (view.startsWith('cohort-') && item.id === 'cohorts')} onClick={() => navigate(item.id)} />)}
					</nav>
					<div className="mt-auto border-t border-hub-line p-4">
						<div className="flex items-center gap-3">
							<Avatar user={currentUser} />
							<div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{displayName(currentUser)}</p><p className="truncate text-xs text-hub-muted">{roleName(currentUser.application_role)}</p></div>
						</div>
						<button type="button" onClick={signOut} className="mt-4 flex min-h-9 w-full items-center gap-2 px-2 text-xs font-semibold text-hub-muted hover:bg-[#f5f3f6] hover:text-hub-ink"><LogOut size={15} aria-hidden="true" />Sign out of demo</button>
					</div>
				</aside>

				<div className="min-w-0">
					<header className="sticky top-0 z-20 border-b border-hub-line bg-white">
						<div className="flex min-h-[68px] items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
							  <div className="flex min-w-0 items-center gap-2 lg:hidden"><BrandMark /><span className="truncate text-xs font-bold">MembershipHub</span></div>
							<div className="hidden min-w-0 items-center gap-2 text-xs text-hub-muted lg:flex"><span>{isSuperAdmin ? 'Organization' : currentBranch?.name ?? 'Branch unassigned'}</span><ChevronRight size={14} aria-hidden="true" /><span className="font-semibold text-hub-ink">{pageTitle}</span></div>
							<div className="ml-auto flex items-center gap-2 sm:gap-4">
								<span className="inline-flex min-h-7 items-center gap-2 border border-[#e5d7e3] bg-[#fbf6fa] px-2 text-[10px] font-bold uppercase text-hub-purple"><span className="size-1.5 rounded-full bg-hub-purple" />Demo</span>
								<button type="button" onClick={resetDemo} disabled={busy} title="Reset local demo data" aria-label="Reset local demo data" className="grid size-9 place-items-center text-hub-muted hover:bg-[#f5f3f6] hover:text-hub-ink disabled:opacity-50"><RotateCcw size={16} aria-hidden="true" /></button>
								<button type="button" onClick={signOut} className="flex min-h-9 items-center gap-2 border-l border-hub-line pl-3 text-xs font-semibold text-hub-muted hover:text-hub-ink lg:hidden"><Avatar user={currentUser} small /><span className="sr-only">Sign out</span></button>
							</div>
						</div>
						<nav aria-label="Mobile navigation" className="flex gap-1 overflow-x-auto border-t border-hub-line px-3 py-1.5 lg:hidden">
							{visibleNav.map((item) => <NavButton key={item.id} item={item} active={view === item.id || (view.startsWith('cohort-') && item.id === 'cohorts')} onClick={() => navigate(item.id)} compact />)}
						</nav>
					</header>

					<main className="mx-auto min-h-[calc(100vh-118px)] w-full max-w-[1500px] px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
						{view === 'cohorts' && <CohortBoard cohorts={visibleCohorts} branches={visibleBranches} users={snapshot.users} isSuperAdmin={isSuperAdmin} canCreate={isSuperAdmin || currentUser.application_role === 'BRANCH_ADMIN'} onCreate={() => { setSelectedCohortId(null); setView('cohort-wizard') }} onOpen={(id) => { setSelectedCohortId(id); setView('cohort-detail') }} />}
						{view === 'cohort-wizard' && <CohortWizard cohort={selectedCohort} branches={visibleBranches} users={snapshot.users} curricula={visibleCurricula} curriculumVersions={visibleCurriculumVersions} user={currentUser} busy={busy} onCancel={() => setView(selectedCohort ? 'cohort-detail' : 'cohorts')} onSave={saveCohort} />}
						{view === 'cohort-detail' && selectedCohort && <CohortDetail cohort={selectedCohort} branches={visibleBranches} users={snapshot.users} user={currentUser} busy={busy} onBack={() => setView('cohorts')} onEdit={() => setView('cohort-wizard')} onSessions={() => setView('sessions')} onSave={updateCohort} onAddStudent={(cohortId, studentId) => mutate(() => mockApi.addStudent(cohortId, studentId, currentUser), 'Student enrolled in this demo.')} onRemoveStudent={(cohortId, studentId) => mutate(() => mockApi.removeStudent(cohortId, studentId, currentUser), 'Student removed from this demo.')} />}
						{view === 'sessions' && selectedCohort && <SessionManager cohort={selectedCohort} sessions={snapshot.sessions.filter((session) => session.cohort === selectedCohort.id)} users={snapshot.users} branches={visibleBranches} attendance={snapshot.attendance} currentUser={currentUser} busy={busy} onBack={() => setView('cohort-detail')} onSaveSession={saveSession} onRecordAttendance={recordAttendance} />}
						{view === 'users' && <UserManager users={snapshot.users} branches={visibleBranches} currentUser={currentUser} busy={busy} onSave={saveUser} />}
						{view === 'curricula' && <CurriculumManager curricula={visibleCurricula} versions={visibleCurriculumVersions} branches={visibleBranches} user={currentUser} busy={busy} onCreate={createCurriculum} onUpdate={saveCurriculum} onCreateVersion={createCurriculumVersion} onSaveVersion={saveCurriculumVersion} onPublish={publishCurriculumVersion} />}
						{view === 'branches' && isSuperAdmin && <BranchManager branches={snapshot.branches} users={snapshot.users} cohorts={snapshot.cohorts} busy={busy} onSave={saveBranch} />}
						{view === 'branch-info' && !isSuperAdmin && <BranchInfo branch={currentBranch} users={snapshot.users} cohorts={visibleCohorts} />}
						{view === 'cohort-detail' && !selectedCohort && <MissingCohort onBack={() => setView('cohorts')} />}
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

function NavButton({ item, active, onClick, compact = false }) {
	const Icon = item.icon
	return (
		<button type="button" onClick={onClick} aria-current={active ? 'page' : undefined} className={`flex min-h-10 shrink-0 items-center gap-3 px-3 text-left text-sm font-medium transition-colors ${compact ? 'min-h-9 px-3 text-xs' : 'w-full'} ${active ? 'bg-hub-purple text-white' : 'text-hub-muted hover:bg-[#f5f3f6] hover:text-hub-ink'}`}>
			<Icon size={17} aria-hidden="true" />{item.label}
		</button>
	)
}

function BrandMark() {
	return <span className="grid size-8 shrink-0 place-items-center bg-hub-purple text-white"><Layers3 size={18} strokeWidth={2.2} aria-hidden="true" /></span>
}

function Avatar({ user, small = false }) {
	const initials = `${user.first_name?.[0] ?? ''}${user.last_name?.[0] ?? ''}` || user.username.slice(0, 2)
	return <span className={`grid shrink-0 place-items-center bg-hub-ink font-bold text-white ${small ? 'size-7 text-[10px]' : 'size-9 text-xs'}`}>{initials}</span>
}

function LoginScreen({ users, busy, error, onSignIn }) {
	const superAdmin = users.find((user) => user.application_role === 'SUPER_ADMIN')
	const branchAdmin = users.find((user) => user.application_role === 'BRANCH_ADMIN' && user.is_active)
	const instructor = users.find((user) => user.application_role === 'INSTRUCTOR' && user.is_active)
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
						{[superAdmin, branchAdmin, instructor].filter(Boolean).map((user) => {
							const isSuperAdmin = user.application_role === 'SUPER_ADMIN'
							const role = roleName(user.application_role)
							return (
								<button type="button" key={user.id} disabled={busy} onClick={() => onSignIn(user.id)} className="group flex min-h-[76px] w-full items-center gap-3 text-left hover:bg-[#fbf8fc] disabled:opacity-50">
									<span className={`grid size-10 shrink-0 place-items-center ${isSuperAdmin ? 'bg-hub-ink text-white' : 'bg-[#f0e9f0] text-hub-purple'}`}>{isSuperAdmin ? <ShieldCheck size={18} aria-hidden="true" /> : user.application_role === 'INSTRUCTOR' ? <GraduationCap size={18} aria-hidden="true" /> : <Building2 size={18} aria-hidden="true" />}</span>
									<span className="min-w-0 flex-1"><span className="block text-sm font-semibold">{role}</span><span className="mt-1 block truncate text-xs text-hub-muted">{user.first_name} {user.last_name} · {isSuperAdmin ? 'Organization-wide' : 'Central Fellowship'}</span></span>
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

function LoadingScreen({ error }) {
	return (
		<main className="min-h-screen bg-[#f5f3f6] p-5 sm:p-8">
			<div className="mx-auto max-w-4xl border-y border-hub-line bg-white p-5 sm:p-8">
				<div className="flex items-center gap-3"><BrandMark /><div className="h-4 w-44 animate-pulse bg-[#e8e4e9]" /></div>
				{error ? <p role="alert" className="mt-6 text-sm text-red-800">{error}</p> : <div className="mt-8 space-y-3" aria-label="Loading demo"><div className="h-8 w-1/3 animate-pulse bg-[#e8e4e9]" /><div className="h-14 animate-pulse bg-[#f2eff3]" /><div className="h-14 animate-pulse bg-[#f2eff3]" /></div>}
			</div>
		</main>
	)
}

function MissingCohort({ onBack }) {
	return <div className="border-y border-hub-line bg-white p-6"><h1 className="text-xl font-semibold">Cohort not found</h1><p className="mt-2 text-sm text-hub-muted">It may have been reset or removed from the local demo.</p><button type="button" onClick={onBack} className="mt-4 text-sm font-semibold text-hub-purple underline underline-offset-4">Back to cohorts</button></div>
}
