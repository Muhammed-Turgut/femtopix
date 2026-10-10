import i18n from '@/app/i18n'
import { createEmptyDocument, serializeDocument } from '@/core/document/model'
import { useAppStore } from '@/store/app-store'

export async function persistCurrent(): Promise<void> {
  const state = useAppStore.getState()
  if (!state.document || !window.ivec) return
  const contents = serializeDocument(state.document)
  if (state.filePath) {
    await window.ivec.writeProject(state.filePath, contents)
    state.markSaved(state.filePath)
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
  const document = createEmptyDocument(input)
  if (!window.ivec) {
    useAppStore.getState().createProject(input)
    return
  }
  try {
    const contents = serializeDocument(document)
    const created = await window.ivec.createLibraryProject(document.meta.name, contents)
    useAppStore.getState().loadFromFile(created.path, contents)
  } catch {
    useAppStore.getState().createProject(input)
    useAppStore.getState().showToast(i18n.t('errors.saveFailed'))
  }
}
