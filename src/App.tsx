import { useMemo, useState } from 'react'
import {
  Bell,
  BookOpen,
  Check,
  ChevronDown,
  CircleHelp,
  Clock3,
  LayoutDashboard,
  Menu,
  MoreHorizontal,
  Plus,
  Settings,
  Sparkles,
  Users,
  X,
} from 'lucide-react'

type TaskStatus = 'To do' | 'In progress' | 'Done'
type Task = {
  id: number
  title: string
  context: string
  effort: number
  status: TaskStatus
  assignee: string
  initials: string
  color: string
  blocked: boolean
}

const initialTasks: Task[] = [
  {
    id: 1,
    title: 'Set up project repository',
    context: 'Create the repo, add the README, and invite all team members.',
    effort: 2,
    status: 'Done',
    assignee: 'Aisha',
    initials: 'AR',
    color: 'coral',
    blocked: false,
  },
  {
    id: 2,
    title: 'Define user stories',
    context: 'Draft three user stories for the primary student workflow.',
    effort: 3,
    status: 'In progress',
    assignee: 'Yerassyl',
    initials: 'YM',
    color: 'purple',
    blocked: false,
  },
  {
    id: 3,
    title: 'Sketch the task allocation flow',
    context: 'Use the team notes to map inputs, suggestions, and approval states.',
    effort: 4,
    status: 'To do',
    assignee: 'Sezim',
    initials: 'SK',
    color: 'gold',
    blocked: true,
  },
  {
    id: 4,
    title: 'Review comparable tools',
    context: 'Capture what Trello and group chats do not support for this workflow.',
    effort: 2,
    status: 'To do',
    assignee: 'Suusar',
    initials: 'TS',
    color: 'blue',
    blocked: false,
  },
  {
    id: 5,
    title: 'Plan the first usability test',
    context: 'Prepare a task card and questions for two junior students.',
    effort: 3,
    status: 'To do',
    assignee: 'Yerassyl',
    initials: 'YM',
    color: 'purple',
    blocked: false,
  },
]

const statusOrder: TaskStatus[] = ['To do', 'In progress', 'Done']

function App() {
  const [tasks, setTasks] = useState(initialTasks)
  const [activeView, setActiveView] = useState('Overview')
  const [showAllocation, setShowAllocation] = useState(true)
  const [showNewTask, setShowNewTask] = useState(false)
  const [newTaskTitle, setNewTaskTitle] = useState('')
  const [approved, setApproved] = useState(false)

  const completed = tasks.filter((task) => task.status === 'Done').length
  const blocked = tasks.filter((task) => task.blocked).length
  const totalEffort = tasks.reduce((sum, task) => sum + task.effort, 0)
  const progress = Math.round((completed / tasks.length) * 100)

  const groupedTasks = useMemo(
    () =>
      statusOrder.map((status) => ({
        status,
        tasks: tasks.filter((task) => task.status === status),
      })),
    [tasks],
  )

  function toggleBlocked(id: number) {
    setTasks((current) =>
      current.map((task) => (task.id === id ? { ...task, blocked: !task.blocked } : task)),
    )
  }

  function addTask(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const title = newTaskTitle.trim()
    if (!title) return
    setTasks((current) => [
      ...current,
      {
        id: Date.now(),
        title,
        context: 'Add the first concrete step and expected deliverable for this task.',
        effort: 2,
        status: 'To do',
        assignee: 'Unassigned',
        initials: '?',
        color: 'neutral',
        blocked: false,
      },
    ])
    setNewTaskTitle('')
    setShowNewTask(false)
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">F</div>
          <span>fairshare</span>
        </div>
        <div className="workspace-switcher">
          <div className="workspace-icon">FS</div>
          <div>
            <strong>FairShare team</strong>
            <span>Student workspace</span>
          </div>
          <ChevronDown size={16} />
        </div>
        <nav className="main-nav" aria-label="Main navigation">
          <p className="nav-label">Workspace</p>
          {[
            { label: 'Overview', icon: LayoutDashboard },
            { label: 'My tasks', icon: Check },
            { label: 'Team', icon: Users },
          ].map(({ label, icon: Icon }) => (
            <button
              className={`nav-item ${activeView === label ? 'active' : ''}`}
              key={label}
              onClick={() => setActiveView(label)}
            >
              <Icon size={18} />
              {label}
              {label === 'My tasks' && <span className="nav-count">2</span>}
            </button>
          ))}
          <p className="nav-label projects-label">Projects</p>
          <button className="project-item active-project"><span className="project-dot green" /> Product vision</button>
          <button className="project-item"><span className="project-dot yellow" /> Research sprint</button>
        </nav>
        <div className="sidebar-bottom">
          <button className="nav-item"><CircleHelp size={18} /> Help center</button>
          <button className="nav-item"><Settings size={18} /> Settings</button>
          <div className="profile">
            <div className="avatar purple">YM</div>
            <div><strong>Yerassyl Murat</strong><span>Member</span></div>
            <MoreHorizontal size={17} />
          </div>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <button className="mobile-menu" aria-label="Open menu"><Menu size={20} /></button>
          <div className="breadcrumbs"><span>Projects</span><span>/</span><strong>Product vision</strong></div>
          <div className="topbar-actions">
            <button className="icon-button" aria-label="Notifications"><Bell size={19} /><span className="notification-dot" /></button>
            <div className="top-avatar purple">YM</div>
          </div>
        </header>

        <div className="page">
          <section className="page-heading">
            <div>
              <div className="eyebrow"><span className="status-dot" /> Active project</div>
              <h1>Product vision</h1>
              <p>Turn the product idea into a clear, shared direction.</p>
            </div>
            <button className="primary-button" onClick={() => setShowNewTask(true)}><Plus size={18} /> Add task</button>
          </section>

          {showAllocation && (
            <section className="allocation-card">
              <div className="sparkle"><Sparkles size={21} /></div>
              <div className="allocation-copy">
                <div className="allocation-title"><strong>Suggested allocation is ready</strong><span className="new-badge">NEW</span></div>
                <p>We balanced {totalEffort} estimated hours across your team&apos;s availability.</p>
                <button className="text-button" onClick={() => setShowAllocation(false)}>Review suggestion <span>→</span></button>
              </div>
              <button className="dismiss-button" onClick={() => setShowAllocation(false)} aria-label="Dismiss suggestion"><X size={18} /></button>
            </section>
          )}

          <section className="stats-grid">
            <div className="stat-card">
              <div className="stat-icon green-icon"><Check size={18} /></div>
              <div><span className="stat-label">Progress</span><strong>{progress}%</strong><small>{completed} of {tasks.length} tasks complete</small></div>
              <div className="progress-ring" style={{ '--progress': `${progress * 3.6}deg` } as React.CSSProperties}><span>{progress}%</span></div>
            </div>
            <div className="stat-card">
              <div className="stat-icon orange-icon"><Clock3 size={18} /></div>
              <div><span className="stat-label">Planned effort</span><strong>{totalEffort}h</strong><small>Across {tasks.length} tasks</small></div>
            </div>
            <div className="stat-card">
              <div className="stat-icon pink-icon"><CircleHelp size={18} /></div>
              <div><span className="stat-label">Needs attention</span><strong>{blocked}</strong><small>{blocked ? '1 task needs help' : 'All clear for now'}</small></div>
            </div>
          </section>

          <section className="board-section">
            <div className="section-heading">
              <div><h2>Project tasks</h2><span>{tasks.length} tasks · updated just now</span></div>
              <div className="board-actions"><button className="filter-button"><Users size={16} /> All members <ChevronDown size={15} /></button><button className="more-button" aria-label="More options"><MoreHorizontal size={19} /></button></div>
            </div>
            <div className="board">
              {groupedTasks.map(({ status, tasks: columnTasks }) => (
                <div className="column" key={status}>
                  <div className="column-heading"><div><span className={`column-dot ${status.toLowerCase().replace(' ', '-')}`} /><strong>{status}</strong><span className="task-count">{columnTasks.length}</span></div><button aria-label={`Add ${status} task`}><Plus size={17} /></button></div>
                  <div className="task-list">
                    {columnTasks.map((task) => (
                      <article className={`task-card ${task.blocked ? 'is-blocked' : ''}`} key={task.id}>
                        <div className="task-card-top"><span className={`effort-tag ${task.effort > 3 ? 'high' : ''}`}><Clock3 size={12} /> {task.effort}h</span>{task.blocked && <span className="blocked-tag">Needs help</span>}<button className="task-more" aria-label={`Options for ${task.title}`}><MoreHorizontal size={16} /></button></div>
                        <h3>{task.title}</h3>
                        <p>{task.context}</p>
                        <div className="task-footer"><div className={`avatar small ${task.color}`}>{task.initials}</div><span>{task.assignee}</span>{task.status !== 'Done' && <button className={`help-button ${task.blocked ? 'active' : ''}`} onClick={() => toggleBlocked(task.id)}>{task.blocked ? 'Help requested' : 'Need help?'}</button>}</div>
                      </article>
                    ))}
                    {columnTasks.length === 0 && <div className="empty-column">No tasks here yet</div>}
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="team-strip">
            <div><h2>Team capacity</h2><p>Planned effort compared with declared availability.</p></div>
            <div className="member-capacity">
              {[['YM', 'Yerassyl', '7h', '8h', 'purple'], ['TS', 'Suusar', '3h', '6h', 'blue'], ['SK', 'Sezim', '4h', '6h', 'gold'], ['AR', 'Aisha', '2h', '4h', 'coral']].map(([initials, name, planned, available, color]) => (
                <div className="capacity-member" key={name}><div className={`avatar small ${color}`}>{initials}</div><div><strong>{name}</strong><span>{planned} planned <em>/ {available} available</em></span></div></div>
              ))}
            </div>
          </section>
        </div>
      </main>

      {showNewTask && (
        <div className="modal-backdrop" onClick={() => setShowNewTask(false)}>
          <form className="modal" onSubmit={addTask} onClick={(event) => event.stopPropagation()}>
            <div className="modal-heading"><div><span className="eyebrow">New task</span><h2>Add to product vision</h2></div><button type="button" className="dismiss-button" onClick={() => setShowNewTask(false)}><X size={18} /></button></div>
            <label htmlFor="task-title">Task name</label><input id="task-title" autoFocus value={newTaskTitle} onChange={(event) => setNewTaskTitle(event.target.value)} placeholder="e.g. Interview two students" />
            <p className="modal-hint"><BookOpen size={15} /> You can add context and assign the task after creating it.</p>
            <div className="modal-actions"><button type="button" className="secondary-button" onClick={() => setShowNewTask(false)}>Cancel</button><button className="primary-button" type="submit">Create task</button></div>
          </form>
        </div>
      )}
      {approved && <div className="toast"><Check size={16} /> Allocation approved and shared with the team.</div>}
      {!approved && showAllocation && <button className="floating-approval" onClick={() => { setApproved(true); setShowAllocation(false) }}>Approve allocation</button>}
    </div>
  )
}

export default App
