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

        const dpr = Math.min(2, Math.max(1, window.devicePixelRatio))

		const ctx = canvas.getContext('2d')!
        ctx.imageSmoothingEnabled = false


        let window_size = new Vec()

        const onResize = () => {
            window_size.x = window.innerWidth
            window_size.y = window.innerHeight

            canvas.width  = (window_size.x * dpr)|0
            canvas.height = (window_size.y * dpr)|0
        }

		let raf = -1

		const render = () => {

			ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
			ctx.clearRect(0, 0, window_size.x, window_size.y)

			const camera = editor.getCamera()
			ctx.scale(camera.z, camera.z)
			ctx.translate(camera.x, camera.y)

			const renderingShapes = editor.getRenderingShapes()
			const theme = Tldraw.getDefaultColorTheme({isDarkMode: editor.user.getIsDarkMode()})
			const currentPageId = editor.getCurrentPageId()

			for (const {shape, opacity} of renderingShapes) {
                
				const maskedPageBounds = editor.getShapeMaskedPageBounds(shape)
				if (!maskedPageBounds) continue
				ctx.save()

				if (shape.parentId !== currentPageId) {
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

				if (editor.isShapeOfType<Tldraw.TLDrawShape>(shape, 'draw')) {
					// Draw a freehand shape
					for (const segment of shape.props.segments) {
						ctx.moveTo(segment.points[0].x, segment.points[0].y)
						if (segment.type === 'straight') {
							ctx.lineTo(segment.points[1].x, segment.points[1].y)
						} else {
							for (const point of segment.points.slice(1)) {
								ctx.lineTo(point.x, point.y)
							}
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
                else if (editor.isShapeOfType<Tldraw.TLArrowShape>(shape, 'arrow')) {
                    
                    // Draw an arrow shape
                    const start = shape.props.start
                    const end = shape.props.end

                    ctx.beginPath()
                    ctx.moveTo(start.x, start.y)
                    ctx.lineTo(end.x, end.y)
                    ctx.strokeStyle = theme[shape.props.color].solid
                    ctx.lineWidth = 2
                    ctx.stroke()

                    // Draw arrowhead at end
                    const angle = Math.atan2(end.y - start.y, end.x - start.x)
                    const arrowSize = 12
                    ctx.beginPath()
                    ctx.moveTo(end.x - arrowSize * Math.cos(angle - Math.PI / 6), end.y - arrowSize * Math.sin(angle - Math.PI / 6))
                    ctx.lineTo(end.x, end.y)
                    ctx.lineTo(end.x - arrowSize * Math.cos(angle + Math.PI / 6), end.y - arrowSize * Math.sin(angle + Math.PI / 6))
                    ctx.stroke()
                }
                else if (editor.isShapeOfType<Tldraw.TLGeoShape>(shape, 'geo')) {
					// Draw a geo shape
					const bounds = editor.getShapeGeometry(shape).bounds
					ctx.strokeStyle = theme[shape.props.color].solid
					ctx.lineWidth = 2
					ctx.strokeRect(bounds.minX, bounds.minY, bounds.width, bounds.height)
				}
                else {
					// Draw any other kind of shape
					const bounds = editor.getShapeGeometry(shape).bounds
					ctx.strokeStyle = 'black'
					ctx.lineWidth = 2
					ctx.strokeRect(bounds.minX, bounds.minY, bounds.width, bounds.height)
				}
				ctx.restore()
			}

			raf = requestAnimationFrame(render)
		}

		render()

        window.addEventListener('resize', onResize)
        setTimeout(onResize)
        onResize()

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
