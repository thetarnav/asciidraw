import * as React from 'react'
import * as Tldraw from 'tldraw'

import {
    Vec, VecLike,
    Mat, MatLike,
} from 'tldraw'


const TAU = 6.283185307179586

/**
 * Mutating version of `Tldraw.Mat.applyToPoint`
 */
function transform(vec: VecLike, matrix: MatLike): void {
    let {x, y} = vec
    vec.x = x * matrix.a + y * matrix.c + matrix.e
    vec.y = x * matrix.b + y * matrix.d + matrix.f
}

type Union<T> = {[K in keyof T]: UnionMember<T, K>}[keyof T]

type UnionMember<T, K extends keyof T> = {kind: K, data: T[K]}

type Shapes = {
    draw:      Tldraw.TLDrawShape
    arrow:     Tldraw.TLArrowShape
    geo:       Tldraw.TLGeoShape
    frame:     Tldraw.TLFrameShape
    embed:     Tldraw.TLEmbedShape
    group:     Tldraw.TLGroupShape    
    highlight: Tldraw.TLHighlightShape
    image:     Tldraw.TLImageShape
    line:      Tldraw.TLLineShape
    note:      Tldraw.TLNoteShape
    video:     Tldraw.TLVideoShape
}

type Shape = Union<Shapes>

function getShape(shape: Tldraw.TLShape): Shape {
    return {kind: shape.type, data: shape} as any
}

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


        let _vec = new Vec // reuse object

        function drawGeometry(
            vertices: VecLike[],
            camera:   MatLike,
            mat:      MatLike,
            close:    boolean,
        ) {
            if (vertices.length > 1) {
                _vec.setTo(vertices[0])
                transform(_vec, mat)
                transform(_vec, camera)
                ctx.moveTo(_vec.x, _vec.y)
                for (let i = 1; i < vertices.length; i++) {
                    _vec.setTo(vertices[i])
                    transform(_vec, mat)
                    transform(_vec, camera)
                    ctx.lineTo(_vec.x, _vec.y)
                }
                if (close) {
                    _vec.setTo(vertices[0])
                    transform(_vec, mat)
                    transform(_vec, camera)
                    ctx.lineTo(_vec.x, _vec.y)
                }
            }
        }

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

            let grid_pos_y = -(page_rect.y%font_size.y) * camera.z
            let grid_pos_x = -(page_rect.x%font_size.x) * camera.z

            /*
             render grid lines
            */
            let line_width = Math.min(2, camera.z/1.8 - 0.3)
            if (line_width > 0.1) {

                ctx.beginPath()
                ctx.strokeStyle = 'rgba(128, 128, 128, 0.2)'
                ctx.lineWidth = line_width
                
    
                // vertical lines
                for (let i = 0; i <= cols; i++) {
                    ctx.moveTo(grid_pos_x + i*cell_size.x, 0)
                    ctx.lineTo(grid_pos_x + i*cell_size.x, cell_size.y*rows)
                }
    
                // horizontal lines
                for (let i = 0; i <= rows; i++) {
                    ctx.moveTo(0,                grid_pos_y + i*cell_size.y)
                    ctx.lineTo(cell_size.x*cols, grid_pos_y + i*cell_size.y)
                }
    
                ctx.stroke()
            }

            type Cell = {
                char:  string
                shape: Tldraw.TLShapeId
            }

            let matrix: (undefined | null | Cell)[] = new Array(rows*cols)

            // draw rows and cols count in bottom right corner
            ctx.font = '16px monospace'
            ctx.fillStyle = 'rgba(128, 128, 128, 0.6)'
            let text = `${rows}×${cols}`
            let metrics = ctx.measureText(text)
            ctx.fillText(text, window_size.x - metrics.width - 100, window_size.y - 100)

            let camera_mat = new Mat(
                camera.z, 0, 0,
                camera.z, camera.x*camera.z, camera.y*camera.z,
            )

			let shapes = editor.getRenderingShapes()
			let theme = Tldraw.getDefaultColorTheme({isDarkMode: editor.user.getIsDarkMode()})


			for (let rendering_shape of shapes) {
                let shape = getShape(rendering_shape.shape)

                switch (shape.kind) {
                case 'draw': {

                    ctx.beginPath()
                    ctx.globalAlpha = rendering_shape.opacity

                    let geometry = editor.getShapeGeometry(shape.data)
                    let mat = editor.getShapePageTransform(rendering_shape.id)
                    drawGeometry(geometry.vertices, camera_mat, mat, false)

                    ctx.strokeStyle = theme[shape.data.props.color].solid
                    ctx.lineWidth = 4
                    ctx.stroke()
                    if (shape.data.props.fill !== 'none' && shape.data.props.isClosed) {
                        ctx.fillStyle = theme[shape.data.props.color].semi
                        ctx.fill()
                    }

                    for (let v of geometry.vertices) {
                        _vec.setTo(v)
                        transform(_vec, mat)
                        transform(_vec, camera_mat)
                        v = _vec

                        let col = Math.floor((v.x-grid_pos_x)/cell_size.x)
                        let row = Math.floor((v.y-grid_pos_y)/cell_size.y)

                        ctx.fillStyle = 'pink'
                        ctx.fillRect(
                            grid_pos_x + col*cell_size.x, grid_pos_y + row*cell_size.y,
                            cell_size.x, cell_size.y,
                        )
                        
                        ctx.beginPath()
                        ctx.arc(v.x, v.y, 3, 0, TAU)
                        ctx.fillStyle = 'red'
                        ctx.fill()
                        
                        continue

                    }

                    break
                }
                case 'arrow': {

                    ctx.beginPath()
                    ctx.globalAlpha = rendering_shape.opacity

                    let geometry = editor.getShapeGeometry(shape.data)
                    let mat = editor.getShapePageTransform(rendering_shape.id)
                    drawGeometry(geometry.vertices, camera_mat, mat, false)

                    ctx.strokeStyle = theme[shape.data.props.color].solid
                    ctx.lineWidth = 2
                    ctx.stroke()

                    break
                }
                case 'geo': {

                    ctx.beginPath()
                    ctx.globalAlpha = rendering_shape.opacity

                    let geometry = editor.getShapeGeometry(shape.data)
                    let mat = editor.getShapePageTransform(rendering_shape.id)
                    drawGeometry(geometry.vertices, camera_mat, mat, true)

                    ctx.strokeStyle = theme[shape.data.props.color].solid
                    ctx.lineWidth = 2
                    ctx.stroke()

                    break
                }
                case 'line': {

                    ctx.beginPath()
                    ctx.globalAlpha = rendering_shape.opacity

                    let geometry = editor.getShapeGeometry(shape.data)
                    let mat = editor.getShapePageTransform(rendering_shape.id)
                    drawGeometry(geometry.vertices, camera_mat, mat, false)

                    ctx.strokeStyle = theme[shape.data.props.color].solid
                    ctx.lineWidth = 2
                    ctx.stroke()

                    break
                }
                case 'frame':
                case 'embed':
                case 'group':
                case 'highlight':
                case 'image':
                case 'note':
                case 'video': {
                    break
                }
                default: {
                    shape satisfies never
                }
                }
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
