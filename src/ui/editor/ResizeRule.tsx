import { PanelResizeHandle } from 'react-resizable-panels'

export function ResizeRule({ direction }: { direction: 'horizontal' | 'vertical' }) {
  const vertical = direction === 'vertical'
  return (
    <PanelResizeHandle
      hitAreaMargins={{ coarse: 20, fine: 8 }}
      className={`group relative z-30 shrink-0 ${
        vertical ? 'h-2 w-full cursor-row-resize' : 'h-full w-2 cursor-col-resize'
      }`}
    >
      <span
        className={`absolute bg-line group-hover:bg-accent group-data-[resize-handle-active]:bg-accent group-data-[resize-handle-state=drag]:bg-accent ${
          vertical
            ? 'top-1/2 right-0 left-0 h-px -translate-y-1/2 group-hover:h-0.5 group-data-[resize-handle-active]:h-0.5'
            : 'top-0 bottom-0 left-1/2 w-px -translate-x-1/2 group-hover:w-0.5 group-data-[resize-handle-active]:w-0.5'
        }`}
      />
    </PanelResizeHandle>
  )
}
