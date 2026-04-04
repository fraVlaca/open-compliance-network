import { useEffect } from 'react'
import { toast } from 'sonner'
import { useLayoutEditor } from '../context/LayoutEditorContext'

export default function LayoutEditorToolbar() {
  const { editMode, toggleEditMode, saveToCode, resetAll, hasUnsavedChanges } = useLayoutEditor()

  // Keyboard shortcut: E toggles edit mode
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      if (e.key === 'e' || e.key === 'E') {
        e.preventDefault()
        toggleEditMode()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [toggleEditMode])

  const handleSave = async () => {
    await saveToCode()
    toast.success('Layout saved!')
  }

  const handleReset = () => {
    resetAll()
    toast('Layout reset to saved defaults')
  }

  if (import.meta.env.PROD) return null

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={toggleEditMode}
        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs font-medium transition-colors ${
          editMode
            ? 'bg-amber-500/20 text-amber-400 ring-1 ring-amber-500/40'
            : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800'
        }`}
        title="Toggle layout edit mode (E)"
      >
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
        </svg>
        Edit
        {hasUnsavedChanges && (
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
        )}
      </button>

      {editMode && (
        <>
          <button
            onClick={handleSave}
            disabled={!hasUnsavedChanges}
            className="px-2.5 py-1.5 rounded text-xs font-medium bg-primary-600 text-white hover:bg-primary-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Save to Code
          </button>
          <button
            onClick={handleReset}
            disabled={!hasUnsavedChanges}
            className="px-2.5 py-1.5 rounded text-xs font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Reset
          </button>
        </>
      )}
    </div>
  )
}
