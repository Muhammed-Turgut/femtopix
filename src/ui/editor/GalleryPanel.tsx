import { ChevronLeft, Images } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { isGallerySvg, loadGallery, type GalleryCategory } from '@/core/gallery/catalog'
import { assetFromUrl, placeImageOnActiveScreen } from '@/ui/editor/document-actions'
import { EmptyState, IconButton, Input } from '@/ui/primitives'

function categoryLabel(category: GalleryCategory, language: string): string {
  return language.startsWith('en') ? category.name.en : category.name.tr
}

export function GalleryPanel() {
  const { t, i18n } = useTranslation()
  const categories = useMemo(() => loadGallery(), [])
  const [activeId, setActiveId] = useState<string | null>(categories.length === 1 ? categories[0].id : null)
  const [query, setQuery] = useState('')
  const needle = query.trim().toLocaleLowerCase('tr')
  const active = categories.find((category) => category.id === activeId) ?? null
  const visibleCategories = needle
    ? categories.filter((category) => categoryLabel(category, i18n.language).toLocaleLowerCase('tr').includes(needle))
    : categories
  const visibleIcons = active
    ? needle
      ? active.icons.filter((icon) => icon.name.toLocaleLowerCase('tr').includes(needle) || icon.file.toLocaleLowerCase('tr').includes(needle))
      : active.icons
    : []

  if (categories.length === 0) {
    return (
      <EmptyState
        icon={Images}
        title={t('editor.galleryEmptyTitle')}
        body={t('editor.galleryEmptyBody')}
      />
    )
  }

  if (!active) {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="border-b border-line p-2">
          <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t('editor.gallerySearch')} />
        </div>
        <div className="min-h-0 flex-1 overflow-auto">
        {visibleCategories.map((category) => (
          <button
            key={category.id}
            type="button"
            onClick={() => {
              setQuery('')
              setActiveId(category.id)
            }}
            className="flex h-8 w-full items-center justify-between px-3 text-left hover:bg-hover"
          >
            <span className="truncate text-[12px]">{categoryLabel(category, i18n.language)}</span>
            <span className="text-[11px] text-muted tabular-nums">{category.icons.length}</span>
          </button>
        ))}
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex h-8 items-center gap-1 border-b border-line px-1">
        <IconButton
          aria-label={t('editor.galleryBack')}
          onClick={() => {
            setQuery('')
            setActiveId(null)
          }}
        >
          <ChevronLeft size={16} strokeWidth={1.5} />
        </IconButton>
        <span className="min-w-0 flex-1 truncate text-[12px] font-semibold">{categoryLabel(active, i18n.language)}</span>
        <span className="pr-2 text-[11px] text-muted tabular-nums">{visibleIcons.length}</span>
      </div>
      <div className="border-b border-line p-2">
        <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t('editor.gallerySearch')} />
      </div>
      {visibleIcons.length === 0 ? (
        <EmptyState icon={Images} title={t('editor.galleryEmptyCategory')} body={t('editor.galleryEmptyBody')} />
      ) : (
        <div className="grid min-h-0 flex-1 auto-rows-min grid-cols-4 content-start gap-1 overflow-auto p-2">
          {visibleIcons.map((icon) => (
            <button
              key={icon.file}
              type="button"
              title={icon.name}
              aria-label={icon.name}
              className="grid aspect-square place-items-center rounded border border-line bg-elevated hover:bg-hover"
              onClick={() => {
                if (!isGallerySvg(icon.file)) return
                void assetFromUrl(icon.url).then((asset) => placeImageOnActiveScreen(icon.name, asset))
              }}
            >
              <img
                src={icon.url}
                alt=""
                width={32}
                height={32}
                draggable={false}
                className="h-8 w-8"
                style={{ imageRendering: 'pixelated' }}
              />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
