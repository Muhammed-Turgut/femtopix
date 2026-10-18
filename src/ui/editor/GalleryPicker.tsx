import { Pencil, Square, Upload } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { loadAnimations, type GalleryAnimation } from '@/core/gallery/animations'
import { filterGalleryIcons, isGallerySvg, loadGallery, type GalleryCategory } from '@/core/gallery/catalog'
import { rgbaToMono, type MonoBitmap } from '@/core/render/draw-node'
import { useAppStore } from '@/store/app-store'
import { assetFromUrl, placeImageOnActiveScreen } from '@/ui/editor/document-actions'
import { Button, Input } from '@/ui/primitives'

type GalleryTab = 'icons' | 'animations' | 'upload' | 'create'

const SIZES = [16, 24, 32, 48] as const

function categoryLabel(category: GalleryCategory, language: string): string {
  return language.startsWith('en') ? category.name.en : category.name.tr
}

export function GalleryPicker() {
  const { t, i18n } = useTranslation()
  const open = useAppStore((s) => s.galleryOpen)
  const theme = useAppStore((s) => s.resolvedTheme)
  const categories = useMemo(() => loadGallery(), [])
  const animations = useMemo(() => loadAnimations(), [])
  const [tab, setTab] = useState<GalleryTab>('icons')
  const [size, setSize] = useState<(typeof SIZES)[number]>(16)
  const [categoryId, setCategoryId] = useState<string | 'all' | null>(null)
  const [query, setQuery] = useState('')
  const [iconsReady, setIconsReady] = useState(false)
  const [selectedAnimId, setSelectedAnimId] = useState<string | null>(null)
  const [placing, setPlacing] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const invert = theme === 'dark'
  const language = i18n.language
  const pixelOff = '#000000'
  const pixelOn = useAppStore((s) => s.document?.device.preview.pixelOn) ?? '#ffffff'
  const showIcons = categoryId !== null || query.trim().length > 0

  const icons = useMemo(
    () => (showIcons ? filterGalleryIcons(categories, query, categoryId ?? 'all') : []),
    [categories, query, categoryId, showIcons]
  )
  const shownAnims = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase('tr')
    if (!needle) return animations
    return animations.filter(
      (anim) =>
        anim.name.tr.toLocaleLowerCase('tr').includes(needle) ||
        anim.name.en.toLocaleLowerCase('en').includes(needle) ||
        anim.id.includes(needle)
    )
  }, [animations, query])
  const selectedAnim = shownAnims.find((anim) => anim.id === selectedAnimId) ?? shownAnims[0] ?? null

  useEffect(() => {
    if (!open || tab !== 'icons' || !showIcons) {
      setIconsReady(false)
      return
    }
    setIconsReady(false)
    const id = window.requestAnimationFrame(() => setIconsReady(true))
    return () => window.cancelAnimationFrame(id)
  }, [open, tab, showIcons, categoryId, query])

  if (!open) return null

  const close = () => useAppStore.getState().closeGallery()

  const place = async (name: string, url: string) => {
    const asset = await assetFromUrl(url)
    placeImageOnActiveScreen(name, asset, size)
    close()
  }

  const placeAnim = async (anim: GalleryAnimation) => {
    if (placing) return
    setPlacing(true)
    try {
      const frames = await Promise.all(anim.frames.map((frame) => assetFromUrl(frame.url)))
      const first = frames[0]
      if (!first) return
      placeImageOnActiveScreen(language.startsWith('en') ? anim.name.en : anim.name.tr, first, size, undefined, {
        frames,
        fps: anim.fps
      })
      close()
    } finally {
      setPlacing(false)
    }
  }

  const readFile = (file: File) => {
    const reader = new FileReader()
    reader.onload = () => {
      void place(file.name.replace(/\.[^.]+$/, ''), String(reader.result || ''))
    }
    reader.readAsDataURL(file)
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-app/80" onMouseDown={close}>
      <div
        className="flex h-[min(760px,90vh)] w-[min(1080px,94vw)] flex-col overflow-hidden rounded-md border border-line bg-panel"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="flex h-10 items-center gap-4 border-b border-line px-3">
          <ModeTab id="icons" label={t('editor.galleryIcons')} tab={tab} onChange={setTab} />
          <ModeTab id="animations" label={t('editor.galleryAnimations')} tab={tab} onChange={setTab} />
          <ModeTab id="upload" label={t('editor.galleryUpload')} tab={tab} onChange={setTab} />
          <ModeTab id="create" label={t('editor.galleryCreate')} tab={tab} onChange={setTab} />
          <div className="ml-auto flex items-center gap-2">
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t('editor.gallerySearch')}
              className="w-56"
            />
            <Button tone="primary" onClick={() => setTab('create')}>
              {t('editor.galleryNew')}
            </Button>
          </div>
        </div>

        {tab === 'icons' ? (
          <>
            <div className="flex flex-wrap items-center gap-2 border-b border-line px-3 py-2">
              {SIZES.map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setSize(value)}
                  className={`h-6 rounded px-2 text-[12px] ${size === value ? 'bg-selected text-ink' : 'text-muted hover:text-ink'}`}
                >
                  {value}×{value}
                </button>
              ))}
              <span className="ml-auto text-[11px] text-muted tabular-nums">{t('editor.galleryCount', { count: icons.length })}</span>
            </div>
            <div className="flex flex-wrap gap-x-3 gap-y-1 border-b border-line px-3 py-2">
              <Chip active={categoryId === 'all'} onClick={() => setCategoryId('all')}>
                {t('editor.galleryAll')}
              </Chip>
              {categories.map((category) => (
                <Chip key={category.id} active={categoryId === category.id} onClick={() => setCategoryId(category.id)}>
                  {categoryLabel(category, i18n.language)}
                </Chip>
              ))}
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-3">
              {!showIcons ? (
                <div className="grid h-full place-items-center px-6 text-center text-[12px] text-muted">{t('editor.galleryPickCategory')}</div>
              ) : !iconsReady ? (
                <Waiting label={t('editor.galleryLoading')} />
              ) : icons.length === 0 ? (
                <div className="grid h-full place-items-center text-[12px] text-muted">{t('editor.galleryEmptyCategory')}</div>
              ) : (
                <div className="grid grid-cols-[repeat(auto-fill,minmax(52px,1fr))] gap-1">
                  {icons.map((icon) => (
                    <button
                      key={icon.url}
                      type="button"
                      title={icon.name}
                      aria-label={icon.name}
                      className="grid aspect-square place-items-center rounded border border-transparent hover:border-line hover:bg-hover"
                      style={{ contentVisibility: 'auto', containIntrinsicSize: '52px 52px' }}
                      onClick={() => {
                        if (!isGallerySvg(icon.file)) return
                        void place(icon.name, icon.url)
                      }}
                    >
                      <img
                        src={icon.url}
                        alt=""
                        width={32}
                        height={32}
                        loading="lazy"
                        draggable={false}
                        className={`h-8 w-8 ${invert ? 'invert' : ''}`}
                        style={{ imageRendering: 'pixelated' }}
                      />
                    </button>
                  ))}
                </div>
              )}
            </div>
          </>
        ) : null}

        {tab === 'animations' ? (
          <>
            <div className="flex flex-wrap items-center gap-2 border-b border-line px-3 py-2">
              {SIZES.map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setSize(value)}
                  className={`h-6 rounded px-2 text-[12px] ${size === value ? 'bg-selected text-ink' : 'text-muted hover:text-ink'}`}
                >
                  {value}×{value}
                </button>
              ))}
              <span className="ml-auto text-[11px] text-muted tabular-nums">{t('editor.galleryAnimCount', { count: shownAnims.length })}</span>
            </div>
            <div className="flex min-h-0 flex-1">
              {shownAnims.length === 0 ? (
                <div className="grid flex-1 place-items-center text-[12px] text-muted">{t('editor.galleryAnimTitle')}</div>
              ) : (
                <div className="min-h-0 flex-1 overflow-auto p-2">
                  {shownAnims.map((anim) => {
                    const label = language.startsWith('en') ? anim.name.en : anim.name.tr
                    const active = selectedAnim?.id === anim.id
                    return (
                      <button
                        key={anim.id}
                        type="button"
                        title={label}
                        className={`flex h-8 w-full items-center rounded px-2 text-left text-[12px] ${active ? 'bg-selected text-ink' : 'text-muted hover:bg-hover hover:text-ink'}`}
                        onClick={() => setSelectedAnimId(anim.id)}
                        onDoubleClick={() => void placeAnim(anim)}
                      >
                        {label}
                      </button>
                    )
                  })}
                </div>
              )}
              <aside className="flex w-72 shrink-0 flex-col items-center gap-3 border-l border-line p-4">
                {selectedAnim ? (
                  <>
                    <AnimStage anim={selectedAnim} pixelOff={pixelOff} pixelOn={pixelOn} />
                    <div className="text-center text-[12px] text-ink">
                      {language.startsWith('en') ? selectedAnim.name.en : selectedAnim.name.tr}
                    </div>
                    <div className="text-center text-[11px] text-muted">
                      {t('editor.galleryAnimMeta', { fps: selectedAnim.fps, count: selectedAnim.frames.length, size })}
                    </div>
                    <Button tone="primary" disabled={placing} onClick={() => selectedAnim && void placeAnim(selectedAnim)}>
                      {placing ? t('editor.galleryLoading') : t('editor.galleryAnimPlace')}
                    </Button>
                  </>
                ) : (
                  <Waiting label={t('editor.galleryLoading')} />
                )}
              </aside>
            </div>
          </>
        ) : null}

        {tab === 'upload' ? (
          <div className="grid min-h-0 flex-1 place-items-center p-6">
            <button
              type="button"
              className="flex w-full max-w-md flex-col items-center gap-3 rounded-md border border-dashed border-line px-8 py-12 text-center hover:bg-hover"
              onClick={() => fileRef.current?.click()}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault()
                const file = event.dataTransfer.files[0]
                if (file) readFile(file)
              }}
            >
              <Upload size={28} strokeWidth={1.5} className="text-muted" />
              <div className="text-[13px] font-medium">{t('editor.galleryUploadTitle')}</div>
              <div className="text-[12px] text-muted">{t('editor.galleryUploadBody')}</div>
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/svg+xml,image/png,image/webp,.svg,.png,.webp"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0]
                if (file) readFile(file)
                event.target.value = ''
              }}
            />
          </div>
        ) : null}

        {tab === 'create' ? (
          <div className="grid min-h-0 flex-1 grid-cols-2 gap-3 p-6">
            <CreateCard
              icon={Pencil}
              title={t('editor.galleryCreateDraw')}
              body={t('editor.galleryCreateDrawBody')}
              onClick={() => {
                useAppStore.getState().closeGallery()
                useAppStore.getState().setTool('pencil')
              }}
            />
            <CreateCard
              icon={Square}
              title={t('editor.galleryCreateShape')}
              body={t('editor.galleryCreateShapeBody')}
              onClick={() => {
                useAppStore.getState().closeGallery()
                useAppStore.getState().setTool('rect')
              }}
            />
          </div>
        ) : null}

        <div className="flex h-10 items-center justify-end border-t border-line px-3">
          <Button onClick={close}>{t('editor.galleryCancel')}</Button>
        </div>
      </div>
    </div>
  )
}

function Waiting({ label }: { label: string }) {
  return (
    <div className="grid h-full place-items-center gap-3 text-[12px] text-muted">
      <span className="flex items-center gap-1.5">
        <span className="size-1.5 animate-pulse rounded-full bg-ink" />
        <span className="size-1.5 animate-pulse rounded-full bg-ink [animation-delay:160ms]" />
        <span className="size-1.5 animate-pulse rounded-full bg-ink [animation-delay:320ms]" />
      </span>
      {label}
    </div>
  )
}

function loadFrameMono(src: string, size: number): Promise<MonoBitmap> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    const draw = () => {
      const sample = document.createElement('canvas')
      sample.width = size
      sample.height = size
      const ctx = sample.getContext('2d')
      if (!ctx) {
        resolve({ width: size, height: size, data: new Uint8Array(size * size) })
        return
      }
      ctx.imageSmoothingEnabled = false
      ctx.clearRect(0, 0, size, size)
      ctx.drawImage(image, 0, 0, size, size)
      resolve(rgbaToMono(ctx.getImageData(0, 0, size, size).data, size, size))
    }
    image.onload = () => {
      const decoded = image.decode?.()
      if (decoded) void decoded.then(draw).catch(draw)
      else draw()
    }
    image.onerror = () => reject(new Error('frame'))
    image.src = src
  })
}

function paintMono(canvas: HTMLCanvasElement, bitmap: MonoBitmap, ink: string, off: string): void {
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  ctx.imageSmoothingEnabled = false
  ctx.fillStyle = off
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.fillStyle = ink
  const scale = canvas.width / bitmap.width
  for (let y = 0; y < bitmap.height; y += 1) {
    for (let x = 0; x < bitmap.width; x += 1) {
      if (bitmap.data[y * bitmap.width + x]) ctx.fillRect(x * scale, y * scale, Math.ceil(scale), Math.ceil(scale))
    }
  }
}

function AnimStage({ anim, pixelOff, pixelOn }: { anim: GalleryAnimation; pixelOff: string; pixelOn: string }) {
  const ref = useRef<HTMLCanvasElement>(null)
  const framesRef = useRef<MonoBitmap[]>([])
  const [ready, setReady] = useState(false)
  const [index, setIndex] = useState(0)
  const sample = Math.max(8, anim.size || 16)

  useEffect(() => {
    let cancel = false
    setReady(false)
    setIndex(0)
    framesRef.current = []
    void Promise.all(anim.frames.map((frame) => loadFrameMono(frame.url, sample).catch(() => null))).then((bitmaps) => {
      if (cancel) return
      framesRef.current = bitmaps.filter((bitmap): bitmap is MonoBitmap => bitmap !== null)
      setReady(true)
    })
    return () => {
      cancel = true
    }
  }, [anim, sample])

  useEffect(() => {
    if (!ready || framesRef.current.length < 2) return
    const ms = Math.max(70, Math.round(1000 / Math.max(1, anim.fps)))
    const id = window.setInterval(() => setIndex((value) => (value + 1) % framesRef.current.length), ms)
    return () => window.clearInterval(id)
  }, [ready, anim])

  useEffect(() => {
    const canvas = ref.current
    const bitmap = framesRef.current[index]
    if (!canvas || !bitmap) return
    paintMono(canvas, bitmap, pixelOn, pixelOff)
  }, [ready, index, pixelOn, pixelOff])

  return (
    <div className="grid size-40 place-items-center rounded border border-line" style={{ background: pixelOff }}>
      {ready ? (
        <canvas ref={ref} width={160} height={160} className="size-40" style={{ imageRendering: 'pixelated' }} />
      ) : (
        <Waiting label="" />
      )}
    </div>
  )
}

function ModeTab({
  id,
  label,
  tab,
  onChange
}: {
  id: GalleryTab
  label: string
  tab: GalleryTab
  onChange: (tab: GalleryTab) => void
}) {
  const active = tab === id
  return (
    <button type="button" onClick={() => onChange(id)} className="flex h-10 items-center gap-2 text-[12px]">
      <span className={`size-2 rounded-full ${active ? 'bg-accent' : 'bg-line'}`} />
      <span className={active ? 'text-ink' : 'text-muted'}>{label}</span>
    </button>
  )
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: string }) {
  return (
    <button type="button" onClick={onClick} className="flex h-6 items-center gap-1.5 text-[12px]">
      <span className={`size-1.5 rounded-full ${active ? 'bg-accent' : 'bg-line'}`} />
      <span className={active ? 'text-ink' : 'text-muted hover:text-ink'}>{children}</span>
    </button>
  )
}

function CreateCard({
  icon: Icon,
  title,
  body,
  onClick
}: {
  icon: typeof Pencil
  title: string
  body: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-col items-start gap-2 rounded-md border border-line bg-elevated p-4 text-left hover:bg-hover"
    >
      <Icon size={20} strokeWidth={1.5} className="text-muted" />
      <div className="text-[13px] font-medium">{title}</div>
      <div className="text-[12px] text-muted">{body}</div>
    </button>
  )
}
