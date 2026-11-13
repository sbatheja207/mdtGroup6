import { useEffect, useRef, useState } from 'react';
import { ArrowRight, ArrowLeft, Check, ShieldCheck, Upload, FileText, CreditCard, X, Leaf, LayoutDashboard, MessageCircle, Calculator, ReceiptText, LockKeyhole, ChevronRight, CircleHelp, Trash2, Pencil, CheckCircle2, LoaderCircle } from 'lucide-react';
import { demoDetails, emptyDetails, suggestDetails, validateDetails, type PlanDetails, type PlanDocument, type PlanProfile } from './lib/plan';
import { deleteProfile, loadProfile, saveProfile } from './lib/storage';
import { extractDocument, MAX_FILES, validateFile } from './lib/extract';

type Page = 'plan' | 'chat' | 'cost' | 'bill';
const fields: { key: keyof PlanDetails; label: string; placeholder?: string; help?: string; type?: string; required?: boolean }[] = [
  { key: 'insurer', label: 'Insurance company', placeholder: 'e.g. Aetna, Blue Cross Blue Shield', required: true },
  { key: 'planName', label: 'Plan name', placeholder: 'e.g. Student Health Insurance Plan' },
  { key: 'memberName', label: 'Name on the card', placeholder: 'As printed on your insurance card' },
  { key: 'memberId', label: 'Member ID', placeholder: 'Include any letters and leading zeros', required: true, help: 'Sometimes labeled subscriber ID or identification number.' },
  { key: 'groupNumber', label: 'Group number', placeholder: 'If shown on your card', help: 'Not every plan has one. You can leave this blank.' },
  { key: 'policyNumber', label: 'Policy number', placeholder: 'If different from your member ID' },
  { key: 'network', label: 'Provider network', placeholder: 'e.g. Preferred Provider Network' },
  { key: 'effectiveDate', label: 'Coverage starts', type: 'date' },
  { key: 'endDate', label: 'Coverage ends', type: 'date' },
];
const modules = [
  { page: 'chat' as Page, icon: MessageCircle, title: 'Ask about your plan', description: 'Plain-language answers, grounded in your plan documents.', tag: 'BEFORE CARE', owner: 'Samhitha' },
  { page: 'cost' as Page, icon: Calculator, title: 'Plan for the cost', description: 'Explore estimated costs for a procedure and location.', tag: 'BEFORE CARE', owner: 'Autumn' },
  { page: 'bill' as Page, icon: ReceiptText, title: 'Make sense of a bill', description: 'Understand your charges and what to ask next.', tag: 'DURING & AFTER CARE', owner: 'Mason' },
];
export default function App() {
  const [page, setPage] = useState<Page>('plan');
  const [step, setStep] = useState(0);
  const [details, setDetails] = useState<PlanDetails>({ ...emptyDetails });
  const [documents, setDocuments] = useState<PlanDocument[]>([]);
  const [profile, setProfile] = useState<PlanProfile>();
  const [editing, setEditing] = useState(true);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState('');
  const [error, setError] = useState('');
  const [consent, setConsent] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const [kind, setKind] = useState<PlanDocument['kind']>('card');
  const contentRef = useRef<HTMLElement>(null);
  useEffect(() => { loadProfile().then(p => { if (p) { setProfile(p); setDetails(p.details); setDocuments(p.documents); setEditing(false); } }).catch(() => setError('Browser storage is unavailable. You can review a plan, but saving may not work.')).finally(() => setLoading(false)); }, []);
  const navigate = (p: Page) => { setPage(p); setError(''); };
  const go = (n: number) => { setStep(n); setError(''); requestAnimationFrame(() => contentRef.current?.focus()); };
  async function addFiles(files: File[]) {
    if (busy || loading) return;
    setError('');
    if (files.length + documents.length > MAX_FILES) { setError('You can add up to six documents. Remove one before adding more.'); return; }
    const invalid = files.map(validateFile).filter(Boolean);
    if (invalid.length) { setError(invalid.join(' ')); return; }
    setBusy(true);
    try {
      const results: PlanDocument[] = [];
      for (const file of files) results.push(await extractDocument(file, kind, setProgress));
      setDocuments(prev => [...prev, ...results]);
      // Suggestions only fill blank fields. Users must review every field before saving.
      const suggestions = suggestDetails(results.map(d => d.text).join('\n'));
      setDetails(prev => { const next = { ...prev }; for (const key of Object.keys(suggestions) as (keyof PlanDetails)[]) if (!next[key]) next[key] = suggestions[key]!; return next; });
    } finally { setBusy(false); setProgress(''); if (fileInput.current) fileInput.current.value = ''; }
  }
  function sample() {
    const text = 'FICTIONAL DEMO — NOT INSURANCE\nInsurer: Example Health (fictional)\nPlan name: Campus Care Plus\nMember name: Alex Morgan\nMember ID: DEMO123456\nGroup number: DEMO006\nPolicy number: DEMO2026\nNo benefits or coverage are represented by this sample.';
    setDetails({ ...demoDetails });
    setDocuments([{ id: crypto.randomUUID(), name: 'fictional-demo-plan.txt', kind: 'plan', mime: 'text/plain', size: text.length, blob: new Blob([text], { type: 'text/plain' }), text, status: 'ready' }]);
    setConsent(false); go(1);
  }
  async function save() {
    const invalid = validateDetails(details);
    if (invalid) { setError(invalid); return; }
    if (!consent) { setError('Please confirm you have reviewed the details and understand local storage.'); return; }
    setBusy(true); setError('');
    const p: PlanProfile = { schemaVersion: 1, id: profile?.id ?? crypto.randomUUID(), updatedAt: new Date().toISOString(), details: Object.fromEntries(Object.entries(details).map(([k,v]) => [k, v.trim()])) as PlanDetails, documents, reviewed: true, coverageVerified: false };
    try { await saveProfile(p); setProfile(p); setEditing(false); setConsent(false); }
    catch { setError('Your plan could not be saved. Browser storage may be full or blocked. Remove large documents and try again.'); }
    finally { setBusy(false); }
  }
  async function clear() {
    setBusy(true);
    try { await deleteProfile(); setProfile(undefined); setDetails({ ...emptyDetails }); setDocuments([]); setEditing(true); setStep(0); setConsent(false); setConfirmDelete(false); setError(''); }
    catch { setError('Could not delete the saved plan. Please try again.'); }
    finally { setBusy(false); }
  }
  const selectedModule = modules.find(m => m.page === page);
  return <div className="app-shell">
    <aside className="sidebar">
      <a className="brand" href="#" onClick={e => { e.preventDefault(); navigate('plan'); }}><span className="brand-symbol"><Leaf size={23}/></span>ClearCover<span className="brand-dot">.</span></a>
      <span className="workspace-label">YOUR CARE, A LITTLE CLEARER</span>
      <nav aria-label="Main navigation">
        <button className={page === 'plan' ? 'nav-item active' : 'nav-item'} onClick={() => navigate('plan')}><LayoutDashboard size={19}/>My insurance<ChevronRight size={15}/></button>
        <p className="nav-label">BEFORE CARE</p>
        <button className={page === 'chat' ? 'nav-item active' : 'nav-item'} onClick={() => navigate('chat')}><MessageCircle size={19}/>Ask my plan<span className="soon-dot"/></button>
        <button className={page === 'cost' ? 'nav-item active' : 'nav-item'} onClick={() => navigate('cost')}><Calculator size={19}/>Estimate a cost<span className="soon-dot"/></button>
        <p className="nav-label">DURING & AFTER CARE</p>
        <button className={page === 'bill' ? 'nav-item active' : 'nav-item'} onClick={() => navigate('bill')}><ReceiptText size={19}/>Understand a bill<span className="soon-dot"/></button>
      </nav>
      <div className="sidebar-note"><div className="small-leaf"><Leaf size={20}/></div><h3>One step at a time.</h3><p>You don’t need to know all the insurance terms. We’ll start with what’s on your card.</p></div>
      <button className="help-link" onClick={() => setShowHelp(true)}><CircleHelp size={18}/>Help & privacy</button>
      <div className="project-label"><span>6</span><div>Group 6 Project<small>Student prototype</small></div></div>
    </aside>
    <div className="main-shell">
      <header className="topbar"><span>My care workspace <span className="slash">/</span> <strong>{selectedModule?.title ?? 'My insurance'}</strong></span><span className="demo-badge"><span/> Demo workspace</span></header>
      <main ref={contentRef} tabIndex={-1}>
        <div className="intro"><div><div className="eyebrow">LESS GUESSWORK. MORE PEACE OF MIND.</div><h1>{selectedModule ? selectedModule.title : profile && !editing ? 'Your plan, in one place.' : 'Let’s get to know your plan.'}</h1><p>{selectedModule ? selectedModule.description : 'A clearer picture of your coverage starts with a few simple details.'}</p></div><div className="intro-art" aria-hidden="true"><div className="art-orbit"/><div className="art-card"><ShieldCheck size={27}/><span/><span/></div><div className="art-check"><Check size={17}/></div></div></div>
        <div className="prototype-note"><LockKeyhole size={16}/><span><strong>A practice space for now.</strong> Use fictional information only. This prototype saves data in this browser; it isn’t ready for real patient information.</span></div>
        {error && <div role="alert" className="error">{error}</div>}
        {loading ? <div className="panel loading">Loading your workspace…</div> : selectedModule ? <section className="panel coming-soon"><selectedModule.icon size={36}/><span className="pill">IN DEVELOPMENT</span><h2>A little more clarity is on the way.</h2><p>{selectedModule.description} This tool is not connected yet.</p><div className="context-note">{profile ? `Your reviewed ${profile.details.insurer} profile is ready for the team’s integration.` : 'Start by adding your insurance. Your plan profile will provide context for this tool.'}</div><button className="primary" onClick={() => navigate('plan')}>Back to my insurance<ArrowRight size={17}/></button></section> : !editing && profile ? <>
          <section className="panel saved-panel"><div className="section-heading"><div><div className="eyebrow">YOUR INSURANCE PROFILE</div><h2>{profile.details.insurer}</h2><p>{profile.details.planName || 'Plan name not provided'}</p></div><span className="saved-badge"><CheckCircle2 size={16}/>Saved on this browser</span></div><div className="summary-grid">{fields.filter(f => profile.details[f.key]).map(f => <div key={f.key}><span>{f.label}</span><strong>{f.key === 'memberId' || f.key === 'policyNumber' ? `•••• ${profile.details[f.key].slice(-4)}` : profile.details[f.key]}</strong></div>)}</div><div className="context-note"><FileText size={18}/>{profile.documents.length} document(s) saved. Details reviewed by you; coverage has not been verified.</div><div className="button-row"><button className="secondary" onClick={() => { setEditing(true); go(1); }}><Pencil size={16}/>Edit plan</button><button className="text-button danger" onClick={() => setConfirmDelete(true)}><Trash2 size={16}/>Delete local plan</button></div></section>
        </> : <div className="intake-layout"><section className="panel intake-panel"><ol className="steps" aria-label="Intake progress">{['Add documents', 'Plan details', 'Review & save'].map((s, i) => <li key={s} className={step === i ? 'current' : step > i ? 'done' : ''} aria-current={step === i ? 'step' : undefined}><span>{step > i ? <Check size={14}/> : `0${i + 1}`}</span>{s}</li>)}</ol>
          {step === 0 && <div className="step-content"><div className="section-heading"><div><h2>A good place to start.</h2><p>Add your insurance card and any plan documents you have.</p></div><span className="pill">STEP 01</span></div><div className="upload-types"><button disabled={busy} className={kind === 'card' ? 'type-option selected' : 'type-option'} onClick={() => setKind('card')}><CreditCard size={21}/><span>Insurance card<small>Front and back images</small></span>{kind === 'card' && <CheckCircle2 size={17}/>}</button><button disabled={busy} className={kind === 'plan' ? 'type-option selected' : 'type-option'} onClick={() => setKind('plan')}><FileText size={21}/><span>Plan documents<small>Benefits, policy, or SHIP plan</small></span>{kind === 'plan' && <CheckCircle2 size={17}/>}</button></div>
          <div className={'dropzone' + (busy ? ' busy' : '')} onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); void addFiles(Array.from(e.dataTransfer.files)); }}><div className="upload-icon">{busy ? <LoaderCircle className="spin" size={24}/> : <Upload size={24}/>}</div><h3>{busy ? 'Finding the details…' : 'Drop your documents here'}</h3><p>{busy ? progress : <>or <button className="inline-button" onClick={() => fileInput.current?.click()}>browse files</button> to choose from your device</>}</p><small>PDF, JPG, or PNG · Up to 10 MB each · 6 files max</small><input ref={fileInput} type="file" aria-label="Upload insurance documents" accept="application/pdf,image/jpeg,image/png" multiple hidden disabled={busy} onChange={e => void addFiles(Array.from(e.target.files ?? []))}/></div>
          <p className="file-note"><LockKeyhole size={14}/>Files are read on your device. OCR downloads supporting language files.</p>
          <DocumentList documents={documents} disabled={busy} remove={id => setDocuments(prev => prev.filter(d => d.id !== id))}/>
          <div className="sample-row"><span>Just looking around?</span><button className="inline-button" disabled={busy} onClick={sample}>Try a sample plan <ArrowRight size={14}/></button></div>
          <div className="step-footer"><button className="text-button" disabled={busy} onClick={() => go(1)}>Enter details manually</button><button className="primary" disabled={busy} onClick={() => go(1)}>Continue<ArrowRight size={17}/></button></div></div>}
          {step === 1 && <form className="step-content" onSubmit={e => { e.preventDefault(); const invalid = validateDetails(details); if (invalid) setError(invalid); else go(2); }}><div className="section-heading"><div><h2>The details that matter.</h2><p>Check any suggested details against your card. Fields marked * are required.</p></div></div><div className="fields">{fields.map(f => <label key={f.key}>{f.label}{f.required ? ' *' : ''}<input value={details[f.key]} type={f.type ?? 'text'} required={f.required} maxLength={150} placeholder={f.placeholder} autoComplete="off" onChange={e => setDetails(prev => ({ ...prev, [f.key]: e.target.value }))}/>{f.help && <small>{f.help}</small>}</label>)}<label>Plan type<select value={details.planType} onChange={e => setDetails(prev => ({ ...prev, planType: e.target.value }))}><option value="">I’m not sure</option>{['HMO', 'PPO', 'EPO', 'POS', 'HDHP', 'Other'].map(t => <option key={t}>{t}</option>)}</select></label></div><div className="context-note">These identifiers organize your profile. They do not automatically connect to an insurer or confirm coverage.</div><div className="step-footer"><button className="text-button" type="button" onClick={() => go(0)}><ArrowLeft size={16}/>Back</button><button className="primary" type="submit">Review details<ArrowRight size={17}/></button></div></form>}
          {step === 2 && <div className="step-content"><div className="section-heading"><div><h2>A quick check, then you’re set.</h2><p>Your review helps the next steps start with better context.</p></div><button className="text-button" onClick={() => go(1)}><Pencil size={16}/>Edit</button></div><div className="summary-grid">{[...fields, { key: 'planType' as const, label: 'Plan type' }].map(f => <div key={f.key}><span>{f.label}</span><strong>{details[f.key] || 'Not provided'}</strong></div>)}</div><h3 className="documents-title">Your documents ({documents.length})</h3>{documents.length ? <DocumentList documents={documents} disabled={busy}/> : <p className="muted">No documents added. You can add them later; the future AI tools will need plan documents for grounded answers.</p>}<label className="consent"><input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)}/><span>I reviewed these details and am using fictional data. I understand that this saves the profile and documents on this browser, where other people using this browser may access them.</span></label><div className="step-footer"><button className="text-button" disabled={busy} onClick={() => go(1)}><ArrowLeft size={16}/>Back</button><button className="primary" disabled={busy || !consent} onClick={() => void save()}>{busy ? 'Saving…' : 'Save my plan'}<Check size={17}/></button></div></div>}
          {profile && <button className="cancel-edit text-button" disabled={busy} onClick={() => { setDetails(profile.details); setDocuments(profile.documents); setEditing(false); setError(''); }}>Cancel changes</button>}
        </section><aside className="intake-aside"><div className="guidance"><span className="guide-icon"><Leaf size={23}/></span><h3>A few things to have handy</h3><ul><li><Check size={15}/><span>Your insurance card<small>Both sides help fill in the picture.</small></span></li><li><Check size={15}/><span>Your plan’s benefits summary<small>Look for “Summary of Benefits and Coverage.”</small></span></li><li><Check size={15}/><span>Any policy or student plan docs<small>A SHIP plan document works, too.</small></span></li></ul><div className="guide-bottom">Don’t have everything?<br/><strong>Start with what you know.</strong><p>You can add more details later.</p></div></div><div className="trust-note"><ShieldCheck size={22}/><div><strong>You stay in control</strong><p>Nothing is sent to an AI service. Save only when you’re ready, and delete your local plan anytime.</p></div></div></aside></div>}
        {page === 'plan' && <section className="next-section"><div className="next-heading"><h2>A little clarity at every step.</h2><span>COMING NEXT</span></div><div className="module-grid">{modules.map(m => <button className="module-card" key={m.page} onClick={() => navigate(m.page)}><div className="module-top"><m.icon size={21}/><span>{m.tag}</span></div><h3>{m.title}<ArrowRight size={17}/></h3><p>{m.description}</p></button>)}</div></section>}
        <footer><span>ClearCover · Made for a more understandable healthcare journey.</span><button onClick={() => setShowHelp(true)}>About this prototype</button></footer>
      </main>
    </div>
    {showHelp && <Modal title="A clearer start, with you in control" close={() => setShowHelp(false)}><p>ClearCover is a Group 6 student prototype. Use fictional data only.</p><p>Card images are read using English OCR. PDFs with text are read directly; scanned PDFs need a future OCR integration. Review all suggested fields.</p><p>Saving stores your profile, extracted text, and original documents in this browser’s IndexedDB. Storage is not encrypted by this app, does not sync across devices, and can disappear if browser data is cleared. Nothing is sent to an insurer or AI service.</p><p>Member IDs do not establish coverage. Chat, estimates, and bill analysis are planned features. This prototype does not provide medical advice or coverage guarantees.</p><button className="primary" onClick={() => setShowHelp(false)}>Got it<Check size={16}/></button></Modal>}
    {confirmDelete && <Modal title="Delete your local plan?" close={() => !busy && setConfirmDelete(false)}><p>This removes the saved profile, original files, and extracted text from this app’s browser storage. You’ll need to add them again.</p><div className="button-row"><button className="secondary" disabled={busy} onClick={() => setConfirmDelete(false)}>Keep plan</button><button className="primary destructive" disabled={busy} onClick={() => void clear()}>Delete plan</button></div></Modal>}
  </div>;
}
function DocumentList({ documents, disabled, remove }: { documents: PlanDocument[]; disabled: boolean; remove?: (id: string) => void }) {
  return <div className="document-list">{documents.map(d => <div className="document" key={d.id}><FileText size={20}/><div><strong>{d.name}</strong><small>{d.kind === 'card' ? 'Insurance card' : 'Plan document'} · {(d.size / 1024).toFixed(0)} KB · {d.status === 'ready' ? 'Text read — review needed' : 'Needs attention'}</small>{d.message && <p className="document-warning">{d.message}</p>}{d.text.trim() && <details><summary>View extracted text</summary><pre>{d.text}</pre></details>}</div>{remove && <button className="icon-button" aria-label={`Remove ${d.name}`} disabled={disabled} onClick={() => remove(d.id)}><X size={17}/></button>}</div>)}</div>;
}
function Modal({ title, close, children }: { title: string; close: () => void; children: React.ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { ref.current?.showModal(); }, []);
  return <dialog ref={ref} className="modal" aria-labelledby="modal-title" onCancel={e => { e.preventDefault(); close(); }}><button className="modal-close icon-button" aria-label="Close dialog" onClick={close}><X size={20}/></button><h2 id="modal-title">{title}</h2>{children}</dialog>;
}
