import { useCallback, useEffect, useState } from 'react'
import {
	Building2,
	BookOpen,
	Award,
	ClipboardList,
	ChartNoAxesCombined,
	GraduationCap,
	LayoutDashboard,
	UsersRound,
} from 'lucide-react'
import { AppShell } from './components/AppShell.jsx'
import { LoadingScreen, LoginScreen, MissingCohort } from './components/AuthScreens.jsx'
import { BranchInfo, BranchManager, UserManager } from './pages/AdminScreens.jsx'
import { CohortBoard, CohortDetail, CohortWizard } from './pages/CohortScreens.jsx'
import { CurriculumManager } from './pages/CurriculumScreens.jsx'
import { SessionManager } from './pages/SessionScreens.jsx'
import { AssessmentManager, StudentAssessments } from './pages/AssessmentScreens.jsx'
import { ResultsManager } from './pages/ResultsScreens.jsx'
import { PublicCertificateVerification, StudentCertificateScreen } from './pages/CertificateScreens.jsx'
import { DashboardScreen } from './pages/DashboardScreens.jsx'
import { api } from './services/api.js'

const NAV_ITEMS = {
	SUPER_ADMIN: [
		{ id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
		{ id: 'cohorts', label: 'Cohorts', icon: GraduationCap },
		{ id: 'assessments', label: 'Assessments', icon: ClipboardList },
		{ id: 'results', label: 'Results', icon: ChartNoAxesCombined },
		{ id: 'curricula', label: 'Curricula', icon: BookOpen },
		{ id: 'users', label: 'People', icon: UsersRound },
		{ id: 'branches', label: 'Branches', icon: Building2 },
	],
	BRANCH_ADMIN: [
		{ id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
		{ id: 'cohorts', label: 'Cohorts', icon: GraduationCap },
		{ id: 'assessments', label: 'Assessments', icon: ClipboardList },
		{ id: 'results', label: 'Results', icon: ChartNoAxesCombined },
		{ id: 'curricula', label: 'Curricula', icon: BookOpen },
		{ id: 'users', label: 'People', icon: UsersRound },
		{ id: 'branch-info', label: 'My branch', icon: Building2 },
	],
	INSTRUCTOR: [
		{ id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
		{ id: 'cohorts', label: 'My cohorts', icon: GraduationCap },
		{ id: 'assessments', label: 'Assessments', icon: ClipboardList },
		{ id: 'results', label: 'Results', icon: ChartNoAxesCombined },
	],
	STUDENT: [
		{ id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
		{ id: 'assessments', label: 'My assessments', icon: ClipboardList },
		{ id: 'certificates', label: 'Certificates', icon: Award },
	],
}

const PAGE_TITLES = {
	dashboard: 'Dashboard',
	cohorts: 'Cohort management',
	curricula: 'Curriculum management',
	'cohort-detail': 'Cohort detail',
	'cohort-wizard': 'Cohort setup',
	sessions: 'Sessions and attendance',
	assessments: 'Assessments',
	results: 'Results and eligibility',
	users: 'People management',
	branches: 'Branch management',
	'branch-info': 'Branch information',
}

export default function App() {
	const [snapshot, setSnapshot] = useState(null)
	const [view, setView] = useState('dashboard')
	const [selectedCohortId, setSelectedCohortId] = useState(null)
	const [busy, setBusy] = useState(false)
	const [notice, setNotice] = useState('')
	const [loadError, setLoadError] = useState('')
	const verificationReference = new URLSearchParams(window.location.search).get('verify')
	const refreshAssessment = useCallback(async () => {
		setSnapshot(await api.snapshot())
	}, [])

	useEffect(() => {
		let active = true
		api.snapshot()
			.then((data) => {
				if (active) {
					setSnapshot(data)
				}
			})
			.catch((error) => {
				if (active) setLoadError(`Unable to connect to the server: ${error.message}`)
			})
		return () => { active = false }
	}, [])

	useEffect(() => {
		if (!notice) return undefined
		const timeout = window.setTimeout(() => setNotice(''), 3500)
		return () => window.clearTimeout(timeout)
	}, [notice])

	if (verificationReference !== null) {
		return <PublicCertificateVerification initialReference={verificationReference} />
	}

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

	async function signIn(credentials) {
		setBusy(true)
		setLoadError('')
		try {
			const data = await api.signIn(credentials)
			setSnapshot(data)
			setView('dashboard')
		} catch (error) {
			setLoadError(error.message)
		} finally {
			setBusy(false)
		}
	}

	async function signOut() {
		setSnapshot(await api.signOut())
		setView('dashboard')
		setSelectedCohortId(null)
	}

	if (!snapshot) {
		return <LoadingScreen error={loadError} />
	}

	const currentUser = snapshot.currentUser
	if (!currentUser) {
		return <LoginScreen busy={busy} error={loadError} onSignIn={signIn} />
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
		const data = await mutate(() => api.saveCohort(input, currentUser), input.status === 'READY' ? 'Cohort marked Ready.' : 'Draft saved.')
		const saved = input.id
			? data.cohorts.find((cohort) => cohort.id === input.id)
			: data.cohorts.reduce((latest, cohort) => cohort.id > latest.id ? cohort : latest, data.cohorts[0])
		setSelectedCohortId(saved.id)
		setView('cohort-detail')
	}

	async function updateCohort(input) {
		await mutate(() => api.saveCohort(input, currentUser), 'Cohort updated.')
	}

	async function saveUser(input) {
		await mutate(() => api.saveUser(input, currentUser), input.id ? 'Account updated.' : 'Account registered.')
	}

	async function saveBranch(input) {
		await mutate(() => api.saveBranch(input), input.id ? 'Branch updated.' : 'Branch created.')
	}

	async function saveCurriculum(input) {
		const data = await mutate(
			() => api.saveCurriculum(input, currentUser),
			input.id ? 'Curriculum details saved.' : 'Curriculum and initial draft created.',
		)
		return data.curricula.find((curriculum) => (
			curriculum.branch === (currentUser.application_role === 'BRANCH_ADMIN' ? currentUser.branch : Number(input.branch))
			&& curriculum.name.toLowerCase() === input.name.trim().toLowerCase()
		))
	}

	async function createCurriculum(input) {
		const data = await mutate(
			() => api.saveCurriculum(input, currentUser),
			'Curriculum and initial draft created.',
		)
		const branchId = currentUser.application_role === 'BRANCH_ADMIN' ? currentUser.branch : Number(input.branch)
		return data.curricula.find((curriculum) => (
			curriculum.branch === branchId
			&& curriculum.name.toLowerCase() === input.name.trim().toLowerCase()
		))
	}

	async function createCurriculumVersion(curriculumId, changeNote) {
		await mutate(() => api.createCurriculumVersion(curriculumId, changeNote, currentUser), 'New editable version created.')
	}

	async function saveCurriculumVersion(curriculumId, versionId, input) {
		await mutate(() => api.saveCurriculumVersion(curriculumId, versionId, input, currentUser), 'Curriculum draft saved.')
	}

	async function publishCurriculumVersion(curriculumId, versionId) {
		await mutate(() => api.publishCurriculumVersion(curriculumId, versionId, currentUser), 'Curriculum version published.')
	}

	async function saveSession(input) {
		const data = await mutate(
			() => api.saveSession(input, currentUser),
			input.id ? 'Session updated.' : 'Session scheduled.',
		)
		return data.sessions.find((session) => session.id === input.id)
			?? data.sessions.reduce((latest, session) => session.id > latest.id ? session : latest, data.sessions[0])
	}

	async function recordAttendance(sessionId, studentId, input) {
		await mutate(
			() => api.setAttendance(sessionId, studentId, input, currentUser),
			'Attendance saved.',
		)
	}

	async function assessmentAction(method, ...args) {
		return mutate(() => api[method](...args, currentUser), '')
	}

	async function saveGraduationRequirements(cohortId, input) {
		return mutate(() => api.saveGraduationRequirements(cohortId, input, currentUser), 'Graduation requirements saved.')
	}

	async function finalizeGraduationResults(cohortId) {
		return mutate(() => api.finalizeGraduationResults(cohortId, currentUser), 'Results finalized.')
	}

	async function issueCertificates(cohortId, studentIds) {
		return mutate(() => api.issueCertificates(cohortId, studentIds, currentUser), 'Certificates issued.')
	}

	function openCohortSessions(cohortId) {
		setSelectedCohortId(cohortId)
		setView('sessions')
	}

	function navigate(nextView) {
		setView(nextView)
		setSelectedCohortId(null)
	}

	const visibleNav = NAV_ITEMS[currentUser.application_role] ?? NAV_ITEMS.BRANCH_ADMIN
	const pageTitle = PAGE_TITLES[view] ?? 'MembershipHub'

	return (
		<AppShell
			navItems={visibleNav}
			view={view}
			currentUser={currentUser}
			currentBranch={currentBranch}
			isSuperAdmin={isSuperAdmin}
			pageTitle={pageTitle}
			busy={busy}
			notice={notice}
			onNavigate={navigate}
			onSignOut={signOut}
		>
			{view === 'dashboard' && <DashboardScreen snapshot={snapshot} user={currentUser} onNavigate={navigate} onOpenCohort={(id) => { setSelectedCohortId(id); setView('cohort-detail') }} onOpenSessions={openCohortSessions} />}
			{view === 'cohorts' && <CohortBoard cohorts={visibleCohorts} branches={visibleBranches} users={snapshot.users} isSuperAdmin={isSuperAdmin} canCreate={isSuperAdmin || currentUser.application_role === 'BRANCH_ADMIN'} onCreate={() => { setSelectedCohortId(null); setView('cohort-wizard') }} onOpen={(id) => { setSelectedCohortId(id); setView('cohort-detail') }} />}
			{view === 'cohort-wizard' && <CohortWizard cohort={selectedCohort} branches={visibleBranches} users={snapshot.users} curricula={visibleCurricula} curriculumVersions={visibleCurriculumVersions} user={currentUser} busy={busy} onCancel={() => setView(selectedCohort ? 'cohort-detail' : 'cohorts')} onSave={saveCohort} />}
			{view === 'cohort-detail' && selectedCohort && <CohortDetail cohort={selectedCohort} branches={visibleBranches} users={snapshot.users} user={currentUser} busy={busy} onBack={() => setView('cohorts')} onEdit={() => setView('cohort-wizard')} onSessions={() => setView('sessions')} onSave={updateCohort} onAddStudent={(cohortId, studentId) => mutate(() => api.addStudent(cohortId, studentId, currentUser), 'Student enrolled.')} onRemoveStudent={(cohortId, studentId) => mutate(() => api.removeStudent(cohortId, studentId, currentUser), 'Student removed.')} />}
			{view === 'sessions' && selectedCohort && <SessionManager cohort={selectedCohort} sessions={snapshot.sessions.filter((session) => session.cohort === selectedCohort.id)} users={snapshot.users} branches={visibleBranches} attendance={snapshot.attendance} attendanceReport={snapshot.attendanceReports.find((report) => report.cohort.id === selectedCohort.id)} currentUser={currentUser} busy={busy} onBack={() => setView('cohort-detail')} onSaveSession={saveSession} onRecordAttendance={recordAttendance} />}
			{view === 'assessments' && (currentUser.application_role === 'STUDENT' ? <StudentAssessments snapshot={snapshot} user={currentUser} busy={busy} onAction={assessmentAction} onRefresh={refreshAssessment} /> : <AssessmentManager snapshot={snapshot} user={currentUser} busy={busy} onAction={assessmentAction} />)}
			{view === 'results' && currentUser.application_role !== 'STUDENT' && <ResultsManager snapshot={snapshot} user={currentUser} cohorts={visibleCohorts} busy={busy} onSaveRequirements={saveGraduationRequirements} onFinalize={finalizeGraduationResults} onIssueCertificates={issueCertificates} />}
			{view === 'certificates' && currentUser.application_role === 'STUDENT' && <StudentCertificateScreen certificates={snapshot.certificates} />}
			{view === 'users' && <UserManager users={snapshot.users} branches={visibleBranches} currentUser={currentUser} busy={busy} onSave={saveUser} />}
			{view === 'curricula' && <CurriculumManager curricula={visibleCurricula} versions={visibleCurriculumVersions} branches={visibleBranches} user={currentUser} busy={busy} onCreate={createCurriculum} onUpdate={saveCurriculum} onCreateVersion={createCurriculumVersion} onSaveVersion={saveCurriculumVersion} onPublish={publishCurriculumVersion} />}
			{view === 'branches' && isSuperAdmin && <BranchManager branches={snapshot.branches} users={snapshot.users} cohorts={snapshot.cohorts} busy={busy} onSave={saveBranch} />}
			{view === 'branch-info' && !isSuperAdmin && <BranchInfo branch={currentBranch} users={snapshot.users} cohorts={visibleCohorts} />}
			{view === 'cohort-detail' && !selectedCohort && <MissingCohort onBack={() => setView('cohorts')} />}
		</AppShell>
	)
}
