import i18n from '@/app/i18n'
import { serializeDocument } from '@/core/document/model'
import { useAppStore } from '@/store/app-store'

export async function persistCurrent(): Promise<void> {
  const state = useAppStore.getState()
  if (!state.document || !window.ivec) return
  const contents = serializeDocument(state.document)
  if (state.filePath) {
    const saved = await window.ivec.writeProject(state.filePath, contents, state.document.meta.name)
    useAppStore.getState().markSaved(saved.path)
    useAppStore.getState().setRecents(saved.recents)
    return
  }
  const created = await window.ivec.createLibraryProject(state.document.meta.name, contents)
  state.markSaved(created.path)
}

export async function createAndPersistProject(input: {
  name: string
  profileId: string
  width?: number
  height?: number
  library?: import('@/core/document/model').ExportTarget
}): Promise<void> {
  const store = useAppStore.getState()
  if (store.busy) return
  store.setBusy('creating')
  store.createProject(input)
  try {
    const document = useAppStore.getState().document
    if (!document || !window.ivec) return
    const contents = serializeDocument(document)
    const created = await window.ivec.createLibraryProject(document.meta.name, contents)
    useAppStore.getState().markSaved(created.path)
  } catch {
    useAppStore.getState().showToast(i18n.t('errors.saveFailed'))
  } finally {
    useAppStore.getState().setBusy(null)
  }
}
