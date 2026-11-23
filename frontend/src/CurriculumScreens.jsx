import { useState } from 'react'
import {
  ArrowLeft,
  BookOpen,
  Check,
  ChevronDown,
  CirclePlus,
  FileText,
  Link2,
  Plus,
  Save,
  Trash2,
} from 'lucide-react'

const VERSION_LABELS = {
  DRAFT: 'Draft',
  PUBLISHED: 'Published',
  ARCHIVED: 'Archived',
}

function displayDate(value) {
  if (!value) return 'Not published'
  return new Date(value).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

function textControl(extra = '') {
  return `min-h-10 w-full border border-hub-line bg-white px-3 text-sm text-hub-ink placeholder:text-hub-muted/80 focus:border-hub-purple focus:outline-none focus:ring-2 focus:ring-hub-purple/15 ${extra}`
}

function roleBranchName(branches, id) {
  return branches.find((branch) => branch.id === id)?.name ?? 'Unknown branch'
}

export function CurriculumManager({ curricula, versions, branches, user, busy, onCreate, onUpdate, onCreateVersion, onSaveVersion, onPublish }) {
  const [selectedId, setSelectedId] = useState(null)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')
  const selected = curricula.find((curriculum) => curriculum.id === selectedId)
  const selectedVersions = versions.filter((version) => version.curriculum === selectedId).toSorted((left, right) => right.version_number - left.version_number)
  const visibleBranches = user.application_role === 'SUPER_ADMIN'
    ? branches
    : branches.filter((branch) => branch.id === user.branch)

  async function createCurriculum(event) {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    setError('')
    try {
      const created = await onCreate({
        name: formData.get('name'),
        description: formData.get('description'),
        branch: Number(formData.get('branch')),
      })
      setSelectedId(created.id)
      setCreating(false)
    } catch (saveError) {
      setError(saveError.message)
    }
  }

  async function createVersion() {
    setError('')
    try {
      await onCreateVersion(selected.id, 'Branch update')
    } catch (saveError) {
      setError(saveError.message)
    }
  }

  async function saveCurriculum(event) {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    setError('')
    try {
      await onUpdate({
        id: selected.id,
        name: formData.get('name'),
        description: formData.get('description'),
        is_active: formData.get('is_active') === 'on',
      })
    } catch (saveError) {
      setError(saveError.message)
    }
  }

  async function saveDraft(versionId, input) {
    setError('')
    try {
      await onSaveVersion(selected.id, versionId, input)
    } catch (saveError) {
      setError(saveError.message)
      throw saveError
    }
  }

  async function publish(versionId) {
    setError('')
    try {
      await onPublish(selected.id, versionId)
    } catch (saveError) {
      setError(saveError.message)
      throw saveError
    }
  }

  if (selected) {
    const draftVersion = selectedVersions.find((version) => version.status === 'DRAFT')
    return (
      <section className="space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-hub-line pb-5">
          <div className="flex items-start gap-3">
            <button type="button" onClick={() => { setSelectedId(null); setError('') }} aria-label="Back to curricula" className="mt-1 grid size-9 shrink-0 place-items-center border border-hub-line bg-white hover:border-hub-purple hover:text-hub-purple"><ArrowLeft size={17} aria-hidden="true" /></button>
            <div className="min-w-0"><h1 className="break-words text-2xl font-semibold tracking-tight">{selected.name}</h1><p className="mt-1 text-sm text-hub-muted">{roleBranchName(branches, selected.branch)} · {selectedVersions.length} version{selectedVersions.length === 1 ? '' : 's'}</p></div>
          </div>
          {!draftVersion && <button type="button" disabled={busy} onClick={createVersion} className="inline-flex min-h-10 items-center gap-2 bg-hub-purple px-3 text-sm font-semibold text-white hover:bg-hub-purple-dark disabled:opacity-50"><CirclePlus size={16} aria-hidden="true" />Create next version</button>}
        </div>

        {error && <p role="alert" className="border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-900">{error}</p>}

        <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_300px]">
          <div className="min-w-0 space-y-6">
            <form onSubmit={saveCurriculum} className="space-y-4 border-y border-hub-line bg-white p-4 sm:p-5">
              <div className="flex items-center justify-between gap-3"><h2 className="text-sm font-semibold">Curriculum details</h2><label className="inline-flex items-center gap-2 text-xs font-medium"><input name="is_active" type="checkbox" defaultChecked={selected.is_active} className="size-4 accent-[#94007e]" />Active</label></div>
              <label className="block text-sm font-medium">Name<input name="name" required maxLength={180} defaultValue={selected.name} className={`${textControl()} mt-1.5`} /></label>
              <label className="block text-sm font-medium">Description<textarea name="description" rows={2} defaultValue={selected.description} className={`${textControl('py-2.5')} mt-1.5 resize-y`} /></label>
              <div className="flex justify-end"><button type="submit" disabled={busy} className="inline-flex min-h-9 items-center gap-2 border border-hub-line bg-white px-3 text-sm font-semibold hover:border-hub-purple disabled:opacity-50"><Save size={15} aria-hidden="true" />Save details</button></div>
            </form>

            {draftVersion ? (
              <>
                <CurriculumVersionEditor key={draftVersion.id} version={draftVersion} busy={busy} onSave={saveDraft} onPublish={publish} />
                <section className="space-y-3">
                  <h2 className="text-sm font-semibold">Previously published</h2>
                  {selectedVersions.filter((version) => version.status === 'PUBLISHED').map((version) => <PublishedVersion key={version.id} version={version} />)}
                </section>
              </>
            ) : (
              <section className="space-y-3">
                <h2 className="text-sm font-semibold">Published learning structure</h2>
                {selectedVersions.filter((version) => version.status === 'PUBLISHED').map((version) => (
                  <PublishedVersion key={version.id} version={version} />
                ))}
                {!selectedVersions.some((version) => version.status === 'PUBLISHED') && <p className="border-y border-hub-line bg-white px-4 py-8 text-sm text-hub-muted">This curriculum has no published version yet. Create a draft to define its learning structure.</p>}
              </section>
            )}
          </div>

          <aside className="space-y-4">
            <section className="border-y border-hub-line bg-white p-4">
              <h2 className="text-sm font-semibold">Version history</h2>
              <ol className="mt-3 divide-y divide-hub-line">
                {selectedVersions.map((version) => (
                  <li key={version.id} className="flex items-start justify-between gap-3 py-3 first:pt-0 last:pb-0">
                    <span><span className="block text-sm font-semibold">Version {version.version_number}</span><span className="mt-1 block text-xs text-hub-muted">{version.change_note || 'No change note'}</span><span className="mt-1 block text-xs text-hub-muted">{displayDate(version.published_at)}</span></span>
                    <span className={`shrink-0 px-2 py-1 text-[10px] font-bold uppercase ${version.status === 'PUBLISHED' ? 'bg-hub-ink text-white' : version.status === 'DRAFT' ? 'bg-hub-yellow text-hub-ink' : 'bg-stone-100 text-stone-700'}`}>{VERSION_LABELS[version.status]}</span>
                  </li>
                ))}
              </ol>
            </section>
            <p className="text-xs leading-5 text-hub-muted">Published versions cannot be edited. Create a new draft for future changes. Cohorts marked Ready keep their own frozen copy.</p>
          </aside>
        </div>
      </section>
    )
  }

  return (
    <section className="space-y-5">
      <div className="flex flex-col justify-between gap-4 border-b border-hub-line pb-5 sm:flex-row sm:items-end">
        <div><h1 className="text-2xl font-semibold tracking-tight">Curricula</h1><p className="mt-1 text-sm text-hub-muted">Branch-owned learning plans and published versions</p></div>
        {!creating && <button type="button" onClick={() => { setCreating(true); setError('') }} className="inline-flex min-h-11 items-center justify-center gap-2 bg-hub-purple px-4 text-sm font-semibold text-white hover:bg-hub-purple-dark"><Plus size={17} aria-hidden="true" />New curriculum</button>}
      </div>

      {error && <p role="alert" className="border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-900">{error}</p>}

      {creating && (
        <form onSubmit={createCurriculum} className="space-y-4 border-y border-hub-line bg-white p-4 sm:p-5">
          <div className="flex items-start justify-between gap-4"><div><h2 className="font-semibold">Create curriculum</h2><p className="mt-1 text-xs text-hub-muted">A draft version will be created for this branch.</p></div><button type="button" onClick={() => setCreating(false)} className="px-2 py-1 text-sm font-semibold text-hub-muted">Close</button></div>
          {user.application_role === 'SUPER_ADMIN' && <label className="block text-sm font-medium">Branch<select name="branch" required className={`${textControl()} mt-1.5`}>{visibleBranches.filter((branch) => branch.is_active).map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}</select></label>}
          <label className="block text-sm font-medium">Curriculum name<input name="name" required maxLength={180} placeholder="e.g. Membership Foundations" className={`${textControl()} mt-1.5`} /></label>
          <label className="block text-sm font-medium">Description<textarea name="description" rows={2} placeholder="What does this learning plan cover?" className={`${textControl('py-2.5')} mt-1.5 resize-y`} /></label>
          <div className="flex justify-end"><button type="submit" disabled={busy} className="inline-flex min-h-10 items-center gap-2 bg-hub-ink px-4 text-sm font-semibold text-white hover:bg-neutral-700 disabled:opacity-50"><Check size={16} aria-hidden="true" />Create curriculum</button></div>
        </form>
      )}

      <div className="hidden overflow-x-auto border border-hub-line bg-white md:block">
        <table className="w-full min-w-[690px] table-fixed border-collapse text-left">
          <thead className="bg-hub-ink text-xs uppercase text-white"><tr><th className="w-[34%] px-4 py-3 font-semibold">Curriculum</th>{user.application_role === 'SUPER_ADMIN' && <th className="w-[24%] px-4 py-3 font-semibold">Branch</th>}<th className="w-[17%] px-4 py-3 font-semibold">Latest version</th><th className="w-[15%] px-4 py-3 font-semibold">Status</th><th className="w-[10%] px-4 py-3 text-right font-semibold">Open</th></tr></thead>
          <tbody>{curricula.map((curriculum, index) => {
            const versionsForCurriculum = versions.filter((version) => version.curriculum === curriculum.id)
            const latest = versionsForCurriculum.toSorted((left, right) => right.version_number - left.version_number)[0]
            return (
              <tr key={curriculum.id} className={`border-t border-hub-line ${index % 2 ? 'bg-[#fcfbfc]' : 'bg-white'}`}>
                <td className="px-4 py-3.5"><span className="block truncate text-sm font-semibold">{curriculum.name}</span><span className="mt-1 block truncate text-xs text-hub-muted">{curriculum.description || 'No description'}</span></td>
                {user.application_role === 'SUPER_ADMIN' && <td className="truncate px-4 py-3.5 text-sm text-hub-muted">{roleBranchName(branches, curriculum.branch)}</td>}
                <td className="px-4 py-3.5 text-sm tabular-nums">{latest ? `v${latest.version_number}` : 'No versions'}</td>
                <td className="px-4 py-3.5"><span className={`text-xs font-semibold ${curriculum.is_active ? 'text-emerald-800' : 'text-hub-muted'}`}>{curriculum.is_active ? 'Active' : 'Inactive'}</span></td>
                <td className="px-4 py-3.5 text-right"><button type="button" onClick={() => setSelectedId(curriculum.id)} className="min-h-9 px-2 text-sm font-semibold text-hub-purple hover:underline">Open</button></td>
              </tr>
            )
          })}</tbody>
        </table>
        {curricula.length === 0 && <p className="px-4 py-10 text-center text-sm text-hub-muted">No curricula in this branch yet.</p>}
      </div>

      <div className="divide-y divide-hub-line border-y border-hub-line bg-white md:hidden">
        {curricula.map((curriculum) => {
          const latest = versions.filter((version) => version.curriculum === curriculum.id).toSorted((left, right) => right.version_number - left.version_number)[0]
          return <button type="button" key={curriculum.id} onClick={() => setSelectedId(curriculum.id)} className="flex min-h-16 w-full items-center gap-3 px-3 py-3 text-left hover:bg-[#fbf8fc]"><BookOpen size={19} className="shrink-0 text-hub-purple" aria-hidden="true" /><span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{curriculum.name}</span><span className="mt-1 block text-xs text-hub-muted">{latest ? `Version ${latest.version_number} · ${VERSION_LABELS[latest.status]}` : 'No versions'}</span></span><ChevronDown className="-rotate-90 text-hub-muted" size={16} aria-hidden="true" /></button>
        })}
      </div>
    </section>
  )
}

function CurriculumVersionEditor({ version, busy, onSave, onPublish }) {
  const [changeNote, setChangeNote] = useState(version.change_note)
  const [topics, setTopics] = useState(() => structuredClone(version.topics))
  const [error, setError] = useState('')
  const published = version.status === 'PUBLISHED'

  function updateTopic(topicIndex, key, value) {
    setTopics((current) => current.map((topic, index) => index === topicIndex ? { ...topic, [key]: value } : topic))
  }

  function updateObjective(topicIndex, objectiveIndex, value) {
    setTopics((current) => current.map((topic, index) => index !== topicIndex ? topic : {
      ...topic,
      objectives: topic.objectives.map((objective, itemIndex) => itemIndex === objectiveIndex ? { ...objective, text: value } : objective),
    }))
  }

  function updateLesson(topicIndex, lessonIndex, key, value) {
    setTopics((current) => current.map((topic, index) => index !== topicIndex ? topic : {
      ...topic,
      lessons: topic.lessons.map((lesson, itemIndex) => itemIndex === lessonIndex ? { ...lesson, [key]: value } : lesson),
    }))
  }

  function updateMaterial(topicIndex, lessonIndex, materialIndex, key, value) {
    setTopics((current) => current.map((topic, index) => index !== topicIndex ? topic : {
      ...topic,
      lessons: topic.lessons.map((lesson, itemIndex) => itemIndex !== lessonIndex ? lesson : {
        ...lesson,
        materials: lesson.materials.map((material, resourceIndex) => resourceIndex === materialIndex ? { ...material, [key]: value } : material),
      }),
    }))
  }

  async function saveDraft() {
    setError('')
    try {
      await onSave(version.id, { change_note: changeNote, topics })
    } catch (saveError) {
      setError(saveError.message)
      throw saveError
    }
  }

  async function publishDraft() {
    setError('')
    try {
      await onSave(version.id, { change_note: changeNote, topics })
      await onPublish(version.id)
    } catch (saveError) {
      setError(saveError.message)
    }
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-hub-line pb-3">
        <div><h2 className="text-lg font-semibold">Version {version.version_number} · {VERSION_LABELS[version.status]}</h2><p className="mt-1 text-sm text-hub-muted">{published ? `Published ${displayDate(version.published_at)}` : 'Edit this draft, then publish it for cohort use.'}</p></div>
        {published && <span className="border border-hub-line bg-white px-2.5 py-1 text-xs font-semibold">Immutable</span>}
      </div>
      {error && <p role="alert" className="border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-900">{error}</p>}
      {!published && <label className="block text-sm font-medium">Change note<input value={changeNote} onChange={(event) => setChangeNote(event.target.value)} maxLength={240} placeholder="What changed in this version?" className={`${textControl()} mt-1.5`} /></label>}

      <div className="space-y-5">
        {!published && <div className="flex justify-end"><button type="button" onClick={() => setTopics((current) => [...current, { title: '', description: '', notes: '', objectives: [], lessons: [] }])} className="inline-flex min-h-9 items-center gap-2 text-sm font-semibold text-hub-purple hover:underline"><Plus size={16} aria-hidden="true" />Add topic</button></div>}
        {topics.map((topic, topicIndex) => (
          <article key={topic.id ?? topicIndex} className="border-y border-hub-line bg-white">
            <div className="flex items-start gap-3 border-b border-hub-line px-4 py-3">
              <span className="mt-2 size-2 shrink-0 bg-hub-purple" aria-hidden="true" />
              <div className="min-w-0 flex-1 space-y-3 py-1">
                <input aria-label={`Topic ${topicIndex + 1} title`} disabled={published} value={topic.title} onChange={(event) => updateTopic(topicIndex, 'title', event.target.value)} placeholder="Topic title" className="w-full border-0 border-b border-transparent px-0 py-1 text-base font-semibold focus:border-hub-purple focus:outline-none disabled:bg-transparent disabled:text-hub-ink" />
                <textarea aria-label={`Topic ${topicIndex + 1} description`} disabled={published} rows={2} value={topic.description} onChange={(event) => updateTopic(topicIndex, 'description', event.target.value)} placeholder="Topic description" className="w-full resize-y border-0 px-0 py-1 text-sm leading-6 text-hub-muted focus:outline-none disabled:bg-transparent" />
                {!published && <textarea aria-label={`Topic ${topicIndex + 1} branch notes`} disabled={published} rows={2} value={topic.notes} onChange={(event) => updateTopic(topicIndex, 'notes', event.target.value)} placeholder="Branch facilitator notes" className="w-full resize-y border border-hub-line px-2.5 py-2 text-sm focus:border-hub-purple focus:outline-none" />}
              </div>
              {!published && <button type="button" onClick={() => setTopics((current) => current.filter((_, index) => index !== topicIndex))} aria-label={`Remove topic ${topicIndex + 1}`} className="grid size-9 shrink-0 place-items-center text-hub-muted hover:bg-red-50 hover:text-red-800"><Trash2 size={16} aria-hidden="true" /></button>}
            </div>

            <div className="grid gap-6 px-4 py-4 xl:grid-cols-2">
              <section className="space-y-3">
                <div className="flex items-center justify-between gap-3"><h3 className="text-xs font-bold uppercase text-hub-muted">Objectives</h3>{!published && <button type="button" onClick={() => updateTopic(topicIndex, 'objectives', [...(topic.objectives ?? []), { text: '' }])} className="inline-flex min-h-8 items-center gap-1 text-xs font-semibold text-hub-purple"><Plus size={14} aria-hidden="true" />Add objective</button>}</div>
                {(topic.objectives ?? []).map((objective, objectiveIndex) => <div key={objective.id ?? objectiveIndex} className="flex items-center gap-2"><input disabled={published} aria-label={`Topic ${topicIndex + 1} objective ${objectiveIndex + 1}`} value={objective.text} onChange={(event) => updateObjective(topicIndex, objectiveIndex, event.target.value)} placeholder="Students will be able to…" className={`${textControl('min-h-9')} disabled:bg-[#f4f2f4]`} />{!published && <button type="button" aria-label={`Remove objective ${objectiveIndex + 1}`} onClick={() => updateTopic(topicIndex, 'objectives', topic.objectives.filter((_, index) => index !== objectiveIndex))} className="grid size-8 shrink-0 place-items-center text-hub-muted hover:text-red-800"><Trash2 size={14} aria-hidden="true" /></button>}</div>)}
                {topic.objectives?.length === 0 && <p className="text-xs text-hub-muted">No learning objectives added.</p>}
              </section>

              <section className="space-y-3">
                <div className="flex items-center justify-between gap-3"><h3 className="text-xs font-bold uppercase text-hub-muted">Lessons</h3>{!published && <button type="button" onClick={() => updateTopic(topicIndex, 'lessons', [...(topic.lessons ?? []), { title: '', description: '', notes: '', materials: [] }])} className="inline-flex min-h-8 items-center gap-1 text-xs font-semibold text-hub-purple"><Plus size={14} aria-hidden="true" />Add lesson</button>}</div>
                {(topic.lessons ?? []).map((lesson, lessonIndex) => (
                  <div key={lesson.id ?? lessonIndex} className="border-t border-hub-line pt-3 first:border-t-0 first:pt-0">
                    <div className="flex items-center gap-2"><input disabled={published} aria-label={`Topic ${topicIndex + 1} lesson ${lessonIndex + 1} title`} value={lesson.title} onChange={(event) => updateLesson(topicIndex, lessonIndex, 'title', event.target.value)} placeholder="Lesson title" className={`${textControl('min-h-9 font-semibold')} disabled:bg-[#f4f2f4]`} />{!published && <button type="button" aria-label={`Remove lesson ${lessonIndex + 1}`} onClick={() => updateTopic(topicIndex, 'lessons', topic.lessons.filter((_, index) => index !== lessonIndex))} className="grid size-8 shrink-0 place-items-center text-hub-muted hover:text-red-800"><Trash2 size={14} aria-hidden="true" /></button>}</div>
                    <textarea disabled={published} aria-label={`Topic ${topicIndex + 1} lesson ${lessonIndex + 1} description`} rows={2} value={lesson.description} onChange={(event) => updateLesson(topicIndex, lessonIndex, 'description', event.target.value)} placeholder="Lesson description" className="mt-2 w-full resize-y border border-hub-line px-2.5 py-2 text-sm focus:border-hub-purple focus:outline-none disabled:bg-[#f4f2f4]" />
                    {!published && <textarea disabled={published} aria-label={`Topic ${topicIndex + 1} lesson ${lessonIndex + 1} notes`} rows={2} value={lesson.notes} onChange={(event) => updateLesson(topicIndex, lessonIndex, 'notes', event.target.value)} placeholder="Branch lesson notes" className="mt-2 w-full resize-y border border-hub-line px-2.5 py-2 text-sm focus:border-hub-purple focus:outline-none" />}
                    <div className="mt-3 space-y-2">
                      {(lesson.materials ?? []).map((material, materialIndex) => (
                        <div key={material.id ?? materialIndex} className="grid gap-2 border-l-2 border-hub-line pl-3 sm:grid-cols-2">
                          <label className="block text-[11px] font-semibold text-hub-muted">Material title<input disabled={published} value={material.title} onChange={(event) => updateMaterial(topicIndex, lessonIndex, materialIndex, 'title', event.target.value)} placeholder="Reading guide" className={`${textControl('min-h-9 mt-1')} text-xs disabled:bg-[#f4f2f4]`} /></label>
                          <label className="block text-[11px] font-semibold text-hub-muted">External link<input disabled={published} type="url" value={material.url} onChange={(event) => updateMaterial(topicIndex, lessonIndex, materialIndex, 'url', event.target.value)} placeholder="https://…" className={`${textControl('min-h-9 mt-1')} text-xs disabled:bg-[#f4f2f4]`} /></label>
                          <label className="block text-[11px] font-semibold text-hub-muted">Type<select disabled={published} value={material.material_type || 'OTHER'} onChange={(event) => updateMaterial(topicIndex, lessonIndex, materialIndex, 'material_type', event.target.value)} className={`${textControl('min-h-9 mt-1')} text-xs disabled:bg-[#f4f2f4]`}><option value="ARTICLE">Article</option><option value="VIDEO">Video</option><option value="DOCUMENT">Document</option><option value="OTHER">Other</option></select></label>
                          <label className="block text-[11px] font-semibold text-hub-muted">Description<input disabled={published} value={material.description ?? ''} onChange={(event) => updateMaterial(topicIndex, lessonIndex, materialIndex, 'description', event.target.value)} placeholder="Optional context" className={`${textControl('min-h-9 mt-1')} text-xs disabled:bg-[#f4f2f4]`} /></label>
                          {!published && <button type="button" aria-label={`Remove material ${materialIndex + 1}`} onClick={() => updateLesson(topicIndex, lessonIndex, 'materials', lesson.materials.filter((_, index) => index !== materialIndex))} className="mt-4 grid size-8 place-items-center text-hub-muted hover:text-red-800"><Trash2 size={14} aria-hidden="true" /></button>}
                        </div>
                      ))}
                      {!published && <button type="button" onClick={() => updateLesson(topicIndex, lessonIndex, 'materials', [...lesson.materials, { title: '', url: '', material_type: 'OTHER', description: '' }])} className="inline-flex min-h-8 items-center gap-1 text-xs font-semibold text-hub-purple"><Link2 size={14} aria-hidden="true" />Add external material</button>}
                    </div>
                  </div>
                ))}
                {topic.lessons?.length === 0 && <p className="text-xs text-hub-muted">No lessons added.</p>}
              </section>
            </div>
          </article>
        ))}
        {topics.length === 0 && <p className="border-y border-hub-line bg-white px-4 py-8 text-sm text-hub-muted">Add a topic to define what this curriculum teaches.</p>}
      </div>

      {!published && (
        <div className="sticky bottom-0 z-10 -mx-4 flex flex-wrap items-center justify-between gap-3 border-t border-hub-line bg-[#f5f3f6]/95 px-4 py-3 backdrop-blur-sm sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
          <p className="text-xs text-hub-muted">{topics.length} topic{topics.length === 1 ? '' : 's'} · draft changes are editable until published</p>
          <div className="flex gap-2"><button type="button" disabled={busy} onClick={saveDraft} className="inline-flex min-h-10 items-center gap-2 border border-hub-line bg-white px-3 text-sm font-semibold hover:border-hub-purple disabled:opacity-50"><Save size={15} aria-hidden="true" />Save draft</button><button type="button" disabled={busy || topics.length === 0} onClick={publishDraft} className="inline-flex min-h-10 items-center gap-2 bg-hub-purple px-4 text-sm font-semibold text-white hover:bg-hub-purple-dark disabled:cursor-not-allowed disabled:opacity-45"><Check size={16} aria-hidden="true" />Publish version</button></div>
        </div>
      )}
    </section>
  )
}

function PublishedVersion({ version }) {
  return (
    <article className="border-y border-hub-line bg-white">
      <div className="flex items-center justify-between gap-3 border-b border-hub-line px-4 py-3"><h3 className="text-sm font-semibold">Version {version.version_number}</h3><span className="bg-hub-ink px-2 py-1 text-[10px] font-bold uppercase text-white">Published</span></div>
      <ol className="divide-y divide-hub-line">
        {version.topics.map((topic) => <li key={topic.id} className="px-4 py-3"><h4 className="text-sm font-semibold">{topic.title}</h4>{topic.description && <p className="mt-1 text-sm leading-5 text-hub-muted">{topic.description}</p>}<ul className="mt-2 space-y-1">{topic.objectives.map((objective) => <li key={objective.id} className="text-xs text-hub-muted">Objective: {objective.text}</li>)}{topic.lessons.map((lesson) => <li key={lesson.id} className="flex items-start gap-2 text-xs text-hub-ink"><FileText size={14} className="mt-0.5 shrink-0 text-hub-purple" aria-hidden="true" /><span>{lesson.title}{lesson.materials.length > 0 && <span className="ml-2 text-hub-muted">{lesson.materials.length} link{lesson.materials.length === 1 ? '' : 's'}</span>}</span></li>)}</ul></li>)}
      </ol>
    </article>
  )
}