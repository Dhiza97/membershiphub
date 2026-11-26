import { useState } from 'react'
import { Building2, Check, ChevronDown, Pencil, Plus, Search, UserRound } from 'lucide-react'

const ROLE_LABELS = {
  SUPER_ADMIN: 'Super Admin',
  BRANCH_ADMIN: 'Branch Admin',
  INSTRUCTOR: 'Instructor',
  STUDENT: 'Student',
}

function nameOf(user) {
  return [user?.first_name, user?.last_name].filter(Boolean).join(' ') || user?.username || 'Unnamed account'
}

function countLabel(count, singular) {
  return `${count} ${singular}${count === 1 ? '' : 's'}`
}

function FormInput({ label, className = '', ...props }) {
  return (
    <label className={`block text-sm font-medium ${className}`}>
      {label}
      <input className="mt-1.5 min-h-11 w-full border border-hub-line bg-white px-3 text-sm font-normal text-hub-ink placeholder:text-hub-muted/80 focus:border-hub-purple focus:outline-none focus:ring-2 focus:ring-hub-purple/15 disabled:bg-[#f4f2f4] disabled:text-hub-muted" {...props} />
    </label>
  )
}

function FormSelect({ label, children, ...props }) {
  return (
    <label className="relative block text-sm font-medium">
      {label}
      <select className="mt-1.5 min-h-11 w-full appearance-none border border-hub-line bg-white px-3 pr-9 text-sm font-normal focus:border-hub-purple focus:outline-none focus:ring-2 focus:ring-hub-purple/15" {...props}>{children}</select>
      <ChevronDown className="pointer-events-none absolute bottom-3 right-3 text-hub-muted" size={16} aria-hidden="true" />
    </label>
  )
}

export function BranchManager({ branches, users, cohorts, busy, onSave }) {
  const [editing, setEditing] = useState(null)
  const [error, setError] = useState('')

  function startCreate() {
    setError('')
    setEditing({ name: '', location: '', timezone: 'Africa/Accra', is_active: true })
  }

  async function saveBranch(event) {
    event.preventDefault()
    setError('')
    const formData = new FormData(event.currentTarget)
    try {
      await onSave({
        id: editing.id,
        name: formData.get('name'),
        location: formData.get('location'),
        timezone: formData.get('timezone'),
        is_active: formData.get('is_active') === 'on',
      })
      setEditing(null)
    } catch (saveError) {
      setError(saveError.message)
    }
  }

  async function toggleActive(branch) {
    setError('')
    try {
      await onSave({ ...branch, is_active: !branch.is_active })
    } catch (saveError) {
      setError(saveError.message)
    }
  }

  return (
    <section className="space-y-5">
      <div className="flex flex-col justify-between gap-4 border-b border-hub-line pb-5 sm:flex-row sm:items-end">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Branches</h1>
          <p className="mt-1 text-sm text-hub-muted">{branches.length} locations</p>
        </div>
        {!editing && <button type="button" onClick={startCreate} className="inline-flex min-h-11 items-center justify-center gap-2 bg-hub-purple px-4 text-sm font-semibold text-white hover:bg-hub-purple-dark"><Plus size={17} aria-hidden="true" />Create branch</button>}
      </div>

      {error && <p role="alert" className="border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-900">{error}</p>}

      {editing && (
        <form onSubmit={saveBranch} className="border-y border-hub-line bg-white p-4 sm:p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="font-semibold">{editing.id ? 'Edit branch' : 'New branch'}</h2>
              <p className="mt-1 text-xs text-hub-muted">Branch names must be unique.</p>
            </div>
            <button type="button" onClick={() => setEditing(null)} aria-label="Close branch form" className="px-2 py-1 text-sm font-semibold text-hub-muted hover:text-hub-ink">Close</button>
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <FormInput label="Branch name" name="name" required maxLength={150} defaultValue={editing.name} placeholder="e.g. East Legon" />
            <FormInput label="Location" name="location" defaultValue={editing.location} placeholder="City or neighborhood" />
            <FormInput label="IANA timezone" name="timezone" required maxLength={64} defaultValue={editing.timezone ?? 'Africa/Accra'} placeholder="Africa/Accra" />
          </div>
          {editing.id && <label className="mt-4 inline-flex min-h-10 items-center gap-2 text-sm"><input name="is_active" type="checkbox" defaultChecked={editing.is_active} className="size-4 accent-[#94007e]" />Branch is active</label>}
          <div className="mt-5 flex justify-end gap-2 border-t border-hub-line pt-4">
            <button type="button" onClick={() => setEditing(null)} className="min-h-10 px-3 text-sm font-semibold text-hub-muted">Cancel</button>
            <button type="submit" disabled={busy} className="inline-flex min-h-10 items-center gap-2 bg-hub-ink px-4 text-sm font-semibold text-white hover:bg-neutral-700 disabled:opacity-50"><Check size={16} aria-hidden="true" />Save branch</button>
          </div>
        </form>
      )}

      <div className="hidden overflow-x-auto border border-hub-line bg-white md:block">
        <table className="w-full min-w-[700px] table-fixed border-collapse text-left">
          <thead className="bg-hub-ink text-xs uppercase text-white"><tr><th className="w-[32%] px-4 py-3 font-semibold">Branch</th><th className="w-[20%] px-4 py-3 font-semibold">Accounts</th><th className="w-[20%] px-4 py-3 font-semibold">Cohorts</th><th className="w-[14%] px-4 py-3 font-semibold">Status</th><th className="w-[14%] px-4 py-3 text-right font-semibold">Actions</th></tr></thead>
          <tbody>
            {branches.map((branch, index) => {
              const accountCount = users.filter((user) => user.branch === branch.id).length
              const cohortCount = cohorts.filter((cohort) => cohort.branch === branch.id).length
              return (
                <tr key={branch.id} className={`border-t border-hub-line ${index % 2 ? 'bg-[#fcfbfc]' : 'bg-white'}`}>
                  <td className="px-4 py-3.5"><span className="block truncate font-semibold">{branch.name}</span><span className="mt-1 block truncate text-xs text-hub-muted">{branch.location || 'Location not set'}</span></td>
                  <td className="px-4 py-3.5 text-sm tabular-nums">{countLabel(accountCount, 'account')}</td>
                  <td className="px-4 py-3.5 text-sm tabular-nums">{countLabel(cohortCount, 'cohort')}</td>
                  <td className="px-4 py-3.5"><span className={`inline-flex items-center gap-2 text-xs font-semibold ${branch.is_active ? 'text-emerald-800' : 'text-hub-muted'}`}><span className={`status-lamp ${branch.is_active ? 'status-lamp-on' : ''}`} />{branch.is_active ? 'Active' : 'Inactive'}</span></td>
                  <td className="px-4 py-3.5"><div className="flex justify-end gap-1"><button type="button" onClick={() => setEditing(branch)} aria-label={`Edit ${branch.name}`} className="grid size-9 place-items-center text-hub-muted hover:bg-[#f5eff5] hover:text-hub-purple"><Pencil size={16} aria-hidden="true" /></button><button type="button" onClick={() => toggleActive(branch)} className="min-h-9 px-2 text-xs font-semibold text-hub-purple hover:underline">{branch.is_active ? 'Deactivate' : 'Activate'}</button></div></td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <div className="divide-y divide-hub-line border-y border-hub-line bg-white md:hidden">
        {branches.map((branch) => <div key={branch.id} className="flex items-center gap-3 px-3 py-4"><Building2 className="shrink-0 text-hub-purple" size={20} aria-hidden="true" /><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{branch.name}</p><p className="mt-1 text-xs text-hub-muted">{countLabel(users.filter((user) => user.branch === branch.id).length, 'account')} · {countLabel(cohorts.filter((cohort) => cohort.branch === branch.id).length, 'cohort')}</p></div><button type="button" onClick={() => toggleActive(branch)} className="min-h-9 px-1 text-xs font-semibold text-hub-purple">{branch.is_active ? 'Deactivate' : 'Activate'}</button><button type="button" onClick={() => setEditing(branch)} aria-label={`Edit ${branch.name}`} className="grid size-9 place-items-center border border-hub-line"><Pencil size={15} aria-hidden="true" /></button></div>)}
      </div>
    </section>
  )
}

export function BranchInfo({ branch, users, cohorts }) {
  const branchUsers = users.filter((user) => user.branch === branch?.id)
  const instructors = branchUsers.filter((user) => user.application_role === 'INSTRUCTOR')
  const students = branchUsers.filter((user) => user.application_role === 'STUDENT')
  const branchCohorts = cohorts.filter((cohort) => cohort.branch === branch?.id)

  return (
    <section className="space-y-5">
      <div className="border-b border-hub-line pb-5">
        <h1 className="text-2xl font-semibold tracking-tight">My branch</h1>
        <p className="mt-1 text-sm text-hub-muted">Branch information and people</p>
      </div>
      {branch ? (
        <>
          <div className="grid gap-8 border-y border-hub-line bg-white p-5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
            <div><p className="text-xs font-semibold uppercase text-hub-muted">Branch</p><h2 className="mt-1 text-xl font-semibold">{branch.name}</h2><p className="mt-1 text-sm text-hub-muted">{branch.location || 'Location not set'}</p></div>
            <span className={`inline-flex items-center gap-2 text-sm font-semibold ${branch.is_active ? 'text-emerald-800' : 'text-red-800'}`}><span className={`status-lamp ${branch.is_active ? 'status-lamp-on' : 'status-lamp-off'}`} />{branch.is_active ? 'Active' : 'Inactive'}</span>
          </div>
          <div className="grid gap-7 lg:grid-cols-2">
            <div className="border-y border-hub-line">
              <div className="flex items-center justify-between py-3"><h2 className="text-sm font-semibold">People</h2><span className="text-xs tabular-nums text-hub-muted">{branchUsers.length}</span></div>
              <dl className="divide-y divide-hub-line bg-white">
                <BranchCount label="Instructors" count={instructors.length} />
                <BranchCount label="Students" count={students.length} />
                <BranchCount label="Branch Admins" count={branchUsers.filter((user) => user.application_role === 'BRANCH_ADMIN').length} />
              </dl>
            </div>
            <div className="border-y border-hub-line">
              <div className="flex items-center justify-between py-3"><h2 className="text-sm font-semibold">Cohorts</h2><span className="text-xs tabular-nums text-hub-muted">{branchCohorts.length}</span></div>
              <div className="divide-y divide-hub-line bg-white">
                {branchCohorts.map((cohort) => <p key={cohort.id} className="flex min-h-12 items-center justify-between gap-3 px-3 text-sm"><span className="truncate">{cohort.name || 'Untitled draft'}</span><span className="shrink-0 text-xs font-semibold text-hub-muted">{cohort.status}</span></p>)}
                {branchCohorts.length === 0 && <p className="px-3 py-5 text-sm text-hub-muted">No cohorts yet.</p>}
              </div>
            </div>
          </div>
        </>
      ) : <p className="border-y border-hub-line bg-white p-5 text-sm text-hub-muted">No branch is assigned to this account.</p>}
    </section>
  )
}

function BranchCount({ label, count }) {
  return <div className="flex items-center justify-between px-3 py-3"><dt className="text-sm">{label}</dt><dd className="font-semibold tabular-nums">{count}</dd></div>
}

export function UserManager({ users, branches, currentUser, busy, onSave }) {
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('')
  const [branchFilter, setBranchFilter] = useState('')
  const [editing, setEditing] = useState(null)
  const [error, setError] = useState('')
  const isSuperAdmin = currentUser.application_role === 'SUPER_ADMIN'
  const visibleUsers = users.filter((user) => {
    const allowedBranch = isSuperAdmin || user.branch === currentUser.branch
    const branchName = branches.find((branch) => branch.id === user.branch)?.name ?? ''
    const queryMatch = !search || `${nameOf(user)} ${user.username} ${user.email} ${branchName}`.toLowerCase().includes(search.toLowerCase())
    return allowedBranch && queryMatch && (!roleFilter || user.application_role === roleFilter) && (!isSuperAdmin || !branchFilter || user.branch === Number(branchFilter))
  })

  function createUser() {
    setError('')
    setEditing({
      username: '',
      first_name: '',
      last_name: '',
      email: '',
      application_role: 'STUDENT',
      branch: currentUser.branch ?? branches.find((branch) => branch.is_active)?.id ?? '',
      is_active: true,
      password: '',
    })
  }

  async function saveUser(event) {
    event.preventDefault()
    setError('')
    const formData = new FormData(event.currentTarget)
    const role = isSuperAdmin ? formData.get('application_role') : editing.application_role
    try {
      await onSave({
        id: editing.id,
        username: editing.id ? editing.username : formData.get('username'),
        first_name: formData.get('first_name'),
        last_name: formData.get('last_name'),
        email: formData.get('email'),
        password: formData.get('password'),
        application_role: role,
        branch: isSuperAdmin ? Number(formData.get('branch')) : currentUser.branch,
        is_active: formData.get('is_active') === 'on',
      })
      setEditing(null)
    } catch (saveError) {
      setError(saveError.message)
    }
  }

  return (
    <section className="space-y-5">
      <div className="flex flex-col justify-between gap-4 border-b border-hub-line pb-5 sm:flex-row sm:items-end">
        <div><h1 className="text-2xl font-semibold tracking-tight">People</h1><p className="mt-1 text-sm text-hub-muted">{visibleUsers.length} accounts{!isSuperAdmin && ' in your branch'}</p></div>
        {!editing && <button type="button" onClick={createUser} className="inline-flex min-h-11 items-center justify-center gap-2 bg-hub-purple px-4 text-sm font-semibold text-white hover:bg-hub-purple-dark"><Plus size={17} aria-hidden="true" />Register account</button>}
      </div>

      {error && <p role="alert" className="border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-900">{error}</p>}

      {editing && (
        <form onSubmit={saveUser} className="border-y border-hub-line bg-white p-4 sm:p-5">
          <div className="flex items-start justify-between gap-4">
            <div><h2 className="font-semibold">{editing.id ? `Edit ${nameOf(editing)}` : 'Register an account'}</h2><p className="mt-1 text-xs text-hub-muted">{editing.id ? 'Changes apply to this account only.' : 'The account will be assigned to your selected branch.'}</p></div>
            <button type="button" onClick={() => setEditing(null)} className="px-2 py-1 text-sm font-semibold text-hub-muted">Close</button>
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {!editing.id && <FormInput label="Username" name="username" required minLength={1} maxLength={150} placeholder="username" />}
            <FormInput label="First name" name="first_name" defaultValue={editing.first_name} maxLength={150} />
            <FormInput label="Last name" name="last_name" defaultValue={editing.last_name} maxLength={150} />
            <FormInput label="Email" name="email" type="email" defaultValue={editing.email} />
            {isSuperAdmin ? (
              <FormSelect label="Role" name="application_role" value={editing.application_role} onChange={(event) => setEditing((current) => ({ ...current, application_role: event.target.value }))}>
                <option value="STUDENT">Student</option><option value="INSTRUCTOR">Instructor</option><option value="BRANCH_ADMIN">Branch Admin</option>
              </FormSelect>
            ) : editing.id ? (
              <div className="text-sm font-medium">Role<span className="mt-1.5 flex min-h-11 items-center border border-hub-line bg-[#f4f2f4] px-3 font-normal text-hub-muted">{ROLE_LABELS[editing.application_role]}</span></div>
            ) : (
              <FormSelect label="Role" name="application_role" value={editing.application_role} onChange={(event) => setEditing((current) => ({ ...current, application_role: event.target.value }))}>
                <option value="STUDENT">Student</option><option value="INSTRUCTOR">Instructor</option>
              </FormSelect>
            )}
            {isSuperAdmin ? (
              <FormSelect label="Branch" name="branch" value={editing.branch} onChange={(event) => setEditing((current) => ({ ...current, branch: Number(event.target.value) }))}>
                {branches.filter((branch) => branch.is_active).map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
              </FormSelect>
            ) : (
              <div className="text-sm font-medium">Branch<span className="mt-1.5 flex min-h-11 items-center border border-hub-line bg-[#f4f2f4] px-3 font-normal text-hub-muted">{branches.find((branch) => branch.id === currentUser.branch)?.name ?? 'Unassigned'}</span></div>
            )}
            {!editing.id && <FormInput label="Temporary password" name="password" type="password" required minLength={8} autoComplete="new-password" placeholder="At least 8 characters" />}
          </div>
          {editing.id && <label className="mt-4 inline-flex min-h-10 items-center gap-2 text-sm"><input name="is_active" type="checkbox" defaultChecked={editing.is_active} className="size-4 accent-[#94007e]" />Account is active</label>}
          {!editing.id && <p className="mt-3 text-xs text-hub-muted">Demo only: passwords are not stored.</p>}
          <div className="mt-5 flex justify-end gap-2 border-t border-hub-line pt-4">
            <button type="button" onClick={() => setEditing(null)} className="min-h-10 px-3 text-sm font-semibold text-hub-muted">Cancel</button>
            <button type="submit" disabled={busy} className="inline-flex min-h-10 items-center gap-2 bg-hub-ink px-4 text-sm font-semibold text-white hover:bg-neutral-700 disabled:opacity-50"><Check size={16} aria-hidden="true" />Save account</button>
          </div>
        </form>
      )}

      <div className="flex flex-col gap-3 md:flex-row">
        <label className="relative min-w-0 flex-1"><Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-hub-muted" size={17} aria-hidden="true" /><span className="sr-only">Search people</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search people" className="min-h-11 w-full border border-hub-line bg-white pl-10 pr-3 text-sm focus:border-hub-purple focus:outline-none focus:ring-2 focus:ring-hub-purple/15" /></label>
        <label className="relative min-w-40"><span className="sr-only">Filter by role</span><select value={roleFilter} onChange={(event) => setRoleFilter(event.target.value)} className="min-h-11 w-full appearance-none border border-hub-line bg-white px-3 pr-9 text-sm focus:border-hub-purple focus:outline-none"><option value="">All roles</option>{Object.entries(ROLE_LABELS).filter(([role]) => role !== 'SUPER_ADMIN').map(([role, label]) => <option key={role} value={role}>{label}</option>)}</select><ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-hub-muted" size={16} aria-hidden="true" /></label>
        {isSuperAdmin && <label className="relative min-w-48"><span className="sr-only">Filter by branch</span><select value={branchFilter} onChange={(event) => setBranchFilter(event.target.value)} className="min-h-11 w-full appearance-none border border-hub-line bg-white px-3 pr-9 text-sm focus:border-hub-purple focus:outline-none"><option value="">All branches</option>{branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}</select><ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-hub-muted" size={16} aria-hidden="true" /></label>}
      </div>

      <div className="hidden overflow-x-auto border border-hub-line bg-white md:block">
        <table className="w-full min-w-[780px] table-fixed border-collapse text-left">
          <thead className="bg-hub-ink text-xs uppercase text-white"><tr><th className="w-[27%] px-4 py-3 font-semibold">Account</th><th className="w-[18%] px-4 py-3 font-semibold">Role</th>{isSuperAdmin && <th className="w-[20%] px-4 py-3 font-semibold">Branch</th>}<th className="w-[16%] px-4 py-3 font-semibold">Status</th><th className="w-[19%] px-4 py-3 text-right font-semibold">Action</th></tr></thead>
          <tbody>
            {visibleUsers.map((user, index) => (
              <tr key={user.id} className={`border-t border-hub-line ${index % 2 ? 'bg-[#fcfbfc]' : 'bg-white'}`}>
                <td className="px-4 py-3.5"><span className="block truncate text-sm font-semibold">{nameOf(user)}</span><span className="mt-1 block truncate text-xs text-hub-muted">{user.email || user.username}</span></td>
                <td className="px-4 py-3.5 text-sm">{ROLE_LABELS[user.application_role]}</td>
                {isSuperAdmin && <td className="truncate px-4 py-3.5 text-sm text-hub-muted">{branches.find((branch) => branch.id === user.branch)?.name ?? 'Organization'}</td>}
                <td className="px-4 py-3.5"><span className={`inline-flex items-center gap-2 text-xs font-semibold ${user.is_active ? 'text-emerald-800' : 'text-hub-muted'}`}><span className={`status-lamp ${user.is_active ? 'status-lamp-on' : ''}`} />{user.is_active ? 'Active' : 'Inactive'}</span></td>
                <td className="px-4 py-3.5 text-right"><button type="button" onClick={() => setEditing(user)} className="inline-flex min-h-9 items-center gap-2 px-2 text-sm font-semibold text-hub-purple hover:underline"><Pencil size={15} aria-hidden="true" />Edit</button></td>
              </tr>
            ))}
          </tbody>
        </table>
        {visibleUsers.length === 0 && <p className="px-4 py-10 text-center text-sm text-hub-muted">No matching accounts.</p>}
      </div>

      <div className="divide-y divide-hub-line border-y border-hub-line bg-white md:hidden">
        {visibleUsers.map((user) => <div key={user.id} className="flex items-center gap-3 px-3 py-3.5"><span className="grid size-9 shrink-0 place-items-center bg-[#f0edf0] text-hub-purple"><UserRound size={17} aria-hidden="true" /></span><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{nameOf(user)}</p><p className="mt-1 truncate text-xs text-hub-muted">{ROLE_LABELS[user.application_role]} · {user.email || user.username}</p></div><button type="button" onClick={() => setEditing(user)} aria-label={`Edit ${nameOf(user)}`} className="grid size-9 place-items-center border border-hub-line"><Pencil size={15} aria-hidden="true" /></button></div>)}
        {visibleUsers.length === 0 && <p className="px-4 py-8 text-sm text-hub-muted">No matching accounts.</p>}
      </div>
    </section>
  )
}