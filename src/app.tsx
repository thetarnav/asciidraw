import * as React from 'react'
import * as Tldraw from 'tldraw'

import {
    Vec,
} from 'tldraw'

function CustomBackground(): React.ReactNode {

	const editor = Tldraw.useEditor()
	const rCanvas = React.useRef<HTMLCanvasElement>(null)

	React.useLayoutEffect(() => {

		const canvas = rCanvas.current
		if (!canvas) return

		canvas.style.width  = '100%'
		canvas.style.height = '100%'

		const ctx = canvas.getContext('2d')!
        ctx.imageSmoothingEnabled = false
        

        let dpr = 1
        let font_size = new Vec(16, 12)
        let window_size = new Vec()

		let raf = 0

        let measure_time = 0
        let resized = true

        const onResize = () => {resized = true}

		const render = (time: number) => {

            let needs_remeasure = time-measure_time > 4000 || resized

            if (needs_remeasure) {
                measure_time = time
                resized = false
                
                dpr = Tldraw.clamp(window.devicePixelRatio, 1, 2)

                window_size.x = window.innerWidth
                window_size.y = window.innerHeight

                canvas.width  = (window_size.x * dpr)|0
                canvas.height = (window_size.y * dpr)|0
            }
            
			ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
			ctx.clearRect(0, 0, window_size.x, window_size.y)
            
            if (needs_remeasure) {
                font_size.y = parseFloat(window.getComputedStyle(document.body).fontSize)
                ctx.font = font_size.y+'px monospace'
                font_size.x = ctx.measureText('M').width
            }

            let page_rect = editor.getViewportPageBounds()
            let camera = editor.getCamera()

            let cell_size = new Vec(font_size.x*camera.z, font_size.y*camera.z)

            let rows = Math.ceil(page_rect.h/font_size.y)
            let cols = Math.ceil(page_rect.w/font_size.x)

            /*
             render grid lines
            */
            let line_width = Math.min(2, camera.z/1.8 - 0.3)
            if (line_width > 0.1) {

                ctx.beginPath()
                ctx.strokeStyle = 'rgba(128, 128, 128, 0.2)'
                ctx.lineWidth = line_width
                
                let pos_y = -(page_rect.y%font_size.y) * camera.z
                let pos_x = -(page_rect.x%font_size.x) * camera.z
    
                // vertical lines
                for (let i = 0; i <= cols; i++) {
                    ctx.moveTo(pos_x + i*cell_size.x, 0)
                    ctx.lineTo(pos_x + i*cell_size.x, cell_size.y*rows)
                }
    
                // horizontal lines
                for (let i = 0; i <= rows; i++) {
                    ctx.moveTo(0,                pos_y + i*cell_size.y)
                    ctx.lineTo(cell_size.x*cols, pos_y + i*cell_size.y)
                }
    
                ctx.stroke()
            }

            // draw rows and cols count in bottom right corner
            ctx.font = '16px monospace'
            ctx.fillStyle = 'rgba(128, 128, 128, 0.6)'
            let text = `${rows}×${cols}`
            let metrics = ctx.measureText(text)
            ctx.fillText(text, window_size.x - metrics.width - 100, window_size.y - 100)

			
			ctx.scale(camera.z, camera.z)
			ctx.translate(camera.x, camera.y)

			let shapes = editor.getRenderingShapes()
			let theme = Tldraw.getDefaultColorTheme({isDarkMode: editor.user.getIsDarkMode()})
			let pageId = editor.getCurrentPageId()

			for (let {shape, opacity} of shapes) {
                
				let maskedPageBounds = editor.getShapeMaskedPageBounds(shape)
				if (maskedPageBounds == null) continue
				ctx.save()

				if (shape.parentId !== pageId) {
					ctx.beginPath()
					ctx.rect(
						maskedPageBounds.minX,
						maskedPageBounds.minY,
						maskedPageBounds.width,
						maskedPageBounds.height
					)
					ctx.clip()
				}

				ctx.beginPath()

				ctx.globalAlpha = opacity

				const transform = editor.getShapePageTransform(shape.id)
				ctx.transform(transform.a, transform.b, transform.c, transform.d, transform.e, transform.f)

                // Draw a freehand shape
				if (editor.isShapeOfType<Tldraw.TLDrawShape>(shape, 'draw')) {

                    let geometry = editor.getShapeGeometry(shape)
                    if (geometry.vertices.length > 1) {
                        let i = 0
                        let v = geometry.vertices[i]
                        ctx.moveTo(v.x, v.y)
                        for (i++; i < geometry.vertices.length; i++) {
                            v = geometry.vertices[i]
                            ctx.lineTo(v.x, v.y)
                        }
                    }

					ctx.strokeStyle = theme[shape.props.color].solid
					ctx.lineWidth = 4
					ctx.stroke()
					if (shape.props.fill !== 'none' && shape.props.isClosed) {
						ctx.fillStyle = theme[shape.props.color].semi
						ctx.fill()
					}
				}
                // Draw an arrow shape
                else if (editor.isShapeOfType<Tldraw.TLArrowShape>(shape, 'arrow')) {

                    let geometry = editor.getShapeGeometry(shape)
                    if (geometry.vertices.length > 1) {
                        let i = 0
                        let v = geometry.vertices[i]
                        ctx.moveTo(v.x, v.y)
                        for (i++; i < geometry.vertices.length; i++) {
                            v = geometry.vertices[i]
                            ctx.lineTo(v.x, v.y)
                        }
                    }

                    ctx.strokeStyle = theme[shape.props.color].solid
                    ctx.lineWidth = 2
                    ctx.stroke()
                }
                // Draw a geo shape
                else if (editor.isShapeOfType<Tldraw.TLGeoShape>(shape, 'geo')) {
					const bounds = editor.getShapeGeometry(shape).bounds
					ctx.strokeStyle = theme[shape.props.color].solid
					ctx.lineWidth = 2
					ctx.strokeRect(bounds.minX, bounds.minY, bounds.width, bounds.height)
				}
                // Draw any other kind of shape
                else {
					const bounds = editor.getShapeGeometry(shape).bounds
					ctx.strokeStyle = 'black'
					ctx.lineWidth = 2
					ctx.strokeRect(bounds.minX, bounds.minY, bounds.width, bounds.height)
				}
				ctx.restore()
			}

			raf = requestAnimationFrame(render)
		}

		requestAnimationFrame(render)

        window.addEventListener('resize', onResize)

		return () => {
			cancelAnimationFrame(raf)
            window.removeEventListener('resize', onResize)
		}
	}, [editor])

	return <canvas ref={rCanvas} />
}

function CustomShapeIndicator(props: Tldraw.TLShapeIndicatorProps): React.ReactNode {

    console.log('CustomShapeIndicator', props)

    return <></>
}

export function App() {
	return (
		<div className="tldraw__editor">
			<Tldraw.Tldraw
				persistenceKey="asciidraw"
				components={{
                    Background: CustomBackground,
                    // ShapeIndicator: CustomShapeIndicator,
                }}
			/>
		</div>
	)
}
